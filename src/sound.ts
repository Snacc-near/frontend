/**
 * Synth Audio Prosedural Ringan (Gaya FE-34 ZzFX) via Web Audio API.
 * Tanpa file audio eksternal (patuh FE-01 CSP same-origin).
 */

class BioSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = false;

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Suara detak organik saat sel memakan molekul spora di ruang 3D */
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
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Gelombang kejut harmonik saat Nutrient Burst (UI-117) meledak dari lisis sel */
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
      gain.connect(ctx.destination);
      osc.start(now + i * 0.03);
      osc.stop(now + 0.46 + i * 0.03);
    }
  }

  /** Nada transisi termostat saat menabrak ambang zona (UI-118 / UI-119) */
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
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }
}

export const bioSound = new BioSoundEngine();
