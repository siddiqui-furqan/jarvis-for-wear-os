// Decoupled pure logic for Galaxy Watch 4 (SM-R860) circular geometry,
// custom rotary bezel event handling, and British male voice selection.

export interface VoiceCandidate {
  name: string;
  lang: string;
  voiceURI?: string;
  localService?: boolean;
}

export interface ScoredVoiceResult {
  selectedVoice: VoiceCandidate | null;
  score: number;
  isConfirmedMale: boolean;
  recommendedPitchMultiplier: number;
}

const MALE_VOICE_KEYWORDS = [
  'en-gb-x-rjs',
  'en-gb-x-gbd',
  'en-gb-x-gbb',
  'en-gb-x-omb',
  'uk english male',
  'british english male',
  'daniel',
  'arthur',
  'oliver',
  'george',
  'ryan',
  'thomas',
  'alfie',
  'elliot',
  'james',
  'callum',
  'liam',
  'david',
  'mark',
  'guy',
  'christopher',
  'eric',
  'roger',
  'smtl01',
  'smtl03',
  '_male',
  '-male',
  ' male',
];

const FEMALE_VOICE_KEYWORDS = [
  'en-gb-x-fis',
  'en-gb-x-gba',
  'en-gb-x-gbc',
  'en-gb-x-gbg',
  'en-gb-x-sfg',
  'en-us-x-sfg',
  'en-us-x-tpf',
  'uk english female',
  'hazel',
  'libby',
  'sonia',
  'susan',
  'kate',
  'serena',
  'martha',
  'fiona',
  'moira',
  'tessa',
  'victoria',
  'samantha',
  'zira',
  'aria',
  'jenny',
  'smtl02',
  'smtl04',
  'female',
];

/**
 * Scores a single voice candidate for the JARVIS British Male persona.
 */
export function scoreJarvisVoice(
  voice: VoiceCandidate,
  targetAccent: 'en-GB' | 'en-US' | 'default' = 'en-GB',
  preferredVoiceURI?: string
): { score: number; isMale: boolean; isFemale: boolean } {
  const idLower = `${voice.name} ${voice.voiceURI || ''}`.toLowerCase();
  const langLower = (voice.lang || '').toLowerCase().replace('_', '-');

  if (
    preferredVoiceURI &&
    preferredVoiceURI.trim() !== '' &&
    (voice.voiceURI === preferredVoiceURI || voice.name === preferredVoiceURI)
  ) {
    const isFemale = FEMALE_VOICE_KEYWORDS.some((k) => idLower.includes(k));
    const isMale = !isFemale && MALE_VOICE_KEYWORDS.some((k) => idLower.includes(k));
    return { score: 1000, isMale, isFemale };
  }

  let score = 0;
  const isFemale = FEMALE_VOICE_KEYWORDS.some((k) => idLower.includes(k));
  const isMale = !isFemale && MALE_VOICE_KEYWORDS.some((k) => idLower.includes(k));

  // Language / Accent scoring
  if (targetAccent === 'en-US') {
    if (langLower.startsWith('en-us')) score += 60;
    else if (langLower.startsWith('en-gb')) score += 35;
    else if (langLower.startsWith('en')) score += 20;
    else score -= 100;
  } else {
    // Default is British English (en-GB) for authentic JARVIS
    if (langLower.startsWith('en-gb') || langLower.startsWith('en-uk')) score += 75;
    else if (langLower.startsWith('en-au') || langLower.startsWith('en-ie') || langLower.startsWith('en-nz')) score += 40;
    else if (langLower.startsWith('en-us')) score += 25;
    else if (langLower.startsWith('en')) score += 15;
    else score -= 100;
  }

  // Gender scoring: strongly prioritize male voices, penalize female voices
  if (isMale) {
    score += 95;
  }
  if (isFemale) {
    score -= 90;
  }

  // Extra boost for top-tier British male voices
  if (
    idLower.includes('en-gb-x-rjs') ||
    idLower.includes('en-gb-x-gbd') ||
    idLower.includes('uk english male') ||
    idLower.includes('daniel') ||
    idLower.includes('ryan')
  ) {
    score += 30;
  }

  // Prefer low-latency local voices when quality is tied
  if (voice.localService) {
    score += 5;
  }

  return { score, isMale, isFemale };
}

