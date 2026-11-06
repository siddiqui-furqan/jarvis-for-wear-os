package com.jarvis.wear.device

import android.app.NotificationManager
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.AlarmClock
import android.provider.Settings
import java.util.Locale

enum class VoiceActionType {
    READ_BATTERY,
    READ_DEVICE_STATUS,
    CONTROL_BLUETOOTH,
    CONTROL_WIFI,
    OPEN_SETTINGS_PANEL,
    SET_TIMER,
    SET_ALARM,
    CONTROL_FLASHLIGHT,
    CONTROL_DND,
    LAUNCH_APP,
    CLEAR_HISTORY,
    NONE
}

data class VoiceActionIntent(
    val type: VoiceActionType,
    val targetBoolean: Boolean? = null,
    val durationSeconds: Int? = null,
    val alarmHour: Int? = null,
    val alarmMinute: Int? = null,
    val targetName: String = "",
    val requiresConfirmation: Boolean = false,
    val confirmationPrompt: String = ""
) {
    val enableFlag: Boolean?
        get() = targetBoolean
}

data class DeviceActionResult(
    val handled: Boolean,
    val spokenResponse: String,
    val requiresConfirmation: Boolean = false,
    val pendingIntent: VoiceActionIntent? = null,
    val settingsHandoffAction: String? = null,
    val screenTorchEnabled: Boolean? = null
)

data class WatchBatteryStatus(
    val levelPercent: Int,
    val isCharging: Boolean,
    val powerSource: String,
    val temperatureCelsius: Float
)

/**
 * Pure, deterministic Voice-to-Action intent parser for JARVIS Wear OS V4.
 * Maps spoken or typed commands to a controlled action registry rather than executing arbitrary code.
 * Marks disruptive operations (`CONTROL_DND`, `CLEAR_HISTORY`) with `requiresConfirmation = true`.
 */
object VoiceActionParser {

