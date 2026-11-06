export type JarvisState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'disconnected'
  | 'error';

export type WatchCaseColor = 'black' | 'silver' | 'pink_gold';

export type AiProvider = 'gemini' | 'openai' | 'custom';

export type JarvisPersonality = 'stark' | 'tactical' | 'formal';

export type ReactorTheme =
  | 'mark_i'
  | 'mark_vi'
  | 'mark_lxxxv'
  | 'nanotech'
  | 'mk1'
  | 'mk2'
  | 'mk3';

export type AnimationIntensity = 'full' | 'subtle' | 'reduced';

export type AccentIntensity = 'standard' | 'vivid' | 'ice';

export type AodTheme = 'minimal_reactor' | 'chronograph_arc' | 'stealth_digital';

export type ActiveScreen = 'home' | 'conversation' | 'settings';

export type SettingsSection =
  | 'hub'
  | 'provider'
  | 'reactor'
  | 'voice'
  | 'personality'
  | 'memory'
  | 'about';

export interface ProviderModelMap {
  gemini: string;
  openai: string;
  custom: string;
}

export interface ProviderKeyMap {
  gemini: string;
  openai: string;
  custom: string;
}

export interface JarvisConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  providerModels: ProviderModelMap;
  apiKeys: ProviderKeyMap;
  customBaseUrl: string;
  personality: JarvisPersonality;
  customPersonalityPrompt?: string;
  reactorTheme: ReactorTheme;
  aodTheme: AodTheme;
  speechRate: number;
  speechPitch: number;
  voiceAccent: 'en-GB' | 'en-US' | 'default';
  preferredVoiceURI?: string;
  soundFxEnabled: boolean;
  homeCaptionsEnabled: boolean;
  hapticsEnabled: boolean;
  persistentMemoryEnabled: boolean;
  adaptiveSuggestionsEnabled: boolean;
  brightness: number; // 70 - 115
  accentIntensity: AccentIntensity;
  animationIntensity: AnimationIntensity;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: AiProvider;
  model?: string;
}

export interface WatchTelemetry {
  batteryLevel: number;
  charging: boolean;
  heartRate: number;
  stepCount: number;
  coreTemperature: number;
  connectionState: 'bluetooth_linked' | 'wifi_direct' | 'offline';
  currentTime: string;
}

export interface AdaptiveSuggestion {
  id: string;
  label?: string;
  prompt?: string;
  reason?: string;
  shortLabel?: string;
  command?: string;
  category?: 'diagnostic' | 'schedule' | 'comms' | 'tactical' | 'general';
}

export interface DiscoveredModelOption {
  id: string;
  name: string;
  description?: string;
}