/**
 * Selects the best voice from a list of system voices and calculates pitch compensation
 * if the platform only provides a neutral or female voice.
 */
export function selectBestJarvisVoice<T extends VoiceCandidate>(
  voices: T[],
  targetAccent: 'en-GB' | 'en-US' | 'default' = 'en-GB',
  preferredVoiceURI?: string
): {
  selectedVoice: T | null;
  score: number;
  isConfirmedMale: boolean;
  recommendedPitchMultiplier: number;
} {
  if (!voices || voices.length === 0) {
    return {
      selectedVoice: null,
      score: 0,
      isConfirmedMale: false,
      recommendedPitchMultiplier: 0.9,
    };
  }

  let bestVoice: T | null = null;
  let bestScore = -Infinity;
  let bestIsMale = false;
  let bestIsFemale = false;

  for (const v of voices) {
    const { score, isMale, isFemale } = scoreJarvisVoice(v, targetAccent, preferredVoiceURI);
    if (score > bestScore) {
      bestScore = score;
      bestVoice = v;
      bestIsMale = isMale;
      bestIsFemale = isFemale;
    }
  }

  // If the best available voice is female or gender-unknown, lower pitch slightly for deeper JARVIS resonance
  const recommendedPitchMultiplier = bestIsMale ? 1.0 : bestIsFemale ? 0.84 : 0.92;

  return {
    selectedVoice: bestVoice,
    score: bestScore,
    isConfirmedMale: bestIsMale,
    recommendedPitchMultiplier,
  };
}

/**
 * Computes the circular safe chord width at a given vertical offset `y` inside a circular display of diameter `D`.
 * Used to verify that headers, orbital nodes, and bottom docks never clip against the round bezel.
 */
export function computeCircularChordWidth(diameter: number, yFromTop: number, insetMargin = 6): number {
  const r = diameter / 2 - insetMargin;
  const dy = Math.abs(yFromTop - diameter / 2);
  if (dy >= r) return 0;
  return 2 * Math.sqrt(r * r - dy * dy);
}

/**
 * Verifies that the Galaxy Watch 4 (SM-R860) 198dp x 198dp (396x396px @ 2.0x density)
 * vertical zones (Top Header, Center Content/Reactor, Bottom Dock) do not overlap.
 */
export interface CircularZoneLayout {
  viewportDiameterDp: number;
  topHeaderBottomDp: number;
  centerZoneTopDp: number;
  centerZoneBottomDp: number;
  bottomDockTopDp: number;
}

export function validateNonOverlappingZones(layout: CircularZoneLayout): {
  valid: boolean;
  topClearanceDp: number;
  bottomClearanceDp: number;
} {
  const topClearanceDp = layout.centerZoneTopDp - layout.topHeaderBottomDp;
  const bottomClearanceDp = layout.bottomDockTopDp - layout.centerZoneBottomDp;
  return {
    valid:
      topClearanceDp >= 0 &&
      bottomClearanceDp >= 0 &&
      layout.bottomDockTopDp < layout.viewportDiameterDp,
    topClearanceDp,
    bottomClearanceDp,
  };
}

/**
 * Computes the rotary scroll delta in pixels from a bezel rotation input,
 * matching both App.tsx (`±48px` per detent) and Wear OS `InputDevice.SOURCE_ROTARY_ENCODER`.
 */
export function computeRotaryScrollDelta(
  axisScrollValue: number,
  scaledVerticalScrollFactor = 48,
  invertAxis = true
): { deltaPx: number; direction: 'CW' | 'CCW' | 'NONE' } {
  if (Math.abs(axisScrollValue) < 1e-4) {
    return { deltaPx: 0, direction: 'NONE' };
  }
  const sign = invertAxis ? -axisScrollValue : axisScrollValue;
  const deltaPx = Math.round(sign * scaledVerticalScrollFactor * 100) / 100;
  return {
    deltaPx,
    direction: deltaPx > 0 ? 'CW' : 'CCW',
  };
}

