import React, { useState } from 'react';
import { Mic, MessageSquare, Settings, VolumeX, X, Send } from 'lucide-react';
import { ArcReactor } from './ArcReactor.tsx';
import {
  JarvisState,
  WatchTelemetry,
  JarvisConfig,
  AdaptiveSuggestion,
} from '../types/index.ts';
import { getJarvisGreeting } from '../services/ai/personality.ts';
import {
  resolveHomeScreenCaption,
  CircularResponsiveSpec,
  computeCircularResponsiveSpec,
} from '../utils/wearOsAudit.ts';

interface HomeScreenProps {
  state: JarvisState;
  telemetry: WatchTelemetry;
  config: JarvisConfig;
  isAmbientMode: boolean;
  audioActivity: number;
  liveTranscript?: string;
  activeCaption?: string;
  suggestions: AdaptiveSuggestion[];
  onDismissSuggestion: (id: string) => void;
  onTriggerVoice: () => void;
  onQuickQuery: (query: string) => void;
  onNavigateToConversation: () => void;
  onNavigateToSettings: () => void;
  onStopSpeech: () => void;
  isSpeaking: boolean;
  spec?: CircularResponsiveSpec;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  state,
  telemetry,
  config,
  isAmbientMode,
  audioActivity,
  liveTranscript = '',
  activeCaption = '',
  suggestions,
  onDismissSuggestion,
  onTriggerVoice,
  onQuickQuery,
  onNavigateToConversation,
  onNavigateToSettings,
  onStopSpeech,
  isSpeaking,
  spec,
}) => {
  const [inlineCommand, setInlineCommand] = useState('');
  const greeting = getJarvisGreeting();
  const resolvedSpec = spec ?? computeCircularResponsiveSpec(396);
  const s = resolvedSpec.scaleFactor;
  const fs = resolvedSpec.fontScale;

  const getStateDetails = () => {
    switch (state) {
      case 'listening':
        return {
          label: 'LISTENING',
          sub: liveTranscript ? `“${liveTranscript}”` : 'Speak now or type below, sir',
          textClass: 'text-cyan-200 glow-cyan-text',
          arcColor: '#22d3ee',
        };
      case 'processing':
        return {
          label: 'PROCESSING',
          sub: 'Synthesizing telemetry…',
          textClass: 'text-indigo-200',
          arcColor: '#818cf8',
        };
      case 'speaking':
        return {
          label: 'SPEAKING',
          sub: 'Audio transmission active · Tap core to mute',
          textClass: 'text-sky-200 glow-cyan-text',
          arcColor: '#38bdf8',
        };
      case 'disconnected':
        return {
          label: 'OFFLINE',
          sub: 'Local contingency core',
          textClass: 'text-amber-300',
          arcColor: '#f59e0b',
        };
      case 'error':
        return {
          label: 'SYSTEM ALERT',
          sub: 'Tap core to re-initialize',
          textClass: 'text-red-300',
          arcColor: '#ef4444',
        };
      case 'idle':
      default:
        return {
          label: 'ONLINE · READY',
          sub: greeting,
          textClass: 'text-cyan-300/95',
          arcColor: '#0891b2',
        };
    }
  };

  const statusInfo = getStateDetails();

  // Static minimal AOD mode supporting the 3 selectable AOD visual themes
  if (isAmbientMode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-8 py-6 text-center select-none bg-black relative">
        {config.aodTheme === 'chronograph_arc' && (
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-4 w-[calc(100%-32px)] h-[calc(100%-32px)] pointer-events-none"
          >
            <circle
              cx="100"
              cy="100"
              r="94"
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
              strokeDasharray="2 8"
            />
            <path
              d="M 40 35 A 88 88 0 0 1 160 35"
              fill="none"
              stroke="#334155"
              strokeWidth="1"
            />
            <path
              d="M 40 165 A 88 88 0 0 0 160 165"
              fill="none"
              stroke="#334155"
              strokeWidth="1"
            />
          </svg>
        )}

        <div
          className="font-hud font-medium tracking-widest text-slate-400"
          style={{ fontSize: `${Math.round(24 * fs)}px` }}
        >
          {telemetry.currentTime}
        </div>

        {config.aodTheme !== 'stealth_digital' && (
          <div className="my-2">
            <ArcReactor
              state={state}
              theme={config.reactorTheme}
              isAmbientMode={true}
              size={Math.round(98 * s)}
              interactive={false}
            />
          </div>
        )}

        <div
          className="font-mono-code tracking-widest text-slate-500 uppercase mt-1"
          style={{ fontSize: `${(9 * fs).toFixed(1)}px` }}
        >
          J.A.R.V.I.S. · {telemetry.batteryLevel}%
        </div>
      </div>
    );
  }

  const visibleSuggestions = config.adaptiveSuggestionsEnabled
    ? suggestions.slice(0, 2)
    : [];

  const visibleCaption = resolveHomeScreenCaption(
    config.homeCaptionsEnabled ?? true,
    state,
    activeCaption
  );

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between text-center select-none relative overflow-hidden"
      style={{
        paddingLeft: `${resolvedSpec.outerHorizontalPaddingPx}px`,
        paddingRight: `${resolvedSpec.outerHorizontalPaddingPx}px`,
        paddingBottom: `${Math.round(resolvedSpec.outerVerticalPaddingPx * 0.75)}px`,
        paddingTop: '2px',
      }}
    >
      {/* Subtle Radial Instrumentation Ring in Background */}
      <svg
        viewBox="0 0 396 396"
        className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
        aria-hidden="true"
      >
        <circle
          cx="198"
          cy="198"
          r="184"
          fill="none"
          stroke="#0e7490"
          strokeWidth="0.6"
          strokeDasharray="3 9"
        />
        <path
          d="M 32 198 A 166 166 0 0 1 56 112"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="0.8"
        />
        <path
          d="M 364 198 A 166 166 0 0 0 340 112"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="0.8"
        />
      </svg>

      {/* Center-Outward Primary Focal Anchor: Responsive Non-Shifting Animated Arc Reactor + Dynamic Status */}
      <div
        data-testid="home-arc-reactor-wrapper"
        className="relative flex-1 flex flex-col items-center justify-center z-10"
      >
        <ArcReactor
          state={state}
          theme={config.reactorTheme}
          size={resolvedSpec.homeReactorSizePx}
          interactive={true}
          onClick={onTriggerVoice}
          audioActivity={audioActivity}
          animationIntensity={config.animationIntensity}
          accentIntensity={config.accentIntensity}
        />

        {/* Curved Arc Separator & Dynamic Status + Greeting in Fixed-Height Rows */}
        <div
          className="mt-1 flex flex-col items-center mx-auto"
          style={{ maxWidth: `${resolvedSpec.reservedCaptionSlotWidthPx}px` }}
        >
          <svg
            viewBox="0 0 180 10"
            className="overflow-visible shrink-0"
            style={{ width: `${Math.round(144 * s)}px`, height: `${Math.round(7 * s)}px` }}
            aria-hidden="true"
          >
            <path
              d="M 10 2 Q 90 9 170 2"
              fill="none"
              stroke={statusInfo.arcColor}
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>

          <span
            data-testid="jarvis-state-label"
            className={`flex items-center justify-center font-hud font-semibold tracking-[0.18em] uppercase transition-colors duration-300 ${statusInfo.textClass}`}
            style={{
              height: `${Math.round(15 * s)}px`,
              fontSize: `${(10 * fs).toFixed(1)}px`,
            }}
          >
            {statusInfo.label}
          </span>

          <h1
            data-testid="jarvis-greeting"
            className="flex items-center justify-center font-normal text-slate-300/95 leading-tight truncate mt-0.5"
            style={{
              height: `${Math.round(16 * s)}px`,
              maxWidth: `${Math.round(resolvedSpec.reservedCaptionSlotWidthPx * 0.94)}px`,
              fontSize: `${(10.5 * fs).toFixed(1)}px`,
            }}
          >
            {state === 'idle' ? greeting : statusInfo.sub}
          </h1>
        </div>
      </div>

      {/* Bottom Zone: Reserved Fixed-Height Caption / Interactive Slot + Orbital Circular Dock */}
      <div className="w-full flex flex-col items-center gap-1 z-10 shrink-0">
        {/* Invariant Reserved Slot: Guarantees the Arc Reactor NEVER shifts position or resizes */}
        <div
          data-testid="home-caption-slot"
          className="mx-auto flex items-center justify-center shrink-0"
          style={{
            height: `${resolvedSpec.reservedCaptionSlotHeightPx}px`,
            width: `${resolvedSpec.reservedCaptionSlotWidthPx}px`,
          }}
        >
          {state === 'listening' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const textToSubmit = (inlineCommand || liveTranscript || 'Status report').trim();
                setInlineCommand('');
                onQuickQuery(textToSubmit);
              }}
              className="flex items-center gap-1.5 w-full mx-auto px-2.5 py-1 rounded-full bg-slate-950/95 border border-cyan-500/70 shadow-[0_0_12px_rgba(0,240,255,0.2)]"
              style={{ maxWidth: `${Math.round(resolvedSpec.reservedCaptionSlotWidthPx * 0.94)}px` }}
            >
              <input
                type="text"
                value={inlineCommand || liveTranscript}
                onChange={(e) => setInlineCommand(e.target.value)}
                placeholder="Speak or type command…"
                aria-label="Voice or text command input"
                className="flex-1 min-w-0 bg-transparent font-mono-code text-cyan-100 placeholder:text-cyan-500/70 outline-none"
                style={{ fontSize: `${(9.5 * fs).toFixed(1)}px` }}
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-hud font-bold tracking-wider flex items-center gap-0.5 shrink-0 active:scale-95"
                style={{ fontSize: `${(8.2 * fs).toFixed(1)}px` }}
                aria-label="Send Voice Command"
              >
                <Send className="w-2.5 h-2.5" />
                <span>SEND</span>
              </button>
            </form>
          ) : visibleCaption ? (
            <div
              data-testid="home-response-caption"
              onClick={isSpeaking ? onStopSpeech : undefined}
              role={isSpeaking ? 'button' : undefined}
              title={isSpeaking ? 'Tap to stop spoken playback' : 'Latest spoken response'}
              className={`w-full px-2.5 py-1 rounded-xl bg-slate-950/75 border ${
                isSpeaking
                  ? 'border-cyan-400/70 cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.16)]'
                  : 'border-cyan-900/50'
              } flex items-center justify-center transition-colors`}
              style={{ maxWidth: `${Math.round(resolvedSpec.reservedCaptionSlotWidthPx * 0.96)}px` }}
            >
              <p
                className="leading-[1.26] text-slate-100/95 line-clamp-3 text-center break-words"
                style={{ fontSize: `${(9.2 * fs).toFixed(1)}px` }}
              >
                {visibleCaption}
              </p>
            </div>
          ) : isSpeaking ? (
            <button
              type="button"
              onClick={onStopSpeech}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/75 border border-red-500/50 text-red-200 font-mono-code active:scale-95 transition-all"
              style={{ fontSize: `${(8.8 * fs).toFixed(1)}px` }}
            >
              <VolumeX className="w-3 h-3 text-red-400 shrink-0" />
              <span className="truncate">Stop Voice Playback</span>
            </button>
          ) : (
            visibleSuggestions.length > 0 &&
            state === 'idle' && (
              <div
                className="flex flex-col items-center gap-0.5 w-full mx-auto"
                style={{ maxWidth: `${Math.round(resolvedSpec.reservedCaptionSlotWidthPx * 0.92)}px` }}
                aria-label="Adaptive Suggestions"
              >
                {visibleSuggestions.map((item) => (
                  <div
                    key={item.id}
                    className="group relative flex items-center justify-between gap-1.5 w-full px-2 py-0.5 border-b border-cyan-500/20 hover:border-cyan-400/60 transition-all"
                  >
                    <span
                      className="font-mono-code text-cyan-400/80 select-none"
                      style={{ fontSize: `${(8 * fs).toFixed(1)}px` }}
                      aria-hidden="true"
                    >
                      ›
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuickQuery(item.command || item.prompt || '')}
                      className="flex-1 text-center font-sans text-cyan-100/90 hover:text-cyan-200 truncate active:scale-98 tracking-wide"
                      style={{ fontSize: `${(9.2 * fs).toFixed(1)}px` }}
                    >
                      {item.shortLabel || item.label}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissSuggestion(item.id);
                      }}
                      className="text-slate-500 hover:text-cyan-300 p-0.5 shrink-0 transition-colors"
                      title={`Dismiss suggestion "${item.shortLabel}"`}
                      aria-label={`Dismiss suggestion ${item.shortLabel}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Orbital Circular Navigation Dock along the Bottom Curve */}
        <div
          className="relative flex items-center justify-center mx-auto"
          style={{
            gap: `${Math.round(20 * s)}px`,
            maxWidth: `${Math.round(188 * s)}px`,
            height: `${Math.round(38 * s)}px`,
          }}
        >
          {/* Subtle Orbital Connecting Arc */}
          <svg
            viewBox="0 0 150 24"
            className="absolute inset-x-0 bottom-1 w-full h-5 pointer-events-none opacity-55"
            aria-hidden="true"
          >
            <path
              d="M 18 6 Q 75 22 132 6"
              fill="none"
              stroke="#0e7490"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </svg>

          <button
            type="button"
            onClick={onNavigateToConversation}
            className="-translate-y-1.5 rounded-full bg-slate-950/90 border border-cyan-800/70 hover:border-cyan-400 flex items-center justify-center text-cyan-300 active:scale-90 transition-all z-10"
            style={{
              width: `${resolvedSpec.homeOrbitalSideNodeSizePx}px`,
              height: `${resolvedSpec.homeOrbitalSideNodeSizePx}px`,
            }}
            title="Conversation Interface"
            aria-label="Open Conversation History"
          >
            <MessageSquare
              style={{
                width: `${Math.round(resolvedSpec.homeOrbitalSideNodeSizePx * 0.44)}px`,
                height: `${Math.round(resolvedSpec.homeOrbitalSideNodeSizePx * 0.44)}px`,
              }}
            />
          </button>

          <button
            type="button"
            onClick={onTriggerVoice}
            className={`translate-y-0.5 rounded-full flex items-center justify-center active:scale-90 transition-all z-10 ${
              state === 'listening'
                ? 'bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.6)]'
                : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_16px_rgba(0,240,255,0.45)]'
            }`}
            style={{
              width: `${resolvedSpec.homeOrbitalCenterNodeSizePx}px`,
              height: `${resolvedSpec.homeOrbitalCenterNodeSizePx}px`,
            }}
            title="Start Voice Interaction"
            aria-label="Start Voice Interaction"
          >
            <Mic
              style={{
                width: `${Math.round(resolvedSpec.homeOrbitalCenterNodeSizePx * 0.46)}px`,
                height: `${Math.round(resolvedSpec.homeOrbitalCenterNodeSizePx * 0.46)}px`,
              }}
            />
          </button>

          <button
            type="button"
            onClick={onNavigateToSettings}
            className="-translate-y-1.5 rounded-full bg-slate-950/90 border border-cyan-800/70 hover:border-cyan-400 flex items-center justify-center text-cyan-300 active:scale-90 transition-all z-10"
            style={{
              width: `${resolvedSpec.homeOrbitalSideNodeSizePx}px`,
              height: `${resolvedSpec.homeOrbitalSideNodeSizePx}px`,
            }}
            title="JARVIS Settings Hub"
            aria-label="Open Settings"
          >
            <Settings
              style={{
                width: `${Math.round(resolvedSpec.homeOrbitalSideNodeSizePx * 0.44)}px`,
                height: `${Math.round(resolvedSpec.homeOrbitalSideNodeSizePx * 0.44)}px`,
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
