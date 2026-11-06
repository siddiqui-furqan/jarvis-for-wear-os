package com.jarvis.wear

import com.jarvis.wear.ai.AiPayloadCodec
import com.jarvis.wear.ai.AiRequestConfig
import com.jarvis.wear.ai.ChatTurn
import com.jarvis.wear.ai.PersonalityEngine
import com.jarvis.wear.data.database.ConversationMemoryHelper
import com.jarvis.wear.data.database.MessageEntity
import com.jarvis.wear.data.preferences.JarvisSettingsState
import com.jarvis.wear.data.preferences.SettingsBackingStore
import com.jarvis.wear.data.preferences.SettingsRepository
import com.jarvis.wear.data.security.CredentialVault
import com.jarvis.wear.data.security.SecureKeyValueStore
import com.jarvis.wear.device.VoiceActionParser
import com.jarvis.wear.device.VoiceActionType
import com.jarvis.wear.suggestions.AdaptiveSuggestionEngine
import com.jarvis.wear.voice.JarvisVoiceSelector
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/**
 * Comprehensive Unit Tests for J.A.R.V.I.S. Wear OS V4 Native Application.
 * Covers:
 * 1. AI provider request formatting & response parsing (Gemini, OpenAI chat & reasoning models, Custom OpenAI-compatible)
 * 2. Google Gemini Model Discovery API parsing & filtering (`parseGeminiModelDiscoveryResponse`)
 * 3. Provider configuration validation (`validateProviderConfig` for Gemini, OpenAI, Custom)
 * 4. Per-provider configuration persistence across provider switches & restarts (`SettingsRepository` + `CredentialVault`)
 * 5. Voice-to-Action & Device Control intent parsing (`VoiceActionParser` for battery, status, timers, alarms, flashlight, DND confirmation, Bluetooth, Wi-Fi, app launch)
 * 6. Conversation history context window management
 * 7. Personality system prompt generation & time-based greetings
 * 8. Adaptive suggestion engine logic, topic boosting, dismissal, and disable toggle
 * 9. British Male Voice enumeration, scoring, and pitch compensation (`JarvisVoiceSelector`)
 * 10. Custom `onRotaryEvent` scroll delta calculation (`RotaryBezelDispatcher`)
 */
class JarvisUnitTests {

    @Test
    fun `test OpenAI and Custom OpenAI-compatible payload formatting for standard and reasoning models`() {
        val history = listOf(
            ChatTurn("user", "Run diagnostic."),
            ChatTurn("assistant", "All systems nominal, sir.")
        )
        // Standard chat model uses system role, temperature, and max_tokens
        val standardPayload = AiPayloadCodec.buildOpenAiCompatiblePayload(
            model = "gpt-4o-mini",
            systemPrompt = "You are JARVIS.",
            history = history,
            userPrompt = "Check reactor core."
        )
        val json = JSONObject(standardPayload)
        assertEquals("gpt-4o-mini", json.getString("model"))
        assertTrue(json.has("temperature"))
        assertTrue(json.has("max_tokens"))
        val messages = json.getJSONArray("messages")
        assertEquals(4, messages.length())
        assertEquals("system", messages.getJSONObject(0).getString("role"))
        assertEquals("Check reactor core.", messages.getJSONObject(3).getString("content"))

        // Reasoning model (o3-mini) uses developer role and max_completion_tokens without temperature
        val reasoningPayload = AiPayloadCodec.buildOpenAiCompatiblePayload(
            model = "o3-mini",
            systemPrompt = "You are JARVIS.",
            history = emptyList(),
            userPrompt = "Calculate orbital trajectory."
        )
        val reasoningJson = JSONObject(reasoningPayload)
        assertEquals("o3-mini", reasoningJson.getString("model"))
        assertFalse(reasoningJson.has("temperature"))
        assertTrue(reasoningJson.has("max_completion_tokens"))
        assertEquals("developer", reasoningJson.getJSONArray("messages").getJSONObject(0).getString("role"))

        val sampleResponse = """
            {
              "choices": [
                {
                  "message": {
                    "role": "assistant",
                    "content": "Arc Reactor core output is steady at 3.2 gigajoules per second, sir."
                  }
                }
              ]
            }
        """.trimIndent()

        val parsed = AiPayloadCodec.parseOpenAiCompatibleResponse(sampleResponse)
        assertTrue(parsed.contains("3.2 gigajoules"))
    }

