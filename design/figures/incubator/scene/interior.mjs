// Incubator interior: cavity walls, shelf, ceiling lamp, standing thermometer (CrucibleTemp), petri dish (vessel + agar).
import { k, G, P, S, Ln, Dm, at, r1, pathOf, XF, Z, WIN, CAV, DISH, AGAR_Z, planeM, bbAdd, bbBox3, bbCircleH, item, slabS, cylS, rec, frontM } from "../ctx.mjs";

const RAD = Math.PI / 180;
const NEAR = P.azimuth * RAD;                       // direction toward the viewer, in the floor plane
/** Points on a horizontal circle between two angles. */
export function arcPts(cx, cy, r, z, a0, a1, n = 40, Pr = P) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push(k.iso([cx + r * Math.cos(a), cy + r * Math.sin(a), z], Pr)); }
  return pts;
}
export const nearArc = (cx, cy, r, z, n = 40, Pr = P) => arcPts(cx, cy, r, z, NEAR - Math.PI / 2, NEAR + Math.PI / 2, n, Pr);
export const farArc = (cx, cy, r, z, n = 40, Pr = P) => arcPts(cx, cy, r, z, NEAR + Math.PI / 2, NEAR + (3 * Math.PI) / 2, n, Pr);

/** Cavity walls (drawn first inside the window clip). */
export function cavity() {
  const p = [];
  const y0 = WIN.y0 - 4, y1 = WIN.y1 + 4, z0 = Z.win0 - 2, z1 = Z.win1 + 6, xb = CAV.x0;
  const poly = (pts) => pathOf(pts.map(at), true);
  p.push(`<path class="cav-b" d="${poly([[xb, y0, z0], [xb, y1, z0], [xb, y1, z1], [xb, y0, z1]])}"/>`);
  p.push(`<path class="cav-r" d="${poly([[xb, y0, z0], [XF + 4, y0, z0], [XF + 4, y0, z1], [xb, y0, z1]])}"/>`);
  p.push(`<path class="cav-f" d="${poly([[xb, y0, z0], [XF + 4, y0, z0], [XF + 4, y1, z0], [xb, y1, z0]])}"/>`);
  // back wall: perforated panel grid + two faint rails
  const dots = [];
  for (let z = Z.win0 + 10; z < Z.win1; z += 9) for (let y = -96; y <= 96; y += 9) dots.push(at([xb, y, z]));
  p.push(Dm(dots, { size: 0.5, tone: "lo" }));
  p.push(Ln(pathOf([at([xb, y0, Z.win0 + 28]), at([xb, y1, Z.win0 + 28])]) + pathOf([at([xb, y0, Z.win1 - 24]), at([xb, y1, Z.win1 - 24])]), { tone: "faint" }));
  // right wall: shelf rail + rivets
  p.push(Ln(pathOf([at([xb, y0, Z.win0 + 6]), at([XF + 4, y0, Z.win0 + 6])]), { tone: "faint" }));
  p.push(Ln(pathOf([at([xb, y0, z0]), at([xb, y0, z1])]) + pathOf([at([xb, y0, z0]), at([xb, y1, z0])]), { tone: "mid" }));
  return p.join("");
}

/** Shelf (the tray the dish sits on). */
export function shelf() {
  const p = [];
  const sh = { x: 38, y: -96, w: 128, d: 192, r: 6 };
  p.push(S(k.slabOf(sh, Z.win0, 6, P, 6, 0.8), { tone: "hi", className: "bone", crease: "lo" }));
  // front slots (closed, rooted on the shelf edge)
  const sl = [];
  for (let y = -84; y <= 84; y += 16) sl.push(k.lineOnTop([sh.x + sh.w - 7, y - 4], [sh.x + sh.w - 7, y + 4], Z.win0 + 6, P));
  p.push(Ln(sl.join(""), { tone: "mid" }));
  item("shelf", [slabS(sh, Z.win0, 6, "shelf", { ground: true })]);
  return p.join("");
}

