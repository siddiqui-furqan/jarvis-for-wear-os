import {
  AiProvider,
  ChatMessage,
  DiscoveredModelOption,
  JarvisConfig,
  ReactorTheme,
} from '../../types/index.ts';
import {
  buildJarvisSystemPrompt,
  getJarvisGreeting,
  getSimulatedJarvisResponse,
} from './personality.ts';

const CONFIG_STORAGE_KEY = 'jarvis_watch4_v4_config';
const LEGACY_V2_CONFIG_KEY = 'jarvis_watch4_v2_config';
const HISTORY_STORAGE_KEY = 'jarvis_watch4_v2_history';
const DISMISSED_SUGGESTIONS_KEY = 'jarvis_watch4_v2_dismissed_suggestions';

export const DEFAULT_CONFIG: JarvisConfig = {
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  apiKey: '',
  providerModels: {
    gemini: 'gemini-3.8-flash',
    openai: 'gpt-4o-mini',
    custom: '',
  },
  apiKeys: {
    gemini: '',
    openai: '',
    custom: '',
  },
  customBaseUrl: '',
  personality: 'stark',
  customPersonalityPrompt: '',
  reactorTheme: 'mark_vi',
  aodTheme: 'minimal_reactor',
  speechRate: 1.0,
  speechPitch: 0.92,
  voiceAccent: 'en-GB',
  preferredVoiceURI: '',
  soundFxEnabled: true,
  homeCaptionsEnabled: true,
  hapticsEnabled: true,
  persistentMemoryEnabled: true,
  adaptiveSuggestionsEnabled: true,
  brightness: 100,
  accentIntensity: 'standard',
  animationIntensity: 'full',
};

export const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-jarvis-1',
  role: 'assistant',
  content:
    'At your service, sir. All Galaxy Watch 4 telemetry and Arc Reactor systems are operating at peak efficiency.',
  timestamp: Date.now() - 60000,
  provider: 'gemini',
  model: 'gemini-3.8-flash',
};

/**
 * Selectable OpenAI models (with support for manual custom Model ID entry as well).
 * Gemini models are discovered dynamically via `/api/gemini/models` (Google's Model Discovery API)
 * without retaining obsolete hardcoded model IDs.
 */
export const OPENAI_SELECTABLE_MODELS: DiscoveredModelOption[] = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast low-latency Wear OS model' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Flagship omni model' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Balanced speed & instruction following' },
  { id: 'gpt-4.1', name: 'GPT-4.1', description: 'High-intelligence model' },
  { id: 'o3-mini', name: 'o3-mini', description: 'Compact reasoning model' },
];

export const REACTOR_THEMES: Array<{
  id: ReactorTheme;
  name: string;
  shortLabel: string;
  era: string;
  subtitle: string;
}> = [
  {
    id: 'mark_i',
    name: 'Mark I — Cave Prototype',
    shortLabel: 'MK I',
    era: '2008 Origin',
    subtitle: 'Copper-wound palladium ring',
  },
  {
    id: 'mark_vi',
    name: 'Mark VI — Vibranium Triangle',
    shortLabel: 'MK VI',
    era: 'Stark Expo',
    subtitle: 'Triangular prism core',
  },
  {
    id: 'mark_lxxxv',
    name: 'Mark LXXXV — Endgame Core',
    shortLabel: 'MK 85',
    era: 'Quantum Era',
    subtitle: 'Hexagonal containment lattice',
  },
  {
    id: 'nanotech',
    name: 'Mark L — Bleeding Edge Nano',
    shortLabel: 'NANO',
    era: 'Nanotech',
    subtitle: 'Fluidic multi-node matrix',
  },
];

/**
 * Switches the active AI provider without discarding any provider's previously saved
 * Model ID, Base URL, or API Key.
 */
export function switchProviderPreservingState(
  config: JarvisConfig,
  nextProvider: AiProvider
): JarvisConfig {
  const providerModels = {
    ...DEFAULT_CONFIG.providerModels,
    ...(config.providerModels || {}),
    [config.provider]: config.model,
  };
  const apiKeys = {
    ...DEFAULT_CONFIG.apiKeys,
    ...(config.apiKeys || {}),
    [config.provider]: config.apiKey,
  };
  const restoredModel = providerModels[nextProvider] ?? '';
  const restoredKey = apiKeys[nextProvider] ?? '';

  return {
    ...config,
    provider: nextProvider,
    model: restoredModel,
    apiKey: restoredKey,
    providerModels,
    apiKeys,
  };
}

