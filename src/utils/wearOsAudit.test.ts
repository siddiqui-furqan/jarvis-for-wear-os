import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectBestJarvisVoice,
  computeCircularChordWidth,
  validateNonOverlappingZones,
  computeRotaryScrollDelta,
  resolveHomeScreenCaption,
  shouldTriggerHapticFeedback,
  routeTypedMessageSubmission,
} from './wearOsAudit.ts';
import {
  DEFAULT_CONFIG,
  switchProviderPreservingState,
  updateActiveProviderModel,
  updateActiveProviderApiKey,
  validateProviderConfiguration,
  buildOpenAiCompatibleRequestBody,
} from '../services/ai/client.ts';
import {
  parseVoiceActionIntent,
  executeDeviceControlIntent,
} from '../services/device/deviceControl.ts';

test('British male voice selection prioritizes UK male voices over female voices', () => {
  const galaxyWatchVoices = [
    { name: 'en-gb-x-fis-local', lang: 'en_GB', voiceURI: 'en-gb-x-fis-local', localService: true },
    { name: 'en-gb-x-gba-local', lang: 'en_GB', voiceURI: 'en-gb-x-gba-local', localService: true },
    { name: 'en-gb-x-rjs-local', lang: 'en_GB', voiceURI: 'en-gb-x-rjs-local', localService: true },
    { name: 'en-us-x-sfg-local', lang: 'en_US', voiceURI: 'en-us-x-sfg-local', localService: true },
  ];

  const result = selectBestJarvisVoice(galaxyWatchVoices, 'en-GB');
  assert.ok(result.selectedVoice);
  assert.equal(result.selectedVoice?.name, 'en-gb-x-rjs-local');
  assert.equal(result.isConfirmedMale, true);
  assert.equal(result.recommendedPitchMultiplier, 1.0);
});

test('Voice selector applies pitch lowering when only female voice is available on device', () => {
  const femaleOnlyVoices = [
    { name: 'Google UK English Female', lang: 'en-GB', voiceURI: 'Google UK English Female' },
  ];

  const result = selectBestJarvisVoice(femaleOnlyVoices, 'en-GB');
  assert.equal(result.selectedVoice?.name, 'Google UK English Female');
  assert.equal(result.isConfirmedMale, false);
  assert.equal(result.recommendedPitchMultiplier, 0.84);
});

test('Explicit user-selected voice URI overrides automatic heuristic', () => {
  const voices = [
    { name: 'en-gb-x-rjs-local', lang: 'en-GB', voiceURI: 'en-gb-x-rjs-local' },
    { name: 'en-us-x-iom-local', lang: 'en-US', voiceURI: 'en-us-x-iom-local' },
  ];

  const result = selectBestJarvisVoice(voices, 'en-GB', 'en-us-x-iom-local');
  assert.equal(result.selectedVoice?.voiceURI, 'en-us-x-iom-local');
});

test('Galaxy Watch 4 (SM-R860) 198dp circular zones have zero vertical overlap', () => {
  const homeCheck = validateNonOverlappingZones({
    viewportDiameterDp: 198,
    topHeaderBottomDp: 26,
    centerZoneTopDp: 28,
    centerZoneBottomDp: 144,
    bottomDockTopDp: 146,
  });
  assert.equal(homeCheck.valid, true);

  const matrixCheck = validateNonOverlappingZones({
    viewportDiameterDp: 198,
    topHeaderBottomDp: 30,
    centerZoneTopDp: 32,
    centerZoneBottomDp: 164,
    bottomDockTopDp: 166,
  });
  assert.equal(matrixCheck.valid, true);

  const topChordDp = computeCircularChordWidth(198, 22, 4);
  assert.ok(topChordDp >= 108, `Expected top chord >= 108dp, got ${topChordDp}`);
});

test('Custom rotary bezel event handler computes clockwise and counter-clockwise scroll deltas', () => {
  const cw = computeRotaryScrollDelta(-1.0, 48, true);
  assert.equal(cw.deltaPx, 48);
  assert.equal(cw.direction, 'CW');

  const ccw = computeRotaryScrollDelta(1.0, 48, true);
  assert.equal(ccw.deltaPx, -48);
  assert.equal(ccw.direction, 'CCW');
});

