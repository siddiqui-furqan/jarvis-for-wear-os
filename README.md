# J.A.R.V.I.S. for Wear OS

> **An AI-powered personal assistant built natively for Wear OS.**

| Property | Value |
| :--- | :--- |
| **Project Name** | J.A.R.V.I.S. for Wear OS (`jarvis-for-wear-os`) |
| **Application Display Name** | `J.A.R.V.I.S.` (`com.jarvis.wear`) |
| **Primary Platform** | Wear OS 3.0+ (`minSdk = 30`, `targetSdk = 34`, `compileSdk = 35`) |
| **Language & UI Framework** | Kotlin `1.9.24` • Jetpack Compose for Wear OS |
| **Current Baseline** | `V6` (`v6.0.0-SM-R860 · Build 6`) |
| **Source License** | [Apache License, Version 2.0](./LICENSE) |

---

## Introduction

**J.A.R.V.I.S. for Wear OS** (`jarvis-for-wear-os`) is a standalone, native Kotlin smartwatch assistant designed for circular Wear OS displays. Engineered around the **Samsung Galaxy Watch 4 (SM-R860, 40mm, 396 × 396 px)** and mathematically scaled across round smartwatch screens from **320 × 320** to **480 × 480**, it places an interactive animated **Arc Reactor** at the center of the wrist interface.

Rather than navigating to a separate chat thread for every voice query, **J.A.R.V.I.S.** conducts the entire voice interaction (`IDLE → LISTENING → PROCESSING → SPEAKING → IDLE`) directly on the circular Home screen, accompanied by optional two-line response captions, British Male Text-to-Speech selection, rotary bezel scrolling, and deterministic Wear OS device controls.

