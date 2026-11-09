// Cell Lab — anatomy-hero bio-reactor rig (framework-free build).
// Plain theme (warm cream/tan, dark ink, marigold accent) per owner reference set.
// MIT: anatomy skill by April Zhu. No external requests.
// Outputs ../../../../public/figures/cell-lab.html
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { tubePieces, tubeSvg } from "./kit/tube.mjs";
import * as A from "./kit/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const kitSrc = readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8");
const kitScript = () => kitSrc.replace(/^export /gm, "");

const W = 880, H = 520;
const PLATE = { x: -155, y: -78, w: 310, d: 156, r: 10 };
const PLATE_H = 9, FOOT_H = 6;
const CHAM = { x: -148, y: -56, w: 176, d: 112, r: 8 };
const LINE = { x: 36, y: -56, w: 126, d: 112, r: 8 };
const CX = -60, CY = 0;
const CELL = { x: -96, y: -32, w: 72, d: 64, r: 28 };
const CELL_Z = 14, CELL_H = 9;
const CELL_TOP = CELL_Z + CELL_H; // 23
const GLASS_R = 42, GLASS_Z0 = 14, GLASS_Z1 = 74;
const DIAL = [100, -34], DIAL_R = 19, DIAL_Z = 10, DIAL_H = 9, DIAL_TOP = DIAL_Z + DIAL_H;
const Z = CELL_TOP; // organelle bedding flush on membrane top

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CX, CY, GLASS_Z1 + 4], [DIAL[0] + DIAL_R, DIAL[1], DIAL_TOP]],
  W, H, { pad: 8, azimuth: 45, elevation: 30 }
);
const at = (pt) => k.iso(pt, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dm = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

const R = A.recorder(P, { order: [], spring: {} });
const rec = (shape) => R.solid(shape);
const put = (piece, shapes, at3, bias = 0) => R.put({ piece, at: at3, bias, svg: "", shapes: shapes.map(rec) });
const slabS = (plan, z, h, name, extra = {}) => A.slab(plan, z, h, { name, ...extra }, 8);
const cylS = (cx, cy, r, z, h, name, extra = {}) => A.cylinder(cx, cy, r, z, h, { name, ...extra });

const layers = [];
const add = (svg, key) => layers.push({ key, svg });
// Painter tiers: higher z wins within a screen column, so every stack draws bottom-up.
const T = { plate: 0, pedestal: 5, base: 8, line: 10, org: 20, glass: 25, clamp: 26, dial: 30, tube: 35, token: 90 };

/* ---------- base plate ---------- */
{
  const p = [];
  p.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    p.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "hi" }));
    p.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  p.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  p.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  p.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  p.push(Dm(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5, tone: "hi" }));
  const strip = { x: -118, y: PLATE.y + PLATE.d - 16, w: 236, d: 7, r: 1 };
  p.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y, 0.7, [1.6, 3.0], P);
  p.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  p.push(Dm([at([strip.x + 2, strip.y + 3.5, 0.7]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.7])], { size: 0.45 }));
  const labelPlan = { x: -136, y: PLATE.y + PLATE.d - 30, w: 56, d: 10, r: 1.5 };
  p.push(S(k.slabOf(labelPlan, 0, 0.9, P, 4), { tone: "mid" }));
  p.push(L(k.planOutline(k.insetPlan(labelPlan, 1.6), 0.9, P), { tone: "faint" }));
  p.push(L([0, 1, 2].map((row) => k.lineOnTop([labelPlan.x + 8, labelPlan.y + 3.2 + row * 2.1], [labelPlan.x + (row === 1 ? 30 : 40), labelPlan.y + 3.2 + row * 2.1], 0.9, P)).join(""), { tone: "lo", free: true }));
  p.push(Dm([at([labelPlan.x + 3.5, labelPlan.y + 5, 0.9]), at([labelPlan.x + labelPlan.w - 3.5, labelPlan.y + 5, 0.9])], { size: 0.45 }));
  add(p.join(""), T.plate);
  put("base.plate", [slabS(PLATE, -PLATE_H, PLATE_H, "base.plate", { ground: true })], [0, 0, 0], -5);
}

/* ---------- pedestals ---------- */
for (const [plan, name] of [[CHAM, "pedestal.chamber"], [LINE, "pedestal.line"]]) {
  const d = k.depthOf([plan.x + plan.w / 2, plan.y + plan.d / 2, 0], P);
  add([
    S(k.slabOf(plan, 0, 5, P, 6, 1.2), { tone: "mid" }),
    L(k.planOutline(k.insetPlan(plan, 4), 5, P, 6), { tone: "faint" }),
    L(k.sideSeam(plan, 2.5, P, 6), { tone: "faint" }),
    Dm(k.corners(plan, 9).map(([x, y]) => at([x, y, 5])), { size: 0.45 }),
  ].join(""), T.pedestal);
  put(name, [slabS(plan, 0, 5, name)], [plan.x + plan.w / 2, plan.y + plan.d / 2, 2.5], -2);
}

