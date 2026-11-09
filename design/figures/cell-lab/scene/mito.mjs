// Hero mitochondrion: a bean-shaped cut-open power plant (outer + inner membrane, cristae ridge with complexes I/III/IV,
// Krebs Ferris wheel, glycolysis splitter, membrane transporter gate, reservoir tank, ATP synthase turbine, O2 bottle + beaker).
import { k, G, A, O, P, S, Ln, Dm, at, f1, planeM, HR, noteShape, flushItem } from "../ctx.mjs";
import * as F from "./frame.mjs";
import { makeMech } from "../mech.mjs";

export const GEO = {
  MC: F.MC,
  wheel: { u: -27, v: 0, z: 33, R: 15, n: 8, rv: 2.8, labels: ["CIT", "ISO", "AKG", "SCA", "SUC", "FUM", "MAL", "OAA"] },
  turb: { u: 55.5, v: -1, z0: 9, n: 10, zf1: 24 },
  tank: { u0: 4, u1: 49, v: -17.4, z: 27, r: 3.6 },
  complexes: [{ name: "I", u: 5, w: 10 }, { name: "III", u: 21, w: 10 }, { name: "IV", u: 37, w: 10 }],
  ridge: { u0: 2, u1: 50, v0: -13, v1: -3, z0: 7, h: 5 },
  car: { u0: 4.2, u1: 51, v: 6.5, zCable: 33 },
  gate: { u: -66, v: 0 },
  split: { u: -62, v: -5, w: 12, d: 10, h: 9 },
  chimney: { u: -38, v: -18.5, h: 20 },
  rack: { u: -8, v: -5, w: 9, d: 8 },
  o2: { u: 38, v: 15 },
  beaker: { u: 51, v: 16 },
  dial: { x: 150, y: -73 },
  wall: { top: 40, rim: 13, z0: 5, vcut: 5 },
};
export const MECH = makeMech(k, P, GEO);

const OUT = F.beanLocal(78, 35, 96);
const INN = F.beanLocal(72, 29.5, 96);
const MID = F.beanLocal(75, 32, 96);

