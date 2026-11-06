// Futuristic Web Audio Synthesizer & Web Speech API Engine for JARVIS Galaxy Watch 4
import { selectBestJarvisVoice } from '../../utils/wearOsAudit.ts';

class JarvisAudioEngine {
  private audioCtx: AudioContext | null = null;
  private activeOscillator: OscillatorNode | null = null;
  private activeGain: GainNode | null = null;
  private activeOscTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSoundEffectMs = 0;

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private synthSupported = false;

  private recognitionInstance: any = null;
  private recognitionSessionId = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private maxRecordTimerId: ReturnType<typeof setTimeout> | null = null;
  private latestTranscript = '';
  private hasDeliveredFinal = false;

  private activeCallbacks: {
    onResult: (transcript: string, isFinal: boolean) => void;
    onError: (err: any) => void;
    onEnd: () => void;
    onVolumeChange?: (level: number) => void;
    onTranscribing?: () => void;
    apiKey?: string;
  } | null = null;

  constructor() {
    this.synthSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    return this.audioCtx;
  }

  /**
   * Immediately stops and disconnects any active Web Audio oscillator/gain node
   * so no tone can ever sustain, buzz, or overlap across state transitions.
   */
  public stopActiveSoundEffect(): void {
    if (this.activeOscTimer) {
      clearTimeout(this.activeOscTimer);
      this.activeOscTimer = null;
    }
    if (this.activeOscillator) {
      try {
        this.activeOscillator.onended = null;
        this.activeOscillator.stop();
      } catch {
        // already stopped
      }
      try {
        this.activeOscillator.disconnect();
      } catch {
        // ignore
      }
      this.activeOscillator = null;
    }
    if (this.activeGain) {
      try {
        this.activeGain.disconnect();
      } catch {
        // ignore
      }
      this.activeGain = null;
    }
  }

  /**
   * Generates crisp, non-buzzing Stark UI acoustic feedback using pure sine synthesis
   * with strict node disconnection, wall-clock teardown guards, and rate limiting.
   */
  public playSoundEffect(
    type: 'tap' | 'listen' | 'process' | 'speak' | 'error' | 'success',
    enabled = true
  ): void {
    if (!enabled) return;

    const nowMs = Date.now();
    // Rate-limit rapid sound effects (e.g. fast rotary scrolling) to prevent oscillator stacking
    if (type === 'tap' && nowMs - this.lastSoundEffectMs < 45) {
      return;
    }
    this.lastSoundEffectMs = nowMs;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx
          .resume()
          .then(() => {
            this.scheduleSineTone(ctx, type);
          })
          .catch(() => {
            // AudioContext blocked prior to user gesture
          });
        return;
      }

