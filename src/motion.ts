/**
 * Motion tokens & exact easing curves from motionmaxxing (FE-26).
 * Avoids uniform CSS transitions ("AI slop"); every event has its own physics.
 */
import { readMotionPref, resolveReducedMotion } from "./prefs/prefs.ts";

export const ease = {
  /** A smooth exponential landing (k = 3.41) for panel & camera transitions */
  softLand(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const k = 3.41;
    return (1 - Math.exp(-k * t)) / (1 - Math.exp(-k));
  },

  /** A fast snap then a precision lock (w = 0.942, τ = 0.118) for the thermometer needle */
  snapSettle(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const w = 0.942;
    const tau = 0.118;
    const ramp = Math.min(1, t / (1 - w));
    const settle = 1 - Math.exp(-t / tau);
    return w * settle + (1 - w) * ramp;
  },

  /** A damped spring (c = 2.67, ω = 4.36) dedicated to the Nutrient Burst Badge appearance */
  popOver(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c = 2.67;
    const omega = 4.36;
    return 1 - Math.exp(-c * t) * (Math.cos(omega * t) + (c / omega) * Math.sin(omega * t));
  },

  /** A smooth S-curve for the orbital rotation & the cell membrane breathing */
  softInOut(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  },

  /** An exit acceleration when spore particles get sucked into the cell core */
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
 * Detects the user's accessibility preference (FE-28 / UI-132). The OS setting is the default; the
 * override saved in Settings (UI-151) wins over it.
 */
export function prefersReducedMotion(): boolean {
  const os =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return resolveReducedMotion(readMotionPref(), os);
}

/**
 * The requestAnimationFrame-based numeric interpolation using the motionmaxxing curves.
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