test('V4 AI Link preserves per-provider Model IDs, Base URL, and API Keys when switching providers', () => {
  let cfg = { ...DEFAULT_CONFIG };
  // Configure Gemini with custom model and key
  cfg = updateActiveProviderModel(cfg, 'gemini-2.5-pro');
  cfg = updateActiveProviderApiKey(cfg, 'AIzaSyGeminiKey999');

  // Switch to Custom and configure OpenRouter
  cfg = switchProviderPreservingState(cfg, 'custom');
  cfg = { ...cfg, customBaseUrl: 'https://openrouter.ai/api/v1' };
  cfg = updateActiveProviderModel(cfg, 'anthropic/claude-3.7-sonnet');
  cfg = updateActiveProviderApiKey(cfg, 'sk-or-v1-custom888');

  // Switch to OpenAI and select o3-mini
  cfg = switchProviderPreservingState(cfg, 'openai');
  cfg = updateActiveProviderModel(cfg, 'o3-mini');
  cfg = updateActiveProviderApiKey(cfg, 'sk-proj-openai777');

  // Switch back to Gemini -> must restore gemini-2.5-pro and AIzaSyGeminiKey999
  cfg = switchProviderPreservingState(cfg, 'gemini');
  assert.equal(cfg.provider, 'gemini');
  assert.equal(cfg.model, 'gemini-2.5-pro');
  assert.equal(cfg.apiKey, 'AIzaSyGeminiKey999');

  // Switch back to Custom -> must restore anthropic/claude-3.7-sonnet, https://openrouter.ai/api/v1, and sk-or-v1-custom888
  cfg = switchProviderPreservingState(cfg, 'custom');
  assert.equal(cfg.provider, 'custom');
  assert.equal(cfg.model, 'anthropic/claude-3.7-sonnet');
  assert.equal(cfg.customBaseUrl, 'https://openrouter.ai/api/v1');
  assert.equal(cfg.apiKey, 'sk-or-v1-custom888');
});

test('V4 AI Link validates Custom endpoint Base URL, Model ID, and API Key and formats reasoning payloads', () => {
  const invalidCustom = {
    ...DEFAULT_CONFIG,
    provider: 'custom' as const,
    model: 'openai/gpt-4o-mini',
    customBaseUrl: '',
    apiKey: 'sk-or-test',
  };
  assert.equal(validateProviderConfiguration(invalidCustom).valid, false);

  const validCustom = {
    ...invalidCustom,
    customBaseUrl: 'https://openrouter.ai/api/v1',
  };
  assert.equal(validateProviderConfiguration(validCustom).valid, true);

  // Reasoning model (o3-mini) uses developer role and max_completion_tokens
  const reasoningBody = buildOpenAiCompatibleRequestBody(
    'o3-mini',
    'You are JARVIS.',
    [],
    'Run orbital math.'
  );
  assert.equal(reasoningBody.max_completion_tokens, 450);
  assert.equal('temperature' in reasoningBody, false);
});

test('V4 Wear OS Voice-to-Action parser and DeviceControlManager handle watch commands and confirmations', async () => {
  const sampleTelemetry = {
    batteryLevel: 88,
    charging: true,
    heartRate: 70,
    stepCount: 4000,
    coreTemperature: 31.2,
    connectionState: 'bluetooth_linked' as const,
    currentTime: '10:30 AM',
  };

  const batteryIntent = parseVoiceActionIntent('What is my battery level?');
  assert.equal(batteryIntent.type, 'READ_BATTERY');
  const batRes = await executeDeviceControlIntent(batteryIntent, sampleTelemetry);
  assert.ok(batRes.spokenResponse.includes('88%'));

  const timerIntent = parseVoiceActionIntent('Set a timer for 5 minutes');
  assert.equal(timerIntent.type, 'SET_TIMER');
  assert.equal(timerIntent.durationSeconds, 300);

  const alarmIntent = parseVoiceActionIntent('Set an alarm for 7:30 am');
  assert.equal(alarmIntent.type, 'SET_ALARM');
  assert.equal(alarmIntent.alarmHour, 7);
  assert.equal(alarmIntent.alarmMinute, 30);

  const torchIntent = parseVoiceActionIntent('Turn on the flashlight');
  assert.equal(torchIntent.type, 'CONTROL_FLASHLIGHT');
  const torchRes = await executeDeviceControlIntent(torchIntent, sampleTelemetry);
  assert.equal(torchRes.screenTorchEnabled, true);

  // Disruptive DND action requires confirmation before execution
  const dndIntent = parseVoiceActionIntent('Enable Do Not Disturb');
  assert.equal(dndIntent.type, 'CONTROL_DND');
  assert.equal(dndIntent.requiresConfirmation, true);
  const unconfirmedDnd = await executeDeviceControlIntent(dndIntent, sampleTelemetry, {
    confirmed: false,
  });
  assert.equal(unconfirmedDnd.requiresConfirmation, true);

  const confirmedDnd = await executeDeviceControlIntent(dndIntent, sampleTelemetry, {
    confirmed: true,
    dndAccessGranted: true,
  });
  assert.equal(confirmedDnd.requiresConfirmation, false);
  assert.ok(confirmedDnd.spokenResponse.includes('enabled'));
});