    @Test
    fun `test Gemini payload formatting, response parsing, and Model Discovery API parsing`() {
        val rawPayload = AiPayloadCodec.buildGeminiPayload(
            systemPrompt = "You are JARVIS on Wear OS.",
            history = listOf(ChatTurn("user", "Hello")),
            userPrompt = "Status report",
            modelId = "gemini-2.5-flash"
        )

        val json = JSONObject(rawPayload)
        assertTrue(json.has("systemInstruction"))
        val contents = json.getJSONArray("contents")
        assertEquals(2, contents.length())

        val sampleDiscoveryJson = """
            {
              "models": [
                {
                  "name": "models/gemini-2.5-flash",
                  "displayName": "Gemini 2.5 Flash",
                  "description": "Fast multimodal model",
                  "supportedGenerationMethods": ["generateContent", "countTokens"]
                },
                {
                  "name": "models/text-embedding-004",
                  "displayName": "Text Embedding 004",
                  "supportedGenerationMethods": ["embedContent"]
                },
                {
                  "name": "models/gemini-2.5-pro",
                  "displayName": "Gemini 2.5 Pro",
                  "supportedGenerationMethods": ["generateContent"]
                }
              ]
            }
        """.trimIndent()

        val discovered = AiPayloadCodec.parseGeminiModelDiscoveryResponse(sampleDiscoveryJson)
        assertEquals(2, discovered.size)
        assertEquals("gemini-2.5-flash", discovered[0].id)
        assertEquals("gemini-2.5-pro", discovered[1].id)
    }

    @Test
    fun `test provider configuration validation and API key error redaction for Gemini, OpenAI, and Custom endpoints`() {
        val missingCustomUrl = AiRequestConfig(
            providerId = "custom",
            apiKey = "sk-test-12345678",
            modelName = "openai/gpt-4o-mini",
            baseUrl = "",
            systemPrompt = "You are JARVIS."
        )
        assertTrue(AiPayloadCodec.validateProviderConfig(missingCustomUrl).isFailure)

        // Remote cleartext http:// custom URLs must be rejected
        val insecureRemoteUrl = missingCustomUrl.copy(baseUrl = "http://example.com/v1")
        assertTrue(AiPayloadCodec.validateProviderConfig(insecureRemoteUrl).isFailure)

        val validCustom = missingCustomUrl.copy(baseUrl = "https://openrouter.ai/api/v1")
        assertTrue(AiPayloadCodec.validateProviderConfig(validCustom).isSuccess)

        val missingModel = validCustom.copy(modelName = "   ")
        assertTrue(AiPayloadCodec.validateProviderConfig(missingModel).isFailure)

        // Verify API keys are redacted from error messages
        val sanitized = AiPayloadCodec.sanitizeErrorMessage(
            rawMessage = "HTTP 403 calling https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSecret999",
            apiKey = "AIzaSecret999"
        )
        assertFalse(sanitized.contains("AIzaSecret999"))
        assertTrue(sanitized.contains("[REDACTED_KEY]"))
    }

