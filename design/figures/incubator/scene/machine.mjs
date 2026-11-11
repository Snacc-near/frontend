// Incubator exterior: bench plate, feet, body, belt seam, control strip, vents, hood, side label, door glass + handle.
import { k, P, S, Ln, Dm, at, r1, pathOf, PLATE, BODY, XF, Z, WIN, MOD, MOD_H, frontM, sideM, rrect, onFront, bbAdd, bbBox3, item, slabS, cylS, planeM } from "../ctx.mjs";

const frontPoly = (x0, yz) => pathOf(onFront(x0, yz), true);

/** Bench plate with the flat dark-brown offset shadow (same recipe as the cell-lab base). */
export function plate() {
  const p = [];
  const shadow = k.slabOf({ x: PLATE.x + 8, y: PLATE.y + 8, w: PLATE.w - 16, d: PLATE.d - 16, r: PLATE.r }, -10, 10, P, 10, 0).fill;
  p.push(`<path class="shadow-flat" transform="translate(-30 28)" d="${shadow}"/>`);
  p.push(S(k.slabOf(PLATE, -10, 10, P, 10, 1.4), { tone: "hi", className: "tan", crease: "lo" }));
  p.push(S(k.slabOf(k.insetPlan(PLATE, 4), 0, 0.6, P, 10, 0), { tone: "lo", className: "bone", crease: "none", flat: true }));
  p.push(Ln(k.planOutline(k.insetPlan(PLATE, 10), 0.6, P, 10), { tone: "faint" }));
  const sc = k.corners(PLATE, 13);
  p.push(Ln(sc.map(([x, y]) => k.ring(x, y, 2.8, 0.6, P, 16)).join(""), { tone: "lo" }));
  p.push(Dm(sc.map(([x, y]) => at([x, y, 0.6])), { size: 0.8, tone: "hi" }));
  // front ruler strip with ticks (rooted on its edge)
  const strip = { x: PLATE.x + PLATE.w - 24, y: -150, w: 7, d: 300, r: 1 };
  p.push(S(k.slabOf(strip, 0.6, 0.8, P, 3), { tone: "lo", crease: "none", className: "bone" }));
  const tk = k.topTicks(strip.y + 6, strip.y + strip.d - 6, 4, 5, strip.x, 1.4, [2.0, 3.6], P, "y");
  p.push(Ln(tk.minor, { tone: "lo" }), Ln(tk.major, { tone: "mid" }));
  bbAdd("ch-incubator", [at([PLATE.x, PLATE.y, -10]), at([PLATE.x + PLATE.w, PLATE.y + PLATE.d, 0]), at([PLATE.x + PLATE.w, PLATE.y, -10]), at([PLATE.x, PLATE.y + PLATE.d, -10])]);
  item("plate", [slabS(PLATE, -10, 10, "plate", { ground: true })]);
  return p.join("");
}

export function feet() {
  const out = [];
  const shapes = [];
  for (const y0 of [-104, 44]) {
    const f = { x: 24, y: y0, w: 126, d: 62, r: 8 };
    out.push(S(k.slabOf(f, 0, Z.foot, P, 6, 0.8), { tone: "hi", className: "tan" }));
    shapes.push(slabS(f, 0, Z.foot, "foot", { ground: true }));
  }
  item("feet", shapes);
  return out.join("");
}

