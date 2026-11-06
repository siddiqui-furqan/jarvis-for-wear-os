# Troubleshooting Guide — J.A.R.V.I.S. for Wear OS

Common issues and solutions when building, installing, or configuring **J.A.R.V.I.S. for Wear OS** on a Samsung Galaxy Watch 4 (`SM-R860`) or other Wear OS 3/4 smartwatches.

---

## 1. Voice Input & Speech Recognition Issues

### Symptom: `"Microphone permission denied. Grant RECORD_AUDIO in Watch Settings."`
- **Cause**: Runtime `android.permission.RECORD_AUDIO` was declined or not yet granted.
- **Fix**:
  1. On the watch, open **Settings → Apps → App list → J.A.R.V.I.S. → Permissions → Microphone** and select **Allow only while using the app**.
  2. Or grant via ADB:
     ```bash
     adb shell pm grant com.jarvis.wear.debug android.permission.RECORD_AUDIO
     ```

### Symptom: `"Speech recognition service is unavailable on this Wear OS device."`
- **Cause**: The watch or emulator does not have an active `android.speech.RecognitionService` provider enabled.
- **Fix**:
  - Ensure **Google** or **Samsung Voice Input** is enabled in **Watch Settings → General → Input**.
  - On Wear OS emulators, choose a system image that includes **Google Play / Google APIs** and enable **Virtual microphone uses host audio input** in the emulator's Extended Controls.

---

## 2. Voice Output (TTS) Sounds Female Instead of British Male

### Symptom: J.A.R.V.I.S. speaks with a default female voice
- **Cause**: Out of the box, Samsung Galaxy Watch 4 devices often only cache a single default offline English voice (`en-gb-x-fis-local` or Samsung `smtl02`), which is female.
- **Fix**:
  1. On your Galaxy Watch 4, open **Settings → General → Text-to-speech**.
  2. Set **Preferred engine** to **Speech Recognition & Synthesis from Google**.
  3. Tap the gear icon next to the engine → **Install voice data → English (United Kingdom)** and download the offline voice pack (which includes male voices `en-gb-x-rjs-local` and `en-gb-x-gbd-local`).
  4. In J.A.R.V.I.S., open **System Matrix → VOICE**, tap **System Voice Synthesizer** to cycle to `UK-rjs · UK Male` (or leave on `Auto British Male Default`), and tap **`▶ PREVIEW VOICE`**.
  5. Alternatively, if you use the **OpenAI** provider, enable **`Neural Cloud TTS (OpenAI)`** in **System Matrix → VOICE** to use OpenAI's deep male `onyx` voice.

---

## 3. AI Provider & Connection Errors

### Symptom: `"API Key is required for Google Gemini / OpenAI / Custom Endpoint"`
- **Cause**: No API key has been saved for the currently selected provider in `CredentialVault`.
- **Fix**:
  1. Open **System Matrix → AI LINK**.
  2. Select your provider (`GEMINI`, `OPENAI`, or `CUSTOM`).
  3. Paste or enter your API key and tap **`SAVE KEY`** (verify that `VAULT:` changes from `UNSET` to a masked key preview like `AIza••••9x2Q`).
  4. Tip for easy key entry on a physical watch: Tap the API Key text field on the watch so the cursor is focused, then run from your computer:
     ```bash
     adb shell input text "YOUR_API_KEY_HERE"
     ```
     Then tap **`SAVE KEY`** on the watch.

### Symptom: `"Custom Endpoint Base URL must use https:// (cleartext HTTP is disabled on Wear OS)."`
- **Cause**: A cleartext `http://` URL was entered for the Custom provider. Both `AiPayloadCodec.validateHttpsBaseUrl(...)` and Android's `android:usesCleartextTraffic="false"` policy block cleartext HTTP to protect your API key in transit.
- **Fix**: Use a valid `https://` endpoint (e.g., `https://openrouter.ai/api/v1`).

---

## 4. Build & Android Studio Issues

### Symptom: `Unsupported Java. Your build is currently configured to use Java 11 / 21`
- **Cause**: Android Gradle Plugin `8.6.1` requires **JDK 17**.
- **Fix**: In Android Studio, open **Settings → Build, Execution, Deployment → Build Tools → Gradle** and set **Gradle JDK** to **jbr-17** (JetBrains Runtime 17) or **Temurin 17**.
