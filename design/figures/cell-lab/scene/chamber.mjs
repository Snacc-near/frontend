// Chamber: stage collar with clamps, glass bell jar (back/front split), and the cell shell cutaway.
import { k, G, O, P, S, Ln, Dm, at, f1, emit, put, cylS, CELLC, STAGE_Z, GLASS_R, CELL_R, CELL_Z, dep, floorM } from "../ctx.mjs";

export const JAR = { base: 12, cyl: 84, cap: 58 };
export const JAR_TOP = JAR.base + JAR.cyl + JAR.cap;

export function chamber() {
  const [CX, CY] = CELLC;
  // ---- stage: collar discs ----
  const st = [];
  st.push(S(k.cylinder(CX, CY, 74, 0, 5, P, 72, 0.8), { tone: "hi", className: "bone" }));
  st.push(Ln(k.sideArc(CX, CY, 74, 2.5, P, 48), { tone: "faint" }));
  st.push(S(k.cylinder(CX, CY, 69, 5, 4, P, 72, 0.8), { tone: "hi", className: "tan" }));
  st.push(Ln(k.knurl(CX, CY, 69, 5, 9, 72, P, 0.1), { tone: "lo" }));
  st.push(S(k.cylinder(CX, CY, 66, 9, 3, P, 72, 0.6), { tone: "hi", className: "steel" }));
  // glass seat groove + bolt circle
  st.push(Ln(k.ring(CX, CY, 63.5, 12, P, 72), { tone: "mid" }));
  st.push(Ln(k.ring(CX, CY, 60.5, 12, P, 72), { tone: "faint" }));
  const bolts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    return at([CX + 71.6 * Math.cos(a), CY + 71.6 * Math.sin(a), 5]);
  }).filter((_, i) => true);
  st.push(Dm(Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    return [CX + 67.5 * Math.cos(a), CY + 67.5 * Math.sin(a)];
  }).filter(([x, y]) => (x - CX) * Math.SQRT1_2 + (y - CY) * Math.SQRT1_2 > -30).map(([x, y]) => at([x, y, 9])), { size: 0.6, tone: "hi" }));
  // cytoplasm bath floor disc inside the glass
  st.push(S(k.cylinder(CX, CY, 58, 12, 1.2, P, 64, 0.2), { tone: "hi", className: "cyto", crease: "none" }));
  emit(dep(CX, CY, 0) - 2, st.join(""), "stage");
  put("chamber.collar", [cylS(CX, CY, 74, 0, 5, "chamber.collar")], [CX, CY, 4], -1);

  // ---- clamps around the collar (4 thumb screws) ----
  const clamps = [];
  const cl = [];
  for (const a of [20, 70, 120, 160, 200, 250, 290, 340]) {
    const rad = (a * Math.PI) / 180;
    const gx = CX + 70 * Math.cos(rad), gy = CY + 70 * Math.sin(rad);
    cl.push({ gx, gy, d: dep(gx, gy, 6) });
  }
  cl.sort((a, b) => a.d - b.d);
  for (const { gx, gy } of cl) {
    clamps.push(S(k.slabOf({ x: gx - 4.5, y: gy - 4.5, w: 9, d: 9, r: 2 }, 5, 6, P, 3, 0.5), { tone: "hi", className: "steel" }));
    clamps.push(S(k.cylinder(gx, gy, 2.4, 11, 2.6, P, 14), { tone: "hi", className: "tan" }));
    clamps.push(Dm([at([gx, gy, 13.6])], { size: 0.5 }));
  }
  emit(dep(CX, CY, 0) - 1.5, clamps.join(""), "clamps");
}