export type HapticEventType =
  | 'tap'
  | 'rotary_tick'
  | 'reactor_activate'
  | 'confirm'
  | 'error'
  | 'TAP'
  | 'ROTARY_TICK'
  | 'REACTOR_ACTIVATE'
  | 'CONFIRM'
  | 'ERROR';

/**
 * V5 Home Screen Caption Resolver:
 * Returns the caption to display beneath the Arc Reactor on the Home screen when
 * `homeCaptionsEnabled` is true and the assistant is not actively listening/processing a new turn.
 */
export function resolveHomeScreenCaption(
  homeCaptionsEnabledOrOpts:
    | boolean
    | {
        homeCaptionsEnabled: boolean;
        state: string;
        captionText: string;
        maxChars?: number;
      },
  stateArg?: string,
  activeCaptionArg?: string
): string {
  const homeCaptionsEnabled =
    typeof homeCaptionsEnabledOrOpts === 'boolean'
      ? homeCaptionsEnabledOrOpts
      : homeCaptionsEnabledOrOpts.homeCaptionsEnabled;
  const state =
    typeof homeCaptionsEnabledOrOpts === 'boolean'
      ? stateArg || 'idle'
      : homeCaptionsEnabledOrOpts.state;
  const rawCaption =
    typeof homeCaptionsEnabledOrOpts === 'boolean'
      ? activeCaptionArg || ''
      : homeCaptionsEnabledOrOpts.captionText || '';
  const maxChars =
    typeof homeCaptionsEnabledOrOpts === 'object' && homeCaptionsEnabledOrOpts.maxChars
      ? homeCaptionsEnabledOrOpts.maxChars
      : 110;

  if (!homeCaptionsEnabled) return '';
  if (state === 'listening' || state === 'processing') return '';
  const cleaned = rawCaption.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length > maxChars) {
    return `${cleaned.slice(0, maxChars - 1).trimEnd()}…`;
  }
  return cleaned;
}

/**
 * V5 Haptic Feedback Rate-Limiting & Enablement Policy:
 * Ensures rotary bezel ticks are throttled (>= 38ms apart) and respects the user's haptic toggle.
 */
export function shouldTriggerHapticFeedback(
  hapticsEnabled: boolean,
  type: HapticEventType,
  nowMs: number,
  lastRotaryTickMs: number
): boolean {
  if (!hapticsEnabled) return false;
  if (type.toLowerCase() === 'rotary_tick') {
    return nowMs - lastRotaryTickMs >= 38;
  }
  return true;
}

let lastWebRotaryHapticMs = 0;

export function triggerWebHaptic(
  first: boolean | HapticEventType,
  second: HapticEventType | boolean = true
): void {
  const hapticsEnabled = typeof first === 'boolean' ? first : Boolean(second);
  const rawType = (typeof first === 'string' ? first : (second as HapticEventType)).toLowerCase() as HapticEventType;
  const now = Date.now();
  if (!shouldTriggerHapticFeedback(hapticsEnabled, rawType, now, lastWebRotaryHapticMs)) {
    return;
  }
  if (rawType === 'rotary_tick') {
    lastWebRotaryHapticMs = now;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      const pattern =
        rawType === 'reactor_activate'
          ? [14, 30, 18]
          : rawType === 'error'
          ? [28, 40, 28]
          : rawType === 'confirm'
          ? 16
          : rawType === 'rotary_tick'
          ? 6
          : 10;
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration API restrictions in desktop browsers
    }
  }
}

export interface TypedSubmissionRouteDecision {
  normalizedPrompt: string;
  shouldStartMicrophone: boolean;
  shouldCancelActiveMicrophone: boolean;
  targetInitialState: 'processing';
}

