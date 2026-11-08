class SoundSynth {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (typeof window === 'undefined') return null;
    if (typeof navigator !== 'undefined' && navigator.webdriver) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private pitchJitter(baseFreq: number, variance = 0.04): number {
    return baseFreq * (1 + (Math.random() * 2 - 1) * variance);
  }

  public triggerHaptic(pattern: number | number[] = 12): void {
    if (this.isMuted) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore on unsupported devices
      }
    }
  }

  public playSelect(): void {
    this.triggerHaptic(6);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.pitchJitter(460), now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.05);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Heavy tactile stone/tile thud with crisp snap transient on placement.
   */
  public playPlace(): void {
    this.triggerHaptic(14);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Deep resonant stone body thud
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(this.pitchJitter(170, 0.03), now);
    bodyOsc.frequency.exponentialRampToValueAtTime(58, now + 0.095);
    bodyGain.gain.setValueAtTime(0.22, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.105);

    // 2. Crisp carved socket click transient
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(this.pitchJitter(680, 0.04), now);
    clickOsc.frequency.exponentialRampToValueAtTime(210, now + 0.028);
    clickGain.gain.setValueAtTime(0.09, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.035);
  }

  /**
   * Ascending major scale arpeggio (Do-Mi-Sol-Do) that shifts upward in pitch with consecutive combos.
   */
  public playLineClear(lines: number = 1, combo: number = 1): void {
    this.triggerHaptic(lines >= 2 ? [18, 30, 28] : 20);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Do - Mi - Sol - Do (C5, E5, G5, C6, E6)
    const doMiSolDo = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    // Semitone transpose based on combo streak (up to +7 semitones)
    const semitoneShift = Math.min(7, Math.max(0, combo - 1));
    const comboMultiplier = Math.pow(2, semitoneShift / 12);
    const noteCount = lines >= 2 ? 5 : 4;

    for (let i = 0; i < noteCount; i++) {
      const t = now + i * 0.052;
      const freq = doMiSolDo[i % doMiSolDo.length] * comboMultiplier;

      // Primary chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = lines >= 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);

      // Shimmer octave overtone
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(freq * 2, t);
      shimmerGain.gain.setValueAtTime(0.045, t);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(ctx.destination);
      shimmer.start(t);
      shimmer.stop(t + 0.2);
    }
  }

  /**
   * Crystalline smash for Hammer booster and Ice shatters.
   */
  public playHammerSmash(): void {
    this.triggerHaptic([25, 20, 35]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Low impact punch
    const punch = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punch.type = 'sawtooth';
    punch.frequency.setValueAtTime(190, now);
    punch.frequency.exponentialRampToValueAtTime(45, now + 0.14);
    punchGain.gain.setValueAtTime(0.18, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    punch.connect(punchGain);
    punchGain.connect(ctx.destination);
    punch.start(now);
    punch.stop(now + 0.16);

    // High crystalline shards
    const shards = [1480, 1975.5, 2489, 3136];
    shards.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.022;
      osc.frequency.setValueAtTime(this.pitchJitter(freq, 0.05), t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + 0.11);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  public playFrostCrack(): void {
    this.triggerHaptic(15);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [1174.66, 1567.98].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.03;
      osc.frequency.setValueAtTime(this.pitchJitter(freq), t);
      osc.frequency.exponentialRampToValueAtTime(520, t + 0.085);
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.095);
    });
  }

  public playBombDefuse(): void {
    this.triggerHaptic([15, 25, 15]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [587.33, 783.99, 987.77, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.21);
    });
  }

  public playBombDetonate(): void {
    this.triggerHaptic([40, 30, 60]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.34);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.37);
  }

  public playBooster(): void {
    this.triggerHaptic(15);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.13);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playVictory(): void {
    this.triggerHaptic([20, 40, 20, 60]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  public playGameOver(): void {
    this.triggerHaptic([35, 50, 45]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [392.0, 349.23, 311.13, 261.63].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}

export const soundSynth = new SoundSynth();
