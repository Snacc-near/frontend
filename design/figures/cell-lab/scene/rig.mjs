// The rig around the cell: ATP dial gauge, glass ATP tube, instrument panel (gauges), thermometer, receipt printer,
// feed hopper, enclave safe (frosted window), output shelf, cable runs with connectors.
import { k, G, O, P, S, Ln, Dm, at, f1, planeM, dep, wallYM, floorM, PLATE, CELLC } from "../ctx.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import * as F from "./frame.mjs";
import { GEO } from "./mito.mjs";

export const DIAL = { x: 150, y: -73 };
export const DIAL_R = 17, DIAL_Z = 10, DIAL_H = 10, DIAL_TOP = DIAL_Z + DIAL_H;
const headTop = F.W3(GEO.turb.u, GEO.turb.v, GEO.turb.zf1 + 11);
export const ATP_ROUTE = G.fillet([[headTop[0], headTop[1], headTop[2]], [headTop[0], headTop[1], 66], [DIAL.x - 4, DIAL.y + 4 + 0, 66], [DIAL.x - 4, DIAL.y + 4, DIAL_TOP + 2]], 6, 8, { P, tube: 2.4 });
const box = (x, y, w, d, z, h, o = {}) => S(k.slabOf({ x, y, w, d, r: o.r ?? 1 }, z, h, P, o.steps ?? 4, o.bevel ?? 0.4), { tone: o.tone || "hi", className: o.cls || "", crease: o.crease || "faint" });
const cyl = (x, y, r, z, h, o = {}) => S(k.cylinder(x, y, r, z, h, P, o.steps ?? 24, o.bevel ?? 0.3), { tone: o.tone || "hi", className: o.cls || "", crease: o.crease || "faint" });
const text = (M, str, x, y, size = 2.2, cls = "txt", anchor = "start") => `<g transform="${M}"><text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px">${str}</text></g>`;

/** Dial face art on the top plane (u right = +x, v = +y). Returns { svg, needleAt(turn) } */
function dialFace(cx, cy, z, R) {
  const o = [];
  const M = floorM(cx, cy, z);
  // numerals 0..100 in steps of 20 around a 270 degree arc, ticks via kit
  const t = k.radialTicks(cx, cy, R - 1.6, 50, 5, z, [1.0, 2.0], P, (-135 * Math.PI) / 180 + Math.PI, (270 * Math.PI) / 180);
  o.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "hi" }));
  // numerals
  let nums = "";
  for (let i = 0; i <= 5; i++) {
    const a = ((-135 + i * 54) * Math.PI) / 180;
    // dial angle 0 = up (-y); clockwise: x = sin(a), y = -cos(a)
    const rx = Math.sin(a) * (R - 5.4), ry = -Math.cos(a) * (R - 5.4);
    nums += `<text class="txt-l" x="${f1(rx)}" y="${f1(ry + 0.7)}" text-anchor="middle" style="font-size:2.1px">${i * 20}</text>`;
  }
  o.push(`<g transform="${M}">${nums}<text class="txt" x="0" y="${f1(R * 0.5)}" text-anchor="middle" style="font-size:2.6px;font-weight:700;letter-spacing:.2em">ATP</text></g>`);
  // marigold zone arc (high balance)
  const arc = [];
  for (let i = 0; i <= 14; i++) { const a = ((-135 + 216 + i * (54 / 14)) * Math.PI) / 180; arc.push(at([cx + Math.sin(a) * (R - 2.6), cy - Math.cos(a) * (R - 2.6), z])); }
  o.push(`<path d="${O.pathOf(arc)}" fill="none" style="stroke:#f8aa06;stroke-width:2.2px;stroke-linecap:butt"/>`);
  return o.join("");
}

