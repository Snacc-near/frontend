// Organic helpers on top of the anatomy kit: ellipsoids (cell, nucleus, bean mitochondria, vacuole, vesicles),
// 3D ellipses on a plane (cut faces, membranes), smooth closed blobs and crescents. Original code.
import { iso } from "./kit/iso-kit.mjs";
import { viewOf, lightOf, frameAlong, pointOf, hullOf, add3, sub3, mul3, dot3, unit3 } from "./kit/lathe.mjs";

const TAU = Math.PI * 2;
const BANDS = [0, 0.2, 0.42, 0.62];
const t1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
export const pathOf = (pts, closed = false) => (pts.length ? pts.map(([x, y], i) => `${i ? "L" : "M"}${t1(x)} ${t1(y)}`).join("") + (closed ? "Z" : "") : "");

/** Smooth closed/open curve through screen points (Catmull-Rom to cubic Bezier). */
export function smoothPath(pts, closed = true, tension = 0.5) {
  const n = pts.length;
  if (n < 3) return pathOf(pts, closed);
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${t1(pts[0][0])} ${t1(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const k = tension / 3;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${t1(c1[0])} ${t1(c1[1])} ${t1(c2[0])} ${t1(c2[1])} ${t1(p2[0])} ${t1(p2[1])}`;
  }
  return d + (closed ? "Z" : "");
}

const rz = (v, t) => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t), v[2]];

/**
 * An ellipsoid as kit SolidPaths (seamless four-tone). centre c, radii [a,b,h], yaw radians about z.
 * Tones are the sphere's caps mapped through the same linear map, so shading stays consistent with the kit's light.
 * warp(local) bends the drawn points in the pre-yaw local frame (a bean's curve).
 */
export function ellipsoidOf(c, r, yaw, P, { steps = 64, warp = null } = {}) {
  const V = viewOf(P), L = lightOf(P);
  const toWorld = (u) => {
    let loc = [u[0] * r[0], u[1] * r[1], u[2] * r[2]];
    if (warp) loc = warp(loc);
    return add3(c, rz(loc, yaw));
  };
  const flat = (p) => iso(p, P);
  const minv = (v) => { const q = rz(v, -yaw); return [q[0] / r[0], q[1] / r[1], q[2] / r[2]]; };
  const w = unit3(minv(V));
  const Fw = frameAlong([0, 0, 0], w);
  const ring = Array.from({ length: steps }, (_, i) => pointOf(Fw, 0, 1, (i / steps) * TAU));
  const outline = pathOf(ring.map((u) => flat(toWorld(u))), true);
  const apexU = unit3((() => { const q = rz(V, -yaw); return [q[0] * r[0], q[1] * r[1], q[2] * r[2]]; })());
  const capOf = (th) => {
    const pts = ring.filter((u) => dot3(u, L) >= th).map((u) => flat(toWorld(u)));
    const LF = frameAlong(mul3(L, th), L);
    const rad = Math.sqrt(Math.max(0, 1 - th * th));
    for (let i = 0; i < steps; i++) {
      const u = pointOf(LF, 0, rad, (i / steps) * TAU);
      if (dot3(u, w) >= -1e-9) pts.push(flat(toWorld(u)));
    }
    if (dot3(apexU, L) >= th) pts.push(flat(toWorld(apexU)));
    return pts.length > 2 ? pathOf(hullOf(pts), true) : "";
  };
  const shades = [outline, capOf(BANDS[1]), capOf(BANDS[2]), capOf(BANDS[3])];
  return { fill: outline, outline, crease: "", top: "", shades, seamless: true };
}

/** Screen polygon of a 3D ellipse on a plane: centre c, unit axes e1,e2, radii, angles t0..t1 (radians). */
export function ellipse3(c, e1, e2, rx, ry, P, { from = 0, to = TAU, steps = 64 } = {}) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push(iso(add3(c, add3(mul3(e1, Math.cos(a) * rx), mul3(e2, Math.sin(a) * ry))), P));
  }
  return out;
}

/** Plane through the viewer-facing side: horizontal axis e1 (screen right) and z. */
export function facePlane(P) {
  const a = ((P.azimuth ?? 45) * Math.PI) / 180;
  return { e1: [Math.sin(a), -Math.cos(a), 0], e2: [0, 0, 1], n: [Math.cos(a), Math.sin(a), 0] };
}

/** Point on the face plane through c: (dx right, dz up, dn toward viewer). */
export function onFace(c, P, dx, dz, dn = 0) {
  const { e1, e2, n } = facePlane(P);
  return add3(c, add3(add3(mul3(e1, dx), mul3(e2, dz)), mul3(n, dn)));
}

/** Closed blob around a screen point from [angle-radius] pairs (smooth). */
export function blobAround(cx, cy, radii, rotate = 0) {
  const n = radii.length;
  const pts = radii.map((r, i) => {
    const a = (i / n) * TAU + rotate;
    return [cx + Math.cos(a) * r[0], cy + Math.sin(a) * (r[1] ?? r[0])];
  });
  return smoothPath(pts, true);
}

export { TAU, t1, add3, sub3, mul3, dot3, unit3 };