/* ---------- chamber collar + glass ---------- */
{
  const d = k.depthOf([CX, CY, 9], P);
  add([
    S(k.cylinder(CX, CY, 42, 5, 9, P, 56, 0.8), { tone: "mid" }),
    L(k.sideArc(CX, CY, 42, 9.5, P, 40), { tone: "faint" }),
    Dm(Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return at([CX + 38 * Math.cos(a), CY + 38 * Math.sin(a), 14]);
    }), { size: 0.45 }),
    L(k.ring(CX, CY, 36, 14, P, 56), { tone: "lo" }),
  ].join(""), T.base);
  put("chamber.collar", [cylS(CX, CY, 42, 5, 9, "chamber.collar")], [CX, CY, 9], -1);
  // glass as lines: uprights land on collar edge (r 42) and top ring (r 42)
  add([
    L(k.ring(CX, CY, GLASS_R, GLASS_Z1, P, 56), { tone: "hi" }),
    L(k.ring(CX, CY, GLASS_R, GLASS_Z0, P, 56), { tone: "hi" }),
    k.fadeLineSvg(Array.from({ length: 20 }, (_, i) => { const rad = (-45 + (i / 19) * 180) * Math.PI / 180; return at([CX + GLASS_R * Math.cos(rad), CY + GLASS_R * Math.sin(rad), 50]); }), { fade: [10, 10], tone: "faint" }),
    L(k.segment([CX - GLASS_R, CY, GLASS_Z0], [CX - GLASS_R, CY, GLASS_Z1], P), { tone: "hi" }),
    L(k.segment([CX + GLASS_R, CY, GLASS_Z0], [CX + GLASS_R, CY, GLASS_Z1], P), { tone: "hi" }),
  ].join(""), d + 30);
  // 4 clamp blocks + thumb screws
  const clamps = [];
  for (const a of [45, 135, 225, 315]) {
    const rad = (a * Math.PI) / 180;
    const gx = CX + 42 * Math.cos(rad), gy = CY + 42 * Math.sin(rad);
    clamps.push(S(k.slabOf({ x: gx - 5, y: gy - 5, w: 10, d: 10, r: 2 }, 8, 8, P, 4, 0.6), { tone: "mid" }));
    clamps.push(S(k.cylinder(gx, gy + 7, 2.6, 8, 6, P, 20), { tone: "mid" }));
    clamps.push(L(k.knurl(gx, gy + 7, 2.6, 8, 14, 18, P, 0), { tone: "lo" }));
  }
  add(clamps.join(""), T.clamp);
}

/* ---------- cell membrane + cytoplasm ---------- */
{
  const d = k.depthOf([CX, CY, 16], P);
  const cell = [S(k.slabOf(CELL, CELL_Z, CELL_H, P, 10, 1.2), { tone: "hi", crease: "lo" })];
  cell.push(S(k.slabOf(k.insetPlan(CELL, 6), CELL_Z + 0.6, CELL_H - 1.2, P, 10, 0.8), { tone: "hi", className: "cyto" }));
  cell.push(L(k.planOutline(k.insetPlan(CELL, 4), CELL_TOP, P, 10), { tone: "lo" }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const mx = CX + 32 * Math.cos(a), my = CY + 29 * Math.sin(a);
    cell.push(S(k.slabOf({ x: mx - 2.2, y: my - 2.2, w: 4.4, d: 4.4, r: 1 }, CELL_Z + 1, CELL_H - 2, P, 2), { tone: "mid", crease: "none" }));
    cell.push(Dm([at([mx, my, CELL_TOP])], { size: 0.4, tone: "hi" }));
  }
  add(cell.join(""), T.base);
  put("cell.membrane", [slabS(CELL, CELL_Z, CELL_H, "cell.membrane")], [CX, CY, 16], -1);
}
const lobeB = `<g data-part="cell-lobe-b" opacity="0">${S(k.slabOf({ x: -96, y: -18, w: 72, d: 32, r: 14 }, CELL_Z, CELL_H, P, 10, 1), { tone: "hi" })}</g>`;

/* ---------- organelles on membrane top (cutaway) ---------- */
const MITO = { x: -62, y: 2, w: 28, d: 17, r: 8 }; // x -62..-34 inside cell (-96..-24)
{
  const o = [];
  // nucleus
  o.push(S(k.cylinder(-78, 2, 13, Z, 7, P, 40, 0.8), { tone: "hi", crease: "lo", className: "nucleus-body" }));
  o.push(L(k.ring(-78, 2, 9.5, Z + 7, P, 36), { tone: "faint" }));
  o.push(L(k.ring(-78, 2, 5, Z + 7, P, 28), { tone: "faint" }));
  o.push(Dm(Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return at([-78 + 11.5 * Math.cos(a), 2 + 11.5 * Math.sin(a), Z + 7]);
  }), { size: 0.55, tone: "hi" }));
  o.push(Dm([[-84, 4], [-74, 0], [-80, -4], [-72, 6], [-86, -2]].map(([x, y]) => at([x, y, Z + 7])), { size: 0.5, tone: "lo" }));
  o.push(Dm([at([-78, 2, Z + 7.4])], { size: 1.2, tone: "hi" }));
  // rough ER + ribosomes
  for (const [ex, ey, er] of [[-90, 16, 7], [-90, -8, 6], [-88, 26, 5.5]]) {
    o.push(S(k.cylinder(ex, ey, er, Z, 4.5, P, 28, 0.5), { tone: "mid" }));
  }
  o.push(Dm([[-92, 14], [-90, 18], [-92, 22], [-88, 26], [-93, -10], [-91, -6], [-89, 18], [-90, 19]].map(([x, y]) => at([x, y, Z + 3.2])), { size: 0.4, tone: "hi" }));
  o.push(Dm([[-66, 18], [-52, 22], [-62, -24], [-46, -20], [-56, 10], [-42, 4]].map(([x, y]) => at([x, y, Z + 0.8])), { size: 0.5, tone: "mid" }));
  // Golgi stack (inside cell x -96..-24)
  for (let i = 0; i < 3; i++) {
    o.push(S(k.cylinder(-44 - i, -16, 8 - i, Z + i * 2.4, 2.2, P, 28, 0.4), { tone: "mid" }));
  }
  o.push(Dm([[-48, -18], [-44, -15], [-46, -12]].map(([x, y]) => at([x, y, Z + 6.6])), { size: 0.45, tone: "hi" }));
  // lysosomes
  for (const [lx, ly] of [[-58, 24], [-60, -26], [-44, 22]]) {
    o.push(S(k.cylinder(lx, ly, 4.5, Z, 5.5, P, 24, 0.5), { tone: "mid", className: "lyso" }));
  }
  // vacuole
  o.push(S(k.cylinder(-49, -25, 7, Z, 4, P, 28, 0.5), { tone: "hi" }));
  // centrosome + microtubules (edge to edge on top face)
  o.push(S(k.cylinder(-66, 6, 2.8, Z, 4, P, 16), { tone: "mid" }));
  o.push(Dm([[-72, 6], [-60, 6], [-66, 0], [-66, 12]].map(([x, y]) => at([x, y, Z + 4])), { size: 0.5, tone: "faint" }));
  // HERO mitochondrion
  o.push(S(k.slabOf(MITO, Z, 11, P, 8, 0.8), { tone: "hi", crease: "lo", className: "mito-body" }));
  for (let i = 0; i < 3; i++) {
    o.push(S(k.slabOf({ x: MITO.x + 3 + i * 7, y: MITO.y + 3, w: 3.5, d: 11, r: 1.2 }, Z + 8, 2.6, P, 2, 0.3), { tone: "mid", crease: "none" }));
  }
  for (let i = 0; i < 3; i++) {
    o.push(L(k.planOutline({ x: MITO.x + 3 + i * 7, y: MITO.y + 3, w: 4, d: 11, r: 1.5 }, Z + 7, P, 2), { tone: "lo" }));
  }
  o.push(L(k.planOutline(k.insetPlan(MITO, 2.5), Z + 11, P, 8), { tone: "faint" }));
  for (const [sx, sy] of [[-88, -20], [-48, 26], [-88, 26]]) {
    o.push(S(k.cylinder(sx, sy, 4, Z, 4.5, P, 24, 0.5), { tone: "mid", className: "mito-sat" }));
  }
  o.push(`<path class="mito-halo" data-part="mito-glow" opacity="0" d="${k.haloOf(MITO, Z, 7, P)}"/>`);
  o.push(`<g data-part="spindle" opacity="0">${L(
    [[-84, -14], [-84, 18], [-72, -14], [-72, 18], [-78, -14], [-78, 18]].map(([x, y]) => k.lineOnTop([x, y], [-78, 2], Z + 5, P)).join(""), { tone: "lo" })}</g>`);
  o.push(`<g data-part="chromosomes" opacity="0">${[[-88, -8], [-84, 4], [-80, -8], [-76, 4], [-72, -8]].map(([x, y]) => L(k.planOutline({ x, y, w: 3, d: 3, r: 1.5 }, Z + 7, P, 2), { tone: "red" })).join("")}</g>`);
  o.push(`<g data-part="lysis-cracks" opacity="0">${[[0.4, -20], [-8, 18], [10, 24]].map(([cx, cy]) => L(k.planOutline({ x: -60 + cx - 4, y: cy - 1.5, w: 8.5, d: 3, r: 1.5 }, CELL_TOP + 0.4, P, 2), { tone: "red" })).join("")}</g>`);
  o.push(`<g data-part="mrna" opacity="0">${L(k.onTop([[-65, 2], [-60, 8], [-54, 12], [-50, 16]], Z + 8, P), { tone: "lo", flow: true })}</g>`);
  add(o.join(""), T.org);
  put("cell.nucleus", [cylS(-78, 2, 13, Z, 7, "cell.nucleus")], [-78, 2, Z + 3], 0);
  put("cell.mito", [slabS(MITO, Z, 11, "cell.mito")], [-48, 10, Z + 3], 0);
}

