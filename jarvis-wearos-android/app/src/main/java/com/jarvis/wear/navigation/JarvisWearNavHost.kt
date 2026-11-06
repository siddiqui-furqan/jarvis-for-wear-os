package com.jarvis.wear.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Text
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.jarvis.wear.RotaryScrollEvent
import com.jarvis.wear.presentation.JarvisViewModel
import com.jarvis.wear.ui.dialogue.DialogueScreen
import com.jarvis.wear.ui.home.HomeScreen
import com.jarvis.wear.ui.settings.SystemMatrixScreen
import com.jarvis.wear.ui.theme.ObsidianBlack
import com.jarvis.wear.ui.theme.ReactorTheme
import kotlinx.coroutines.flow.SharedFlow

/**
 * Wear OS SwipeDismissableNavHost managing circular transitions between:
 * - "home" (V5 Primary Arc Reactor Assistant Interface, Optional Captions & Orbital Dock)
 * - "dialogue" (Holographic Dialogue Stream — only entered when user explicitly taps the Dialogue button)
 * - "system_matrix" (6-Node Radial System Matrix Hub & Subsections)
 * Plus a full-luminance AMOLED Screen Torch overlay for Samsung Galaxy Watch 4 (SM-R860).
 */
@Composable
fun JarvisWearNavHost(
    viewModel: JarvisViewModel,
    isSystemAmbient: Boolean,
    rotaryEvents: SharedFlow<RotaryScrollEvent>,
    onRequestMicPermission: () -> Unit
) {
    val navController = rememberSwipeDismissableNavController()

    val settings by viewModel.settings.collectAsState()
    val state by viewModel.operationalState.collectAsState()
    val messages by viewModel.messages.collectAsState()
    val statusText by viewModel.statusText.collectAsState()
    val activeHomeCaption by viewModel.activeHomeCaption.collectAsState()
    val liveTranscript by viewModel.speechRecognizer.partialTranscript.collectAsState()
    val isSpeaking by viewModel.ttsManager.isSpeaking.collectAsState()
    val availableVoices by viewModel.availableVoices.collectAsState()
    val activeVoiceSummary by viewModel.activeVoiceSummary.collectAsState()
    val discoveredModels by viewModel.discoveredModels.collectAsState()
    val isDiscoveringModels by viewModel.isDiscoveringModels.collectAsState()
    val pendingDeviceAction by viewModel.pendingDeviceAction.collectAsState()
    val screenTorchActive by viewModel.screenTorchActive.collectAsState()
    val suggestions by viewModel.suggestions.collectAsState()
    val maskedKey by viewModel.maskedKeyPreview.collectAsState()
    val connectionStatus by viewModel.connectionTestStatus.collectAsState()

    val effectiveAmbient = isSystemAmbient || settings.aodPreviewEnabled

    Box(modifier = Modifier.fillMaxSize()) {
        SwipeDismissableNavHost(
            navController = navController,
            startDestination = "home"
        ) {
            composable("home") {
                HomeScreen(
                    state = state,
                    reactorTheme = ReactorTheme.fromId(settings.reactorThemeId),
                    aodTheme = settings.aodTheme,
                    greeting = viewModel.getGreeting(),
                    timeString = viewModel.getFormattedTime(),
                    batteryPercent = viewModel.getBatteryPercentage(),
                    statusText = statusText,
                    liveTranscript = liveTranscript,
                    activeCaption = activeHomeCaption,
                    homeCaptionsEnabled = settings.homeCaptionsEnabled,
                    suggestions = suggestions,
                    suggestionsEnabled = settings.suggestionsEnabled,
                    messageCount = messages.size,
                    isAmbient = effectiveAmbient,
                    onTapReactorOrVoice = {
                        // V5 Requirement 1: Stay on the Home screen throughout the entire voice interaction
                        viewModel.toggleVoiceInteraction(
                            onPermissionRequired = onRequestMicPermission,
                            onNavigateToDialogue = null
                        )
                    },
                    onStopSpeech = { viewModel.stopSpeaking() },
                    onSelectSuggestion = { command ->
                        // V5 Requirement 1: Execute suggestion on the Home screen without auto-navigating to Dialogue
                        viewModel.sendUserCommand(command, onCompleteNavigate = null)
                    },
                    onDismissSuggestion = { id -> viewModel.dismissSuggestion(id) },
                    onOpenDialogue = {
                        viewModel.performTapHaptic()
                        navController.navigate("dialogue")
                    },
                    onOpenSystemMatrix = {
                        viewModel.performTapHaptic()
                        navController.navigate("system_matrix")
                    }
                )
            }

            composable("dialogue") {
                DialogueScreen(
                    messages = messages,
                    state = state,
                    isSpeaking = isSpeaking,
                    liveTranscript = liveTranscript,
                    pendingConfirmationPrompt = pendingDeviceAction?.confirmationPrompt,
                    rotaryEvents = rotaryEvents,
                    onRotaryTick = { viewModel.performRotaryHaptic() },
                    onBack = {
                        viewModel.performTapHaptic()
                        navController.popBackStack()
                    },
                    onFollowUpVoice = {
                        viewModel.toggleVoiceInteraction(
                            onPermissionRequired = onRequestMicPermission
                        )
                    },
                    onCancelVoiceListening = {
                        viewModel.cancelVoiceListening()
                    },
                    onSubmitQuery = { query ->
                        viewModel.submitTypedMessage(query)
                    },
                    onConfirmDeviceAction = { viewModel.confirmPendingDeviceAction() },
                    onCancelDeviceAction = { viewModel.cancelPendingDeviceAction() },
                    onReplayAudio = { text -> viewModel.replayAssistantSpeech(text) },
                    onStopAudio = { viewModel.stopSpeaking() },
                    onClearHistory = { viewModel.clearConversationHistory() }
                )
            }

            composable("system_matrix") {
                SystemMatrixScreen(
                    settings = settings,
                    availableVoices = availableVoices,
                    activeVoiceSummary = activeVoiceSummary,
                    discoveredModels = discoveredModels,
                    isDiscoveringModels = isDiscoveringModels,
                    messageCount = messages.size,
                    maskedKeyPreview = maskedKey,
                    connectionTestStatus = connectionStatus,
                    rotaryEvents = rotaryEvents,
                    onRotaryTick = { viewModel.performRotaryHaptic() },
                    onConfirmHaptic = { viewModel.performConfirmHaptic() },
                    onSaveApiKey = { key -> viewModel.saveApiKeyForCurrentProvider(key) },
                    onClearProviderCredentials = { viewModel.clearCredentialsForCurrentProvider() },
                    onClearAllCredentials = { viewModel.clearAllCredentials() },
                    onDiscoverModels = { viewModel.discoverModelsForCurrentProvider() },
                    onTestConnection = { viewModel.testProviderConnection() },
                    onUpdateSettings = { updated -> viewModel.updateSettings(updated) },
                    onPreviewVoice = { viewModel.previewCurrentVoice() },
                    onClearConversationMemory = { viewModel.clearConversationHistory() },
                    onResetSuggestions = { viewModel.resetSuggestions() },
                    onCloseToHome = {
                        viewModel.performTapHaptic()
                        navController.popBackStack("home", inclusive = false)
                    }
                )
            }
        }

        // High-Luminance AMOLED Screen Torch Overlay for Galaxy Watch 4 (SM-R860)
        if (screenTorchActive) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.White)
                    .clickable(role = Role.Button) {
                        viewModel.setScreenTorch(false)
                    }
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "J.A.R.V.I.S. SCREEN TORCH",
                        color = ObsidianBlack,
                        fontSize = 8.5.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(ObsidianBlack)
                            .clickable(role = Role.Button) {
                                viewModel.setScreenTorch(false)
                            }
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = "TURN OFF TORCH",
                            color = Color.White,
                            fontSize = 8.5.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }
        }
    }
}
