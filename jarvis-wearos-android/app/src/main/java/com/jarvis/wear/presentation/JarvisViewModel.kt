package com.jarvis.wear.presentation

import android.app.Application
import android.content.Context
import android.os.BatteryManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.jarvis.wear.ai.AiPayloadCodec
import com.jarvis.wear.ai.AiRepository
import com.jarvis.wear.ai.AiRequestConfig
import com.jarvis.wear.ai.DiscoveredModel
import com.jarvis.wear.ai.OpenAiProvider
import com.jarvis.wear.ai.PersonalityEngine
import com.jarvis.wear.data.database.ConversationDatabase
import com.jarvis.wear.data.database.ConversationMemoryHelper
import com.jarvis.wear.data.database.MessageEntity
import com.jarvis.wear.data.preferences.JarvisSettingsState
import com.jarvis.wear.data.preferences.SettingsRepository
import com.jarvis.wear.data.security.CredentialVault
import com.jarvis.wear.device.DeviceControlManager
import com.jarvis.wear.device.VoiceActionIntent
import com.jarvis.wear.device.VoiceActionParser
import com.jarvis.wear.device.VoiceActionType
import com.jarvis.wear.services.JarvisHapticManager
import com.jarvis.wear.services.NetworkMonitor
import com.jarvis.wear.suggestions.AdaptiveSuggestionEngine
import com.jarvis.wear.suggestions.SuggestionItem
import com.jarvis.wear.ui.theme.OperationalState
import com.jarvis.wear.voice.SpeechRecognitionManager
import com.jarvis.wear.voice.TextToSpeechManager
import com.jarvis.wear.voice.WatchVoiceProfile
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * Pure state-lifecycle & caption policy for the V5 Home Screen Primary Arc Reactor Interface.
 * Guarantees that:
 * 1. Voice interactions initiated on the Home screen transition through
 *    IDLE -> LISTENING -> PROCESSING -> SPEAKING -> IDLE in-place without navigating to Dialogue.
 * 2. Optional Home-screen captions format cleanly and clear when the next interaction begins.
 */
object HomeReactorInteractionPolicy {
    const val HOME_REACTOR_SIZE_DP = 66
    const val RESERVED_CAPTION_SLOT_HEIGHT_DP = 28

    fun shouldAutoNavigateToDialogueFromHome(): Boolean = false

    fun resolveVisibleHomeCaption(
        homeCaptionsEnabled: Boolean,
        operationalState: OperationalState,
        activeCaption: String
    ): String {
        if (!homeCaptionsEnabled) return ""
        if (operationalState == OperationalState.LISTENING || operationalState == OperationalState.PROCESSING) {
            return ""
        }
        return activeCaption.trim()
    }
}

/**
 * Pure input-pipeline routing policy separating typed-message submission from microphone
 * speech-recognition handling.
 */
data class SubmissionRouteDecision(
    val normalizedPrompt: String,
    val shouldStartMicrophone: Boolean,
    val shouldCancelActiveMicrophone: Boolean,
    val targetInitialState: OperationalState
)

object InputSubmissionRouter {
    /**
     * Typed messages bypass speech recognition completely, cancel any active recognizer session,
     * and transition straight to `OperationalState.PROCESSING`.
     */
    fun routeTypedMessage(rawText: String, currentState: OperationalState): SubmissionRouteDecision? {
        val cleaned = rawText.trim()
        if (cleaned.isEmpty()) return null
        return SubmissionRouteDecision(
            normalizedPrompt = cleaned,
            shouldStartMicrophone = false,
            shouldCancelActiveMicrophone = currentState == OperationalState.LISTENING,
            targetInitialState = OperationalState.PROCESSING
        )
    }

    /**
     * Voice trigger activates the microphone (`OperationalState.LISTENING`) when idle/ready,
     * or stops active speech/listening when already active.
     */
    fun shouldActivateMicrophoneOnVoiceTrigger(currentState: OperationalState): Boolean {
        return currentState != OperationalState.LISTENING && currentState != OperationalState.SPEAKING
    }
}

class JarvisViewModel(application: Application) : AndroidViewModel(application) {

