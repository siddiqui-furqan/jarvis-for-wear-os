# Features & Capabilities Matrix (`V6`)

This document provides an accurate inventory of all features implemented in **J.A.R.V.I.S. for Wear OS** (`v6.0.0-SM-R860 · Build 6`), how each works under Android 11–14 (API 30–34) security constraints, and any platform limitations.

---

## 1. Core Assistant & UI Capabilities

| Feature | Implementation Status | Source Location | Notes |
| :--- | :--- | :--- | :--- |
| **Home-Screen Arc Reactor Voice Flow** | Implemented | `HomeScreen.kt`, `JarvisViewModel.kt` | Tapping the central reactor conducts `IDLE → LISTENING → PROCESSING → SPEAKING → IDLE` entirely on the Home screen without auto-navigating to Dialogue. |
| **Tap-to-Stop Speech Interrupt** | Implemented | `HomeScreen.kt`, `TextToSpeechManager.kt` | Tapping the reactor or bottom dock button while `SPEAKING` immediately stops TTS/audio playback and returns to `IDLE`. |
| **Optional Home Response Captions** | Implemented | `HomeScreen.kt`, `HomeReactorInteractionPolicy` | Reserved `28dp` 2-line slot above the bottom dock (`ENABLED` by default). Does not shift or resize the reactor when toggled off. |
| **4 Selectable Arc Reactor Designs** | Implemented | `ArcReactorCanvas.kt` | `Mark I`, `Mark II`, `Mark III`, and `Mark LXXXV Nanotech` rendered at 60fps on Compose `Canvas`. |
| **6 Operational States** | Implemented | `ArcReactorCanvas.kt`, `JarvisViewModel.kt` | `IDLE`, `LISTENING`, `PROCESSING`, `SPEAKING`, `DISCONNECTED`, `ERROR`. |
| **Low-Power Ambient Mode (AOD)** | Implemented | `MainActivity.kt`, `ArcReactorCanvas.kt` | Uses `AmbientLifecycleObserver` to switch to a static low-pixel wireframe (`drawAmbientReactor`) when the watch enters ambient mode. |
| **9-Profile Circular Responsive Architecture** | Implemented | `CircularResponsiveSpec` (`CircularHudComponents.kt`) | Computes safe horizontal chords and polar node coordinates across `320×320` through `480×480` round displays. |
| **Rotary Bezel Scrolling & Haptics** | Implemented | `MainActivity.kt`, `JarvisHapticManager.kt` | Captures `SOURCE_ROTARY_ENCODER` in `WearableActivity.onRotaryEvent`, scrolls `DialogueScreen` and `SystemMatrixScreen`, and rate-limits rotary ticks to `38ms`. |
| **Separated Typed & Voice Submission** | Implemented | `InputSubmissionRouter`, `DialogueScreen.kt` | Typed prompts go straight to `PROCESSING` and cancel any active speech session token so `"Speech not recognised"` never fires on typed input. |

---

## 2. AI Provider & Persistence Capabilities

| Feature | Implementation Status | Source Location | Notes |
| :--- | :--- | :--- | :--- |
| **Google Gemini Provider + Model Discovery** | Implemented | `GeminiProvider` (`AiProvider.kt`) | Queries `GET /v1beta/models`, filters `generateContent` models, supports manual model ID entry, and handles `gemma-*` models without `systemInstruction`. |
| **OpenAI Provider + Reasoning Models** | Implemented | `OpenAiProvider` (`AiProvider.kt`) | Includes curated model list, live `/v1/models` refresh, and automatic `developer` role + `max_completion_tokens` routing for `o1`/`o3`/`o4`/`gpt-5`. |
| **Custom OpenAI-Compatible Provider** | Implemented | `CustomOpenAiCompatibleProvider` (`AiProvider.kt`) | Configurable `Base URL` (`https://`), `Model ID`, and `API Key` for OpenRouter, Groq, DeepSeek, Mistral, or local servers. |
| **Per-Provider Config Persistence** | Implemented | `SettingsRepository.kt`, `CredentialVault.kt` | Switching providers restores that provider's saved model, Base URL, and API key without overwriting other providers. |
| **Room SQLite Conversation Memory** | Implemented | `ConversationDatabase.kt` | Stores messages locally in `jarvis_wear_dialogue.db` and injects the last 6 turns when `Persistent Memory` is enabled. |
| **On-Device Adaptive Suggestions** | Implemented | `AdaptiveSuggestionEngine.kt` | Boosts up to 2 quick-action chips on the Home screen based on local keyword frequency; supports per-chip dismissal and full reset. |