/* ---------- side dock (splice port) ---------- */
{
  const dock = [
    S(k.slabOf({ x: -146, y: -54, w: 18, d: 24, r: 3 }, 5, 6, P, 4, 0.6), { tone: "mid" }),
    S(k.cylinder(-137, -42, 4, 11, 8, P, 20), { tone: "mid" }),
    S(k.slabOf({ x: -143, y: -48, w: 15, d: 12, r: 5 }, 11, 8, P, 6, 0.8), { tone: "hi", crease: "lo", className: "dock-cell" }),
    Dm([at([-137, -42, 19])], { size: 0.5 }),
  ].join("");
  add(dock, T.pedestal);
  put("dock", [slabS({ x: -146, y: -54, w: 18, d: 24, r: 3 }, 5, 6, "dock.base")], [-137, -42, 8], 0);
}

/* ---------- gantry + ATP manifold tube ---------- */
const GANTRY_TOP = 58;
{
  const d = k.depthOf([0, -10, GANTRY_TOP], P) + 5;
  add([
    S(k.slabOf({ x: 28, y: -4, w: 5, d: 8, r: 1 }, 0, GANTRY_TOP, P, 3, 0.4), { tone: "mid" }),
    S(k.slabOf({ x: 28, y: -7, w: 70, d: 5, r: 1.5 }, GANTRY_TOP, 4, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam({ x: 28, y: -7, w: 70, d: 5, r: 1.5 }, GANTRY_TOP + 2, P, 3), { tone: "faint" }) }),
    Dm([at([30.5, 0, GANTRY_TOP + 4])], { size: 0.45 }),
  ].join(""), T.glass);
  put("gantry", [slabS({ x: 28, y: -4, w: 5, d: 8, r: 1 }, 0, GANTRY_TOP, "gantry.post"), slabS({ x: 28, y: -7, w: 70, d: 5, r: 1.5 }, GANTRY_TOP, 4, "gantry.beam")], [0, 0, 30], 0);
}
const MITO_TOP = Z + 11; // 34
const atpRoute = G.fillet(
  [[-48, 10, MITO_TOP], [-48, 10, 80], [55, -16, 80], [DIAL[0], DIAL[1], 80], [DIAL[0], DIAL[1], DIAL_TOP]],
  6, 7, { P, tube: 1.8 }
);
add(tubePieces(atpRoute, 1.8, P, { maxLength: 22 }).map((p) => tubeSvg(p, { tone: "mid" })).join(""), T.tube);
R.route("atp.manifold", atpRoute, 1.8, { piece: "atp.manifold" });
const feedRoute = G.fillet([[45, -30, 22], [45, -30, 30], [12, -20, 26], [-21, -8, 22], [-21, -8, 14]], 4, 7, { P, tube: 1.6 });
add(tubePieces(feedRoute, 1.6, P, { maxLength: 20 }).map((p) => tubeSvg(p, { tone: "mid" })).join(""), T.tube);
R.route("feed.chute", feedRoute, 1.6, { piece: "feed.chute" });

