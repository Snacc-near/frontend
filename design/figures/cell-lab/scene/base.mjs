// Base plate: flat dark-brown offset shadow, tan edge, cream deck, screws, groove, ruler, plates, vents, cable runs.
import { k, P, S, Ln, Dm, at, f1, emit, put, slabS, PLATE, PLATE_H, floorM, faceM, wallXM, wallYM, dep, A, rec } from "../ctx.mjs";

export function base() {
  const p = [];
  // flat dark-brown offset shadow (screen offset down-left), like the reference set
  const shadow = k.slabOf({ x: PLATE.x + 6, y: PLATE.y + 6, w: PLATE.w - 12, d: PLATE.d - 12, r: PLATE.r }, -PLATE_H, PLATE_H, P, 10, 0).fill;
  p.push(`<path class="shadow-flat" transform="translate(-34 30)" d="${shadow}"/>`);
  // tan slab with a cream deck: body slab (tan) then deck skin sitting on it
  p.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 10, 1.6), { tone: "hi", className: "tan", crease: "lo" }));
  // inset groove, seam
  p.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P, 10), { tone: "lo" }));
  p.push(Ln(k.planOutline(k.insetPlan(PLATE, 8), 0, P, 10), { tone: "faint" }));
  // corner screws with rings
  const sc = k.corners(PLATE, 12);
  p.push(Ln(sc.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }));
  p.push(Dm(sc.map(([x, y]) => at([x, y, 0])), { size: 0.7, tone: "hi" }));
  // mid-edge screws (front and right edge)
  const mid = [[0, PLATE.y + PLATE.d - 12], [PLATE.x + PLATE.w - 12, 0], [PLATE.x + 12, 0], [0, PLATE.y + 12]];
  p.push(Dm(mid.map(([x, y]) => at([x, y, 0])), { size: 0.55, tone: "hi" }));
  p.push(Ln(mid.map(([x, y]) => k.ring(x, y, 2.1, 0, P, 14)).join(""), { tone: "faint" }));
  // front ruler strip (cm ticks) rooted on its edge
  const strip = { x: -150, y: PLATE.y + PLATE.d - 24, w: 300, d: 8, r: 1 };
  p.push(S(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo", crease: "none", className: "bone" }));
  const tk = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 3, 5, strip.y, 0.8, [2.0, 3.6], P);
  p.push(Ln(tk.minor, { tone: "lo" }), Ln(tk.major, { tone: "mid" }));
  p.push(Dm([at([strip.x + 2, strip.y + 4, 0.8]), at([strip.x + strip.w - 2, strip.y + 4, 0.8])], { size: 0.5 }));
  // engraved ruler numerals on the strip
  const rm = floorM(strip.x + 4, strip.y + 5.6, 0.85);
  p.push(`<g transform="${rm}">${[0, 10, 20, 30, 40, 50, 60].map((n, i) => `<text class="txt-l" x="${i * 45 - 0.5}" y="0" style="font-size:1.9px">${n}</text>`).join("")}</g>`);
  // front-left label plate
  const lab = { x: PLATE.x + 14, y: PLATE.y + PLATE.d - 46, w: 66, d: 18, r: 2 };
  p.push(S(k.slabOf(lab, 0, 1.2, P, 4), { tone: "hi", className: "warm" }));
  p.push(Ln(k.planOutline(k.insetPlan(lab, 1.6), 1.2, P, 4), { tone: "faint" }));
  p.push(`<g transform="${floorM(lab.x + 5, lab.y + 7.4, 1.25)}"><text class="txt" x="0" y="0" style="font-size:4.4px;font-weight:700">CELL LAB</text><text class="txt-l" x="0" y="5.2" style="font-size:2.2px">SNACC-01 · BIO-REACTOR</text></g>`);
  p.push(Dm([at([lab.x + 3, lab.y + 3, 1.2]), at([lab.x + lab.w - 3, lab.y + 3, 1.2]), at([lab.x + 3, lab.y + lab.d - 3, 1.2]), at([lab.x + lab.w - 3, lab.y + lab.d - 3, 1.2])], { size: 0.5 }));
  // right-edge vent bank (closed slots) and a second plate
  for (let i = 0; i < 6; i++) {
    const v = { x: PLATE.x + PLATE.w - 36, y: PLATE.y + 18 + i * 6.4, w: 20, d: 2.6, r: 1.2 };
    p.push(S(k.slabOf(v, 0, 0.5, P, 3), { tone: "lo", crease: "none", className: "dark" }));
  }
  // back-left plate: sample id
  const id = { x: PLATE.x + 16, y: PLATE.y + 14, w: 50, d: 14, r: 2 };
  p.push(S(k.slabOf(id, 0, 1.0, P, 4), { tone: "hi", className: "bone" }));
  p.push(Ln(k.planOutline(k.insetPlan(id, 1.5), 1.0, P, 4), { tone: "faint" }));
  p.push(`<g transform="${floorM(id.x + 4, id.y + 6, 1.05)}"><text class="txt" x="0" y="0" style="font-size:3.4px;font-weight:700">STRAIN</text><text class="txt-l" x="0" y="4.6" style="font-size:2.1px">yeast-type · eukaryote</text></g>`);
  emit(-1e5, p.join(""), "base");
  put("base.plate", [slabS(PLATE, -PLATE_H, PLATE_H, "base.plate", { ground: true })], [0, 0, 0], -5);
}