/** Ceiling lamp (marigold) and its soft beam toward the dish. */
export function lamp() {
  const p = [];
  const l = { x: 112, y: -44, w: 50, d: 88, r: 7 };
  const z0 = Z.win1 - 8;
  // beam: translucent trapezoid from the lamp underside to the dish rim
  const top = [[l.x + 8, l.y + 8, z0], [l.x + l.w - 8, l.y + 8, z0], [l.x + l.w - 8, l.y + l.d - 8, z0], [l.x + 8, l.y + l.d - 8, z0]];
  const beam = [at([top[0][0], top[0][1], z0]), at([top[3][0], top[3][1], z0]), at([DISH.cx - DISH.r + 2, DISH.cy + DISH.r - 6, AGAR_Z]), at([DISH.cx + 20, DISH.cy - DISH.r, AGAR_Z])];
  p.push(`<path class="beam" d="${pathOf(beam, true)}"/>`);
  p.push(S(k.slabOf(l, z0, 8, P, 6, 0.6), { tone: "hi", className: "mari", crease: "lo" }));
  p.push(Ln(k.planOutline(k.insetPlan(l, 4), z0, P, 6), { tone: "lo" }));
  item("lamp", [slabS(l, z0, 8, "lamp")]);
  return p.join("");
}

/** Thermometer = CrucibleTemp dial: standing scale plate, glass tube with marigold mercury, three zone bands, needle. */
export function thermo() {
  const p = [];
  const xp = 140, y0 = -97, y1 = -74, zb = Z.win0 + 6, zt = 192;
  const plan = { x: xp - 4, y: y0, w: 4, d: y1 - y0, r: 1.5 };
  const F = (y, z) => at([xp, y, z]);
  const fp = (pts) => pathOf(pts.map(([y, z]) => F(y, z)), true);
  const rr = (a, b, c, d, rad = 1.2) => {
    const pts = [];
    const n = 4;
    const arc = (cu, cv, a0) => { for (let i = 0; i <= n; i++) { const a_ = a0 + (i / n) * (Math.PI / 2); pts.push([cu + rad * Math.cos(a_), cv + rad * Math.sin(a_)]); } };
    arc(b - rad, d - rad, 0); arc(a + rad, d - rad, Math.PI / 2); arc(a + rad, c + rad, Math.PI); arc(b - rad, c + rad, Math.PI * 1.5);
    return pts;
  };
  // stand foot + plate
  p.push(S(k.cylinder(xp - 2, (y0 + y1) / 2, 11.4, zb, 3, P, 24, 0.5), { tone: "hi", className: "steel" }));
  p.push(S(k.slabOf(plan, zb + 3, zt - zb - 3, P, 4, 0.5), { tone: "hi", className: "bone", crease: "lo" }));
  // zone bands (Famine / Normal / Frenzy) on the plate face
  const zy0 = -79, zy1 = -73;
  const zones = [["zone-famine", zb + 10, zb + 34, "#d8c399"], ["zone-normal", zb + 34, zb + 58, "#fffdf8"], ["zone-frenzy", zb + 58, zt - 8, "#ffd57a"]];
  for (const [id, a, b, col] of zones) p.push(`<path id="${id}" class="f-zone" style="fill:${col}" d="${fp(rr(zy0, zy1, a, b, 0.6))}"/>`);
  // tube slot + mercury + bulb
  p.push(`<path class="f-dk" d="${fp(rr(-91.5, -83.5, zb + 8, zt - 6, 3.4))}"/>`);
  p.push(`<path class="f-glassy" d="${fp(rr(-90.5, -84.5, zb + 9, zt - 7, 2.6))}"/>`);
  p.push(`<path id="thermo-fill" class="f-mari" d="${fp(rr(-89.5, -85.5, zb + 8, zb + 90, 1.8))}"/>`);
  p.push(S(G.sphereOf([xp + 2, -87.5, zb + 8], 6.4, P), { tone: "hi", className: "mari" }));
  // ticks on the left of the tube
  const tk = [];
  for (let z = zb + 14, i = 0; z < zt - 8; z += 4, i++) tk.push(pathOf([F(-97, z), F(i % 5 === 0 ? -93 : -95, z)]));
  p.push(Ln(tk.join(""), { tone: "mid" }));
  // needle (marigold pointer on the zone bar)
  p.push(`<path id="thermo-pointer" class="f-mari" d="${fp([[-72, zb + 46], [-77, zb + 43], [-77, zb + 49]])}"/>`);
  bbBox3("ch-thermo", xp - 4, xp + 4, y0, y1, zb, zt);
  item("thermo", [cylS(xp - 2, (y0 + y1) / 2, 11.4, zb, 3, "thermo.foot", { ground: false }), slabS(plan, zb + 3, zt - zb - 3, "thermo.plate")]);
  return p.join("");
}