/**
 * Updates the active provider's Model ID and keeps `providerModels[provider]` synchronized.
 */
export function updateActiveProviderModel(
  config: JarvisConfig,
  newModelId: string
): JarvisConfig {
  return {
    ...config,
    model: newModelId,
    providerModels: {
      ...DEFAULT_CONFIG.providerModels,
      ...(config.providerModels || {}),
      [config.provider]: newModelId,
    },
  };
}

/**
 * Updates the active provider's API Key and keeps `apiKeys[provider]` synchronized.
 */
export function updateActiveProviderApiKey(
  config: JarvisConfig,
  newApiKey: string
): JarvisConfig {
  return {
    ...config,
    apiKey: newApiKey,
    apiKeys: {
      ...DEFAULT_CONFIG.apiKeys,
      ...(config.apiKeys || {}),
      [config.provider]: newApiKey,
    },
  };
}

/**
 * Validates provider configuration for Gemini, OpenAI, and Custom endpoints.
 */
export function validateProviderConfiguration(
  config: JarvisConfig
): { valid: boolean; error?: string } {
  const model = (config.model || '').trim();
  if (!model) {
    return {
      valid: false,
      error: `Model ID is required for ${config.provider.toUpperCase()}.`,
    };
  }

  if (config.provider === 'custom') {
    const baseUrl = (config.customBaseUrl || '').trim();
    if (!baseUrl) {
      return {
        valid: false,
        error: 'Base URL is required for Custom provider (e.g. https://openrouter.ai/api/v1).',
      };
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      return {
        valid: false,
        error: 'Custom Base URL must start with https:// or http://.',
      };
    }
    if (!(config.apiKey || '').trim()) {
      return {
        valid: false,
        error: 'API Key is required for Custom provider.',
      };
    }
  }

  if (config.provider === 'openai' && !(config.apiKey || '').trim()) {
    return {
      valid: false,
      error: 'OpenAI API Key is required. Enter your sk-... key in AI LINK.',
    };
  }

  return { valid: true };
}

/**
 * Formats an OpenAI-compatible chat completions request body while respecting
 * reasoning model requirements (`o1`, `o3`, `o4`, `gpt-5` use `developer` role and `max_completion_tokens`).
 */
export function buildOpenAiCompatibleRequestBody(
  modelId: string,
  systemInstruction: string,
  history: Array<{ role: string; content: string }>,
  prompt: string
): Record<string, unknown> {
  const cleanModel = modelId.trim();
  const shortModel = cleanModel.toLowerCase().split('/').pop() || '';
  const isReasoning =
    shortModel.startsWith('o1') ||
    shortModel.startsWith('o3') ||
    shortModel.startsWith('o4') ||
    shortModel.startsWith('gpt-5');

  const messages = [
    {
      role: isReasoning ? 'developer' : 'system',
      content: systemInstruction,
    },
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    {
      role: 'user',
      content: prompt,
    },
  ];

  if (isReasoning) {
    return {
      model: cleanModel,
      messages,
      max_completion_tokens: 450,
    };
  }

  return {
    model: cleanModel,
    messages,
    temperature: 0.65,
    max_tokens: 280,
  };
}

