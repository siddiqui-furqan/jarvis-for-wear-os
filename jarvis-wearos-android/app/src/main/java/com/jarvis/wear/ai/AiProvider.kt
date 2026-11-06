package com.jarvis.wear.ai

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class ChatTurn(
    val role: String, // "user" or "assistant"
    val content: String
)

data class AiRequestConfig(
    val providerId: String,
    val apiKey: String,
    val modelName: String,
    val baseUrl: String,
    val systemPrompt: String
)

data class DiscoveredModel(
    val id: String,
    val displayName: String,
    val description: String = "",
    val supportsSystemInstruction: Boolean = true
)

interface AiProvider {
    val providerId: String
    val displayName: String

    suspend fun sendMessage(
        prompt: String,
        history: List<ChatTurn>,
        config: AiRequestConfig
    ): Result<String>

    suspend fun testConnection(config: AiRequestConfig): Result<String>

    suspend fun discoverModels(config: AiRequestConfig): Result<List<DiscoveredModel>>
}

/**
 * Pure JSON payload builder, capability router, and response parser for OpenAI, Google Gemini,
 * and Custom OpenAI-compatible endpoints (OpenRouter, Groq, DeepSeek, local servers, etc.).
 * Extracted as a pure object so it can be unit-tested deterministically without network calls.
 */
object AiPayloadCodec {

    /**
     * Validates that a Base URL strictly uses `https://` with a valid non-empty host.
     * Matches `android:usesCleartextTraffic="false"` enforced in `AndroidManifest.xml`.
     */
    fun validateHttpsBaseUrl(rawUrl: String, providerLabel: String = "Custom Endpoint"): Result<String> {
        val url = rawUrl.trim().trimEnd('/')
        if (url.isBlank()) {
            return Result.failure(
                IllegalArgumentException("Base URL is required for $providerLabel (e.g. https://openrouter.ai/api/v1).")
            )
        }
        if (!url.startsWith("https://", ignoreCase = true)) {
            return Result.failure(
                IllegalArgumentException("$providerLabel Base URL must use https:// (cleartext HTTP is disabled on Wear OS).")
            )
        }
        return try {
            val uri = java.net.URI(url)
            val host = uri.host
            if (!uri.scheme.equals("https", ignoreCase = true) || host.isNullOrBlank()) {
                Result.failure(IllegalArgumentException("$providerLabel Base URL must include a valid HTTPS host."))
            } else {
                Result.success(url)
            }
        } catch (_: Exception) {
            Result.failure(IllegalArgumentException("$providerLabel Base URL is malformed."))
        }
    }

    /**
     * Validates provider configuration before dispatching a request or connection test.
     * Returns a descriptive failure if Base URL, Model ID, or API Key is invalid or missing.
     */
    fun validateProviderConfig(config: AiRequestConfig): Result<Unit> {
        val providerLabel = when (config.providerId.lowercase()) {
            "gemini" -> "Google Gemini"
            "openai" -> "OpenAI"
            "custom" -> "Custom Endpoint"
            else -> config.providerId.uppercase()
        }

        if (config.providerId.equals("custom", ignoreCase = true) || config.baseUrl.isNotBlank()) {
            validateHttpsBaseUrl(config.baseUrl, providerLabel).onFailure {
                return Result.failure(it)
            }
        }

        val cleanModel = config.modelName.trim()
        if (cleanModel.isBlank()) {
            return Result.failure(IllegalArgumentException("Model ID is required for $providerLabel."))
        }

        if (config.apiKey.trim().isBlank()) {
            return Result.failure(IllegalArgumentException("API Key is required for $providerLabel."))
        }

        return Result.success(Unit)
    }

    /**
     * Redacts any accidental occurrence of the user's API key from network or HTTP error messages.
     */
    fun sanitizeErrorMessage(rawMessage: String?, apiKey: String): String {
        val base = rawMessage?.trim().orEmpty().ifEmpty { "Network communication fault." }
        val cleanKey = apiKey.trim()
        if (cleanKey.length < 4) return base
        return base.replace(cleanKey, "[REDACTED_KEY]")
    }