test('V5 Home Screen Captions policy formats captions cleanly and clears on new LISTENING/PROCESSING cycle', () => {
  // Disabled captions never render text
  assert.equal(
    resolveHomeScreenCaption({
      homeCaptionsEnabled: false,
      state: 'speaking',
      captionText: 'All systems nominal, sir.',
    }),
    ''
  );

  // New voice interaction (listening or processing) clears old response caption
  assert.equal(
    resolveHomeScreenCaption({
      homeCaptionsEnabled: true,
      state: 'listening',
      captionText: 'Previous response',
    }),
    ''
  );
  assert.equal(
    resolveHomeScreenCaption({
      homeCaptionsEnabled: true,
      state: 'processing',
      captionText: 'Previous response',
    }),
    ''
  );

  // Speaking or Idle with enabled captions returns truncated, normalized caption
  const longResponse =
    'At your service, sir. All Samsung Galaxy Watch 4 telemetry, Arc Reactor coils, and neural links are operating at peak efficiency across all sectors.';
  const formatted = resolveHomeScreenCaption({
    homeCaptionsEnabled: true,
    state: 'speaking',
    captionText: longResponse,
    maxChars: 96,
  });
  assert.ok(formatted);
  assert.ok(formatted.length <= 96);
  assert.ok(formatted.endsWith('…'));
});

test('V5 Haptic feedback rate limiter prevents excessive vibration during rapid rotary bezel ticks', () => {
  assert.equal(shouldTriggerHapticFeedback(false, 'TAP', 1000, 0), false);
  assert.equal(shouldTriggerHapticFeedback(true, 'ROTARY_TICK', 1020, 1000), false);
  assert.equal(shouldTriggerHapticFeedback(true, 'ROTARY_TICK', 1045, 1000), true);
  assert.equal(shouldTriggerHapticFeedback(true, 'REACTOR_ACTIVATE', 1050, 1045), true);
});

test('V5 Typed message submission routes directly to PROCESSING and never activates microphone speech recognition', () => {
  assert.equal(routeTypedMessageSubmission('   ', 'idle'), null);

  const fromIdle = routeTypedMessageSubmission('  What is my battery level?  ', 'idle');
  assert.ok(fromIdle);
  assert.equal(fromIdle.normalizedPrompt, 'What is my battery level?');
  assert.equal(fromIdle.shouldStartMicrophone, false);
  assert.equal(fromIdle.shouldCancelActiveMicrophone, false);
  assert.equal(fromIdle.targetInitialState, 'processing');

  const fromListening = routeTypedMessageSubmission('Check reactor core', 'listening');
  assert.ok(fromListening);
  assert.equal(fromListening.normalizedPrompt, 'Check reactor core');
  assert.equal(fromListening.shouldStartMicrophone, false);
  assert.equal(fromListening.shouldCancelActiveMicrophone, true);
  assert.equal(fromListening.targetInitialState, 'processing');
});

test('V6 CircularResponsiveSpec validates all 9 round-display profiles (320x320 through 480x480) without clipping or collision', async () => {
  const { ROUND_DISPLAY_VALIDATION_PROFILES, computeCircularResponsiveSpec } = await import(
    './wearOsAudit.ts'
  );
  assert.equal(ROUND_DISPLAY_VALIDATION_PROFILES.length, 9);
  const resolutions = ROUND_DISPLAY_VALIDATION_PROFILES.map((p) => p.resolutionPx);
  assert.deepEqual(resolutions, [320, 360, 384, 396, 400, 416, 432, 450, 480]);

  const defaultProfile = ROUND_DISPLAY_VALIDATION_PROFILES.find((p) => p.isDefaultReference);
  assert.ok(defaultProfile);
  assert.equal(defaultProfile?.resolutionPx, 396);

  for (const profile of ROUND_DISPLAY_VALIDATION_PROFILES) {
    const spec = computeCircularResponsiveSpec(profile.resolutionPx, profile.referenceDensity, 1.0);
    assert.equal(spec.resolutionPx, profile.resolutionPx);
    assert.ok(spec.headerSafeWidthPx > 0 && spec.headerSafeWidthPx < profile.resolutionPx);
    assert.ok(spec.bottomDockSafeWidthPx > 0 && spec.bottomDockSafeWidthPx < profile.resolutionPx);
    assert.ok(spec.contentSafeWidthPx > 0 && spec.contentSafeWidthPx < profile.resolutionPx);
    // Symmetric header slots must leave ample room for the centered screen title
    const centerTitleAvailablePx = spec.headerSafeWidthPx - 2 * spec.headerSlotWidthPx;
    assert.ok(
      centerTitleAvailablePx >= 64,
      `Expected >= 64px center title space on ${profile.id}, got ${centerTitleAvailablePx}`
    );
    if (profile.resolutionPx <= 360) {
      assert.equal(spec.matrixNeedsScrollFallback, true);
    }
  }
});