    private val database = ConversationDatabase.getInstance(application)
    private val messageDao = database.messageDao()
    private val settingsRepository = SettingsRepository(application)
    private val credentialVault = CredentialVault(application)
    private val aiRepository = AiRepository()
    private val suggestionEngine = AdaptiveSuggestionEngine()
    private val networkMonitor = NetworkMonitor(application)
    val deviceControlManager = DeviceControlManager(application)
    val hapticManager = JarvisHapticManager(application)

    val speechRecognizer = SpeechRecognitionManager(application)
    val ttsManager = TextToSpeechManager(application)

    val settings: StateFlow<JarvisSettingsState> = settingsRepository.settings

    val availableVoices: StateFlow<List<WatchVoiceProfile>> = ttsManager.availableVoices
    val activeVoiceSummary: StateFlow<String> = ttsManager.activeVoiceSummary

    val messages: StateFlow<List<MessageEntity>> = messageDao.observeAllMessages()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _operationalState = MutableStateFlow(OperationalState.IDLE)
    val operationalState: StateFlow<OperationalState> = _operationalState.asStateFlow()

    private val _statusText = MutableStateFlow("TAP CORE OR MIC TO SPEAK")
    val statusText: StateFlow<String> = _statusText.asStateFlow()

    /**
     * V5 Home Screen Caption State:
     * Holds the current/latest spoken response so the Home screen can display it beneath
     * the Arc Reactor when `settings.homeCaptionsEnabled` is true, and clears when the next
     * voice interaction begins.
     */
    private val _activeHomeCaption = MutableStateFlow("")
    val activeHomeCaption: StateFlow<String> = _activeHomeCaption.asStateFlow()

    private val _connectionTestStatus = MutableStateFlow("")
    val connectionTestStatus: StateFlow<String> = _connectionTestStatus.asStateFlow()

    private val _maskedKeyPreview = MutableStateFlow(
        credentialVault.getMaskedApiKey(settings.value.providerId)
    )
    val maskedKeyPreview: StateFlow<String> = _maskedKeyPreview.asStateFlow()

    private val _discoveredModels = MutableStateFlow<List<DiscoveredModel>>(emptyList())
    val discoveredModels: StateFlow<List<DiscoveredModel>> = _discoveredModels.asStateFlow()

    private val _isDiscoveringModels = MutableStateFlow(false)
    val isDiscoveringModels: StateFlow<Boolean> = _isDiscoveringModels.asStateFlow()

    private val _pendingDeviceAction = MutableStateFlow<VoiceActionIntent?>(null)
    val pendingDeviceAction: StateFlow<VoiceActionIntent?> = _pendingDeviceAction.asStateFlow()

    private val _screenTorchActive = MutableStateFlow(false)
    val screenTorchActive: StateFlow<Boolean> = _screenTorchActive.asStateFlow()

    private val _suggestions = MutableStateFlow<List<SuggestionItem>>(emptyList())
    val suggestions: StateFlow<List<SuggestionItem>> = _suggestions.asStateFlow()

    private var lastUserPrompt: String = ""

