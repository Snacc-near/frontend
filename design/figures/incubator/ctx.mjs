// Shared context for the incubator world figure: projection, drawing shortcuts, nested-scale levels, bbox tracking.
// Reuses the cell-lab kit (iso-kit / lathe / audit) unchanged.
import * as k from "../cell-lab/kit/iso-kit.mjs";
import * as G from "../cell-lab/kit/lathe.mjs";
import * as A from "../cell-lab/kit/audit.mjs";

export const W = 1600, H = 1000;
export const AZ = 22, EL = 30;

// ---- world (z up; +x toward the viewer = the machine front, +y = viewer's left, -y = viewer's right) ----
export const PLATE = { x: -26, y: -292, w: 240, d: 442, r: 20 };
export const BODY = { x: 0, y: -122, w: 170, d: 244, r: 18 };
export const XF = BODY.x + BODY.w;              // front plane of the machine (x = 170)
export const Z = { foot: 14, belt: 80, win0: 86, win1: 206, top: 212, hood1: 236, hood2: 258 };
export const WIN = { y0: -100, y1: 100, z0: Z.win0, z1: Z.win1, r: 16 };   // window opening in the front plane
export const CAV = { x0: 30, x1: XF };          // cavity depth (back wall x0)
export const MOD = { x: 50, y: -240, w: 104, d: 112, r: 12 };   // enclave module on the right (viewer) side
export const MOD_H = 120;
export const DISH = { cx: 100, cy: -16, r: 54, z: Z.win0 + 6 };   // petri dish centre on the shelf
export const AGAR_Z = DISH.z + 3 + 6;           // agar top surface

const fitPts = [
  ...k.boxCorners(PLATE, -10, 0),
  [60, 0, 262], [XF, 130, 0],
];
export const P = k.fitProjection(fitPts, W, H, { pad: 70, azimuth: AZ, elevation: EL });
P.azimuth = AZ;

export const KPX = k.cameraOf(P).k;            // screen units per world unit
export const at = (p) => k.iso(p, P);
export const S = (paths, style) => k.solidSvg(paths, style);
export const Ln = (d, style) => k.lineSvg(d, style);
export const Dm = (points, style) => k.dotsSvg(points, style);
export const r1 = (n) => Math.round(n * 10) / 10;
export const r2 = (n) => Math.round(n * 100) / 100;
export const pathOf = (pts, closed = false) => k.pathOf(pts, closed);
const rnd3 = (n) => Math.round(n * 1000) / 1000;

/** Matrix mapping local (u, v) on a plane to the screen. */
export function planeM(Pr, o3, e1, e2) {
  const o = k.iso(o3, Pr);
  const a = k.iso([o3[0] + e1[0], o3[1] + e1[1], o3[2] + e1[2]], Pr);
  const b = k.iso([o3[0] + e2[0], o3[1] + e2[1], o3[2] + e2[2]], Pr);
  return `matrix(${rnd3(a[0] - o[0])} ${rnd3(a[1] - o[1])} ${rnd3(b[0] - o[0])} ${rnd3(b[1] - o[1])} ${r2(o[0])} ${r2(o[1])})`;
}
/** Front plane x = x0: u runs to the viewer's right (-y), v runs down. */
export const frontM = (x0, y, z) => planeM(P, [x0, y, z], [0, -1, 0], [0, 0, -1]);
/** Left side plane y = y0 (faces the viewer's left): u runs along +x (toward the viewer), v down. */
export const sideM = (x, y0, z) => planeM(P, [x, y0, z], [1, 0, 0], [0, 0, -1]);

/** Rounded rectangle in plane coordinates (u0..u1, v0..v1), radius r. */
export function rrect(u0, u1, v0, v1, r, n = 6) {
  const pts = [];
  const arc = (cu, cv, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); } };
  arc(u1 - r, v1 - r, 0); arc(u0 + r, v1 - r, Math.PI / 2); arc(u0 + r, v0 + r, Math.PI); arc(u1 - r, v0 + r, Math.PI * 1.5);
  return pts;
}
/** Points on the front plane (x0) from (y, z) pairs. */
export const onFront = (x0, yz, Pr = P) => yz.map(([y, z]) => k.iso([x0, y, z], Pr));
export const onSide = (y0, xz, Pr = P) => xz.map(([x, z]) => k.iso([x, y0, z], Pr));

// ---- nested levels: a smaller thing drawn in the same world units under a magnified projection, shrunk back by a transform ----
export function nest(parentP, anchor3, R) {
  const [ax, ay] = k.iso(anchor3, parentP);
  const Pl = { origin: [0, 0], scale: parentP.scale * R, azimuth: parentP.azimuth, elevation: parentP.elevation };
  return {
    P: Pl, R, anchor: [ax, ay],
    wrap: (svg, extra = "") => `<g class="lv" transform="translate(${r2(ax)} ${r2(ay)}) scale(${rnd3(1 / R)})"${extra}>${svg}</g>`,
    toParent: ([x, y]) => [ax + x / R, ay + y / R],
    at: (p) => k.iso(p, Pl),
  };
}

// ---- bounding boxes of the camera anchors, gathered from the geometry that is drawn (no hand-typed numbers) ----
export const BB = new Map();
export function bbAdd(id, pts) {
  let b = BB.get(id);
  if (!b) { b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; BB.set(id, b); }
  for (const [x, y] of pts) { b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); }
}
/** Screen circle/ellipse extents for a horizontal circle of radius r at centre c3. */
export function bbCircleH(id, c3, r, Pr = P) {
  const [x, y] = k.iso(c3, Pr); const kk = k.cameraOf(Pr).k; const sinE = Math.sin((Pr.elevation * Math.PI) / 180);
  bbAdd(id, [[x - r * kk, y - r * kk * sinE], [x + r * kk, y + r * kk * sinE]]);
}
/** Extents of a sphere. */
export function bbBall(id, c3, r, Pr = P, toParent = (p) => p) {
  const [x, y] = k.iso(c3, Pr); const kk = k.cameraOf(Pr).k;
  bbAdd(id, [toParent([x - r * kk, y - r * kk]), toParent([x + r * kk, y + r * kk])]);
}
export function bbBox3(id, x0, x1, y0, y1, z0, z1, Pr = P, toParent = (p) => p) {
  const pts = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(toParent(k.iso([x, y, z], Pr)));
  bbAdd(id, pts);
}

// ---- audit recorder for the macro assembly ----
export const R = A.recorder(P, { order: [], spring: {} });
export const rec = (shape) => R.solid(shape);
export const slabS = (plan, z, h, name, extra = {}) => A.slab(plan, z, h, { name, ...extra }, 8);
export const cylS = (cx, cy, r, z, h, name, extra = {}) => A.cylinder(cx, cy, r, z, h, { name, ...extra });
/** Record shapes as one drawn item (key set by A.settle from true depth). */
export function item(piece, shapes, at3 = [0, 0, 0]) {
  R.put({ piece, at: at3, svg: "", shapes: shapes.map(rec) });
}

export { k, G, A };