/** Petri dish vessel pieces. back = everything behind the colony, front = glass wall in front of it. */
export function dish() {
  const { cx, cy, r, z } = DISH;
  const top = z + 18;
  const back = [], front = [];
  // bottom plate + agar disc
  back.push(S(k.cylinder(cx, cy, r, z, 3, P, 72, 0.6), { tone: "hi", className: "bone", crease: "lo" }));
  back.push(S(k.cylinder(cx, cy, r - 3.2, z + 3, 6, P, 72, 0.4), { tone: "hi", className: "agar", crease: "none" }));
  // agar surface: contour ring + grain
  back.push(Ln(k.ring(cx, cy, r - 9, AGAR_Z, P, 72), { tone: "faint" }));
  const rnd = mulberry(11);
  const grain = [];
  for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (r - 8); grain.push(at([cx + rr * Math.cos(a), cy + rr * Math.sin(a), AGAR_Z])); }
  back.push(Dm(grain, { size: 0.55, tone: "lo" }));
  // far half of the glass rim (behind the colony)
  back.push(`<path class="glass-edge-b" d="${pathOf(farArc(cx, cy, r, top))}"/>`);
  back.push(`<path class="glass-edge-b" d="${pathOf(farArc(cx, cy, r - 1.8, top))}" opacity=".6"/>`);
  // near glass wall: translucent fill, edges, highlights
  const wallTop = nearArc(cx, cy, r, top, 48), wallBot = nearArc(cx, cy, r, z, 48).reverse();
  front.push(`<path class="glass-fill-b" d="${pathOf([...wallTop, ...wallBot], true)}"/>`);
  front.push(`<path class="glass-edge" d="${pathOf(wallTop)}"/>`);
  front.push(`<path class="glass-edge" d="${pathOf(nearArc(cx, cy, r - 1.8, top, 48))}" opacity=".6"/>`);
  front.push(`<path class="glass-edge" d="${pathOf(wallBot.slice().reverse())}"/>`);
  front.push(`<path class="glass-edge" d="${pathOf([at([cx + r * Math.cos(NEAR - Math.PI / 2), cy + r * Math.sin(NEAR - Math.PI / 2), z]), at([cx + r * Math.cos(NEAR - Math.PI / 2), cy + r * Math.sin(NEAR - Math.PI / 2), top])])}"/>`);
  front.push(`<path class="glass-edge" d="${pathOf([at([cx + r * Math.cos(NEAR + Math.PI / 2), cy + r * Math.sin(NEAR + Math.PI / 2), z]), at([cx + r * Math.cos(NEAR + Math.PI / 2), cy + r * Math.sin(NEAR + Math.PI / 2), top])])}"/>`);
  const hl = (a, w, id) => {
    const q = (aa, zz) => at([cx + (r - 0.6) * Math.cos(aa), cy + (r - 0.6) * Math.sin(aa), zz]);
    return `<path fill="url(#${id})" d="${pathOf([q(a - w, z + 1.5), q(a - w, top - 1.5), q(a + w, top - 1.5), q(a + w, z + 1.5)], true)}"/>`;
  };
  front.push(hl(NEAR + 0.72, 0.07, "gl-v"), hl(NEAR + 0.28, 0.03, "gl-v2"));
  // dish rim lip (thin tan collar at the bottom) already in the base; foot ring on the shelf
  bbCircleH("ch-dish", [cx, cy, z], r + 2);
  bbCircleH("ch-dish", [cx, cy, top], r + 2);
  item("dish", [cylS(cx, cy, r, z, 3, "dish.base"), cylS(cx, cy, r - 3.2, z + 3, 6, "dish.agar")]);
  return { back: back.join(""), front: front.join("") };
}

export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
