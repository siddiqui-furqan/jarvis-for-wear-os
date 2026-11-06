package com.jarvis.wear.voice

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

/**
 * Native Android SpeechRecognizer controller for Samsung Galaxy Watch 4 (SM-R860).
 * Handles runtime RECORD_AUDIO permission checks, interim partial transcripts,
 * final speech recognition results, and descriptive Wear OS error reporting.
 */
class SpeechRecognitionManager(private val context: Context) {

    private var recognizer: SpeechRecognizer? = null
    private var activeSessionId: Long = 0L

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _partialTranscript = MutableStateFlow("")
    val partialTranscript: StateFlow<String> = _partialTranscript.asStateFlow()

    fun hasRecordAudioPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun startListening(
        onFinalResult: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        if (!hasRecordAudioPermission()) {
            onError("Microphone permission denied. Grant RECORD_AUDIO in Watch Settings.")
            return
        }

        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onError("Speech recognition service is unavailable on this Wear OS device.")
            return
        }

        stopListening()
        val sessionId = ++activeSessionId
        _partialTranscript.value = ""

        recognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    if (sessionId != activeSessionId) return
                    _isListening.value = true
                }

                override fun onBeginningOfSpeech() {
                    if (sessionId != activeSessionId) return
                    _isListening.value = true
                }

                override fun onRmsChanged(rmsdB: Float) {}

                override fun onBufferReceived(buffer: ByteArray?) {}

                override fun onEndOfSpeech() {
                    if (sessionId != activeSessionId) return
                    _isListening.value = false
                }

                override fun onError(error: Int) {
                    if (sessionId != activeSessionId) return
                    _isListening.value = false
                    val partialFallback = _partialTranscript.value.trim()
                    if (partialFallback.isNotEmpty()) {
                        _partialTranscript.value = ""
                        onFinalResult(partialFallback)
                        return
                    }
                    onError(mapSpeechError(error))
                }

                override fun onResults(results: Bundle?) {
                    if (sessionId != activeSessionId) return
                    _isListening.value = false
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val bestText = matches?.firstOrNull()?.trim().orEmpty()
                        .ifEmpty { _partialTranscript.value.trim() }
                    _partialTranscript.value = ""

                    if (bestText.isNotEmpty()) {
                        onFinalResult(bestText)
                    } else {
                        onError("No voice command detected, sir.")
                    }
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    if (sessionId != activeSessionId) return
                    val partial = partialResults
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                        ?.trim()
                        .orEmpty()
                    if (partial.isNotEmpty()) {
                        _partialTranscript.value = partial
                    }
                }

                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }

        recognizer?.startListening(intent)
    }

    /**
     * Immediately aborts any active speech-recognition session and invalidates its session token
     * so no delayed `onError` (e.g. `ERROR_NO_MATCH` / `"Speech not recognised"`) can fire after
     * the user submits a typed message or cancels listening.
     */
    fun stopListening() {
        activeSessionId++
        _isListening.value = false
        _partialTranscript.value = ""
        val current = recognizer
        recognizer = null
        runCatching {
            current?.cancel()
            current?.destroy()
        }
    }

    private fun mapSpeechError(errorCode: Int): String = when (errorCode) {
        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error on watch microphone."
        SpeechRecognizer.ERROR_CLIENT -> "Speech client interrupted."
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission required."
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
            "Network unreachable for speech recognition."
        SpeechRecognizer.ERROR_NO_MATCH -> "No recognizable speech pattern detected."
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Voice recognizer busy. Retrying."
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech heard before timeout."
        else -> "Voice recognition fault (Code $errorCode)."
    }
}