export function routeTypedMessageSubmission(
  rawText: string,
  currentState: string
): TypedSubmissionRouteDecision | null {
  const cleaned = rawText.trim();
  if (!cleaned) return null;
  return {
    normalizedPrompt: cleaned,
    shouldStartMicrophone: false,
    shouldCancelActiveMicrophone: currentState === 'listening',
    targetInitialState: 'processing',
  };
}

export type CircularDisplayTier = 'COMPACT' | 'STANDARD' | 'LARGE';

export interface RoundDisplayProfile {
  id: string;
  label: string;
  resolutionPx: number;
  referenceDensity: number;
  diameterDp: number;
  isDefaultReference: boolean;
}

export const ROUND_DISPLAY_VALIDATION_PROFILES: RoundDisplayProfile[] = [
  {
    id: '320x320',
    label: 'Compact layout',
    resolutionPx: 320,
    referenceDensity: 2.0,
    diameterDp: 160,
    isDefaultReference: false,
  },
  {
    id: '360x360',
    label: 'Small round layout',
    resolutionPx: 360,
    referenceDensity: 2.0,
    diameterDp: 180,
    isDefaultReference: false,
  },
  {
    id: '384x384',
    label: 'Compact/medium layout',
    resolutionPx: 384,
    referenceDensity: 2.0,
    diameterDp: 192,
    isDefaultReference: false,
  },
  {
    id: '396x396',
    label: 'Galaxy Watch 4 40mm reference',
    resolutionPx: 396,
    referenceDensity: 2.0,
    diameterDp: 198,
    isDefaultReference: true,
  },
  {
    id: '400x400',
    label: 'Medium layout',
    resolutionPx: 400,
    referenceDensity: 2.0,
    diameterDp: 200,
    isDefaultReference: false,
  },
  {
    id: '416x416',
    label: 'Medium/large layout',
    resolutionPx: 416,
    referenceDensity: 2.0,
    diameterDp: 208,
    isDefaultReference: false,
  },
  {
    id: '432x432',
    label: 'Larger layout',
    resolutionPx: 432,
    referenceDensity: 2.0,
    diameterDp: 216,
    isDefaultReference: false,
  },
  {
    id: '450x450',
    label: 'Large layout',
    resolutionPx: 450,
    referenceDensity: 2.0,
    diameterDp: 225,
    isDefaultReference: false,
  },
  {
    id: '480x480',
    label: 'High-resolution layout',
    resolutionPx: 480,
    referenceDensity: 2.0,
    diameterDp: 240,
    isDefaultReference: false,
  },
];

export interface CircularResponsiveSpec {
  diameterDp: number;
  resolutionPx: number;
  scaleFactor: number;
  fontScale: number;
  tier: CircularDisplayTier;
  topTelemetryHeightPx: number;
  outerHorizontalPaddingPx: number;
  outerVerticalPaddingPx: number;
  headerTopInsetPx: number;
  headerSafeWidthPx: number;
  headerHeightPx: number;
  headerSlotWidthPx: number;
  headerButtonSizePx: number;
  contentSafeWidthPx: number;
  bottomDockSafeWidthPx: number;
  bottomDockHeightPx: number;
  bottomDockBottomInsetPx: number;
  homeReactorSizePx: number;
  reservedCaptionSlotHeightPx: number;
  reservedCaptionSlotWidthPx: number;
  homeOrbitalSideNodeSizePx: number;
  homeOrbitalCenterNodeSizePx: number;
  matrixCenterReactorSizePx: number;
  matrixOrbitalNodeSizePx: number;
  matrixNeedsScrollFallback: boolean;
}