    /**
     * Rethrows coroutine CancellationException and scrubs any API key from caught exceptions.
     */
    fun sanitizeThrowable(throwable: Throwable, apiKey: String): Throwable {
        if (throwable is kotlinx.coroutines.CancellationException) throw throwable
        val cleanMessage = sanitizeErrorMessage(throwable.message, apiKey)
        return when (throwable) {
            is IllegalArgumentException -> IllegalArgumentException(cleanMessage)
            else -> IOException(cleanMessage)
        }
    }

    /**
     * Detects whether an OpenAI model ID is a reasoning series model (`o1`, `o3`, `o4`, `gpt-5`)
     * that requires `max_completion_tokens` and `developer` role instead of `max_tokens` + `temperature`.
     */
    fun isReasoningModel(modelId: String): Boolean {
        val normalized = modelId.trim().lowercase().substringAfterLast("/")
        return normalized.startsWith("o1") ||
            normalized.startsWith("o3") ||
            normalized.startsWith("o4") ||
            normalized.startsWith("gpt-5")
    }

    fun buildOpenAiCompatiblePayload(
        model: String,
        systemPrompt: String,
        history: List<ChatTurn>,
        userPrompt: String
    ): String {
        val cleanModel = model.trim()
        val reasoning = isReasoningModel(cleanModel)
        val messages = JSONArray()

        if (systemPrompt.isNotBlank()) {
            messages.put(
                JSONObject()
                    .put("role", if (reasoning) "developer" else "system")
                    .put("content", systemPrompt)
            )
        }
        history.forEach { turn ->
            messages.put(
                JSONObject()
                    .put("role", if (turn.role == "assistant") "assistant" else "user")
                    .put("content", turn.content)
            )
        }
        messages.put(
            JSONObject()
                .put("role", "user")
                .put("content", userPrompt)
        )

        val payload = JSONObject()
            .put("model", cleanModel)
            .put("messages", messages)

        if (reasoning) {
            payload.put("max_completion_tokens", 500)
        } else {
            payload.put("temperature", 0.65)
            payload.put("max_tokens", 320)
        }
        return payload.toString()
    }

    fun parseOpenAiCompatibleResponse(rawJson: String): String {
        val root = JSONObject(rawJson)
        if (root.has("error")) {
            val errObj = root.optJSONObject("error")
            val message = errObj?.optString("message") ?: root.optString("error", "API Error")
            throw IOException(message)
        }
        val choices = root.optJSONArray("choices")
            ?: throw IOException("Malformed response: missing 'choices' array.")
        if (choices.length() == 0) {
            throw IOException("AI provider returned an empty choices list.")
        }
        val firstMessage = choices.getJSONObject(0).optJSONObject("message")
            ?: throw IOException("Malformed response: missing 'message' object.")
        return firstMessage.optString("content", "").trim()
    }

    /**
     * Builds a Google Gemini REST payload while respecting model-specific capabilities
     * (e.g. models without `systemInstruction` support receive system context in the first turn).
     */
    fun buildGeminiPayload(
        systemPrompt: String,
        history: List<ChatTurn>,
        userPrompt: String,
        modelId: String = "gemini-2.5-flash"
    ): String {
        val root = JSONObject()
        val cleanModel = modelId.trim().removePrefix("models/").lowercase()
        val supportsSystemInstruction = !cleanModel.startsWith("gemma-")

        if (systemPrompt.isNotBlank() && supportsSystemInstruction) {
            val sysParts = JSONArray().put(JSONObject().put("text", systemPrompt))
            root.put("systemInstruction", JSONObject().put("parts", sysParts))
        }

        val contents = JSONArray()
        if (systemPrompt.isNotBlank() && !supportsSystemInstruction) {
            contents.put(
                JSONObject()
                    .put("role", "user")
                    .put("parts", JSONArray().put(JSONObject().put("text", "[System Directive]: $systemPrompt")))
            )
            contents.put(
                JSONObject()
                    .put("role", "model")
                    .put("parts", JSONArray().put(JSONObject().put("text", "Understood, sir.")))
            )
        }

        history.forEach { turn ->
            val geminiRole = if (turn.role == "assistant") "model" else "user"
            val parts = JSONArray().put(JSONObject().put("text", turn.content))
            contents.put(
                JSONObject()
                    .put("role", geminiRole)
                    .put("parts", parts)
            )
        }

        val userParts = JSONArray().put(JSONObject().put("text", userPrompt))
        contents.put(
            JSONObject()
                .put("role", "user")
                .put("parts", userParts)
        )

        root.put("contents", contents)
        val maxOutTokens = if (cleanModel.contains("pro") || cleanModel.contains("thinking")) 640 else 360
        root.put(
            "generationConfig",
            JSONObject()
                .put("temperature", 0.65)
                .put("maxOutputTokens", maxOutTokens)
        )
        return root.toString()
    }