/** Body shell, belt seam, control strip, side vents, side label, bench-side screws. Returns markup. */
export function body() {
  const p = [];
  const slab = (plan, z, h, o) => p.push(S(k.slabOf(plan, z, h, P, 10, 1.2), { tone: "hi", crease: "lo", ...o }));
  slab(BODY, Z.foot, Z.top - Z.foot, { className: "cream" });
  p.push(Ln(k.sideSeam(BODY, Z.belt, P, 10), { tone: "lo" }));
  p.push(Ln(k.sideSeam(BODY, Z.belt + 2.4, P, 10), { tone: "faint" }));
  // --- control strip on the lower front band: slot with three keys, the middle one lit marigold (power indicator)
  const slot = rrect(-46, 46, 30, 52, 8, 5);
  p.push(`<path class="f-dk" d="${frontPoly(XF, slot)}"/>`);
  p.push(`<path class="ink2" d="${frontPoly(XF, rrect(-43.5, 43.5, 32.5, 49.5, 6, 5))}"/>`);
  for (const [i, y] of [-26, 0, 26].entries()) {
    const key = rrect(y - 8, y + 8, 36, 46, 2.5, 3);
    p.push(`<path class="f-top" d="${frontPoly(XF, key)}"/>`);
    // marigold lamp over each key; the lamps blink in sequence (middle one lit when still)
    p.push(`<path class="f-mari key-lamp key-${i + 1}" d="${frontPoly(XF + 0.4, key)}"/>`);
  }
  // --- CrucibleTemp dial on the lower-left of the front band (needle = #needle, rotates about the hub)
  {
    const R_ = 15.5;
    const arc = (a0, a1, r) => { const x = (a) => r1(r * Math.cos((a * Math.PI) / 180)), y = (a) => r1(r * Math.sin((a * Math.PI) / 180)); return `M${x(a0)} ${y(a0)}A${r} ${r} 0 0 1 ${x(a1)} ${y(a1)}`; };
    const ticks = Array.from({ length: 13 }, (_, i) => { const a = ((135 + (270 * i) / 12) * Math.PI) / 180, r0 = i % 3 === 0 ? 11.4 : 12.4; return `M${r1(r0 * Math.cos(a))} ${r1(r0 * Math.sin(a))}L${r1(13.4 * Math.cos(a))} ${r1(13.4 * Math.sin(a))}`; }).join("");
    p.push(`<g transform="${frontM(XF, 78, 44)}" id="dial">` +
      `<circle r="${R_ + 3}" class="f-dk"/><circle r="${R_}" class="f-top"/><circle r="13.8" fill="#fffdf8" class="ink2"/>` +
      `<path d="${arc(135, 225, 9.2)}" class="dial-zone" style="stroke:#d8c399"/><path d="${arc(225, 315, 9.2)}" class="dial-zone" style="stroke:#fff1cd"/><path d="${arc(315, 405, 9.2)}" class="dial-zone" style="stroke:#ffd57a"/>` +
      `<path d="${ticks}" class="ink"/>` +
      `<g id="needle"><path d="M0 3.4L0 -10.6" class="needle-line"/></g><circle r="2" class="ink inkf"/></g>`);
  }
  // --- side vent slashes "///" on the lower band, right of the strip
  for (const dir of [-1]) {
    for (let i = 0; i < 3; i++) {
      const y = dir * (66 + i * 10);
      const sl = [[y, 58], [y + 4 * dir * -1, 58], [y - 7 * dir, 33], [y - 3 * dir, 33]];
      p.push(`<path class="f-dk" d="${frontPoly(XF, sl)}"/>`);
    }
  }
  // screws on the shoulders
  const shoulder = [[-108, 62], [108, 62]];
  p.push(Dm(shoulder.map(([y, z]) => at([XF, y, z])), { size: 0.7, tone: "hi" }));
  // --- left side wall: label plate + vent bank (the face that turns toward the viewer's left)
  const lab = planeM(P, [BODY.x + 34, BODY.y + BODY.d, 160], [1, 0, 0], [0, 0, -1]);
  p.push(`<g transform="${lab}"><rect x="-4" y="-18" width="94" height="30" rx="3" class="f-top"/><text class="txt" x="2" y="-6" style="font-size:7px;font-weight:700">SNACC-01</text><text class="txt-l" x="2" y="3" style="font-size:3.4px">INCUBATOR · CELL LAB</text></g>`);
  for (let i = 0; i < 5; i++) {
    const m = sideM(BODY.x + 30 + i * 14, BODY.y + BODY.d, 60);
    p.push(`<g transform="${m}"><rect x="0" y="0" width="8" height="26" rx="4" class="f-dk"/></g>`);
  }
  bbBox3("ch-incubator", BODY.x, XF, BODY.y, BODY.y + BODY.d, 0, Z.top);
  item("body", [
    slabS({ x: BODY.x, y: BODY.y, w: 30, d: BODY.d, r: 0 }, Z.foot, Z.top - Z.foot, "body.back"),
    slabS({ x: 30, y: BODY.y, w: BODY.w - 30, d: WIN.y0 - BODY.y, r: 0 }, Z.foot, Z.top - Z.foot, "body.right"),
    slabS({ x: 30, y: WIN.y1, w: BODY.w - 30, d: BODY.y + BODY.d - WIN.y1, r: 0 }, Z.foot, Z.top - Z.foot, "body.left"),
    slabS({ x: 30, y: WIN.y0, w: BODY.w - 30, d: WIN.y1 - WIN.y0, r: 0 }, Z.foot, Z.win0 - Z.foot, "body.sill"),
    slabS({ x: 30, y: WIN.y0, w: BODY.w - 30, d: WIN.y1 - WIN.y0, r: 0 }, Z.win1, Z.top - Z.win1, "body.lintel"),
  ]);
  return p.join("");
}

