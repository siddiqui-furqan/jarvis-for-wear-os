# Changelog

All notable changes to **J.A.R.V.I.S. for Wear OS** (`jarvis-for-wear-os`) are documented in this file.

---

## [6.0.0] — V6 Open-Source Release & Circular Responsive Architecture

### Added
- **Universal Round-Display Responsive Architecture (`CircularResponsiveSpec`)**:
  - Dynamically computes safe horizontal chords (`2 * sqrt(R^2 - dy^2)`), polar ring radii, font scales, and touch target sizing from runtime `LocalConfiguration` (`screenWidthDp`, `screenHeightDp`, `density`, `fontScale`).
  - Validated across 9 round-display profiles: `320×320` (Compact), `360×360` (Small), `384×384` (Medium), `396×396` (Galaxy Watch 4 40mm default reference), `400×400` (Standard), `416×416` (Medium-Large), `432×432` (Large), `450×450` (44mm Watch), and `480×480` (Ultra Round).
- **Open-Source Repository Infrastructure**:
  - Added Apache-2.0 `LICENSE`, `THIRD_PARTY_NOTICES.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `PUBLISHING_CHECKLIST.md`, `.editorconfig`, GitHub Actions CI workflow (`.github/workflows/android-ci.yml`), issue/PR templates, and technical documentation under `docs/`.

### Changed
- **System Matrix Navigation & Hub Layout (`SystemMatrixScreen.kt`)**:
  - Removed duplicate bottom Back button and permanently visible top-right trash button from the System Matrix hub.
  - Added a single clean header (left Back button, centered title) and a true polar 6-node ring layout (`AI LINK`, `REACTOR`, `VOICE`, `PERSONA`, `MEMORY`, `ABOUT`) around a central `CORE` indicator, with automatic vertical scroll fallback on ultra-compact (`≤360px`) displays or enlarged accessibility font scales.
- **Security Hardening (`CredentialVault.kt`, `AiProvider.kt`, `AndroidManifest.xml`)**:
  - Added corrupted Android Keystore recovery and graceful sandbox fallback in `CredentialVault`.
  - Added `AiPayloadCodec.sanitizeErrorMessage(...)` to redact API keys from network/HTTP exception strings.
  - Enforced `android:usesCleartextTraffic="false"` in `AndroidManifest.xml` and required `https://` for remote Custom Base URLs.
  - Preserved coroutine `CancellationException` propagation across all `AiProvider` suspend calls and cancelled `TextToSpeechManager` coroutine scope on shutdown.

### Fixed
- Resolved V6 Kotlin compilation issues (`VoiceActionType.CLEAR_HISTORY` alignment in `JarvisViewModel.kt`, central `StarkTeal` and `StarkCyanGlow` theme definitions in `Color.kt`, and `CircularIconButton` component export in `CircularHudComponents.kt`).

---

## [5.0.0] — V5 Native Reactor Experience & UX Refinement

### Added
- **Home-Screen Primary Voice Interaction (`HomeReactorInteractionPolicy`)**:
  - Tapping the central Arc Reactor conducts the entire voice interaction (`IDLE → LISTENING → PROCESSING → SPEAKING → IDLE`) directly on the Home screen without auto-navigating to the Dialogue screen.
- **Optional Home-Screen Response Captions**:
  - Added a reserved `28dp` two-line caption slot above the bottom dock (`homeCaptionsEnabled = true` by default) that displays spoken responses during `SPEAKING` and `IDLE` without shifting the Arc Reactor.
- **Dedicated Typed Input Router (`InputSubmissionRouter`)**:
  - Separated typed message submission (`submitTypedMessage`) from microphone speech recognition (`toggleVoiceInteraction`) and added session token invalidation in `SpeechRecognitionManager.stopListening()` to prevent false `"Speech not recognised"` errors when typing.
- **Rate-Limited Haptic Feedback (`JarvisHapticManager`, `HapticEventPolicy`)**:
  - Added predefined `VibrationEffect` feedback (`EFFECT_CLICK`, `EFFECT_TICK`, `EFFECT_DOUBLE_CLICK`, `EFFECT_HEAVY_CLICK`) with a `38ms` throttle on rotary bezel ticks.
- **System Matrix `ABOUT` Node**:
  - Replaced the Display settings node with an `ABOUT` screen crediting creator **Furqan Siddiqui** (`github.com/siddiqui-furqan`) and displaying version/build telemetry.

---

## [4.0.0] — V4 Dynamic AI Providers & Wear OS Device Control

### Added
- **Dynamic Provider & Model Configuration (`AiProvider.kt`, `SettingsRepository.kt`)**:
  - Added Google Gemini Model Discovery API integration (`GET /v1beta/models`), OpenAI model list & reasoning model support (`o1`, `o3`, `o4`, `gpt-5` using `developer` role and `max_completion_tokens`), and a vendor-neutral Custom OpenAI-compatible provider (`Base URL`, `Model ID`, `API Key`).
  - Added per-provider model and credential persistence across provider switches and app restarts.
- **Voice-to-Action & Device Control (`DeviceControlManager.kt`, `VoiceActionParser`)**:
  - Added on-watch battery/charging readout, device diagnostics, timers (`ACTION_SET_TIMER`), alarms (`ACTION_SET_ALARM`), AMOLED Screen Torch mode, Do Not Disturb control with confirmation prompts, Bluetooth/Wi-Fi settings handoff, and installed app launching.

---

## [3.0.0] — V3 Native Kotlin & Jetpack Compose for Wear OS Baseline

### Added
- Created standalone native Wear OS Android Studio module (`com.jarvis.wear`, `minSdk = 30`, `targetSdk = 34`) targeting the Samsung Galaxy Watch 4 (`SM-R860`, 40mm, `396 × 396`).
- Implemented custom `WearableActivity.onRotaryEvent` bezel scroll handler, `JarvisVoiceSelector` British Male TTS voice scoring engine, Room conversation persistence, and vector adaptive launcher icons.