/* ---------- production line stations ---------- */
const line = [];
const lineShapes = [];
const linePlan = (plan, z, h, name) => lineShapes.push(A.slab(plan, z, h, { name }, 6));
const lineCyl = (cx, cy, r, z, h, name) => lineShapes.push(A.cylinder(cx, cy, r, z, h, { name }));
line.push(S(k.slabOf({ x: 40, y: 16, w: 114, d: 4, r: 1 }, 5, 3, P, 3, 0.4), { tone: "mid" }));
line.push(S(k.slabOf({ x: 40, y: 30, w: 114, d: 4, r: 1 }, 5, 3, P, 3, 0.4), { tone: "mid" }));
linePlan({ x: 40, y: 16, w: 114, d: 4, r: 2 }, 5, 3, "line.railA");
linePlan({ x: 40, y: 30, w: 114, d: 4, r: 2 }, 5, 3, "line.railB");
for (let i = 0; i < 6; i++) {
  line.push(S(k.cylinder(46 + i * 19, 25, 3, 5, 3, P, 16), { tone: "lo" }));
  lineCyl(46 + i * 19, 25, 3, 5, 3, "line.roller");
}
// hopper (start chute on lid top 22)
line.push(S(k.slabOf({ x: 36, y: -42, w: 18, d: 24, r: 2 }, 5, 14, P, 4, 0.6), { tone: "mid" }));
line.push(S(k.slabOf({ x: 34, y: -44, w: 22, d: 28, r: 2 }, 19, 3, P, 4, 0.6), { tone: "mid" }));
line.push(S(k.cylinder(45, -30, 4, 5, 6, P, 20), { tone: "lo" }));
linePlan({ x: 36, y: -42, w: 18, d: 24, r: 2 }, 5, 14, "line.hopper");
linePlan({ x: 34, y: -44, w: 22, d: 28, r: 2 }, 19, 3, "line.hopperLid");
// extractor
line.push(S(k.slabOf({ x: 73, y: -10, w: 12, d: 10, r: 1.5 }, 5, 30, P, 4, 0.5), { tone: "mid" }));
line.push(S(k.slabOf({ x: 69, y: -10, w: 20, d: 10, r: 1.5 }, 35, 4, P, 4, 0.5), { tone: "mid" }));
line.push(S(k.cylinder(79, -5, 2.2, 20, 15, P, 16), { tone: "hi" }));
line.push(S(k.slabOf({ x: 73, y: -26, w: 12, d: 8, r: 1.5 }, 5, 5, P, 4, 0.5), { tone: "hi" }));
linePlan({ x: 73, y: -10, w: 12, d: 10, r: 1.5 }, 5, 30, "line.extractorPost");
linePlan({ x: 73, y: -26, w: 12, d: 8, r: 1.5 }, 5, 5, "line.extractorBin");
// press (head flush between posts, top touches beam)
line.push(S(k.slabOf({ x: 95, y: -12, w: 4, d: 14, r: 1 }, 5, 27, P, 2, 0.4), { tone: "mid" }));
line.push(S(k.slabOf({ x: 109, y: -12, w: 4, d: 14, r: 1 }, 5, 27, P, 2, 0.4), { tone: "mid" }));
line.push(S(k.slabOf({ x: 93, y: -12, w: 22, d: 14, r: 1.5 }, 32, 5, P, 4, 0.5), { tone: "mid" }));
line.push(`<g data-part="press-head">${S(k.slabOf({ x: 100, y: -9, w: 9, d: 8, r: 1.5 }, 22, 10, P, 4, 0.5), { tone: "hi" })}</g>`);
linePlan({ x: 95, y: -12, w: 4, d: 14, r: 1 }, 5, 27, "line.pressPostL");
linePlan({ x: 109, y: -12, w: 4, d: 14, r: 1 }, 5, 27, "line.pressPostR");
linePlan({ x: 93, y: -12, w: 22, d: 14, r: 1.5 }, 32, 5, "line.pressBeam");
linePlan({ x: 100, y: -9, w: 9, d: 8, r: 1.5 }, 22, 10, "line.pressHead");
// synthesizer
line.push(S(k.slabOf({ x: 120, y: -12, w: 18, d: 14, r: 1.5 }, 5, 8, P, 4, 0.5), { tone: "mid" }));
line.push(S(k.cylinder(129, -5, 5, 13, 12, P, 20), { tone: "hi", className: "vial-glass" }));
line.push(`<g data-part="vial-fill">${S(k.cylinder(129, -5, 3.4, 13, 8, P, 16), { tone: "mid", className: "vial-fill" })}</g>`);
line.push(S(k.cylinder(129, -5, 2.2, 25, 3, P, 16), { tone: "mid", className: "vial-cap" }));
line.push(S(k.cylinder(129, -5, 1.4, 28, 8, P, 12), { tone: "mid" }));
linePlan({ x: 120, y: -12, w: 18, d: 14, r: 1.5 }, 5, 8, "line.synthRack");
lineCyl(129, -5, 5, 13, 12, "line.vial");
// crate
line.push(S(k.slabOf({ x: 140, y: -4, w: 18, d: 16, r: 1.5 }, 5, 2, P, 4, 0.5), { tone: "mid" }));
line.push(S(k.slabOf({ x: 140, y: -4, w: 2, d: 16, r: 0.8 }, 7, 6, P, 2, 0.3), { tone: "mid" }));
line.push(S(k.slabOf({ x: 156, y: -4, w: 2, d: 16, r: 0.8 }, 7, 6, P, 2, 0.3), { tone: "mid" }));
line.push(S(k.slabOf({ x: 140, y: -4, w: 18, d: 2, r: 0.8 }, 7, 6, P, 2, 0.3), { tone: "mid" }));
line.push(S(k.slabOf({ x: 140, y: 10, w: 18, d: 2, r: 0.8 }, 7, 6, P, 2, 0.3), { tone: "mid" }));
linePlan({ x: 140, y: -4, w: 18, d: 16, r: 1.5 }, 5, 2, "line.crateFloor");
// lamp post
line.push(S(k.cylinder(124, -40, 2.6, 5, 22, P, 16), { tone: "mid" }));
line.push(`<g data-part="status-lamp">${S(k.cylinder(124, -40, 4, 27, 5, P, 20), { tone: "hi", className: "lamp" })}</g>`);
lineCyl(124, -40, 2.6, 5, 22, "line.lampPost");
lineCyl(124, -40, 4, 27, 5, "line.statusLamp");
line.push(`<g data-sign="feed">${S(k.slabOf({ x: 38, y: -33, w: 10, d: 6, r: 1 }, 22, 0.9, P, 3, 0.3), { tone: "mid", className: "station-sign" })}</g>`);
line.push(`<g data-sign="extract">${S(k.slabOf({ x: 74, y: -8, w: 10, d: 6, r: 1 }, 39, 0.9, P, 3, 0.3), { tone: "mid", className: "station-sign" })}</g>`);
line.push(`<g data-sign="transmute">${S(k.slabOf({ x: 99, y: -8, w: 10, d: 6, r: 1 }, 37, 0.9, P, 3, 0.3), { tone: "mid", className: "station-sign" })}</g>`);
line.push(`<g data-sign="synthesize">${S(k.slabOf({ x: 131, y: -10, w: 6, d: 4, r: 1 }, 13.9, 0.9, P, 3, 0.3), { tone: "mid", className: "station-sign" })}</g>`);
add(line.join(""), T.line);
for (const sh of lineShapes) rec(sh);