    init {
        // Seed initial greeting if database is empty
        viewModelScope.launch {
            val recent = messageDao.getRecentMessages(1)
            if (recent.isEmpty()) {
                val welcome = "At your service, sir. All Galaxy Watch 4 telemetry and Arc Reactor systems are operating at peak efficiency."
                messageDao.insertMessage(
                    MessageEntity(
                        role = "assistant",
                        content = welcome
                    )
                )
                _activeHomeCaption.value = welcome
            } else {
                val lastAssistant = recent.firstOrNull { it.role == "assistant" }
                if (lastAssistant != null) {
                    _activeHomeCaption.value = lastAssistant.content
                }
            }
            refreshSuggestions()
        }

        // Observe network connectivity for DISCONNECTED state
        viewModelScope.launch {
            networkMonitor.isOnline.collect { online ->
                if (!online) {
                    _operationalState.value = OperationalState.DISCONNECTED
                    _statusText.value = "LOCAL CONTINGENCY CORE"
                } else if (_operationalState.value == OperationalState.DISCONNECTED) {
                    _operationalState.value = OperationalState.IDLE
                    _statusText.value = getGreeting()
                }
            }
        }

        // Synchronize TTS speaking state with OperationalState.SPEAKING -> IDLE
        viewModelScope.launch {
            ttsManager.isSpeaking.collect { speaking ->
                if (speaking) {
                    _operationalState.value = OperationalState.SPEAKING
                    _statusText.value = "AUDIO TRANSMISSION ACTIVE"
                } else if (_operationalState.value == OperationalState.SPEAKING) {
                    _operationalState.value = OperationalState.IDLE
                    _statusText.value = getGreeting()
                }
            }
        }

        // Refresh masked key, model list, and apply TTS voice settings immediately whenever settings change
        viewModelScope.launch {
            var lastProvider = ""
            settings.collect { current ->
                _maskedKeyPreview.value = credentialVault.getMaskedApiKey(current.providerId)
                if (current.providerId != lastProvider) {
                    lastProvider = current.providerId
                    _discoveredModels.value = when (current.providerId) {
                        "openai" -> OpenAiProvider.DEFAULT_MODELS
                        else -> emptyList()
                    }
                    if (current.providerId == "gemini" && credentialVault.hasApiKey("gemini")) {
                        discoverModelsForCurrentProvider(silent = true)
                    }
                }
                ttsManager.applyVoiceSettings(
                    accent = current.voiceAccent,
                    preferredVoiceName = current.preferredVoiceName,
                    speechRate = current.speechRate,
                    pitch = current.voicePitch
                )
                refreshSuggestions()
            }
        }
    }

    fun getGreeting(): String = PersonalityEngine.getTimeBasedGreeting()

    fun getFormattedTime(): String =
        SimpleDateFormat("HH:mm", Locale.US).format(Date())

    fun getBatteryPercentage(): Int {
        val bm = getApplication<Application>().getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        return bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.coerceIn(0, 100) ?: 94
    }

    fun performTapHaptic() {
        hapticManager.tap(settings.value.hapticsEnabled)
    }

    fun performRotaryHaptic() {
        hapticManager.rotaryTick(settings.value.hapticsEnabled)
    }

    fun performConfirmHaptic() {
        hapticManager.confirm(settings.value.hapticsEnabled)
    }

    fun setScreenTorch(enabled: Boolean) {
        performTapHaptic()
        _screenTorchActive.value = enabled
    }

    fun stopSpeaking() {
        performTapHaptic()
        ttsManager.stop()
        if (_operationalState.value == OperationalState.SPEAKING) {
            _operationalState.value = OperationalState.IDLE
            _statusText.value = getGreeting()
        }
    }

    fun previewCurrentVoice() {
        performTapHaptic()
        val cfg = settings.value
        ttsManager.previewVoice(
            accent = cfg.voiceAccent,
            preferredVoiceName = cfg.preferredVoiceName,
            speechRate = cfg.speechRate,
            pitch = cfg.voicePitch
        )
    }

    fun confirmPendingDeviceAction() {
        val pending = _pendingDeviceAction.value ?: return
        _pendingDeviceAction.value = null
        performConfirmHaptic()
        viewModelScope.launch {
            if (pending.type == VoiceActionType.CLEAR_HISTORY) {
                clearConversationHistory()
                val msg = "Conversation logs purged as confirmed, sir."
                messageDao.insertMessage(MessageEntity(role = "assistant", content = msg))
                _activeHomeCaption.value = msg
                speakIfEnabled(msg)
                return@launch
            }
            val result = deviceControlManager.executeAction(pending, confirmed = true)
            result.screenTorchEnabled?.let { _screenTorchActive.value = it }
            messageDao.insertMessage(
                MessageEntity(role = "assistant", content = result.spokenResponse)
            )
            _activeHomeCaption.value = result.spokenResponse
            speakIfEnabled(result.spokenResponse)
        }
    }