export function loadStoredConfig(): JarvisConfig {
  try {
    const raw =
      localStorage.getItem(CONFIG_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_V2_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);

    // Migrate legacy "openrouter" provider to "custom"
    const rawProvider: string = parsed.provider || DEFAULT_CONFIG.provider;
    const provider: AiProvider =
      rawProvider === 'openrouter'
        ? 'custom'
        : rawProvider === 'openai' || rawProvider === 'custom'
        ? rawProvider
        : 'gemini';

    const providerModels = {
      ...DEFAULT_CONFIG.providerModels,
      ...(parsed.providerModels || {}),
    };
    const apiKeys = {
      ...DEFAULT_CONFIG.apiKeys,
      ...(parsed.apiKeys || {}),
    };

    if (parsed.model && typeof parsed.model === 'string') {
      providerModels[provider] = parsed.model;
    }
    if (parsed.apiKey && typeof parsed.apiKey === 'string') {
      apiKeys[provider] = parsed.apiKey;
    }

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      provider,
      model: providerModels[provider] || DEFAULT_CONFIG.model,
      apiKey: apiKeys[provider] || '',
      providerModels,
      apiKeys,
      customBaseUrl:
        typeof parsed.customBaseUrl === 'string'
          ? parsed.customBaseUrl
          : rawProvider === 'openrouter'
          ? 'https://openrouter.ai/api/v1'
          : '',
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveStoredConfig(config: JarvisConfig): void {
  try {
    const synced: JarvisConfig = {
      ...config,
      providerModels: {
        ...DEFAULT_CONFIG.providerModels,
        ...(config.providerModels || {}),
        [config.provider]: config.model,
      },
      apiKeys: {
        ...DEFAULT_CONFIG.apiKeys,
        ...(config.apiKeys || {}),
        [config.provider]: config.apiKey,
      },
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(synced));
  } catch (e) {
    console.error('Failed to persist JARVIS config:', e);
  }
}

export function clearStoredConfig(): void {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    localStorage.removeItem(LEGACY_V2_CONFIG_KEY);
  } catch (e) {
    console.error('Failed to clear JARVIS config:', e);
  }
}

export function loadStoredHistory(persistentEnabled: boolean): ChatMessage[] {
  if (!persistentEnabled) {
    return [{ ...INITIAL_WELCOME_MESSAGE }];
  }
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [{ ...INITIAL_WELCOME_MESSAGE }];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [{ ...INITIAL_WELCOME_MESSAGE }];
  } catch {
    return [{ ...INITIAL_WELCOME_MESSAGE }];
  }
}

export function saveStoredHistory(messages: ChatMessage[], persistentEnabled: boolean): void {
  try {
    if (!persistentEnabled) {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      return;
    }
    const trimmed = messages.slice(-40);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to persist conversation history:', e);
  }
}

export function clearStoredHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear conversation history:', e);
  }
}

