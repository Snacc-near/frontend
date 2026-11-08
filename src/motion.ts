/**
 * Token Gerak & Kurva Easing Eksak dari motionmaxxing (FE-26).
 * Menghindari transisi CSS seragam ("AI slop"); setiap peristiwa memiliki fisika tersendiri.
 */

export const ease = {
  /** Pendaratan halus eksponensial (k = 3.41) untuk transisi panel & kamera */
  softLand(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const k = 3.41;
    return (1 - Math.exp(-k * t)) / (1 - Math.exp(-k));
  },

  /** Snap cepat lalu mengunci presisi (w = 0.942, τ = 0.118) untuk jarum termometer */
  snapSettle(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const w = 0.942;
    const tau = 0.118;
    const ramp = Math.min(1, t / (1 - w));
    const settle = 1 - Math.exp(-t / tau);
    return w * settle + (1 - w) * ramp;
  },

  /** Pegas teredam (c = 2.67, ω = 4.36) khusus untuk kemunculan Nutrient Burst Badge */
  popOver(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c = 2.67;
    const omega = 4.36;
    return 1 - Math.exp(-c * t) * (Math.cos(omega * t) + (c / omega) * Math.sin(omega * t));
  },

  /** Kurva S halus untuk rotasi orbital & napas membran sel */
  softInOut(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  },

  /** Akselerasi keluar saat partikel spora tersedot ke dalam inti sel */
  accelExit(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * t;
  },
} as const;

export const dur = {
  instant: 90,
  fast: 220,
  snap: 380,
  settle: 640,
  breathe: 1800,
} as const;

/**
 * Deteksi preferensi aksesibilitas pengguna (FE-28 / UI-132).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Interpolasi nilai numerik berbasis requestAnimationFrame menggunakan kurva motionmaxxing.
 */
export function tweenValue(
  from: number,
  to: number,
  durationMs: number,
  easingFn: (t: number) => number,
  onUpdate: (val: number) => void,
  onComplete?: () => void,
): () => void {
  if (prefersReducedMotion() || durationMs <= 0 || typeof requestAnimationFrame === "undefined") {
    onUpdate(to);
    onComplete?.();
    return () => {};
  }

  const start = performance.now();
  let rafId = 0;
  let cancelled = false;

  const step = (now: number) => {
    if (cancelled) return;
    const elapsed = now - start;
    const progress = Math.min(1, Math.max(0, elapsed / durationMs));
    const eased = easingFn(progress);
    onUpdate(from + (to - from) * eased);

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  };

  rafId = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}