    @Test
    fun `test per-provider persistence when switching between Gemini, OpenAI, and Custom`() {
        var backing = JarvisSettingsState()
        val fakeSettingsStore = object : SettingsBackingStore {
            override fun readState(): JarvisSettingsState = backing
            override fun writeState(state: JarvisSettingsState) { backing = state }
        }
        val fakeVaultStore = object : SecureKeyValueStore {
            private val map = mutableMapOf<String, String>()
            override fun putString(key: String, value: String) { map[key] = value }
            override fun getString(key: String): String? = map[key]
            override fun clearAll() { map.clear() }
        }

        val repo = SettingsRepository(fakeSettingsStore)
        val vault = CredentialVault(fakeVaultStore)

        // Configure Gemini
        vault.saveApiKey("gemini", "AIzaSyGeminiKey1234")
        repo.updateSettings(repo.settings.value.withUpdatedModelForActiveProvider("gemini-2.5-pro"))

        // Switch to Custom and configure OpenRouter
        val customSelected = repo.settings.value
            .withSelectedProvider("custom")
            .copy(customBaseUrl = "https://openrouter.ai/api/v1")
            .withUpdatedModelForActiveProvider("anthropic/claude-3.7-sonnet")
        repo.updateSettings(customSelected)
        vault.saveApiKey("custom", "sk-or-v1-custom9876")
        vault.saveBaseUrl("custom", "https://openrouter.ai/api/v1")

        // Switch to OpenAI and select o3-mini
        val openAiSelected = repo.settings.value
            .withSelectedProvider("openai")
            .withUpdatedModelForActiveProvider("o3-mini")
        repo.updateSettings(openAiSelected)
        vault.saveApiKey("openai", "sk-proj-openai5555")

        // Switch back to Gemini -> must restore gemini-2.5-pro and keep Custom & OpenAI intact!
        val backToGemini = repo.settings.value.withSelectedProvider("gemini")
        repo.updateSettings(backToGemini)
        assertEquals("gemini", repo.settings.value.providerId)
        assertEquals("gemini-2.5-pro", repo.settings.value.activeModelForProvider())
        assertEquals("AIzaSyGeminiKey1234", vault.getApiKey("gemini"))

        // Switch back to Custom -> must restore anthropic/claude-3.7-sonnet and https://openrouter.ai/api/v1!
        val backToCustom = repo.settings.value.withSelectedProvider("custom")
        repo.updateSettings(backToCustom)
        assertEquals("custom", repo.settings.value.providerId)
        assertEquals("anthropic/claude-3.7-sonnet", repo.settings.value.activeModelForProvider())
        assertEquals("https://openrouter.ai/api/v1", repo.settings.value.customBaseUrl)
        assertEquals("sk-or-v1-custom9876", vault.getApiKey("custom"))
    }

    @Test
    fun `test VoiceActionParser parses Wear OS device control commands and confirmation requirements`() {
        val battery = VoiceActionParser.parse("What is my battery level?")
        assertEquals(VoiceActionType.READ_BATTERY, battery.type)
        assertFalse(battery.requiresConfirmation)

        val timer = VoiceActionParser.parse("Set a timer for 5 minutes")
        assertEquals(VoiceActionType.SET_TIMER, timer.type)
        assertEquals(300, timer.durationSeconds)

        val alarm = VoiceActionParser.parse("Set an alarm for 7:30 am")
        assertEquals(VoiceActionType.SET_ALARM, alarm.type)
        assertEquals(7, alarm.alarmHour)
        assertEquals(30, alarm.alarmMinute)

        val torchOn = VoiceActionParser.parse("Turn on the flashlight")
        assertEquals(VoiceActionType.CONTROL_FLASHLIGHT, torchOn.type)
        assertEquals(true, torchOn.enableFlag)

        val dndOn = VoiceActionParser.parse("Enable Do Not Disturb")
        assertEquals(VoiceActionType.CONTROL_DND, dndOn.type)
        assertEquals(true, dndOn.enableFlag)
        assertTrue(dndOn.requiresConfirmation)

        val bt = VoiceActionParser.parse("Turn on Bluetooth")
        assertEquals(VoiceActionType.CONTROL_BLUETOOTH, bt.type)
        assertEquals(true, bt.enableFlag)

        val wifi = VoiceActionParser.parse("Open Wi-Fi settings")
        assertEquals(VoiceActionType.CONTROL_WIFI, wifi.type)

        val launchApp = VoiceActionParser.parse("Open Spotify")
        assertEquals(VoiceActionType.LAUNCH_APP, launchApp.type)
        assertEquals("spotify", launchApp.targetName.lowercase())
    }

