import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Key,
  ShieldCheck,
  Check,
  RefreshCw,
  Volume2,
  CornerDownLeft,
  Cpu,
  Disc,
  UserCheck,
  Database,
  Info,
  ChevronLeft,
  ChevronRight,
  Play,
  ExternalLink,
} from 'lucide-react';
import {
  JarvisConfig,
  AiProvider,
  SettingsSection,
  DiscoveredModelOption,
} from '../types/index.ts';
import {
  OPENAI_SELECTABLE_MODELS,
  REACTOR_THEMES,
  discoverProviderModels,
  switchProviderPreservingState,
  updateActiveProviderApiKey,
  updateActiveProviderModel,
  testAiConnection,
} from '../services/ai/client.ts';
import { audioEngine } from '../services/voice/audioEngine.ts';
import {
  triggerWebHaptic,
  CircularResponsiveSpec,
  computeCircularResponsiveSpec,
} from '../utils/wearOsAudit.ts';
import { ArcReactor } from './ArcReactor.tsx';

interface SettingsScreenProps {
  config: JarvisConfig;
  messageCount: number;
  onSaveConfig: (newConfig: JarvisConfig) => void;
  onClearConfig: () => void;
  onClearHistory: () => void;
  onResetSuggestions: () => void;
  onNavigateHome: () => void;
  spec?: CircularResponsiveSpec;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  config,
  messageCount,
  onSaveConfig,
  onClearConfig,
  onClearHistory,
  onResetSuggestions,
  onNavigateHome,
  spec,
}) => {
  const resolvedSpec = spec ?? computeCircularResponsiveSpec(396);
  const s = resolvedSpec.scaleFactor;
  const fs = resolvedSpec.fontScale;
  const [activeSection, setActiveSection] = useState<SettingsSection>('hub');
  const [currentConfig, setCurrentConfig] = useState<JarvisConfig>({ ...config });
  const [showKey, setShowKey] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModelOption[]>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveToast, setSaveToast] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmResetCreds, setConfirmResetCreds] = useState(false);
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);

  const apiKeyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadVoices = () => {
      const voices = audioEngine.getAvailableVoices();
      setSystemVoices(voices);
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Load discovered or selectable models whenever provider changes or AI Link opens
  useEffect(() => {
    let cancelled = false;
    if (currentConfig.provider === 'openai') {
      setDiscoveredModels(OPENAI_SELECTABLE_MODELS);
    } else if (currentConfig.provider === 'gemini') {
      setDiscoveringModels(true);
      discoverProviderModels(currentConfig)
        .then((res) => {
          if (!cancelled && res.models.length > 0) {
            setDiscoveredModels(res.models);
          }
        })
        .finally(() => {
          if (!cancelled) setDiscoveringModels(false);
        });
    } else {
      setDiscoveredModels([]);
    }
    return () => {
      cancelled = true;
    };
  }, [currentConfig.provider]);

  const updateAndPersist = (partial: Partial<JarvisConfig>) => {
    const updated = { ...currentConfig, ...partial };
    setCurrentConfig(updated);
    onSaveConfig(updated);
  };

  const handleProviderChange = (provider: AiProvider) => {
    audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
    const switched = switchProviderPreservingState(currentConfig, provider);
    setCurrentConfig(switched);
    onSaveConfig(switched);
    setTestResult(null);
  };

  const handleModelChange = (modelId: string) => {
    const updated = updateActiveProviderModel(currentConfig, modelId);
    setCurrentConfig(updated);
    onSaveConfig(updated);
    setTestResult(null);
  };

  const handleApiKeyChange = (newKey: string) => {
    const updated = updateActiveProviderApiKey(currentConfig, newKey);
    setCurrentConfig(updated);
    setTestResult(null);
  };

  const handleDiscoverModels = async () => {
    setDiscoveringModels(true);
    setTestResult(null);
    audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
    const res = await discoverProviderModels(currentConfig);
    setDiscoveringModels(false);
    setDiscoveredModels(res.models);
    if (res.message) {
      setTestResult({
        success: res.models.length > 0,
        message: res.message,
      });
    }
    if (!currentConfig.model.trim() && res.models.length > 0) {
      handleModelChange(res.models[0].id);
    }
  };

  const handleClearProviderConfig = () => {
    audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
    let cleared = updateActiveProviderApiKey(currentConfig, '');
    if (currentConfig.provider === 'custom') {
      cleared = {
        ...updateActiveProviderModel(cleared, ''),
        customBaseUrl: '',
      };
    }
    setCurrentConfig(cleared);
    onSaveConfig(cleared);
    setTestResult({
      success: true,
      message: `Cleared ${currentConfig.provider.toUpperCase()} credentials.`,
    });
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    onSaveConfig(currentConfig);
    audioEngine.playSoundEffect('process', currentConfig.soundFxEnabled);

    const result = await testAiConnection(currentConfig);
    setTestingConnection(false);
    setTestResult(result);

    if (result.success) {
      audioEngine.playSoundEffect('success', currentConfig.soundFxEnabled);
    } else {
      audioEngine.playSoundEffect('error', currentConfig.soundFxEnabled);
    }
  };

  const handleSave = () => {
    onSaveConfig(currentConfig);
    audioEngine.playSoundEffect('success', currentConfig.soundFxEnabled);
    triggerWebHaptic('CONFIRM', currentConfig.hapticsEnabled ?? true);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 1800);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLElement>) => {
    setIsInputFocused(true);
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
      setIsInputFocused(false);
      handleSave();
    } else if (e.key === 'Escape') {
      e.currentTarget.blur();
      setIsInputFocused(false);
    }
  };

  const handleVoicePreview = () => {
    audioEngine.speak(
      'Voice calibration complete, sir. All vocal telemetry parameters are nominal.',
      {
        rate: currentConfig.speechRate,
        pitch: currentConfig.speechPitch,
        accent: currentConfig.voiceAccent,
        preferredVoiceURI: currentConfig.preferredVoiceURI,
      }
    );
  };

  const cycleReactorTheme = (dir: 1 | -1) => {
    const idx = REACTOR_THEMES.findIndex((t) => t.id === currentConfig.reactorTheme);
    const nextIdx = (idx + dir + REACTOR_THEMES.length) % REACTOR_THEMES.length;
    const nextTheme = REACTOR_THEMES[nextIdx].id;
    audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
    updateAndPersist({ reactorTheme: nextTheme });
  };

  const sections: Array<{
    id: SettingsSection;
    label: string;
    short: string;
    icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  }> = [
    { id: 'provider', label: 'AI Provider', short: 'AI LINK', icon: Cpu },
    { id: 'reactor', label: 'Arc Reactor', short: 'REACTOR', icon: Disc },
    { id: 'voice', label: 'Voice System', short: 'VOICE', icon: Volume2 },
    { id: 'personality', label: 'Personality', short: 'PERSONA', icon: UserCheck },
    { id: 'memory', label: 'Memory & Logs', short: 'MEMORY', icon: Database },
    { id: 'about', label: 'About JARVIS', short: 'ABOUT', icon: Info },
  ];

  const currentReactorMeta =
    REACTOR_THEMES.find((t) => t.id === currentConfig.reactorTheme) || REACTOR_THEMES[1];

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between text-center select-none relative overflow-hidden"
      style={{
        paddingLeft: `${resolvedSpec.outerHorizontalPaddingPx}px`,
        paddingRight: `${resolvedSpec.outerHorizontalPaddingPx}px`,
        paddingTop: `${resolvedSpec.headerTopInsetPx}px`,
        paddingBottom: `${resolvedSpec.bottomDockBottomInsetPx}px`,
      }}
    >
      {/* Subtle Radial Outer Ring */}
      <svg
        viewBox="0 0 396 396"
        className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
        aria-hidden="true"
      >
        <circle
          cx="198"
          cy="198"
          r="184"
          fill="none"
          stroke="#0891b2"
          strokeWidth="0.7"
          strokeDasharray="4 8"
        />
      </svg>

      {/* V6 Top Curved Navigation Header: Symmetric Left (Back) | Center (Screen Title) | Right (HOME) */}
      <div
        data-testid="system-matrix-header"
        className="w-full mx-auto flex flex-col items-center z-20 shrink-0"
        style={{ maxWidth: `${resolvedSpec.headerSafeWidthPx}px` }}
      >
        <div
          className="w-full grid items-center px-1"
          style={{
            gridTemplateColumns: `${resolvedSpec.headerSlotWidthPx}px 1fr ${resolvedSpec.headerSlotWidthPx}px`,
            minHeight: `${resolvedSpec.headerButtonSizePx}px`,
          }}
        >
          <div className="flex items-center justify-start">
            <button
              type="button"
              data-testid="matrix-header-back"
              onClick={() => {
                audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
                triggerWebHaptic('TAP', currentConfig.hapticsEnabled ?? true);
                if (activeSection === 'hub') {
                  onNavigateHome();
                } else {
                  setActiveSection('hub');
                }
              }}
              className="rounded-full bg-slate-900/90 border border-cyan-700/75 hover:border-cyan-400 flex items-center justify-center text-cyan-300 active:scale-90 transition-all shrink-0"
              style={{
                width: `${resolvedSpec.headerButtonSizePx}px`,
                height: `${resolvedSpec.headerButtonSizePx}px`,
              }}
              aria-label={activeSection === 'hub' ? 'Return to Home Screen' : 'Return to Settings Hub'}
              title={activeSection === 'hub' ? 'Return to Home Screen' : 'Return to Settings Hub'}
            >
              <ArrowLeft
                style={{
                  width: `${Math.round(resolvedSpec.headerButtonSizePx * 0.48)}px`,
                  height: `${Math.round(resolvedSpec.headerButtonSizePx * 0.48)}px`,
                }}
              />
            </button>
          </div>

          <span
            data-testid="matrix-header-title"
            className="justify-self-center px-1.5 font-hud font-semibold tracking-[0.12em] text-cyan-200 uppercase whitespace-nowrap truncate w-full text-center"
            style={{ fontSize: `${(10 * fs).toFixed(1)}px` }}
          >
            {activeSection === 'hub'
              ? 'SYSTEM MATRIX'
              : sections.find((sec) => sec.id === activeSection)?.short || 'CONFIG'}
          </span>

          <div className="flex items-center justify-end">
            <button
              type="button"
              data-testid="matrix-header-home"
              onClick={() => {
                audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
                triggerWebHaptic('TAP', currentConfig.hapticsEnabled ?? true);
                onNavigateHome();
              }}
              className="rounded-full bg-slate-900/90 border border-cyan-800/65 hover:border-cyan-400 font-mono-code font-bold text-cyan-300 hover:text-cyan-100 active:scale-95 px-2.5 flex items-center justify-center shrink-0 whitespace-nowrap transition-all"
              style={{
                height: `${resolvedSpec.headerButtonSizePx}px`,
                fontSize: `${(8.2 * fs).toFixed(1)}px`,
              }}
              aria-label="Exit to Home"
              title="Exit to Home"
            >
              HOME
            </button>
          </div>
        </div>

        <svg
          viewBox="0 0 220 8"
          className="w-full h-[6px] mt-1 overflow-visible"
          aria-hidden="true"
        >
          <path
            d="M 12 6.5 Q 110 1 208 6.5"
            fill="none"
            stroke="#0e7490"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>

      {/* Main Content Area */}
      {activeSection === 'hub' ? (
        /* Circular Radial Navigation Matrix (6 True Circular Orbital Nodes around Central Core) */
        <div
          data-testid="system-matrix-hub"
          className={`relative w-full flex-1 flex flex-col items-center justify-center my-auto z-10 py-0.5 ${
            resolvedSpec.matrixNeedsScrollFallback
              ? 'overflow-y-auto no-scrollbar overscroll-contain'
              : ''
          }`}
          style={{ maxWidth: `${resolvedSpec.contentSafeWidthPx}px` }}
        >
          {/* Connecting SVG Orbital Ring & Radial Spokes */}
          <svg
            viewBox="0 0 260 220"
            className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
            aria-hidden="true"
          >
            <circle
              cx="130"
              cy="110"
              r="76"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="0.8"
              strokeDasharray="3 5"
            />
            <circle
              cx="130"
              cy="110"
              r="44"
              fill="none"
              stroke="#0e7490"
              strokeWidth="0.6"
            />
            {[30, 90, 150, 210, 270, 330].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <line
                  key={deg}
                  x1={130 + 42 * Math.cos(rad)}
                  y1={110 + 42 * Math.sin(rad)}
                  x2={130 + 74 * Math.cos(rad)}
                  y2={110 + 74 * Math.sin(rad)}
                  stroke="#0891b2"
                  strokeWidth="0.7"
                />
              );
            })}
          </svg>

          {/* Top Orbital Pair */}
          <div
            className="flex items-center justify-center w-full mb-1 z-10"
            style={{
              gap: `${Math.round(28 * s)}px`,
              maxWidth: `${Math.round(212 * s)}px`,
            }}
          >
            {sections.slice(0, 2).map((sec) => {
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
                    setActiveSection(sec.id);
                  }}
                  className="rounded-full bg-slate-950/90 border border-cyan-700/65 hover:border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.16)] flex flex-col items-center justify-center gap-0.5 active:scale-92 transition-all group shrink-0"
                  style={{
                    width: `${resolvedSpec.matrixOrbitalNodeSizePx}px`,
                    height: `${resolvedSpec.matrixOrbitalNodeSizePx}px`,
                  }}
                >
                  <Icon
                    className="text-cyan-400 group-hover:text-cyan-200"
                    style={{
                      width: `${Math.round(resolvedSpec.matrixOrbitalNodeSizePx * 0.26)}px`,
                      height: `${Math.round(resolvedSpec.matrixOrbitalNodeSizePx * 0.26)}px`,
                    }}
                  />
                  <span
                    className="font-hud font-semibold tracking-wider text-cyan-100 uppercase leading-none"
                    style={{ fontSize: `${(7.5 * fs).toFixed(1)}px` }}
                  >
                    {sec.short}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Equator Row: Left Circular Node + Central Live Reactor Core + Right Circular Node */}
          <div
            className="flex items-center justify-between w-full my-0.5 z-10"
            style={{ maxWidth: `${Math.round(252 * s)}px` }}
          >
            {(() => {
              const LeftIcon = sections[2].icon;
              const RightIcon = sections[3].icon;
              return (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
                      setActiveSection(sections[2].id);
                    }}
                    className="rounded-full bg-slate-950/90 border border-cyan-700/65 hover:border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.16)] flex flex-col items-center justify-center gap-0.5 active:scale-92 transition-all group shrink-0"
                    style={{
                      width: `${resolvedSpec.matrixOrbitalNodeSizePx}px`,
                      height: `${resolvedSpec.matrixOrbitalNodeSizePx}px`,
                    }}
                  >
                    <LeftIcon
                      className="text-cyan-400 group-hover:text-cyan-200"
                      style={{
                        width: `${Math.round(resolvedSpec.matrixOrbitalNodeSizePx * 0.26)}px`,
                        height: `${Math.round(resolvedSpec.matrixOrbitalNodeSizePx * 0.26)}px`,
                      }}
                    />
                    <span
                      className="font-hud font-semibold tracking-wider text-cyan-100 uppercase leading-none"
                      style={{ fontSize: `${(7.5 * fs).toFixed(1)}px` }}
                    >
                      {sections[2].short}
                    </span>
                  </button>

                  {/* Center Live Reactor Core Anchor */}
                  <div
                    onClick={() => setActiveSection('reactor')}
                    className="cursor-pointer flex flex-col items-center justify-center px-0.5"
                    title="Customize Arc Reactor Theme"
                  >
                    <ArcReactor
                      state="idle"
                      theme={currentConfig.reactorTheme}
                      size={resolvedSpec.matrixCenterReactorSizePx}
                      interactive={false}
                      animationIntensity={currentConfig.animationIntensity}
                      accentIntensity={currentConfig.accentIntensity}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
                      setActiveSection(sections[3].id);
                    }}
                    className="rounded-full bg-slate-950/90 border border-cyan-700/65 hover:border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.16)] flex flex-col items-center justify-center gap-0.5 active:scale-92 transition-all group shrink-0"
                    style={{
                      width: `${resolvedSpec.matrixOrbitalNodeSizePx}px`,
                      height: `${resolvedSpec.matrixOrbitalNodeSizePx}px`,
                    }}
                  >
                    <RightIcon
                      className="text-cyan-400 group-hover:text-cyan-200"
                      style={{
                        width: `${Math.round(resolvedSpec.matrixOrbitalNodeSizePx * 0.26)}px`,
                        height: `${Math.round(resolvedSpec.matrixOrbitalNodeSizePx * 0.26)}px`,
                      }}
                    />
                    <span
                      className="font-hud font-semibold tracking-wider text-cyan-100 uppercase leading-none"
                      style={{ fontSize: `${(7.5 * fs).toFixed(1)}px` }}
                    >
                      {sections[3].short}
                    </span>
                  </button>
                </>
              );
            })()}
          </div>

          {/* Bottom Orbital Pair (MEMORY & ABOUT) */}
          <div
            className="flex items-center justify-center w-full mt-1 z-10"
            style={{
              gap: `${Math.round(28 * s)}px`,
              maxWidth: `${Math.round(212 * s)}px`,
            }}
          >
            {sections.slice(4, 6).map((sec) => {
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playSoundEffect('tap', currentConfig.soundFxEnabled);
                    setActiveSection(sec.id);
                  }}
                  className="rounded-full bg-slate-950/90 border border-cyan-700/65 hover:border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.16)] flex flex-col items-center justify-center gap-0.5 active:scale-92 transition-all group shrink-0"
                  style={{
                    width: `${resolvedSpec.matrixOrbitalNodeSizePx}px`,
                    height: `${resolvedSpec.matrixOrbitalNodeSizePx}px`,
                  }}
                >
                  <Icon
                    className="text-cyan-400 group-hover:text-cyan-200"
                    style={{
                      width: `${Math.round(resolvedSpec.matrixOrbitalNodeSizePx * 0.26)}px`,
                      height: `${Math.round(resolvedSpec.matrixOrbitalNodeSizePx * 0.26)}px`,
                    }}
                  />
                  <span
                    className="font-hud font-semibold tracking-wider text-cyan-100 uppercase leading-none"
                    style={{ fontSize: `${(7.5 * fs).toFixed(1)}px` }}
                  >
                    {sec.short}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Individual Circular Section Views with comfortable touch targets and smooth vertical scroll */
        <div
          data-testid="system-matrix-subscreen-scroll"
          className="w-full mx-auto flex-1 overflow-y-auto scroll-smooth overscroll-contain no-scrollbar px-2.5 py-1.5 space-y-2.5 text-center text-[10px] font-mono-code z-10"
          style={{ maxWidth: `${resolvedSpec.contentSafeWidthPx}px` }}
          tabIndex={0}
        >
          {/* SECTION 1: AI LINK (Dynamic Provider & Model Configuration) */}
          {activeSection === 'provider' && (
            <div className="space-y-2.5 pt-1 pb-3 max-w-[232px] mx-auto">
              {/* Provider Selector: Gemini, OpenAI, Custom */}
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'gemini', label: 'Gemini' },
                    { id: 'openai', label: 'OpenAI' },
                    { id: 'custom', label: 'Custom' },
                  ] as const
                ).map((prov) => {
                  const active = currentConfig.provider === prov.id;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleProviderChange(prov.id)}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-[9px] font-hud font-semibold uppercase tracking-wider transition-all ${
                        active
                          ? 'bg-cyan-400 border-cyan-300 text-slate-950 font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                          : 'bg-slate-950/90 border-cyan-900/60 text-cyan-200 hover:border-cyan-400'
                      }`}
                    >
                      {prov.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Endpoint Base URL Field */}
              {currentConfig.provider === 'custom' && (
                <div>
                  <label
                    htmlFor="watch-custom-base-url"
                    className="text-[8.5px] text-cyan-300/90 uppercase tracking-wider block mb-1"
                  >
                    Custom Base URL (OpenAI-Compatible)
                  </label>
                  <input
                    id="watch-custom-base-url"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="https://openrouter.ai/api/v1"
                    value={currentConfig.customBaseUrl || ''}
                    onFocus={handleInputFocus}
                    onBlur={() => setIsInputFocused(false)}
                    onKeyDown={handleInputKeyDown}
                    onChange={(e) => {
                      updateAndPersist({ customBaseUrl: e.target.value });
                      setTestResult(null);
                    }}
                    className="w-full min-h-[38px] py-1.5 px-3 bg-slate-950 border border-cyan-800/80 rounded-xl text-cyan-100 placeholder:text-slate-500 text-[9.5px] text-center outline-none focus:border-cyan-400"
                  />
                </div>
              )}

              {/* Dynamic / Selectable Model Discovery Dropdown */}
              <div>
                <div className="flex items-center justify-between px-1 mb-1">
                  <label
                    htmlFor="watch-model-select"
                    className="text-[8.5px] text-cyan-300/90 uppercase tracking-wider"
                  >
                    {currentConfig.provider === 'gemini'
                      ? 'Discovered Models'
                      : currentConfig.provider === 'openai'
                      ? 'Selectable Models'
                      : 'Endpoint Models'}
                  </label>
                  <button
                    type="button"
                    onClick={handleDiscoverModels}
                    disabled={discoveringModels}
                    className="text-[8.5px] text-cyan-400 hover:text-cyan-200 font-bold flex items-center gap-1"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${discoveringModels ? 'animate-spin' : ''}`} />
                    <span>{discoveringModels ? 'Syncing…' : 'Discover'}</span>
                  </button>
                </div>

                {discoveredModels.length > 0 && (
                  <select
                    id="watch-model-select"
                    value={
                      discoveredModels.some((m) => m.id === currentConfig.model)
                        ? currentConfig.model
                        : ''
                    }
                    onFocus={handleInputFocus}
                    onBlur={() => setIsInputFocused(false)}
                    onChange={(e) => {
                      if (e.target.value) handleModelChange(e.target.value);
                    }}
                    className="w-full min-h-[38px] py-1.5 px-2.5 bg-slate-950 border border-cyan-800/80 rounded-xl text-cyan-100 text-[9.5px] text-center outline-none focus:border-cyan-400"
                  >
                    <option value="">-- Select Discovered Model --</option>
                    {discoveredModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Manual Model ID Entry (Supported for Gemini, OpenAI, and Custom) */}
              <div>
                <label
                  htmlFor="watch-manual-model-input"
                  className="text-[8.5px] text-cyan-300/90 uppercase tracking-wider block mb-1"
                >
                  Model ID (Manual or Selected)
                </label>
                <input
                  id="watch-manual-model-input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    currentConfig.provider === 'gemini'
                      ? 'e.g. gemini-2.5-flash'
                      : currentConfig.provider === 'openai'
                      ? 'e.g. gpt-4o-mini or o3-mini'
                      : 'e.g. openai/gpt-4o-mini'
                  }
                  value={currentConfig.model}
                  onFocus={handleInputFocus}
                  onBlur={() => setIsInputFocused(false)}
                  onKeyDown={handleInputKeyDown}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full min-h-[38px] py-1.5 px-3 bg-slate-950 border border-cyan-800/80 rounded-xl text-cyan-100 placeholder:text-slate-500 text-[9.5px] text-center outline-none focus:border-cyan-400"
                />
              </div>

              {/* BYOK Key Input */}
              <div>
                <div className="flex items-center justify-between px-1 mb-1 text-[8.5px]">
                  <label htmlFor="watch-api-key-input" className="text-cyan-300/90 uppercase tracking-wider">
                    API Key ({currentConfig.provider.toUpperCase()})
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-cyan-400 hover:text-cyan-200 underline font-semibold"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    ref={apiKeyInputRef}
                    id="watch-api-key-input"
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={
                      currentConfig.provider === 'gemini'
                        ? 'Server uplink ready (or enter key)'
                        : `Paste ${currentConfig.provider.toUpperCase()} API key`
                    }
                    value={currentConfig.apiKey}
                    onFocus={handleInputFocus}
                    onBlur={() => setIsInputFocused(false)}
                    onKeyDown={handleInputKeyDown}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    className="w-full min-h-[38px] py-1.5 pl-3 pr-7 bg-slate-950 border border-cyan-800/80 rounded-xl text-cyan-100 placeholder:text-slate-500 text-[9.5px] text-center outline-none focus:border-cyan-400"
                  />
                  {isInputFocused ? (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        apiKeyInputRef.current?.blur();
                        setIsInputFocused(false);
                        handleSave();
                      }}
                      className="absolute right-2 text-cyan-300"
                      aria-label="Done editing key"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <Key className="w-3.5 h-3.5 absolute right-2.5 text-cyan-600 pointer-events-none" />
                  )}
                </div>
              </div>

              {/* Save / Test Connection / Clear Buttons with 38px+ touch target height */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleSave}
                  className="min-h-[38px] px-2 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-hud font-bold text-[8.5px] uppercase tracking-wider active:scale-95 transition-all"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="min-h-[38px] px-2 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500/70 hover:border-cyan-300 text-cyan-100 font-hud font-semibold text-[8.5px] uppercase tracking-wider flex items-center justify-center gap-1 active:scale-95 transition-all"
                >
                  {testingConnection ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-cyan-300" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 text-cyan-300" />
                  )}
                  <span>Test</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearProviderConfig}
                  className="min-h-[38px] px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-red-400 text-slate-300 hover:text-red-300 font-hud font-semibold text-[8.5px] uppercase tracking-wider active:scale-95 transition-all"
                >
                  Clear
                </button>
              </div>

              {testResult && (
                <p
                  className={`text-[9px] leading-snug px-2 py-1 rounded-lg bg-slate-950/90 border ${
                    testResult.success
                      ? 'text-emerald-300 border-emerald-800/60'
                      : 'text-red-300 border-red-800/60'
                  }`}
                >
                  {testResult.message}
                </p>
              )}

              {/* Contextual Destructive Action inside AI LINK only (never a permanent bottom-bar icon) */}
              <button
                type="button"
                onClick={() => {
                  triggerWebHaptic('TAP', currentConfig.hapticsEnabled ?? true);
                  if (!confirmResetCreds) {
                    setConfirmResetCreds(true);
                    setTimeout(() => setConfirmResetCreds(false), 3000);
                    return;
                  }
                  onClearConfig();
                  setCurrentConfig((prev) => ({
                    ...prev,
                    apiKey: '',
                    apiKeys: { gemini: '', openai: '', custom: '' },
                  }));
                  setConfirmResetCreds(false);
                }}
                className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl border text-[8.5px] font-hud font-semibold uppercase tracking-wider transition-all ${
                  confirmResetCreds
                    ? 'bg-red-950 border-red-500 text-red-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-red-300 hover:border-red-500/50'
                }`}
              >
                {confirmResetCreds ? 'Confirm Purge All Keys?' : 'Purge All Keystore Keys'}
              </button>
            </div>
          )}

          {/* SECTION 2: ARC REACTOR (Live Interactive Theme Selector) */}
          {activeSection === 'reactor' && (
            <div className="flex flex-col items-center justify-center space-y-2 py-0.5 max-w-[232px] mx-auto">
              {/* Live Reactor Preview with Left/Right Radial Dial Controls */}
              <div className="flex items-center justify-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => cycleReactorTheme(-1)}
                  className="w-9 h-9 rounded-full bg-slate-950 border border-cyan-800/80 hover:border-cyan-400 flex items-center justify-center text-cyan-300 active:scale-90"
                  aria-label="Previous Reactor Theme"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <ArcReactor
                  state="idle"
                  theme={currentConfig.reactorTheme}
                  size={102}
                  interactive={false}
                  animationIntensity={currentConfig.animationIntensity}
                  accentIntensity={currentConfig.accentIntensity}
                />

                <button
                  type="button"
                  onClick={() => cycleReactorTheme(1)}
                  className="w-9 h-9 rounded-full bg-slate-950 border border-cyan-800/80 hover:border-cyan-400 flex items-center justify-center text-cyan-300 active:scale-90"
                  aria-label="Next Reactor Theme"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Reactor Title & Era */}
              <div className="text-center">
                <div className="font-hud text-[10.5px] font-bold text-cyan-200 tracking-wider uppercase">
                  {currentReactorMeta.name}
                </div>
                <div className="text-[8.5px] text-slate-400">
                  {currentReactorMeta.era} · {currentReactorMeta.subtitle}
                </div>
              </div>

              {/* 4 Direct Radial Selection Nodes with comfortable touch targets */}
              <div className="grid grid-cols-2 gap-1.5 w-full pt-0.5">
                {REACTOR_THEMES.map((rt, i) => {
                  const selected = currentConfig.reactorTheme === rt.id;
                  return (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => updateAndPersist({ reactorTheme: rt.id })}
                      aria-label={`Select ${rt.name}`}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-[9px] font-hud font-semibold uppercase border transition-all ${
                        selected
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold'
                          : 'bg-slate-950 text-cyan-200 border-cyan-900/70 hover:border-cyan-400'
                      }`}
                    >
                      {rt.id === 'nanotech' ? 'NANO' : `MK ${i + 1}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: VOICE SYSTEM */}
          {activeSection === 'voice' && (
            <div className="space-y-2.5 max-w-[232px] mx-auto py-1">
              {/* Accent Preference */}
              <div>
                <span className="text-[8.5px] text-cyan-300/90 uppercase tracking-wider block mb-1">
                  Accent Preference
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'en-GB', label: 'British (UK)' },
                      { id: 'en-US', label: 'American (US)' },
                    ] as const
                  ).map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => updateAndPersist({ voiceAccent: acc.id })}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-[9px] font-hud uppercase border transition-all ${
                        currentConfig.voiceAccent === acc.id
                          ? 'bg-cyan-400 border-cyan-300 text-slate-950 font-bold'
                          : 'bg-slate-950 border-cyan-900/60 text-cyan-200 hover:border-cyan-400'
                      }`}
                    >
                      {acc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* System Voice Synthesizer */}
              <div>
                <label
                  htmlFor="watch-voice-select"
                  className="text-[8.5px] text-cyan-300/90 uppercase tracking-wider block mb-1"
                >
                  System Voice Synthesizer
                </label>
                <select
                  id="watch-voice-select"
                  value={currentConfig.preferredVoiceURI || ''}
                  onChange={(e) => {
                    const nextUri = e.target.value;
                    updateAndPersist({ preferredVoiceURI: nextUri });
                    audioEngine.speak('Vocal synthesizer updated, sir.', {
                      rate: currentConfig.speechRate,
                      pitch: currentConfig.speechPitch,
                      accent: currentConfig.voiceAccent,
                      preferredVoiceURI: nextUri,
                    });
                  }}
                  className="w-full min-h-[38px] py-1.5 px-2.5 bg-slate-950 border border-cyan-800/80 rounded-xl text-cyan-100 text-[9.5px] text-center outline-none focus:border-cyan-400"
                >
                  <option value="">Auto British Male (UK Default)</option>
                  {systemVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              {/* Speech Rate & Pitch Sliders */}
              <div className="px-1 space-y-2">
                <div>
                  <div className="flex justify-between text-[8.5px] text-slate-300 mb-0.5">
                    <span>Speech Speed</span>
                    <span className="text-cyan-300 font-bold">{currentConfig.speechRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.3"
                    step="0.05"
                    aria-label="Vocal Speed"
                    value={currentConfig.speechRate}
                    onChange={(e) =>
                      updateAndPersist({ speechRate: parseFloat(e.target.value) })
                    }
                    className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[8.5px] text-slate-300 mb-0.5">
                    <span>Voice Pitch</span>
                    <span className="text-cyan-300 font-bold">{currentConfig.speechPitch.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    aria-label="Voice Pitch"
                    value={currentConfig.speechPitch}
                    onChange={(e) =>
                      updateAndPersist({ speechPitch: parseFloat(e.target.value) })
                    }
                    className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Voice Preview Button */}
              <button
                type="button"
                onClick={handleVoicePreview}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[9px] font-hud font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <Play className="w-3 h-3 fill-slate-950" />
                <span>Preview Voice</span>
              </button>

              {/* V5: Home Screen Response Captions Toggle */}
              <button
                type="button"
                data-testid="toggle-home-captions"
                onClick={() => {
                  const next = !(currentConfig.homeCaptionsEnabled ?? true);
                  triggerWebHaptic('TAP', currentConfig.hapticsEnabled ?? true);
                  updateAndPersist({ homeCaptionsEnabled: next });
                }}
                className="w-full min-h-[42px] flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-900/60 hover:border-cyan-400 transition-all"
              >
                <span className="text-[9.5px] text-slate-200 text-left">Home Screen Captions</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase ${
                    currentConfig.homeCaptionsEnabled ?? true
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {currentConfig.homeCaptionsEnabled ?? true ? 'ENABLED' : 'DISABLED'}
                </span>
              </button>

              {/* V5: Subtle Watch Haptic Feedback Toggle */}
              <button
                type="button"
                data-testid="toggle-haptic-feedback"
                onClick={() => {
                  const next = !(currentConfig.hapticsEnabled ?? true);
                  triggerWebHaptic('TAP', next);
                  updateAndPersist({ hapticsEnabled: next });
                }}
                className="w-full min-h-[42px] flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-900/60 hover:border-cyan-400 transition-all"
              >
                <span className="text-[9.5px] text-slate-200 text-left">Haptic Feedback</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase ${
                    currentConfig.hapticsEnabled ?? true
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {currentConfig.hapticsEnabled ?? true ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          )}

          {/* SECTION 4: PERSONALITY */}
          {activeSection === 'personality' && (
            <div className="space-y-2.5 max-w-[232px] mx-auto py-1">
              <div>
                <span className="text-[8.5px] text-cyan-300/90 uppercase tracking-wider block mb-1">
                  Demeanor Profile
                </span>
                <div className="space-y-1.5">
                  {(
                    [
                      { id: 'stark', label: 'Stark Witty', desc: 'Dry British wit & sarcasm' },
                      { id: 'tactical', label: 'Tactical HUD', desc: 'Concise combat telemetry' },
                      { id: 'formal', label: 'Formal Butler', desc: 'Polite executive protocol' },
                    ] as const
                  ).map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => updateAndPersist({ personality: style.id })}
                      className={`w-full min-h-[40px] px-3 py-1.5 rounded-xl text-left border transition-all flex items-center justify-between ${
                        currentConfig.personality === style.id
                          ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-cyan-800'
                      }`}
                    >
                      <div>
                        <div className="font-hud text-[9.5px] font-bold uppercase">{style.label}</div>
                        <div className="text-[8px] text-slate-400">{style.desc}</div>
                      </div>
                      {currentConfig.personality === style.id && (
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="custom-persona-input"
                  className="text-[8.5px] text-cyan-300/90 uppercase tracking-wider block mb-1"
                >
                  Custom Directives
                </label>
                <input
                  id="custom-persona-input"
                  type="text"
                  placeholder="e.g., Address me as Commander…"
                  value={currentConfig.customPersonalityPrompt || ''}
                  onFocus={handleInputFocus}
                  onBlur={() => setIsInputFocused(false)}
                  onKeyDown={handleInputKeyDown}
                  onChange={(e) =>
                    updateAndPersist({ customPersonalityPrompt: e.target.value })
                  }
                  className="w-full min-h-[38px] py-1.5 px-3 bg-slate-950 border border-cyan-800/80 rounded-xl text-cyan-100 placeholder:text-slate-500 text-[9.5px] text-center outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {/* SECTION 5: MEMORY & ADAPTIVE SUGGESTIONS */}
          {activeSection === 'memory' && (
            <div className="space-y-2 max-w-[232px] mx-auto py-1">
              <div className="text-[9px] text-cyan-300 font-hud tracking-wider">
                ACTIVE DIALOGUE TURNS · {messageCount}
              </div>

              <button
                type="button"
                onClick={() =>
                  updateAndPersist({
                    persistentMemoryEnabled: !currentConfig.persistentMemoryEnabled,
                  })
                }
                className="w-full min-h-[40px] flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-900/60 hover:border-cyan-400"
              >
                <span className="text-[9.5px] text-slate-200">Persistent Memory</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase ${
                    currentConfig.persistentMemoryEnabled
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {currentConfig.persistentMemoryEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateAndPersist({
                    adaptiveSuggestionsEnabled: !currentConfig.adaptiveSuggestionsEnabled,
                  })
                }
                className="w-full min-h-[40px] flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-900/60 hover:border-cyan-400"
              >
                <span className="text-[9.5px] text-slate-200">Adaptive Suggestions</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase ${
                    currentConfig.adaptiveSuggestionsEnabled
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {currentConfig.adaptiveSuggestionsEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={onResetSuggestions}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-950 border border-cyan-800/70 hover:border-cyan-400 text-cyan-200 text-[9px] font-hud font-semibold uppercase"
                >
                  Restore Suggestions
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!confirmClearHistory) {
                      setConfirmClearHistory(true);
                      setTimeout(() => setConfirmClearHistory(false), 3000);
                      return;
                    }
                    onClearHistory();
                    setConfirmClearHistory(false);
                  }}
                  className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl border text-[9px] font-hud font-semibold uppercase ${
                    confirmClearHistory
                      ? 'bg-red-950 border-red-500 text-red-200'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-red-300'
                  }`}
                >
                  {confirmClearHistory ? 'Confirm Clear Logs?' : 'Clear Conversation Logs'}
                </button>
              </div>
            </div>
          )}

          {/* SECTION 6: ABOUT (Replaces Display Settings in V4) */}
          {activeSection === 'about' && (
            <div className="space-y-2.5 max-w-[232px] mx-auto py-1">
              <div className="px-3 py-2.5 rounded-2xl bg-slate-950/90 border border-cyan-800/70 space-y-1.5">
                <div className="font-hud text-[12px] font-bold tracking-[0.16em] text-cyan-300">
                  J.A.R.V.I.S.
                </div>
                <p className="text-[9.5px] text-slate-200 leading-snug">
                  A personal AI assistant designed for Wear OS.
                </p>

                <div className="pt-1 border-t border-cyan-950">
                  <div className="text-[7.5px] text-slate-400 uppercase tracking-widest">
                    Creator
                  </div>
                  <div className="text-[10.5px] font-bold text-cyan-100">
                    Furqan Siddiqui
                  </div>
                </div>

                <div className="pt-0.5">
                  <div className="text-[7.5px] text-slate-400 uppercase tracking-widest">
                    Version &amp; Build
                  </div>
                  <div className="text-[8.5px] text-cyan-300 font-mono-code">
                    v6.0.0-SM-R860 · Build 6
                  </div>
                </div>
              </div>

              <a
                href="https://github.com/siddiqui-furqan"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-cyan-950/85 border border-cyan-500/80 hover:border-cyan-300 text-cyan-100 flex items-center justify-center gap-1.5 text-[9px] font-hud font-bold uppercase tracking-wider active:scale-95 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span>github.com/siddiqui-furqan</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* V6 Bottom Curved Primary Action Dock: Single Centered SAVE CONFIG Button (No Duplicate Back or Trash) */}
      <div
        data-testid="system-matrix-bottom-dock"
        className="relative w-full mx-auto flex flex-col items-center z-20 shrink-0"
        style={{ maxWidth: `${resolvedSpec.bottomDockSafeWidthPx}px` }}
      >
        <svg viewBox="0 0 220 8" className="w-full h-[6px] mb-1 overflow-visible" aria-hidden="true">
          <path
            d="M 12 2 Q 110 7 208 2"
            fill="none"
            stroke="#0e7490"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>

        {/* Orbital Connecting Arc cradling the centered SAVE CONFIG button */}
        <svg
          viewBox="0 0 220 26"
          className="absolute bottom-0 w-full h-[22px] pointer-events-none opacity-45"
          aria-hidden="true"
        >
          <path
            d="M 24 6 Q 110 22 196 6"
            fill="none"
            stroke="#0891b2"
            strokeWidth="0.9"
            strokeDasharray="3 4"
          />
        </svg>

        <div
          className="w-full flex items-center justify-center"
          style={{ minHeight: `${Math.round(resolvedSpec.bottomDockHeightPx * 0.78)}px` }}
        >
          <button
            type="button"
            data-testid="matrix-save-config-btn"
            onClick={handleSave}
            className="py-1.5 px-5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-hud font-bold tracking-wider whitespace-nowrap active:scale-95 transition-all shadow-[0_0_12px_rgba(0,240,255,0.35)] flex items-center justify-center gap-1.5 z-10"
            style={{ fontSize: `${(9.5 * fs).toFixed(1)}px` }}
            aria-label="Save Settings"
          >
            <Check className="w-3 h-3 shrink-0" />
            <span className="whitespace-nowrap">{saveToast ? 'SAVED' : 'SAVE CONFIG'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
