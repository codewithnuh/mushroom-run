import { STORAGE } from './constants';

export type SfxName =
  | 'jump'
  | 'coin'
  | 'stomp'
  | 'bump'
  | 'break'
  | 'powerup'
  | 'grow'
  | 'shrink'
  | 'hurt'
  | 'die'
  | 'checkpoint'
  | 'flag'
  | 'oneup'
  | 'pause'
  | 'start'
  | 'land';

const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

function noteFrequency(note: string): number {
  const match = /^([A-G][#b]?)(\d)$/.exec(note);
  if (!match) return 440;
  const midi = 12 * (Number(match[2]) + 1) + NOTE_OFFSETS[match[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE.muted) === '1';
  } catch {
    return false;
  }
}

const MELODY: Array<string | null> = [
  // Bar 1 — C
  'E5', null, 'G5', null, 'A5', null, 'G5', 'E5',
  'D5', null, 'E5', null, 'C5', null, null, null,
  // Bar 2 — Am
  'C5', null, 'E5', null, 'G5', null, 'E5', 'C5',
  'A4', null, 'C5', null, 'E5', null, 'D5', null,
  // Bar 3 — F
  'F5', null, 'A5', null, 'C6', null, 'A5', 'G5',
  'E5', null, 'G5', null, 'D5', null, 'E5', null,
  // Bar 4 — G
  'C6', null, 'B5', 'G5', 'A5', null, 'G5', 'E5',
  'D5', null, 'C5', null, 'G4', null, null, null,
];

const BASS_ROOTS = ['C3', 'A2', 'F2', 'G2'];
const CHORDS: string[][] = [
  ['C4', 'E4', 'G4'],
  ['A3', 'C4', 'E4'],
  ['F3', 'A3', 'C4'],
  ['G3', 'B3', 'D4'],
];

export class AudioEngine {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = readMuted();
  private unlocked = false;
  private musicStarted = false;
  private scheduler: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;
  private stepDuration = 60 / 128 / 4;
  private readonly musicLevel = 0.42;

  get isMuted(): boolean {
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (this.context?.state === 'suspended') {
        try {
          await this.context.resume();
        } catch {
          // Ignore resume failures; a later gesture can try again.
        }
      }
      return;
    }

    const AudioCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    try {
      const context = new AudioCtor();
      const master = context.createGain();
      master.gain.value = 0.9;
      master.connect(context.destination);

      const musicGain = context.createGain();
      musicGain.gain.value = this.muted ? 0 : this.musicLevel;
      musicGain.connect(master);

      const sfxGain = context.createGain();
      sfxGain.gain.value = 0.8;
      sfxGain.connect(master);

      this.context = context;
      this.musicGain = musicGain;
      this.sfxGain = sfxGain;
      this.noiseBuffer = this.createNoiseBuffer(context);
      this.unlocked = true;

      await context.resume();
      this.startMusic();
    } catch {
      // Audio is a progressive enhancement; the game still works silently.
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(STORAGE.muted, this.muted ? '1' : '0');
    } catch {
      // Storage can be unavailable in private browsing.
    }
    if (this.context && this.musicGain) {
      const now = this.context.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(this.muted ? 0 : this.musicLevel, now, 0.025);
    }
    return this.muted;
  }

  play(name: SfxName): void {
    if (!this.context || !this.sfxGain || this.muted) return;
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    const t = this.context.currentTime + 0.005;

    switch (name) {
      case 'jump':
        this.sweep(330, 620, 0.13, 'square', 0.045, t);
        this.sweep(660, 880, 0.06, 'triangle', 0.018, t + 0.015);
        break;
      case 'land':
        this.tone(95, 0.055, 'triangle', 0.025, t, 55);
        break;
      case 'coin':
        this.tone(987.77, 0.055, 'square', 0.032, t);
        this.tone(1318.51, 0.12, 'square', 0.03, t + 0.055);
        this.tone(1975.53, 0.08, 'triangle', 0.014, t + 0.07);
        break;
      case 'stomp':
        this.tone(155, 0.08, 'square', 0.045, t, 65);
        this.noise(0.045, 0.032, 900, t);
        break;
      case 'bump':
        this.tone(125, 0.09, 'triangle', 0.045, t, 80);
        this.noise(0.025, 0.018, 500, t);
        break;
      case 'break':
        this.noise(0.2, 0.055, 1400, t);
        this.tone(180, 0.16, 'square', 0.035, t, 55);
        break;
      case 'powerup':
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
          this.tone(frequency, 0.11, 'square', 0.03, t + index * 0.075);
          this.tone(frequency * 2, 0.06, 'triangle', 0.01, t + index * 0.075);
        });
        break;
      case 'grow':
        this.sweep(523.25, 1046.5, 0.22, 'square', 0.03, t);
        this.tone(1567.98, 0.16, 'triangle', 0.02, t + 0.16);
        break;
      case 'shrink':
        this.sweep(880, 330, 0.22, 'square', 0.035, t);
        break;
      case 'hurt':
        this.sweep(440, 110, 0.36, 'sawtooth', 0.03, t);
        this.noise(0.12, 0.02, 700, t);
        break;
      case 'die':
        [659.25, 523.25, 392, 329.63, 261.63, 196].forEach((frequency, index) => {
          this.tone(frequency, 0.14, 'square', 0.03, t + index * 0.12);
        });
        break;
      case 'checkpoint':
        [523.25, 659.25, 783.99].forEach((frequency, index) => {
          this.tone(frequency, 0.22, 'triangle', 0.03, t + index * 0.09);
        });
        break;
      case 'flag':
        [
          [523.25, 0],
          [659.25, 0.11],
          [783.99, 0.22],
          [1046.5, 0.33],
          [987.77, 0.5],
          [1046.5, 0.62],
          [1318.51, 0.78],
        ].forEach(([frequency, delay]) => {
          this.tone(frequency, 0.2, 'square', 0.028, t + delay);
        });
        break;
      case 'oneup':
        [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => {
          this.tone(frequency, 0.09, 'square', 0.025, t + index * 0.07);
        });
        break;
      case 'pause':
        this.tone(660, 0.05, 'triangle', 0.02, t);
        break;
      case 'start':
        [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
          this.tone(frequency, 0.15, 'square', 0.026, t + index * 0.1);
        });
        break;
      default:
        break;
    }
  }

  private startMusic(): void {
    if (!this.context || !this.musicGain || this.musicStarted) return;
    this.musicStarted = true;
    this.stepIndex = 0;
    this.nextStepTime = this.context.currentTime + 0.15;
    this.scheduler = window.setInterval(() => this.scheduleMusic(), 45);
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (!context || !this.musicGain) return;
    const lookahead = 0.18;
    while (this.nextStepTime < context.currentTime + lookahead) {
      const step = this.stepIndex % 64;
      this.scheduleStep(step, this.nextStepTime);
      this.nextStepTime += this.stepDuration;
      this.stepIndex += 1;
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.context || !this.musicGain) return;
    const bar = Math.floor(step / 16);
    const inBar = step % 16;

    // Melody — a soft square wave, like a tiny handheld console.
    const melody = MELODY[step];
    if (melody) {
      this.tone(
        noteFrequency(melody),
        this.stepDuration * 1.5,
        'square',
        0.016,
        time,
        undefined,
        this.musicGain,
      );
    }

    // Bass pulse on every quarter note.
    if (inBar % 4 === 0) {
      this.tone(
        noteFrequency(BASS_ROOTS[bar]),
        this.stepDuration * 3.4,
        'triangle',
        0.03,
        time,
        undefined,
        this.musicGain,
      );
    }

    // Broken chord arpeggio, very quiet.
    if (inBar % 2 === 0) {
      const chord = CHORDS[bar];
      const note = chord[(inBar / 2) % chord.length];
      this.tone(
        noteFrequency(note),
        this.stepDuration * 1.4,
        'sine',
        0.012,
        time,
        undefined,
        this.musicGain,
      );
    }

    // Soft brushed hat.
    if (inBar % 2 === 1) {
      this.noise(0.022, 0.006, 6000, time, this.musicGain);
    }

    // Heartbeat kick every half bar.
    if (step % 8 === 0) {
      this.tone(120, 0.07, 'sine', 0.022, time, 48, this.musicGain);
    }
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    startTime: number,
    endFrequency?: number,
    destination?: GainNode,
  ): void {
    const context = this.context;
    const target = destination ?? this.sfxGain;
    if (!context || !target) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), startTime);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startTime + duration);
    }
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(target);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  }

  private sweep(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    startTime: number,
  ): void {
    this.tone(from, duration, type, volume, startTime, to);
  }

  private noise(
    duration: number,
    volume: number,
    cutoff: number,
    startTime: number,
    destination?: GainNode,
  ): void {
    const context = this.context;
    const target = destination ?? this.sfxGain;
    if (!context || !target || !this.noiseBuffer) return;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    source.start(startTime);
    source.stop(startTime + duration + 0.02);
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * 0.3);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.6 + white * 0.4;
      data[i] = last;
    }
    return buffer;
  }

  dispose(): void {
    if (this.scheduler !== null) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    void this.context?.close();
    this.context = null;
    this.musicGain = null;
    this.sfxGain = null;
  }
}

export const audio = new AudioEngine();