/* ---------- ATP dial gauge ---------- */
{
  const dial = [];
  dial.push(S(k.slabOf({ x: DIAL[0] - 12, y: DIAL[1] - 12, w: 24, d: 24, r: 3 }, 5, DIAL_Z - 5, P, 4, 0.6), { tone: "mid" }));
  dial.push(S(k.cylinder(DIAL[0], DIAL[1], DIAL_R, DIAL_Z, DIAL_H, P, 56, 0.8), { tone: "hi", crease: "lo" }));
  dial.push(L(k.knurl(DIAL[0], DIAL[1], DIAL_R, DIAL_TOP - 3.4, DIAL_TOP, 56, P, 0), { tone: "lo" }));
  dial.push(L(k.sideArc(DIAL[0], DIAL[1], DIAL_R, DIAL_TOP - 3.4, P, 40), { tone: "faint" }));
  dial.push(L(k.ring(DIAL[0], DIAL[1], DIAL_R - 2.2, DIAL_TOP, P, 56), { tone: "lo" }));
  const t = k.radialTicks(DIAL[0], DIAL[1], DIAL_R - 2.2, 40, 5, DIAL_TOP, [1.0, 1.9], P);
  dial.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  dial.push(L(k.ring(DIAL[0], DIAL[1], 1.6, DIAL_TOP, P, 16), { tone: "mid" }));
  dial.push(k.faceTextSvg(k.topMatrix([DIAL[0], DIAL[1] + 5.5], DIAL_TOP, P, "x"), "ATP", { size: 2.6, tone: "lo", anchor: "middle" }));
  const needleAt = (turn) => {
    const a = turn * Math.PI * 2;
    return k.lineOnTop(
      [DIAL[0] - Math.sin(a) * 3.2, DIAL[1] + Math.cos(a) * 3.2],
      [DIAL[0] + Math.sin(a) * (DIAL_R - 2.4), DIAL[1] - Math.cos(a) * (DIAL_R - 2.4)],
      DIAL_TOP + 0.2, P, false
    );
  };
  dial.push(`<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0.25)}" style="stroke-width:1.2"/>`);
  dial.push(Dm([at([DIAL[0], DIAL[1], DIAL_TOP])], { size: 0.5, tone: "hi" }));
  dial.push(S(k.slabOf({ x: DIAL[0] + DIAL_R - 1, y: DIAL[1] - 2.4, w: 5, d: 4.8, r: 1.2 }, DIAL_Z + 2, 5, P, 3), { tone: "mid" }));
  add(dial.join(""), T.dial);
  put("dial.atp", [cylS(DIAL[0], DIAL[1], DIAL_R, DIAL_Z, DIAL_H, "dial.atp"), slabS({ x: DIAL[0] - 12, y: DIAL[1] - 12, w: 24, d: 24, r: 3 }, 5, DIAL_Z - 5, "dial.stand")], [DIAL[0], DIAL[1], DIAL_TOP], 0);
}

/* ---------- zone indicators ---------- */
{
  const d = k.depthOf([CX, CY, GLASS_Z1], P) + 35;
  add([
    Dm([[-95, 20], [-90, 22], [-85, 20], [-80, 22]].map(([x, y]) => at([x, y, 16])), { size: 0.5, tone: "faint" }),
    `<g data-part="heat-haze" opacity="0">${[-20, 0, 20].map((dx) => k.fadeLineSvg([at([CX + dx, CY, GLASS_Z1 + 2]), at([CX + dx + 3, CY, GLASS_Z1 + 8]), at([CX + dx, CY, GLASS_Z1 + 14])], { fade: [6, 8], tone: "mid" })).join("")}</g>`,
  ].join(""), d);
}

const tokens = `<g data-part="tokens" style="pointer-events:none">
  <g data-token="pellet" opacity="0"><circle r="3.4" class="tk-pellet"/><circle r="1" class="tk-dot"/></g>
  <g data-token="glucose" opacity="0"><circle r="3.1" class="tk-gluc"/><circle r="0.9" class="tk-dot"/></g>
  <g data-token="atp1" opacity="0"><circle r="2.5" class="tk-atp"/><text class="tk-txt" dy="1.6" text-anchor="middle">ATP</text></g>
  <g data-token="atp2" opacity="0"><circle r="2.5" class="tk-atp"/><text class="tk-txt" dy="1.6" text-anchor="middle">ATP</text></g>
  <g data-token="atp3" opacity="0"><circle r="2.5" class="tk-atp"/><text class="tk-txt" dy="1.6" text-anchor="middle">ATP</text></g>
  <g data-token="spore" opacity="0"><rect x="-3.6" y="-3.6" width="7.2" height="7.2" rx="2.2" class="tk-spore"/></g>
  <g data-token="enzyme" opacity="0"><rect x="-4.4" y="-2.9" width="8.8" height="5.8" rx="2.6" class="tk-enz"/></g>
  <g data-token="debris" opacity="0"><circle r="3.2" class="tk-debris"/></g>
</g>`;
layers.push({ key: T.token - 1, svg: lobeB });
layers.push({ key: T.token, svg: tokens });
layers.sort((a, b) => a.key - b.key);

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const auditReport = A.auditOrExit(R, P, { flag: "--audit", quiet: false });

