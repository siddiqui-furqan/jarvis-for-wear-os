package com.jarvis.wear.data.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.concurrent.ConcurrentHashMap

interface SecureKeyValueStore {
    fun putString(key: String, value: String)
    fun getString(key: String): String?
    fun clearAll()
}

/**
 * Hardware-backed Android Keystore Credential Vault for J.A.R.V.I.S. for Wear OS (V6).
 *
 * Security Guarantees:
 * 1. Primary persistence uses `EncryptedSharedPreferences` (`AES256_SIV` keys, `AES256_GCM` values)
 *    backed by an Android Keystore `MasterKey` (`AES256_GCM`).
 * 2. If the Keystore master key is invalidated (e.g. after a system firmware update or reset),
 *    the unreadable encrypted file is deleted and `EncryptedSharedPreferences` initialization is retried once.
 * 3. Fail-Closed Disk Policy: If `EncryptedSharedPreferences` fails a second time, credentials are held
 *    ONLY in a volatile in-memory map (`ConcurrentHashMap`) for the current process session
 *    (`isHardwareEncrypted = false`, `isPersistentStorageAvailable = false`).
 *    API keys are NEVER written to plaintext `SharedPreferences` on disk.
 */
class CredentialVault(private val store: SecureKeyValueStore) {

    constructor(context: Context) : this(AndroidKeystorePreferencesStore(context.applicationContext))

    fun saveApiKey(providerId: String, apiKey: String) {
        val clean = apiKey.trim()
        store.putString(keyForProvider(providerId), clean)
    }

    fun getApiKey(providerId: String): String {
        val normalized = providerId.lowercase()
        val stored = store.getString(keyForProvider(normalized))?.trim().orEmpty()
        if (stored.isNotEmpty()) return stored
        // Read-only lookup from legacy "openrouter" encrypted slot if upgrading from V3
        if (normalized == "custom") {
            return store.getString(keyForProvider("openrouter"))?.trim().orEmpty()
        }
        return ""
    }

    fun hasApiKey(providerId: String): Boolean {
        return getApiKey(providerId).isNotBlank()
    }

    fun getMaskedApiKey(providerId: String): String {
        val raw = getApiKey(providerId)
        if (raw.isBlank()) return "UNSET"
        if (raw.length <= 8) return "••••••••"
        return "${raw.take(4)}••••${raw.takeLast(4)}"
    }

    fun saveBaseUrl(providerId: String, baseUrl: String) {
        val clean = baseUrl.trim().trimEnd('/')
        store.putString("base_url_${providerId.lowercase()}", clean)
    }

    fun getBaseUrl(providerId: String): String {
        val normalized = providerId.lowercase()
        val custom = store.getString("base_url_$normalized")?.trim().orEmpty()
        if (custom.isNotBlank()) return custom.trimEnd('/')
        return when (normalized) {
            "openai" -> "https://api.openai.com/v1"
            "gemini" -> "https://generativelanguage.googleapis.com/v1beta"
            "custom" -> ""
            else -> ""
        }
    }

    fun clearCredentialsForProvider(providerId: String) {
        val normalized = providerId.lowercase()
        store.putString(keyForProvider(normalized), "")
        if (normalized == "custom") {
            store.putString("base_url_custom", "")
            store.putString(keyForProvider("openrouter"), "")
        }
    }

    fun clearAllCredentials() {
        store.clearAll()
    }

    val isHardwareEncrypted: Boolean
        get() = (store as? AndroidKeystorePreferencesStore)?.hardwareBacked ?: true

    val isPersistentStorageAvailable: Boolean
        get() = (store as? AndroidKeystorePreferencesStore)?.persistentEncryptedAvailable ?: true

    private fun keyForProvider(providerId: String): String =
        "api_key_${providerId.lowercase()}"
}

private class AndroidKeystorePreferencesStore(context: Context) : SecureKeyValueStore {
    private val appContext = context.applicationContext
    private val volatileMemoryFallback = ConcurrentHashMap<String, String>()

    var hardwareBacked: Boolean = true
        private set

    var persistentEncryptedAvailable: Boolean = true
        private set

    private val encryptedPrefs: SharedPreferences? by lazy {
        initEncryptedPreferencesOrNull()
    }

    private fun createEncryptedPrefs(): SharedPreferences {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        return EncryptedSharedPreferences.create(
            appContext,
            VAULT_FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private fun initEncryptedPreferencesOrNull(): SharedPreferences? {
        // Ensure no legacy plaintext fallback file exists on disk
        runCatching {
            appContext.deleteSharedPreferences("${VAULT_FILE_NAME}_fallback")
        }

        return try {
            createEncryptedPrefs()
        } catch (_: Exception) {
            // If Android Keystore master key was invalidated, delete the unreadable encrypted file and retry once.
            runCatching {
                appContext.deleteSharedPreferences(VAULT_FILE_NAME)
            }
            try {
                createEncryptedPrefs()
            } catch (_: Exception) {
                // Fail-closed for disk persistence: never write plaintext API keys to SharedPreferences on flash storage.
                hardwareBacked = false
                persistentEncryptedAvailable = false
                null
            }
        }
    }

    override fun putString(key: String, value: String) {
        val prefs = encryptedPrefs
        if (prefs != null) {
            prefs.edit().putString(key, value).apply()
        } else {
            volatileMemoryFallback[key] = value
        }
    }

    override fun getString(key: String): String? {
        val prefs = encryptedPrefs
        return if (prefs != null) {
            prefs.getString(key, null)
        } else {
            volatileMemoryFallback[key]
        }
    }

    override fun clearAll() {
        volatileMemoryFallback.clear()
        encryptedPrefs?.edit()?.clear()?.apply()
    }

    companion object {
        private const val VAULT_FILE_NAME = "jarvis_encrypted_keystore_vault"
    }
}
