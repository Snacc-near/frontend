/**
 * Scroll-theatre camera: pure math, no DOM.
 *
 * A camera shows the world point (cx, cy) at the screen point (ox, oy) with zoom `s`, i.e.
 * `translate(ox oy) scale(s) translate(-cx -cy)` on the figure's root `<g id="cam">`.
 * The stage SVG's user units are the stage's CSS pixels (its viewBox is the stage plus a margin).
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

/** Sine in-out: its peak speed is π/2 times the mean (a cubic peaks at 3 times). */
export function easeSine(t: number): number {
  return (1 - Math.cos(Math.PI * clamp01(t))) / 2;
}

/** Frame-rate independent smoothing factor for a time step `dt` and time constant `tau` (same units). */
export function smoothK(dt: number, tau: number): number {
  return tau > 0 ? 1 - Math.exp(-Math.max(0, dt) / tau) : 1;
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

/** Mean on-screen displacement (px) of a grid of screen points when the camera goes from `a` to `b`. */
export function screenShift(a: Cam, b: Cam, w: number, h: number, n = 5): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const qx = ((i + 0.5) / n) * w;
      const qy = ((j + 0.5) / n) * h;
      const [bx, by] = project(b, a.cx + (qx - a.ox) / a.s, a.cy + (qy - a.oy) / a.s);
      sum += Math.hypot(bx - qx, by - qy);
    }
  }
  return sum / (n * n);
}

/**
 * Arc-length table of the move from `a` to `b`: `len` is the total on-screen travel (px) and
 * `t[k]` the `lerpCam` parameter reached after `k / (t.length - 1)` of that travel. Driving the
 * move through it keeps the on-screen speed even when a pan and a deep zoom are mixed.
 */
export interface Warp {
  len: number;
  t: number[];
}

export function pathWarp(a: Cam, b: Cam, w: number, h: number, steps = 64): Warp {
  const acc = [0];
  let prev = a;
  for (let k = 1; k <= steps; k++) {
    const c = lerpCam(a, b, k / steps);
    acc.push(acc[k - 1]! + screenShift(prev, c, w, h));
    prev = c;
  }
  const len = acc[steps]!;
  const t = [0];
  let k = 0;
  for (let j = 1; j < steps; j++) {
    const want = (j / steps) * len;
    while (k < steps - 1 && acc[k + 1]! < want) k++;
    const seg = acc[k + 1]! - acc[k]!;
    t.push(len > 0 ? (k + (seg > 0 ? (want - acc[k]!) / seg : 0)) / steps : j / steps);
  }
  t.push(1);
  return { len, t };
}

/** `lerpCam` parameter after fraction `u` (0..1) of a move's on-screen travel. */
export function warpAt(wp: Warp, u: number): number {
  const last = wp.t.length - 1;
  if (last < 1) return clamp01(u);
  const x = clamp01(u) * last;
  const i = Math.min(last - 1, Math.floor(x));
  return wp.t[i]! + (wp.t[i + 1]! - wp.t[i]!) * (x - i);
}

/**
 * Camera for a scroll position. `stops[i]` is the scroll offset where keyframe `i` is fully on;
 * between stops the camera holds for `hold` of the segment on each side, then eases across with a
 * sine in-out. With `warps[i]` the move from stop `i` runs at an even on-screen speed.
 */
export function camAtScroll(
  stops: readonly number[],
  cams: readonly Cam[],
  y: number,
  hold = 0.1,
  warps?: ReadonlyArray<Warp | undefined>,
): Cam {
  const n = Math.min(stops.length, cams.length);
  if (n === 0) return { s: 1, cx: 0, cy: 0, ox: 0, oy: 0 };
  if (n === 1 || y <= stops[0]!) return cams[0]!;
  if (y >= stops[n - 1]!) return cams[n - 1]!;
  let i = 0;
  while (i < n - 2 && y >= stops[i + 1]!) i++;
  const span = stops[i + 1]! - stops[i]!;
  const raw = span > 0 ? (y - stops[i]!) / span : 1;
  const u = easeSine((raw - hold) / Math.max(1e-6, 1 - 2 * hold));
  const wp = warps?.[i];
  return lerpCam(cams[i]!, cams[i + 1]!, wp ? warpAt(wp, u) : u);
}

/** Largest on-screen move (px) of the screen corners and centre between two cameras. */
export function camDelta(a: Cam, b: Cam, w: number, h: number): number {
  let d = 0;
  for (const [qx, qy] of [
    [0, 0],
    [w, h],
    [w / 2, h / 2],
  ] as const) {
    const [bx, by] = project(b, a.cx + (qx - a.ox) / a.s, a.cy + (qy - a.oy) / a.s);
    d = Math.max(d, Math.abs(bx - qx) + Math.abs(by - qy));
  }
  return d;
}

/** Index of the nearest stop and the 0..1 "focus" of that keyframe (1 = fully held). */
export function focusAt(stops: readonly number[], y: number, hold = 0.1): { index: number; focus: number } {
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

/**
 * Composited remainder of a camera move: the figure is painted under a `base` camera and a screen
 * transform `q' = t + r·q` (CSS `translate(t) scale(r)`, origin 0 0) carries it to where `cur`
 * shows it. Only `base` repaints the figure; `rel` moves pixels already painted.
 */
export interface Rel {
  r: number;
  tx: number;
  ty: number;
}

export function relCam(base: Cam, cur: Cam): Rel {
  const r = cur.s / base.s;
  return {
    r,
    tx: cur.ox + (base.cx - cur.cx) * cur.s - r * base.ox,
    ty: cur.oy + (base.cy - cur.cy) * cur.s - r * base.oy,
  };
}

/**
 * True while a figure painted under the base camera, with `pad` px of margin around a `w`×`h`
 * screen, still covers that screen through `rel` and the zoom ratio stays inside `[lo, hi]`
 * (strokes do not scale with the figure, so a large ratio would show thicker or thinner lines).
 */
export function relCovers(rel: Rel, w: number, h: number, pad: number, lo: number, hi: number): boolean {
  if (!(rel.r >= lo && rel.r <= hi)) return false;
  const x0 = -rel.tx / rel.r;
  const y0 = -rel.ty / rel.r;
  const x1 = (w - rel.tx) / rel.r;
  const y1 = (h - rel.ty) / rel.r;
  return x0 >= -pad && y0 >= -pad && x1 <= w + pad && y1 <= h + pad;
}

/**
 * Base camera for a repaint: the same view as `cur` painted `k` times larger, so the composited
 * remainder is a plain `1/k` scale about the camera's screen point (`k > 1` paints ahead of a
 * zoom-in, and the layer is only ever scaled down, never up).
 */
export function aheadCam(cur: Cam, k: number): Cam {
  return { ...cur, s: cur.s * k };
}

/** CSS transform for `rel` (origin 0 0); empty for the identity. */
export function relTransform(rel: Rel): string {
  const tx = Math.round(rel.tx * 100) / 100;
  const ty = Math.round(rel.ty * 100) / 100;
  const r = Math.round(rel.r * 1e5) / 1e5;
  if (tx === 0 && ty === 0 && r === 1) return "";
  return `translate3d(${tx}px, ${ty}px, 0) scale(${r})`;
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