const svg = k.figureSvg({
  width: W, height: H,
  label: "Cell Lab bio-reactor rig. A glass culture chamber holds a cutaway cell with nucleus, rough ER with ribosomes, Golgi stack, lysosomes and a large cut-open mitochondrion. An overhead manifold carries marigold ATP tokens to a dial gauge. A production line on the same plate runs feed hopper, extractor, transmuter press, synthesizer vial station and crate.",
  body: layers.map((l) => l.svg),
});

// Plain (owner-reference) theme: override anatomy light tokens.
const PLAIN = `
.iso{--anatomy-page:#e9eaea;--anatomy-card:#f6f6f5;--anatomy-text:#6a6f73;--anatomy-strong:#16181a;--anatomy-muted:#8e9397;
--anatomy-paper:#f6f3ea;--anatomy-card:#f6f3ea;--anatomy-face:#fffdf5;--anatomy-top:#fffdf5;--anatomy-weight:.9px;
--anatomy-shade-0:#a8926b;--anatomy-shade-1:#c2b189;--anatomy-shade-2:#d9cbad;--anatomy-shade-3:#ece2cb;
--anatomy-lit-top:#ffffff;--anatomy-lit-shade:#e8e2d4;
--anatomy-hi:#16181a;--anatomy-mid:#6a6f73;--anatomy-lo:#8e9397;--anatomy-faint:#c3c6c8;--anatomy-lit:#161412;
--anatomy-halo:#161412;--anatomy-halo-opacity:.55;--anatomy-dot:#16181a;
--anatomy-red:#d94135;--mit:#f8aa06;--ink:#161412}
`;

