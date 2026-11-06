import React from 'react';
import { Wifi, WifiOff, BatteryFull, BatteryCharging } from 'lucide-react';
import { WatchTelemetry, AiProvider } from '../types/index.ts';
import { CircularResponsiveSpec, computeCircularResponsiveSpec } from '../utils/wearOsAudit.ts';

interface WatchStatusBarProps {
  telemetry: WatchTelemetry;
  provider?: AiProvider;
  isAmbientMode?: boolean;
  spec?: CircularResponsiveSpec;
}

/**
 * V6 Top Curved Watch Telemetry Bar (`WatchStatusBar`):
 *Synchronized 1:1 with native `WatchTopTelemetryBar` in `CircularHudComponents.kt`.
 * Displays ONLY:
 * 1. Current time
 * 2. Wi-Fi / connectivity indicator
 * 3. Battery percentage + icon
 *
 * The AI provider indicator (`GEMINI`, `OPENAI`, `ROUTER`) has been removed per V6 Requirement 2.
 */
export const WatchStatusBar: React.FC<WatchStatusBarProps> = ({
  telemetry,
  isAmbientMode = false,
  spec,
}) => {
  const resolvedSpec = spec ?? computeCircularResponsiveSpec(396);
  const isConnected = telemetry.connectionState !== 'offline';
  const fs = resolvedSpec.fontScale;

  if (isAmbientMode) {
    return null;
  }

  return (
    <div
      data-testid="watch-top-status-bar"
      className="w-full flex flex-col items-center justify-end px-4 select-none relative z-20 shrink-0"
      style={{
        height: `${Math.round(36 * resolvedSpec.scaleFactor)}px`,
        paddingTop: `${Math.round(resolvedSpec.headerTopInsetPx * 0.45)}px`,
      }}
    >
      {/* Curved Top Bezel Guide Arc */}
      <svg
        viewBox="0 0 240 24"
        className="absolute top-1.5 h-5 pointer-events-none opacity-60"
        style={{ width: `${Math.round(resolvedSpec.headerSafeWidthPx * 0.86)}px` }}
        aria-hidden="true"
      >
        <path
          d="M 18 20 Q 120 4 222 20"
          fill="none"
          stroke="#0e7490"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <circle cx="18" cy="20" r="1.2" fill="#06b6d4" />
        <circle cx="222" cy="20" r="1.2" fill="#06b6d4" />
      </svg>

      {/* Balanced 3-Element Telemetry Row inside Circular Top Chord (Time · Wi-Fi · Battery) */}
      <div
        className="flex items-center justify-center gap-2 font-mono-code tracking-wider text-cyan-200/90 leading-none pb-0.5 mx-auto"
        style={{
          maxWidth: `${resolvedSpec.headerSafeWidthPx}px`,
          fontSize: `${(10 * fs).toFixed(1)}px`,
        }}
      >
        <span data-testid="top-bar-time" className="text-slate-200 font-medium whitespace-nowrap">
          {telemetry.currentTime}
        </span>

        <span className="text-cyan-700 font-bold" aria-hidden="true">
          ·
        </span>

        <span data-testid="top-bar-connectivity" className="inline-flex items-center">
          {isConnected ? (
            <Wifi
              className="text-cyan-400 shrink-0"
              style={{ width: `${Math.round(11 * fs)}px`, height: `${Math.round(11 * fs)}px` }}
              aria-label="Connected"
            />
          ) : (
            <WifiOff
              className="text-amber-400 shrink-0"
              style={{ width: `${Math.round(11 * fs)}px`, height: `${Math.round(11 * fs)}px` }}
              aria-label="Offline"
            />
          )}
        </span>

        <span className="text-cyan-700 font-bold" aria-hidden="true">
          ·
        </span>

        <span
          data-testid="top-bar-battery"
          className="inline-flex items-center gap-1 text-slate-200 font-medium whitespace-nowrap"
        >
          {telemetry.charging ? (
            <BatteryCharging
              className="text-cyan-400 shrink-0"
              style={{ width: `${Math.round(11 * fs)}px`, height: `${Math.round(11 * fs)}px` }}
              aria-hidden="true"
            />
          ) : (
            <BatteryFull
              className="text-cyan-400/90 shrink-0"
              style={{ width: `${Math.round(11 * fs)}px`, height: `${Math.round(11 * fs)}px` }}
              aria-hidden="true"
            />
          )}
          <span>{telemetry.batteryLevel}%</span>
        </span>
      </div>
    </div>
  );
};