      this.scheduleSineTone(ctx, type);
    } catch {
      // Ignore Web Audio restrictions
    }
  }

  private scheduleSineTone(
    ctx: AudioContext,
    type: 'tap' | 'listen' | 'process' | 'speak' | 'error' | 'success'
  ): void {
    // Always stop and disconnect any prior oscillator before starting a new tone
    this.stopActiveSoundEffect();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Pure sine wave only — never sawtooth/triangle which can sound like a harsh buzz
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    let durationSec = 0.05;

    if (type === 'tap') {
      durationSec = 0.04;
      osc.frequency.setValueAtTime(1120, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + durationSec);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    } else if (type === 'listen') {
      durationSec = 0.09;
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(860, now + durationSec);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    } else if (type === 'process') {
      durationSec = 0.08;
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(680, now + durationSec);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    } else if (type === 'speak') {
      durationSec = 0.08;
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + durationSec);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    } else if (type === 'success') {
      durationSec = 0.11;
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.setValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    } else if (type === 'error') {
      // Soft descending sine chime (no harsh sawtooth buzz)
      durationSec = 0.10;
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + durationSec);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    }

    gain.gain.setValueAtTime(0, now + durationSec);

    this.activeOscillator = osc;
    this.activeGain = gain;

    const cleanupNode = () => {
      if (this.activeOscillator === osc) {
        this.activeOscillator = null;
      }
      if (this.activeGain === gain) {
        this.activeGain = null;
      }
      try {
        osc.disconnect();
      } catch {
        // ignore
      }
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    };

    osc.onended = cleanupNode;
    osc.start(now);
    osc.stop(now + durationSec + 0.005);

    // Hard wall-clock safety teardown in case AudioContext clock ever stalls
    this.activeOscTimer = setTimeout(() => {
      try {
        osc.stop();
      } catch {
        // ignore
      }
      cleanupNode();
    }, Math.ceil(durationSec * 1000) + 35);
  }

  /**
   * Returns all available English speech synthesis voices, sorted with British Male voices first.
   */
  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthSupported) return [];
    const voices = window.speechSynthesis.getVoices() || [];
    const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const pool = english.length > 0 ? english : voices;
    return [...pool].sort((a, b) => {
      const aGb = a.lang.toLowerCase().includes('gb') ? 1 : 0;
      const bGb = b.lang.toLowerCase().includes('gb') ? 1 : 0;
      if (aGb !== bGb) return bGb - aGb;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Retrieves the best British English male speech synthesis voice and recommended pitch multiplier.
   */
  public getBritishVoice(
    preferredVoiceURI?: string,
    accent: 'en-GB' | 'en-US' | 'default' = 'en-GB'
  ): { voice: SpeechSynthesisVoice | null; pitchMultiplier: number; isConfirmedMale: boolean } {
    if (!this.synthSupported) {
      return { voice: null, pitchMultiplier: 0.9, isConfirmedMale: false };
    }
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      return { voice: null, pitchMultiplier: 0.9, isConfirmedMale: false };
    }

    const result = selectBestJarvisVoice(voices, accent, preferredVoiceURI);
    return {
      voice: result.selectedVoice,
      pitchMultiplier: result.recommendedPitchMultiplier,
      isConfirmedMale: result.isConfirmedMale,
    };
  }

  /**
   * Speaks text aloud using British English Male JARVIS synthesis.
   */
  public speak(
    text: string,
    options: {
      rate?: number;
      pitch?: number;
      accent?: 'en-GB' | 'en-US' | 'default';
      preferredVoiceURI?: string;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
      onBoundary?: () => void;
    } = {}
  ): void {
    if (!this.synthSupported) {
      options.onEnd?.();
      return;
    }

    // Ensure no oscillator or active speech session overlaps with TTS playback
    this.stopActiveSoundEffect();
    this.stopSpeech();

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      const baseRate = options.rate ?? 1.02;
      const basePitch = options.pitch ?? 1.0;

      const { voice, pitchMultiplier } = this.getBritishVoice(
        options.preferredVoiceURI,
        options.accent ?? 'en-GB'
      );

      utterance.rate = Math.max(0.75, Math.min(1.4, baseRate));
      utterance.pitch = Math.max(0.7, Math.min(1.3, Number((basePitch * pitchMultiplier).toFixed(2))));

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || (options.accent === 'en-US' ? 'en-US' : 'en-GB');
      } else {
        utterance.lang = options.accent === 'en-US' ? 'en-US' : 'en-GB';
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
        options.onStart?.();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        options.onEnd?.();
      };

      utterance.onerror = (e) => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        options.onError?.(e);
      };

      utterance.onboundary = () => {
        options.onBoundary?.();
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      options.onError?.(e);
    }
  }

  /**
   * Halts any active speech synthesis.
   */
  public stopSpeech(): void {
    if (this.synthSupported && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  private cleanupMediaResources(): void {
    if (this.maxRecordTimerId) {
      clearTimeout(this.maxRecordTimerId);
      this.maxRecordTimerId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.mediaStream = null;
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Starts single-session voice capture:
   * - Uses Web Speech API `SpeechRecognition` when available without opening a concurrent
   *   `getUserMedia` / `AudioContext.createMediaStreamSource` loop (which caused full-duplex
   *   audio buffer grinding / "GRRRR" buzz in the browser preview).
   * - Falls back to standalone `MediaRecorder` only when `SpeechRecognition` is not supported.
   */
  public startSpeechRecognition(callbacks: {
    onResult: (transcript: string, isFinal: boolean) => void;
    onError: (err: any) => void;
    onEnd: () => void;
    onVolumeChange?: (level: number) => void;
    onTranscribing?: () => void;
    apiKey?: string;
  }): boolean {
    if (typeof window === 'undefined') return false;

    this.stopSpeechRecognition();
    const sessionId = ++this.recognitionSessionId;
    this.latestTranscript = '';
    this.hasDeliveredFinal = false;
    this.audioChunks = [];
    this.activeCallbacks = callbacks;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const hasMediaDevices =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';

    if (!SpeechRecognition && !hasMediaDevices) {
      return false;
    }

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          if (sessionId !== this.recognitionSessionId) return;
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = 0; i < event.results.length; ++i) {
            const piece = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalTranscript += piece;
            } else {
              interimTranscript += piece;
            }
          }

          const combined = (finalTranscript || interimTranscript).trim();
          if (combined) {
            this.latestTranscript = combined;
          }

          if (finalTranscript.trim() && !this.hasDeliveredFinal) {
            this.hasDeliveredFinal = true;
            const finalClean = finalTranscript.trim();
            this.stopSpeechRecognition();
            callbacks.onResult(finalClean, true);
          } else if (combined && !this.hasDeliveredFinal) {
            callbacks.onResult(combined, false);
          }
        };

        recognition.onerror = (event: any) => {
          if (sessionId !== this.recognitionSessionId) return;
          const errCode = event?.error || 'unknown';
          if (!this.hasDeliveredFinal) {
            if (this.latestTranscript.trim()) {
              this.hasDeliveredFinal = true;
              const finalClean = this.latestTranscript.trim();
              this.stopSpeechRecognition();
              callbacks.onResult(finalClean, true);
            } else {
              callbacks.onError(errCode);
            }
          }
        };

        recognition.onend = () => {
          if (sessionId !== this.recognitionSessionId || this.hasDeliveredFinal) return;
          if (this.latestTranscript.trim()) {
            this.hasDeliveredFinal = true;
            const finalClean = this.latestTranscript.trim();
            this.stopSpeechRecognition();
            callbacks.onResult(finalClean, true);
            return;
          }
          callbacks.onEnd();
        };

        this.recognitionInstance = recognition;
        recognition.start();
        return true;
      } catch {
        // Fall through to MediaRecorder fallback only if SpeechRecognition failed to start
      }
    }

    if (hasMediaDevices) {
      this.startMicrophoneRecordingFallback(callbacks, sessionId);
      return true;
    }

    return false;
  }

  private async startMicrophoneRecordingFallback(
    callbacks: {
      onResult: (transcript: string, isFinal: boolean) => void;
      onError: (err: any) => void;
      onEnd: () => void;
      onVolumeChange?: (level: number) => void;
      onTranscribing?: () => void;
      apiKey?: string;
    },
    sessionId: number
  ): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (sessionId !== this.recognitionSessionId || this.hasDeliveredFinal || !this.activeCallbacks) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.mediaStream = stream;

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      let chosenMimeType = '';
      for (const t of preferredTypes) {
        if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)) {
          chosenMimeType = t;
          break;
        }
      }

      const recorder = chosenMimeType
        ? new MediaRecorder(stream, { mimeType: chosenMimeType })
        : new MediaRecorder(stream);

      this.audioChunks = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || chosenMimeType || 'audio/webm';
        this.cleanupMediaResources();

        if (sessionId !== this.recognitionSessionId || this.hasDeliveredFinal) return;

        if (this.latestTranscript.trim()) {
          this.hasDeliveredFinal = true;
          callbacks.onResult(this.latestTranscript.trim(), true);
          return;
        }

        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        if (audioBlob.size < 500) {
          if (!this.hasDeliveredFinal) {
            callbacks.onError('no-speech');
          }
          return;
        }

        try {
          callbacks.onTranscribing?.();
          const base64Audio = await this.blobToBase64(audioBlob);
          const response = await fetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType,
              apiKey: callbacks.apiKey?.trim() || undefined,
            }),
          });

          const data = await response.json().catch(() => ({}));
          const transcribed = typeof data.text === 'string' ? data.text.trim() : '';

          if (transcribed && !this.hasDeliveredFinal) {
            this.hasDeliveredFinal = true;
            callbacks.onResult(transcribed, true);
          } else if (!this.hasDeliveredFinal) {
            callbacks.onError('empty-transcription');
          }
        } catch (err) {
          if (!this.hasDeliveredFinal) {
            callbacks.onError(err);
          }
        }
      };

      this.mediaRecorder = recorder;
      recorder.start(200);

      this.maxRecordTimerId = setTimeout(() => {
        if (sessionId === this.recognitionSessionId && !this.hasDeliveredFinal) {
          this.finishSpeechRecognition();
        }
      }, 6500);
    } catch (micErr) {
      if (sessionId === this.recognitionSessionId && !this.hasDeliveredFinal) {
        callbacks.onError(micErr);
      }
    }
  }

  public isRecordingAudio(): boolean {
    return Boolean(
      this.mediaRecorder &&
        this.mediaRecorder.state === 'recording' &&
        this.audioChunks.length > 0
    );
  }

  /**
   * Finishes active listening and submits captured speech or recorded audio for transcription.
   */
  public finishSpeechRecognition(): void {
    const cbs = this.activeCallbacks;

    if (this.latestTranscript.trim() && !this.hasDeliveredFinal && cbs) {
      this.hasDeliveredFinal = true;
      const finalClean = this.latestTranscript.trim();
      this.stopSpeechRecognition();
      cbs.onResult(finalClean, true);
      return;
    }

    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.stop();
      } catch {
        // ignore
      }
      this.recognitionInstance = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
        return;
      } catch {
        // ignore
      }
    }

    this.cleanupMediaResources();
    if (!this.hasDeliveredFinal && cbs) {
      cbs.onError('no-speech');
    }
  }

  /**
   * Immediately cancels any active speech recognition or recording without submitting.
   */
  public stopSpeechRecognition(): void {
    this.recognitionSessionId++;
    this.activeCallbacks = null;
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.onresult = null;
        this.recognitionInstance.onerror = null;
        this.recognitionInstance.onend = null;
        this.recognitionInstance.abort();
      } catch {
        // ignore
      }
      this.recognitionInstance = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.mediaRecorder = null;
    this.cleanupMediaResources();
  }
}

export const audioEngine = new JarvisAudioEngine();