    fun parseGeminiResponse(rawJson: String): String {
        val root = JSONObject(rawJson)
        if (root.has("error")) {
            val errObj = root.optJSONObject("error")
            val message = errObj?.optString("message") ?: "Gemini API Error"
            throw IOException(message)
        }
        val candidates = root.optJSONArray("candidates")
            ?: throw IOException("Malformed Gemini response: missing 'candidates'.")
        if (candidates.length() == 0) {
            throw IOException("Gemini returned zero candidates.")
        }
        val content = candidates.getJSONObject(0).optJSONObject("content")
            ?: throw IOException("Malformed Gemini response: missing 'content'.")
        val parts = content.optJSONArray("parts")
            ?: throw IOException("Malformed Gemini response: missing 'parts'.")
        val sb = StringBuilder()
        for (i in 0 until parts.length()) {
            val part = parts.getJSONObject(i)
            if (!part.optBoolean("thought", false)) {
                sb.append(part.optString("text", ""))
            }
        }
        val text = sb.toString().trim()
        if (text.isNotEmpty()) return text
        // Fallback if all parts were marked thought or single text part
        for (i in 0 until parts.length()) {
            sb.append(parts.getJSONObject(i).optString("text", ""))
        }
        return sb.toString().trim()
    }

    /**
     * Parses Google's Model Discovery API response (`GET /v1beta/models`) and returns supported
     * generative models (`generateContent`), sorted with newest Gemini models first.
     */
    fun parseGeminiModelDiscoveryResponse(rawJson: String): List<DiscoveredModel> {
        val root = JSONObject(rawJson)
        val modelsArray = root.optJSONArray("models") ?: return emptyList()
        val discovered = mutableListOf<DiscoveredModel>()

        for (i in 0 until modelsArray.length()) {
            val obj = modelsArray.optJSONObject(i) ?: continue
            val rawName = obj.optString("name", "").trim()
            if (rawName.isBlank()) continue
            val id = rawName.removePrefix("models/")

            // Filter out deprecated/legacy 1.0 or embedding-only models
            val methods = obj.optJSONArray("supportedGenerationMethods")
            var supportsGenerateContent = false
            if (methods != null) {
                for (m in 0 until methods.length()) {
                    if (methods.optString(m) == "generateContent") {
                        supportsGenerateContent = true
                        break
                    }
                }
            }
            if (!supportsGenerateContent) continue
            if (id.contains("embedding") || id.contains("aqa") || id.startsWith("gemini-1.0") || id.startsWith("gemini-pro-vision")) {
                continue
            }

            val displayName = obj.optString("displayName", id).ifBlank { id }
            val description = obj.optString("description", "")
            discovered.add(
                DiscoveredModel(
                    id = id,
                    displayName = displayName,
                    description = description,
                    supportsSystemInstruction = !id.startsWith("gemma-")
                )
            )
        }

        return discovered.sortedWith(
            compareByDescending<DiscoveredModel> { it.id.startsWith("gemini-2.5") || it.id.startsWith("gemini-3") }
                .thenByDescending { it.id.contains("flash") }
                .thenBy { it.id }
        )
    }

