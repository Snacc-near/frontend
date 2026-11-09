/**
 * Organic helpers on top of the anatomy kit (original code, MIT kit underneath):
 * ellipsoids with four-tone seamless shading (domes, beans, bubbles), smooth closed
 * blobs and loops, small vector maths. Pure and deterministic.
 */
import { cameraOf, iso, type Flat, type Point3, type Projection, type SolidPaths } from "./iso-kit.ts";

export const TAU = Math.PI * 2;
const LIGHT_UP = 1.2;
const BANDS = [0, 0.2, 0.42, 0.62];

type V3 = [number, number, number];
export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit3 = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const t1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
export const polyPath = (pts: Flat[], closed = false) =>
  pts.length ? pts.map(([x, y], i) => `${i ? "L" : "M"}${t1(x)} ${t1(y)}`).join("") + (closed ? "Z" : "") : "";

/** Smooth curve through screen points (Catmull-Rom to cubic Bezier). */
export function smoothPath(pts: Flat[], closed = true, tension = 0.5): string {
  const n = pts.length;
  if (n < 3) return polyPath(pts, closed);
  const at = (i: number) => (closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  let d = `M${t1(pts[0]![0])} ${t1(pts[0]![1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k = tension / 3;
    d += `C${t1(p1[0] + (p2[0] - p0[0]) * k)} ${t1(p1[1] + (p2[1] - p0[1]) * k)} ${t1(p2[0] - (p3[0] - p1[0]) * k)} ${t1(p2[1] - (p3[1] - p1[1]) * k)} ${t1(p2[0])} ${t1(p2[1])}`;
  }
  return d + (closed ? "Z" : "");
}

export function viewOf(P: Projection): V3 {
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  return [cosA * cosE, sinA * cosE, sinE];
}

export function lightOf(P: Projection): V3 {
  const { sinA, cosA } = cameraOf(P);
  return unit3([-sinA, cosA, LIGHT_UP]);
}

function frameAlong(a: V3) {
  const axis = unit3(a);
  const helper: V3 = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = unit3(cross3(helper, axis));
  const v = cross3(axis, u);
  return { a: axis, u, v };
}

type Frame = ReturnType<typeof frameAlong> & { o: V3 };
function pointOf(F: Frame, s: number, r: number, angle: number): V3 {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [
    F.o[0] + F.a[0] * s + r * (c * F.u[0] + n * F.v[0]),
    F.o[1] + F.a[1] * s + r * (c * F.u[1] + n * F.v[1]),
    F.o[2] + F.a[2] * s + r * (c * F.u[2] + n * F.v[2]),
  ];
}

export function hullOf(points: Flat[]): Flat[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Flat[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 1e-9) lower.pop();
    lower.push(p);
  }
  const upper: Flat[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 1e-9) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const rz = (v: V3, t: number): V3 => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t), v[2]];

export interface EllipsoidOptions {
  steps?: number;
  /** bends the drawn points in the pre-yaw local frame (a bean's curve, a dome's clamp). */
  warp?: ((local: V3) => V3) | null;
}

/**
 * An ellipsoid as kit SolidPaths (seamless four-tone). Centre c, radii [a, b, h],
 * yaw radians about z. Tones are the sphere's light caps mapped through the same warp.
 */
export function ellipsoidOf(c: V3, r: V3, yaw: number, P: Projection, { steps = 56, warp = null }: EllipsoidOptions = {}): SolidPaths {
  const V = viewOf(P);
  const L = lightOf(P);
  const toWorld = (u: V3): V3 => {
    let loc: V3 = [u[0] * r[0], u[1] * r[1], u[2] * r[2]];
    if (warp) loc = warp(loc);
    return add3(c, rz(loc, yaw));
  };
  const flat = (p: V3): Flat => iso(p as Point3, P);
  const minv = (v: V3): V3 => {
    const q = rz(v, -yaw);
    return [q[0] / r[0], q[1] / r[1], q[2] / r[2]];
  };
  const w = unit3(minv(V));
  const Fw: Frame = { ...frameAlong(w), o: [0, 0, 0] };
  const ring = Array.from({ length: steps }, (_, i) => pointOf(Fw, 0, 1, (i / steps) * TAU));
  const outline = polyPath(hullOf(ring.map((u) => flat(toWorld(u)))), true);
  const apexU = unit3(((): V3 => {
    const q = rz(V, -yaw);
    return [q[0] * r[0], q[1] * r[1], q[2] * r[2]];
  })());
  const capOf = (th: number) => {
    const pts = ring.filter((u) => dot3(u, L) >= th).map((u) => flat(toWorld(u)));
    const LF: Frame = { ...frameAlong(L), o: mul3(L, th) };
    const rad = Math.sqrt(Math.max(0, 1 - th * th));
    for (let i = 0; i < steps; i++) {
      const u = pointOf(LF, 0, rad, (i / steps) * TAU);
      if (dot3(u, w) >= -1e-9) pts.push(flat(toWorld(u)));
    }
    if (dot3(apexU, L) >= th) pts.push(flat(toWorld(apexU)));
    return pts.length > 2 ? polyPath(hullOf(pts), true) : "";
  };
  const shades = [outline, capOf(BANDS[1]!), capOf(BANDS[2]!), capOf(BANDS[3]!)];
  return { fill: outline, outline, crease: "", top: "", shades, seamless: true };
}

/** Smooth closed loop on a horizontal plane at height z; radius is a function of angle. */
export function loopAt(cx: number, cy: number, z: number, radius: (angle: number) => number, P: Projection, steps = 36): string {
  const pts: Flat[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    const rr = radius(a);
    pts.push(iso([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z], P));
  }
  return smoothPath(pts, true);
}

/** Ring of points on a horizontal plane (not smoothed): used for pores and dots. */
export function circlePoints(cx: number, cy: number, z: number, radius: number, count: number, P: Projection, from = 0, span = TAU): Flat[] {
  return Array.from({ length: count }, (_, i) => {
    const a = from + (i / count) * span;
    return iso([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, z], P);
  });
}

/** Projected 3D arc between two world angles on a horizontal circle (open path). */
export function arcAt(cx: number, cy: number, z: number, radius: number, a0: number, a1: number, P: Projection, steps = 18): string {
  const pts: Flat[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push(iso([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, z], P));
  }
  return polyPath(pts);
}

/** Closed ellipse on a tangent plane at world point p with unit normal n (bud scars). */
export function surfaceRing(p: V3, normal: V3, rho: number, P: Projection, steps = 20): string {
  const n = unit3(normal);
  const ref: V3 = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const e1 = unit3(cross3(ref, n));
  const e2 = cross3(n, e1);
  const pts: Flat[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    pts.push(iso(add3(p, add3(mul3(e1, Math.cos(a) * rho), mul3(e2, Math.sin(a) * rho))) as Point3, P));
  }
  return polyPath(pts, true);
}

/** True when a world surface normal faces the camera (with a margin). */
export function facesViewer(n: V3, P: Projection, margin = 0.12): boolean {
  return dot3(unit3(n), viewOf(P)) > margin;
}

/** Deterministic organic radius multiplier from a seed: slightly irregular, never spiky. */
export function wobbleOf(seed: number, amount = 0.055): (angle: number) => number {
  const p1 = (seed % 97) * 0.37;
  const p2 = (seed % 53) * 0.61;
  const p3 = (seed % 31) * 0.83;
  return (a) => 1 + amount * (0.55 * Math.sin(2 * a + p1) + 0.3 * Math.sin(3 * a + p2) + 0.15 * Math.sin(5 * a + p3));
}