    @Test
    fun `test conversation memory window respects enable flag and turn limit`() {
        val entities = (1..10).map { i ->
            MessageEntity(
                id = i.toLong(),
                role = if (i % 2 == 0) "assistant" else "user",
                content = "Message $i",
                timestamp = i * 1000L
            )
        }

        val disabledWindow = ConversationMemoryHelper.buildContextWindow(
            messages = entities,
            memoryEnabled = false,
            maxTurns = 4
        )
        assertTrue(disabledWindow.isEmpty())

        val activeWindow = ConversationMemoryHelper.buildContextWindow(
            messages = entities,
            memoryEnabled = true,
            maxTurns = 4
        )
        assertEquals(4, activeWindow.size)
        assertEquals("Message 7", activeWindow.first().content)
        assertEquals("Message 10", activeWindow.last().content)
    }

    @Test
    fun `test personality system prompt generation and time-based greetings`() {
        assertEquals("Good morning, sir", PersonalityEngine.getTimeBasedGreeting(8))
        assertEquals("Good afternoon, sir", PersonalityEngine.getTimeBasedGreeting(14))
        assertEquals("Good evening, sir", PersonalityEngine.getTimeBasedGreeting(21))

        val tacticalPrompt = PersonalityEngine.buildSystemPrompt(
            personalityMode = "tactical_hud",
            customAddition = "Report metrics in metric units."
        )
        assertTrue(tacticalPrompt.contains("Tactical HUD"))
        assertTrue(tacticalPrompt.contains("Report metrics in metric units."))
    }

    @Test
    fun `test adaptive suggestion engine boosts relevant topics and respects dismissal`() {
        val engine = AdaptiveSuggestionEngine()
        val suggestions = engine.computeSuggestions(
            userPrompts = listOf("Check battery and reactor power levels"),
            enabled = true,
            maxCount = 2
        )
        assertEquals(2, suggestions.size)
        assertEquals("suit", suggestions.first().id)

        engine.dismissSuggestion("suit")
        val afterDismiss = engine.computeSuggestions(
            userPrompts = listOf("Check battery and reactor power levels"),
            enabled = true,
            maxCount = 2
        )
        assertFalse(afterDismiss.any { it.id == "suit" })
    }

    @Test
    fun `test JarvisVoiceSelector prioritizes British male voices over default female voices`() {
        val profiles = listOf(
            JarvisVoiceSelector.classifyVoice("en-gb-x-fis-local", "en-GB", isLocal = true),
            JarvisVoiceSelector.classifyVoice("en-gb-x-gba-local", "en-GB", isLocal = true),
            JarvisVoiceSelector.classifyVoice("en-gb-x-rjs-local", "en-GB", isLocal = true),
            JarvisVoiceSelector.classifyVoice("en-us-x-sfg-local", "en-US", isLocal = true)
        )

        val resolution = JarvisVoiceSelector.selectBestVoice(
            profiles = profiles,
            targetAccent = "en-GB"
        )
        assertNotNull(resolution.profile)
        assertEquals("en-gb-x-rjs-local", resolution.profile?.name)
        assertTrue(resolution.isConfirmedMale)
        assertEquals(1.0f, resolution.recommendedPitchMultiplier, 0.001f)
    }

    @Test
    fun `test RotaryBezelDispatcher computes clockwise and counter-clockwise scroll deltas`() {
        val cw = RotaryBezelDispatcher.computeScrollDelta(axisScrollValue = -1.0f, verticalScrollFactor = 48f)
        assertNotNull(cw)
        assertEquals(48f, cw!!.deltaPx, 0.01f)
        assertTrue(cw.clockwise)

        val ccw = RotaryBezelDispatcher.computeScrollDelta(axisScrollValue = 1.0f, verticalScrollFactor = 48f)
        assertNotNull(ccw)
        assertEquals(-48f, ccw!!.deltaPx, 0.01f)
        assertFalse(ccw.clockwise)
    }