    fun parse(rawInput: String): VoiceActionIntent {
        val text = rawInput.trim()
        val lower = text.lowercase(Locale.ROOT)
        if (lower.isEmpty()) return VoiceActionIntent(VoiceActionType.NONE)

        // 1. Battery level / charging status
        if (lower.contains("battery") ||
            lower.contains("charge level") ||
            lower.contains("power level") ||
            (lower.contains("charging") && (lower.contains("is my") || lower.contains("status")))
        ) {
            return VoiceActionIntent(type = VoiceActionType.READ_BATTERY)
        }

        // 2. Device status / diagnostics
        if (lower.contains("device status") ||
            lower.contains("watch status") ||
            lower.contains("system status") ||
            lower.contains("diagnostic") ||
            lower.contains("storage status") ||
            lower.contains("free space")
        ) {
            return VoiceActionIntent(type = VoiceActionType.READ_DEVICE_STATUS)
        }

        // 3. Flashlight / Torch
        if (lower.contains("flashlight") || lower.contains("torch")) {
            val turnOff = lower.contains("off") || lower.contains("disable") || lower.contains("deactivate")
            return VoiceActionIntent(
                type = VoiceActionType.CONTROL_FLASHLIGHT,
                targetBoolean = !turnOff
            )
        }

        // 4. Do Not Disturb (Disruptive -> requires confirmation when enabling)
        if (lower.contains("do not disturb") || lower.contains("dnd") || lower.contains("silent mode")) {
            val enable = !lower.contains("off") && !lower.contains("disable")
            return VoiceActionIntent(
                type = VoiceActionType.CONTROL_DND,
                targetBoolean = enable,
                requiresConfirmation = enable,
                confirmationPrompt = if (enable) {
                    "Confirm enabling Do Not Disturb mode on this watch, sir?"
                } else {
                    ""
                }
            )
        }

        // 5. Bluetooth control / settings
        if (lower.contains("bluetooth")) {
            val enable = when {
                lower.contains("off") || lower.contains("disable") -> false
                lower.contains("on") || lower.contains("enable") -> true
                else -> null
            }
            return VoiceActionIntent(
                type = VoiceActionType.CONTROL_BLUETOOTH,
                targetBoolean = enable
            )
        }

        // 6. Wi-Fi control / settings
        if (lower.contains("wi-fi") || lower.contains("wifi") || lower.contains("wireless network")) {
            val enable = when {
                lower.contains("off") || lower.contains("disable") -> false
                lower.contains("on") || lower.contains("enable") -> true
                else -> null
            }
            return VoiceActionIntent(
                type = VoiceActionType.CONTROL_WIFI,
                targetBoolean = enable
            )
        }

        // 7. Timers (e.g. "set a timer for 5 minutes", "timer for 45 seconds")
        if (lower.contains("timer")) {
            val seconds = extractDurationSeconds(lower)
            if (seconds != null && seconds > 0) {
                return VoiceActionIntent(
                    type = VoiceActionType.SET_TIMER,
                    durationSeconds = seconds,
                    targetName = "JARVIS Timer"
                )
            }
        }

        // 8. Alarms (e.g. "set an alarm for 7:30 am", "wake me up at 8:00")
        if (lower.contains("alarm") || lower.contains("wake me")) {
            val timePair = extractAlarmTime(lower)
            if (timePair != null) {
                return VoiceActionIntent(
                    type = VoiceActionType.SET_ALARM,
                    alarmHour = timePair.first,
                    alarmMinute = timePair.second,
                    targetName = "JARVIS Alarm"
                )
            }
        }

        // 9. Clear conversation history (Disruptive -> requires confirmation)
        if ((lower.contains("clear") || lower.contains("purge") || lower.contains("delete") || lower.contains("wipe")) &&
            (lower.contains("history") || lower.contains("conversation") || lower.contains("dialogue") || lower.contains("logs"))
        ) {
            return VoiceActionIntent(
                type = VoiceActionType.CLEAR_HISTORY,
                requiresConfirmation = true,
                confirmationPrompt = "Confirm permanent deletion of all on-watch conversation logs, sir?"
            )
        }

        // 10. Open specific system settings panels
        if (lower.contains("settings")) {
            val panel = when {
                lower.contains("sound") || lower.contains("volume") || lower.contains("audio") -> "sound"
                lower.contains("display") || lower.contains("screen") || lower.contains("brightness") -> "display"
                lower.contains("location") || lower.contains("gps") -> "location"
                lower.contains("date") || lower.contains("time") -> "datetime"
                lower.contains("device") || lower.contains("about") -> "device_info"
                else -> "main"
            }
            return VoiceActionIntent(
                type = VoiceActionType.OPEN_SETTINGS_PANEL,
                targetName = panel
            )
        }

        // 11. Launch installed application (e.g., "open calculator", "launch workout")
        val launchRegex = Regex("""^(?:jarvis[,\s]+)?(?:open|launch|start)\s+([a-z0-9\s._-]{2,28})$""")
        val match = launchRegex.find(lower)
        if (match != null) {
            val appTarget = match.groupValues[1].trim()
            if (appTarget.isNotEmpty() && !appTarget.contains("jarvis")) {
                return VoiceActionIntent(
                    type = VoiceActionType.LAUNCH_APP,
                    targetName = appTarget
                )
            }
        }

        return VoiceActionIntent(type = VoiceActionType.NONE)
    }

    internal fun extractDurationSeconds(lower: String): Int? {
        val minMatch = Regex("""(\d+)\s*(?:minute|minutes|min|mins)""").find(lower)
        val secMatch = Regex("""(\d+)\s*(?:second|seconds|sec|secs)""").find(lower)
        val hrMatch = Regex("""(\d+)\s*(?:hour|hours|hr|hrs)""").find(lower)

        var totalSeconds = 0
        if (hrMatch != null) totalSeconds += (hrMatch.groupValues[1].toIntOrNull() ?: 0) * 3600
        if (minMatch != null) totalSeconds += (minMatch.groupValues[1].toIntOrNull() ?: 0) * 60
        if (secMatch != null) totalSeconds += (secMatch.groupValues[1].toIntOrNull() ?: 0)

        if (totalSeconds > 0) return totalSeconds

        val bareNumber = Regex("""(\d+)""").find(lower)?.groupValues?.get(1)?.toIntOrNull()
        return if (bareNumber != null && bareNumber > 0) bareNumber * 60 else null
    }

