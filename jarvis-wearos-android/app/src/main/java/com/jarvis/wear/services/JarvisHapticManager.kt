package com.jarvis.wear.services

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

enum class JarvisHapticType {
    TAP,
    ROTARY_TICK,
    REACTOR_ACTIVATE,
    CONFIRM,
    ERROR
}

/**
 * Pure policy helper for J.A.R.V.I.S. Wear OS V5 Haptic Feedback.
 * Enforces user/system enablement and rate-limits rapid rotary bezel ticks
 * so physical/touch bezel scrolling feels crisp without continuous motor buzz.
 */
object HapticEventPolicy {
    private const val MIN_ROTARY_TICK_INTERVAL_MS = 38L

    fun shouldTriggerHaptic(
        enabled: Boolean,
        hasVibrator: Boolean,
        type: JarvisHapticType,
        nowMs: Long,
        lastRotaryTickMs: Long
    ): Boolean {
        if (!enabled || !hasVibrator) return false
        if (type == JarvisHapticType.ROTARY_TICK) {
            return (nowMs - lastRotaryTickMs) >= MIN_ROTARY_TICK_INTERVAL_MS
        }
        return true
    }

    fun resolvePredefinedEffectId(type: JarvisHapticType): Int {
        return when (type) {
            JarvisHapticType.TAP -> VibrationEffect.EFFECT_CLICK
            JarvisHapticType.ROTARY_TICK -> VibrationEffect.EFFECT_TICK
            JarvisHapticType.REACTOR_ACTIVATE -> VibrationEffect.EFFECT_DOUBLE_CLICK
            JarvisHapticType.CONFIRM -> VibrationEffect.EFFECT_CLICK
            JarvisHapticType.ERROR -> VibrationEffect.EFFECT_HEAVY_CLICK
        }
    }
}

/**
 * Subtle, battery-friendly Wear OS Haptic Feedback Controller for Samsung Galaxy Watch 4 (SM-R860, API 30+).
 */
class JarvisHapticManager(context: Context) {

    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        manager?.defaultVibrator
    } else {
        context.getSystemService(Vibrator::class.java)
    }

    private var lastRotaryTickTimestampMs: Long = 0L

    fun perform(type: JarvisHapticType, enabled: Boolean = true) {
        val vib = vibrator ?: return
        val now = System.currentTimeMillis()
        val hasHardware = runCatching { vib.hasVibrator() }.getOrDefault(false)
        if (!HapticEventPolicy.shouldTriggerHaptic(
                enabled = enabled,
                hasVibrator = hasHardware,
                type = type,
                nowMs = now,
                lastRotaryTickMs = lastRotaryTickTimestampMs
            )
        ) {
            return
        }

        if (type == JarvisHapticType.ROTARY_TICK) {
            lastRotaryTickTimestampMs = now
        }

        runCatching {
            val effectId = HapticEventPolicy.resolvePredefinedEffectId(type)
            vib.vibrate(VibrationEffect.createPredefined(effectId))
        }
    }

    fun tap(enabled: Boolean = true) = perform(JarvisHapticType.TAP, enabled)
    fun rotaryTick(enabled: Boolean = true) = perform(JarvisHapticType.ROTARY_TICK, enabled)
    fun reactorActivate(enabled: Boolean = true) = perform(JarvisHapticType.REACTOR_ACTIVATE, enabled)
    fun confirm(enabled: Boolean = true) = perform(JarvisHapticType.CONFIRM, enabled)
    fun error(enabled: Boolean = true) = perform(JarvisHapticType.ERROR, enabled)
}