    fun cancelPendingDeviceAction() {
        val pending = _pendingDeviceAction.value ?: return
        _pendingDeviceAction.value = null
        performTapHaptic()
        viewModelScope.launch {
            val msg = "Action cancelled, sir (${pending.confirmationPrompt.substringBefore("?")})."
            messageDao.insertMessage(MessageEntity(role = "assistant", content = msg))
            _activeHomeCaption.value = msg
            _operationalState.value = OperationalState.IDLE
            _statusText.value = getGreeting()
        }
    }

    /**
     * V5 State-Driven Voice Interaction:
     * Tapping the Arc Reactor or Mic on the Home screen transitions directly through
     * IDLE -> LISTENING -> PROCESSING -> SPEAKING -> IDLE on the Home screen without
     * navigating away to the Dialogue screen.
     */
    fun toggleVoiceInteraction(
        onPermissionRequired: () -> Unit,
        onNavigateToDialogue: (() -> Unit)? = null
    ) {
        if (_operationalState.value == OperationalState.SPEAKING) {
            stopSpeaking()
            return
        }

        if (_operationalState.value == OperationalState.LISTENING) {
            performTapHaptic()
            speechRecognizer.stopListening()
            _operationalState.value = OperationalState.IDLE
            _statusText.value = getGreeting()
            return
        }

        if (!speechRecognizer.hasRecordAudioPermission()) {
            onPermissionRequired()
            return
        }

        hapticManager.reactorActivate(settings.value.hapticsEnabled)
        // Clear previous caption as the new voice interaction begins
        _activeHomeCaption.value = ""
        _operationalState.value = OperationalState.LISTENING
        _statusText.value = "SPEAK NOW OR TYPE BELOW, SIR"

        speechRecognizer.startListening(
            onFinalResult = { spokenText ->
                processUserPrompt(spokenText, onNavigateToDialogue)
            },
            onError = { errMessage ->
                hapticManager.error(settings.value.hapticsEnabled)
                _operationalState.value = OperationalState.ERROR
                _statusText.value = errMessage
                viewModelScope.launch {
                    delay(3200)
                    if (_operationalState.value == OperationalState.ERROR) {
                        _operationalState.value = OperationalState.IDLE
                        _statusText.value = getGreeting()
                    }
                }
            }
        )
    }

    /**
     * Cancels any active microphone speech-recognition session immediately (e.g. when the user
     * focuses the typed-message composer on the Dialogue screen) so the microphone is never
     * active while typing.
     */
    fun cancelVoiceListening() {
        speechRecognizer.stopListening()
        if (_operationalState.value == OperationalState.LISTENING) {
            _operationalState.value = OperationalState.IDLE
            _statusText.value = getGreeting()
        }
    }

    /**
     * Dedicated Typed-Message Submission Pipeline:
     * Never activates the microphone or SpeechRecognizer. Immediately cancels any active
     * speech-recognition session, enters `OperationalState.PROCESSING`, dispatches the typed
     * message to the device-control / AI provider pipeline, and speaks the response via TTS.
     */
    fun submitTypedMessage(
        rawText: String,
        onCompleteNavigate: (() -> Unit)? = null
    ) {
        val decision = InputSubmissionRouter.routeTypedMessage(rawText, _operationalState.value) ?: return
        performTapHaptic()
        // Always ensure speech recognizer is cancelled before processing a typed message
        speechRecognizer.stopListening()
        if (ttsManager.isSpeaking.value) {
            ttsManager.stop()
        }
        processUserPrompt(decision.normalizedPrompt, onCompleteNavigate)
    }

    fun sendUserCommand(
        prompt: String,
        onCompleteNavigate: (() -> Unit)? = null
    ) {
        submitTypedMessage(prompt, onCompleteNavigate)
    }