> **Independent Open-Source Project Notice**: *J.A.R.V.I.S. for Wear OS* is an independent open-source software project created by [Furqan Siddiqui](https://github.com/siddiqui-furqan) and inspired by futuristic circular Heads-Up Display (HUD) interfaces. It is not affiliated with, endorsed by, or sponsored by Marvel Characters, Inc., Marvel Studios, The Walt Disney Company, Samsung Electronics, Google, or OpenAI. See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for licensing and branding details.

---

## Key Features (`V6` Baseline)

- **Primary Home-Screen Arc Reactor Voice Loop**: Tap the central reactor to speak; remain on the Home screen through listening, AI processing, and spoken playback (`HomeReactorInteractionPolicy`). Tap the reactor while speaking to stop audio playback immediately.
- **Optional Home-Screen Response Captions**: Reserved `28dp` two-line caption slot above the bottom orbital dock (`ENABLED` by default in `System Matrix → Voice`) that displays spoken replies without shifting or resizing the reactor.
- **Circular Responsive Architecture (`CircularResponsiveSpec`)**: Computes safe horizontal chords ($2\sqrt{R^2 - dy^2}$), polar node coordinates, font scales, and minimum `44dp` touch targets across 9 round-display profiles (`320×320` through `480×480`).
- **4 Selectable Arc Reactor Designs & 6 Operational States**:
  - **Themes**: `Mark I (Classic)`, `Mark II (Triangular)`, `Mark III (Segmented)`, and `Mark LXXXV (Nanotech)`.
  - **States**: `IDLE`, `LISTENING`, `PROCESSING`, `SPEAKING`, `DISCONNECTED`, and `ERROR`, plus low-power wireframe **Ambient Mode (AOD)** via `AmbientLifecycleObserver`.
- **Bring-Your-Own-Key (BYOK) AI Providers (`AiProvider.kt`)**:
  - **Google Gemini**: Live model discovery via Google's `GET /v1beta/models` endpoint (authenticated via `x-goog-api-key` header), manual Model ID entry (default `gemini-2.5-flash`), and automatic capability routing for models with or without `systemInstruction`.
  - **OpenAI**: Selectable model list (`gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`, `gpt-4.1`, `o3-mini`), live `/v1/models` refresh, and automatic `developer` role + `max_completion_tokens` formatting for reasoning models (`o1`, `o3`, `o4`, `gpt-5`).
  - **Custom (OpenAI-Compatible)**: User-configurable `https://` `Base URL`, `Model ID`, and `API Key` supporting OpenRouter, Groq, DeepSeek, Mistral, Together, or HTTPS self-hosted gateways.
  - **Per-Provider Persistence**: Switching between Gemini, OpenAI, and Custom preserves each provider's saved Model ID, Base URL, and API key independently.
- **British Male Voice Selection (`TextToSpeechManager.kt`, `JarvisVoiceSelector`)**:
  - Prioritizes British English (`en-GB`) male voices (`rjs`, `gbd`, `gbb`, `smtl01`) on Google Speech Services and Samsung TTS over default female voices (`fis`, `gba`, `smtl02`).
  - Applies automatic lower-resonance pitch tuning (`0.84x–0.90x`) when only a female/neutral offline voice is installed on the watch, and supports optional **OpenAI Neural Cloud TTS** (`onyx` voice).
- **Wear OS Voice-to-Action & Device Controls (`DeviceControlManager.kt`)**:
  - Direct battery percentage/charging/temperature readouts, system diagnostics, timers (`ACTION_SET_TIMER`), alarms (`ACTION_SET_ALARM`), high-luminance **AMOLED Screen Torch** overlay, **Do Not Disturb** toggling with confirmation, installed watch app launching, and system settings panel handoffs for Bluetooth and Wi-Fi.
- **Physical & Touch Rotary Bezel Support (`WearableActivity.onRotaryEvent`)**:
  - Custom `SOURCE_ROTARY_ENCODER` dispatcher with rate-limited haptic ticks (`38ms` minimum interval via `HapticEventPolicy`) for scrolling `DialogueScreen` and `SystemMatrixScreen`.
- **On-Watch Room SQLite Memory & Adaptive Suggestions**:
  - Persistent conversation history (`ConversationDatabase`) with bounded 6-turn context window and local keyword-boosted quick suggestions (`AdaptiveSuggestionEngine`).

---

## Screenshots & Hardware Captures

Real watch screenshots belong in [`screenshots/`](./screenshots/README.md). No fabricated or synthetic device renders are committed to this repository.

To capture screenshots from a connected Galaxy Watch 4 over Wireless ADB:
```bash
adb exec-out screencap -p > screenshots/01-home-idle.png
```
See [`screenshots/README.md`](./screenshots/README.md) for the recommended screenshot filenames (`01-home-idle.png` through `07-about-screen.png`).

---

## Supported Devices & Wear OS Compatibility

| Specification | Status & Details |
| :--- | :--- |
| **Tested Physical Hardware** | **Samsung Galaxy Watch 4 (`SM-R860`)**, 40mm Bluetooth, `396 × 396 px` (`2.0x` xhdpi, `198 × 198 dp`) — V3–V5 builds tested on physical hardware; V6 source updates ready for local Android Studio rebuild |
| **Minimum Android SDK** | **API 30** (Wear OS 3.0 / Android 11) |
| **Target / Compile SDK** | **targetSdk = 34** (Wear OS 4 / Android 14) • **compileSdk = 35** (Android 15 AAR metadata compatibility) |
| **Responsive Round Display Matrix** | `320×320`, `360×360`, `384×384`, `396×396` (Default Reference), `400×400`, `416×416`, `432×432`, `450×450`, `480×480` — verified via `CircularResponsiveSpec` unit tests and interactive simulator (not physically tested on non-SM-R860 watches) |
| **Standalone Mode** | `com.google.android.wearable.standalone = true` (No companion phone app required) |

---

## Installation Instructions

### Installing on a Samsung Galaxy Watch 4 via Wireless ADB

1. On your watch, go to **Settings → About watch → Software info** and tap **Software version** 7 times to enable Developer Mode.
2. Go to **Settings → Developer options**, enable **ADB debugging**, and open **Wireless debugging**.
3. Pair and connect from your computer on the same Wi-Fi network:
   ```bash
   adb pair <WATCH_IP>:<PAIRING_PORT>
   adb connect <WATCH_IP>:<CONNECTION_PORT>
   ```
4. Build and install the debug APK:
   ```bash
   cd jarvis-wearos-android
   ./gradlew assembleDebug
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

For detailed emulator and release build instructions, see [**docs/BUILDING.md**](./docs/BUILDING.md).

---

## Building from Source

### Requirements
- **Android Studio** Ladybug (`2024.2.1`) or newer
- **JDK 17** (Temurin / JetBrains Runtime 17)
- **Android SDK Platform 35** (`compileSdk = 35`, `targetSdk = 34`, `minSdk = 30`)

### Gradle Commands
```bash
cd jarvis-wearos-android
chmod +x ./gradlew

# Run pure Kotlin unit tests (AI codecs, voice selector, device parser, 9-profile responsive geometry)
./gradlew testDebugUnitTest

# Build debug APK
./gradlew assembleDebug
```

### Optional Interactive Browser Simulator & Verification Suite
This repository also includes an optional web simulator (`src/`, `server.ts`) that mirrors the V6 circular layout and lets you inspect all 9 round-display profiles (`320×320`–`480×480`) in a browser:
```bash
npm install
npm run dev
# Run simulator & static Android project verification tests:
npx tsx --test src/services/ai/androidProjectVerification.test.ts src/services/ai/personality.test.ts src/utils/wearOsAudit.test.ts
```

---

## AI Provider & API Key Configuration

Open **System Matrix** (gear icon at bottom-right of the Home screen) → **`AI LINK`**:

1. **Select Provider**: Choose **`GEMINI`**, **`OPENAI`**, or **`CUSTOM`**.
2. **Enter API Key**: Tap the API Key field, enter your key (or send it over ADB while the field is focused via `adb shell input text "YOUR_KEY"`), and tap **`SAVE KEY`**.
3. **Configure Model**:
   - **Gemini**: Tap **`↻ DISCOVER GEMINI MODELS`** to fetch live models from Google's Model Discovery API, or enter a model ID manually (default `gemini-2.5-flash`).
   - **OpenAI**: Select from `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`, `gpt-4.1`, `o3-mini`, or tap **`↻ REFRESH MODEL LIST`**.
   - **Custom**: Enter your `https://` **Base URL** (e.g., `https://openrouter.ai/api/v1`), **Model ID**, and **API Key**.
4. **Verify**: Tap **`⚡ TEST CONNECTION`** to confirm live connectivity.

See [**docs/CONFIGURATION.md**](./docs/CONFIGURATION.md) for full details.

---

## Architecture Overview

J.A.R.V.I.S. for Wear OS follows a modular single-Activity Jetpack Compose architecture (`MainActivity` → `JarvisWearNavHost` → `JarvisViewModel`) with pure, unit-testable domain objects (`CircularResponsiveSpec`, `AiPayloadCodec`, `VoiceActionParser`, `JarvisVoiceSelector`, `HomeReactorInteractionPolicy`, `InputSubmissionRouter`, `HapticEventPolicy`).

Read the full architecture documentation and Mermaid diagrams in [**docs/ARCHITECTURE.md**](./docs/ARCHITECTURE.md).

---

## Project Directory Structure

```text
jarvis-for-wear-os/
├── jarvis-wearos-android/                 # Standalone Native Wear OS Android Studio Project
│   ├── app/
│   │   ├── build.gradle.kts               # minSdk 30, targetSdk 34, Wear Compose, Room, OkHttp, Security Crypto
│   │   ├── proguard-rules.pro             # R8 rules for Room, OkHttp, and Tink
│   │   └── src/
│   │       ├── main/
│   │       │   ├── AndroidManifest.xml    # Standalone watch declarations, permissions, backup & cleartext rules
│   │       │   ├── java/com/jarvis/wear/
│   │       │   │   ├── MainActivity.kt    # WearableActivity rotary dispatcher & AmbientLifecycleObserver
│   │       │   │   ├── ai/                # AiProvider.kt (Gemini, OpenAI, Custom) & PersonalityEngine.kt
│   │       │   │   ├── data/              # CredentialVault.kt, SettingsRepository.kt, ConversationDatabase.kt
│   │       │   │   ├── device/            # DeviceControlManager.kt & VoiceActionParser
│   │       │   │   ├── navigation/        # JarvisWearNavHost.kt (SwipeDismissableNavHost + Torch overlay)
│   │       │   │   ├── presentation/      # JarvisViewModel.kt, HomeReactorInteractionPolicy, InputSubmissionRouter
│   │       │   │   ├── services/          # JarvisHapticManager.kt & NetworkMonitor.kt
│   │       │   │   ├── suggestions/       # AdaptiveSuggestionEngine.kt
│   │       │   │   ├── ui/                # HomeScreen, DialogueScreen, SystemMatrixScreen, ArcReactorCanvas, CircularHudComponents
│   │       │   │   └── voice/             # SpeechRecognitionManager.kt & TextToSpeechManager.kt
│   │       │   └── res/                   # Vector adaptive launcher icons, backup/data-extraction XML, strings.xml, themes.xml
│   │       └── test/java/com/jarvis/wear/
│   │           └── JarvisUnitTests.kt     # 14 JUnit 4 unit tests covering codecs, voice, device actions & V6 responsive geometry
│   ├── build.gradle.kts
│   ├── gradle.properties
│   └── settings.gradle.kts
├── docs/                                  # Technical Documentation
│   ├── ARCHITECTURE.md
│   ├── BUILDING.md
│   ├── CONFIGURATION.md
│   ├── DEVELOPMENT_STATUS.md
│   ├── FEATURES.md
│   └── TROUBLESHOOTING.md
├── screenshots/                           # Hardware Screenshot Capture Guide
│   └── README.md
├── src/                                   # Optional Interactive Browser Simulator & Multi-Watch Validation Suite
├── .github/                               # GitHub Actions CI (android-ci.yml) & Issue/PR Templates
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE                                # Apache License 2.0
├── PUBLISHING_CHECKLIST.md
├── SECURITY.md
└── THIRD_PARTY_NOTICES.md
```

---

## Usage Guide

1. **Home Screen Voice Assistant**:
   - Tap the central **Arc Reactor** to start listening (`LISTENING`).
   - Speak a question or device command (e.g., *"What is my battery level?"*, *"Set a timer for 10 minutes"*, *"Give me a tactical status briefing"*).
   - J.A.R.V.I.S. processes (`PROCESSING`) and speaks the reply (`SPEAKING`) directly on the Home screen while displaying a two-line caption above the bottom dock.
   - Tap the reactor while speaking to stop voice playback immediately.
2. **Dialogue Screen**:
   - Tap the **Dialogue** button (bottom-left dock) to browse your persistent conversation log, replay or stop any message's audio, type a silent text command, or confirm pending device actions.
3. **System Matrix**:
   - Tap the **Matrix** button (bottom-right dock) to open the 6-node circular settings hub (`AI LINK`, `REACTOR`, `VOICE`, `PERSONA`, `MEMORY`, `ABOUT`).

---

## Privacy & Security Overview

- **Local Encrypted Key Vault**: API keys are stored on-watch using `EncryptedSharedPreferences` (`AES256_GCM`) via `CredentialVault`. If `EncryptedSharedPreferences` cannot be initialized even after reset recovery, credentials are held strictly in volatile memory (`ConcurrentHashMap`) for the current session only and are **never** written in plaintext to disk.
- **No Proprietary Telemetry**: Prompts are sent exclusively from your watch over HTTPS (`android:usesCleartextTraffic="false"`) to your configured provider (`Google Gemini`, `OpenAI`, or your `Custom` HTTPS endpoint).
- **Backup & Transfer Exclusion**: `android:allowBackup="false"`, `backup_rules.xml`, and `data_extraction_rules.xml` prevent unencrypted cloud backups and device transfers of local SQLite history and keys.
- Read the full security model and honest limitations in [**SECURITY.md**](./SECURITY.md).

---

## Troubleshooting

Having trouble with microphone permissions, female default TTS voices on Galaxy Watch 4, or ADB API key entry? See [**docs/TROUBLESHOOTING.md**](./docs/TROUBLESHOOTING.md).

---

## Roadmap

- [ ] Optional Wear OS Tile (`TileService`) for one-swipe reactor launch
- [ ] Optional Watch Face Complication data source (`SuspendingComplicationDataSourceService`)
- [ ] Optional SQLCipher encryption for local Room conversation database
- [ ] Constructor-injected repository interfaces / Hilt DI for full ViewModel coroutine instrumentation tests

---

## Contributing

Contributions, bug reports, and Wear OS hardware test reports are welcome! Please read [**CONTRIBUTING.md**](./CONTRIBUTING.md) and our [**Code of Conduct**](./CODE_OF_CONDUCT.md) before opening a Pull Request.

---

## License & Attribution

Created by **Furqan Siddiqui** ([`@siddiqui-furqan`](https://github.com/siddiqui-furqan)).

Licensed under the [**Apache License, Version 2.0**](./LICENSE). See [**THIRD_PARTY_NOTICES.md**](./THIRD_PARTY_NOTICES.md) for full open-source dependency attributions and trademark disclaimers.