    /**
     * Parses OpenAI-compatible `/v1/models` response into selectable model descriptors.
     */
    fun parseOpenAiModelDiscoveryResponse(rawJson: String): List<DiscoveredModel> {
        val root = JSONObject(rawJson)
        val dataArray = root.optJSONArray("data") ?: return emptyList()
        val list = mutableListOf<DiscoveredModel>()
        for (i in 0 until dataArray.length()) {
            val item = dataArray.optJSONObject(i) ?: continue
            val id = item.optString("id", "").trim()
            if (id.isBlank()) continue
            if (id.contains("embedding") || id.contains("whisper") || id.contains("tts") || id.contains("dall-e") || id.contains("moderation")) {
                continue
            }
            val name = item.optString("name", id).ifBlank { id }
            list.add(DiscoveredModel(id = id, displayName = name))
        }
        return list.sortedWith(
            compareByDescending<DiscoveredModel> {
                it.id.startsWith("gpt-4o") || it.id.startsWith("gpt-4.1") || it.id.startsWith("o3")
            }.thenBy { it.id }
        )
    }
}

private val sharedHttpClient: OkHttpClient by lazy {
    OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()
}

class OpenAiProvider : AiProvider {
    override val providerId: String = "openai"
    override val displayName: String = "OpenAI"

    companion object {
        val DEFAULT_MODELS = listOf(
            DiscoveredModel("gpt-4o-mini", "GPT-4o Mini", "Fast, low-latency Wear OS assistant model"),
            DiscoveredModel("gpt-4o", "GPT-4o", "Flagship omni model"),
            DiscoveredModel("gpt-4.1-mini", "GPT-4.1 Mini", "Balanced speed and coding/instruction accuracy"),
            DiscoveredModel("gpt-4.1", "GPT-4.1", "High-intelligence non-reasoning model"),
            DiscoveredModel("o3-mini", "o3-mini", "Compact reasoning model (uses max_completion_tokens)")
        )
    }

    override suspend fun sendMessage(
        prompt: String,
        history: List<ChatTurn>,
        config: AiRequestConfig
    ): Result<String> = withContext(Dispatchers.IO) {
        AiPayloadCodec.validateProviderConfig(config).onFailure { return@withContext Result.failure(it) }
        runCatching {
            val endpoint = "${config.baseUrl.ifBlank { "https://api.openai.com/v1" }.trimEnd('/')}/chat/completions"
            val bodyJson = AiPayloadCodec.buildOpenAiCompatiblePayload(
                model = config.modelName.ifBlank { "gpt-4o-mini" },
                systemPrompt = config.systemPrompt,
                history = history,
                userPrompt = prompt
            )
            val request = Request.Builder()
                .url(endpoint)
                .addHeader("Authorization", "Bearer ${config.apiKey.trim()}")
                .addHeader("Content-Type", "application/json")
                .post(bodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()

            sharedHttpClient.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val parsedErr = runCatching { AiPayloadCodec.parseOpenAiCompatibleResponse(raw) }
                        .exceptionOrNull()?.message ?: "HTTP ${response.code}"
                    throw IOException("OpenAI Error: ${AiPayloadCodec.sanitizeErrorMessage(parsedErr, config.apiKey)}")
                }
                AiPayloadCodec.parseOpenAiCompatibleResponse(raw)
            }
        }.recoverCatching { throw AiPayloadCodec.sanitizeThrowable(it, config.apiKey) }
    }

    override suspend fun testConnection(config: AiRequestConfig): Result<String> {
        return sendMessage(
            prompt = "Respond with 'ONLINE' in one word.",
            history = emptyList(),
            config = config
        )
    }

    override suspend fun discoverModels(config: AiRequestConfig): Result<List<DiscoveredModel>> =
        withContext(Dispatchers.IO) {
            if (config.apiKey.isBlank()) {
                return@withContext Result.success(DEFAULT_MODELS)
            }
            if (config.baseUrl.isNotBlank()) {
                AiPayloadCodec.validateHttpsBaseUrl(config.baseUrl, "OpenAI").onFailure {
                    return@withContext Result.failure(it)
                }
            }
            runCatching {
                val endpoint = "${config.baseUrl.ifBlank { "https://api.openai.com/v1" }.trimEnd('/')}/models"
                val request = Request.Builder()
                    .url(endpoint)
                    .addHeader("Authorization", "Bearer ${config.apiKey.trim()}")
                    .get()
                    .build()

                sharedHttpClient.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    if (!response.isSuccessful) {
                        return@use DEFAULT_MODELS
                    }
                    val parsed = AiPayloadCodec.parseOpenAiModelDiscoveryResponse(raw)
                    if (parsed.isEmpty()) DEFAULT_MODELS else (DEFAULT_MODELS + parsed).distinctBy { it.id }.take(25)
                }
            }.onFailure { if (it is kotlinx.coroutines.CancellationException) throw it }
                .recover { DEFAULT_MODELS }
        }
}

