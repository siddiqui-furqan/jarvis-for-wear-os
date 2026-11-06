# Screenshots & Hardware Captures (`screenshots/`)

This directory is reserved for **authentic screenshots and screen recordings** captured from a physical Wear OS smartwatch (such as the Samsung Galaxy Watch 4 `SM-R860`) or an official Android Studio Wear OS round emulator.

> **Transparency Note**: No fabricated or synthetic mockup images are committed to this directory. Add real hardware captures using the commands below after installing the APK on your watch.

---

## Recommended Filenames for `README.md`

When adding screenshots to this folder, use the following descriptive filenames so documentation links remain consistent:

| Filename | Screen / State to Capture |
| :--- | :--- |
| `01-home-idle.png` | Home Screen — Arc Reactor in `IDLE` state with top telemetry & bottom orbital dock |
| `02-home-speaking-caption.png` | Home Screen — `SPEAKING` state with 2-line response caption & Tap Reactor to Stop hint |
| `03-dialogue-stream.png` | Dialogue Screen — Conversation cards, replay audio button, and compact input bar |
| `04-system-matrix-hub.png` | System Matrix — 6-node circular radial hub (`AI LINK`, `REACTOR`, `VOICE`, `PERSONA`, `MEMORY`, `ABOUT`) around `CORE` |
| `05-ai-link-config.png` | System Matrix → `AI LINK` — Provider selector (`Gemini`, `OpenAI`, `Custom`), Model Discovery, and Keystore vault status |
| `06-reactor-themes.png` | System Matrix → `REACTOR` — Live interactive Arc Reactor theme selector (`Mark I`, `Mark II`, `Mark III`, `Nanotech`) |
| `07-about-screen.png` | System Matrix → `ABOUT` — Creator attribution (`Furqan Siddiqui`), GitHub link button, and V6 build telemetry |

---

## How to Capture Real Screenshots from a Physical Galaxy Watch 4

1. Ensure Wireless Debugging is connected over ADB:
   ```bash
   adb devices
   ```
2. Capture the circular `396 × 396` framebuffer directly to your workstation:
   ```bash
   adb exec-out screencap -p > screenshots/01-home-idle.png
   ```
3. Alternatively, open **Android Studio → View → Tool Windows → Running Devices**, select your connected **SM-R860**, and click the **Take Screenshot** (camera) icon in the device toolbar.