---

## 3. Voice-to-Action & Wear OS Device Controls (`DeviceControlManager.kt`)

 Android 11+ (API 30+) imposes strict security policies on background system state mutation. J.A.R.V.I.S. distinguishes between **direct execution** and **system settings panel handoff**:

| Voice / Text Command Example | Action Type | Execution Behavior on Wear OS (API 30+) | Confirmation Required? |
| :--- | :--- | :--- | :--- |
| `"What is my battery level?"` | `READ_BATTERY` | **Direct**: Reads `BatteryManager` capacity %, charging state, power source (Qi wireless / USB / internal cell), and battery temperature (°C). | No |
| `"Run a device status diagnostic"` | `READ_DEVICE_STATUS` | **Direct**: Reports watch model, Android API level, battery %, active network transport (`Wi-Fi`, `Bluetooth Bridge`, `LTE`), free storage (`StatFs`), and DND state. | No |
| `"Set a timer for 5 minutes"` | `SET_TIMER` | **Intent Handoff**: Launches `AlarmClock.ACTION_SET_TIMER` with duration and label in the Wear OS Clock app. | No |
| `"Set an alarm for 7:30 AM"` | `SET_ALARM` | **Intent Handoff**: Launches `AlarmClock.ACTION_SET_ALARM` in the Wear OS Alarm provider. | No |
| `"Turn on the flashlight"` / `"Turn off torch"` | `CONTROL_FLASHLIGHT` | **Direct**: Toggles hardware camera flash if present; on Galaxy Watch 4 (`SM-R860`, which has no LED flash), activates a full-luminance white AMOLED Screen Torch overlay. | No |
| `"Enable Do Not Disturb"` | `CONTROL_DND` | **Direct (with Policy Grant) / Handoff**: Prompts for confirmation first. If `NotificationManager.isNotificationPolicyAccessGranted` is true, sets `INTERRUPTION_FILTER_NONE`; otherwise opens `ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS`. | **Yes** (when enabling) |
| `"Turn on Bluetooth"` / `"Open Bluetooth"` | `CONTROL_BLUETOOTH` | **Settings Handoff**: Reports current Bluetooth adapter state and opens `Settings.ACTION_BLUETOOTH_SETTINGS` (Wear OS restricts silent background Bluetooth toggling). | No |
| `"Turn on Wi-Fi"` / `"Open Wi-Fi settings"` | `CONTROL_WIFI` | **Settings Handoff**: Reports current Wi-Fi state and opens `Settings.ACTION_WIFI_SETTINGS` (Android API 29+ restricts apps from toggling Wi-Fi directly). | No |
| `"Open sound settings"` / `"Display settings"` | `OPEN_SETTINGS_PANEL` | **Settings Handoff**: Opens `ACTION_SOUND_SETTINGS`, `ACTION_DISPLAY_SETTINGS`, `ACTION_LOCATION_SOURCE_SETTINGS`, `ACTION_DATE_SETTINGS`, or `ACTION_DEVICE_INFO_SETTINGS`. | No |
| `"Open Spotify"` / `"Launch Calculator"` | `LAUNCH_APP` | **Direct**: Queries launcher activities via `PackageManager.queryIntentActivities` (permitted via `<queries>` in `AndroidManifest.xml`) and launches the matched watch app. | No |
| `"Clear conversation history"` | `CLEAR_HISTORY` | **Direct (with Confirmation)**: Prompts the user for confirmation, then purges all rows from Room `dialogue_messages`. | **Yes** |