    internal fun extractAlarmTime(lower: String): Pair<Int, Int>? {
        val timeRegex = Regex("""(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?""")
        val candidates = timeRegex.findAll(lower).toList()
        for (m in candidates) {
            var hour = m.groupValues[1].toIntOrNull() ?: continue
            val minute = m.groupValues[2].toIntOrNull() ?: 0
            val meridiem = m.groupValues[3].replace(".", "")

            if (hour in 0..23 && minute in 0..59) {
                if (meridiem == "pm" && hour < 12) hour += 12
                if (meridiem == "am" && hour == 12) hour = 0
                return Pair(hour, minute)
            }
        }
        return null
    }
}

/**
 * Dedicated Modular Wear OS Device Control Service for Samsung Galaxy Watch 4 (SM-R860, Wear OS 3 / API 30+).
 * Executes permitted Android system operations and provides honest security handoffs to system panels
 * whenever Android restricts direct background mutation (such as Wi-Fi, Bluetooth, or ungranted DND policy).
 */
class DeviceControlManager(context: Context) {

    private val appContext = context.applicationContext

    fun readBatteryStatus(): WatchBatteryStatus {
        val intent = appContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val bm = appContext.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val capacity = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.takeIf { it in 0..100 }
            ?: intent?.let {
                val level = it.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = it.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                if (level >= 0 && scale > 0) (level * 100) / scale else 88
            } ?: 88

        val statusInt = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging = statusInt == BatteryManager.BATTERY_STATUS_CHARGING ||
            statusInt == BatteryManager.BATTERY_STATUS_FULL

        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val powerSource = when (plugged) {
            BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Wireless Qi Dock"
            BatteryManager.BATTERY_PLUGGED_AC -> "AC Adapter"
            BatteryManager.BATTERY_PLUGGED_USB -> "USB Bus"
            else -> if (isCharging) "External Charger" else "Internal Cell"
        }

        val tempTenths = intent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 310) ?: 310
        val tempC = tempTenths / 10f

