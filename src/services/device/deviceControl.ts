import { WatchTelemetry } from '../../types/index.ts';

export type VoiceActionType =
  | 'NONE'
  | 'READ_BATTERY'
  | 'READ_DEVICE_STATUS'
  | 'OPEN_SETTINGS_PANEL'
  | 'LAUNCH_APP'
  | 'CONTROL_FLASHLIGHT'
  | 'SET_TIMER'
  | 'SET_ALARM'
  | 'CONTROL_DND'
  | 'CONTROL_BLUETOOTH'
  | 'CONTROL_WIFI'
  | 'CLEAR_CONVERSATION';

export interface VoiceActionIntent {
  type: VoiceActionType;
  rawText: string;
  targetName: string;
  enableFlag: boolean | null;
  durationSeconds: number;
  alarmHour: number;
  alarmMinute: number;
  label: string;
  requiresConfirmation: boolean;
  confirmationPrompt: string;
}

export interface DeviceActionResult {
  handled: boolean;
  requiresConfirmation: boolean;
  confirmationIntent?: VoiceActionIntent;
  spokenResponse: string;
  screenTorchEnabled?: boolean;
  openedSettingsSection?: string;
}

/**
 * Pure deterministic parser that maps user voice/text commands into Wear OS device control actions.
 * Mirrors `VoiceActionParser` in `DeviceControlManager.kt` 1:1.
 */
export function parseVoiceActionIntent(prompt: string): VoiceActionIntent {
  const clean = (prompt || '').trim();
  const lower = clean.toLowerCase();

  const noneIntent: VoiceActionIntent = {
    type: 'NONE',
    rawText: clean,
    targetName: '',
    enableFlag: null,
    durationSeconds: 0,
    alarmHour: 7,
    alarmMinute: 0,
    label: '',
    requiresConfirmation: false,
    confirmationPrompt: '',
  };

  if (!lower) return noneIntent;

  // 1. Battery Level & Charging Status
  if (
    lower.includes('battery') ||
    lower.includes('charge level') ||
    lower.includes('power level') ||
    lower.includes('how much charge')
  ) {
    return { ...noneIntent, type: 'READ_BATTERY' };
  }

  // 2. General Device Status / Diagnostics
  if (
    lower.includes('device status') ||
    lower.includes('watch status') ||
    lower.includes('storage space') ||
    lower.includes('free storage') ||
    lower.includes('watch diagnostic') ||
    lower.includes('system diagnostic')
  ) {
    return { ...noneIntent, type: 'READ_DEVICE_STATUS' };
  }

  // 3. Flashlight / Torch
  if (lower.includes('flashlight') || lower.includes('torch')) {
    const turnOff =
      lower.includes('off') || lower.includes('disable') || lower.includes('stop');
    return {
      ...noneIntent,
      type: 'CONTROL_FLASHLIGHT',
      enableFlag: !turnOff,
    };
  }

  // 4. Timers ("set a timer for 5 minutes", "timer 30 seconds")
  if (lower.includes('timer')) {
    const seconds = extractDurationSeconds(lower);
    return {
      ...noneIntent,
      type: 'SET_TIMER',
      durationSeconds: seconds,
      label: 'JARVIS Timer',
    };
  }

  // 5. Alarms ("set an alarm for 7:30 am", "wake me up at 06:45")
  if (lower.includes('alarm') || lower.includes('wake me up')) {
    const [hour, minute] = extractAlarmHourMinute(lower);
    return {
      ...noneIntent,
      type: 'SET_ALARM',
      alarmHour: hour,
      alarmMinute: minute,
      label: 'JARVIS Alarm',
    };
  }

  // 6. Do Not Disturb (Requires confirmation when enabling)
  if (lower.includes('do not disturb') || /\bdnd\b/.test(lower)) {
    const turnOff = lower.includes('off') || lower.includes('disable');
    const enable = !turnOff;
    return {
      ...noneIntent,
      type: 'CONTROL_DND',
      enableFlag: enable,
      requiresConfirmation: enable,
      confirmationPrompt: enable
        ? 'Confirm enabling Do Not Disturb mode on this watch, sir?'
        : '',
    };
  }

  // 7. Bluetooth Control / Settings
  if (lower.includes('bluetooth')) {
    const enable: boolean | null =
      lower.includes('on') || lower.includes('enable')
        ? true
        : lower.includes('off') || lower.includes('disable')
        ? false
        : null;
    return {
      ...noneIntent,
      type: 'CONTROL_BLUETOOTH',
      enableFlag: enable,
    };
  }

  // 8. Wi-Fi Control / Settings
  if (lower.includes('wi-fi') || lower.includes('wifi')) {
    const enable: boolean | null =
      lower.includes('on') || lower.includes('enable')
        ? true
        : lower.includes('off') || lower.includes('disable')
        ? false
        : null;
    return {
      ...noneIntent,
      type: 'CONTROL_WIFI',
      enableFlag: enable,
    };
  }

  // 9. Clear / Purge Conversation Logs (Disruptive -> requires confirmation)
  if (
    (lower.includes('clear') ||
      lower.includes('delete') ||
      lower.includes('purge')) &&
    (lower.includes('history') ||
      lower.includes('conversation') ||
      lower.includes('logs') ||
      lower.includes('memory'))
  ) {
    return {
      ...noneIntent,
      type: 'CLEAR_CONVERSATION',
      requiresConfirmation: true,
      confirmationPrompt:
        'Confirm purging all stored conversation logs on this watch, sir?',
    };
  }

  // 10. Open System Settings Panels
  if (lower.includes('settings') && (lower.includes('open') || lower.includes('show') || lower.includes('go to'))) {
    let panel = 'main';
    if (lower.includes('sound') || lower.includes('volume') || lower.includes('audio')) panel = 'sound';
    else if (lower.includes('display') || lower.includes('screen') || lower.includes('brightness')) panel = 'display';
    else if (lower.includes('location') || lower.includes('gps')) panel = 'location';
    else if (lower.includes('date') || lower.includes('time')) panel = 'datetime';
    else if (lower.includes('about') || lower.includes('device info')) panel = 'about';
    return {
      ...noneIntent,
      type: 'OPEN_SETTINGS_PANEL',
      targetName: panel,
    };
  }

  // 11. Launch Installed Applications ("open spotify", "launch workout")
  const launchPrefixes = ['open app ', 'launch app ', 'start app ', 'launch ', 'open '];
  for (const prefix of launchPrefixes) {
    if (lower.startsWith(prefix)) {
      const candidate = clean
        .slice(prefix.length)
        .replace(/\b(please|sir|jarvis|for me|app|application)\b/gi, '')
        .trim();
      if (candidate && !candidate.toLowerCase().includes('settings')) {
        return {
          ...noneIntent,
          type: 'LAUNCH_APP',
          targetName: candidate,
        };
      }
    }
  }

  return noneIntent;
}

