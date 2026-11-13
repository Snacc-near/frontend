/**
 * Lightweight Procedural Synth Audio (the FE-34 ZzFX style) via the Web Audio API.
 * No external audio files (honors the FE-01 same-origin CSP).
 */

class BioSoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private level = 1;
  public enabled = false;
  /** The Settings switch (UI-151): when true nothing plays, whatever `enabled` says. */
  public muted = false;

  /** Master volume, 0..1; applies to sounds already playing as well as new ones. */
  public setVolume(volume: number): void {
    this.level = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    if (this.master) this.master.gain.value = this.level;
  }

  public get volume(): number {
    return this.level;
  }

  /** Every voice connects here, so one gain node scales them all. */
  private out(ctx: AudioContext): AudioNode {
    return this.master ?? ctx.destination;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || this.muted || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.level;
        this.master.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** The organic heartbeat sound when a cell eats a spore molecule in 3D space */
  public playSporeAbsorb(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.14);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** The harmonic shockwave when a Nutrient Burst (UI-117) explodes from a cell lysis */
  public playNutrientBurst(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [220, 330, 440, 660];
    for (let i = 0; i < freqs.length; i++) {
      const f = freqs[i]!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(f * 0.8, now + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.38 + i * 0.03);
      gain.gain.setValueAtTime(0.08, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45 + i * 0.03);
      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(now + i * 0.03);
      osc.stop(now + 0.46 + i * 0.03);
    }
  }

  /** Small chime when a production item is collected. CC0 original synthesis. */
  public playCollect(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [523, 659, 784];
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freqs[i]!, now + i * 0.05);
      gain.gain.setValueAtTime(0.07, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);
      osc.connect(gain);
      gain.connect(this.out(ctx));
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.2);
    }
  }

  /** Soft pop when a strain is fed. CC0 original synthesis. */
  public playFeed(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /** Short keycap click tick (ZzFX-style square blip). */
  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1050, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Low hum when an action is unavailable. CC0 original synthesis. */
  public playDenied(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** The thermostat transition tone when a zone threshold is crossed (UI-118 / UI-119) */
  public playZoneShift(toZone: "Hypothermia" | "Goldilocks" | "Fever"): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = toZone === "Fever" ? "sawtooth" : toZone === "Hypothermia" ? "sine" : "triangle";
    const startFreq = toZone === "Fever" ? 260 : toZone === "Hypothermia" ? 540 : 360;
    const endFreq = toZone === "Fever" ? 520 : toZone === "Hypothermia" ? 240 : 440;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.25);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(this.out(ctx));
    osc.start(now);
    osc.stop(now + 0.28);
  }
}

export const bioSound = new BioSoundEngine();
