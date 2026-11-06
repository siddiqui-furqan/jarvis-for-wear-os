package com.jarvis.wear.data.preferences

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Persistent settings state for J.A.R.V.I.S. Wear OS V4.
 * Preserves per-provider model selections (`geminiModel`, `openaiModel`, `customModel`) and
 * `customBaseUrl` across app restarts and provider switches so changing providers never discards
 * previously saved configuration.
 */
data class JarvisSettingsState(
    val providerId: String = "gemini",
    val modelName: String = "gemini-2.5-flash",
    val geminiModel: String = "gemini-2.5-flash",
    val openaiModel: String = "gpt-4o-mini",
    val customModel: String = "",
    val customBaseUrl: String = "",
    val reactorThemeId: String = "mark2",
    val personalityMode: String = "stark_classic",
    val customSystemPrompt: String = "",
    val ttsEnabled: Boolean = true,
    val homeCaptionsEnabled: Boolean = true,
    val hapticsEnabled: Boolean = true,
    val voiceAccent: String = "en-GB",
    val preferredVoiceName: String = "",
    val neuralCloudTtsEnabled: Boolean = true,
    val speechRate: Float = 1.0f,
    val voicePitch: Float = 1.0f,
    val soundFxEnabled: Boolean = true,
    val memoryEnabled: Boolean = true,
    val suggestionsEnabled: Boolean = true,
    val aodPreviewEnabled: Boolean = false,
    val aodTheme: String = "minimal_reactor",
    val brightnessPercent: Int = 100,
    val accentIntensity: String = "standard",
    val animationIntensity: String = "full",
    val chassisThemeId: String = "black"
) {
    fun activeModelForProvider(pid: String = providerId): String {
        return when (pid.lowercase()) {
            "gemini" -> geminiModel.ifBlank { "gemini-2.5-flash" }
            "openai" -> openaiModel.ifBlank { "gpt-4o-mini" }
            "custom" -> customModel
            else -> modelName
        }
    }

    fun withSelectedProvider(newProviderId: String): JarvisSettingsState {
        val normalized = newProviderId.lowercase()
        val restoredModel = activeModelForProvider(normalized)
        return copy(
            providerId = normalized,
            modelName = restoredModel
        )
    }

    fun withUpdatedModelForActiveProvider(newModel: String): JarvisSettingsState {
        val clean = newModel.trim()
        return when (providerId.lowercase()) {
            "gemini" -> copy(modelName = clean, geminiModel = clean)
            "openai" -> copy(modelName = clean, openaiModel = clean)
            "custom" -> copy(modelName = clean, customModel = clean)
            else -> copy(modelName = clean)
        }
    }
}

interface SettingsBackingStore {
    fun readState(): JarvisSettingsState
    fun writeState(state: JarvisSettingsState)
}

class SettingsRepository(private val store: SettingsBackingStore) {

    constructor(context: Context) : this(SharedPrefsSettingsStore(context.applicationContext))

    private val _settings = MutableStateFlow(store.readState())
    val settings: StateFlow<JarvisSettingsState> = _settings.asStateFlow()

    fun updateSettings(newState: JarvisSettingsState) {
        store.writeState(newState)
        _settings.value = newState
    }
}

private class SharedPrefsSettingsStore(context: Context) : SettingsBackingStore {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("jarvis_wear_settings", Context.MODE_PRIVATE)