export function loadDismissedSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_SUGGESTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDismissedSuggestions(ids: string[]): void {
  try {
    localStorage.setItem(DISMISSED_SUGGESTIONS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Queries `/api/gemini/models` to dynamically discover supported Gemini models
 * from Google's Model Discovery API without hardcoded obsolete model lists.
 */
export async function discoverProviderModels(
  config: JarvisConfig
): Promise<{ models: DiscoveredModelOption[]; message?: string }> {
  if (config.provider === 'gemini') {
    const res = await fetch('/api/gemini/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: config.apiKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.models) && data.models.length > 0) {
      return { models: data.models, message: data.message };
    }
    return { models: [], message: data.message || 'No models returned.' };
  }

  if (config.provider === 'openai') {
    if (!config.apiKey.trim()) {
      return {
        models: OPENAI_SELECTABLE_MODELS,
        message: 'Loaded supported OpenAI model list.',
      };
    }
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${config.apiKey.trim()}` },
      });
      if (!res.ok) {
        return { models: OPENAI_SELECTABLE_MODELS };
      }
      const data = await res.json();
      const live: DiscoveredModelOption[] = (data.data || [])
        .map((m: { id: string }) => ({ id: m.id, name: m.id }))
        .filter(
          (m: DiscoveredModelOption) =>
            m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3')
        )
        .slice(0, 15);
      const merged = [...OPENAI_SELECTABLE_MODELS];
      for (const item of live) {
        if (!merged.some((x) => x.id === item.id)) {
          merged.push(item);
        }
      }
      return {
        models: merged,
        message: `Discovered ${merged.length} OpenAI models.`,
      };
    } catch {
      return { models: OPENAI_SELECTABLE_MODELS };
    }
  }

  if (config.provider === 'custom') {
    const rawBase = (config.customBaseUrl || '').trim().replace(/\/+$/, '');
    if (!rawBase) {
      return {
        models: [],
        message: 'Enter a Base URL first to discover models from your Custom endpoint.',
      };
    }
    const modelsEndpoint = rawBase.endsWith('/chat/completions')
      ? `${rawBase.replace(/\/chat\/completions$/, '')}/models`
      : `${rawBase}/models`;
    try {
      const headers: Record<string, string> = {};
      if (config.apiKey.trim()) {
        headers.Authorization = `Bearer ${config.apiKey.trim()}`;
      }
      const res = await fetch(modelsEndpoint, { headers });
      if (!res.ok) {
        return {
          models: [],
          message: `Endpoint returned HTTP ${res.status}. Enter Model ID manually.`,
        };
      }
      const data = await res.json();
      const discovered: DiscoveredModelOption[] = (data.data || [])
        .slice(0, 20)
        .map((item: { id: string; name?: string }) => ({
          id: item.id,
          name: item.name || item.id,
        }));
      return {
        models: discovered,
        message:
          discovered.length > 0
            ? `Discovered ${discovered.length} models from endpoint.`
            : 'Enter your Model ID manually below.',
      };
    } catch {
      return {
        models: [],
        message: 'Enter your Custom Model ID manually below.',
      };
    }
  }

  return { models: [] };
}

export async function testAiConnection(
  config: JarvisConfig
): Promise<{ success: boolean; message: string }> {
  const validation = validateProviderConfiguration(config);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error || 'Invalid provider configuration.',
    };
  }

  try {
    if (config.provider === 'gemini') {
      const response = await fetch('/api/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model.trim(),
          apiKey: config.apiKey,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        return {
          success: false,
          message: data.message || data.error || `HTTP ${response.status}`,
        };
      }
      return {
        success: true,
        message: data.message || `Connected to Gemini (${config.model}).`,
      };
    }

    const endpoint =
      config.provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : config.customBaseUrl.trim().replace(/\/+$/, '').endsWith('/chat/completions')
        ? config.customBaseUrl.trim().replace(/\/+$/, '')
        : `${config.customBaseUrl.trim().replace(/\/+$/, '')}/chat/completions`;

    const body = buildOpenAiCompatibleRequestBody(
      config.model,
      'You are JARVIS.',
      [],
      'Respond with "JARVIS online" in 3 words.'
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `HTTP ${response.status}`;
      return {
        success: false,
        message: `Connection failed: ${errMsg}`,
      };
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'Online';
    return {
      success: true,
      message: `Connected to ${config.provider.toUpperCase()} (${config.model}): "${reply}"`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      message: `Connection failed: ${message}`,
    };
  }
}

export async function generateJarvisReply(
  prompt: string,
  history: ChatMessage[],
  config: JarvisConfig
): Promise<string> {
  const greeting = getJarvisGreeting();
  const systemInstruction = buildJarvisSystemPrompt(
    config.personality,
    config.customPersonalityPrompt
  );
  const recentHistory = config.persistentMemoryEnabled ? history.slice(-8) : [];

  if (config.provider === 'gemini') {
    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          history: recentHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          systemInstruction,
          model: config.model.trim() || 'gemini-3.8-flash',
          apiKey: config.apiKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data.text?.trim();
      if (!text) {
        return getSimulatedJarvisResponse(prompt, greeting);
      }
      return text;
    } catch (err) {
      console.warn('Server Gemini route error, using local fallback:', err);
      return getSimulatedJarvisResponse(prompt, greeting);
    }
  }

  const validation = validateProviderConfiguration(config);
  if (!validation.valid) {
    return `${validation.error} Open System Matrix → AI LINK to configure, sir.`;
  }

  try {
    const endpoint =
      config.provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : config.customBaseUrl.trim().replace(/\/+$/, '').endsWith('/chat/completions')
        ? config.customBaseUrl.trim().replace(/\/+$/, '')
        : `${config.customBaseUrl.trim().replace(/\/+$/, '')}/chat/completions`;

    const requestBody = buildOpenAiCompatibleRequestBody(
      config.model,
      systemInstruction,
      recentHistory.map((m) => ({ role: m.role, content: m.content })),
      prompt
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    return reply || getSimulatedJarvisResponse(prompt, greeting);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Provider failure (${config.provider}): ${msg}`);
  }
}