    private fun processUserPrompt(
        prompt: String,
        onCompleteNavigate: (() -> Unit)? = null
    ) {
        val cleanPrompt = prompt.trim()
        if (cleanPrompt.isEmpty()) return
        lastUserPrompt = cleanPrompt

        viewModelScope.launch {
            speechRecognizer.stopListening()
            _activeHomeCaption.value = ""
            _operationalState.value = OperationalState.PROCESSING
            _statusText.value = "SYNTHESIZING TELEMETRY"

            messageDao.insertMessage(
                MessageEntity(role = "user", content = cleanPrompt)
            )
            refreshSuggestions()

            // 1. Check if the user is verbally confirming or cancelling a pending disruptive device action
            val pending = _pendingDeviceAction.value
            if (pending != null) {
                val lower = cleanPrompt.lowercase()
                if (lower in listOf("yes", "confirm", "proceed", "affirmative", "do it")) {
                    confirmPendingDeviceAction()
                    onCompleteNavigate?.invoke()
                    return@launch
                } else if (lower in listOf("no", "cancel", "abort", "stop", "nevermind")) {
                    cancelPendingDeviceAction()
                    onCompleteNavigate?.invoke()
                    return@launch
                }
            }

            // 2. Check Native Wear OS Voice-to-Action & Device Control Intent Parser
            val deviceIntent = VoiceActionParser.parse(cleanPrompt)
            if (deviceIntent.type != VoiceActionType.NONE) {
                if (deviceIntent.type == VoiceActionType.CLEAR_HISTORY) {
                    _pendingDeviceAction.value = deviceIntent
                    val confirmReply = "Purging conversation logs will erase all stored turns on this watch, sir. Please say CONFIRM or CANCEL."
                    messageDao.insertMessage(MessageEntity(role = "assistant", content = confirmReply))
                    _activeHomeCaption.value = confirmReply
                    onCompleteNavigate?.invoke()
                    speakIfEnabled(confirmReply)
                    return@launch
                }

                val actionResult = deviceControlManager.executeAction(deviceIntent, confirmed = false)
                if (actionResult.requiresConfirmation) {
                    _pendingDeviceAction.value = deviceIntent
                } else {
                    performConfirmHaptic()
                }
                actionResult.screenTorchEnabled?.let { _screenTorchActive.value = it }

                messageDao.insertMessage(
                    MessageEntity(role = "assistant", content = actionResult.spokenResponse)
                )
                _activeHomeCaption.value = actionResult.spokenResponse
                onCompleteNavigate?.invoke()
                speakIfEnabled(actionResult.spokenResponse)
                return@launch
            }

            // 3. Otherwise dispatch to configured AI Provider (Gemini, OpenAI, or Custom)
            val cfg = settings.value
            val activeModel = cfg.activeModelForProvider(cfg.providerId)
            val apiKey = credentialVault.getApiKey(cfg.providerId)
            val baseUrl = if (cfg.providerId == "custom") {
                cfg.customBaseUrl.ifBlank { credentialVault.getBaseUrl("custom") }
            } else {
                credentialVault.getBaseUrl(cfg.providerId)
            }

            val requestConfig = AiRequestConfig(
                providerId = cfg.providerId,
                apiKey = apiKey,
                modelName = activeModel,
                baseUrl = baseUrl,
                systemPrompt = PersonalityEngine.buildSystemPrompt(
                    personalityMode = cfg.personalityMode,
                    customAddition = cfg.customSystemPrompt
                )
            )

            val validation = AiPayloadCodec.validateProviderConfig(requestConfig)
            if (validation.isFailure) {
                hapticManager.error(cfg.hapticsEnabled)
                _operationalState.value = OperationalState.ERROR
                val errText = validation.exceptionOrNull()?.message
                    ?: "Configuration incomplete for ${cfg.providerId.uppercase()}."
                val fullErr = "$errText Open System Matrix → AI LINK to configure, sir."
                _statusText.value = "CONFIGURE AI LINK"
                _activeHomeCaption.value = fullErr
                messageDao.insertMessage(
                    MessageEntity(
                        role = "assistant",
                        content = fullErr
                    )
                )
                onCompleteNavigate?.invoke()
                return@launch
            }

            val contextHistory = ConversationMemoryHelper.buildContextWindow(
                messages = messages.value,
                memoryEnabled = cfg.memoryEnabled
            )

            val provider = aiRepository.getProvider(cfg.providerId)
            val result = provider.sendMessage(cleanPrompt, contextHistory, requestConfig)

            result.fold(
                onSuccess = { replyText ->
                    messageDao.insertMessage(
                        MessageEntity(role = "assistant", content = replyText)
                    )
                    _activeHomeCaption.value = replyText
                    onCompleteNavigate?.invoke()
                    speakIfEnabled(replyText)
                },
                onFailure = { error ->
                    hapticManager.error(cfg.hapticsEnabled)
                    _operationalState.value = OperationalState.ERROR
                    val errSummary = error.message ?: "AI provider communication error."
                    val faultMsg = "I encountered an uplink fault, sir: $errSummary"
                    _statusText.value = errSummary.take(48)
                    _activeHomeCaption.value = faultMsg
                    messageDao.insertMessage(
                        MessageEntity(
                            role = "assistant",
                            content = faultMsg
                        )
                    )
                    onCompleteNavigate?.invoke()
                }
            )
        }
    }