class GeminiProvider : AiProvider {
    override val providerId: String = "gemini"
    override val displayName: String = "Google Gemini"

    override suspend fun sendMessage(
        prompt: String,
        history: List<ChatTurn>,
        config: AiRequestConfig
    ): Result<String> = withContext(Dispatchers.IO) {
        AiPayloadCodec.validateProviderConfig(config).onFailure { return@withContext Result.failure(it) }
        runCatching {
            val base = config.baseUrl.ifBlank { "https://generativelanguage.googleapis.com/v1beta" }.trimEnd('/')
            val model = config.modelName.trim().removePrefix("models/")
            val url = "$base/models/$model:generateContent"
            val bodyJson = AiPayloadCodec.buildGeminiPayload(
                systemPrompt = config.systemPrompt,
                history = history,
                userPrompt = prompt,
                modelId = model
            )
            val request = Request.Builder()
                .url(url)
                .addHeader("x-goog-api-key", config.apiKey.trim())
                .addHeader("Content-Type", "application/json")
                .post(bodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()

            sharedHttpClient.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val parsedErr = runCatching { AiPayloadCodec.parseGeminiResponse(raw) }
                        .exceptionOrNull()?.message ?: "HTTP ${response.code}"
                    throw IOException("Gemini Error: ${AiPayloadCodec.sanitizeErrorMessage(parsedErr, config.apiKey)}")
                }
                AiPayloadCodec.parseGeminiResponse(raw)
            }
        }.recoverCatching { throw AiPayloadCodec.sanitizeThrowable(it, config.apiKey) }
    }

    override suspend fun testConnection(config: AiRequestConfig): Result<String> {
        return sendMessage(
            prompt = "Respond with 'ONLINE' in one word.",
            history = emptyList(),
            config = config
        )
    }

    /**
     * Queries Google's official Model Discovery API (`GET /v1beta/models` with `x-goog-api-key` header)
     * to populate supported Gemini models dynamically without relying on obsolete hardcoded lists.
     */
    override suspend fun discoverModels(config: AiRequestConfig): Result<List<DiscoveredModel>> =
        withContext(Dispatchers.IO) {
            if (config.apiKey.trim().isBlank()) {
                return@withContext Result.failure(
                    IllegalArgumentException("Save your Gemini API Key first or enter a Model ID manually to query Google's Model Discovery API.")
                )
            }
            if (config.baseUrl.isNotBlank()) {
                AiPayloadCodec.validateHttpsBaseUrl(config.baseUrl, "Google Gemini").onFailure {
                    return@withContext Result.failure(it)
                }
            }
            runCatching {
                val base = config.baseUrl.ifBlank { "https://generativelanguage.googleapis.com/v1beta" }.trimEnd('/')
                val url = "$base/models"
                val request = Request.Builder()
                    .url(url)
                    .addHeader("x-goog-api-key", config.apiKey.trim())
                    .get()
                    .build()

                sharedHttpClient.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    if (!response.isSuccessful) {
                        throw IOException("Model Discovery HTTP ${response.code}")
                    }
                    val models = AiPayloadCodec.parseGeminiModelDiscoveryResponse(raw)
                    if (models.isEmpty()) {
                        throw IOException("No compatible generateContent models returned.")
                    }
                    models
                }
            }.recoverCatching { throw AiPayloadCodec.sanitizeThrowable(it, config.apiKey) }
        }
}

