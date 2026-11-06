package com.jarvis.wear

import android.Manifest
import android.os.Bundle
import android.view.InputDevice
import android.view.MotionEvent
import android.view.ViewConfiguration
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.core.view.ViewConfigurationCompat
import androidx.wear.ambient.AmbientLifecycleObserver
import com.jarvis.wear.navigation.JarvisWearNavHost
import com.jarvis.wear.presentation.JarvisViewModel
import com.jarvis.wear.ui.theme.JarvisWearTheme
import com.jarvis.wear.ui.theme.ObsidianBlack
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlin.math.abs
import kotlin.math.roundToInt

data class RotaryScrollEvent(
    val deltaPx: Float,
    val clockwise: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Pure rotary calculation helper matching the scrollable container logic defined in App.tsx (`±48px` per detent).
 */
object RotaryBezelDispatcher {
    fun computeScrollDelta(
        axisScrollValue: Float,
        verticalScrollFactor: Float = 48f
    ): RotaryScrollEvent? {
        if (abs(axisScrollValue) < 1e-4f) return null
        val deltaPx = -axisScrollValue * verticalScrollFactor
        val rounded = (deltaPx * 100f).roundToInt() / 100f
        return RotaryScrollEvent(
            deltaPx = rounded,
            clockwise = rounded > 0f
        )
    }
}

/**
 * Base WearableActivity providing a custom `onRotaryEvent` handler for the
 * Samsung Galaxy Watch 4 (SM-R860) physical/touch rotating bezel.
 */
open class WearableActivity : ComponentActivity() {

    private val _rotaryEvents = MutableSharedFlow<RotaryScrollEvent>(extraBufferCapacity = 32)
    val rotaryEvents: SharedFlow<RotaryScrollEvent> = _rotaryEvents.asSharedFlow()

    /**
     * Custom rotary bezel callback invoked whenever the Galaxy Watch 4 bezel is rotated.
     * Follows the scrollable container logic defined in App.tsx (`deltaPx > 0` scrolls down, `deltaPx < 0` scrolls up).
     */
    protected open fun onRotaryEvent(event: RotaryScrollEvent): Boolean {
        return _rotaryEvents.tryEmit(event)
    }

    override fun onGenericMotionEvent(event: MotionEvent?): Boolean {
        if (event != null &&
            event.action == MotionEvent.ACTION_SCROLL &&
            event.isFromSource(InputDevice.SOURCE_ROTARY_ENCODER)
        ) {
            val axisValue = event.getAxisValue(MotionEvent.AXIS_SCROLL)
            val scrollFactor = ViewConfigurationCompat.getScaledVerticalScrollFactor(
                ViewConfiguration.get(this),
                this
            ).coerceAtLeast(48f)

            val rotaryPayload = RotaryBezelDispatcher.computeScrollDelta(
                axisScrollValue = axisValue,
                verticalScrollFactor = scrollFactor
            )
            if (rotaryPayload != null && onRotaryEvent(rotaryPayload)) {
                return true
            }
        }
        return super.onGenericMotionEvent(event)
    }
}

/**
 * Standalone Native Wear OS Entry Activity for Samsung Galaxy Watch 4 (SM-R860).
 * Integrates Wear OS AmbientLifecycleObserver (AOD), runtime microphone permission handling,
 * and the custom `onRotaryEvent` bezel scroll dispatcher.
 */
class MainActivity : WearableActivity() {

    private val viewModel: JarvisViewModel by viewModels()
    private val isSystemAmbient = mutableStateOf(false)

    private val ambientCallback = object : AmbientLifecycleObserver.AmbientLifecycleCallback {
        override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) {
            isSystemAmbient.value = true
        }

        override fun onExitAmbient() {
            isSystemAmbient.value = false
        }

        override fun onUpdateAmbient() {
            // Static wireframe redraw during low-power AOD
        }
    }

    private lateinit var ambientObserver: AmbientLifecycleObserver

    private val micPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            viewModel.toggleVoiceInteraction(onPermissionRequired = {})
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        ambientObserver = AmbientLifecycleObserver(this, ambientCallback)
        lifecycle.addObserver(ambientObserver)

        setContent {
            JarvisWearTheme {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(ObsidianBlack)
                ) {
                    JarvisWearNavHost(
                        viewModel = viewModel,
                        isSystemAmbient = isSystemAmbient.value,
                        rotaryEvents = rotaryEvents,
                        onRequestMicPermission = {
                            micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    )
                }
            }
        }
    }
}
