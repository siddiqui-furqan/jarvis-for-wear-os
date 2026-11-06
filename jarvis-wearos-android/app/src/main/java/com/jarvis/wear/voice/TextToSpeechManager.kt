package com.jarvis.wear.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit

data class WatchVoiceProfile(
    val name: String,
    val localeTag: String,
    val displayLabel: String,
    val isMale: Boolean,
    val isFemale: Boolean,
    val isLocal: Boolean
)

data class SelectedVoiceResolution(
    val profile: WatchVoiceProfile?,
    val score: Int,
    val isConfirmedMale: Boolean,
    val recommendedPitchMultiplier: Float
)

/**
 * Pure, unit-testable voice scoring engine that prioritizes British English (en-GB)
 * Male voices on Samsung Galaxy Watch 4 (Google Speech Services & Samsung SMT TTS)
 * and penalizes default female voices (`fis`, `gba`, `gbc`, `smtl02`, etc.).
 */
object JarvisVoiceSelector {

    private val MALE_TOKENS = listOf(
        "en-gb-x-rjs",
        "en-gb-x-gbd",
        "en-gb-x-gbb",
        "en-gb-x-omb",
        "en-us-x-iom",
        "en-us-x-tpd",
        "uk english male",
        "british english male",
        "daniel",
        "arthur",
        "oliver",
        "george",
        "ryan",
        "thomas",
        "james",
        "smtl01",
        "smtl03",
        "_male",
        "-male",
        " male"
    )

    private val FEMALE_TOKENS = listOf(
        "en-gb-x-fis",
        "en-gb-x-gba",
        "en-gb-x-gbc",
        "en-gb-x-gbg",
        "en-gb-x-sfg",
        "en-us-x-sfg",
        "en-us-x-tpf",
        "uk english female",
        "hazel",
        "libby",
        "sonia",
        "susan",
        "kate",
        "serena",
        "fiona",
        "smtl02",
        "smtl04",
        "female"
    )

    fun classifyVoice(
        name: String,
        localeTag: String,
        features: Set<String> = emptySet(),
        isLocal: Boolean = true
    ): WatchVoiceProfile {
        val combined = "$name ${features.joinToString(" ")}".lowercase(Locale.ROOT)
        val isFemale = FEMALE_TOKENS.any { combined.contains(it) }
        val isMale = !isFemale && MALE_TOKENS.any { combined.contains(it) }

        val cleanShort = name
            .replace("en-gb-x-", "UK-", ignoreCase = true)
            .replace("en-us-x-", "US-", ignoreCase = true)
            .replace("-local", "", ignoreCase = true)
            .replace("-network", " (Net)", ignoreCase = true)

        val genderTag = when {
            isMale -> "Male"
            isFemale -> "Female"
            else -> "Std"
        }
        val regionTag = if (localeTag.lowercase(Locale.ROOT).contains("gb")) "UK" else "EN"

        return WatchVoiceProfile(
            name = name,
            localeTag = localeTag,
            displayLabel = "$cleanShort · $regionTag $genderTag",
            isMale = isMale,
            isFemale = isFemale,
            isLocal = isLocal
        )
    }

    fun scoreVoice(
        profile: WatchVoiceProfile,
        targetAccent: String = "en-GB",
        preferredVoiceName: String = ""
    ): Int {
        if (preferredVoiceName.isNotBlank() && profile.name.equals(preferredVoiceName, ignoreCase = true)) {
            return 1000
        }

        val lang = profile.localeTag.lowercase(Locale.ROOT).replace("_", "-")
        val nameLower = profile.name.lowercase(Locale.ROOT)
        var score = 0

        if (targetAccent.equals("en-US", ignoreCase = true)) {
            score += when {
                lang.startsWith("en-us") -> 65
                lang.startsWith("en-gb") -> 40
                lang.startsWith("en") -> 20
                else -> -120
            }
        } else {
            // Default British English (en-GB) for JARVIS
            score += when {
                lang.startsWith("en-gb") || lang.startsWith("en-uk") -> 80
                lang.startsWith("en-au") || lang.startsWith("en-ie") -> 45
                lang.startsWith("en-us") -> 25
                lang.startsWith("en") -> 15
                else -> -120
            }
        }

        if (profile.isMale) score += 95
        if (profile.isFemale) score -= 90

        if (nameLower.contains("rjs") || nameLower.contains("gbd") || nameLower.contains("daniel")) {
            score += 35
        }
        if (profile.isLocal) {
            score += 6
        }

        return score
    }

