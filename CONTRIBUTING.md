# Contributing to J.A.R.V.I.S. for Wear OS

Thank you for your interest in contributing to **J.A.R.V.I.S. for Wear OS** (`jarvis-for-wear-os`)!

This document outlines the architecture boundaries, circular UI design constraints, testing expectations, and Pull Request workflow.

---

## 1. Development Environment Requirements

- **Android Studio**: Ladybug (2024.2.1) or newer (Koala / Iguana also supported)
- **JDK**: Java 17 (required by Android Gradle Plugin `8.6.1` and Kotlin `1.9.24`)
- **Android SDK**:
  - `minSdk = 30` (Wear OS 3.0 / Android 11)
  - `compileSdk = 35` / `targetSdk = 34`
- **Target Hardware / Emulator**:
  - Physical Samsung Galaxy Watch 4 (`SM-R860`, 40mm, `396 × 396 px`, `2.0x` xhdpi, `198 × 198 dp`) or any Wear OS 3+ round emulator (`320 × 320` through `480 × 480`).
- **Optional Browser Simulator**:
  - Node.js 20+ (`npm install && npm run dev`) for inspecting the interactive 9-profile round display validation matrix in a web browser.

---

## 2. Core Architectural Rules

1. **Preserve the V6 Circular UI & Responsive Architecture**:
   - All circular geometry calculations live in `CircularResponsiveSpec` (`ui/components/CircularHudComponents.kt`).
   - Do **not** hardcode pixel positions that only fit one watch model. Always compute safe chords (`computeChordWidthDp(diameterDp, yOffsetRatio)`) and percentage-based insets so layouts work across all 9 round-display validation profiles (`320×320` through `480×480`).
2. **Home Screen Voice Interaction Flow**:
   - Tapping the central Arc Reactor on the Home screen must keep the user on the Home screen through `IDLE → LISTENING → PROCESSING → SPEAKING → IDLE`.
   - Never reintroduce automatic navigation from the Home screen to the Dialogue screen after voice queries (`HomeReactorInteractionPolicy.shouldAutoNavigateToDialogueFromHome()` must remain `false`).
3. **Separate Typed Input from Speech Recognition**:
   - Typed messages submitted in `DialogueScreen` must route through `JarvisViewModel.submitTypedMessage(...)` and `InputSubmissionRouter.routeTypedMessage(...)` directly into `PROCESSING`. They must never trigger `SpeechRecognitionManager.startListening(...)`.
4. **Decouple Pure Logic for Deterministic JUnit Testing**:
   - Keep pure domain and layout logic in standalone objects (`AiPayloadCodec`, `VoiceActionParser`, `JarvisVoiceSelector`, `CircularResponsiveSpec`, `HomeReactorInteractionPolicy`, `InputSubmissionRouter`, `HapticEventPolicy`, `RotaryBezelDispatcher`) so they can be verified via `./gradlew testDebugUnitTest` without requiring a live watch or network connection.
5. **Security & Zero-Secret Hygiene**:
   - Never hardcode API keys, bearer tokens, or private endpoints in source files or tests.
   - Always sanitize provider error messages with `AiPayloadCodec.sanitizeErrorMessage(...)`.

---

## 3. Running Tests Before Submitting a PR

### Native Kotlin Unit Tests (Android Studio / Gradle)
```bash
cd jarvis-wearos-android
./gradlew testDebugUnitTest assembleDebug
```

### Browser Simulator & Static Verification Suite (Node.js)
```bash
npx tsx --test src/services/ai/androidProjectVerification.test.ts src/services/ai/personality.test.ts src/utils/wearOsAudit.test.ts
npm run lint
npm run build
```

---

## 4. Submitting a Pull Request

1. Fork the repository and create a feature or bugfix branch from `main` (e.g., `fix/tts-locale-fallback` or `feat/complication-support`).
2. Keep changes focused and surgical. Avoid unrelated formatting churn.
3. Add or update unit tests in `jarvis-wearos-android/app/src/test/java/com/jarvis/wear/JarvisUnitTests.kt` for any modified business or layout logic.
4. Complete the Pull Request template checklist, noting whether you verified your change on a physical watch, Wear OS emulator, or unit test suite.
