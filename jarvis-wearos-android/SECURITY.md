# Security Policy

## Supported Versions

| Version | Baseline | Supported | Target Platform |
| :--- | :--- | :--- | :--- |
| `6.0.x` | V6 Circular UI & Responsive Architecture | Yes | Wear OS 3.0+ (API 30–34) |
| `< 6.0.0` | V1–V5 Prototypes & Baselines | No | Superseded by V6 |

---

## Security & Privacy Architecture

**J.A.R.V.I.S. for Wear OS** (`com.jarvis.wear`) is a standalone, Bring-Your-Own-Key (BYOK) Wear OS assistant. It does not operate a proprietary backend telemetry server or collect user analytics.

### 1. API Key Storage (`CredentialVault.kt`)
- **Primary Encrypted Storage**: On Wear OS hardware (API 30+), user-entered API keys for Google Gemini, OpenAI, and Custom OpenAI-compatible providers are stored locally using `androidx.security.crypto.EncryptedSharedPreferences` backed by an Android Keystore `MasterKey` (`AES256_GCM` key scheme, `AES256_SIV` key encryption, `AES256_GCM` value encryption) inside `jarvis_encrypted_keystore_vault`.
- **Keystore Invalidation Recovery**: If the hardware-backed Android Keystore master key becomes invalidated (for example, after an OS firmware update or keystore reset), `CredentialVault` deletes the unreadable encrypted preference file and retries `EncryptedSharedPreferences.create(...)` once. Any legacy plaintext fallback preference file (`jarvis_encrypted_keystore_vault_fallback`) is also deleted on initialization.
- **Fail-Closed Disk Policy (No Plaintext Disk Fallback)**: If `EncryptedSharedPreferences.create(...)` fails a second time, `CredentialVault` **never** falls back to plaintext `SharedPreferences` on disk. Instead, it holds credentials strictly in a volatile in-memory map (`ConcurrentHashMap<String, String>`) for the active process session only (`isHardwareEncrypted = false`, `isPersistentStorageAvailable = false`).
- **UI & Error Masking**:
  - Saved keys are masked in the UI (`getMaskedApiKey()` shows only the first 4 and last 4 characters, or `••••••••` for keys of 8 characters or fewer).
  - All provider network exceptions pass through `AiPayloadCodec.sanitizeThrowable(...)` and `AiPayloadCodec.sanitizeErrorMessage(...)`, which redact any occurrence of the active API key (`[REDACTED_KEY]`) before surfacing error strings.
  - Users can wipe the active provider's key (`Forget Key`) or purge all stored credentials (`Purge All Keys`) at any time from **System Matrix → AI Link**.

### 2. Local Data Storage & Backup Restrictions (`ConversationDatabase.kt` & `AndroidManifest.xml`)
- **Backup & Data Extraction Exclusion**: `AndroidManifest.xml` enforces `android:allowBackup="false"`, `android:fullBackupContent="@xml/backup_rules"`, and `android:dataExtractionRules="@xml/data_extraction_rules"`, explicitly excluding both `sharedpref` and `database` domains from cloud backups and Android 12+ device-to-device transfers.
- **Unencrypted SQLite History Limitation**: While the local Room SQLite database (`jarvis_wear_dialogue.db`) resides inside the private Android application sandbox (`Context.MODE_PRIVATE`, inaccessible to other non-root apps), the SQLite database file itself is **not** encrypted with SQLCipher. Users on rooted devices should be aware that local conversation history is stored in standard SQLite format until cleared via **System Matrix → Memory → Clear Conversation Logs** or by voice command (`"Clear conversation history"`).

### 3. Network Transport (`AiProvider.kt` & `AndroidManifest.xml`)
- **OS-Level Cleartext Block**: `android:usesCleartextTraffic="false"` is declared on `<application>` in `AndroidManifest.xml`.
- **Strict HTTPS Validation**: `AiPayloadCodec.validateHttpsBaseUrl(...)` validates via `java.net.URI` that all custom or overridden Base URLs use the `https://` scheme with a non-empty host across both chat completion and model discovery requests.
- **Header-Based Authentication**:
  - `GeminiProvider` transmits the API key in the `x-goog-api-key` HTTP request header rather than the URL query string.
  - `OpenAiProvider` and `CustomOpenAiCompatibleProvider` transmit the API key in the `Authorization: Bearer` HTTP request header.

### 4. Device Control Safeguards (`DeviceControlManager.kt`)
- Voice commands are matched deterministically by `VoiceActionParser` against a fixed enum (`VoiceActionType`) rather than executing arbitrary shell or reflection commands.
- Disruptive actions—specifically enabling **Do Not Disturb** (`CONTROL_DND`) and deleting conversation history (`CLEAR_HISTORY`)—require explicit user confirmation (`requiresConfirmation = true`) before execution.
- Restricted system toggles (Bluetooth, Wi-Fi, and ungranted Notification Policy Access) perform an explicit intent handoff to the official Wear OS system settings panel.

---

## Reporting a Vulnerability

If you discover a security vulnerability in **J.A.R.V.I.S. for Wear OS**:

1. **Do not open a public GitHub issue** containing exploit details or live credentials.
2. Report the issue privately via GitHub Security Advisories on the repository or contact the maintainer (`@siddiqui-furqan`).
3. Include the affected file path, reproduction steps, and suggested remediation.