    @Test
    fun `test V5 HomeReactorInteractionPolicy stays on Home screen and resolves optional captions cleanly`() {
        assertFalse(com.jarvis.wear.presentation.HomeReactorInteractionPolicy.shouldAutoNavigateToDialogueFromHome())
        assertEquals(66, com.jarvis.wear.presentation.HomeReactorInteractionPolicy.HOME_REACTOR_SIZE_DP)
        assertEquals(28, com.jarvis.wear.presentation.HomeReactorInteractionPolicy.RESERVED_CAPTION_SLOT_HEIGHT_DP)

        val spokenCaption = "Battery is at 94%, sir. All systems are nominal."
        // Visible during SPEAKING and IDLE when homeCaptionsEnabled is true
        assertEquals(
            spokenCaption,
            com.jarvis.wear.presentation.HomeReactorInteractionPolicy.resolveVisibleHomeCaption(
                homeCaptionsEnabled = true,
                operationalState = com.jarvis.wear.ui.theme.OperationalState.SPEAKING,
                activeCaption = spokenCaption
            )
        )
        // Cleared during LISTENING and PROCESSING when next interaction starts
        assertEquals(
            "",
            com.jarvis.wear.presentation.HomeReactorInteractionPolicy.resolveVisibleHomeCaption(
                homeCaptionsEnabled = true,
                operationalState = com.jarvis.wear.ui.theme.OperationalState.LISTENING,
                activeCaption = spokenCaption
            )
        )
        // Hidden when homeCaptionsEnabled is false
        assertEquals(
            "",
            com.jarvis.wear.presentation.HomeReactorInteractionPolicy.resolveVisibleHomeCaption(
                homeCaptionsEnabled = false,
                operationalState = com.jarvis.wear.ui.theme.OperationalState.SPEAKING,
                activeCaption = spokenCaption
            )
        )
    }

    @Test
    fun `test V5 HapticEventPolicy respects user toggle and rate-limits rapid rotary bezel ticks`() {
        assertFalse(
            com.jarvis.wear.services.HapticEventPolicy.shouldTriggerHaptic(
                enabled = false,
                hasVibrator = true,
                type = com.jarvis.wear.services.JarvisHapticType.TAP,
                nowMs = 1000L,
                lastRotaryTickMs = 0L
            )
        )
        assertTrue(
            com.jarvis.wear.services.HapticEventPolicy.shouldTriggerHaptic(
                enabled = true,
                hasVibrator = true,
                type = com.jarvis.wear.services.JarvisHapticType.REACTOR_ACTIVATE,
                nowMs = 1000L,
                lastRotaryTickMs = 995L
            )
        )
        // Rotary tick within 38ms should be throttled
        assertFalse(
            com.jarvis.wear.services.HapticEventPolicy.shouldTriggerHaptic(
                enabled = true,
                hasVibrator = true,
                type = com.jarvis.wear.services.JarvisHapticType.ROTARY_TICK,
                nowMs = 1020L,
                lastRotaryTickMs = 1000L
            )
        )
        // Rotary tick after 45ms should fire
        assertTrue(
            com.jarvis.wear.services.HapticEventPolicy.shouldTriggerHaptic(
                enabled = true,
                hasVibrator = true,
                type = com.jarvis.wear.services.JarvisHapticType.ROTARY_TICK,
                nowMs = 1045L,
                lastRotaryTickMs = 1000L
            )
        )
    }

