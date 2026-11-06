# AI Provider, Voice & Device Configuration Guide

**J.A.R.V.I.S. for Wear OS** is a standalone Bring-Your-Own-Key (BYOK) application. All AI providers, models, voice synthesizers, and persona settings are configured directly on the watch inside **System Matrix** (the gear button at the bottom-right of the Home screen).

---

## 1. AI Link Configuration (`System Matrix → AI LINK`)

J.A.R.V.I.S. supports three independent AI provider slots. Each provider slot remembers its own **API Key**, **Model ID**, and (for Custom) **Base URL** across provider switches and watch restarts.

### 1.1 Google Gemini (`providerId = "gemini"`)
- **Default Endpoint**: `https://generativelanguage.googleapis.com/v1beta`
- **Default Model ID**: `gemini-2.5-flash`
- **Dynamic Model Discovery**:
  - Save your Google AI Studio Gemini API Key first (`SAVE KEY`), then tap **`↻ DISCOVER GEMINI MODELS`**.
  - The watch queries `GET /v1beta/models` (passing your key in the `x-goog-api-key` HTTP header), filters out deprecated 1.0 and embedding-only models, and populates a selectable list of `generateContent`-capable models.
- **Manual Model Entry**: You can also type any supported Gemini or Gemma model ID manually (e.g., `gemini-2.5-pro`, `gemini-2.5-flash-lite`, `gemma-3-27b-it`).
- **Capability Handling**: Models that do not support `systemInstruction` (such as `gemma-*`) automatically receive the J.A.R.V.I.S. persona directive in the initial conversation turn (`AiPayloadCodec.buildGeminiPayload`).

### 1.2 OpenAI (`providerId = "openai"`)
- **Default Endpoint**: `https://api.openai.com/v1`
- **Built-in Selectable Models**:
  - `gpt-4o-mini` (Default — low latency for wrist interactions)
  - `gpt-4o`
  - `gpt-4.1-mini`
  - `gpt-4.1`
  - `o3-mini` (Reasoning model)
- **Live `/v1/models` Refresh**: Tap **`↻ REFRESH MODEL LIST`** after saving an OpenAI key to query your organization's live `/v1/models` list.
- **Reasoning Model Support**: `AiPayloadCodec.isReasoningModel(...)` automatically detects `o1`, `o3`, `o4`, and `gpt-5` model families and formats requests with the `"developer"` role and `max_completion_tokens` instead of `"system"` + `temperature` + `max_tokens`.

### 1.3 Custom OpenAI-Compatible Provider (`providerId = "custom"`)
Connects to any third-party or self-hosted gateway that implements the OpenAI `/chat/completions` JSON schema over HTTPS:
- **Required Fields**:
  1. **Base URL**: Must start with `https://` and include a valid host (cleartext `http://` is disabled at both the validator and Android OS `usesCleartextTraffic="false"` levels).
     - *OpenRouter example*: `https://openrouter.ai/api/v1`
     - *Groq example*: `https://api.groq.com/openai/v1`
     - *DeepSeek example*: `https://api.deepseek.com/v1`
     - *Mistral example*: `https://api.mistral.ai/v1`
  2. **Model ID**: Exact upstream model identifier (e.g., `openai/gpt-4o-mini`, `anthropic/claude-3.7-sonnet`, `llama-3.3-70b-versatile`).
  3. **API Key**: Bearer token for your chosen endpoint.
- **Testing Your Configuration**: Tap **`⚡ TEST CONNECTION`** to verify the Base URL, Model ID, and API Key before returning to the Home screen.

---

## 2. Voice & Home Captions (`System Matrix → VOICE`)

### 2.1 Home Screen Response Captions
- **Setting**: `Home Screen Captions` (`ENABLED` by default).
- **Behavior**: Displays a compact 2-line caption above the bottom orbital dock while J.A.R.V.I.S. is speaking (`SPEAKING`) and after finishing (`IDLE`). Automatically clears as soon as a new `LISTENING` or `PROCESSING` cycle begins.

### 2.2 British Male Voice Selection (`JarvisVoiceSelector`)
- On the Samsung Galaxy Watch 4, the default offline TTS voice is often a female voice (`en-gb-x-fis-local` or Samsung `smtl02`).
- `TextToSpeechManager` binds preferentially to Google Speech Services (`com.google.android.tts`), enumerates all installed English voices, and scores British Male voices (`en-gb-x-rjs`, `en-gb-x-gbd`, `en-gb-x-gbb`, `smtl01`, `smtl03`) highest.
- **Install High-Quality UK Male Voices on Your Watch**:
  - Open **Watch Settings → General → Text-to-speech → Preferred engine → Speech Recognition & Synthesis from Google → Settings → Install voice data → English (United Kingdom)** and download a male voice pack (`rjs` or `gbd`).
- **Automatic Pitch Compensation**: If your watch only has a female or gender-neutral offline voice installed, `JarvisVoiceSelector` automatically applies a lower-resonance pitch multiplier (`0.84x–0.90x`).
- **Neural Cloud TTS (Optional)**: When using the `OpenAI` provider with `Neural Cloud TTS (OpenAI)` enabled, J.A.R.V.I.S. synthesizes speech via OpenAI's `tts-1` model (`onyx` voice) and falls back seamlessly to local on-watch TTS if offline.

---

## 3. Reactor Themes & Persona (`System Matrix → REACTOR` & `PERSONA`)

- **Arc Reactor Themes**:
  - `Mark I — Classic`: Original palladium ring with copper/cyan segments
  - `Mark II — Triangular`: High-output triangular core geometry (Default)
  - `Mark III — Segmented`: Heavy tactical 12-segment turbine ring
  - `Mark LXXXV — Nanotech`: Fluid hexagonal nanotech lattice
- **Persona Profiles**:
  - `Stark Witty` (`stark_classic`): Refined British executive assistant with dry wit (1–3 sentences)
  - `Tactical HUD` (`tactical_hud`): Ultra-concise telemetry and tactical answers (1–2 sentences)
  - `Formal Butler` (`formal_butler`): Polite executive protocol (<40 words)
  - Plus an optional **Custom Directives** text field appended to the system prompt.
