import React, { useRef, useState, useEffect } from 'react';
import { WatchCaseColor } from '../types/index.ts';
import { calculateBezelAngle } from '../services/watch/wearOsSpecs.ts';

interface GalaxyWatchFrameProps {
  children: React.ReactNode;
  caseColor: WatchCaseColor;
  onTopHardwareButton: () => void;
  onBottomHardwareButton: () => void;
  onRotaryTurn?: (direction: 'up' | 'down') => void;
  isAmbientMode: boolean;
  diameterPx?: number;
}

export const GalaxyWatchFrame: React.FC<GalaxyWatchFrameProps> = ({
  children,
  caseColor,
  onTopHardwareButton,
  onBottomHardwareButton,
  onRotaryTurn,
  isAmbientMode,
  diameterPx = 396,
}) => {
  const bezelRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  const screenDiameter = Math.max(320, Math.min(480, Math.round(diameterPx)));
  const bezelRingDiameter = screenDiameter + 14;
  const outerCasingDiameter = screenDiameter + 40;
  const chassisContainerDiameter = screenDiameter + 50;
  const tickRadiusPx = Math.round(screenDiameter / 2 + 1);
  const screenSafeTouchRadiusPx = Math.round(screenDiameter / 2 - 8);

  // Distinct, consistent metallic finishes for Black, Silver, and Pink Gold (Requirement 8)
  const getCaseStyles = () => {
    switch (caseColor) {
      case 'silver':
        return {
          name: 'Armor Silver',
          caseBg: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 48%, #cbd5e1 100%)',
          caseBorder: '#64748b',
          caseShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.75), inset 0 2px 5px rgba(255, 255, 255, 0.65), 0 0 0 2px #64748b',
          bezelRingBorder: '#475569',
          buttonBg: 'linear-gradient(to right, #94a3b8, #e2e8f0)',
          strapBg: 'linear-gradient(180deg, #475569 0%, #334155 100%)',
          strapBorder: '#64748b',
          majorTickClass: 'bg-sky-400/80',
          minorTickClass: 'bg-slate-500/70',
        };
      case 'pink_gold':
        return {
          name: 'Pink Gold',
          caseBg: 'linear-gradient(135deg, #fce7f3 0%, #f472b6 48%, #fbcfe8 100%)',
          caseBorder: '#db2777',
          caseShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.75), inset 0 2px 5px rgba(255, 255, 255, 0.55), 0 0 0 2px #be185d',
          bezelRingBorder: '#831843',
          buttonBg: 'linear-gradient(to right, #ec4899, #fbcfe8)',
          strapBg: 'linear-gradient(180deg, #831843 0%, #500724 100%)',
          strapBorder: '#9d174d',
          majorTickClass: 'bg-pink-400/80',
          minorTickClass: 'bg-rose-800/70',
        };
      case 'black':
      default:
        return {
          name: 'Phantom Black',
          caseBg: 'linear-gradient(135deg, #1e293b 0%, #090d16 50%, #1e293b 100%)',
          caseBorder: '#334155',
          caseShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.85), inset 0 2px 4px rgba(255, 255, 255, 0.12), 0 0 0 2px #1e293b',
          bezelRingBorder: '#1e293b',
          buttonBg: 'linear-gradient(to right, #0f172a, #334155)',
          strapBg: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
          strapBorder: '#1e293b',
          majorTickClass: 'bg-cyan-500/75',
          minorTickClass: 'bg-slate-700/65',
        };
    }
  };

  const style = getCaseStyles();

  // Simulated rotary bezel via mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (onRotaryTurn) {
      onRotaryTurn(e.deltaY > 0 ? 'down' : 'up');
    }
  };

  // Simulated touch bezel drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!bezelRef.current) return;
    // Do not intercept clicks inside the circular screen area
    const rect = bezelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    if (dist < screenSafeTouchRadiusPx) return;

    setIsRotating(true);
    lastAngleRef.current = calculateBezelAngle(centerX, centerY, e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isRotating || !bezelRef.current || lastAngleRef.current === null) return;
      const rect = bezelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const currentAngle = calculateBezelAngle(centerX, centerY, e.clientX, e.clientY);

      let delta = currentAngle - lastAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      if (Math.abs(delta) >= 14) {
        onRotaryTurn?.(delta > 0 ? 'down' : 'up');
        lastAngleRef.current = currentAngle;
      }
    };

    const handleMouseUp = () => {
      setIsRotating(false);
      lastAngleRef.current = null;
    };

    if (isRotating) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isRotating, onRotaryTurn]);

  return (
    <div
      className="relative flex flex-col items-center justify-center py-2 select-none transition-all duration-300"
      data-testid="galaxy-watch-chassis"
      data-case-color={caseColor}
    >
      {/* Top Watch Strap */}
      <div
        className="w-40 h-12 rounded-t-xl shadow-inner flex items-center justify-center relative overflow-hidden transition-all duration-300"
        style={{
          background: style.strapBg,
          borderTop: `1px solid ${style.strapBorder}`,
          borderLeft: `1px solid ${style.strapBorder}`,
          borderRight: `1px solid ${style.strapBorder}`,
        }}
      >
        <div className="w-12 h-1 bg-black/40 rounded-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-black/25 pointer-events-none" />
      </div>

      {/* Main Galaxy Watch 4 Chassis (40mm Aluminum Armor) */}
      <div
        className="relative flex items-center justify-center transition-all duration-300"
        style={{ width: `${chassisContainerDiameter}px`, height: `${chassisContainerDiameter}px` }}
      >
        {/* Physical Top Hardware Button (Simulated Home / Voice Key) */}
        <button
          type="button"
          onClick={onTopHardwareButton}
          className="absolute right-0 top-24 w-3.5 h-13 rounded-r-md cursor-pointer transition-all active:translate-x-[-2px] z-30 shadow-md"
          style={{ background: style.buttonBg, border: `1px solid ${style.caseBorder}` }}
          title="Simulated Hardware Top Button: Home / Voice"
          aria-label="Galaxy Watch 4 Home Button"
        >
          <div className="w-0.5 h-7 bg-red-500/85 rounded-full mx-auto" />
        </button>

        {/* Physical Bottom Hardware Button (Simulated Back Key) */}
        <button
          type="button"
          onClick={onBottomHardwareButton}
          className="absolute right-0 bottom-24 w-3.5 h-13 rounded-r-md cursor-pointer transition-all active:translate-x-[-2px] z-30 shadow-md"
          style={{ background: style.buttonBg, border: `1px solid ${style.caseBorder}` }}
          title="Simulated Hardware Bottom Button: Back"
          aria-label="Galaxy Watch 4 Back Button"
        >
          <div className="w-0.5 h-7 bg-slate-400/80 rounded-full mx-auto" />
        </button>

        {/* Outer Circular Watch Casing */}
        <div
          ref={bezelRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          className="relative rounded-full p-2.5 flex items-center justify-center transition-all duration-300"
          style={{
            width: `${outerCasingDiameter}px`,
            height: `${outerCasingDiameter}px`,
            background: style.caseBg,
            boxShadow: style.caseShadow,
          }}
          title={`Galaxy Watch 4 (${style.name}) — Simulated Touch Bezel (${screenDiameter}×${screenDiameter})`}
        >
          {/* Inner Display Ring with Bezel Ticks */}
          <div
            className="relative rounded-full bg-slate-950 p-1.5 flex items-center justify-center border-2 pointer-events-none transition-all duration-300"
            style={{
              width: `${bezelRingDiameter}px`,
              height: `${bezelRingDiameter}px`,
              borderColor: style.bezelRingBorder,
            }}
          >
            {/* 60-Second / Minute Index Ticks on Samsung Bezel */}
            {!isAmbientMode &&
              Array.from({ length: 60 }, (_, i) => {
                const isMajor = i % 5 === 0;
                return (
                  <div
                    key={i}
                    className="absolute pointer-events-none"
                    style={{
                      transform: `rotate(${i * 6}deg) translateY(-${tickRadiusPx}px)`,
                    }}
                  >
                    <div
                      className={`${
                        isMajor
                          ? `w-0.5 h-2.5 ${style.majorTickClass}`
                          : `w-0.5 h-1 ${style.minorTickClass}`
                      } rounded-full`}
                    />
                  </div>
                );
              })}

            {/* AMOLED Circular Screen Display Viewport */}
            <div
              data-testid="watch-circular-viewport"
              data-resolution={`${screenDiameter}x${screenDiameter}`}
              className={`relative rounded-full overflow-hidden flex flex-col items-center justify-center pointer-events-auto transition-all duration-300 ${
                isAmbientMode ? 'bg-black' : 'bg-[#02040a]'
              }`}
              style={{
                width: `${screenDiameter}px`,
                height: `${screenDiameter}px`,
                boxShadow: isAmbientMode
                  ? 'none'
                  : 'inset 0 0 24px rgba(0, 0, 0, 0.92), 0 0 10px rgba(0, 240, 255, 0.08)',
              }}
            >
              {/* Subtle Scanlines Overlay (disabled in AOD mode) */}
              {!isAmbientMode && (
                <div className="absolute inset-0 scanlines pointer-events-none opacity-30 z-10" />
              )}

              {/* Application Content */}
              <div className="w-full h-full relative z-20 pointer-events-auto flex flex-col">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Watch Strap */}
      <div
        className="w-40 h-12 rounded-b-xl shadow-inner flex items-center justify-center relative overflow-hidden transition-all duration-300"
        style={{
          background: style.strapBg,
          borderBottom: `1px solid ${style.strapBorder}`,
          borderLeft: `1px solid ${style.strapBorder}`,
          borderRight: `1px solid ${style.strapBorder}`,
        }}
      >
        <div className="w-12 h-1 bg-black/40 rounded-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-black/25 pointer-events-none" />
      </div>
    </div>
  );
};