/**
 * Custom OpenAI-Compatible Provider (`providerId = "custom"`).
 * Supports any HTTPS OpenAI-compatible API endpoint configured with a user-supplied Base URL,
 * Model ID, and API Key (including OpenRouter, Groq, Together, DeepSeek, Mistral, or HTTPS self-hosted gateways).
 */
class CustomOpenAiCompatibleProvider : AiProvider {
    override val providerId: String = "custom"
    override val displayName: String = "Custom (OpenAI-Compatible)"

    override suspend fun sendMessage(
        prompt: String,
        history: List<ChatTurn>,
        config: AiRequestConfig
    ): Result<String> = withContext(Dispatchers.IO) {
        AiPayloadCodec.validateProviderConfig(config).onFailure { return@withContext Result.failure(it) }
        runCatching {
            val rawBase = config.baseUrl.trim().trimEnd('/')
            val endpoint = if (rawBase.endsWith("/chat/completions")) {
                rawBase
            } else {
                "$rawBase/chat/completions"
            }
            val bodyJson = AiPayloadCodec.buildOpenAiCompatiblePayload(
                model = config.modelName.trim(),
                systemPrompt = config.systemPrompt,
                history = history,
                userPrompt = prompt
            )
            val requestBuilder = Request.Builder()
                .url(endpoint)
                .addHeader("Authorization", "Bearer ${config.apiKey.trim()}")
                .addHeader("Content-Type", "application/json")
                .addHeader("X-Title", "J.A.R.V.I.S. for Wear OS")
                .post(bodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))

            sharedHttpClient.newCall(requestBuilder.build()).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val parsedErr = runCatching { AiPayloadCodec.parseOpenAiCompatibleResponse(raw) }
                        .exceptionOrNull()?.message ?: "HTTP ${response.code}"
                    throw IOException("Custom Endpoint Error: ${AiPayloadCodec.sanitizeErrorMessage(parsedErr, config.apiKey)}")
                }
                AiPayloadCodec.parseOpenAiCompatibleResponse(raw)
            }
        }.recoverCatching { throw AiPayloadCodec.sanitizeThrowable(it, config.apiKey) }
    }

    override suspend fun testConnection(config: AiRequestConfig): Result<String> {
        return sendMessage(
            prompt = "Respond with 'ONLINE' in one word.",
            history = emptyList(),
            config = config
        )
    }

    override suspend fun discoverModels(config: AiRequestConfig): Result<List<DiscoveredModel>> =
        withContext(Dispatchers.IO) {
            val validatedBase = AiPayloadCodec.validateHttpsBaseUrl(config.baseUrl, "Custom Endpoint")
                .getOrElse { return@withContext Result.failure(it) }
            runCatching {
                val modelsUrl = if (validatedBase.endsWith("/chat/completions")) {
                    validatedBase.removeSuffix("/chat/completions") + "/models"
                } else {
                    "$validatedBase/models"
                }
                val builder = Request.Builder().url(modelsUrl).get()
                if (config.apiKey.isNotBlank()) {
                    builder.addHeader("Authorization", "Bearer ${config.apiKey.trim()}")
                }
                sharedHttpClient.newCall(builder.build()).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    if (!response.isSuccessful) {
                        throw IOException("Endpoint returned HTTP ${response.code}")
                    }
                    AiPayloadCodec.parseOpenAiModelDiscoveryResponse(raw).take(30)
                }
            }.recoverCatching { throw AiPayloadCodec.sanitizeThrowable(it, config.apiKey) }
        }
}

class AiRepository {
    private val providers = mapOf(
        "gemini" to GeminiProvider(),
        "openai" to OpenAiProvider(),
        "custom" to CustomOpenAiCompatibleProvider()
    )

    fun getProvider(providerId: String): AiProvider {
        val normalized = if (providerId.equals("openrouter", ignoreCase = true)) "custom" else providerId.lowercase()
        return providers[normalized] ?: providers.getValue("gemini")
    }

    fun getAllProviders(): List<AiProvider> = providers.values.toList()
}