    private fun speakIfEnabled(text: String) {
        val cfg = settings.value
        val apiKey = credentialVault.getApiKey(cfg.providerId)
        if (cfg.ttsEnabled) {
            ttsManager.speak(
                text = text,
                speechRate = cfg.speechRate,
                pitch = cfg.voicePitch,
                accent = cfg.voiceAccent,
                preferredVoiceName = cfg.preferredVoiceName,
                neuralCloudTtsEnabled = cfg.neuralCloudTtsEnabled,
                providerId = cfg.providerId,
                apiKey = apiKey
            )
        } else {
            _operationalState.value = OperationalState.IDLE
            _statusText.value = getGreeting()
        }
    }

    fun retryLastCommand() {
        if (lastUserPrompt.isNotBlank()) {
            sendUserCommand(lastUserPrompt)
        }
    }

    fun replayAssistantSpeech(text: String) {
        performTapHaptic()
        _activeHomeCaption.value = text
        val cfg = settings.value
        val apiKey = credentialVault.getApiKey(cfg.providerId)
        ttsManager.speak(
            text = text,
            speechRate = cfg.speechRate,
            pitch = cfg.voicePitch,
            accent = cfg.voiceAccent,
            preferredVoiceName = cfg.preferredVoiceName,
            neuralCloudTtsEnabled = cfg.neuralCloudTtsEnabled,
            providerId = cfg.providerId,
            apiKey = apiKey
        )
    }

    fun updateSettings(newSettings: JarvisSettingsState) {
        hapticManager.tap(newSettings.hapticsEnabled)
        settingsRepository.updateSettings(newSettings)
    }

    fun saveApiKeyForCurrentProvider(rawKey: String) {
        val cfg = settings.value
        val providerId = cfg.providerId
        if (rawKey.isNotBlank()) {
            credentialVault.saveApiKey(providerId, rawKey.trim())
        }
        if (providerId == "custom" && cfg.customBaseUrl.isNotBlank()) {
            credentialVault.saveBaseUrl("custom", cfg.customBaseUrl.trim())
        }
        hapticManager.confirm(cfg.hapticsEnabled)
        _maskedKeyPreview.value = credentialVault.getMaskedApiKey(providerId)
        _connectionTestStatus.value = "Saved ${providerId.uppercase()} config in Keystore."
        if (providerId == "gemini" && credentialVault.hasApiKey("gemini")) {
            discoverModelsForCurrentProvider(silent = true)
        }
    }

    fun clearCredentialsForCurrentProvider() {
        performTapHaptic()
        val providerId = settings.value.providerId
        credentialVault.clearCredentialsForProvider(providerId)
        if (providerId == "custom") {
            settingsRepository.updateSettings(
                settings.value.copy(customBaseUrl = "", customModel = "", modelName = "")
            )
        }
        _maskedKeyPreview.value = credentialVault.getMaskedApiKey(providerId)
        _connectionTestStatus.value = "Cleared ${providerId.uppercase()} credentials."
    }

    fun clearAllCredentials() {
        performConfirmHaptic()
        credentialVault.clearAllCredentials()
        _maskedKeyPreview.value = "UNSET"
        _connectionTestStatus.value = "All Keystore credentials purged."
    }