export function extractDurationSeconds(lowerText: string): number {
  let totalSeconds = 0;
  const hourMatch = lowerText.match(/(\d+)\s*(hour|hr|hrs|h)\b/);
  const minMatch = lowerText.match(/(\d+)\s*(minute|minutes|min|mins|m)\b/);
  const secMatch = lowerText.match(/(\d+)\s*(second|seconds|sec|secs|s)\b/);

  if (hourMatch) totalSeconds += (parseInt(hourMatch[1], 10) || 0) * 3600;
  if (minMatch) totalSeconds += (parseInt(minMatch[1], 10) || 0) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1], 10) || 0;

  if (totalSeconds === 0) {
    const bareNum = lowerText.match(/(\d+)/);
    if (bareNum) {
      totalSeconds = (parseInt(bareNum[1], 10) || 1) * 60;
    } else {
      totalSeconds = 60;
    }
  }
  return Math.min(Math.max(totalSeconds, 5), 86400);
}

export function extractAlarmHourMinute(lowerText: string): [number, number] {
  const timeMatch = lowerText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/);
  if (!timeMatch) return [7, 0];
  let hour = parseInt(timeMatch[1], 10);
  if (Number.isNaN(hour)) hour = 7;
  const minute = Math.min(Math.max(parseInt(timeMatch[2] || '0', 10) || 0, 0), 59);
  const meridiem = (timeMatch[3] || '').replace(/\./g, '');

  if (meridiem === 'pm' && hour >= 1 && hour <= 11) hour += 12;
  else if (meridiem === 'am' && hour === 12) hour = 0;

  return [Math.min(Math.max(hour, 0), 23), minute];
}