        return WatchBatteryStatus(
            levelPercent = capacity,
            isCharging = isCharging,
            powerSource = powerSource,
            temperatureCelsius = tempC
        )
    }

    fun readDeviceStatusSummary(): String {
        val bat = readBatteryStatus()
        val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val net = cm?.activeNetwork
        val caps = cm?.getNetworkCapabilities(net)
        val linkDesc = when {
            caps == null -> "Offline"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi Active"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) -> "Bluetooth Bridge"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "LTE Active"
            else -> "Connected"
        }

        val stat = StatFs(Environment.getDataDirectory().path)
        val freeMb = (stat.availableBlocksLong * stat.blockSizeLong) / (1024L * 1024L)
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        val dndActive = nm?.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL

        val chargeState = if (bat.isCharging) "charging via ${bat.powerSource}" else "on battery"
        return "Galaxy Watch 4 (${Build.MODEL}, Android API ${Build.VERSION.SDK_INT}): " +
            "Battery at ${bat.levelPercent}% ($chargeState, ${String.format(Locale.US, "%.1f°C", bat.temperatureCelsius)}). " +
            "Network: $linkDesc. Free storage: ${freeMb}MB. Do Not Disturb: ${if (dndActive) "Active" else "Off"}, sir."
    }

    /**
     * Executes a parsed VoiceActionIntent or returns a confirmation prompt if `confirmed == false`
     * for a disruptive action.
     */
    fun executeAction(
        intent: VoiceActionIntent,
        confirmed: Boolean = false,
        onClearHistoryCallback: (() -> Unit)? = null
    ): DeviceActionResult {
        if (intent.type == VoiceActionType.NONE) {
            return DeviceActionResult(handled = false, spokenResponse = "")
        }

        if (intent.requiresConfirmation && !confirmed) {
            return DeviceActionResult(
                handled = true,
                spokenResponse = intent.confirmationPrompt,
                requiresConfirmation = true,
                pendingIntent = intent
            )
        }

        return when (intent.type) {
            VoiceActionType.READ_BATTERY -> {
                val bat = readBatteryStatus()
                val statusStr = if (bat.isCharging) {
                    "currently charging via ${bat.powerSource}"
                } else {
                    "discharging normally on internal cell"
                }
                DeviceActionResult(
                    handled = true,
                    spokenResponse = "Watch battery is at ${bat.levelPercent}%, $statusStr at ${String.format(Locale.US, "%.1f°C", bat.temperatureCelsius)}, sir."
                )
            }

            VoiceActionType.READ_DEVICE_STATUS -> {
                DeviceActionResult(
                    handled = true,
                    spokenResponse = readDeviceStatusSummary()
                )
            }

            VoiceActionType.CONTROL_BLUETOOTH -> handleBluetooth(intent.targetBoolean)

            VoiceActionType.CONTROL_WIFI -> handleWifi(intent.targetBoolean)

            VoiceActionType.OPEN_SETTINGS_PANEL -> openSystemSettingsPanel(intent.targetName)

            VoiceActionType.SET_TIMER -> createTimer(
                durationSeconds = intent.durationSeconds ?: 60,
                label = intent.targetName.ifBlank { "JARVIS Timer" }
            )

            VoiceActionType.SET_ALARM -> createAlarm(
                hour = intent.alarmHour ?: 8,
                minute = intent.alarmMinute ?: 0,
                label = intent.targetName.ifBlank { "JARVIS Alarm" }
            )

            VoiceActionType.CONTROL_FLASHLIGHT -> handleFlashlight(intent.targetBoolean ?: true)

            VoiceActionType.CONTROL_DND -> handleDoNotDisturb(intent.targetBoolean ?: true)

            VoiceActionType.LAUNCH_APP -> launchApplicationByName(intent.targetName)

            VoiceActionType.CLEAR_HISTORY -> {
                onClearHistoryCallback?.invoke()
                DeviceActionResult(
                    handled = true,
                    spokenResponse = "All on-watch conversation logs have been permanently purged, sir."
                )
            }

            VoiceActionType.NONE -> DeviceActionResult(handled = false, spokenResponse = "")
        }
    }

    private fun handleBluetooth(targetEnable: Boolean?): DeviceActionResult {
        val btManager = appContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val isEnabled = try {
            btManager?.adapter?.isEnabled == true
        } catch (_: SecurityException) {
            false
        }

        val launched = launchSafeIntent(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
        val currentDesc = if (isEnabled) "currently enabled" else "currently disabled"

        return if (targetEnable != null) {
            val actionWord = if (targetEnable) "enable" else "disable"
            DeviceActionResult(
                handled = true,
                spokenResponse = "Bluetooth is $currentDesc, sir. Wear OS security policy restricts background Bluetooth toggling without user confirmation. I have opened the Bluetooth settings panel for you to $actionWord it.",
                settingsHandoffAction = if (launched) Settings.ACTION_BLUETOOTH_SETTINGS else null
            )
        } else {
            DeviceActionResult(
                handled = true,
                spokenResponse = "Bluetooth is $currentDesc, sir. Opening Bluetooth settings on your watch.",
                settingsHandoffAction = if (launched) Settings.ACTION_BLUETOOTH_SETTINGS else null
            )
        }
    }

    private fun handleWifi(targetEnable: Boolean?): DeviceActionResult {
        val wifiManager = appContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        val isEnabled = try {
            wifiManager?.isWifiEnabled == true
        } catch (_: Exception) {
            false
        }
        val currentDesc = if (isEnabled) "enabled" else "disabled"

        val panelIntent = Intent(Settings.ACTION_WIFI_SETTINGS)
        val launched = launchSafeIntent(panelIntent)

        return if (targetEnable != null) {
            val verb = if (targetEnable) "enable" else "disable"
            DeviceActionResult(
                handled = true,
                spokenResponse = "Wi-Fi is currently $currentDesc, sir. Android API ${Build.VERSION.SDK_INT} restricts ordinary applications from toggling Wi-Fi directly. I have opened the Wi-Fi settings panel so you can $verb it.",
                settingsHandoffAction = if (launched) Settings.ACTION_WIFI_SETTINGS else null
            )
        } else {
            DeviceActionResult(
                handled = true,
                spokenResponse = "Wi-Fi is currently $currentDesc, sir. Opening Wi-Fi settings.",
                settingsHandoffAction = if (launched) Settings.ACTION_WIFI_SETTINGS else null
            )
        }
    }

    private fun openSystemSettingsPanel(panelKey: String): DeviceActionResult {
        val (action, label) = when (panelKey.lowercase(Locale.ROOT)) {
            "sound" -> Settings.ACTION_SOUND_SETTINGS to "Sound & Vibration"
            "display" -> Settings.ACTION_DISPLAY_SETTINGS to "Display"
            "location" -> Settings.ACTION_LOCATION_SOURCE_SETTINGS to "Location"
            "datetime" -> Settings.ACTION_DATE_SETTINGS to "Date & Time"
            "device_info" -> Settings.ACTION_DEVICE_INFO_SETTINGS to "About Watch"
            else -> Settings.ACTION_SETTINGS to "System"
        }
        val ok = launchSafeIntent(Intent(action))
        return if (ok) {
            DeviceActionResult(
                handled = true,
                spokenResponse = "Opening $label settings on your Galaxy Watch 4, sir.",
                settingsHandoffAction = action
            )
        } else {
            launchSafeIntent(Intent(Settings.ACTION_SETTINGS))
            DeviceActionResult(
                handled = true,
                spokenResponse = "The specific $label panel was unavailable; I have opened the main Wear OS Settings menu, sir.",
                settingsHandoffAction = Settings.ACTION_SETTINGS
            )
        }
    }

    private fun createTimer(durationSeconds: Int, label: String): DeviceActionResult {
        val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
            putExtra(AlarmClock.EXTRA_LENGTH, durationSeconds)
            putExtra(AlarmClock.EXTRA_MESSAGE, label)
            putExtra(AlarmClock.EXTRA_SKIP_UI, false)
        }
        val ok = launchSafeIntent(intent)
        val mins = durationSeconds / 60
        val secs = durationSeconds % 60
        val durationDesc = when {
            mins > 0 && secs > 0 -> "$mins minutes and $secs seconds"
            mins > 0 -> "$mins ${if (mins == 1) "minute" else "minutes"}"
            else -> "$secs seconds"
        }
        return if (ok) {
            DeviceActionResult(
                handled = true,
                spokenResponse = "Timer configured for $durationDesc, sir. Handing off to the Wear OS Clock application.",
                settingsHandoffAction = AlarmClock.ACTION_SET_TIMER
            )
        } else {
            DeviceActionResult(
                handled = true,
                spokenResponse = "Unable to start a timer, sir. No compatible Clock application responded to the Android SET_TIMER intent on this watch."
            )
        }
    }

    private fun createAlarm(hour: Int, minute: Int, label: String): DeviceActionResult {
        val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
            putExtra(AlarmClock.EXTRA_HOUR, hour)
            putExtra(AlarmClock.EXTRA_MINUTES, minute)
            putExtra(AlarmClock.EXTRA_MESSAGE, label)
            putExtra(AlarmClock.EXTRA_SKIP_UI, false)
        }
        val ok = launchSafeIntent(intent)
        val formattedTime = String.format(Locale.US, "%02d:%02d", hour, minute)
        return if (ok) {
            DeviceActionResult(
                handled = true,
                spokenResponse = "Alarm set for $formattedTime, sir. Launching the Wear OS alarm interface.",
                settingsHandoffAction = AlarmClock.ACTION_SET_ALARM
            )
        } else {
            DeviceActionResult(
                handled = true,
                spokenResponse = "I could not create the $formattedTime alarm because no compatible Alarm provider is installed on this watch, sir."
            )
        }
    }

    private fun handleFlashlight(enable: Boolean): DeviceActionResult {
        val cameraManager = appContext.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
        var hardwareTorchToggled = false
        if (cameraManager != null) {
            try {
                val torchCameraId = cameraManager.cameraIdList.firstOrNull { id ->
                    cameraManager.getCameraCharacteristics(id)
                        .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                }
                if (torchCameraId != null) {
                    cameraManager.setTorchMode(torchCameraId, enable)
                    hardwareTorchToggled = true
                }
            } catch (_: Exception) {
                hardwareTorchToggled = false
            }
        }

        return if (hardwareTorchToggled) {
            DeviceActionResult(
                handled = true,
                spokenResponse = if (enable) "Hardware flashlight activated, sir." else "Hardware flashlight extinguished, sir.",
                screenTorchEnabled = false
            )
        } else {
            // Galaxy Watch 4 (SM-R860) does not have a hardware LED flash; use the high-luminance AMOLED screen torch
            DeviceActionResult(
                handled = true,
                spokenResponse = if (enable) {
                    "The Galaxy Watch 4 has no hardware LED flash, sir. Activating maximum-luminance AMOLED screen torch mode. Tap anywhere to extinguish."
                } else {
                    "AMOLED screen torch mode deactivated, sir."
                },
                screenTorchEnabled = enable
            )
        }
    }

    private fun handleDoNotDisturb(enable: Boolean): DeviceActionResult {
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return DeviceActionResult(
                handled = true,
                spokenResponse = "Notification service is unavailable on this device, sir."
            )

        if (!nm.isNotificationPolicyAccessGranted) {
            val opened = launchSafeIntent(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
            return DeviceActionResult(
                handled = true,
                spokenResponse = "Android security restricts Do Not Disturb changes until Notification Policy Access is granted to JARVIS, sir. I have opened the permission settings screen for you.",
                settingsHandoffAction = if (opened) Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS else null
            )
        }

        return try {
            nm.setInterruptionFilter(
                if (enable) NotificationManager.INTERRUPTION_FILTER_NONE
                else NotificationManager.INTERRUPTION_FILTER_ALL
            )
            DeviceActionResult(
                handled = true,
                spokenResponse = if (enable) {
                    "Do Not Disturb is now active, sir. All non-critical alerts are silenced."
                } else {
                    "Do Not Disturb has been deactivated, sir. Normal notification routing restored."
                }
            )
        } catch (e: SecurityException) {
            DeviceActionResult(
                handled = true,
                spokenResponse = "Android blocked the Do Not Disturb state change: ${e.message ?: "permission denied"}, sir."
            )
        }
    }

    private fun launchApplicationByName(query: String): DeviceActionResult {
        val cleanQuery = query.trim().lowercase(Locale.ROOT)
        if (cleanQuery.isEmpty()) {
            return DeviceActionResult(
                handled = true,
                spokenResponse = "Please specify which watch application you would like me to launch, sir."
            )
        }

        val pm = appContext.packageManager
        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }

        val resolveInfos = try {
            pm.queryIntentActivities(mainIntent, 0)
        } catch (_: Exception) {
            emptyList()
        }

        val matched = resolveInfos.firstOrNull { info ->
            val label = info.loadLabel(pm).toString().lowercase(Locale.ROOT)
            val pkg = info.activityInfo.packageName.lowercase(Locale.ROOT)
            label.contains(cleanQuery) || pkg.contains(cleanQuery)
        }

        if (matched != null) {
            val targetPkg = matched.activityInfo.packageName
            val appLabel = matched.loadLabel(pm).toString()
            val launchIntent = pm.getLaunchIntentForPackage(targetPkg)
            if (launchIntent != null && launchSafeIntent(launchIntent)) {
                return DeviceActionResult(
                    handled = true,
                    spokenResponse = "Launching $appLabel on your watch, sir."
                )
            }
        }

        return DeviceActionResult(
            handled = true,
            spokenResponse = "I could not locate an installed watch application matching '$query', sir."
        )
    }

    private fun launchSafeIntent(intent: Intent): Boolean {
        return try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            appContext.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }
}