/** Glass bell jar: returns { back, front } layer markup (draw back before the cell, front after). */
export function glass() {
  const [CX, CY] = CELLC;
  const F = G.frameAlong([CX, CY, JAR.base], [0, 0, 1]);
  const R0 = GLASS_R;
  const prof = [[0, R0]];
  for (let i = 0; i <= 8; i++) prof.push([(JAR.cyl * i) / 8, R0]);
  const N = 22;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    prof.push([JAR.cyl + JAR.cap * Math.sin((t * Math.PI) / 2), R0 * Math.cos((t * Math.PI) / 2)]);
  }
  const body = G.outlineOf(prof.map(([s, r], i) => [s, Math.max(r, 0.01), i > 9 ? 1 : 0]), F, P, { fill: "hull", rims: "none" });
  // rim ring (full circle), its back half is behind the cell and its front half in front
  const rim = (r, s = 0) => G.arcOf(F, s, r, P, { least: -1, steps: 96 });
  const rimFront = (r, s = 0) => G.arcOf(F, s, r, P, { least: 0.0, steps: 64 });
  const back = [];
  back.push(`<path class="glass-fill-b" d="${body.fill}"/>`);
  back.push(`<path class="glass-edge-b" d="${rim(R0 - 1.4)}"/>`);
  back.push(`<path class="glass-edge-b" d="${G.arcOf(F, JAR.cyl, R0 - 0.2, P, { least: -1, steps: 96, inward: false })}" opacity=".5"/>`);
  // back wall highlight panes (faded): vertical streaks on the far inner wall
  const front = [];
  front.push(`<path class="glass-fill" d="${body.fill}"/>`);
  front.push(`<path class="glass-edge" d="${body.outline}"/>`);
  front.push(`<path class="glass-edge" d="${rimFront(R0)}"/>`);
  front.push(`<path class="glass-edge" d="${rimFront(R0 - 1.6, 0)}" opacity=".6"/>`);
  front.push(`<path class="glass-edge-b" d="${rimFront(R0, JAR.cyl)}"/>`);
  // faded vertical highlights on the visible side (curved strips following the cylinder)
  const strip = (ang, w, z0, z1, id) => {
    const a0 = ang - w, a1 = ang + w;
    const left = [], right = [];
    for (let i = 0; i <= 14; i++) {
      const z = z0 + ((z1 - z0) * i) / 14;
      left.push(at([CX + (R0 - 1) * Math.cos(a0), CY + (R0 - 1) * Math.sin(a0), JAR.base + z]));
      right.push(at([CX + (R0 - 1) * Math.cos(a1), CY + (R0 - 1) * Math.sin(a1), JAR.base + z]));
    }
    const poly = [...left, ...right.reverse()];
    return `<path fill="url(#${id})" d="${O.pathOf(poly, true)}"/>`;
  };
  // direction toward the viewer-left on the floor is angle ~ 135deg (x-,y+): the lit left-front limb
  front.push(strip(Math.PI * 0.68, 0.06, 8, 66, "gl-v"));
  front.push(strip(Math.PI * 0.6, 0.022, 14, 56, "gl-v"));
  front.push(strip(Math.PI * 0.27, 0.035, 10, 50, "gl-v2"));
  // dome shine: arc following the cap
  const capArc = [];
  for (let i = 0; i <= 12; i++) {
    const t = 0.18 + (i / 12) * 0.52;
    const rr = (R0 - 1.4) * Math.cos(t * Math.PI / 2), zz = JAR.cyl + JAR.cap * Math.sin(t * Math.PI / 2);
    const a = Math.PI * 0.7;
    capArc.push(at([CX + rr * Math.cos(a), CY + rr * Math.sin(a), JAR.base + zz]));
  }
  front.push(`<path class="glass-edge" d="${O.pathOf(capArc)}" stroke="#fff" stroke-width="2.4" opacity=".9" style="stroke:#fff;stroke-width:2.2px"/>`);
  // finial knob on the dome
  const fin = [];
  const topZ = JAR_TOP;
  fin.push(S(k.cylinder(CX, CY, 7, topZ - 1, 2.2, P, 28, 0.4), { tone: "hi", className: "steel" }));
  fin.push(S(k.cylinder(CX, CY, 3.4, topZ + 1.2, 4, P, 20), { tone: "hi", className: "tan" }));
  fin.push(S(G.sphereOf([CX, CY, topZ + 8.6], 4.6, P), { tone: "hi", className: "mari" }));
  fin.push(Dm([at([CX, CY, topZ + 1.2])], { size: 0.4 }));
  // glass collar ring (the bell's own foot ring, steel) sits in front layer around the base
  const foot = [];
  {
    const z0 = JAR.base, z1 = JAR.base + 3.4, ro = R0 + 2.4, ri = R0 - 1.4;
    const E = (r, z, from, to) => O.ellipse3([CX, CY, z], [1, 0, 0], [0, 1, 0], r, r, P, { from, to, steps: 64 });
    // visible near half: angles facing the viewer (toward +x+y): from -45deg to 135deg
    const A0 = -Math.PI / 4, A1 = (3 * Math.PI) / 4;
    const wall = [...E(ro, z1, A0, A1), ...E(ro, z0, A0, A1).reverse()];
    foot.push(`<path d="${O.pathOf(wall, true)}" class="f-tan"/>`);
    const top = O.pathOf(E(ro, z1, 0, Math.PI * 2), true) + O.pathOf(E(ri, z1, 0, Math.PI * 2).reverse(), true);
    foot.push(`<path d="${top}" fill-rule="evenodd" fill="#ecdcb8" class="ink"/>`);
    foot.push(Dm(Array.from({ length: 12 }, (_, i) => { const a = A0 + ((A1 - A0) * (i + 0.5)) / 12; return at([CX + (R0 + 0.5) * Math.cos(a), CY + (R0 + 0.5) * Math.sin(a), z1]); }), { size: 0.55, tone: "hi" }));
  }
  return { back: back.join(""), front: front.join(""), fin: fin.join(""), foot: foot.join("") };
}