    fun selectBestVoice(
        profiles: List<WatchVoiceProfile>,
        targetAccent: String = "en-GB",
        preferredVoiceName: String = ""
    ): SelectedVoiceResolution {
        if (profiles.isEmpty()) {
            return SelectedVoiceResolution(
                profile = null,
                score = 0,
                isConfirmedMale = false,
                recommendedPitchMultiplier = 0.88f
            )
        }

        var bestProfile: WatchVoiceProfile? = null
        var bestScore = Int.MIN_VALUE

        for (p in profiles) {
            val s = scoreVoice(p, targetAccent, preferredVoiceName)
            if (s > bestScore) {
                bestScore = s
                bestProfile = p
            }
        }

        val confirmedMale = bestProfile?.isMale == true
        val pitchMultiplier = when {
            confirmedMale -> 1.0f
            bestProfile?.isFemale == true -> 0.84f
            else -> 0.90f
        }

        return SelectedVoiceResolution(
            profile = bestProfile,
            score = bestScore,
            isConfirmedMale = confirmedMale,
            recommendedPitchMultiplier = pitchMultiplier
        )
    }
}

/**
 * Native Wear OS TextToSpeech & Neural Cloud Voice Manager for Samsung Galaxy Watch 4 (SM-R860).
 * Solves the Galaxy Watch 4 default female voice issue by:
 * 1. Binding preferentially to Google Speech Services (`com.google.android.tts`) with fallback to Samsung TTS.
 * 2. Enumerating all installed voices and scoring British English Male voices (`rjs`, `gbd`, `gbb`) above female voices (`fis`, `gba`).
 * 3. Applying automatic lower-resonance pitch tuning (`0.84f–0.90f`) if the watch only has a neutral/female offline voice installed.
 * 4. Supporting optional Neural Cloud TTS (OpenAI `onyx` British-inflected male voice) when an API key is configured.
 */
class TextToSpeechManager(context: Context) {

    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private var mediaPlayer: MediaPlayer? = null
    private var triedFallbackEngine = false

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(18, TimeUnit.SECONDS)
        .build()

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _availableVoices = MutableStateFlow<List<WatchVoiceProfile>>(emptyList())
    val availableVoices: StateFlow<List<WatchVoiceProfile>> = _availableVoices.asStateFlow()

    private val _activeVoiceSummary = MutableStateFlow("Calibrating UK Male Synthesizer...")
    val activeVoiceSummary: StateFlow<String> = _activeVoiceSummary.asStateFlow()

    private var currentAccent: String = "en-GB"
    private var currentPreferredVoiceName: String = ""
    private var currentSpeechRate: Float = 1.0f
    private var currentPitch: Float = 1.0f
    private var currentPitchMultiplier: Float = 0.90f

    init {
        initEngine(preferGoogleEngine = true)
    }

