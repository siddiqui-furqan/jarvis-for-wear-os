# Development & Verification Status (`V6`)

This document provides an honest engineering breakdown of what is **verified**, what has been **tested on hardware vs. unit tests**, and what remains **unverified or out of scope** in the current V6 baseline.

---

## 1. Verification Summary Matrix

| Area | Status | How Verified |
| :--- | :--- | :--- |
| **Pure Domain, AI Codec, Voice Scoring & Responsive Math** | **VERIFIED** | Covered by 14 JUnit tests in `JarvisUnitTests.kt` and 23 Node.js verification tests across `wearOsAudit.test.ts`, `personality.test.ts`, and `androidProjectVerification.test.ts`. |
| **Kotlin Source Symbol, Import & Package Integrity** | **VERIFIED** | All 23 Kotlin source files under `jarvis-wearos-android/app/src/` audited for package declarations, symbol resolution, enum parity (`VoiceActionType.CLEAR_HISTORY`), and theme constants (`StarkTeal`, `StarkCyanGlow`). |
| **9-Profile Circular Responsive Geometry (`320×320`–`480×480`)** | **VERIFIED** | Mathematically verified via `CircularResponsiveSpec` chord assertions and visually inspected across all 9 profiles in the interactive simulator validation matrix. |
| **Samsung Galaxy Watch 4 (`SM-R860`, 40mm) Hardware Baseline** | **USER-VERIFIED (V3–V5) / V6 READY** | V3–V5 builds were compiled in Android Studio and installed on a physical Samsung Galaxy Watch 4 (`SM-R860`). V6 compilation fixes (`CLEAR_HISTORY`, `StarkTeal`/`StarkCyanGlow`, `CircularIconButton`) are applied and ready for local Android Studio rebuild. |
| **Container Gradle Execution (`./gradlew assembleDebug`)** | **NOT VERIFIED IN CLOUD CONTAINER** | The cloud preview container does not have a Java Development Kit (`java`) or Android SDK installed (`./gradlew: exec: java: not found`). Native Gradle builds must be run locally in Android Studio or via the included GitHub Actions CI workflow (`.github/workflows/android-ci.yml`). |

---

## 2. Features Not Implemented (Future Roadmap)

To prevent any misconception for open-source users and contributors, the following Wear OS platform features are **not** currently implemented in V6:

1. **Always-Listening Hotword Detection ("Hey JARVIS")**:
   - Voice interaction is initiated by tapping the central Arc Reactor (or the microphone button in Dialogue). Continuous background microphone hotword listening is intentionally omitted to preserve Galaxy Watch 4 battery life.
2. **Wear OS Watch Face & Complication Provider Services**:
   - J.A.R.V.I.S. runs as a standalone Wear OS application (`MainActivity`) with `AmbientLifecycleObserver` support while foregrounded, rather than a system `WatchFaceService` or `SuspendingComplicationDataSourceService`.
3. **Wear OS Tile (`TileService`)**:
   - A quick-launch Wear OS Tile is not yet bundled in `AndroidManifest.xml`.
4. **Companion Phone Application / Data Layer Sync (`WearableListenerService`)**:
   - Because `com.google.android.wearable.standalone` is `true`, all settings and API keys are entered directly on the watch (or via `adb shell input text`) rather than synced from a companion phone app.
5. **Production Release Signing Keystore**:
   - Release builds in `app/build.gradle.kts` currently use the debug signing key so the repository builds out of the box without secret keystores.
