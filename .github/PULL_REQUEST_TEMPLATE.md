## Summary
Describe the changes introduced in this Pull Request and the problem they solve.

## Related Issues
Closes #

## Architectural & UX Checklist
- [ ] Preserves the V6 circular UI geometry (`CircularResponsiveSpec`) without clipping or overlap across `320×320` through `480×480` round displays.
- [ ] Home screen Arc Reactor voice interaction remains on the Home screen (`IDLE → LISTENING → PROCESSING → SPEAKING → IDLE`) without auto-navigating to Dialogue.
- [ ] Typed messages in `DialogueScreen` route directly to `PROCESSING` and never trigger `SpeechRecognitionManager`.
- [ ] No hardcoded API keys, tokens, `local.properties`, or signing keystores are included.
- [ ] Unit tests in `JarvisUnitTests.kt` (and/or simulator verification tests) were added or updated.

## Verification Performed
- [ ] `./gradlew testDebugUnitTest`
- [ ] `./gradlew assembleDebug`
- [ ] Verified on physical Wear OS hardware (specify device: `_______________`)
- [ ] Verified on Wear OS round emulator (specify resolution: `_______________`)