function clampVal(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Computes the V6 responsive circular layout specification matching native Kotlin
 * `CircularResponsiveSpec.fromDiameterDp` 1:1.
 */
export function computeCircularResponsiveSpec(
  resolutionPx = 396,
  density = 2.0,
  userFontScale = 1.0
): CircularResponsiveSpec {
  const safeResolutionPx = clampVal(Math.round(resolutionPx), 300, 560);
  const safeDiameterDp = safeResolutionPx / density;
  const scale = clampVal(safeDiameterDp / 198, 0.78, 1.25);
  const fontScale = clampVal(scale * clampVal(userFontScale, 0.9, 1.12), 0.84, 1.16);

  const tier: CircularDisplayTier =
    safeResolutionPx <= 360
      ? 'COMPACT'
      : safeResolutionPx <= 416
      ? 'STANDARD'
      : 'LARGE';

  const topTelemetryHeightPx = Math.round(clampVal(34 * scale, 28, 42));
  const outerHorizontalPaddingPx = Math.round(clampVal(safeResolutionPx * 0.05, 14, 28));
  const outerVerticalPaddingPx = Math.round(clampVal(safeResolutionPx * 0.025, 6, 16));

  const headerTopInsetPx = Math.round(clampVal(safeResolutionPx * 0.055, 16, 28));
  const headerHeightPx = Math.round(clampVal(44 * scale, 36, 54));
  const headerCenterYPx = headerTopInsetPx + headerHeightPx * 0.65;
  const geometricHeaderChordPx = computeCircularChordWidth(
    safeResolutionPx,
    headerCenterYPx,
    clampVal(safeResolutionPx * 0.035, 10, 18)
  );
  const headerSafeWidthPx = Math.round(
    Math.min(geometricHeaderChordPx * 0.94, clampVal(safeResolutionPx * 0.66, 208, 320))
  );
  const headerSlotWidthPx = Math.round(clampVal(52 * scale, 42, 62));
  const headerButtonSizePx = Math.round(clampVal(32 * scale, 26, 38));

  const contentSafeWidthPx = Math.round(clampVal(safeResolutionPx * 0.72, 224, 356));

  const bottomDockBottomInsetPx = Math.round(clampVal(safeResolutionPx * 0.045, 14, 24));
  const bottomDockHeightPx = Math.round(clampVal(48 * scale, 40, 58));
  const bottomDockCenterYPx =
    safeResolutionPx - bottomDockBottomInsetPx - bottomDockHeightPx * 0.6;
  const geometricDockChordPx = computeCircularChordWidth(
    safeResolutionPx,
    bottomDockCenterYPx,
    clampVal(safeResolutionPx * 0.035, 10, 18)
  );
  const bottomDockSafeWidthPx = Math.round(
    Math.min(geometricDockChordPx * 0.94, clampVal(safeResolutionPx * 0.64, 200, 310))
  );

  const homeReactorSizePx = Math.round(clampVal(132 * scale, 100, 164));
  const reservedCaptionSlotHeightPx = Math.round(clampVal(44 * scale, 36, 54));
  const reservedCaptionSlotWidthPx = Math.round(clampVal(safeResolutionPx * 0.64, 204, 316));
  const homeOrbitalSideNodeSizePx = Math.round(clampVal(34 * scale, 28, 42));
  const homeOrbitalCenterNodeSizePx = Math.round(clampVal(40 * scale, 34, 50));

  const matrixCenterReactorSizePx = Math.round(clampVal(72 * scale, 54, 88));
  const matrixOrbitalNodeSizePx = Math.round(clampVal(56 * scale, 44, 68));
  const matrixNeedsScrollFallback = tier === 'COMPACT';

  return {
    diameterDp: safeDiameterDp,
    resolutionPx: safeResolutionPx,
    scaleFactor: scale,
    fontScale,
    tier,
    topTelemetryHeightPx,
    outerHorizontalPaddingPx,
    outerVerticalPaddingPx,
    headerTopInsetPx,
    headerSafeWidthPx,
    headerHeightPx,
    headerSlotWidthPx,
    headerButtonSizePx,
    contentSafeWidthPx,
    bottomDockSafeWidthPx,
    bottomDockHeightPx,
    bottomDockBottomInsetPx,
    homeReactorSizePx,
    reservedCaptionSlotHeightPx,
    reservedCaptionSlotWidthPx,
    homeOrbitalSideNodeSizePx,
    homeOrbitalCenterNodeSizePx,
    matrixCenterReactorSizePx,
    matrixOrbitalNodeSizePx,
    matrixNeedsScrollFallback,
  };
}




