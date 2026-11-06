# Building & Installing J.A.R.V.I.S. for Wear OS

This guide explains how to build, test, and install **J.A.R.V.I.S. for Wear OS** (`com.jarvis.wear`, baseline V6) on a physical smartwatch or Wear OS emulator.

---

## 1. Prerequisites

| Requirement | Version / Specification |
| :--- | :--- |
| **Android Studio** | Ladybug (`2024.2.1`) or newer recommended |
| **Java Development Kit (JDK)** | **JDK 17** (Temurin / JetBrains Runtime 17) |
| **Android Gradle Plugin (AGP)** | `8.6.1` (with Gradle `8.7`) |
| **Kotlin Version** | `1.9.24` (with KSP `1.9.24-1.0.20`) |
| **Android SDK Platforms** | `compileSdk = 35`, `targetSdk = 34`, `minSdk = 30` (Wear OS 3.0 / Android 11) |

---

## 2. Opening the Project in Android Studio

1. Clone the repository:
   ```bash
   git clone https://github.com/siddiqui-furqan/jarvis-for-wear-os.git
   cd jarvis-for-wear-os
   ```
2. In Android Studio, select **File → Open**:
   - If you cloned the full workspace containing both the Android project and browser simulator, open the **`jarvis-wearos-android/`** directory.
   - If you exported the standalone Android Studio project root directly, open the repository root directory (where `settings.gradle.kts` and `app/` are located).
3. Wait for Gradle Sync to download the AndroidX, Wear Compose, Room, and OkHttp dependencies.
4. Confirm the Gradle JDK is set to **17** in **Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK**.

---

## 3. Command-Line Gradle Builds & Unit Tests

Navigate to the directory containing `settings.gradle.kts` (`cd jarvis-wearos-android` if at the full workspace root):

### Run Pure Kotlin Unit Tests (`JarvisUnitTests.kt`)
```bash
chmod +x ./gradlew
./gradlew testDebugUnitTest
```
Test reports are generated at:
`app/build/reports/tests/testDebugUnitTest/index.html`

### Assemble Debug APK
```bash
./gradlew assembleDebug
```
The signed debug APK (`com.jarvis.wear.debug`) is output to:
`app/build/outputs/apk/debug/app-debug.apk`

### Assemble Minified Release APK
```bash
./gradlew assembleRelease
```
> **Note on Release Signing**: By default, `app/build.gradle.kts` uses the debug signing config for local `assembleRelease` builds so contributors can test R8 minification (`isMinifyEnabled = true`, `isShrinkResources = true`) out of the box. Before publishing to Google Play or distributing production APKs, configure your own release keystore via `keystore.properties` (which is excluded by `.gitignore`).

---

## 4. Installing on a Physical Samsung Galaxy Watch 4 (`SM-R860`) Over Wi-Fi ADB

1. **Enable Developer Options on the Watch**:
   - Open **Watch Settings → About watch → Software info**.
   - Tap **Software version** 7 times until *"Developer mode turned on"* appears.
2. **Enable Wireless Debugging**:
   - Return to **Watch Settings → Developer options**.
   - Enable **ADB debugging** and open **Wireless debugging**.
   - Make sure your computer and Galaxy Watch 4 are connected to the same Wi-Fi network.
3. **Pair and Connect via ADB**:
   - In **Wireless debugging** on the watch, tap **Pair new device** to view the pairing IP, port, and 6-digit code:
     ```bash
     adb pair <WATCH_IP>:<PAIRING_PORT>
     ```
   - Connect to the main Wireless Debugging IP and port displayed on the watch:
     ```bash
     adb connect <WATCH_IP>:<CONNECTION_PORT>
     adb devices
     ```
4. **Install the Debug APK**:
   ```bash
   adb -s <WATCH_IP>:<CONNECTION_PORT> install -r app/build/outputs/apk/debug/app-debug.apk
   ```
5. **Grant Microphone Permission**:
   - Launch **J.A.R.V.I.S.** from the watch app drawer and tap **While using the app** when prompted for microphone access, or grant it via ADB:
     ```bash
     adb -s <WATCH_IP>:<CONNECTION_PORT> shell pm grant com.jarvis.wear.debug android.permission.RECORD_AUDIO
     ```

---

## 5. Running on a Wear OS Round Emulator

1. In Android Studio, open **Tools → Device Manager → Create Virtual Device**.
2. Choose **Wear OS → Wear OS Small Round** (`384 × 384` or custom `396 × 396`, `xhdpi`) or **Wear OS Large Round** (`454 × 454`).
3. Select a **Wear OS 3 (API 30)** or **Wear OS 4 (API 33/34)** system image.
4. Click **Run 'app'** (`Shift + F10`). To test microphone input on the emulator, enable **Virtual microphone uses host audio input** in the emulator's **Extended Controls (`...`) → Microphone**.
