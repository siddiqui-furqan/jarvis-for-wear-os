# Third-Party Notices, Licensing & Branding Review

**J.A.R.V.I.S. for Wear OS (`jarvis-for-wear-os`)** is licensed under the [Apache License, Version 2.0](./LICENSE).

This document lists all third-party open-source dependencies, bundled resource assets, and unresolved trademark/branding considerations.

---

## 1. Native Android / Wear OS Dependencies (`jarvis-wearos-android`)

| Component | Maven Coordinates | Version | License | Upstream Project |
| :--- | :--- | :--- | :--- | :--- |
| **AndroidX Core KTX** | `androidx.core:core-ktx` | `1.13.1` | Apache-2.0 | [Android Open Source Project](https://developer.android.com/jetpack/androidx) |
| **AndroidX Activity Compose** | `androidx.activity:activity-compose` | `1.9.1` | Apache-2.0 | [Android Open Source Project](https://developer.android.com/jetpack/androidx/releases/activity) |
| **AndroidX Wear** | `androidx.wear:wear` | `1.3.0` | Apache-2.0 | [Android Open Source Project](https://developer.android.com/jetpack/androidx/releases/wear) |
| **Jetpack Compose BOM & UI** | `androidx.compose:compose-bom` | `2024.06.00` | Apache-2.0 | [Android Open Source Project](https://developer.android.com/jetpack/compose) |
| **Compose for Wear OS Foundation & Navigation** | `androidx.wear.compose:compose-foundation`, `compose-navigation` | `1.3.1` | Apache-2.0 | [Android Open Source Project](https://developer.android.com/training/wearables/compose) |
| **Compose for Wear OS Material 3** | `androidx.wear.compose:compose-material3` | `1.0.0-alpha24` | Apache-2.0 | [Android Open Source Project](https://developer.android.com/jetpack/androidx/releases/wear-compose) |
| **AndroidX Lifecycle & ViewModel Compose** | `androidx.lifecycle:lifecycle-*` | `2.8.4` | Apache-2.0 | [Android Open Source Project](https://developer.android.com/jetpack/androidx/releases/lifecycle) |
| **AndroidX Room Runtime & KTX** | `androidx.room:room-runtime`, `room-ktx`, `room-compiler` | `2.6.1` | Apache-2.0 | [Android Open Source Project](https://developer.android.com/jetpack/androidx/releases/room) |
| **AndroidX Security Crypto** | `androidx.security:security-crypto` | `1.1.0-alpha06` | Apache-2.0 | [Android Open Source Project](https://developer.android.com/jetpack/androidx/releases/security) |
| **Kotlin Standard Library & Coroutines** | `org.jetbrains.kotlinx:kotlinx-coroutines-android` | `1.8.1` | Apache-2.0 | [JetBrains s.r.o.](https://github.com/Kotlin/kotlinx.coroutines) |
| **OkHttp** | `com.squareup.okhttp3:okhttp` | `4.12.0` | Apache-2.0 | [Square, Inc.](https://square.github.io/okhttp/) |
| **Gradle Wrapper (`gradle-wrapper.jar`)** | `org.gradle.wrapper` | `8.7` | Apache-2.0 | [Gradle, Inc.](https://gradle.org/) |
| **JUnit 4** (Test Scope) | `junit:junit` | `4.13.2` | EPL-1.0 | [JUnit Team](https://junit.org/junit4/) |
| **org.json** (Test Scope) | `org.json:json` | `20240303` | JSON License | [JSON.org](https://github.com/stleary/JSON-java) |

---

## 2. Bundled Application Assets (`jarvis-wearos-android/app/src/main/res/`)

- **Vector Drawables (`res/drawable/ic_launcher_foreground.xml`, `ic_launcher_background.xml`)**: Original geometric vector XML paths created specifically for this project.
- **Mipmap Icons (`res/mipmap-mdpi` through `res/mipmap-xxxhdpi`)**: Programmatically rasterized geometric rings generated from the project's vector launcher icon.
- **Fonts**: The native Wear OS application uses standard Android system font families (`FontFamily.SansSerif` and `FontFamily.Monospace` in `ui/theme/Type.kt`) and bundles no third-party font files.
- **Audio**: No pre-recorded sound effects or copyrighted voice samples are bundled; all spoken output is generated dynamically at runtime via the device's `android.speech.tts.TextToSpeech` engine or user-configured OpenAI TTS API.

---

## 3. Optional Browser Simulator Dependencies (`src/`, `server.ts`)

| Component | Package | License | Upstream Project |
| :--- | :--- | :--- | :--- |
| **React & React DOM** | `react`, `react-dom` | MIT | [Meta Platforms, Inc.](https://react.dev/) |
| **Lucide Icons** | `lucide-react` | ISC | [Lucide Contributors](https://lucide.dev/license) |
| **Google Gen AI SDK** | `@google/genai` | Apache-2.0 | [Google LLC](https://github.com/googleapis/js-genai) |
| **Tailwind CSS** | `tailwindcss`, `@tailwindcss/vite` | MIT | [Tailwind Labs, Inc.](https://tailwindcss.com/) |
| **Express** | `express` | MIT | [OpenJS Foundation](https://expressjs.com/) |
| **Web Fonts (Loaded via `fonts.googleapis.com` in `index.html`)** | `Chakra Petch`, `JetBrains Mono`, `Plus Jakarta Sans` | SIL Open Font License 1.1 | [Google Fonts](https://fonts.google.com/) |

---

## 4. Trademark, Branding & Legal Review Notice

1. **No Affiliation**: **J.A.R.V.I.S. for Wear OS** is an independent open-source project created by **Furqan Siddiqui** (`https://github.com/siddiqui-furqan`). It is **not** affiliated with, endorsed by, sponsored by, or associated with Marvel Characters, Inc., Marvel Studios, The Walt Disney Company, Samsung Electronics Co., Ltd., Google LLC, or OpenAI, L.L.C.
2. **Potential Trademark Considerations (Unresolved for Commercial/Store Distribution)**:
   - While all source code, Compose Canvas geometries (`ArcReactorCanvas.kt`), and vector launcher icons (`ic_launcher_foreground.xml`) in this repository are original works licensed under Apache-2.0, the name **"J.A.R.V.I.S."**, the term **"Arc Reactor"**, and theme/persona labels referencing **"Stark"** (`Stark Witty`, `StarkCyan`, `Mark I–III`) are associated with Marvel / Disney intellectual property in popular culture.
   - **No legal clearance is claimed or implied.** While publishing the source code on GitHub as an independent, non-commercial, fan-inspired open-source project with clear disclaimers is common practice, distributing binary builds on commercial app stores (such as Google Play) under the name `J.A.R.V.I.S.` may face trademark or store-policy objections unless those user-facing names are rebranded.