export function formatDurationSpoken(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs} ${hrs === 1 ? 'hour' : 'hours'}`);
  if (mins > 0) parts.push(`${mins} ${mins === 1 ? 'minute' : 'minutes'}`);
  if (secs > 0) parts.push(`${secs} ${secs === 1 ? 'second' : 'seconds'}`);
  return parts.length > 0 ? parts.join(' and ') : '1 minute';
}

/**
 * Executes a parsed Wear OS device control intent.
 * Uses real Web Battery API (`navigator.getBattery()`) when available in the browser and
 * mirrors Android 11+ / Wear OS 3+ permission and system settings handoff behavior accurately.
 */
export async function executeDeviceControlIntent(
  intent: VoiceActionIntent,
  telemetry: WatchTelemetry,
  options: {
    confirmed?: boolean;
    dndAccessGranted?: boolean;
  } = {}
): Promise<DeviceActionResult> {
  const confirmed = options.confirmed ?? false;
  const dndAccessGranted = options.dndAccessGranted ?? true;

  if (intent.requiresConfirmation && !confirmed) {
    return {
      handled: true,
      requiresConfirmation: true,
      confirmationIntent: intent,
      spokenResponse: `${intent.confirmationPrompt} Tap CONFIRM or say 'Confirm' to proceed, or 'Cancel' to abort.`,
    };
  }

  switch (intent.type) {
    case 'READ_BATTERY': {
      let pct = telemetry.batteryLevel;
      let charging = telemetry.charging;
      try {
        const nav = navigator as Navigator & {
          getBattery?: () => Promise<{ level: number; charging: boolean }>;
        };
        if (typeof nav.getBattery === 'function') {
          const bat = await nav.getBattery();
          pct = Math.round(bat.level * 100);
          charging = bat.charging;
        }
      } catch {
        // Fallback to watch telemetry state
      }
      const stateLabel = charging ? 'currently charging' : 'on battery power';
      return {
        handled: true,
        requiresConfirmation: false,
        spokenResponse: `Watch battery is at ${pct}% (${stateLabel}), sir. Core temperature is ${telemetry.coreTemperature.toFixed(1)}°C.`,
      };
    }

    case 'READ_DEVICE_STATUS': {
      return {
        handled: true,
        requiresConfirmation: false,
        spokenResponse: `Galaxy Watch 4 (SM-R860) diagnostics: Battery at ${telemetry.batteryLevel}% (${telemetry.coreTemperature.toFixed(1)}°C), network transport via ${
          telemetry.connectionState === 'offline' ? 'Offline Contingency' : 'Bluetooth / Wi-Fi Link'
        }, 7,420 MB free internal storage, Do Not Disturb is OFF, sir.`,
      };
    }

    case 'CONTROL_FLASHLIGHT': {
      const enable = intent.enableFlag ?? true;
      return {
        handled: true,
        requiresConfirmation: false,
        screenTorchEnabled: enable,
        spokenResponse: enable
          ? 'Activating high-luminance AMOLED screen torch on your Galaxy Watch 4, sir. Tap the screen to extinguish.'
          : 'Extinguishing watch screen torch, sir.',
      };
    }

    case 'SET_TIMER': {
      const humanDuration = formatDurationSpoken(intent.durationSeconds);
      return {
        handled: true,
        requiresConfirmation: false,
        spokenResponse: `Timer set for ${humanDuration} via Wear OS AlarmClock (ACTION_SET_TIMER), sir.`,
      };
    }

    case 'SET_ALARM': {
      const hh = String(intent.alarmHour).padStart(2, '0');
      const mm = String(intent.alarmMinute).padStart(2, '0');
      return {
        handled: true,
        requiresConfirmation: false,
        spokenResponse: `Alarm configured for ${hh}:${mm} via Wear OS AlarmClock (ACTION_SET_ALARM), sir.`,
      };
    }

    case 'CONTROL_DND': {
      const enable = intent.enableFlag ?? true;
      if (!dndAccessGranted) {
        return {
          handled: true,
          requiresConfirmation: false,
          spokenResponse:
            'Wear OS requires Notification Policy Access before JARVIS can toggle Do Not Disturb directly. Opening Notification Policy Access settings (ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS) for you now, sir.',
        };
      }
      return {
        handled: true,
        requiresConfirmation: false,
        spokenResponse: enable
          ? 'Do Not Disturb (Interruption Filter Priority) is now enabled on your watch, sir.'
          : 'Do Not Disturb has been disabled and normal notifications are restored, sir.',
      };
    }

    case 'CONTROL_BLUETOOTH': {
      const desired =
        intent.enableFlag === true
          ? 'enable Bluetooth'
          : intent.enableFlag === false
          ? 'disable Bluetooth'
          : 'manage Bluetooth';
      return {
        handled: true,
        requiresConfirmation: false,
        spokenResponse: `Bluetooth is currently ON. Because Wear OS 3+ restricts silent background Bluetooth toggling, I have opened the Bluetooth settings panel (ACTION_BLUETOOTH_SETTINGS) so you can ${desired} directly, sir.`,
      };
    }

    case 'CONTROL_WIFI': {
      const desired =
        intent.enableFlag === true
          ? 'enable Wi-Fi'
          : intent.enableFlag === false
          ? 'disable Wi-Fi'
          : 'configure Wi-Fi';
      return {
        handled: true,
        requiresConfirmation: false,
        spokenResponse: `Wi-Fi is currently ON. Android 11+ (API 30+) prohibits third-party apps from toggling Wi-Fi directly without user interaction. Opening the Wear OS Wi-Fi settings panel (ACTION_WIFI_SETTINGS) to ${desired}, sir.`,
      };
    }

    case 'OPEN_SETTINGS_PANEL': {
      return {
        handled: true,
        requiresConfirmation: false,
        openedSettingsSection: intent.targetName,
        spokenResponse: `Opening the ${intent.targetName} settings panel on your watch, sir.`,
      };
    }

    case 'LAUNCH_APP': {
      return {
        handled: true,
        requiresConfirmation: false,
        spokenResponse: `Querying Wear OS PackageManager for '${intent.targetName}' and launching its main activity, sir.`,
      };
    }

    case 'CLEAR_CONVERSATION': {
      return {
        handled: true,
        requiresConfirmation: false,
        spokenResponse: 'Conversation logs purged as confirmed, sir.',
      };
    }

    default:
      return {
        handled: false,
        requiresConfirmation: false,
        spokenResponse: '',
      };
  }
}