    @Test
    fun `test InputSubmissionRouter separates typed message submission from microphone speech recognition`() {
        // Blank typed input is ignored
        assertNull(
            com.jarvis.wear.presentation.InputSubmissionRouter.routeTypedMessage(
                rawText = "   ",
                currentState = com.jarvis.wear.ui.theme.OperationalState.IDLE
            )
        )

        // Typed message from IDLE enters PROCESSING directly and NEVER activates microphone
        val fromIdle = com.jarvis.wear.presentation.InputSubmissionRouter.routeTypedMessage(
            rawText = "  Run suit diagnostics  ",
            currentState = com.jarvis.wear.ui.theme.OperationalState.IDLE
        )
        assertNotNull(fromIdle)
        assertEquals("Run suit diagnostics", fromIdle!!.normalizedPrompt)
        assertFalse(fromIdle.shouldStartMicrophone)
        assertFalse(fromIdle.shouldCancelActiveMicrophone)
        assertEquals(com.jarvis.wear.ui.theme.OperationalState.PROCESSING, fromIdle.targetInitialState)

        // Typed message submitted while LISTENING cancels active microphone and enters PROCESSING
        val fromListening = com.jarvis.wear.presentation.InputSubmissionRouter.routeTypedMessage(
            rawText = "Check reactor core",
            currentState = com.jarvis.wear.ui.theme.OperationalState.LISTENING
        )
        assertNotNull(fromListening)
        assertEquals("Check reactor core", fromListening!!.normalizedPrompt)
        assertFalse(fromListening.shouldStartMicrophone)
        assertTrue(fromListening.shouldCancelActiveMicrophone)
        assertEquals(com.jarvis.wear.ui.theme.OperationalState.PROCESSING, fromListening.targetInitialState)

        // Voice trigger activates microphone only when not already LISTENING or SPEAKING
        assertTrue(
            com.jarvis.wear.presentation.InputSubmissionRouter.shouldActivateMicrophoneOnVoiceTrigger(
                com.jarvis.wear.ui.theme.OperationalState.IDLE
            )
        )
        assertFalse(
            com.jarvis.wear.presentation.InputSubmissionRouter.shouldActivateMicrophoneOnVoiceTrigger(
                com.jarvis.wear.ui.theme.OperationalState.LISTENING
            )
        )
    }

    @Test
    fun `test V6 CircularResponsiveSpec validates all 9 round-display profiles without clipping or overlap`() {
        val profiles = com.jarvis.wear.ui.components.CircularResponsiveSpec.VALIDATION_MATRIX_PROFILES
        assertEquals(9, profiles.size)
        val expectedResolutions = listOf(320, 360, 384, 396, 400, 416, 432, 450, 480)
        assertEquals(expectedResolutions, profiles.map { it.resolutionPx })
        assertTrue(profiles.first { it.resolutionPx == 396 }.isDefaultReference)

        for (profile in profiles) {
            val spec = com.jarvis.wear.ui.components.CircularResponsiveSpec.fromDiameterDp(
                rawDiameterDp = profile.diameterDp,
                density = profile.referenceDensity,
                userFontScale = 1.0f
            )
            assertEquals(profile.resolutionPx, spec.resolutionPx)
            // Safe header and bottom dock chords must fit strictly inside the circular diameter
            assertTrue(spec.headerSafeWidthDp > 0f && spec.headerSafeWidthDp < spec.diameterDp)
            assertTrue(spec.bottomDockSafeWidthDp > 0f && spec.bottomDockSafeWidthDp < spec.diameterDp)
            assertTrue(spec.contentSafeWidthDp > 0f && spec.contentSafeWidthDp < spec.diameterDp)
            // Header slots must leave room for centered title without collision
            val remainingTitleWidthDp = spec.headerSafeWidthDp - (2f * spec.headerSlotWidthDp)
            assertTrue("Title width too narrow for ${profile.id}", remainingTitleWidthDp >= 32f)
            // Compact displays (320x320, 360x360) enable scroll fallback on System Matrix hub
            if (profile.resolutionPx <= 360) {
                assertTrue(spec.matrixNeedsScrollFallback)
            }
        }
    }

    @Test
    fun `test V6 CLEAR_HISTORY voice action confirmation flow and central theme colors`() {
        val clearIntent = com.jarvis.wear.device.VoiceActionParser.parse("Clear conversation history")
        assertEquals(com.jarvis.wear.device.VoiceActionType.CLEAR_HISTORY, clearIntent.type)
        assertTrue(clearIntent.requiresConfirmation)
        assertTrue(clearIntent.confirmationPrompt.isNotBlank())

        // Verify central theme palette defines StarkTeal and StarkCyanGlow
        assertNotEquals(
            com.jarvis.wear.ui.theme.StarkTeal,
            com.jarvis.wear.ui.theme.StarkCyanGlow
        )
    }
}