const LIVE = `
const P = ${JSON.stringify(P)};
const DIAL = ${JSON.stringify(DIAL)};
const DIAL_TOP = ${DIAL_TOP};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const tokenEls = {};
svg.querySelectorAll("[data-token]").forEach(el => tokenEls[el.dataset.token] = el);
const $ = (s) => svg.querySelector(s);
const markers = {
  feed: () => iso([-26,-8,16], P),
  mito: () => iso([-48,8,32], P),
  dial: () => iso([DIAL[0], DIAL[1], DIAL_TOP+1.5], P),
  extractor: () => iso([79,-5,30], P),
  press: () => iso([104,-5,32], P),
  synth: () => iso([129,-5,24], P),
  crate: () => iso([149,4,14], P),
  nucleus: () => iso([-78,2,34], P),
  lysosome: () => iso([-58,24,32], P),
};
function place(name, pt){ const el = tokenEls[name]; if(!el) return; const [x,y] = pt; el.setAttribute("transform", "translate("+x+" "+y+")"); }
function show(name, on){ const el = tokenEls[name]; if(!el) return; el.setAttribute("opacity", on ? "1" : "0"); }
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EMBED = /[?&]embed=1/.test(location.search);
if(EMBED){ stage.classList.add("embed"); document.querySelectorAll(".iso-plate-corners,.iso-legend").forEach(el => el.style.display="none"); document.querySelectorAll(".credit").forEach(el => el.style.display="none"); }
const ORIGIN = location.origin;
const readout = document.querySelector("[data-readout]");
const atpEl = document.querySelector("[data-counter-atp]");
const vitEl = document.querySelector("[data-counter-vit]");
const ACTIONS = ["feed","atp","extract","transmute","synthesize","nucleus","lysosome","divide","lysis","splice"];
const labelOf = { feed:["Feed","nutrient pellets via chute"], atp:["ATP","glucose in, ATP tokens out"], extract:["Extract","spore granules"], transmute:["Transmute","press to capsule"], synthesize:["Synthesize","elixir vial filled and capped"], nucleus:["Nucleus","mRNA to ribosomes"], lysosome:["Lysosome","digesting debris"], divide:["Divide","mitosis pinch"], lysis:["Lysis","membrane ruptured"], splice:["Splice","second cell docks and fuses"] };
let S = { status:"Active", vitality:70, atp:0, organel:{mitokondria:2, nukleus:2, lisosom:2}, zone:"Normal" };
let needleTurn = 0.25, busy = false;
function setReadout(txt){ if(readout && readout.textContent !== txt) readout.textContent = txt; }
function setCounters(){ if(atpEl) atpEl.textContent = "ATP " + S.atp; if(vitEl) vitEl.textContent = "Vitality " + Math.round(S.vitality); }
function needleAt(turn){
  const a = turn * Math.PI * 2;
  return lineOnTop(
    [DIAL[0] - Math.sin(a)*3.2, DIAL[1] + Math.cos(a)*3.2],
    [DIAL[0] + Math.sin(a)*(17-2.4), DIAL[1] - Math.cos(a)*(17-2.4)],
    DIAL_TOP + 0.2, P, false
  );
}
function drawNeedle(){ const n = $('[data-part="needle"]'); if(n) n.setAttribute("d", needleAt(Math.min(0.9, Math.max(0.05, needleTurn)))); }
function hl(sel, on){ const el = sel ? $(sel) : null; if(el) el.classList.toggle("is-active", on); }
function animateMove(name, fromFn, toFn, dur, done){
  if(calm){ place(name, toFn()); show(name, true); done && done(); return; }
  const t0 = performance.now();
  const a = fromFn(), b = toFn();
  place(name, a); show(name, true);
  function step(now){
    const t = Math.min(1, (now - t0)/dur);
    const e = t*t*(3-2*t);
    place(name, [a[0]+(b[0]-a[0])*e, a[1]+(b[1]-a[1])*e - Math.sin(e*Math.PI)*14]);
    if(t < 1) requestAnimationFrame(step); else done && done();
  }
  requestAnimationFrame(step);
}
function finish(action){
  busy = false;
  svg.querySelectorAll(".station-on,.is-active").forEach(el => el.classList.remove("station-on","is-active"));
  const gl = $('[data-part="mito-glow"]'); if(gl) gl.setAttribute("opacity","0");
  const cr = $('[data-part="lysis-cracks"]'); if(cr) cr.setAttribute("opacity","0");
  const ch = $('[data-part="chromosomes"]'); if(ch) ch.setAttribute("opacity","0");
  setReadout(labelOf[action][0] + " done · ATP " + S.atp);
  if(!EMBED) window.parent.postMessage({type:"snacc:done", action}, ORIGIN);
}
function play(action){
  if(busy || !ACTIONS.includes(action)) return;
  busy = true;
  if(!EMBED) window.parent.postMessage({type:"snacc:action", action}, ORIGIN);
  const signMap = { feed:"feed", extract:"extract", transmute:"transmute", synthesize:"synthesize" };
  const sign = signMap[action];
  if(sign){ const g = svg.querySelector('[data-sign="'+sign+'"]'); if(g) g.classList.add("station-on"); }
  const hlFor = { atp:".mito-body", transmute:'[data-part="press-head"]', synthesize:'[data-part="vial-fill"]', divide:'[data-part="cell-lobe-b"]', splice:".dock-cell", nucleus:".nucleus-body" }[action];
  if(hlFor) hl(hlFor, true);
  if(action === "atp"){ const gl = $('[data-part="mito-glow"]'); if(gl) gl.setAttribute("opacity","1"); }
  if(action === "lysosome"){ svg.querySelectorAll(".lyso").forEach(el => el.classList.add("station-on")); }
  if(action === "lysis"){ const cr = $('[data-part="lysis-cracks"]'); if(cr) cr.setAttribute("opacity","1"); }
  if(action === "divide"){ const ch = $('[data-part="chromosomes"]'); if(ch) ch.setAttribute("opacity","1"); }
  setReadout(labelOf[action][0] + " · " + labelOf[action][1] + "…");
  const paths = {
    feed(){ animateMove("pellet", markers.feed, markers.mito, calm?1:900, ()=>{ S.vitality = Math.min(100, S.vitality+4); setCounters(); show("pellet", false); finish("feed"); }); },
    atp(){ S.atp += 2; setCounters(); needleTurn = Math.min(0.9, needleTurn+0.12); drawNeedle();
      animateMove("glucose", markers.mito, markers.mito, calm?1:500, ()=>{
        ["atp1","atp2","atp3"].forEach((n,i)=> setTimeout(()=> animateMove(n, markers.mito, markers.dial, calm?1:1100 - i*150, ()=> show(n,false)), i*140));
        setTimeout(()=>{ if(hi) hl(hi,false); finish("atp"); }, calm?60:1500);
      }); },
    extract(){ animateMove("spore", markers.mito, markers.extractor, calm?1:1000, ()=>{ show("spore", false); finish("extract"); }); },
    transmute(){ animateMove("spore", markers.extractor, markers.press, calm?1:900, ()=>{ const head = $('[data-part="press-head"]'); if(head && !calm) head.setAttribute("transform","translate(0 6)"); setTimeout(()=>{ if(head) head.removeAttribute("transform"); animateMove("enzyme", markers.press, markers.synth, calm?1:900, ()=>{ show("enzyme", false); if(hi) hl(hi,false); finish("transmute"); }); }, calm?1:450); }); },
    synthesize(){ const fill = $('[data-part="vial-fill"]'); const cap = $('.vial-cap'); if(cap && !calm) cap.setAttribute("transform","translate(0 -3)"); setTimeout(()=>{ if(cap) cap.removeAttribute("transform"); animateMove("enzyme", markers.synth, markers.crate, calm?1:900, ()=>{ show("enzyme", false); if(hi) hl(hi,false); finish("synthesize"); }); }, calm?1:900); },
    nucleus(){ const m = $('[data-part="mrna"]'); if(m) m.setAttribute("opacity","1"); animateMove("spore", markers.nucleus, markers.extractor, calm?1:1300, ()=>{ show("spore", false); if(m) m.setAttribute("opacity","0"); finish("nucleus"); }); },
    lysosome(){ animateMove("debris", markers.dock, markers.lysosome, calm?1:1100, ()=>{ show("debris", false); finish("lysosome"); }); },
    divide(){ const lobe = $('[data-part="cell-lobe-b"]'); const spin = $('[data-part="spindle"]'); if(lobe) lobe.setAttribute("opacity","1"); if(spin) spin.setAttribute("opacity","1"); setTimeout(()=>{ if(lobe) lobe.setAttribute("opacity","0"); if(spin) spin.setAttribute("opacity","0"); if(hi) hl(hi,false); finish("divide"); }, calm?200:1600); },
    lysis(){ S.status = "Liquidated"; applyStatus(); setTimeout(()=>{ finish("lysis"); }, calm?200:1200); },
    splice(){ const dock = $('.dock-cell'); if(dock && !calm) dock.setAttribute("transform","translate(38 6)"); setTimeout(()=>{ if(dock) dock.removeAttribute("transform"); if(hi) hl(hi,false); finish("splice"); }, calm?200:1300); },
  };
  markers.dock = () => iso([-146,-50,14], P);
  paths[action]();
}
function applyStatus(){
  const root = svg;
  root.classList.toggle("status-dim", S.status === "Distressed");
  root.classList.toggle("status-grey", S.status === "SplicedBurned");
  const sl = $('[data-part="status-lamp"]');
  if(sl) sl.classList.toggle("lamp-err", S.status === "Liquidated");
  const mitoN = [0,1,2,3,4,6][Math.min(5, Math.max(0, S.organel.mitokondria|0))];
  svg.querySelectorAll(".mito-sat").forEach((el,i)=> el.setAttribute("opacity", i < mitoN ? "1" : "0.12"));
  const haze = $('[data-part="heat-haze"]');
  if(haze) haze.setAttribute("opacity", S.zone === "Fever" ? "1" : "0");
  root.classList.toggle("frost-on", S.zone === "Hypothermia");
  drawNeedle(); setCounters();
}
window.addEventListener("message", (e) => {
  if(e.origin !== ORIGIN) return;
  const d = e.data; if(!d || typeof d.type !== "string") return;
  if(d.type === "snacc:state"){
    const s = d.strain || {};
    S.status = s.status || S.status;
    S.vitality = (s.effective_vitality ?? s.vitality ?? S.vitality);
    S.atp = (typeof s.atp_balance === "number" ? s.atp_balance : S.atp);
    if(s.organel){ S.organel.mitokondria = s.organel.mitokondria ?? S.organel.mitokondria; S.organel.nukleus = s.organel.nukleus ?? S.organel.nukleus; S.organel.lisosom = s.organel.lisosom ?? S.organel.lisosom; }
    if(d.zone) S.zone = d.zone;
    applyStatus();
  } else if(d.type === "snacc:play"){
    if(ACTIONS.includes(d.action)) play(d.action);
  }
});
document.querySelectorAll("[data-action]").forEach(btn => {
  btn.addEventListener("click", () => { play(btn.dataset.action); });
});
applyStatus();
if(!calm) setReadout("Ready — press an action");
else setReadout("Still — highlights and numbers shown");
window.parent.postMessage({type:"snacc:ready"}, ORIGIN);
`;