/** Hood: two tiers and three slanted vents "///" (the logo's top). */
export function hood() {
  const p = [];
  const t1 = { x: 14, y: -98, w: 142, d: 196, r: 24 };
  const t2 = { x: 34, y: -68, w: 102, d: 136, r: 22 };
  p.push(S(k.slabOf(t1, Z.top, Z.hood1 - Z.top, P, 10, 1.2), { tone: "hi", crease: "lo", className: "cream" }));
  p.push(S(k.slabOf(t2, Z.hood1, Z.hood2 - Z.hood1, P, 10, 1.2), { tone: "hi", crease: "lo", className: "bone" }));
  // slanted vents on the front of the upper tier (plane x = t2.x + t2.w)
  const xf = t2.x + t2.w;
  for (let i = 0; i < 3; i++) {
    const y = 20 - i * 20;
    const sl = [[y - 3, 222], [y + 1, 222], [y + 9, 233], [y + 5, 233]];
    // lean: top shifted toward viewer's right (negative y), like "///"
    const sl2 = [[y + 2, Z.hood1 + 4], [y + 6, Z.hood1 + 4], [y - 2, Z.hood2 - 5], [y - 6, Z.hood2 - 5]];
    p.push(`<path class="f-dk" d="${frontPoly(xf, sl2)}"/>`);
    void sl;
  }
  // top face vent slots (small) + marigold status dot? (kept on the control strip) -> hood screws
  p.push(Dm([at([xf, -66, Z.hood1 + 5]), at([xf, 66, Z.hood1 + 5])], { size: 0.6, tone: "hi" }));
  bbBox3("ch-incubator", t2.x, t2.x + t2.w, t2.y, t2.y + t2.d, Z.hood1, Z.hood2);
  item("hood", [slabS(t1, Z.top, Z.hood1 - Z.top, "hood.1"), slabS(t2, Z.hood1, Z.hood2 - Z.hood1, "hood.2")]);
  return p.join("");
}

/** Window bezel lip: ring around the opening, standing slightly proud of the front face. */
export function bezel() {
  const p = [];
  const outer = rrect(WIN.y0 - 8, WIN.y1 + 8, WIN.z0 - 8, WIN.z1 + 8, WIN.r + 6, 7);
  const hole = rrect(WIN.y0, WIN.y1, WIN.z0, WIN.z1, WIN.r, 7);
  const lift = XF + 2.2;
  p.push(`<path class="f-top" fill-rule="evenodd" d="${frontPoly(lift, outer)}${frontPoly(lift, hole)}"/>`);
  p.push(`<path class="ink2" d="${frontPoly(lift, rrect(WIN.y0 - 4, WIN.y1 + 4, WIN.z0 - 4, WIN.z1 + 4, WIN.r + 3, 7))}"/>`);
  const sc = [[WIN.y0 - 4, WIN.z0 - 4], [WIN.y1 + 4, WIN.z0 - 4], [WIN.y0 - 4, WIN.z1 + 4], [WIN.y1 + 4, WIN.z1 + 4]];
  p.push(Dm(sc.map(([y, z]) => at([lift, y, z])), { size: 0.6, tone: "hi" }));
  return p.join("");
}

/** The window hole as a clip path on the front plane. */
export const windowClipPath = () => frontPoly(XF, rrect(WIN.y0, WIN.y1, WIN.z0, WIN.z1, WIN.r, 7));

