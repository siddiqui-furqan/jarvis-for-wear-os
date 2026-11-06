import React, { useRef, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Mic,
  Volume2,
  VolumeX,
  RotateCcw,
  Loader2,
  ChevronUp,
  ChevronDown,
  Send,
} from 'lucide-react';
import { ChatMessage, JarvisState } from '../types/index.ts';
import {
  CircularResponsiveSpec,
  computeCircularResponsiveSpec,
} from '../utils/wearOsAudit.ts';

interface ConversationScreenProps {
  messages: ChatMessage[];
  state: JarvisState;
  isSpeaking: boolean;
  currentlySpeakingMessageId: string | null;
  liveTranscript?: string;
  pendingConfirmationPrompt?: string | null;
  onNavigateHome: () => void;
  onTriggerVoice: () => void;
  onSubmitQuery?: (query: string) => void;
  onConfirmDeviceAction?: () => void;
  onCancelDeviceAction?: () => void;
  onSpeakMessage: (message: ChatMessage) => void;
  onStopSpeech: () => void;
  onClearHistory: () => void;
  spec?: CircularResponsiveSpec;
}

export const ConversationScreen: React.FC<ConversationScreenProps> = ({
  messages,
  state,
  isSpeaking,
  currentlySpeakingMessageId,
  liveTranscript = '',
  pendingConfirmationPrompt = null,
  onNavigateHome,
  onTriggerVoice,
  onSubmitQuery,
  onConfirmDeviceAction,
  onCancelDeviceAction,
  onSpeakMessage,
  onStopSpeech,
  onClearHistory,
  spec,
}) => {
  const resolvedSpec = spec ?? computeCircularResponsiveSpec(396);
  const s = resolvedSpec.scaleFactor;
  const fs = resolvedSpec.fontScale;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [inlineInput, setInlineInput] = useState('');

  const updateScrollIndicators = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      setTimeout(updateScrollIndicators, 180);
    }
  }, [messages, state]);

  const scrollByAmount = (delta: number) => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollBy({ top: delta, behavior: 'smooth' });
    }
  };

  const sideBtnSizePx = Math.round(Math.max(28, Math.min(36, 32 * s)));

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
      {/* Subtle Radial Perimeter Framing */}
      <svg
        viewBox="0 0 396 396"
        className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
        aria-hidden="true"
      >
        <path
          d="M 28 198 A 170 170 0 0 1 54 106"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="0.9"
        />
        <path
          d="M 368 198 A 170 170 0 0 0 342 106"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="0.9"
        />
      </svg>

      {/* V6 Top Curved Navigation Header: Symmetric Left (Back) | Center (DIALOGUE · N) | Right (CLEAR) */}
      <div
        data-testid="dialogue-header"
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
              data-testid="dialogue-header-back"
              onClick={onNavigateHome}
              className="rounded-full bg-slate-900/90 border border-cyan-700/75 hover:border-cyan-400 flex items-center justify-center text-cyan-300 active:scale-90 transition-all shrink-0"
              style={{
                width: `${resolvedSpec.headerButtonSizePx}px`,
                height: `${resolvedSpec.headerButtonSizePx}px`,
              }}
              aria-label="Return to Home Screen"
              title="Return to Home Screen"
            >
              <ArrowLeft
                style={{
                  width: `${Math.round(resolvedSpec.headerButtonSizePx * 0.48)}px`,
                  height: `${Math.round(resolvedSpec.headerButtonSizePx * 0.48)}px`,
                }}
              />
            </button>
          </div>

          <div
            data-testid="dialogue-header-title"
            className="justify-self-center px-1.5 flex items-center justify-center gap-1 font-hud font-semibold tracking-[0.12em] text-cyan-200 uppercase whitespace-nowrap truncate w-full text-center"
            style={{ fontSize: `${(10 * fs).toFixed(1)}px` }}
          >
            <span className="truncate">DIALOGUE</span>
            <span className="text-cyan-600">·</span>
            <span className="font-mono-code text-cyan-400">{messages.length}</span>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              data-testid="dialogue-header-clear"
              onClick={onClearHistory}
              className="rounded-full bg-slate-900/90 border border-cyan-800/65 hover:border-red-400/70 font-mono-code font-bold text-slate-300 hover:text-red-300 active:scale-95 px-2.5 flex items-center justify-center shrink-0 whitespace-nowrap transition-all"
              style={{
                height: `${resolvedSpec.headerButtonSizePx}px`,
                fontSize: `${(8.0 * fs).toFixed(1)}px`,
              }}
              title="Clear Conversation History"
              aria-label="Clear History"
            >
              CLEAR
            </button>
          </div>
        </div>

        {/* Curved Top Arc Divider */}
        <svg viewBox="0 0 220 8" className="w-full h-[6px] mt-1 overflow-visible" aria-hidden="true">
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

      {/* Holographic Conversational Stream (No rectangular boxes) */}
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollIndicators}
        className="w-full mx-auto flex-1 overflow-y-auto scroll-smooth overscroll-contain no-scrollbar px-2.5 py-1.5 space-y-2.5 z-10"
        style={{ maxWidth: `${resolvedSpec.contentSafeWidthPx}px` }}
        tabIndex={0}
        aria-label="Conversation History Feed"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6 px-4">
            <svg viewBox="0 0 60 60" className="w-9 h-9 mb-2 opacity-60">
              <circle
                cx="30"
                cy="30"
                r="24"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle cx="30" cy="30" r="6" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
            </svg>
            <p className="font-hud text-[10.5px] tracking-widest text-cyan-300 uppercase">
              Channel Standby
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-[200px] mt-0.5">
              Tap Follow Up below to speak with J.A.R.V.I.S., sir.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isCurrentlyPlaying = currentlySpeakingMessageId === msg.id && isSpeaking;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            if (isUser) {
              return (
                <div
                  key={msg.id}
                  className="flex flex-col items-center text-center px-2.5 py-1 relative"
                >
                  <div className="flex items-center gap-1.5 text-[8px] font-mono-code tracking-widest text-cyan-400/80 uppercase mb-0.5">
                    <span>VOICE INPUT</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-500">{timeStr}</span>
                  </div>
                  <p
                    className="italic text-cyan-200/95 leading-snug max-w-[236px] text-balance"
                    style={{ fontSize: `${(10.8 * fs).toFixed(1)}px` }}
                  >
                    “{msg.content}”
                  </p>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className="relative flex flex-col items-center text-center px-2.5 py-1"
              >
                {/* Curved Upper Arc Separator between turns */}
                {idx > 0 && (
                  <svg
                    viewBox="0 0 220 8"
                    className="w-[172px] h-[6px] mb-1.5 opacity-55"
                    aria-hidden="true"
                  >
                    <path
                      d="M 10 6 Q 110 1 210 6"
                      fill="none"
                      stroke="#0891b2"
                      strokeWidth="0.9"
                    />
                    <circle cx="110" cy="3.5" r="1.4" fill="#22d3ee" />
                  </svg>
                )}

                {/* Subtle Radial Metadata Line */}
                <div className="flex items-center justify-center gap-1.5 text-[8.5px] font-mono-code tracking-wider mb-1">
                  <span className="font-hud font-semibold text-cyan-300 tracking-widest">
                    J.A.R.V.I.S.
                  </span>
                  <span className="text-cyan-800" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-500">{timeStr}</span>
                </div>

                {/* Readable Holographic Response Text */}
                <p
                  className="leading-[1.52] text-slate-100 font-normal max-w-[248px] break-words"
                  style={{ fontSize: `${(11.2 * fs).toFixed(1)}px` }}
                >
                  {msg.content}
                </p>

                {/* Unboxed Radial Audio Controls (Replay / Play / Stop) */}
                <div className="mt-1 flex items-center justify-center gap-3 text-[8.5px] font-mono-code">
                  {isCurrentlyPlaying ? (
                    <>
                      <span className="text-cyan-300 tracking-wider">SPEAKING</span>
                      <span className="text-cyan-800">·</span>
                      <button
                        type="button"
                        onClick={onStopSpeech}
                        className="inline-flex items-center gap-1 text-red-300 hover:text-red-200 active:scale-95"
                        title="Stop speech playback"
                        aria-label="Stop audio"
                      >
                        <VolumeX className="w-2.5 h-2.5" />
                        <span>Stop</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSpeakMessage(msg)}
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-200 active:scale-95 transition-colors"
                      title="Play or replay spoken response"
                      aria-label="Play audio response"
                    >
                      <Volume2 className="w-2.5 h-2.5" />
                      <span>Replay Audio</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Disruptive Device Action Confirmation Prompt */}
        {pendingConfirmationPrompt && (
          <div className="max-w-[228px] mx-auto px-3 py-2 rounded-2xl bg-slate-950/95 border border-cyan-400/90 space-y-2 shadow-[0_0_14px_rgba(0,240,255,0.2)]">
            <p className="text-[10px] text-cyan-100 leading-snug">
              {pendingConfirmationPrompt}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onConfirmDeviceAction}
                className="min-h-[36px] px-2.5 py-1 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-hud font-bold text-[9px] uppercase tracking-wider active:scale-95 transition-all"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={onCancelDeviceAction}
                className="min-h-[36px] px-2.5 py-1 rounded-xl bg-red-950/80 border border-red-500 text-red-200 hover:bg-red-900/80 font-hud font-bold text-[9px] uppercase tracking-wider active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Processing State */}
        {state === 'processing' && (
          <div className="flex flex-col items-center justify-center py-2 text-indigo-300 text-[9.5px] font-mono-code">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 mb-1" />
            <span>Synthesizing response, sir…</span>
          </div>
        )}

        {/* Listening State */}
        {state === 'listening' && (
          <div className="flex flex-col items-center justify-center py-1 px-2 text-cyan-200 text-[9.5px] font-mono-code">
            <span className="tracking-widest uppercase text-cyan-300 glow-cyan-text">
              {liveTranscript ? `“${liveTranscript}”` : 'Receiving Voice Input…'}
            </span>
          </div>
        )}

        {/* Dedicated Typed-Message Composer (Always available without activating microphone) */}
        {onSubmitQuery && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = inlineInput.trim();
              if (!q) return;
              setInlineInput('');
              onSubmitQuery(q);
            }}
            className="flex items-center gap-1.5 w-full mx-auto px-2.5 py-1 rounded-full bg-slate-950/95 border border-cyan-500/70 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
            style={{ maxWidth: `${Math.round(resolvedSpec.contentSafeWidthPx * 0.80)}px` }}
          >
            <input
              type="text"
              value={inlineInput}
              onChange={(e) => setInlineInput(e.target.value)}
              placeholder="Type message…"
              aria-label="Follow-up voice or text query"
              className="flex-1 min-w-0 bg-transparent text-[9.5px] font-mono-code text-cyan-100 placeholder:text-cyan-500/70 outline-none"
            />
            <button
              type="submit"
              className="px-2 py-0.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-hud font-bold text-[8.5px] tracking-wider flex items-center gap-0.5 shrink-0 active:scale-95"
              aria-label="Submit Follow-up Query"
            >
              <Send className="w-2.5 h-2.5" />
              <span>SEND</span>
            </button>
          </form>
        )}
      </div>

      {/* V6 Bottom Curved Orbital Action Dock (Symmetric side slots + single-line FOLLOW UP button) */}
      <div
        data-testid="dialogue-bottom-dock"
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

        {/* Orbital Connecting Arc behind bottom action nodes */}
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
          className="w-full grid items-center justify-items-center gap-2.5 px-1.5"
          style={{
            gridTemplateColumns: `${sideBtnSizePx}px 1fr ${sideBtnSizePx}px`,
            minHeight: `${Math.round(resolvedSpec.bottomDockHeightPx * 0.78)}px`,
          }}
        >
          <button
            type="button"
            onClick={onNavigateHome}
            className="-translate-y-1 rounded-full bg-slate-950/90 border border-cyan-800/75 hover:border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.18)] flex items-center justify-center text-cyan-300 active:scale-90 transition-all shrink-0"
            style={{ width: `${sideBtnSizePx}px`, height: `${sideBtnSizePx}px` }}
            title="Return to Reactor"
            aria-label="Return to Reactor"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              const trimmed = inlineInput.trim();
              if (trimmed && onSubmitQuery) {
                setInlineInput('');
                onSubmitQuery(trimmed);
              } else {
                onTriggerVoice();
              }
            }}
            className={`translate-y-0.5 justify-self-center flex items-center justify-center gap-1 px-3 py-1.5 rounded-full font-hud font-bold tracking-wider whitespace-nowrap active:scale-95 transition-all ${
              state === 'listening' && !inlineInput.trim()
                ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_12px_rgba(0,240,255,0.35)]'
            }`}
            style={{ fontSize: `${(9.0 * fs).toFixed(1)}px` }}
            aria-label={
              inlineInput.trim()
                ? 'Send Typed Message'
                : state === 'listening'
                ? 'Listening'
                : 'Ask Follow-up Question'
            }
          >
            {inlineInput.trim() ? (
              <Send className="w-3 h-3 shrink-0" />
            ) : (
              <Mic className="w-3 h-3 shrink-0" />
            )}
            <span className="whitespace-nowrap">
              {inlineInput.trim()
                ? 'SEND TEXT'
                : state === 'listening'
                ? 'LISTENING'
                : 'FOLLOW UP'}
            </span>
          </button>

          {isSpeaking ? (
            <button
              type="button"
              onClick={onStopSpeech}
              className="-translate-y-1 rounded-full bg-red-950/85 border border-red-600/70 shadow-[0_0_8px_rgba(239,68,68,0.25)] flex items-center justify-center text-red-300 active:scale-90 transition-all shrink-0"
              style={{ width: `${sideBtnSizePx}px`, height: `${sideBtnSizePx}px` }}
              title="Stop Speech"
              aria-label="Stop Speech"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => scrollByAmount(canScrollDown ? 90 : -90)}
              className="-translate-y-1 rounded-full bg-slate-950/90 border border-cyan-900/75 hover:border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.18)] flex items-center justify-center text-cyan-300 active:scale-90 transition-all shrink-0"
              style={{ width: `${sideBtnSizePx}px`, height: `${sideBtnSizePx}px` }}
              title={canScrollDown ? 'Scroll Down' : 'Scroll Up'}
              aria-label={canScrollDown ? 'Scroll Down' : 'Scroll Up'}
            >
              {canScrollDown ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