    private fun initEngine(preferGoogleEngine: Boolean) {
        val listener = TextToSpeech.OnInitListener { status ->
            if (status == TextToSpeech.SUCCESS) {
                isInitialized = true
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        _isSpeaking.value = true
                    }

                    override fun onDone(utteranceId: String?) {
                        _isSpeaking.value = false
                    }

                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        _isSpeaking.value = false
                    }
                })
                refreshAndApplyVoices()
            } else if (preferGoogleEngine && !triedFallbackEngine) {
                triedFallbackEngine = true
                initEngine(preferGoogleEngine = false)
            } else {
                _activeVoiceSummary.value = "TTS Engine Unavailable"
            }
        }

        tts = if (preferGoogleEngine) {
            try {
                TextToSpeech(appContext, listener, "com.google.android.tts")
            } catch (_: Exception) {
                triedFallbackEngine = true
                TextToSpeech(appContext, listener)
            }
        } else {
            TextToSpeech(appContext, listener)
        }
    }

    fun refreshAndApplyVoices() {
        val engine = tts ?: return
        if (!isInitialized) return

        val rawVoices: Set<Voice> = try {
            engine.voices ?: emptySet()
        } catch (_: Exception) {
            emptySet()
        }

        val englishVoices = rawVoices
            .filter { it.locale?.language?.lowercase(Locale.ROOT) == "en" }
            .map { v ->
                val features = try {
                    v.features ?: emptySet()
                } catch (_: Exception) {
                    emptySet()
                }
                JarvisVoiceSelector.classifyVoice(
                    name = v.name,
                    localeTag = v.locale.toLanguageTag(),
                    features = features,
                    isLocal = !v.isNetworkConnectionRequired
                )
            }
            .sortedWith(
                compareByDescending<WatchVoiceProfile> {
                    JarvisVoiceSelector.scoreVoice(it, currentAccent, "")
                }.thenBy { it.displayLabel }
            )

        _availableVoices.value = englishVoices

        val resolution = JarvisVoiceSelector.selectBestVoice(
            profiles = englishVoices,
            targetAccent = currentAccent,
            preferredVoiceName = currentPreferredVoiceName
        )

        currentPitchMultiplier = resolution.recommendedPitchMultiplier

        val targetLocale = if (currentAccent.equals("en-US", ignoreCase = true)) {
            Locale.US
        } else {
            Locale.UK
        }
        engine.language = targetLocale

        val matchedRawVoice = rawVoices.firstOrNull { it.name == resolution.profile?.name }
        if (matchedRawVoice != null) {
            try {
                engine.voice = matchedRawVoice
                _activeVoiceSummary.value = resolution.profile?.displayLabel ?: matchedRawVoice.name
            } catch (_: Exception) {
                _activeVoiceSummary.value = "${targetLocale.displayCountry} Default (Tuned)"
            }
        } else {
            _activeVoiceSummary.value = "${targetLocale.displayCountry} Male-Tuned (${String.format(Locale.US, "%.2fx", currentPitch * currentPitchMultiplier)} pitch)"
        }

        val effectivePitch = (currentPitch * currentPitchMultiplier).coerceIn(0.65f, 1.35f)
        engine.setSpeechRate(currentSpeechRate.coerceIn(0.75f, 1.4f))
        engine.setPitch(effectivePitch)
    }

    /**
     * Immediately updates and applies the user's voice configuration on the watch.
     */
    fun applyVoiceSettings(
        accent: String,
        preferredVoiceName: String,
        speechRate: Float,
        pitch: Float
    ) {
        currentAccent = accent
        currentPreferredVoiceName = preferredVoiceName
        currentSpeechRate = speechRate
        currentPitch = pitch
        refreshAndApplyVoices()
    }

    /**
     * Speaks a test phrase immediately so the user can verify the selected voice on the watch.
     */
    fun previewVoice(
        accent: String,
        preferredVoiceName: String,
        speechRate: Float,
        pitch: Float
    ) {
        applyVoiceSettings(accent, preferredVoiceName, speechRate, pitch)
        speak(
            text = "Voice calibration complete, sir. All vocal telemetry parameters are nominal.",
            speechRate = speechRate,
            pitch = pitch,
            accent = accent,
            preferredVoiceName = preferredVoiceName
        )
    }

    /**
     * Speaks the response using either Neural Cloud TTS (if OpenAI key is configured and neural TTS is enabled)
     * or the calibrated British Male on-watch TextToSpeech engine.
     */
    fun speak(
        text: String,
        speechRate: Float = currentSpeechRate,
        pitch: Float = currentPitch,
        accent: String = currentAccent,
        preferredVoiceName: String = currentPreferredVoiceName,
        neuralCloudTtsEnabled: Boolean = false,
        providerId: String = "",
        apiKey: String = ""
    ) {
        val cleanText = text.trim()
        if (cleanText.isEmpty()) return

        stop()
        applyVoiceSettings(accent, preferredVoiceName, speechRate, pitch)

        if (neuralCloudTtsEnabled && providerId == "openai" && apiKey.isNotBlank()) {
            scope.launch {
                val playedCloud = synthesizeOpenAiNeuralMaleSpeech(cleanText, speechRate, apiKey)
                if (!playedCloud) {
                    speakLocal(cleanText)
                }
            }
            return
        }

        speakLocal(cleanText)
    }

    private fun speakLocal(cleanText: String) {
        val engine = tts ?: return
        if (!isInitialized) return

        val effectivePitch = (currentPitch * currentPitchMultiplier).coerceIn(0.65f, 1.35f)
        engine.setSpeechRate(currentSpeechRate.coerceIn(0.75f, 1.4f))
        engine.setPitch(effectivePitch)
        engine.speak(
            cleanText,
            TextToSpeech.QUEUE_FLUSH,
            null,
            UUID.randomUUID().toString()
        )
    }

    private suspend fun synthesizeOpenAiNeuralMaleSpeech(
        text: String,
        speechRate: Float,
        apiKey: String
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("model", "tts-1")
                put("input", text.take(600))
                put("voice", "onyx") // Deep authoritative male voice
                put("speed", speechRate.coerceIn(0.8f, 1.3f))
            }
            val request = Request.Builder()
                .url("https://api.openai.com/v1/audio/speech")
                .addHeader("Authorization", "Bearer ${apiKey.trim()}")
                .addHeader("Content-Type", "application/json")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext false
                val bytes = response.body?.bytes() ?: return@withContext false
                if (bytes.size < 256) return@withContext false

                val tempFile = File(appContext.cacheDir, "jarvis_tts_reply.mp3")
                FileOutputStream(tempFile).use { it.write(bytes) }

                withContext(Dispatchers.Main) {
                    playAudioFile(tempFile)
                }
                true
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun playAudioFile(file: File) {
        try {
            mediaPlayer?.release()
            val mp = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                setDataSource(file.absolutePath)
                setOnPreparedListener {
                    _isSpeaking.value = true
                    it.start()
                }
                setOnCompletionListener {
                    _isSpeaking.value = false
                    it.release()
                }
                setOnErrorListener { player, _, _ ->
                    _isSpeaking.value = false
                    player.release()
                    true
                }
                prepareAsync()
            }
            mediaPlayer = mp
        } catch (_: Exception) {
            _isSpeaking.value = false
        }
    }

    fun stop() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (_: Exception) {
        }
        mediaPlayer = null

        tts?.stop()
        _isSpeaking.value = false
    }

    fun shutdown() {
        stop()
        tts?.shutdown()
        tts = null
        scope.cancel()
    }
}
