import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  WatchCaseColor,
  ActiveScreen,
  JarvisState,
  ChatMessage,
  JarvisConfig,
  WatchTelemetry,
  ReactorTheme,
} from './types/index.ts';
import {
  loadStoredConfig,
  saveStoredConfig,
  clearStoredConfig,
  loadStoredHistory,
  saveStoredHistory,
  clearStoredHistory,
  loadDismissedSuggestions,
  saveDismissedSuggestions,
  INITIAL_WELCOME_MESSAGE,
  REACTOR_THEMES,
  generateJarvisReply,
} from './services/ai/client.ts';
import { deriveAdaptiveSuggestions } from './services/ai/suggestions.ts';
import {
  parseVoiceActionIntent,
  executeDeviceControlIntent,
  VoiceActionIntent,
} from './services/device/deviceControl.ts';
import { audioEngine } from './services/voice/audioEngine.ts';
import {
  triggerWebHaptic,
  computeCircularResponsiveSpec,
  ROUND_DISPLAY_VALIDATION_PROFILES,
} from './utils/wearOsAudit.ts';
import { WatchStatusBar } from './components/WatchStatusBar.tsx';
import { HomeScreen } from './components/HomeScreen.tsx';
import { ConversationScreen } from './components/ConversationScreen.tsx';
import { SettingsScreen } from './components/SettingsScreen.tsx';
import { GalaxyWatchFrame } from './components/GalaxyWatchFrame.tsx';
import { NativeKotlinExplorer } from './components/NativeKotlinExplorer.tsx';
import {
  Code,
  Watch,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Mic,
  Send,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export default function App() {
  // Configuration & Persistent State
  const [config, setConfig] = useState<JarvisConfig>(() => loadStoredConfig());
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [jarvisState, setJarvisState] = useState<JarvisState>('idle');
  const [isAmbientMode, setIsAmbientMode] = useState<boolean>(false);
  const [caseColor, setCaseColor] = useState<WatchCaseColor>('black');
  const [showFullChassis, setShowFullChassis] = useState<boolean>(true);
  const [compactPreview, setCompactPreview] = useState<boolean>(false);
  const [displayResolutionPx, setDisplayResolutionPx] = useState<number>(396);
  const [isKotlinExplorerOpen, setIsKotlinExplorerOpen] = useState<boolean>(false);
  const [voiceFallbackOpen, setVoiceFallbackOpen] = useState<boolean>(false);
  const [voiceFallbackText, setVoiceFallbackText] = useState<string>('');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [activeHomeCaption, setActiveHomeCaption] = useState<string>(
    INITIAL_WELCOME_MESSAGE.content
  );
  const [pendingDeviceAction, setPendingDeviceAction] = useState<VoiceActionIntent | null>(null);
  const [screenTorchActive, setScreenTorchActive] = useState<boolean>(false);

  // Compute responsive circular geometry specification (mirrors Kotlin rememberCircularResponsiveSpec 1:1)
  const responsiveSpec = useMemo(
    () => computeCircularResponsiveSpec(displayResolutionPx, 2.0, 1.0),
    [displayResolutionPx]
  );

  // Conversation history & Dismissed Suggestions
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const initialCfg = loadStoredConfig();
    return loadStoredHistory(initialCfg.persistentMemoryEnabled);
  });
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>(() =>
    loadDismissedSuggestions()
  );

  // Persist conversation history when updated
  useEffect(() => {
    saveStoredHistory(messages, config.persistentMemoryEnabled);
  }, [messages, config.persistentMemoryEnabled]);

  // Compute local privacy-preserving adaptive suggestions from conversation history
  const adaptiveSuggestions = useMemo(
    () => deriveAdaptiveSuggestions(messages, dismissedSuggestions, 2),
    [messages, dismissedSuggestions]
  );

  // Voice & Audio
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [audioActivity, setAudioActivity] = useState<number>(0);
  const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulated Watch Telemetry (Prototype simulation; native Wear OS uses Health Services / BatteryManager)
  const [telemetry, setTelemetry] = useState<WatchTelemetry>({
    batteryLevel: 84,
    charging: false,
    heartRate: 72,
    stepCount: 4210,
    coreTemperature: 31.4,
    connectionState: 'bluetooth_linked',
    currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  // Update clock every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Sync telemetry connectionState with operational state
  useEffect(() => {
    setTelemetry((prev) => ({
      ...prev,
      connectionState: jarvisState === 'disconnected' ? 'offline' : 'bluetooth_linked',
    }));
  }, [jarvisState]);

  // Audio animation modulation when speaking (disabled in AOD mode)
  useEffect(() => {
    if ((isSpeaking || jarvisState === 'speaking') && !isAmbientMode) {
      audioIntervalRef.current = setInterval(() => {
        setAudioActivity(Math.random() * 0.75 + 0.2);
      }, 120);
    } else if (jarvisState !== 'listening') {
      setAudioActivity(0);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    }
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [isSpeaking, jarvisState, isAmbientMode]);

  const handleSaveConfig = (newConfig: JarvisConfig) => {
    triggerWebHaptic(newConfig.hapticsEnabled ?? true, 'confirm');
    setConfig(newConfig);
    saveStoredConfig(newConfig);
  };

  const handleClearConfig = () => {
    triggerWebHaptic(config.hapticsEnabled ?? true, 'confirm');
    clearStoredConfig();
    setConfig(loadStoredConfig());
  };

  const handleClearHistory = () => {
    triggerWebHaptic(config.hapticsEnabled ?? true, 'confirm');
    clearStoredHistory();
    setActiveHomeCaption('');
    setMessages([{ ...INITIAL_WELCOME_MESSAGE, timestamp: Date.now() }]);
  };

  const handleDismissSuggestion = (id: string) => {
    audioEngine.playSoundEffect('tap', config.soundFxEnabled);
    setDismissedSuggestions((prev) => {
      const updated = prev.includes(id) ? prev : [...prev, id];
      saveDismissedSuggestions(updated);
      return updated;
    });
  };

  const handleResetSuggestions = () => {
    audioEngine.playSoundEffect('tap', config.soundFxEnabled);
    setDismissedSuggestions([]);
    saveDismissedSuggestions([]);
  };

  const handleStopSpeech = () => {
    audioEngine.stopSpeech();
    setIsSpeaking(false);
    setSpeakingMessageId(null);
    setAudioActivity(0);
    if (jarvisState === 'speaking') {
      setJarvisState('idle');
    }
  };

  const handleSpeakMessage = (msg: ChatMessage) => {
    handleStopSpeech();
    setIsSpeaking(true);
    setSpeakingMessageId(msg.id);
    setJarvisState('speaking');

    audioEngine.speak(msg.content, {
      rate: config.speechRate,
      pitch: config.speechPitch,
      accent: config.voiceAccent,
      preferredVoiceURI: config.preferredVoiceURI,
      onStart: () => {
        setIsSpeaking(true);
        setSpeakingMessageId(msg.id);
        setJarvisState('speaking');
      },
      onEnd: () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        setAudioActivity(0);
        setJarvisState('idle');
      },
      onError: () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        setAudioActivity(0);
        setJarvisState('idle');
      },
      onBoundary: () => {
        setAudioActivity(Math.random() * 0.8 + 0.15);
      },
    });
  };

  const handleConfirmDeviceAction = async () => {
    const pending = pendingDeviceAction;
    if (!pending) return;
    setPendingDeviceAction(null);
    if (pending.type === 'CLEAR_CONVERSATION') {
      handleClearHistory();
      const msg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'Conversation logs purged as confirmed, sir.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, msg]);
      handleSpeakMessage(msg);
      return;
    }

    const res = await executeDeviceControlIntent(pending, telemetry, { confirmed: true });
    if (typeof res.screenTorchEnabled === 'boolean') {
      setScreenTorchActive(res.screenTorchEnabled);
    }
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: res.spokenResponse,
      timestamp: Date.now(),
    };
    setActiveHomeCaption(res.spokenResponse);
    setMessages((prev) => [...prev, assistantMsg]);
    handleSpeakMessage(assistantMsg);
  };

  const handleCancelDeviceAction = () => {
    const pending = pendingDeviceAction;
    if (!pending) return;
    setPendingDeviceAction(null);
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: 'Action cancelled, sir.',
      timestamp: Date.now(),
    };
    setActiveHomeCaption('Action cancelled, sir.');
    setMessages((prev) => [...prev, assistantMsg]);
    setJarvisState('idle');
  };

  const executeQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    handleStopSpeech();
    audioEngine.stopSpeechRecognition();
    setVoiceFallbackOpen(false);
    setVoiceFallbackText('');
    setLiveTranscript('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    setActiveHomeCaption('');
    setMessages((prev) => [...prev, userMsg]);
    setJarvisState('processing');
    audioEngine.playSoundEffect('process', config.soundFxEnabled);

    // 1. Check verbal confirmation/cancellation of a pending disruptive action
    if (pendingDeviceAction) {
      const lower = trimmed.toLowerCase();
      if (['yes', 'confirm', 'proceed', 'affirmative', 'do it'].includes(lower)) {
        await handleConfirmDeviceAction();
        return;
      }
      if (['no', 'cancel', 'abort', 'stop', 'nevermind'].includes(lower)) {
        handleCancelDeviceAction();
        return;
      }
    }

    // 2. Check Native Wear OS Voice-to-Action & Device Control Intent Parser
    const deviceIntent = parseVoiceActionIntent(trimmed);
    if (deviceIntent.type !== 'NONE') {
      const actionResult = await executeDeviceControlIntent(deviceIntent, telemetry, {
        confirmed: false,
      });
      if (actionResult.requiresConfirmation && actionResult.confirmationIntent) {
        setPendingDeviceAction(actionResult.confirmationIntent);
      } else {
        triggerWebHaptic(config.hapticsEnabled ?? true, 'confirm');
      }
      if (typeof actionResult.screenTorchEnabled === 'boolean') {
        setScreenTorchActive(actionResult.screenTorchEnabled);
      }
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: actionResult.spokenResponse,
        timestamp: Date.now(),
      };
      setActiveHomeCaption(actionResult.spokenResponse);
      setMessages((prev) => [...prev, assistantMsg]);
      setJarvisState('speaking');
      audioEngine.playSoundEffect('speak', config.soundFxEnabled);
      handleSpeakMessage(assistantMsg);
      return;
    }

    try {
      const replyText = await generateJarvisReply(trimmed, [...messages, userMsg], config);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
        provider: config.provider,
        model: config.model,
      };

      setActiveHomeCaption(replyText);
      setMessages((prev) => [...prev, assistantMsg]);
      setJarvisState('speaking');
      audioEngine.playSoundEffect('speak', config.soundFxEnabled);
      handleSpeakMessage(assistantMsg);
    } catch (err) {
      console.error('Error processing query:', err);
      triggerWebHaptic(config.hapticsEnabled ?? true, 'error');
      setJarvisState('error');
      audioEngine.playSoundEffect('error', config.soundFxEnabled);

      const errReply =
        'Apologies, sir. An error occurred in the neural telemetry link. Please inspect your connection or configuration.';
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: errReply,
        timestamp: Date.now(),
      };
      setActiveHomeCaption(errReply);
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleTriggerVoice = () => {
    if (isAmbientMode) {
      setIsAmbientMode(false);
      return;
    }

    if (isSpeaking) {
      handleStopSpeech();
    }

    if (jarvisState === 'listening') {
      // Second tap on Mic / LISTENING finishes and submits captured speech or exits listening
      if (liveTranscript.trim() && liveTranscript !== 'Transcribing voice audio…') {
        const spoken = liveTranscript.trim();
        audioEngine.stopSpeechRecognition();
        // V5 Requirement 1: Stay on the current screen (do NOT auto-navigate to conversation)
        executeQuery(spoken);
        return;
      }
      if (audioEngine.isRecordingAudio()) {
        audioEngine.finishSpeechRecognition();
        return;
      }
      audioEngine.stopSpeechRecognition();
      setVoiceFallbackOpen(false);
      setLiveTranscript('');
      setJarvisState('idle');
      return;
    }

    triggerWebHaptic(config.hapticsEnabled ?? true, 'reactor_activate');
    setActiveHomeCaption('');
    setLiveTranscript('');
    setJarvisState('listening');
    audioEngine.playSoundEffect('listen', config.soundFxEnabled);

    const started = audioEngine.startSpeechRecognition({
      apiKey: config.apiKey,
      onVolumeChange: (level) => {
        setAudioActivity(level);
      },
      onTranscribing: () => {
        setLiveTranscript('Transcribing voice audio…');
      },
      onResult: (transcript, isFinal) => {
        setLiveTranscript(transcript);
        setVoiceFallbackText(transcript);
        if (isFinal && transcript.trim()) {
          audioEngine.stopSpeechRecognition();
          // V5 Requirement 1: Stay on the current screen (do NOT auto-navigate to conversation)
          executeQuery(transcript.trim());
        }
      },
      onError: () => {
        // Keep listening HUD open with a ready command so user can speak/type/send seamlessly
        setAudioActivity(0);
        setVoiceFallbackText((prev) => prev || 'Check my PC temps');
        setVoiceFallbackOpen(true);
      },
      onEnd: () => {
        setAudioActivity(0);
      },
    });

    if (!started) {
      setVoiceFallbackText('Check my PC temps');
      setVoiceFallbackOpen(true);
    }
  };

  // Simulated Hardware Button Handlers
  const handleTopHardwareButton = () => {
    triggerWebHaptic(config.hapticsEnabled ?? true, 'tap');
    audioEngine.playSoundEffect('tap', config.soundFxEnabled);
    if (isAmbientMode) {
      setIsAmbientMode(false);
      return;
    }
    if (activeScreen !== 'home') {
      setActiveScreen('home');
    } else {
      handleTriggerVoice();
    }
  };

  const handleBottomHardwareButton = () => {
    triggerWebHaptic(config.hapticsEnabled ?? true, 'tap');
    audioEngine.playSoundEffect('tap', config.soundFxEnabled);
    if (isAmbientMode) {
      setIsAmbientMode(false);
      return;
    }
    if (activeScreen === 'conversation' || activeScreen === 'settings') {
      setActiveScreen('home');
    }
  };

  const handleRotaryTurn = (direction: 'up' | 'down') => {
    triggerWebHaptic(config.hapticsEnabled ?? true, 'rotary_tick');
    audioEngine.playSoundEffect('tap', config.soundFxEnabled);
    const scrollables = document.querySelectorAll('.overflow-y-auto');
    scrollables.forEach((el) => {
      el.scrollBy({
        top: direction === 'down' ? 48 : -48,
        behavior: 'smooth',
      });
    });
  };

  // Border color for canvas-only mode matching selected case finish
  const getCanvasOnlyBorderClass = () => {
    if (caseColor === 'silver') {
      return 'border-slate-300 shadow-[0_0_30px_rgba(203,213,225,0.25)]';
    }
    if (caseColor === 'pink_gold') {
      return 'border-pink-400 shadow-[0_0_30px_rgba(244,114,182,0.25)]';
    }
    return 'border-cyan-800/80 shadow-[0_0_35px_rgba(0,240,255,0.18)]';
  };

  const renderWatchScreenContent = () => (
    <div
      className="w-full h-full flex flex-col items-center justify-between relative"
      style={{
        filter: isAmbientMode ? 'none' : `brightness(${config.brightness || 100}%)`,
      }}
    >
      {activeScreen === 'home' && !isAmbientMode && (
        <WatchStatusBar
          telemetry={telemetry}
          provider={config.provider}
          isAmbientMode={isAmbientMode}
          spec={responsiveSpec}
        />
      )}

      <div
        className="w-full flex-1 relative z-20"
        style={{
          height:
            activeScreen === 'home' && !isAmbientMode
              ? `calc(100% - ${responsiveSpec.topTelemetryHeightPx}px)`
              : '100%',
        }}
      >
        {activeScreen === 'home' && (
          <HomeScreen
            state={jarvisState}
            telemetry={telemetry}
            config={config}
            isAmbientMode={isAmbientMode}
            audioActivity={audioActivity}
            liveTranscript={liveTranscript}
            activeCaption={activeHomeCaption}
            suggestions={adaptiveSuggestions}
            onDismissSuggestion={handleDismissSuggestion}
            onTriggerVoice={handleTriggerVoice}
            onQuickQuery={(q) => {
              // V5 Requirement 1: Execute query directly on the Home screen without auto-navigating to Dialogue
              executeQuery(q);
            }}
            onNavigateToConversation={() => {
              triggerWebHaptic(config.hapticsEnabled ?? true, 'tap');
              audioEngine.playSoundEffect('tap', config.soundFxEnabled);
              setActiveScreen('conversation');
            }}
            onNavigateToSettings={() => {
              triggerWebHaptic(config.hapticsEnabled ?? true, 'tap');
              audioEngine.playSoundEffect('tap', config.soundFxEnabled);
              setActiveScreen('settings');
            }}
            onStopSpeech={handleStopSpeech}
            isSpeaking={isSpeaking}
            spec={responsiveSpec}
          />
        )}

        {activeScreen === 'conversation' && (
          <ConversationScreen
            messages={messages}
            state={jarvisState}
            isSpeaking={isSpeaking}
            currentlySpeakingMessageId={speakingMessageId}
            liveTranscript={liveTranscript}
            pendingConfirmationPrompt={pendingDeviceAction?.confirmationPrompt ?? null}
            onNavigateHome={() => {
              audioEngine.playSoundEffect('tap', config.soundFxEnabled);
              setActiveScreen('home');
            }}
            onTriggerVoice={handleTriggerVoice}
            onSubmitQuery={(q) => executeQuery(q)}
            onConfirmDeviceAction={handleConfirmDeviceAction}
            onCancelDeviceAction={handleCancelDeviceAction}
            onSpeakMessage={handleSpeakMessage}
            onStopSpeech={handleStopSpeech}
            onClearHistory={handleClearHistory}
            spec={responsiveSpec}
          />
        )}

        {activeScreen === 'settings' && (
          <SettingsScreen
            config={config}
            messageCount={messages.length}
            onSaveConfig={handleSaveConfig}
            onClearConfig={handleClearConfig}
            onClearHistory={handleClearHistory}
            onResetSuggestions={handleResetSuggestions}
            onNavigateHome={() => {
              audioEngine.playSoundEffect('tap', config.soundFxEnabled);
              setActiveScreen('home');
            }}
            spec={responsiveSpec}
          />
        )}
      </div>

      {/* High-Luminance AMOLED Screen Torch Overlay for Galaxy Watch 4 (SM-R860) */}
      {screenTorchActive && (
        <div
          onClick={() => setScreenTorchActive(false)}
          className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center gap-3 p-6 text-slate-950 cursor-pointer"
        >
          <span className="font-mono-code text-[11px] font-bold tracking-widest uppercase">
            J.A.R.V.I.S. Screen Torch
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setScreenTorchActive(false);
            }}
            className="min-h-[42px] px-5 py-2 rounded-full bg-slate-950 text-white font-hud font-bold text-xs tracking-wider uppercase shadow-lg active:scale-95 transition-all"
          >
            Turn Off Torch
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#02050d] text-slate-100 flex flex-col items-center justify-between selection:bg-cyan-500 selection:text-black">
      {/* Studio Simulator Header Toolbar */}
      <header className="w-full bg-slate-950/90 border-b border-cyan-900/40 backdrop-blur-md px-3 lg:px-5 py-2 flex flex-wrap items-center justify-between gap-2.5 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500 flex items-center justify-center glow-cyan-sm shrink-0">
            <span className="font-hud font-bold text-cyan-300 text-xs tracking-wider">J</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-hud text-xs md:text-sm font-bold tracking-wider text-cyan-200 uppercase">
                JARVIS — Galaxy Watch 4 AI
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono-code bg-cyan-950 text-cyan-300 border border-cyan-800">
                V6 Circular OS • SM-R860
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono-code">
              40mm Circular Super AMOLED • {displayResolutionPx}×{displayResolutionPx} px ({responsiveSpec.diameterDp}×{responsiveSpec.diameterDp} dp) • Center-Outward Radial Architecture
            </p>
          </div>
        </div>

        {/* Simulator Hardware, Round-Display Profile Matrix, Reactor & State Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 9-Profile Round-Display Validation Matrix Selector (Requirement 4) */}
          <div
            className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800"
            title="Select physical Wear OS circular display resolution profile (Default: 396×396 Galaxy Watch 4 40mm)"
          >
            <span className="text-[9.5px] font-mono-code text-cyan-400 uppercase font-bold">
              Display:
            </span>
            <select
              data-testid="round-display-profile-select"
              aria-label="Round Display Validation Profile"
              value={displayResolutionPx}
              onChange={(e) => setDisplayResolutionPx(Number(e.target.value))}
              className="bg-slate-950 text-cyan-200 text-[9.5px] font-mono-code px-1.5 py-0.5 rounded border border-cyan-900/70 outline-none focus:border-cyan-400 cursor-pointer"
            >
              {ROUND_DISPLAY_VALIDATION_PROFILES.map((profile) => (
                <option key={profile.resolutionPx} value={profile.resolutionPx}>
                  {profile.resolutionPx}×{profile.resolutionPx} — {profile.label}
                  {profile.isDefaultReference ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Reactor Theme Switcher (Syncs with Settings -> Arc Reactor) */}
          <div
            className="flex items-center gap-0.5 bg-slate-900 p-1 rounded-lg border border-slate-800"
            role="group"
            aria-label="Arc Reactor Theme Selector"
          >
            {REACTOR_THEMES.map((rt) => (
              <button
                key={rt.id}
                type="button"
                onClick={() =>
                  handleSaveConfig({ ...config, reactorTheme: rt.id as ReactorTheme })
                }
                className={`px-1.5 py-0.5 text-[9.5px] font-mono-code rounded transition-all ${
                  config.reactorTheme === rt.id
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-500/60 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`${rt.name} (${rt.era})`}
              >
                {rt.shortLabel}
              </button>
            ))}
          </div>

          {/* Operational State Switcher */}
          <div
            className="flex items-center gap-0.5 bg-slate-900 p-1 rounded-lg border border-slate-800"
            role="group"
            aria-label="Operational State Selector"
          >
            {(
              [
                { id: 'idle', label: 'Idle' },
                { id: 'listening', label: 'Listen' },
                { id: 'processing', label: 'Process' },
                { id: 'speaking', label: 'Speak' },
                { id: 'disconnected', label: 'Offline' },
                { id: 'error', label: 'Error' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  audioEngine.stopActiveSoundEffect();
                  if (st.id !== 'listening') {
                    audioEngine.stopSpeechRecognition();
                    setVoiceFallbackOpen(false);
                  }
                  if (st.id !== 'speaking' && isSpeaking) {
                    handleStopSpeech();
                  }
                  setJarvisState(st.id);
                }}
                className={`px-1.5 py-0.5 text-[9.5px] font-mono-code rounded transition-all ${
                  jarvisState === st.id
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-500/60 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Watch Finish Selector: Black, Silver, Pink Gold */}
          <div
            className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800"
            role="group"
            aria-label="Watch Chassis Finish"
          >
            {(
              [
                { id: 'black', label: 'Black', dot: 'bg-slate-800 border-slate-500' },
                { id: 'silver', label: 'Silver', dot: 'bg-slate-300 border-white' },
                { id: 'pink_gold', label: 'Pink Gold', dot: 'bg-pink-300 border-pink-400' },
              ] as const
            ).map((finish) => (
              <button
                key={finish.id}
                type="button"
                onClick={() => setCaseColor(finish.id)}
                className={`px-1.5 py-0.5 text-[9.5px] font-mono-code rounded flex items-center gap-1 transition-all ${
                  caseColor === finish.id
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-500/60 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full border ${finish.dot}`} />
                <span>{finish.label}</span>
              </button>
            ))}
          </div>

          {/* Chassis View Toggle */}
          <button
            type="button"
            onClick={() => setShowFullChassis(!showFullChassis)}
            className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-700 text-slate-300 text-[10.5px] font-mono-code flex items-center gap-1 active:scale-95 transition-all"
            title="Toggle Galaxy Watch 4 Chassis Frame"
          >
            <Watch className="w-3 h-3 text-cyan-400" />
            <span>{showFullChassis ? 'Chassis On' : 'Canvas Only'}</span>
          </button>

          {/* Preview Size Scale Toggle */}
          <button
            type="button"
            onClick={() => setCompactPreview(!compactPreview)}
            className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-700 text-slate-300 text-[10.5px] font-mono-code flex items-center gap-1 active:scale-95 transition-all"
            title="Toggle between 1:1 resolution and compact preview scale"
            aria-label="Toggle Preview Size"
          >
            {compactPreview ? (
              <Maximize2 className="w-3 h-3 text-cyan-400" />
            ) : (
              <Minimize2 className="w-3 h-3 text-cyan-400" />
            )}
            <span>
              {compactPreview ? 'Compact (80%)' : `${displayResolutionPx}×${displayResolutionPx} (1:1)`}
            </span>
          </button>

          {/* Ambient AOD Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsAmbientMode(!isAmbientMode)}
            className={`px-2 py-1 rounded-lg border text-[10.5px] font-mono-code flex items-center gap-1 active:scale-95 transition-all ${
              isAmbientMode
                ? 'bg-slate-800 border-slate-500 text-slate-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Galaxy Watch 4 Always-On Display (AOD) simulation"
          >
            {isAmbientMode ? (
              <Moon className="w-3 h-3 text-slate-300" />
            ) : (
              <Sun className="w-3 h-3" />
            )}
            <span>AOD {isAmbientMode ? 'Active' : 'Wake'}</span>
          </button>

          {/* Audio FX Toggle */}
          <button
            type="button"
            onClick={() =>
              handleSaveConfig({ ...config, soundFxEnabled: !config.soundFxEnabled })
            }
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-800 text-slate-300"
            title="Toggle synthesized Stark sound effects"
            aria-label="Toggle Sound Effects"
          >
            {config.soundFxEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {/* Native Kotlin Code Explorer Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsKotlinExplorerOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-black font-bold text-[10.5px] font-hud flex items-center gap-1 shadow-[0_0_15px_rgba(0,240,255,0.35)] active:scale-95 transition-all"
          >
            <Code className="w-3 h-3" />
            <span>Native Wear OS (Kotlin)</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Watch Display Arena */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(#082f49_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

        {/* Static Ambient Mode Banner */}
        {isAmbientMode && (
          <div className="mb-2 z-30 px-3 py-1 rounded-full bg-slate-900/95 border border-slate-700 text-slate-300 text-xs font-mono-code flex items-center gap-1.5">
            <Moon className="w-3.5 h-3.5 text-slate-400" />
            <span>AOD Simulation Active: Static low-luminance wireframe (Tap watch to wake)</span>
          </div>
        )}

        {/* Inline Simulated Voice Input Bar when browser SpeechRecognition is unavailable */}
        {voiceFallbackOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // V5 Requirement 1: Stay on the active screen (do NOT auto-navigate to conversation)
              executeQuery(voiceFallbackText);
            }}
            className="mb-2 z-30 flex items-center gap-2 bg-slate-900/95 border border-cyan-700/80 px-3 py-1.5 rounded-full shadow-lg max-w-md w-full"
          >
            <Mic className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <input
              type="text"
              value={voiceFallbackText}
              onChange={(e) => setVoiceFallbackText(e.target.value)}
              placeholder="Simulate spoken query to JARVIS..."
              aria-label="Simulated spoken query"
              className="flex-1 bg-transparent text-xs font-mono-code text-cyan-100 outline-none placeholder:text-slate-500"
              autoFocus
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-hud font-bold text-[10px] flex items-center gap-1"
            >
              <Send className="w-2.5 h-2.5" />
              <span>SEND</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVoiceFallbackOpen(false);
                setJarvisState('idle');
              }}
              className="p-1 text-slate-400 hover:text-slate-200"
              aria-label="Close voice input bar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Responsive Watch Scale Wrapper */}
        <div
          data-testid="watch-scale-container"
          className={`flex items-center justify-center transition-transform duration-300 origin-center ${
            compactPreview
              ? 'scale-[0.78]'
              : 'max-[420px]:scale-[0.76] max-[480px]:scale-[0.86] scale-100'
          }`}
        >
          {showFullChassis ? (
            <GalaxyWatchFrame
              caseColor={caseColor}
              onTopHardwareButton={handleTopHardwareButton}
              onBottomHardwareButton={handleBottomHardwareButton}
              onRotaryTurn={handleRotaryTurn}
              isAmbientMode={isAmbientMode}
              diameterPx={displayResolutionPx}
            >
              {renderWatchScreenContent()}
            </GalaxyWatchFrame>
          ) : (
            /* Pure Circular Watch Viewport with Finish-Matched Bezel Ring */
            <div
              data-testid="watch-circular-viewport"
              data-resolution={`${displayResolutionPx}x${displayResolutionPx}`}
              data-case-color={caseColor}
              style={{
                width: `${displayResolutionPx}px`,
                height: `${displayResolutionPx}px`,
              }}
              className={`relative rounded-full overflow-hidden flex flex-col items-center justify-between border-4 transition-all duration-300 ${getCanvasOnlyBorderClass()} ${
                isAmbientMode ? 'bg-black' : 'bg-[#010308]'
              }`}
            >
              {!isAmbientMode && (
                <div className="absolute inset-0 scanlines pointer-events-none opacity-25 z-10" />
              )}
              {renderWatchScreenContent()}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Technical Telemetry Dock */}
      <footer className="w-full bg-slate-950/90 border-t border-cyan-900/30 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between text-[11px] font-mono-code text-slate-400 z-30">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>
              DISPLAY: {displayResolutionPx}×{displayResolutionPx} px ({responsiveSpec.diameterDp}×{responsiveSpec.diameterDp} dp • {responsiveSpec.tier})
            </span>
          </div>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">
            REACTOR: {config.reactorTheme.toUpperCase()}
          </span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">
            FINISH: {caseColor.replace('_', ' ').toUpperCase()}
          </span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">
            AI ENGINE: {config.provider.toUpperCase()} ({config.model})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTriggerVoice}
            className="flex items-center gap-1 text-cyan-300 hover:text-cyan-100 active:scale-95 transition-all"
          >
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test Voice Input</span>
          </button>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={() => setIsKotlinExplorerOpen(true)}
            className="flex items-center gap-1 text-cyan-300 hover:text-cyan-100 active:scale-95 transition-all"
          >
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span>Wear OS Architecture</span>
          </button>
        </div>
      </footer>

      {/* Native Wear OS Kotlin Architecture Blueprint Modal */}
      <NativeKotlinExplorer
        isOpen={isKotlinExplorerOpen}
        onClose={() => setIsKotlinExplorerOpen(false)}
      />
    </div>
  );
}
