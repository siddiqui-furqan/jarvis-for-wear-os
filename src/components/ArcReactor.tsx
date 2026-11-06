import React, { useId } from 'react';
import {
  JarvisState,
  ReactorTheme,
  AnimationIntensity,
  AccentIntensity,
} from '../types/index.ts';

interface ArcReactorProps {
  state: JarvisState;
  theme?: ReactorTheme;
  isAmbientMode?: boolean;
  size?: number;
  interactive?: boolean;
  onClick?: () => void;
  audioActivity?: number;
  animationIntensity?: AnimationIntensity;
  accentIntensity?: AccentIntensity;
}

export const ArcReactor: React.FC<ArcReactorProps> = ({
  state,
  theme = 'mk2',
  isAmbientMode = false,
  size = 152,
  interactive = true,
  onClick,
  audioActivity = 0,
  animationIntensity = 'full',
  accentIntensity = 'standard',
}) => {
  const filterId = useId();
  const normalizedTheme: 'mk1' | 'mk2' | 'mk3' | 'nanotech' =
    theme === 'mark_i' || theme === 'mk1'
      ? 'mk1'
      : theme === 'mark_lxxxv' || theme === 'mk3'
      ? 'mk3'
      : theme === 'nanotech'
      ? 'nanotech'
      : 'mk2';

  // Static minimal AOD wireframe specific to each reactor theme (Requirement 3 & 7)
  if (isAmbientMode) {
    return (
      <div
        className="relative flex items-center justify-center select-none"
        style={{ width: size, height: size }}
        data-state="ambient"
        data-reactor-theme={theme}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
          <circle
            cx="100"
            cy="100"
            r="86"
            fill="none"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray={normalizedTheme === 'mk1' ? '10 8' : '16 6'}
          />
          {normalizedTheme === 'mk1' && (
            <>
              {Array.from({ length: 10 }, (_, i) => (
                <rect
                  key={i}
                  x="95"
                  y="24"
                  width="10"
                  height="11"
                  rx="1"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="0.9"
                  transform={`rotate(${i * 36} 100 100)`}
                />
              ))}
              <circle cx="100" cy="100" r="46" fill="none" stroke="#475569" strokeWidth="1" />
              <circle cx="100" cy="100" r="18" fill="none" stroke="#64748b" strokeWidth="1" />
            </>
          )}
          {normalizedTheme === 'mk2' && (
            <>
              <circle cx="100" cy="100" r="56" fill="none" stroke="#475569" strokeWidth="1" />
              <polygon
                points="100,58 136,120 64,120"
                fill="none"
                stroke="#64748b"
                strokeWidth="1.1"
              />
              <circle cx="100" cy="100" r="12" fill="none" stroke="#475569" strokeWidth="0.9" />
            </>
          )}
          {normalizedTheme === 'mk3' && (
            <>
              <circle cx="100" cy="100" r="64" fill="none" stroke="#475569" strokeWidth="1" />
              {Array.from({ length: 6 }, (_, i) => (
                <line
                  key={i}
                  x1="100"
                  y1="36"
                  x2="100"
                  y2="66"
                  stroke="#475569"
                  strokeWidth="1"
                  transform={`rotate(${i * 60} 100 100)`}
                />
              ))}
              <circle cx="100" cy="100" r="24" fill="none" stroke="#64748b" strokeWidth="1.1" />
            </>
          )}
          {normalizedTheme === 'nanotech' && (
            <>
              <polygon
                points="100,22 167,61 167,139 100,178 33,139 33,61"
                fill="none"
                stroke="#475569"
                strokeWidth="1"
              />
              <polygon
                points="100,52 142,124 58,124"
                fill="none"
                stroke="#64748b"
                strokeWidth="1.1"
              />
            </>
          )}
        </svg>
      </div>
    );
  }

  // Base palette modulated by operational state and accentIntensity
  const getPalette = () => {
    const isVivid = accentIntensity === 'vivid';
    const isIce = accentIntensity === 'ice';

    switch (state) {
      case 'listening':
        return {
          primary: '#22D3EE',
          secondary: '#06B6D4',
          accent: '#CFFAFE',
          glow: isVivid ? 'rgba(34, 211, 238, 0.72)' : 'rgba(34, 211, 238, 0.52)',
          core: '#ECFEFF',
          ring: '#0891B2',
        };
      case 'processing':
        return {
          primary: '#38BDF8',
          secondary: '#818CF8',
          accent: '#E0E7FF',
          glow: isVivid ? 'rgba(99, 102, 241, 0.72)' : 'rgba(56, 189, 248, 0.55)',
          core: '#EEF2FF',
          ring: '#4F46E5',
        };
      case 'speaking':
        return {
          primary: '#00F0FF',
          secondary: '#38BDF8',
          accent: '#FFFFFF',
          glow: isVivid ? 'rgba(0, 240, 255, 0.8)' : 'rgba(0, 240, 255, 0.62)',
          core: '#FFFFFF',
          ring: '#0284C7',
        };
      case 'disconnected':
        return {
          primary: '#F59E0B',
          secondary: '#B45309',
          accent: '#FDE68A',
          glow: 'rgba(245, 158, 11, 0.28)',
          core: '#FEF3C7',
          ring: '#78350F',
        };
      case 'error':
        return {
          primary: '#EF4444',
          secondary: '#B91C1C',
          accent: '#FECACA',
          glow: 'rgba(239, 68, 68, 0.52)',
          core: '#FEE2E2',
          ring: '#7F1D1D',
        };
      case 'idle':
      default:
        return {
          primary: isIce ? '#7DD3FC' : '#00F0FF',
          secondary: isIce ? '#38BDF8' : '#0284C7',
          accent: '#E0F2FE',
          glow: isVivid ? 'rgba(0, 240, 255, 0.6)' : 'rgba(0, 240, 255, 0.38)',
          core: '#F0F9FF',
          ring: '#0369A1',
        };
    }
  };

  const pal = getPalette();
  const isReduced = animationIntensity === 'reduced' || state === 'disconnected';
  const isSubtle = animationIntensity === 'subtle';

  const getForwardSpin = () => {
    if (isReduced) return '';
    if (state === 'processing') return 'animate-[spin_3s_linear_infinite]';
    if (state === 'listening') return 'animate-[spin_10s_linear_infinite]';
    if (state === 'speaking') return 'animate-[spin_14s_linear_infinite]';
    return isSubtle ? 'animate-[spin_42s_linear_infinite]' : 'animate-[spin_26s_linear_infinite]';
  };

  const getReverseSpin = () => {
    if (isReduced) return '';
    if (state === 'processing') return 'animate-[spin_4.2s_linear_infinite_reverse]';
    if (state === 'listening') return 'animate-[spin_8s_linear_infinite_reverse]';
    if (state === 'speaking') return 'animate-[spin_12s_linear_infinite_reverse]';
    return isSubtle
      ? 'animate-[spin_50s_linear_infinite_reverse]'
      : 'animate-[spin_32s_linear_infinite_reverse]';
  };

  const audioScale = state === 'speaking' ? 1 + audioActivity * 0.1 : 1;

  // Render Theme A: IRON MAN 1 — Original Industrial Chest Reactor
  const renderMark1 = () => (
    <>
      {/* Outer Industrial Steel Rim with 20 Bolts */}
      <circle
        cx="100"
        cy="100"
        r="92"
        fill="#040b16"
        stroke="#475569"
        strokeWidth="2.5"
      />
      {Array.from({ length: 20 }, (_, i) => (
        <circle
          key={i}
          cx="100"
          cy="11"
          r="1.3"
          fill="#94a3b8"
          transform={`rotate(${i * 18} 100 100)`}
        />
      ))}

      {/* Glowing Plasma Ring Track Under Coils */}
      <circle
        cx="100"
        cy="100"
        r="74"
        fill="none"
        stroke={pal.primary}
        strokeWidth="16"
        opacity={state === 'disconnected' ? 0.25 : 0.75}
        className="transition-all duration-500"
      />
      <circle
        cx="100"
        cy="100"
        r="74"
        fill="none"
        stroke={pal.core}
        strokeWidth="6"
        opacity={state === 'disconnected' ? 0.2 : 0.85}
      />

      {/* 10 Heavy Copper-Wound Industrial Inductor Coils */}
      <g>
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 36} 100 100)`}>
            <rect
              x="91.5"
              y="18"
              width="17"
              height="18"
              rx="2"
              fill={`url(#mk1Copper-${filterId})`}
              stroke="#78350f"
              strokeWidth="1.2"
            />
            {/* Copper wire winding lines */}
            {[21, 24, 27, 30, 33].map((yPos) => (
              <line
                key={yPos}
                x1="93"
                y1={yPos}
                x2="107"
                y2={yPos}
                stroke="#fde68a"
                strokeWidth="0.7"
                opacity="0.7"
              />
            ))}
            {/* Dual metallic terminal pins */}
            <circle cx="95" cy="39" r="1.4" fill="#cbd5e1" />
            <circle cx="105" cy="39" r="1.4" fill="#cbd5e1" />
          </g>
        ))}
      </g>

      {/* Inner Brass & Steel Retention Ring */}
      <g className={getReverseSpin()} style={{ transformOrigin: '100px 100px' }}>
        <circle
          cx="100"
          cy="100"
          r="54"
          fill="#030712"
          stroke="#d97706"
          strokeWidth="2.5"
        />
        <circle
          cx="100"
          cy="100"
          r="49"
          fill="none"
          stroke={pal.primary}
          strokeWidth="1.5"
          strokeDasharray="10 5"
          opacity="0.8"
        />
        {/* 3 Industrial Mechanical Support Struts */}
        {[0, 120, 240].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 100 100)`}>
            <rect x="97.5" y="48" width="5" height="24" fill="#64748b" rx="1" />
            <circle cx="100" cy="53" r="1.5" fill="#0f172a" />
          </g>
        ))}
      </g>

      {/* Central Industrial Core Chamber */}
      <circle
        cx="100"
        cy="100"
        r="31"
        fill={`url(#coreGlowGrad-${filterId})`}
        style={{
          transform: `scale(${audioScale})`,
          transformOrigin: '100px 100px',
          transition: 'transform 150ms ease-out',
        }}
      />
      <circle
        cx="100"
        cy="100"
        r="21"
        fill={pal.core}
        stroke="#f59e0b"
        strokeWidth="1.5"
      />
      {/* Inner Wire Reticle */}
      <g className={getForwardSpin()} style={{ transformOrigin: '100px 100px' }}>
        <circle
          cx="100"
          cy="100"
          r="13"
          fill="none"
          stroke="#0284c7"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
        <circle cx="100" cy="100" r="5" fill="#0f172a" stroke={pal.primary} strokeWidth="1.5" />
      </g>
    </>
  );

  // Render Theme B: IRON MAN 2 — Refined Palladium / New Element Triangular Reactor
  const renderMark2 = () => (
    <>
      {/* Precision Outer Turbine Bezel */}
      <circle
        cx="100"
        cy="100"
        r="93"
        fill="#020814"
        stroke={pal.ring}
        strokeWidth="2"
      />

      {/* Counter-Rotating Outer Calibration Ring */}
      <g className={getReverseSpin()} style={{ transformOrigin: '100px 100px' }}>
        <circle
          cx="100"
          cy="100"
          r="87"
          fill="none"
          stroke={pal.primary}
          strokeWidth="1.5"
          strokeDasharray="18 5 4 5"
          opacity="0.8"
        />
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            x1="100"
            y1="10"
            x2="100"
            y2="14"
            stroke={pal.accent}
            strokeWidth="1"
            transform={`rotate(${i * 15} 100 100)`}
            opacity="0.6"
          />
        ))}
      </g>

      {/* Luminous Ring Channel + 10 Palladium Capacitor Segments */}
      <circle
        cx="100"
        cy="100"
        r="72"
        fill="none"
        stroke={pal.primary}
        strokeWidth="11"
        opacity={state === 'disconnected' ? 0.25 : 0.65}
      />
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 36} 100 100)`}>
          <rect
            x="94"
            y="21"
            width="12"
            height="14"
            rx="1.5"
            fill="#1e293b"
            stroke={pal.accent}
            strokeWidth="1"
          />
          <line x1="96" y1="25" x2="104" y2="25" stroke={pal.primary} strokeWidth="1" />
          <line x1="96" y1="29" x2="104" y2="29" stroke={pal.primary} strokeWidth="1" />
        </g>
      ))}

      {/* Inner Chamber Housing */}
      <circle
        cx="100"
        cy="100"
        r="57"
        fill="#020611"
        stroke={pal.primary}
        strokeWidth="2"
      />

      {/* 3 Radial Busbars at 60°, 180°, 300° */}
      {[60, 180, 300].map((deg) => (
        <line
          key={deg}
          x1="100"
          y1="43"
          x2="100"
          y2="60"
          stroke="#94a3b8"
          strokeWidth="3"
          transform={`rotate(${deg} 100 100)`}
        />
      ))}

      {/* Iconic Mark VI Illuminated Inverted Triangle Assembly */}
      <g
        style={{
          transform: `scale(${audioScale})`,
          transformOrigin: '100px 100px',
          transition: 'transform 140ms ease-out',
        }}
      >
        {/* Outer Triangle Halo */}
        <polygon
          points="100,144 58,72 142,72"
          fill={`url(#coreGlowGrad-${filterId})`}
          stroke={pal.primary}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* Inner Bright Energy Triangle */}
        <polygon
          points="100,132 69,78 131,78"
          fill={pal.core}
          stroke={pal.accent}
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.95"
        />
        {/* Internal Precision Lattice Lines */}
        <line x1="100" y1="132" x2="100" y2="78" stroke={pal.secondary} strokeWidth="1.1" />
        <line x1="69" y1="78" x2="115" y2="105" stroke={pal.secondary} strokeWidth="1.1" />
        <line x1="131" y1="78" x2="85" y2="105" stroke={pal.secondary} strokeWidth="1.1" />
        {/* Center Focal Point */}
        <circle cx="100" cy="96" r="6" fill="#020814" stroke={pal.primary} strokeWidth="1.6" />
        <circle cx="100" cy="96" r="2.5" fill={pal.core} />
      </g>
    </>
  );

  // Render Theme C: IRON MAN 3 — Advanced Mark XLII / Extremis Era Reactor
  const renderMark3 = () => (
    <>
      {/* Sleek Brushed Titanium Outer Ring */}
      <circle
        cx="100"
        cy="100"
        r="93"
        fill="#020712"
        stroke="#334155"
        strokeWidth="2.5"
      />
      <circle
        cx="100"
        cy="100"
        r="88"
        fill="none"
        stroke={pal.primary}
        strokeWidth="1.2"
        opacity="0.7"
      />

      {/* 6 Wide Luminous Trapezoidal Energy Apertures */}
      <g className={getForwardSpin()} style={{ transformOrigin: '100px 100px' }}>
        <circle
          cx="100"
          cy="100"
          r="71"
          fill="none"
          stroke={pal.primary}
          strokeWidth="20"
          strokeDasharray="56 18.3"
          opacity={state === 'disconnected' ? 0.25 : 0.82}
        />
        <circle
          cx="100"
          cy="100"
          r="71"
          fill="none"
          stroke={pal.core}
          strokeWidth="10"
          strokeDasharray="52 22.3"
          opacity={state === 'disconnected' ? 0.2 : 0.9}
        />
      </g>

      {/* 6 Metallic Radial Divider Fins */}
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 60} 100 100)`}>
          <polygon
            points="95,14 105,14 103,56 97,56"
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth="1"
          />
          <circle cx="100" cy="22" r="1.8" fill={pal.accent} />
        </g>
      ))}

      {/* Counter-Rotating Inner Harmonic Ring */}
      <g className={getReverseSpin()} style={{ transformOrigin: '100px 100px' }}>
        <circle
          cx="100"
          cy="100"
          r="53"
          fill="#020816"
          stroke={pal.secondary}
          strokeWidth="2.2"
        />
        <circle
          cx="100"
          cy="100"
          r="47"
          fill="none"
          stroke={pal.accent}
          strokeWidth="1.5"
          strokeDasharray="14 6 4 6"
          opacity="0.85"
        />
      </g>

      {/* High-Output Refractive Circular Core */}
      <circle
        cx="100"
        cy="100"
        r="36"
        fill={`url(#coreGlowGrad-${filterId})`}
        style={{
          transform: `scale(${audioScale})`,
          transformOrigin: '100px 100px',
          transition: 'transform 140ms ease-out',
        }}
      />
      <circle
        cx="100"
        cy="100"
        r="24"
        fill={pal.core}
        stroke={pal.primary}
        strokeWidth="2"
      />
      <circle
        cx="100"
        cy="100"
        r="12"
        fill="none"
        stroke={pal.secondary}
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />
      <circle cx="100" cy="100" r="4" fill="#020816" />
    </>
  );

  // Render Theme D: INFINITY WAR — Mark L / LXXXV Nanotech Reactor
  const renderNanotech = () => (
    <>
      {/* Outer Hexagonal-Radial Nanotech Housing */}
      <polygon
        points="100,8 179,54 179,146 100,192 21,146 21,54"
        fill="#020713"
        stroke={pal.ring}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Rotating Nanotech Energy Stream Ring */}
      <g className={getForwardSpin()} style={{ transformOrigin: '100px 100px' }}>
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke={pal.primary}
          strokeWidth="1.6"
          strokeDasharray="10 6 2 6"
          opacity="0.8"
        />
      </g>

      {/* 6 Crystalline Nano-Conduits & Interlocking Chevrons */}
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 60} 100 100)`}>
          {/* Luminous Nano Vein */}
          <polygon
            points="96,20 104,20 108,54 92,54"
            fill={pal.primary}
            opacity={state === 'disconnected' ? 0.25 : 0.72}
          />
          <polygon
            points="98,24 102,24 104,50 96,50"
            fill={pal.core}
            opacity={state === 'disconnected' ? 0.2 : 0.9}
          />
          {/* Interlocking Nano Armor Chevron */}
          <polyline
            points="78,34 100,20 122,34"
            fill="none"
            stroke={pal.accent}
            strokeWidth="1.5"
            opacity="0.85"
          />
        </g>
      ))}

      {/* Inner Hexagonal Containment Matrix */}
      <g className={getReverseSpin()} style={{ transformOrigin: '100px 100px' }}>
        <polygon
          points="100,44 148,72 148,128 100,156 52,128 52,72"
          fill="#030917"
          stroke={pal.primary}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <polygon
          points="100,52 141,76 141,124 100,148 59,124 59,76"
          fill="none"
          stroke={pal.secondary}
          strokeWidth="1"
          strokeDasharray="8 4"
        />
      </g>

      {/* Nanotech Crystalline Core */}
      <g
        style={{
          transform: `scale(${audioScale})`,
          transformOrigin: '100px 100px',
          transition: 'transform 140ms ease-out',
        }}
      >
        <polygon
          points="100,58 136,79 136,121 100,142 64,121 64,79"
          fill={`url(#coreGlowGrad-${filterId})`}
          stroke={pal.accent}
          strokeWidth="1.8"
        />
        <polygon
          points="100,130 72,82 128,82"
          fill={pal.core}
          stroke={pal.primary}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="100" cy="98" r="10" fill="#030917" stroke={pal.accent} strokeWidth="1.4" />
        <circle cx="100" cy="98" r="4.5" fill={pal.core} />
      </g>
    </>
  );

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      data-state={state}
      data-reactor-theme={theme}
      aria-label="Tap Arc Reactor to trigger voice input"
      className={`relative flex items-center justify-center select-none rounded-full bg-transparent border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-transform duration-300 ${
        interactive ? 'cursor-pointer active:scale-95' : 'cursor-default'
      }`}
      style={{ width: size, height: size }}
      title={interactive ? 'Tap Arc Reactor to trigger voice input' : undefined}
    >
      {/* Controlled radial ambient aura */}
      <div
        className="absolute inset-2 rounded-full transition-all duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${pal.glow} 0%, rgba(0, 240, 255, 0.06) 55%, transparent 74%)`,
          opacity: state === 'disconnected' ? 0.3 : 0.85,
          transform: `scale(${audioScale})`,
        }}
      />

      <svg
        viewBox="0 0 200 200"
        className="w-full h-full relative z-10 overflow-visible transition-all duration-500"
        style={{
          filter: `drop-shadow(0 0 6px ${pal.glow})`,
        }}
      >
        <defs>
          <linearGradient id={`mk1Copper-${filterId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#92400e" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>

          <radialGradient id={`coreGlowGrad-${filterId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={pal.core} stopOpacity="1" />
            <stop offset="58%" stopColor={pal.primary} stopOpacity="0.88" />
            <stop offset="100%" stopColor={pal.secondary} stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* Render Selected Cinematic Reactor Architecture */}
        {normalizedTheme === 'mk1' && renderMark1()}
        {normalizedTheme === 'mk2' && renderMark2()}
        {normalizedTheme === 'mk3' && renderMark3()}
        {normalizedTheme === 'nanotech' && renderNanotech()}

        {/* Operational State Perimeter Telemetry Ring */}
        {state === 'listening' && (
          <circle
            cx="100"
            cy="100"
            r="97"
            fill="none"
            stroke={pal.accent}
            strokeWidth="1.6"
            strokeDasharray="10 6"
            opacity="0.9"
            className={isReduced ? '' : 'animate-[pulse_1.8s_ease-in-out_infinite]'}
          />
        )}

        {state === 'processing' && (
          <g
            className={isReduced ? '' : 'animate-[spin_1.6s_linear_infinite]'}
            style={{ transformOrigin: '100px 100px' }}
          >
            <circle
              cx="100"
              cy="100"
              r="97"
              fill="none"
              stroke={pal.accent}
              strokeWidth="2.2"
              strokeDasharray="65 240"
              strokeLinecap="round"
            />
          </g>
        )}

        {state === 'speaking' && (
          <circle
            cx="100"
            cy="100"
            r="97"
            fill="none"
            stroke={pal.primary}
            strokeWidth="1.6"
            opacity="0.75"
            style={{
              transform: `scale(${1 + audioActivity * 0.04})`,
              transformOrigin: '100px 100px',
              transition: 'transform 100ms ease-out',
            }}
          />
        )}

        {state === 'error' && (
          <circle
            cx="100"
            cy="100"
            r="97"
            fill="none"
            stroke="#EF4444"
            strokeWidth="2"
            strokeDasharray="16 10"
            className={isReduced ? '' : 'animate-[pulse_1.4s_ease-in-out_infinite]'}
          />
        )}
      </svg>
    </button>
  );
};
