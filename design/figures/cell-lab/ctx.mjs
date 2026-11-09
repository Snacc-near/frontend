// Shared build context: projection, layer list, drawing shortcuts, face-plane transforms, audit recorder.
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as A from "./kit/audit.mjs";
import * as O from "./organic.mjs";

export const W = 1100, H = 610;

// ---- world layout (z up; screen right = x-y, toward viewer = x+y) ----
export const PLATE = { x: -176, y: -112, w: 362, d: 196, r: 16 };
export const PLATE_H = 12;
export const CELLC = [-96, -36];            // chamber centre on the plate (x, y)
export const STAGE_Z = 6;                     // top of the chamber stage collar
export const GLASS_R = 66;
export const CELL_R = [56, 60];               // cell radii: horizontal, vertical
export const CELL_Z = STAGE_Z + 12 + CELL_R[1] - 6; // cell centre height
export const DOME_C_TOP = 94;                 // glass cylinder part ends
export const DOME_CAP = 58;                   // dome cap height
export const DOME_TOP = DOME_C_TOP + DOME_CAP;
export const MITO_C = [62, -8];               // hero mitochondrion centre on the stage plate
export const MITO_Z = 3;                      // floor of the hero stage

const pts = [
  ...k.boxCorners(PLATE, -PLATE_H, 0),
  [CELLC[0], CELLC[1], DOME_TOP + 10],
  [150, -73, 72],
  [70, 10, 60],
];
export const P = k.fitProjection(pts, W, H, { pad: 14, azimuth: 45, elevation: 30 });
P.azimuth = 45;

export const at = (pt) => k.iso(pt, P);
export const S = (paths, style) => k.solidSvg(paths, style);
export const Ln = (d, style) => k.lineSvg(d, style);
export const Dm = (points, style) => k.dotsSvg(points, style);
export const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
export const px = (pt3) => at(pt3).map(f1).join(" ");
export const dep = (x, y, z = 0) => k.depthOf([x, y, z], P);

// ---- layers: painter's order by key (ascending = far first) ----
export const layers = [];
export const emit = (key, svg, name = "") => layers.push({ key, svg, name });

// ---- audit recorder (solids and tubes we can state exactly) ----
export const R = A.recorder(P, { order: [], spring: {} });
export const rec = (shape) => R.solid(shape);
export const put = (piece, shapes, at3, bias = 0) => R.put({ piece, at: at3, bias, svg: "", shapes: shapes.map(rec) });
// every helper that draws a solid also notes its true shape; flushItem() puts the noted shapes into a recorder as one drawn item
// (rig + stage items go to R; the cut-open mitochondrion's items go to HR, because they sort among themselves inside one layer)
export const HR = A.recorder(P, { order: [], spring: {} });
const noted = [];
export const noteShape = (s) => { noted.push(s); return s; };
export const flushItem = (rec, key, piece, ride = piece) => { const shapes = noted.splice(0).map((s) => rec.solid(s)); if (shapes.length) rec.put({ piece, ride, key, at: [0, 0, 0], bias: 0, svg: "", shapes }); };
export const slabS = (plan, z, h, name, extra = {}) => A.slab(plan, z, h, { name, ...extra }, 8);
export const cylS = (cx, cy, r, z, h, name, extra = {}) => A.cylinder(cx, cy, r, z, h, { name, ...extra });

/** Matrix mapping local (u, v) on a plane to the screen: origin o3, axes e1, e2 (world unit vectors, units of 1). */
export function planeMatrix(o3, e1, e2) {
  const o = at(o3);
  const a = at([o3[0] + e1[0], o3[1] + e1[1], o3[2] + e1[2]]);
  const b = at([o3[0] + e2[0], o3[1] + e2[1], o3[2] + e2[2]]);
  return `matrix(${f1((a[0] - o[0]) * 1000 / 1000)} ${f1(a[1] - o[1])} ${f1(b[0] - o[0])} ${f1(b[1] - o[1])} ${f1(o[0])} ${f1(o[1])})`;
}
// finer-precision matrix (kit rounds to .1 which is too coarse for unit vectors)
export function planeM(o3, e1, e2) {
  const o = at(o3);
  const a = at([o3[0] + e1[0], o3[1] + e1[1], o3[2] + e1[2]]);
  const b = at([o3[0] + e2[0], o3[1] + e2[1], o3[2] + e2[2]]);
  const r = (n) => (Math.round(n * 1000) / 1000).toString();
  return `matrix(${r(a[0] - o[0])} ${r(a[1] - o[1])} ${r(b[0] - o[0])} ${r(b[1] - o[1])} ${r(o[0])} ${r(o[1])})`;
}
/** Floor plane (u = +x, v = +y) at height z. */
export const floorM = (x, y, z) => planeM([x, y, z], [1, 0, 0], [0, 1, 0]);
/** Plane facing the viewer through (x,y,z): u = screen right, v = down (negative z). */
export const faceM = (x, y, z) => planeM([x, y, z], [Math.SQRT1_2, -Math.SQRT1_2, 0], [0, 0, -1]);
/** Vertical plane normal to +x direction... facing right-front: u = +y axis; v = down. */
export const wallXM = (x, y, z) => planeM([x, y, z], [0, 1, 0], [0, 0, -1]);
/** Vertical plane facing left-front (normal +y): u = +x; v down. */
export const wallYM = (x, y, z) => planeM([x, y, z], [1, 0, 0], [0, 0, -1]);

export { k, G, A, O };