export function rig() {
  const out = [];
  const add = (key, svg, name) => out.push({ key, svg, name });

  // ================= ATP dial gauge on a pedestal =================
  {
    const d = [];
    d.push(`<path class="shadow-flat" transform="translate(-10 9)" d="${k.slabOf({ x: DIAL.x - 19, y: DIAL.y - 19, w: 38, d: 38, r: 4 }, 0, 10, P, 4, 0).fill}"/>`);
    d.push(box(DIAL.x - 19, DIAL.y - 19, 38, 38, 0, 5, { r: 3, bevel: 0.6, cls: "tan" }));
    d.push(box(DIAL.x - 16, DIAL.y - 16, 32, 32, 5, 5, { r: 3, bevel: 0.5 }));
    d.push(Dm(k.corners({ x: DIAL.x - 19, y: DIAL.y - 19, w: 38, d: 38 }, 3).map(([x, y]) => at([x, y, 5])), { size: 0.55, tone: "hi" }));
    // puck, bezel, knurl
    d.push(S(k.cylinder(DIAL.x, DIAL.y, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", className: "bone", crease: "lo" }));
    d.push(Ln(k.knurl(DIAL.x, DIAL.y, DIAL_R, DIAL_TOP - 3.4, DIAL_TOP, 72, P, 0.1), { tone: "lo" }));
    d.push(Ln(k.sideArc(DIAL.x, DIAL.y, DIAL_R, DIAL_TOP - 3.4, P, 40), { tone: "faint" }));
    d.push(Ln(k.ring(DIAL.x, DIAL.y, DIAL_R - 2.2, DIAL_TOP, P, 56), { tone: "hi" }));
    d.push(`<path d="${O.pathOf(O.ellipse3([DIAL.x, DIAL.y, DIAL_TOP], [1, 0, 0], [0, 1, 0], DIAL_R - 2.3, DIAL_R - 2.3, P, { steps: 56 }), true)}" fill="#fffdf6" stroke="none"/>`);
    d.push(dialFace(DIAL.x, DIAL.y, DIAL_TOP, DIAL_R));
    d.push(`<g data-dyn="needle"></g>`);
    // counter window on the front face of the base
    const cw = { x: DIAL.x - 8, y: DIAL.y + 16, w: 16, d: 0.6 };
    d.push(`<g data-dyn="counter"></g>`);
    // input port housing at the rear (tube lands here)
    d.push(cyl(DIAL.x - 4, DIAL.y + 4, 3.2, DIAL_TOP, 2.2, { cls: "steel", steps: 20 }));
    // crown knobs on the right
    d.push(box(DIAL.x + DIAL_R - 1, DIAL.y - 2.4, 5, 4.8, DIAL_Z + 2, 5, { r: 1.2, bevel: 0.3 }));
    add(dep(DIAL.x, DIAL.y, 10), d.join(""), "dial");
  }

  // ================= instrument panel (vertical board on the back edge) =================
  {
    const px = -26, py = -105, pw = 74, pz = 6, ph = 34;
    const p = [];
    p.push(`<path class="shadow-flat" transform="translate(-8 8)" d="${k.slabOf({ x: px, y: py, w: pw, d: 4, r: 1 }, 0, 6, P, 3, 0).fill}"/>`);
    p.push(box(px - 2, py - 2, pw + 4, 8, 0, 4, { r: 1.5, bevel: 0.4, cls: "tan" }));
    p.push(box(px, py, pw, 3.4, 4, ph, { r: 1.2, bevel: 0.5, cls: "bone" }));
    // face plane on the +y face: u = +x, v = down; origin at (px, py+3.4, 4+ph)
    const M = planeM([px, py + 3.4, 4 + ph], [1, 0, 0], [0, 0, -1]);
    const g = [];
    g.push(`<g transform="${M}">`);
    const gauge = (cx, cy, r, name, lo, hi, needle, unit) => {
      let tk = "";
      for (let i = 0; i <= 10; i++) { const a = ((-135 + i * 27) * Math.PI) / 180; const r0 = r * 0.72, r1 = i % 5 ? r * 0.84 : r * 0.9; tk += `M${f1(cx + Math.sin(a) * r0)} ${f1(cy - Math.cos(a) * r0)}L${f1(cx + Math.sin(a) * r1)} ${f1(cy - Math.cos(a) * r1)}`; }
      const na = ((-135 + needle * 270) * Math.PI) / 180;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" class="f-tan" style="stroke-width:.9px"/><circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="#fffdf6" class="ink" style="stroke-width:.5px"/><path d="${tk}" class="ink2" style="stroke-width:.4px"/>` +
        `<path data-needle="${name}" d="M${cx} ${cy}L${f1(cx + Math.sin(na) * r * 0.74)} ${f1(cy - Math.cos(na) * r * 0.74)}" class="ink" style="stroke:#f8aa06;stroke-width:1px"/><circle cx="${cx}" cy="${cy}" r=".9" class="inkf"/>` +
        `<text class="txt" x="${cx}" y="${f1(cy + r * 0.52)}" text-anchor="middle" style="font-size:1.7px;font-weight:700">${name}</text><text class="txt-l" x="${cx}" y="${f1(cy + r * 0.72)}" text-anchor="middle" style="font-size:1.25px">${unit}</text>` +
        `<text class="txt-l" x="${f1(cx - r * 0.78)}" y="${f1(cy + r * 0.86)}" text-anchor="middle" style="font-size:1.2px">${lo}</text><text class="txt-l" x="${f1(cx + r * 0.78)}" y="${f1(cy + r * 0.86)}" text-anchor="middle" style="font-size:1.2px">${hi}</text>`;
    };
    g.push(gauge(10, 17, 8, "pH", "3", "8", 0.34, "vat"));
    g.push(gauge(29, 17, 8, "TURGOR", "0", "100", 0.5, "kPa"));
    g.push(gauge(48, 17, 8, "BMR", "0", "bps", 0.42, "burn"));
    g.push(gauge(65, 17, 7, "TEMP", "590", "620", 0.52, "600/610"));
    // lamps row: attested lamp + generation counter
    g.push(`<rect x="3" y="28" width="10" height="3.4" rx="1" fill="#fffdf6" class="ink" style="stroke-width:.5px"/><circle data-lamp="attest" cx="5.4" cy="29.7" r="1.1" class="f-dk"/><text class="txt-l" x="8" y="30.7" style="font-size:1.3px">attest</text>`);
    g.push(`<rect x="16" y="28" width="12" height="3.4" rx="1" fill="#fffdf6" class="ink" style="stroke-width:.5px"/><text class="txt-l" x="17.4" y="30.4" style="font-size:1.3px">GEN</text><text data-gen class="txt" x="25" y="30.5" style="font-size:2px;font-weight:700">0</text>`);
    g.push(`<rect x="31" y="28" width="28" height="3.4" rx="1" fill="#fffdf6" class="ink" style="stroke-width:.5px"/><text class="txt-l" x="32.4" y="30.4" style="font-size:1.3px">CrucibleTemp 600 / 610</text>`);
    g.push(`</g>`);
    p.push(g.join(""));
    // screws
    p.push(Dm([[px + 2.4, 4 + ph - 2.4], [px + pw - 2.4, 4 + ph - 2.4], [px + 2.4, 6.4], [px + pw - 2.4, 6.4]].map(([x, z]) => at([x, py + 3.5, z])), { size: 0.55, tone: "hi" }));
    add(dep(px + pw / 2, py + 2, 8), p.join(""), "panel");
  }

  // ================= thermometer column (CrucibleTemp) =================
  {
    const tx = -8, ty = -66;
    const t = [];
    t.push(box(tx - 5, ty - 5, 10, 10, 0, 4, { r: 2, bevel: 0.4, cls: "tan" }));
    t.push(cyl(tx, ty, 3.8, 4, 3, { cls: "steel" }));
    // glass tube with mercury (marigold) level: tube is a lathe capsule
    const Fr = G.frameAlong([tx, ty, 7], [0, 0, 1]);
    const prof = [[0, 0.01], [0.6, 2.2, 1], [1.6, 2.6, 1], [34, 2.6], [35.4, 2.0, 1], [36, 0.01]];
    t.push(S(G.lathe(prof, Fr, P, { steps: 20, fill: "hull" }), { tone: "hi", className: "bone", crease: "none" }));
    t.push(`<g data-dyn="mercury"></g>`);
    // ticks + 600 / 610 plates
    for (let i = 0; i <= 12; i++) t.push(Dm([at([tx - 2.7, ty + 2.7, 12 + i * 2])], { size: i % 4 ? 0.3 : 0.55, tone: "hi" }));
    t.push(box(tx - 5.8, ty - 1.6, 3.2, 3.2, 24, 1.4, { r: 0.4, bevel: 0.1, cls: "mari", crease: "none" }));
    t.push(box(tx - 5.8, ty - 1.6, 3.2, 3.2, 31, 1.4, { r: 0.4, bevel: 0.1, cls: "ember", crease: "none" }));
    t.push(`<g transform="${wallYM(tx - 8, ty + 2.6, 26)}"><text class="txt" x="0" y="0" style="font-size:2.1px">600</text></g>`);
    add(dep(tx, ty, 20), t.join(""), "thermometer");
  }

  // ================= feed hopper + chute into the chamber =================
  {
    const hx = -150, hy = 55;
    const h = [];
    h.push(`<path class="shadow-flat" transform="translate(-8 8)" d="${k.slabOf({ x: hx - 12, y: hy - 12, w: 24, d: 24, r: 2 }, 0, 8, P, 3, 0).fill}"/>`);
    h.push(box(hx - 13, hy - 13, 26, 26, 0, 5, { r: 2, bevel: 0.4, cls: "tan" }));
    for (const [dx, dy] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) h.push(box(hx + dx - 1.4, hy + dy - 1.4, 2.8, 2.8, 5, 18, { r: 0.5, bevel: 0.2, cls: "steel" }));
    const Fr = G.frameAlong([hx, hy, 23], [0, 0, 1]);
    const prof = [[0, 3.2], [0, 3.2], [0.01, 3.2, 0], [6, 10, 1], [16, 12.5, 1]];
    h.push(S(G.lathe([[0, 3.2], [8, 11, 1], [16, 12.6, 1], [16, 0.01]], Fr, P, { steps: 36, fill: "hull" }), { tone: "hi", className: "bone", crease: "faint" }));
    h.push(Ln(k.sideArc(hx, hy, 12.6, 38, P, 30), { tone: "faint" }));
    h.push(S(k.cylinder(hx, hy, 11.6, 38.4, 0.8, P, 36, 0.1), { tone: "hi", className: "cyto", crease: "none" }));
    // pellets (marigold) in the hopper
    for (const [dx, dy] of [[-4, -2], [2, 3], [4, -4], [-2, 4], [0, -1]]) h.push(`<g class="mari">${S(G.sphereOf([hx + dx, hy + dy, 39.6], 1.5, P), { tone: "hi" })}</g>`);
    // label plate
    h.push(box(hx - 7, hy + 10, 14, 5, 0, 0.9, { r: 1, bevel: 0.1, cls: "warm" }));
    h.push(`<g transform="${floorM(hx - 5.6, hy + 13.4, 1)}"><text class="txt" x="0" y="0" style="font-size:2.4px;font-weight:700">FEED</text></g>`);
    add(dep(hx, hy, 20), h.join(""), "hopper");
  }

  // ================= feed chute (hopper spout -> collar port) =================
  {
    const p = FEED_ROUTE;
    const t = tubePieces(p, 1.9, P, { maxLength: 24 }).map((q) => tubeSvg(q, { tone: "hi" })).join("");
    const flange = cyl(FEED_PORT[0], FEED_PORT[1], 4.4, 9, 5.5, { cls: "steel", steps: 20 });
    add(dep(FEED_PORT[0], FEED_PORT[1], 10) + 0.5, `<g class="bone">${t}</g>` + flange + Dm([at([FEED_PORT[0], FEED_PORT[1], 14.6])], { size: 0.5 }), "feed-chute");
  }

  // ================= receipt printer (thesis) =================
  {
    const px = -66, py = 52;
    const r = [];
    r.push(`<path class="shadow-flat" transform="translate(-9 9)" d="${k.slabOf({ x: px, y: py, w: 40, d: 28, r: 3 }, 0, 12, P, 4, 0).fill}"/>`);
    r.push(box(px, py, 40, 28, 0, 5, { r: 3, bevel: 0.5, cls: "tan" }));
    r.push(box(px + 2, py + 2, 36, 24, 5, 8, { r: 2.5, bevel: 0.5, cls: "bone" }));
    r.push(box(px + 5, py + 4, 30, 5, 13, 1.6, { r: 1, bevel: 0.3, cls: "dark" }));        // paper slot
    r.push(`<g data-dyn="receipt"></g>`);
    r.push(box(px + 3, py + 14, 6, 6, 13, 1.2, { r: 1, bevel: 0.2, cls: "mari" }));         // feed button
    r.push(cyl(px + 31, py + 17, 3.2, 13, 2, { cls: "steel", steps: 18 }));
    r.push(Dm([at([px + 6, py + 17, 14.2]), at([px + 12, py + 17, 14.2])], { size: 0.55, tone: "hi" }));
    r.push(`<g transform="${wallYM(px + 4, py + 28.01, 11)}"><rect x="0" y="0" width="32" height="4.4" rx=".8" fill="#fffdf6" class="ink" style="stroke-width:.5px"/><text class="txt" x="2" y="3" style="font-size:2.2px;font-weight:700">THESIS · RECEIPT</text></g>`);
    add(dep(px + 20, py + 14, 8), r.join(""), "printer");
  }

  // ================= enclave safe with frosted window =================
  {
    const ex = -172, ey = -2, ew = 24, ed = 26, eh = 24;
    const e = [];
    e.push(`<path class="shadow-flat" transform="translate(-8 8)" d="${k.slabOf({ x: ex, y: ey, w: ew, d: ed, r: 2 }, 0, 6, P, 3, 0).fill}"/>`);
    e.push(box(ex, ey, ew, ed, 0, 4, { r: 2, bevel: 0.4, cls: "tan" }));
    e.push(box(ex + 1.4, ey + 1.4, ew - 2.8, ed - 2.8, 4, eh, { r: 2, bevel: 0.6, cls: "bone" }));
    e.push(Ln(k.sideSeam({ x: ex + 1.4, y: ey + 1.4, w: ew - 2.8, d: ed - 2.8, r: 2 }, 4 + eh * 0.55, P, 4), { tone: "faint" }));
    // frosted window on the +y face: silhouettes only
    const Mf = wallYM(ex + 3.5, ey + ed - 1.4 + 0.02, 4 + eh - 3);
    e.push(`<g transform="${Mf}"><defs><clipPath id="fw"><rect x="0" y="0" width="${ew - 9}" height="11" rx="1.2"/></clipPath><filter id="frost" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.1"/></filter></defs>` +
      `<rect x="-.8" y="-.8" width="${ew - 7.4}" height="12.6" rx="1.6" class="f-tan"/><rect x="0" y="0" width="${ew - 9}" height="11" rx="1.2" fill="#eef2f1" class="ink" style="stroke-width:.6px"/>` +
      `<g clip-path="url(#fw)"><g filter="url(#frost)" opacity=".75"><rect x="3" y="3" width="4" height="6.4" rx="2" fill="#6a5e48"/><rect x="9.5" y="5.4" width="6" height="3.6" rx="1.4" fill="#6a5e48"/><circle cx="12" cy="3.4" r="1.7" fill="#6a5e48"/></g><rect x="0" y="0" width="${ew - 9}" height="11" fill="#fff" opacity=".42"/></g>` +
      `<text class="txt-l" x="1.4" y="14.6" style="font-size:1.5px">ENCLAVE · NEAR AI TEE</text></g>`);
    // inspector probe lamp on the roof
    e.push(cyl(ex + ew - 6, ey + 6, 1.5, 4 + eh, 6, { cls: "steel", steps: 14 }));
    e.push(`<g data-dyn="probe">${cyl(ex + ew - 6, ey + 6, 2.6, 4 + eh + 6, 3.2, { cls: "dark", steps: 16 })}</g>`);
    // pneumatic tube port on the roof
    e.push(cyl(ex + 6, ey + 6, 2.6, 4 + eh, 2, { cls: "tan", steps: 14 }));
    add(dep(ex + ew / 2, ey + ed / 2, 10), e.join(""), "enclave");
  }

  // ================= output shelf: spore bays (ember / ice / glow) + elixir rack =================
  {
    const sx = 112, sy = 50;
    const o = [];
    o.push(`<path class="shadow-flat" transform="translate(-9 9)" d="${k.slabOf({ x: sx, y: sy, w: 56, d: 24, r: 2.5 }, 0, 10, P, 4, 0).fill}"/>`);
    o.push(box(sx, sy, 56, 24, 0, 4, { r: 2.5, bevel: 0.5, cls: "tan" }));
    o.push(box(sx + 1.6, sy + 1.6, 52.8, 20.8, 4, 3, { r: 2, bevel: 0.4, cls: "bone" }));
    const bays = [["ember", "spore_ignis", "ember"], ["ice", "spore_cryo", "ice"], ["glow", "spore_lumin", "glow"]];
    bays.forEach(([cls, name, id], i) => {
      const bx = sx + 4 + i * 12.5;
      o.push(box(bx, sy + 4, 10.4, 14, 7, 1.1, { r: 1.4, bevel: 0.2, cls: "dark", crease: "none" }));
      o.push(`<g data-bay="${id}"></g>`);
      o.push(`<g transform="${floorM(bx + 0.8, sy + 21.6, 7.3)}"><text class="txt-l" x="0" y="0" style="font-size:1.45px">${name}</text></g>`);
    });
    // elixir vial rack (3 slots)
    for (let i = 0; i < 3; i++) o.push(cyl(sx + 44 + (i % 3) * 3.2, sy + 8 + i * 2, 1.3, 7, 6, { cls: "bone", steps: 12 }));
    o.push(`<g data-dyn="vials"></g>`);
    add(dep(sx + 28, sy + 12, 8), o.join(""), "output-shelf");
  }

  // ================= pneumatic tube: enclave roof -> bell jar wall port =================
  {
    const t = tubePieces(ATTEST_ROUTE, 1.7, P, { maxLength: 22 }).map((q) => tubeSvg(q, { tone: "hi" })).join("");
    const end = ATTEST_ROUTE[ATTEST_ROUTE.length - 1], prev = ATTEST_ROUTE[ATTEST_ROUTE.length - 2];
    const dir = G.unit3(G.sub3(end, prev));
    const fl = S(G.disc(-0.4, 1.4, 3.3, G.frameAlong(end, dir), P, { steps: 24 }), { tone: "hi", className: "steel" });
    add(dep(-160, 0, 20) + 0.7, `<g class="bone">${t}</g>` + fl, "attest-tube");
  }

  // ================= cable runs with connectors =================
  {
    const cable = (pts, r, key, name) => {
      const route = G.fillet(pts, 4, 6, { P, tube: r });
      const t = tubePieces(route, r, P, { maxLength: 20 }).map((q) => tubeSvg(q, { tone: "mid" })).join("");
      const conn = (p, q) => { const d = G.unit3(G.sub3(q, p)); return S(G.disc(-1.4, 1.6, 2.1, G.frameAlong(p, d), P, { steps: 16 }), { tone: "hi", className: "steel" }); };
      add(key, `<g class="dark">${t}</g>` + conn(route[0], route[3] || route[1]) + conn(route[route.length - 1], route[route.length - 4] || route[route.length - 2]), name);
    };
    cable([[50, -101, 2.6], [50, -90, 1.4], [110, -90, 1.4], [132, -80, 1.4], [134, -73, 4]], 0.9, dep(90, -90, 0) + 0.2, "cable-panel-dial");
    cable([[-24, 66, 9], [-12, 66, 1.4], [-6, 76, 1.4], [8, 78, 4]], 0.9, dep(-6, 70, 0) + 0.2, "cable-printer");
    cable([[-120, 20, 2], [-130, 30, 1.2], [-142, 40, 1.2], [-150, 52, 5]], 0.9, dep(-140, 40, 0) + 0.2, "cable-hopper");
  }

  // ================= ATP glass tube =================
  {
    const t = tubePieces(ATP_ROUTE, 2.4, P, { maxLength: 24 }).map((q) => tubeSvg(q, { tone: "hi" })).join("");
    add(dep(GEO.dial.x, GEO.dial.y, 0) + 3, `<g class="water">${t}</g>`, "atp-tube");
  }
  return out;
}

export const ATTEST_ROUTE = G.fillet([[-166, 4, 30], [-166, 4, 66], [-153.2 - 1.2, -3.2 + 0.7, 66]], 6, 7, { P, tube: 1.7 });
export const FEED_PORT =[CELLC[0] + 74 * Math.cos((122 * Math.PI) / 180), CELLC[1] + 74 * Math.sin((122 * Math.PI) / 180)];
export const FEED_ROUTE = G.fillet([[-150, 55, 24], [-150, 55, 14], [-150, FEED_PORT[1] + 1, 14], [FEED_PORT[0] - 4.6, FEED_PORT[1] + 1, 14]], 5, 7, { P, tube: 1.9 });