export function hero() {
  const items = []; // { key, svg }
  const add = (key, svg) => { const name = "hero." + items.length; items.push({ key, svg, name }); flushItem(HR, key, name); };
  const { wall } = GEO;

  // ---- plinth + matrix floor, split into back / front halves so the walls sit between them ----
  // (one full ring interlocked with every wall piece the audit could not order)
  const plinthLoc = F.beanLocal(86, 43, 96);
  const plinthRing = F.toWorldRing(plinthLoc);
  const ringRun = (loc, pred) => {
    const n = loc.length; const flags = loc.map((pt) => pred(pt[0], pt[1]));
    let start = flags.findIndex((f, i) => f && !flags[(i + n - 1) % n]);
    if (start < 0) start = 0;
    const out = []; for (let i = 0; i < n && out.length < n; i++) { const j = (start + i) % n; if (flags[j]) out.push(loc[j]); else if (out.length) break; }
    return out;
  };
  const plinthBackLoc = ringRun(plinthLoc, (u, v) => v < wall.vcut);
  const plinthFrontLoc = ringRun(plinthLoc, (u, v) => v >= wall.vcut);
  const pl = [];
  pl.push(`<path class="shadow-flat" transform="translate(-14 12)" d="${O.pathOf(plinthRing.map(([x, y]) => at([x, y, 0])), true)}"/>`);
  noteShape(A.extruded(F.toWorldRing(plinthBackLoc), 0, 5, { name: "hero.plinth.back", ground: true }));
  pl.push(S(k.extrude(F.toWorldRing(plinthBackLoc), 0, 5, P, { convex: false, bevel: 0.8 }), { tone: "hi", className: "tan", crease: "lo" }));
  add(-1100, pl.join(""));
  const fl = [];
  // floor (matrix) slab, one disc in its own item after the walls (front half drawn in the same item)
  const floorBackLoc = ringRun(INN, (u, v) => v < wall.vcut).map(([u, v]) => [u * 0.98, v * 0.98]);
  const floorFrontLoc = ringRun(INN, (u, v) => v >= wall.vcut).map(([u, v]) => [u * 0.98, v * 0.98]);
  noteShape(A.extruded(F.toWorldRing(floorBackLoc), 5, 2, { name: "hero.floor.back" }));
  fl.push(S(k.extrude(F.toWorldRing(floorBackLoc), 5, 2, P, { convex: false, bevel: 0 }), { tone: "hi", className: "warm", crease: "none" }));
  noteShape(A.extruded(F.toWorldRing(floorFrontLoc), 5, 2, { name: "hero.floor.front" }));
  fl.push(S(k.extrude(F.toWorldRing(floorFrontLoc), 5, 2, P, { convex: false, bevel: 0 }), { tone: "hi", className: "warm", crease: "none" }));
  // floor grid dots + seam lines (matrix granules)
  const grid = [];
  for (let u = -66; u <= 66; u += 6) for (let v = -24; v <= 26; v += 6) { const i2 = (u / 72) ** 2 + (v / 29.5) ** 2; if (i2 < 0.82) grid.push(at(F.W3(u, v, 7))); }
  fl.push(Dm(grid, { size: 0.45, tone: "lo" }));
  add(-840, fl.join(""));
  const lab = planeM(F.W3(-38, 36.5, 5.2), F.Uvec.map((x) => x), [F.Vvec[0], F.Vvec[1], 0]);
  // front plinth half + front apron screws (drawn after the front wall, whose base it overlaps)
  const pf = [];
  noteShape(A.extruded(F.toWorldRing(plinthFrontLoc), 0, 5, { name: "hero.plinth.front", ground: true }));
  pf.push(S(k.extrude(F.toWorldRing(plinthFrontLoc), 0, 5, P, { convex: false, bevel: 0.8 }), { tone: "hi", className: "tan", crease: "lo" }));
  const apron = [];
  for (const [u, v] of [[-60, 38], [-30, 41], [0, 42], [30, 41], [60, 38], [-72, 22], [72, 22]]) apron.push(at(F.W3(u, v, 5)));
  pf.push(Dm(apron, { size: 0.65, tone: "hi" }));
  add(10000, pf.join(""));

  // ---- tall back wall, split into back / left / right pieces so the inner items sit between them ----
  // (one full ring interlocked with everything the audit could not order)
  const vc = wall.vcut;
  const runOf = (loc, pred) => loc.filter(pred);
  const contiguous = (loc, pred) => {
    const n = loc.length; const flags = loc.map((pt) => pred(pt[0], pt[1]));
    let start = flags.findIndex((f, i) => f && !flags[(i + n - 1) % n]);
    if (start < 0) start = 0;
    const out = []; for (let i = 0; i < n && out.length < n; i++) { const j = (start + i) % n; if (flags[j]) out.push(loc[j]); else if (out.length) break; }
    return out;
  };
  const wallPieces = [
    { key: -900, name: "hero.wall.back", pred: (u, v) => v < -14 && v < vc },
    { key: -880, name: "hero.wall.left", pred: (u, v) => v >= -14 && v < vc && u < -34 },
    { key: -870, name: "hero.wall.right", pred: (u, v) => v >= -14 && v < vc && u > 34 },
  ];
  const wallShapes = {};
  for (const piece of wallPieces) {
    const innerQ = F.wallQuads(INN, wall.z0, wall.top, { mode: "inner", pred: piece.pred });
    const outerQ = F.wallQuads(OUT, wall.z0, wall.top, { mode: "outer", pred: piece.pred });
    const oRun = contiguous(OUT, piece.pred), iRun = contiguous(INN, piece.pred);
    const parts = [];
    parts.push(`<g class="cyto">${F.quadSvg(innerQ)}</g>`, F.quadSvg(outerQ));
    const topPoly = [...F.ringPts(oRun, wall.top), ...F.ringPts(iRun, wall.top).reverse()];
    const shape = A.extruded([...F.toWorldRing(oRun), ...F.toWorldRing(iRun).reverse()], wall.z0, wall.top - wall.z0, { name: piece.name });
    noteShape(shape);
    wallShapes[piece.name] = shape;
    parts.push(`<path d="${O.pathOf(topPoly, true)}" fill="var(--anatomy-top)" class="ink" style="stroke-width:.9px"/>`);
    parts.push(`<path d="${O.pathOf(F.ringPts(iRun, wall.top - 1.2))}" class="ink3" style="stroke-width:.4px;opacity:.8"/>`);
    parts.push(`<path d="${O.pathOf(F.ringPts(iRun, wall.top))}" class="ink" style="stroke-width:.9px"/>`);
    // cut-section face at the front cut (v = vc), only for pieces that reach it (cream with marigold hatch)
    let oEnd = null, oEndV = -Infinity;
    for (const pt of oRun) if (pt[1] > oEndV) { oEndV = pt[1]; oEnd = pt; }
    if (oEnd && oEndV > vc - 1) {
      const aO = Math.atan2(oEnd[1] / 35, oEnd[0] / 78);
      let iEnd = iRun[0], best = 1e9;
      for (const pt of iRun) { const d = Math.abs(Math.atan2(pt[1] / 29.5, pt[0] / 72) - aO); if (d < best) { best = d; iEnd = pt; } }
      const q = [at(F.W3(oEnd[0], vc, wall.rim)), at(F.W3(iEnd[0], vc, wall.rim)), at(F.W3(iEnd[0], vc, wall.top)), at(F.W3(oEnd[0], vc, wall.top))];
      parts.push(`<path d="${O.pathOf(q, true)}" fill="#fff7e0" class="ink" style="stroke-width:.9px"/>`);
      for (let h = 1; h < 6; h++) {
        const t = h / 6;
        const a = at(F.W3(oEnd[0], vc, wall.rim + (wall.top - wall.rim) * t));
        const b = at(F.W3(iEnd[0], vc, wall.rim + (wall.top - wall.rim) * t));
        parts.push(`<path d="${O.pathOf([a, b])}" fill="none" style="stroke:#f8aa06;stroke-width:.9px;opacity:.85"/>`);
      }
    }
    add(piece.key, parts.join(""));
  }

  // ---- inner membrane: low ring wall along the back half, with intermembrane gap ----
  const imw = [];
  const innerM = F.wallQuads(F.beanLocal(66, 24.5, 96), wall.z0 + 2, 15.5, { mode: "inner", pred: (u, v) => v < 2 });
  imw.push(F.quadSvg(innerM));
  const imRun = F.beanLocal(66, 24.5, 96).filter(([, v]) => v < 2);
  imw.push(`<path d="${O.pathOf(F.ringPts(imRun.sort((a, b) => a[0] - b[0]), 15.5))}" class="ink" style="stroke-width:.8px"/>`);
  add(-850, imw.join(""));

  // ---- low front rim (front wall piece; drawn last by key, built early so the gate can seat in it) ----
  const frontQ = F.wallQuads(OUT, wall.z0, wall.rim, { mode: "outer", pred: (u, v) => v >= vc });
  const lowQ = F.wallQuads(INN, wall.z0, wall.rim, { mode: "inner", pred: (u, v) => v >= vc });
  const fr = [];
  fr.push(`<g class="cyto">${F.quadSvg(lowQ)}</g>`);
  fr.push(F.quadSvg(frontQ));
  const frontShape = A.extruded([...F.toWorldRing(OUT.filter(([, v]) => v >= vc)), ...F.toWorldRing(INN.filter(([, v]) => v >= vc)).reverse()], wall.z0, wall.rim - wall.z0, { name: "hero.wall.front" });
  noteShape(frontShape);
  wallShapes["hero.wall.front"] = frontShape;
  const fRunO = OUT.filter(([, v]) => v >= vc), fRunI = INN.filter(([, v]) => v >= vc);
  const byAngle = (loc) => loc.map(([u, v]) => [Math.atan2(v / 30, u / 75), u, v]).sort((a, b) => b[0] - a[0]).map(([, u, v]) => [u, v]);
  const fO = byAngle(fRunO), fI = byAngle(fRunI);
  const topF = [...F.ringPts(fO, wall.rim), ...F.ringPts(fI, wall.rim).reverse()];
  fr.push(`<path d="${O.pathOf(topF, true)}" fill="var(--anatomy-top)" class="ink" style="stroke-width:.9px"/>`);
  fr.push(`<path d="${O.pathOf(F.ringPts(fO, wall.z0))}" class="ink" style="stroke-width:.9px"/>`);
  fr.push(Dm(fO.filter((_, i) => i % 3 === 1).map(([u, v]) => { const m = Math.hypot(u / 78, v / 35); return at(F.W3(u * (1 - 2.6 / 78 / m * 0 + -0.03), v * 0.96, wall.rim)); }), { size: 0.5, tone: "hi" }));
  fr.push(`<g data-dyn="lamps"></g>`);
  add(9999, fr.join(""));

  // ---- cristae ridge with folds ----
  const r = GEO.ridge;
  const rg = [];
  rg.push(F.boxL(r.u0, r.v0, r.u1 - r.u0, r.v1 - r.v0, r.z0, r.h, { r: 1.2, bevel: 0.5, className: "tan" }));
  const ridgeShape = F.boxL.last;
  // turbine base + stator ring: one casting with the ridge (same item, so it cannot cycle against it)
  const tc0 = F.Wxy(GEO.turb.u, GEO.turb.v);
  const turbBaseShape = noteShape(A.cylinder(tc0[0], tc0[1], 13.8, 7, 2.2, { name: "hero.turbine.base", seated: true, cut: ridgeShape }));
  const turbRingShape = noteShape(A.cylinder(tc0[0], tc0[1], 12.0, 9.2, 1.0, { name: "hero.turbine.ring", seated: true, cut: ridgeShape }));
  rg.push(S(k.cylinder(tc0[0], tc0[1], 13.8, 7, 2.2, P, 44, 0.4), { tone: "hi", className: "tan" }));
  rg.push(S(k.cylinder(tc0[0], tc0[1], 12.0, 9.2, 1.0, P, 44, 0.2), { tone: "hi", className: "steel" }));
  rg.push(Ln(k.ring(tc0[0], tc0[1], 13.0, 9.2, P, 44), { tone: "faint" }));
  rg.push(Dm(Array.from({ length: 12 }, (_, i) => { const aa = (i / 12) * Math.PI * 2; return at([tc0[0] + Math.cos(aa) * 13.0, tc0[1] + Math.sin(aa) * 13.0, 9.2]); }), { size: 0.5, tone: "hi" }));
  // cristae folds are drawn live (drawFolds): 4 + level folds stand, `level` of them are lit marigold
  rg.push(`<g data-dyn="folds"></g>`);
  add(F.depthKey(-8, 0), rg.join(""));

  // ---- complexes I, III, IV on the ridge ----
  const cx = [];
  for (const c of GEO.complexes) {
    const z0 = r.z0 + r.h, h = 11;
    cx.push(F.boxL(c.u, -11, c.w, 9, z0, h, { r: 1.2, bevel: 0.4, className: "warm" }));
    // marigold port on top + proton pump nozzle
    cx.push(F.boxL(c.u + 1.6, -9.6, 3.6, 3.6, z0 + h, 0.8, { r: 0.6, bevel: 0.1, className: "mari" }));
    cx.push(F.cylW(c.u + c.w - 2.8, -6.4, 1.5, z0 + h, 3.2, { className: "steel", steps: 14 }));
    // engraved plate with the complex number on the front face
    const M = planeM(F.W3(c.u + 1.2, -2 + 0.01, z0 + 3.4), [F.Uvec[0], F.Uvec[1], 0], [0, 0, -1]);
    cx.push(`<g transform="${M}"><rect x="0" y="-.2" width="${c.w - 2.4}" height="3.6" rx=".5" fill="#fffdf6" class="ink" style="stroke-width:.4px"/><text class="txt" x="${f1((c.w - 2.4) / 2)}" y="2.4" text-anchor="middle" style="font-size:2.3px;font-weight:700">${c.name}</text></g>`);
    // vent slots on the front face
    for (let i = 0; i < 3; i++) {
      const a = at(F.W3(c.u + 1.6 + i * 2.2, -2, z0 + 6.4)), b = at(F.W3(c.u + 1.6 + i * 2.2, -2, z0 + 9.2));
      cx.push(`<path d="${O.pathOf([a, b])}" class="ink3" style="stroke-width:.5px"/>`);
    }
  }
  add(F.depthKey(-6, 12), cx.join(""));

  // ---- reservoir tank (intermembrane space) along the back wall with level gauge ----
  const t = GEO.tank;
  const tk = [];
  {
    const o = F.W3(t.u0, t.v, t.z), a = [F.Uvec[0], F.Uvec[1], 0];
    const Fr = G.frameAlong(o, a);
    const len = t.u1 - t.u0;
    const prof = [[0, 0.01]];
    for (let i = 0; i <= 6; i++) { const q = i / 6; prof.push([t.r * (1 - Math.cos((q * Math.PI) / 2)) * 0.9, t.r * Math.sin((q * Math.PI) / 2), 1]); }
    prof.push([len - t.r * 0.9, t.r]);
    for (let i = 6; i >= 0; i--) { const q = i / 6; prof.push([len - t.r * (1 - Math.cos((q * Math.PI) / 2)) * 0.9, t.r * Math.sin((q * Math.PI) / 2), 1]); }
    prof.push([len, 0.01]);
    const tankShape = A.lathe(Fr, prof, { name: "hero.tank" });
    noteShape(tankShape);
    const body = G.lathe(prof, Fr, P, { steps: 28, fill: "hull" });
    tk.push(S(body, { tone: "hi", className: "water", crease: "none" }));
    // water level (marigold float line) drawn live via data-part, plus graduation ticks on the tank
    for (let i = 0; i <= 9; i++) {
      const uu = t.u0 + 6 + i * ((len - 12) / 9);
      const p0 = at(F.W3(uu, t.v + t.r, t.z - 0.6)), p1 = at(F.W3(uu, t.v + t.r, t.z + (i % 3 ? 0.4 : 1.4)));
      tk.push(`<path d="${O.pathOf([p0, p1])}" class="ink2" style="stroke-width:.5px"/>`);
    }
    // saddle hangers: from the tank back to the back wall (seated in both)
    for (const uu of [t.u0 + 6, (t.u0 + t.u1) / 2, t.u1 - 6]) tk.push(F.boxL(uu - 1.4, -25, 2.8, (t.v + 2) + 25, 23, 4, { r: 0.5, bevel: 0.2, className: "steel", meta: { seated: true, cut: [tankShape, wallShapes["hero.wall.back"]] } }));
    // intake funnels from the tank's front face (bosses into the tank)
    for (const c of GEO.complexes) tk.push(F.cylW(c.u + c.w - 2.8, t.v + t.r + 0.8, 1.7, t.z - 1.6, 1.8, { className: "steel", steps: 12, meta: { seated: true, cut: tankShape } }));
  }
  tk.push(`<g data-dyn="tank-level"></g>`);
  add(F.depthKey(t.v, 20), tk.join(""));

  // ---- ATP synthase rotor (base is merged into the ridge item above) ----
  const tb = GEO.turb;
  const tc = F.Wxy(tb.u, tb.v);
  void tc;
  add(F.depthKey(tb.v, 5), `<g data-dyn="rotor">${MECH.rotor(0, 0)}</g>`);
  // yoke over the rotor: two stator posts standing on the base between ring and rim, crossbar on top
  const yk = [];
  yk.push(F.cylW(tb.u - 12.4, tb.v + 4, 1.1, 9.2, 11.4, { className: "steel", steps: 12 }));
  yk.push(F.cylW(tb.u + 12.4, tb.v + 4, 1.1, 9.2, 11.4, { className: "steel", steps: 12 }));
  yk.push(F.boxL(tb.u - 12.4, tb.v + 2.8, 24.8, 2.4, 20.6, 1.6, { r: 0.5, bevel: 0.2, className: "steel" }));
  add(F.depthKey(tb.v + 4, 12), yk.join(""));
  add(F.depthKey(tb.v + 1, 25), `<g data-dyn="f1">${MECH.f1head(0)}</g>`);

  // ---- ferris wheel (Krebs cycle) + A-frame legs ----
  const w = GEO.wheel;
  const wf = [];
  // base saddle + A frame legs at the back (v = -6.4) and front (v = +6.4)
  for (const vv of [-1, 1]) {
    const vl = w.v + vv * (vv > 0 ? w.rv + 7.4 : w.rv + 2.6);
    const legPoly = (sign) => {
      const top = [w.u + sign * 0.6, w.z - 0.5], bot = [w.u + sign * 10, FLOOR_Z()];
      return [at(F.W3(top[0] - 1.1, vl, top[1])), at(F.W3(top[0] + 1.1, vl, top[1])), at(F.W3(bot[0] + 1.3, vl, bot[1])), at(F.W3(bot[0] - 1.3, vl, bot[1]))];
    };
    const side = vv > 0 ? "front" : "back";
    for (const sign of [-1, 1]) {
      const q = legPoly(sign);
      const q2 = q.map(([x, y]) => [x, y - 0.0]);
      wf.push(`<path d="${O.pathOf(q, true)}" fill="${vv > 0 ? "#fef8ed" : "#d8c399"}" class="ink" style="stroke-width:.85px"/>`);
    }
    // cross brace
    const y0 = w.z - 12;
    wf.push(`<path d="${O.pathOf([at(F.W3(w.u - 7, vl, y0)), at(F.W3(w.u + 7, vl, y0))])}" class="ink" style="stroke-width:.8px"/>`);
    wf.push(`<g class="__legs__"></g>`.replace('<g class="__legs__"></g>', ""));
    // foot plates
    for (const sign of [-1, 1]) wf.push(F.boxL(w.u + sign * 10 - 2.2, vl - 1.4, 4.4, 2.8, 7, 0.9, { r: 0.4, bevel: 0.1, className: "steel" }));
  }
  // split: back legs drawn before the wheel; front legs after (see order below)
  const backLegs = wf.slice(0, wf.length / 2).join(""), frontLegs = wf.slice(wf.length / 2).join("");
  add(F.depthKey(-7, 0), backLegs);
  add(F.depthKey(-1, 20), `<g data-dyn="wheel">${MECH.wheel(0.3, [])}</g>`);
  add(F.depthKey(8, 0), frontLegs);

  // ---- NADH battery rack ----
  const rk = GEO.rack;
  const rkS = [];
  rkS.push(F.boxL(rk.u, rk.v, rk.w, rk.d, 7, 6, { r: 0.8, bevel: 0.3, className: "steel" }));
  for (let i = 0; i < 3; i++) {
    const cu = rk.u + 1.6 + i * 2.5;
    rkS.push(F.boxL(cu, rk.v + 1.2, 2.0, rk.d - 2.4, 13, 0.4, { r: 0.3, bevel: 0, className: "dark", crease: "none" }));
  }
  rkS.push(`<g data-dyn="rack-cells"></g>`);
  rkS.push(F.boxL(rk.u + 0.6, rk.v + rk.d - 0.4, rk.w - 1.2, 0.6, 11, 1.6, { r: 0.2, bevel: 0, className: "tan" }));
  const M2 = planeM(F.W3(rk.u + 0.8, rk.v + rk.d + 0.3, 11.3), [F.Uvec[0], F.Uvec[1], 0], [0, 0, -1]);
  rkS.push(`<g transform="${M2}"><text class="txt" x="0.2" y="1.1" style="font-size:1.4px">NADH</text></g>`);
  add(F.depthKey(rk.v, 6), rkS.join(""));

  // ---- chimney (CO2) ----
  const ch = GEO.chimney;
  const chS = [];
  chS.push(F.cylW(ch.u, ch.v, 2.6, 7, ch.h, { className: "steel", steps: 20 }));
  chS.push(F.cylW(ch.u, ch.v, 3.4, 7 + ch.h, 1.8, { className: "tan", steps: 20 }));
  chS.push(F.cylW(ch.u, ch.v, 2.2, 7 + ch.h + 1.8, 0.6, { className: "dark", steps: 16, crease: "none" }));
  chS.push(`<g data-dyn="chimney"></g>`);
  for (const dz of [5, 10, 15]) chS.push(Ln(k.sideArc(F.Wxy(ch.u, ch.v)[0], F.Wxy(ch.u, ch.v)[1], 2.6, 7 + dz, P, 14), { tone: "faint" }));
  add(F.depthKey(ch.v, 0), chS.join(""));

  // ---- membrane transporter gate (flipping flap), split at the front cut so each post rides with its wall ----
  const g = GEO.gate;
  const gs = [];
  // back post + back crossbar part seated in the left wall piece
  gs.push(F.boxL(g.u - 4, g.v - 8, 2.4, 3, 7, 12, { r: 0.4, bevel: 0.2, className: "steel", meta: { seated: true, cut: wallShapes["hero.wall.left"] } }));
  gs.push(F.boxL(g.u - 4.6, g.v - 8, 3.6, 12, 19, 2, { r: 0.5, bevel: 0.3, className: "tan", meta: { seated: true, cut: wallShapes["hero.wall.left"] } }));
  gs.push(`<g data-dyn="gate"></g>`);
  add(F.depthKey(g.v, 0), gs.join(""));
  // front post + front crossbar part seated in the front wall piece (drawn after it)
  const gf = [];
  gf.push(F.boxL(g.u - 4, g.v + 5, 2.4, 3, 13, 6, { r: 0.4, bevel: 0.2, className: "steel", meta: { seated: true, cut: wallShapes["hero.wall.front"] } }));
  gf.push(F.boxL(g.u - 4.6, g.v + 5, 3.6, 3, 19, 2, { r: 0.5, bevel: 0.3, className: "tan", meta: { seated: true, cut: wallShapes["hero.wall.front"] } }));
  add(10001, gf.join(""));

  // ---- glycolysis splitter ----
  const sp = GEO.split;
  const ss = [];
  ss.push(F.boxL(sp.u, sp.v, sp.w, sp.d, 7, sp.h, { r: 1, bevel: 0.4, className: "warm" }));
  ss.push(F.boxL(sp.u + 2.2, sp.v + 2.2, sp.w - 4.4, sp.d - 4.4, 7 + sp.h, 0.7, { r: 0.6, bevel: 0.1, className: "dark", crease: "none" }));
  const M3 = planeM(F.W3(sp.u + 1, sp.v + sp.d + 0.01, 7 + 5.6), [F.Uvec[0], F.Uvec[1], 0], [0, 0, -1]);
  ss.push(`<g transform="${M3}"><rect x="0" y="0" width="${sp.w - 2}" height="3.4" rx=".5" fill="#fffdf6" class="ink" style="stroke-width:.4px"/><text class="txt" x="${(sp.w - 2) / 2}" y="2.35" text-anchor="middle" style="font-size:1.8px;font-weight:700">GLYCOLYSIS</text></g>`);
  ss.push(`<g data-dyn="split"></g>`);
  // exit chute + conveyor to the wheel
  ss.push(F.boxL(sp.u + sp.w, sp.v + 3.2, 12, 3.6, 7, 1.4, { r: 0.4, bevel: 0.1, className: "brown", crease: "none" }));
  add(F.depthKey(sp.v + 3, 0), ss.join(""));

  // ---- cable car line (pylons + cable); carriage is dynamic ----
  const c = GEO.car;
  const cb = [];
  for (const [i, u] of [c.u0, c.u1].entries()) {
    // the u1 pylon stands on the turbine base top (z 9.2): its floor plate is buried in that base, so start the leg there
    const zBase = i === 1 ? 9.4 : 8.2;
    cb.push(F.boxL(u - 1.2, c.v - 1.2, 2.4, 2.4, zBase, c.zCable - zBase, { r: 0.5, bevel: 0.2, className: "steel" }));
    if (i === 0) cb.push(F.boxL(u - 2.6, c.v - 2.6, 5.2, 5.2, 7, 1.2, { r: 0.5, bevel: 0.2, className: "tan" }));
    cb.push(F.boxL(u - 2.2, c.v - 1.2, 4.4, 2.4, c.zCable, 1.4, { r: 0.4, bevel: 0.15, className: "steel" }));
  }
  const a0 = at(F.W3(c.u0, c.v, c.zCable + 0.7)), a1 = at(F.W3(c.u1, c.v, c.zCable + 0.7));
  cb.push(`<path d="${O.pathOf([a0, a1])}" class="ink" style="stroke-width:1.1px"/>`);
  cb.push(`<path d="${O.pathOf([at(F.W3(c.u0, c.v, c.zCable - 0.2)), at(F.W3(c.u1, c.v, c.zCable - 0.2))])}" class="ink3" style="stroke-width:.5px"/>`);
  cb.push(`<g data-dyn="car"></g>`);
  add(F.depthKey(c.v, 14), cb.join(""));

  // ---- O2 bottle + tap + beaker ----
  const o2 = GEO.o2, bk = GEO.beaker;
  const ob = [];
  ob.push(F.cylW(o2.u, o2.v, 3.4, 7, 15, { className: "steel", steps: 22, bevel: 0.4 }));
  ob.push(F.cylW(o2.u, o2.v, 1.6, 22, 1.6, { className: "tan", steps: 14 }));
  ob.push(F.cylW(o2.u, o2.v, 0.9, 23.6, 1.6, { className: "mari", steps: 10, crease: "none" }));
  const M4 = planeM(F.W3(o2.u - 2.5, o2.v + 0.0, 19), [F.Uvec[0], F.Uvec[1], 0], [0, 0, -1]);
  ob.push(Ln(k.sideArc(F.Wxy(o2.u, o2.v)[0], F.Wxy(o2.u, o2.v)[1], 3.4, 17.5, P, 14), { tone: "faint" }));
  add(F.depthKey(o2.v, 0), ob.join(""));
  const bs = [];
  {
    const p = F.Wxy(bk.u, bk.v);
    noteShape(A.cylinder(p[0], p[1], 3.0, 7, 0.6, { name: "hero.beaker.base", seated: true, cut: turbBaseShape }));
    bs.push(S(k.cylinder(p[0], p[1], 3.0, 7, 0.6, P, 20, 0.1), { tone: "hi", className: "tan" }));
    const gl = G.frameAlong([p[0], p[1], 7.6], [0, 0, 1]);
    bs.push(`<path d="${O.pathOf([at([p[0] - 3.4, p[1] + 3.4, 8]), at([p[0] - 3.4, p[1] + 3.4, 17])].concat([]))}" class="ink3" style="stroke-width:.5px;opacity:0"/>`);
    bs.push(`<g data-dyn="beaker"></g>`);
  }
  add(F.depthKey(bk.v, 0), bs.join(""));

  // the tank hangs on the back wall: same assembly (ride with its host), before stamping the other seats
  const tankRef = HR.solids.find((s) => s.name === "hero.tank");
  const wallBackRef = wallShapes["hero.wall.back"];
  if (tankRef && wallBackRef) tankRef.ride = wallBackRef.ride ?? wallBackRef.piece;
  // seated pads ride with their hosts (a saddle belongs to its host's assembly)
  for (const s of HR.solids) if (s.seated && s.cut) for (const host of [s.cut].flat()) { const hp = host.ride ?? host.piece; if (hp) s.ride = hp; }

  items.sort((a, b) => a.key - b.key);
  return items;
}
const FLOOR_Z = () => 7;