/** Door: glass leaf in the window plane + handle + hinges. Closed state is drawn; the open state is a second group (opacity 0). */
export function door() {
  const lift = XF + 3;
  const hole = rrect(WIN.y0 - 1, WIN.y1 + 1, WIN.z0 - 1, WIN.z1 + 1, WIN.r, 7);
  const closed = [];
  closed.push(`<path class="glass-fill" d="${frontPoly(lift, hole)}"/>`);
  closed.push(`<path class="glass-edge" d="${frontPoly(lift, hole)}"/>`);
  // diagonal reflections (the logo's "//" streaks), tall strips fading at both ends
  const streak = (y0, z0, y1, z1, w, id) => `<path fill="url(#${id})" d="${frontPoly(lift, [[y0, z0], [y0 - w, z0], [y1 - w, z1], [y1, z1]])}"/>`;
  closed.push(streak(70, 92, 96, 176, 6, "gl-v"));
  closed.push(streak(88, 92, 106, 150, 3.4, "gl-v2"));
  // handle bar on the right edge + hinge knuckles on the left edge
  const hy = WIN.y0 - 6;
  closed.push(S(k.slabOf({ x: XF + 2, y: hy - 3, w: 11, d: 6, r: 2.4 }, 112, 56, P, 6, 0.6), { tone: "hi", className: "steel" }));
  for (const z of [104, 164]) closed.push(S(k.slabOf({ x: XF + 2, y: hy - 3, w: 6, d: 6, r: 1 }, z - 2, 4, P, 4), { tone: "hi", className: "tan" }));
  for (const z of [100, 166]) closed.push(S(k.cylinder(XF + 3, WIN.y1 + 6, 3, z - 7, 14, P, 14, 0.4), { tone: "hi", className: "steel" }));
  // condensation droplets on the glass; they slide down slowly (CSS) and turn with the door
  const drops = [[78, 188, 1], [40, 176, 2], [-6, 192, 3], [-52, 182, 1], [62, 150, 3], [14, 158, 2], [-30, 140, 1], [-72, 160, 2], [90, 120, 2], [-84, 118, 3]];
  const dr = drops.map(([y, z, n]) => { const [x, yy] = at([lift, y, z]); return `<ellipse class="drop d${n}" cx="${r1(x)}" cy="${r1(yy)}" rx="1.7" ry="2.3"/>`; });
  closed.push(dr.join(""));
  // the leaf swings about the left hinge: the page drives --door (an angle) and the affine map below turns it in the iso plane
  const [hx, hy2] = at([lift, WIN.y1 + 6, 0]);
  // warm glow spilling out of the open door onto the bench (marigold; shown by data-door="open")
  const spill = `<path id="door-spill" class="spill" d="${k.planOutline({ x: XF + 6, y: -104, w: 44, d: 208, r: 18 }, 0.9, P, 8)}"/>`;
  bbBox3("ch-door", XF, XF + 14, WIN.y0 - 12, WIN.y1 + 12, WIN.z0 - 8, WIN.z1 + 8);
  bbBox3("ch-door", XF + 6, XF + 50, -104, 104, 0.9, 0.9);      // the glow on the bench belongs to the door
  return { leaf: `<g id="door" style="transform-origin:${r1(hx)}px ${r1(hy2)}px">${closed.join("")}</g>`, spill };
}

/** Thin steam wisps rising from the three hood vents (each a path inside a translated group, so CSS can animate the path). */
export function steam() {
  const t2 = { x: 34, y: -68, w: 102, d: 136 };
  const xf = t2.x + t2.w;
  const out = [];
  for (let i = 0; i < 3; i++) {
    const y = 20 - i * 20;
    const [sx, sy] = at([xf, y - 2, Z.hood2 - 3]);
    out.push(`<g transform="translate(${r1(sx)} ${r1(sy)})"><path class="vent-steam s${i + 1}" d="M0 0C7 -9 -7 -19 0 -28S7 -46 0 -56"/></g>`);
    out.push(`<g transform="translate(${r1(sx + 8)} ${r1(sy + 1)})"><path class="vent-steam s${i + 1} b" d="M0 0C-5 -8 5 -16 0 -24S-5 -38 0 -46"/></g>`);
  }
  return out.join("");
}
