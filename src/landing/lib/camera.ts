/**
 * Scroll-theatre camera: pure math, no DOM.
 *
 * A camera shows the world point (cx, cy) at the screen point (ox, oy) with zoom `s`, i.e.
 * `translate(ox oy) scale(s) translate(-cx -cy)` on the figure's root `<g id="cam">`.
 * The stage SVG's viewBox equals the stage's pixel size, so screen units are CSS pixels.
 */

export interface Anchor {
  x: number;
  y: number;
  w: number;
  h: number;
  cx?: number;
  cy?: number;
}

export interface Cam {
  s: number;
  cx: number;
  cy: number;
  ox: number;
  oy: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t);

/** Smooth S-curve (cubic in-out). */
export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Fit an anchor box into a screen frame (with a margin factor > 1 leaving air around it). */
export function fitAnchor(a: Anchor, frame: Box, margin = 1.15, maxScale = 80): Cam {
  const w = Math.max(a.w, 1e-3) * margin;
  const h = Math.max(a.h, 1e-3) * margin;
  const s = Math.min(frame.w / w, frame.h / h, maxScale);
  return {
    s,
    cx: a.cx ?? a.x + a.w / 2,
    cy: a.cy ?? a.y + a.h / 2,
    ox: frame.x + frame.w / 2,
    oy: frame.y + frame.h / 2,
  };
}

/**
 * Interpolate two cameras. Zoom is interpolated in log space (constant perceived speed) and the
 * world centre moves in step with the zoom, so a deep zoom heads straight for its target instead
 * of drifting sideways at high magnification.
 */
export function lerpCam(a: Cam, b: Cam, t: number): Cam {
  const k = clamp01(t);
  const ratio = b.s / a.s;
  const s = a.s * Math.pow(ratio, k);
  let w = k;
  if (Math.abs(Math.log(ratio)) > 1e-3) {
    w = (1 / a.s - 1 / s) / (1 / a.s - 1 / b.s);
  }
  return {
    s,
    cx: a.cx + (b.cx - a.cx) * w,
    cy: a.cy + (b.cy - a.cy) * w,
    ox: a.ox + (b.ox - a.ox) * k,
    oy: a.oy + (b.oy - a.oy) * k,
  };
}

/**
 * Camera for a scroll position. `stops[i]` is the scroll offset where keyframe `i` is fully on;
 * between stops the camera holds for `hold` of the segment on each side, then eases across.
 */
export function camAtScroll(stops: readonly number[], cams: readonly Cam[], y: number, hold = 0.22): Cam {
  const n = Math.min(stops.length, cams.length);
  if (n === 0) return { s: 1, cx: 0, cy: 0, ox: 0, oy: 0 };
  if (n === 1 || y <= stops[0]!) return cams[0]!;
  if (y >= stops[n - 1]!) return cams[n - 1]!;
  let i = 0;
  while (i < n - 2 && y >= stops[i + 1]!) i++;
  const span = stops[i + 1]! - stops[i]!;
  const raw = span > 0 ? (y - stops[i]!) / span : 1;
  const t = easeInOut((raw - hold) / Math.max(1e-6, 1 - 2 * hold));
  return lerpCam(cams[i]!, cams[i + 1]!, t);
}

/** Index of the nearest stop and the 0..1 "focus" of that keyframe (1 = fully held). */
export function focusAt(stops: readonly number[], y: number, hold = 0.22): { index: number; focus: number } {
  if (stops.length === 0) return { index: 0, focus: 0 };
  let best = 0;
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs(stops[i]! - y) < Math.abs(stops[best]! - y)) best = i;
  }
  const prev = stops[best - 1];
  const next = stops[best + 1];
  const here = stops[best]!;
  // Past the last stop (or before the first) reuse the neighbouring segment's length.
  const after = next !== undefined ? next - here : prev !== undefined ? here - prev : 1;
  const before = prev !== undefined ? here - prev : after;
  const span = y >= here ? after : before;
  const d = Math.abs(y - here) / Math.max(1, span);
  const focus = d <= hold ? 1 : clamp01(1 - (d - hold) / Math.max(1e-6, 0.5 - hold));
  return { index: best, focus };
}

export function camTransform(c: Cam): string {
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return `translate(${r(c.ox)} ${r(c.oy)}) scale(${r(c.s)}) translate(${r(-c.cx)} ${r(-c.cy)})`;
}

/** World point -> screen point under a camera. */
export function project(c: Cam, x: number, y: number): [number, number] {
  return [c.ox + (x - c.cx) * c.s, c.oy + (y - c.cy) * c.s];
}

/** Zoom the camera by `factor` about a screen point (for the microscope lens). */
export function zoomAbout(c: Cam, factor: number, px: number, py: number): Cam {
  const wx = c.cx + (px - c.ox) / c.s;
  const wy = c.cy + (py - c.oy) / c.s;
  return { s: c.s * factor, cx: wx, cy: wy, ox: px, oy: py };
}

/** Scale key: one label per zoom level, in story order (incubator, dish, colony, cell, mitochondrion). */
export const SCALE_LABELS = ["1 cm", "1 mm", "100 µm", "10 µm", "1 µm"] as const;

/**
 * Pick the scale-key label and bar length for a zoom, given the zooms of the five story levels.
 * The bar grows between levels and the label switches at the log-midpoint.
 */
export function scaleKey(s: number, levels: readonly number[], baseBar = 64): { label: string; bar: number } {
  const n = Math.min(levels.length, SCALE_LABELS.length);
  if (n === 0 || !(s > 0)) return { label: SCALE_LABELS[0], bar: baseBar };
  let best = 0;
  for (let i = 1; i < n; i++) {
    if (Math.abs(Math.log(s / levels[i]!)) < Math.abs(Math.log(s / levels[best]!))) best = i;
  }
  const bar = Math.max(36, Math.min(120, baseBar * (s / levels[best]!)));
  return { label: SCALE_LABELS[best]!, bar: Math.round(bar) };
}