const EXTRA_CSS = `
.stage-shell{position:relative}
.dock{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0 4px}
.dock button{font:600 11px/1 ui-sans-serif,system-ui;letter-spacing:.03em;padding:7px 10px;border-radius:999px;border:1.5px solid #161412;background:#fffdf5;color:#161412;cursor:pointer}
.dock button:hover{background:#f8aa06}
.counters{display:flex;gap:14px;justify-content:center;color:#16181a;font:600 12px ui-monospace,Menlo,monospace;margin:6px 0 2px}
.embed .dock,.embed .counters{display:none}
.embed .iso-plate{padding:8px;border-radius:0;box-shadow:none}
.embed .iso-legend{display:none}
.embed .iso-plate-corners{display:none}
.credit{position:absolute;right:6px;bottom:2px;font:500 9px ui-monospace,Menlo,monospace;color:#8e9397}
@media (max-width:560px){.credit{position:static;display:block;text-align:center;margin:6px 0 2px}.dock button{padding:6px 8px}}
.tk-pellet{fill:#f8aa06;stroke:#161412;stroke-width:.6}
.tk-gluc{fill:#fff;stroke:#161412;stroke-width:.6}
.tk-atp{fill:#f8aa06;stroke:#161412;stroke-width:.7}
.tk-txt{font:700 3.6px ui-monospace,Menlo,monospace;fill:#161412}
.tk-dot{fill:#161412}
.tk-spore{fill:#26262a;stroke:#fbfbfa;stroke-width:.5}
.tk-enz{fill:#f8aa06;stroke:#161412;stroke-width:.6}
.tk-debris{fill:#8a8a8f;stroke:#161412;stroke-width:.6}
.vial-fill{fill:#f8aa06}
.vial-fill .iso-fill{fill:#f8aa06}
.vial-fill .iso-shade{fill:#d49005}
.vial-fill .iso-top{fill:#ffb832}
.vial-fill .iso-edge{stroke:#161412}
.is-active{filter:drop-shadow(0 0 3px #f8aa06)}
.is-active .iso-edge{stroke:#f8aa06!important;stroke-width:1.6}
.cyto .iso-top{fill:#e0d3ae}
.cyto .iso-fill{fill:#e0d3ae}
.mito-body .iso-top{fill:#f3e2b8}
.mito-body .iso-fill{fill:#f3e2b8}
.nucleus-body .iso-top{fill:#ddd6c2}
.nucleus-body .iso-fill{fill:#ddd6c2}
.station-on .iso-edge{stroke:#f8aa06!important;stroke-width:1.5}
.station-on .station-sign .iso-top{fill:#f8aa06}
.station-on .station-sign .iso-fill{fill:#f8aa06}
.mito-halo{fill:#f8aa06;filter:blur(8px)}
.lamp-err .iso-edge{stroke:#d94135!important}
.status-dim{opacity:.55}
.status-grey{filter:grayscale(1);opacity:.6}
.frost-on .iso-edge{stroke:#8ac6e8!important}
`;

const EMBED_CLASS = "";
const dockButtons = ["feed", "atp", "extract", "transmute", "synthesize", "nucleus", "lysosome", "divide", "lysis", "splice"]
  .map((a) => `<button type="button" data-action="${a}">${a[0].toUpperCase() + a.slice(1)}</button>`)
  .join("");

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Cell Lab — bio-reactor rig",
  hint: "Press an action",
  readout: "Ready — press an action",
  keys: [
    { mark: "lit", label: "Marigold ATP: the lit subject (mitochondrion → manifold → gauge)" },
    { mark: "raised", label: "Glass chamber with cutaway cell (nucleus, ER, Golgi, lysosomes)" },
    { mark: "flat", label: "Production line: hopper → extractor → press → vial → crate" },
  ],
  caption: "Cell Lab rig on a base plate. The chamber holds a cutaway cell; glucose enters the hero mitochondrion, cristae light in a wave, and ATP tokens stream to the dial. Each action below is unmistakable mid-animation: moving tokens plus a lit working part and label.",
  body: `<div class="iso-stage stage-shell${EMBED_CLASS}" tabindex="0" role="group" aria-label="Cell Lab actions">${`<style>${PLAIN}${EXTRA_CSS}</style>`}${svg}<div class="counters"><span data-counter-atp>ATP 0</span><span data-counter-vit>Vitality 70</span></div><div class="dock" role="group" aria-label="Cell Lab action buttons">${dockButtons}</div><span class="credit">Anatomy (MIT) by April Zhu — plain marigold</span></div>`,
});

const html = k.pageHtml({ title: "Cell Lab", theme: "light", body, script: kitScript() + "\n" + LIVE });
const outPath = join(HERE, "..", "..", "..", "public", "figures", "cell-lab.html");
writeFileSync(outPath, html);
console.log("wrote", outPath, (html.length / 1024).toFixed(1) + " KB");
