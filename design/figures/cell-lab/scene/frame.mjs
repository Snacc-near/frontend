// Local frame of the hero mitochondrion (u along its length = screen right, v toward the viewer) + wall helpers.
// Used by both the build and (serialised constants) the live page.
import { k, G, P, S, at, f1, O } from "../ctx.mjs";

export const MC = [70, 10];        // hero centre on the plate
export const FLOOR = 7;             // matrix floor height
export const s2 = Math.SQRT1_2;
export const W3 = (u, v, z) => [MC[0] + (u + v) * s2, MC[1] + (v - u) * s2, z];
export const Wxy = (u, v) => [MC[0] + (u + v) * s2, MC[1] + (v - u) * s2];
export const Uvec = [s2, -s2, 0];
export const Vvec = [s2, s2, 0];
export const depthKey = (v, z = 0) => v * 1.0 + z * 0.01;

/** Rounded rect in local coordinates -> world polygon ring (CCW). */
export function rrLocal(u0, v0, w, d, r = 0.8, steps = 3) {
  r = Math.max(0, Math.min(r, w / 2, d / 2));
  const pts = [];
  const corners = [[u0 + w - r, v0 + r, -90], [u0 + w - r, v0 + d - r, 0], [u0 + r, v0 + d - r, 90], [u0 + r, v0 + r, 180]];
  for (const [cu, cv, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = ((a0 + (90 * i) / steps) * Math.PI) / 180;
      pts.push(Wxy(cu + Math.cos(a) * r, cv + Math.sin(a) * r));
    }
  }
  return pts;
}
export function circLocal(u, v, r, n = 20) {
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return Wxy(u + Math.cos(a) * r, v + Math.sin(a) * r); });
}

/** Extruded local box as a solid string. */
export function boxL(u0, v0, w, d, z, h, { r = 0.8, bevel = 0.35, tone = "hi", className = "", crease = "faint", inner = "" } = {}) {
  return S(k.extrude(rrLocal(u0, v0, w, d, r), z, h, P, { bevel }), { tone, className, crease, inner });
}
export const cylW = (u, v, rad, z, h, { steps = 28, bevel = 0.3, tone = "hi", className = "", crease = "faint" } = {}) => {
  const [x, y] = Wxy(u, v);
  return S(k.cylinder(x, y, rad, z, h, P, steps, bevel), { tone, className, crease });
};

/** Kidney (bean) outline in local (u, v): dent on the back side (v < 0). */
export function beanLocal(Lh, Wh, n = 72, dent = 0.2) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const u = Math.cos(a) * Lh;
    let v = Math.sin(a) * Wh;
    if (v < 0) v *= 1 - dent * Math.cos((u / Lh) * (Math.PI / 2)) ** 2;
    out.push([u, v]);
  }
  return out;
}
export const toWorldRing = (loc) => loc.map(([u, v]) => Wxy(u, v));

const toViewer = () => k.towardViewer(P);
/** Quads of a wall (closed local ring) between z0 and z1. mode "outer": faces whose outward normal faces the viewer;
 *  "inner": inner faces seen from inside (outward normal faces away). pred(u,v) filters edges by midpoint. */
export function wallQuads(loc, z0, z1, { mode = "outer", pred = () => true, tint = "" } = {}) {
  const [vx, vy] = toViewer();
  const L = G.lightOf(P);
  const n = loc.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = loc[i], b = loc[(i + 1) % n];
    const mu = (a[0] + b[0]) / 2, mv = (a[1] + b[1]) / 2;
    if (!pred(mu, mv)) continue;
    const du = b[0] - a[0], dv = b[1] - a[1];
    const len = Math.hypot(du, dv) || 1;
    // outward local normal for CCW ring: (dv, -du)/len -> world
    const nl = [dv / len, -du / len];
    const nw = [(nl[0] + nl[1]) * s2, (nl[1] - nl[0]) * s2];
    const face = nw[0] * vx + nw[1] * vy;
    const visible = mode === "outer" ? face > 1e-6 : face < -1e-6;
    if (!visible) continue;
    const sign = mode === "outer" ? 1 : -1;
    const normal = [nw[0] * sign, nw[1] * sign, 0];
    const tone = Math.min(3, G.toneOf(normal, P));
    const pa = Wxy(a[0], a[1]), pb = Wxy(b[0], b[1]);
    const q = [at([pa[0], pa[1], z1]), at([pb[0], pb[1], z1]), at([pb[0], pb[1], z0]), at([pa[0], pa[1], z0])];
    out.push({ d: O.pathOf(q, true), tone, key: (pa[0] + pa[1] + pb[0] + pb[1]) });
  }
  return out;
}
export const quadSvg = (qs, tint = "") => qs.map((q) => `<path class="iso-shade" data-shade="${q.tone}" d="${q.d}" style="stroke-width:.5px;stroke:var(--anatomy-shade-${q.tone});${tint}"/>`).join("");
/** Polyline of the ring at height z for edges passing pred (screen path). */
export function ringPath(loc, z, pred = () => true, closed = true) {
  const pts = [];
  for (const [u, v] of loc) pts.push(at(W3(u, v, z)));
  return O.pathOf(pts, closed);
}
export function ringPts(loc, z) { return loc.map(([u, v]) => at(W3(u, v, z))); }