    fun discoverModelsForCurrentProvider(silent: Boolean = false) {
        if (!silent) performTapHaptic()
        viewModelScope.launch {
            val cfg = settings.value
            val apiKey = credentialVault.getApiKey(cfg.providerId)
            val baseUrl = if (cfg.providerId == "custom") {
                cfg.customBaseUrl.ifBlank { credentialVault.getBaseUrl("custom") }
            } else {
                credentialVault.getBaseUrl(cfg.providerId)
            }
            _isDiscoveringModels.value = true
            if (!silent) {
                _connectionTestStatus.value = "Fetching ${cfg.providerId.uppercase()} models..."
            }
            val req = AiRequestConfig(
                providerId = cfg.providerId,
                apiKey = apiKey,
                modelName = cfg.activeModelForProvider(),
                baseUrl = baseUrl,
                systemPrompt = "You are JARVIS."
            )
            val res = aiRepository.getProvider(cfg.providerId).discoverModels(req)
            _isDiscoveringModels.value = false
            res.fold(
                onSuccess = { list ->
                    _discoveredModels.value = list
                    if (!silent) {
                        hapticManager.confirm(cfg.hapticsEnabled)
                        _connectionTestStatus.value = "Discovered ${list.size} supported models."
                    }
                    if (cfg.activeModelForProvider().isBlank() && list.isNotEmpty()) {
                        settingsRepository.updateSettings(
                            cfg.withUpdatedModelForActiveProvider(list.first().id)
                        )
                    }
                },
                onFailure = { err ->
                    if (!silent) {
                        hapticManager.error(cfg.hapticsEnabled)
                        _connectionTestStatus.value = err.message ?: "Model discovery failed."
                    }
                }
            )
        }
    }

    fun testProviderConnection() {
        performTapHaptic()
        viewModelScope.launch {
            val cfg = settings.value
            val apiKey = credentialVault.getApiKey(cfg.providerId)
            val baseUrl = if (cfg.providerId == "custom") {
                cfg.customBaseUrl.ifBlank { credentialVault.getBaseUrl("custom") }
            } else {
                credentialVault.getBaseUrl(cfg.providerId)
            }
            val req = AiRequestConfig(
                providerId = cfg.providerId,
                apiKey = apiKey,
                modelName = cfg.activeModelForProvider(),
                baseUrl = baseUrl,
                systemPrompt = "You are JARVIS."
            )
            val validation = AiPayloadCodec.validateProviderConfig(req)
            if (validation.isFailure) {
                hapticManager.error(cfg.hapticsEnabled)
                _connectionTestStatus.value = validation.exceptionOrNull()?.message ?: "Invalid configuration."
                return@launch
            }
            _connectionTestStatus.value = "Testing ${cfg.providerId.uppercase()} (${req.modelName})..."
            val res = aiRepository.getProvider(cfg.providerId).testConnection(req)
            _connectionTestStatus.value = res.fold(
                onSuccess = {
                    hapticManager.confirm(cfg.hapticsEnabled)
                    "Verified (${req.modelName}): $it"
                },
                onFailure = {
                    hapticManager.error(cfg.hapticsEnabled)
                    "Failed: ${it.message?.take(52)}"
                }
            )
        }
    }

    fun clearConversationHistory() {
        performConfirmHaptic()
        viewModelScope.launch {
            messageDao.clearAllMessages()
            _activeHomeCaption.value = ""
            suggestionEngine.resetDismissed()
            refreshSuggestions()
        }
    }

    fun resetSuggestions() {
        performTapHaptic()
        suggestionEngine.resetDismissed()
        refreshSuggestions()
    }

    fun dismissSuggestion(id: String) {
        performTapHaptic()
        suggestionEngine.dismissSuggestion(id)
        refreshSuggestions()
    }

    private fun refreshSuggestions() {
        viewModelScope.launch {
            val userPrompts = messageDao.getRecentMessages(12)
                .filter { it.role == "user" }
                .map { it.content }
            _suggestions.value = suggestionEngine.computeSuggestions(
                userPrompts = userPrompts,
                enabled = settings.value.suggestionsEnabled,
                maxCount = 2
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        speechRecognizer.stopListening()
        ttsManager.shutdown()
    }
}