    override fun readState(): JarvisSettingsState {
        val rawProvider = prefs.getString("providerId", "gemini") ?: "gemini"
        // Migrate legacy "openrouter" provider ID from V3 to "custom" seamlessly
        val providerId = if (rawProvider == "openrouter") "custom" else rawProvider
        val geminiModel = prefs.getString("geminiModel", "gemini-2.5-flash") ?: "gemini-2.5-flash"
        val openaiModel = prefs.getString("openaiModel", "gpt-4o-mini") ?: "gpt-4o-mini"
        val customModel = prefs.getString("customModel", "") ?: ""
        val customBaseUrl = prefs.getString("customBaseUrl", "") ?: ""
        val fallbackModel = when (providerId) {
            "openai" -> openaiModel
            "custom" -> customModel
            else -> geminiModel
        }
        val activeModel = prefs.getString("modelName", fallbackModel) ?: fallbackModel

        return JarvisSettingsState(
            providerId = providerId,
            modelName = activeModel,
            geminiModel = geminiModel,
            openaiModel = openaiModel,
            customModel = customModel,
            customBaseUrl = customBaseUrl,
            reactorThemeId = prefs.getString("reactorThemeId", "mark2") ?: "mark2",
            personalityMode = prefs.getString("personalityMode", "stark_classic") ?: "stark_classic",
            customSystemPrompt = prefs.getString("customSystemPrompt", "") ?: "",
            ttsEnabled = prefs.getBoolean("ttsEnabled", true),
            homeCaptionsEnabled = prefs.getBoolean("homeCaptionsEnabled", true),
            hapticsEnabled = prefs.getBoolean("hapticsEnabled", true),
            voiceAccent = prefs.getString("voiceAccent", "en-GB") ?: "en-GB",
            preferredVoiceName = prefs.getString("preferredVoiceName", "") ?: "",
            neuralCloudTtsEnabled = prefs.getBoolean("neuralCloudTtsEnabled", true),
            speechRate = prefs.getFloat("speechRate", 1.0f),
            voicePitch = prefs.getFloat("voicePitch", 1.0f),
            soundFxEnabled = prefs.getBoolean("soundFxEnabled", true),
            memoryEnabled = prefs.getBoolean("memoryEnabled", true),
            suggestionsEnabled = prefs.getBoolean("suggestionsEnabled", true),
            aodPreviewEnabled = prefs.getBoolean("aodPreviewEnabled", false),
            aodTheme = prefs.getString("aodTheme", "minimal_reactor") ?: "minimal_reactor",
            brightnessPercent = prefs.getInt("brightnessPercent", 100),
            accentIntensity = prefs.getString("accentIntensity", "standard") ?: "standard",
            animationIntensity = prefs.getString("animationIntensity", "full") ?: "full",
            chassisThemeId = prefs.getString("chassisThemeId", "black") ?: "black"
        )
    }

    override fun writeState(state: JarvisSettingsState) {
        prefs.edit()
            .putString("providerId", state.providerId)
            .putString("modelName", state.modelName)
            .putString("geminiModel", state.geminiModel)
            .putString("openaiModel", state.openaiModel)
            .putString("customModel", state.customModel)
            .putString("customBaseUrl", state.customBaseUrl)
            .putString("reactorThemeId", state.reactorThemeId)
            .putString("personalityMode", state.personalityMode)
            .putString("customSystemPrompt", state.customSystemPrompt)
            .putBoolean("ttsEnabled", state.ttsEnabled)
            .putBoolean("homeCaptionsEnabled", state.homeCaptionsEnabled)
            .putBoolean("hapticsEnabled", state.hapticsEnabled)
            .putString("voiceAccent", state.voiceAccent)
            .putString("preferredVoiceName", state.preferredVoiceName)
            .putBoolean("neuralCloudTtsEnabled", state.neuralCloudTtsEnabled)
            .putFloat("speechRate", state.speechRate)
            .putFloat("voicePitch", state.voicePitch)
            .putBoolean("soundFxEnabled", state.soundFxEnabled)
            .putBoolean("memoryEnabled", state.memoryEnabled)
            .putBoolean("suggestionsEnabled", state.suggestionsEnabled)
            .putBoolean("aodPreviewEnabled", state.aodPreviewEnabled)
            .putString("aodTheme", state.aodTheme)
            .putInt("brightnessPercent", state.brightnessPercent)
            .putString("accentIntensity", state.accentIntensity)
            .putString("animationIntensity", state.animationIntensity)
            .putString("chassisThemeId", state.chassisThemeId)
            .apply()
    }
}
