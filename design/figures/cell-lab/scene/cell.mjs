// Organelles inside the cutaway cell. Every organelle is an ellipsoid or an organic face-plane drawing, wrapped in
// <g data-org="..."> so the runtime can lift and light it. Art on planes is authored in (u right, v down) local units.
import { k, O, P, S, Ln, Dm, at, f1, planeM } from "../ctx.mjs";
import { CC, FP, cw, cp } from "./cellshell.mjs";

const YAW = -Math.PI / 4;           // local x -> screen right, local y -> toward viewer
const TAU = Math.PI * 2;
const E = (cx, cz, dn, r, opts = {}) => O.ellipsoidOf(cw(cx, cz, dn), r, YAW, P, { steps: opts.steps || 56, warp: opts.warp });
/** Matrix for flat art on the face plane at (cx, cz) with depth dn (u right, v down). */
const FM = (cx, cz, dn) => planeM(cw(cx, cz, dn), FP.e1, [0, 0, -1]);
const circ = (r, n = 40) => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r]);
const ellPts = (rx, ry, n = 48, rot = 0) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * TAU; const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
  return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
});
const d2 = (pts, closed = true) => O.smoothPath(pts, closed);
const poly = (pts, closed = true) => O.pathOf(pts, closed);

export const ORG = {}; // name -> { cx, cz, dn, screen:[x,y] }
const reg = (name, cx, cz, dn) => { ORG[name] = { cx, cz, dn, screen: at(cw(cx, cz, dn)) }; };
const wrap = (name, svg) => `<g data-org="${name}" style="transform-origin:${f1(ORG[name].screen[0])}px ${f1(ORG[name].screen[1])}px">${svg}</g>`;

let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** Window ellipse section on an ellipsoid at plane offset `off` toward the viewer. Returns { cx,cz,dn,rx,rz,clip,id }. */
function window3(name, cx, cz, dn, r, off) {
  const s = Math.sqrt(Math.max(0.05, 1 - (off / r[1]) ** 2));
  const rx = r[0] * s, rz = r[2] * s;
  const pts = O.ellipse3(cw(cx, cz, dn + off), FP.e1, FP.e2, rx, rz, P, { steps: 72 });
  return { rx, rz, pts, path: O.pathOf(pts, true), c: [cx, cz, dn + off], id: `w-${name}` };
}

/** Reel (film spool): ring, hub, 3 lightening holes + film wound. Local art. */
function reel(x, y, r, fill = "#fff8e6") {
  const holes = [0, 1, 2].map((i) => {
    const a = (i / 3) * TAU + 0.5;
    return `<circle cx="${f1(x + Math.cos(a) * r * 0.55)}" cy="${f1(y + Math.sin(a) * r * 0.55)}" r="${f1(r * 0.2)}" class="f-dk" style="stroke-width:.4px"/>`;
  }).join("");
  return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${fill}" class="ink" style="stroke-width:.7px"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 0.78)}" class="ink3" style="stroke-width:.35px"/>${holes}<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 0.17)}" class="f-mari" style="stroke-width:.4px"/>`;
}

/* ---------------- nucleus: genome film archive ---------------- */
function nucleus() {
  const c = [6, 6, 4];  // cx, cz, dn
  const r = [23, 20, 23];
  reg("nucleus", c[0], c[1], c[2]);
  const e = E(c[0], c[1], c[2], r);
  const w = window3("nuc", c[0], c[1], c[2], r, 8);
  const o = [];
  o.push(S(e, { tone: "hi", className: "bone", crease: "none" }));
  // outer-envelope pores on the shell (small rings) around the upper-left silhouette
  const pores = [];
  for (let i = 0; i < 9; i++) {
    const a = 3.5 + i * 0.28;
    pores.push(cp(c[0] + Math.cos(a) * r[0] * 0.98, c[1] + Math.sin(a) * r[2] * 0.98, c[2] - 2));
  }
  o.push(Dm(pores, { size: 0.65, tone: "hi" }));
  // section window: envelope (double), nucleoplasm, film archive
  o.push(`<clipPath id="cp-nuc"><path d="${w.path}"/></clipPath>`);
  const M = FM(w.c[0], w.c[1], w.c[2]);
  const rx = w.rx, rz = w.rz;
  const a = [];
  a.push(`<g clip-path="url(#cp-nuc)"><g transform="${M}">`);
  a.push(`<ellipse cx="0" cy="0" rx="${f1(rx + 2)}" ry="${f1(rz + 2)}" fill="#f4ecd6"/>`);
  // inner envelope ring (second membrane)
  a.push(`<ellipse cx="0" cy="0" rx="${f1(rx - 2.4)}" ry="${f1(rz - 2.4)}" fill="#fbf5e4" class="ink" style="stroke-width:.6px"/>`);
  // pore gaps: breaks drawn as small cream blocks across both membranes
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * TAU + 0.15;
    const px0 = Math.cos(t) * (rx - 1.2), py0 = Math.sin(t) * (rz - 1.2);
    a.push(`<ellipse cx="${f1(px0)}" cy="${f1(py0)}" rx="1.25" ry="1.25" fill="#fffaf0" class="ink" style="stroke-width:.5px" transform="rotate(${f1((t * 180) / Math.PI)} ${f1(px0)} ${f1(py0)})"/><circle cx="${f1(px0)}" cy="${f1(py0)}" r=".35" class="inkf"/>`);
  }
  // nucleolus
  a.push(`<circle cx="-4.2" cy="4.8" r="3.6" fill="#c9a86a" class="ink" style="stroke-width:.7px"/><circle cx="-5" cy="4" r="1.2" fill="#e6c98a" stroke="none"/>`);
  // genome film archive: three spools on a rack + film loop + sprocket holes + RNA-pol reading head
  const film = `M-8.5 -5.5C-3 -9 3 -9 8.5 -5.5L8.5 -2.5C3 -6 -3 -6 -8.5 -2.5Z`;
  a.push(`<path d="${film}" fill="#26211b" class="ink" style="stroke-width:.6px"/>`);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = -7.2 + t * 14.4, y = -6.4 - Math.sin(t * Math.PI) * 1.4 + 0.3 - (1 - Math.sin(t * Math.PI)) * 0.0;
    a.push(`<rect x="${f1(x - 0.35)}" y="${f1(y)}" width=".7" height=".9" fill="#fbf5e4" stroke="none"/>`);
  }
  a.push(reel(-8.6, -4.2, 3.1), reel(8.6, -4.2, 3.1), reel(0, 7.2, 3.4, "#ffe4a3"));
  // reading head (RNA polymerase) on the film: a small marigold box with lens
  a.push(`<g data-part="rnapol"><rect x="-2" y="-9.8" width="4.6" height="3.8" rx=".8" class="f-mari"/><circle cx=".3" cy="-7.9" r="1.1" fill="#fff8e6" class="ink" style="stroke-width:.4px"/></g>`);
  // frame highlighted (the attest frame): one film frame that changes colour
  a.push(`<rect data-part="film-frame" x="4.4" y="-8.1" width="2.4" height="1.6" rx=".3" fill="#fff8e6" class="ink" style="stroke-width:.35px"/>`);
  a.push(`</g></g>`);
  o.push(a.join(""));
  o.push(`<path d="${w.path}" class="ink" fill="none"/>`);
  // window rim highlight
  o.push(`<path d="${w.path}" class="glow-ring" fill="none" data-glow style="opacity:0"/>`);
  return wrap("nucleus", o.join(""));
}

/* ---------------- rough ER sheets with ribosome dots ---------------- */
function er() {
  reg("er", -12, -2, -2);
  const o = [];
  // three stacked wavy ribbons hugging the lower right of the nucleus: filled bands with tan thickness
  const ribbon = (cx0, cz0, w, amp, ph, th) => {
    const top = [], bot = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const x = cx0 + t * w, y = cz0 + Math.sin(t * 5 + ph) * amp - Math.sin(t * Math.PI) * 4;
      top.push([x, y]); bot.push([x, y + th]);
    }
    return { top, bot };
  };
  const M = FM(0, 0, -2);
  const parts = [];
  const rbs = [ribbon(-6, 26, 36, 1.8, 0.2, 2.2), ribbon(-6, 31, 34, 1.6, 1.0, 2.0), ribbon(-6, 36, 30, 1.4, 1.8, 1.8)];
  // coordinates above are in face-plane (dx, dz up) -> convert to (u, v down): v = -dz
  const flip = (pts) => pts.map(([x, z]) => [x, -z]);
  const dots = [];
  for (const rb of rbs) {
    const pts = [...flip(rb.top), ...flip(rb.bot).reverse()];
    parts.push(`<path d="${d2(pts)}" fill="#f1dca8" class="ink" style="stroke-width:.7px"/>`);
    parts.push(`<path d="${d2(flip(rb.top), false)}" fill="none" class="ink3" style="stroke-width:.35px;stroke:#fff"/>`);
    for (let i = 1; i < 18; i += 1) {
      const [x, y] = flip(rb.top)[i];
      dots.push(`<circle cx="${f1(x)}" cy="${f1(y - 0.3)}" r=".62" class="f-dk" style="stroke-width:.25px"/>`);
    }
  }
  o.push(`<g transform="${M}">${parts.join("")}${dots.join("")}</g>`);
  return wrap("er", o.join(""));
}

/* ---------------- Golgi: stacked curved cisternae ---------------- */
function golgi() {
  reg("golgi", 33, -22, 8);
  const o = [];
  const M = FM(33, -22, 8);
  const a = [];
  // 5 crescents stacked cis (back/bottom-left) to trans (front/top-right), each a thick arc band with tan underside
  for (let i = 0; i < 5; i++) {
    const dy = -i * 4.1;                 // up in v-down means negative
    const span = 1.0 - i * 0.06;
    const R0 = 13.4 - i * 0.2;
    const top = [], bot = [];
    for (let j = 0; j <= 16; j++) {
      const t = -0.85 * span + (1.7 * span * j) / 16;
      top.push([Math.sin(t) * R0, -Math.cos(t) * R0 * 0.34 + dy]);
      bot.push([Math.sin(t) * (R0 - 0.2), -Math.cos(t) * R0 * 0.34 + dy + 2.7]);
    }
    const ring = [...top, ...bot.reverse()];
    const tone = i % 2 ? "#f6e6c0" : "#fbf1d6";
    a.push(`<path d="${d2(ring)}" fill="#c9b27c" class="ink" style="stroke-width:.8px" transform="translate(0 1.2)"/>`);
    a.push(`<path d="${d2(ring)}" fill="${tone}" class="ink" style="stroke-width:.8px"/>`);
    a.push(`<path d="${d2(top.slice(1, -1), false)}" fill="none" class="ink3" style="stroke:#fff;stroke-width:.5px"/>`);
    // fenestrations: tiny ellipses
    for (const f of [4, 8, 11]) a.push(`<ellipse cx="${f1(top[f][0])}" cy="${f1(top[f][1] + 1.3)}" rx=".7" ry=".4" fill="#c9b27c" stroke="none"/>`);
    // swollen rim ends
    a.push(`<circle cx="${f1(top[0][0])}" cy="${f1(top[0][1] + 1.3)}" r="1.5" fill="${tone}" class="ink" style="stroke-width:.6px"/><circle cx="${f1(top[16][0])}" cy="${f1(top[16][1] + 1.3)}" r="1.5" fill="${tone}" class="ink" style="stroke-width:.6px"/>`);
  }
  // transport vesicles near the cis face (bottom) and trans face (top, marigold NEP-245 stamps)
  a.push(`<circle cx="-12" cy="9" r="1.7" fill="#fff8e6" class="ink" style="stroke-width:.6px"/><circle cx="-7" cy="11.4" r="1.4" fill="#fff8e6" class="ink" style="stroke-width:.6px"/>`);
  a.push(`<circle cx="11" cy="-24.5" r="2.1" class="f-mari"/><circle cx="6" cy="-26.5" r="1.5" class="f-mari"/>`);
  o.push(`<g transform="${M}">${a.join("")}</g>`);
  // stamp arm (hidden until synth): a small press with a head
  o.push(`<g data-part="stamp" transform="${M}"><path d="M-3 -34L3 -34L3 -30L-3 -30Z" class="f-dk"/><path d="M-6 -30L6 -30L6 -28.4L-6 -28.4Z" class="f-cream"/></g>`);
  return wrap("golgi", o.join(""));
}

/* ---------------- vacuole: water tower / warehouse ---------------- */
function vacuole() {
  const c = [-30, -8, 0];
  const r = [23, 20, 23];
  reg("vacuole", c[0], c[1], c[2]);
  const e = E(c[0], c[1], c[2], r);
  const w = window3("vac", c[0], c[1], c[2], r, 7);
  const o = [];
  o.push(S(e, { tone: "hi", className: "water", crease: "none" }));
  o.push(`<clipPath id="cp-vac"><path d="${w.path}"/></clipPath>`);
  const M = FM(w.c[0], w.c[1], w.c[2]);
  const a = [];
  a.push(`<g clip-path="url(#cp-vac)"><g transform="${M}">`);
  a.push(`<ellipse cx="0" cy="0" rx="${f1(w.rx + 2)}" ry="${f1(w.rz + 2)}" fill="#d9eef8"/>`);
  // water level band (turgor): lower half tinted; level line animated by data-part
  a.push(`<rect data-part="vac-water" x="-22" y="-2" width="44" height="26" fill="#aed9ee"/><path data-part="vac-level" d="M-22 -2Q-11 -3.6 0 -2T22 -2" fill="none" class="ink3" style="stroke-width:.5px"/>`);
  // shelves (warehouse) with items: spores (ember / ice / glow), enzyme keys, elixir vials
  for (const sy of [-9, -1.5, 6.5]) a.push(`<path d="M-13 ${sy}L13 ${sy}" class="ink" style="stroke-width:.8px"/><path d="M-13 ${sy + 0.9}L13 ${sy + 0.9}" class="ink3"/>`);
  const items = [
    [-9, -9, "#e8762b"], [-5.4, -9, "#a9d4ec"], [-1.8, -9, "#c8e36a"], [2.4, -9, "#e8762b"], [6.2, -9, "#a9d4ec"], [10, -9, "#c8e36a"],
    [-8, -1.5, "#f8aa06"], [-3, -1.5, "#f8aa06"], [4, -1.5, "#ffd57a"], [9, -1.5, "#ffd57a"],
    [-9, 6.5, "#fff"], [-4.5, 6.5, "#fff"], [0.5, 6.5, "#e8762b"], [5.5, 6.5, "#a9d4ec"], [10, 6.5, "#c8e36a"],
  ];
  for (const [x, y, col] of items) a.push(`<circle cx="${x}" cy="${f1(y - 1.6)}" r="1.55" fill="${col}" class="ink" style="stroke-width:.5px"/><circle cx="${f1(x - 0.5)}" cy="${f1(y - 2.2)}" r=".4" fill="#fff" stroke="none"/>`);
  a.push(`</g></g>`);
  o.push(a.join(""));
  o.push(`<path d="${w.path}" class="ink" fill="none"/>`);
  // turgor manometer: small dial on the left shoulder of the vacuole
  const mc = cw(c[0] - 17, c[1] + 12, c[2] + 6);
  o.push(manometer(mc));
  return wrap("vacuole", o.join(""));
}

/** Tiny face dial (manometer) on the face plane around world point m. */
function manometer(m) {
  const M = planeM(m, FP.e1, [0, 0, -1]);
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = (-210 + i * 24) * Math.PI / 180;
    return `M${f1(Math.cos(a) * 3.0)} ${f1(Math.sin(a) * 3.0)}L${f1(Math.cos(a) * (i % 5 ? 3.5 : 3.9))} ${f1(Math.sin(a) * (i % 5 ? 3.5 : 3.9))}`;
  }).join("");
  return `<g transform="${M}"><circle r="4.8" class="f-tan" style="stroke-width:.8px"/><circle r="4.0" fill="#fffdf6" class="ink" style="stroke-width:.5px"/><path d="${ticks}" class="ink2" style="stroke-width:.35px"/><path data-part="manometer-needle" d="M0 0L2.8 -2.2" class="ink" style="stroke:#f8aa06;stroke-width:.9px"/><circle r=".5" class="inkf"/></g>`;
}

/* ---------------- mitochondrion (bean) with cristae ---------------- */
function bean(name, cx, cz, dn, len, wid, tilt, accent = false) {
  reg(name, cx, cz, dn);
  const r = [len, wid * 0.82, wid];
  const warp = (loc) => [loc[0], loc[1] + 0.22 * wid * (loc[0] / len) ** 2 * -0.0, loc[2] - 0.18 * wid * (1 - (loc[0] / len) ** 2) * 0.0];
  const e = O.ellipsoidOf(cw(cx, cz, dn), r, YAW + tilt, P, { steps: 56 });
  const wd = (() => {
    const s = 0.82;
    const rx = len * s, rz = wid * s;
    const c = cw(cx, cz, dn + r[1] * 0.5);
    const pts = O.ellipse3(c, FP.e1, FP.e2, rx, rz, P, { steps: 64 });
    return { rx, rz, c, path: O.pathOf(pts, true), pts };
  })();
  // rotate window with tilt by rotating the art; clip is already the ellipse (untilted) -> keep tilt small
  const o = [];
  o.push(S(e, { tone: "hi", className: accent ? "warm" : "tan", crease: "none" }));
  o.push(`<clipPath id="cp-${name}"><path d="${wd.path}"/></clipPath>`);
  const M = planeM(wd.c, FP.e1, [0, 0, -1]);
  const a = [];
  a.push(`<g clip-path="url(#cp-${name})"><g transform="${M}">`);
  a.push(`<ellipse rx="${f1(wd.rx + 1)}" ry="${f1(wd.rz + 1)}" fill="${accent ? "#ffe9a8" : "#f1dca8"}"/>`);
  // inner membrane + cristae folds (closed lobes)
  a.push(`<ellipse rx="${f1(wd.rx - 1.7)}" ry="${f1(wd.rz - 1.7)}" fill="${accent ? "#ffd57a" : "#f7e9c3"}" class="ink" style="stroke-width:.55px"/>`);
  const n = Math.max(4, Math.round(len / 3.2));
  for (let i = 0; i < n; i++) {
    const x = -wd.rx + 3 + (i * (2 * wd.rx - 6)) / (n - 1);
    const top = i % 2 === 0;
    const h = wd.rz * 0.8;
    const y0 = top ? -(wd.rz - 1.7) * Math.sqrt(Math.max(0.1, 1 - (x / (wd.rx - 1.7)) ** 2)) : (wd.rz - 1.7) * Math.sqrt(Math.max(0.1, 1 - (x / (wd.rx - 1.7)) ** 2));
    const s = top ? 1 : -1;
    a.push(`<path d="M${f1(x - 1.2)} ${f1(y0)}C${f1(x - 1.4)} ${f1(y0 + s * h * 0.5)} ${f1(x + 1.5)} ${f1(y0 + s * h * 0.55)} ${f1(x + 0.6)} ${f1(y0 + s * h * 0.95)}C${f1(x + 1.8)} ${f1(y0 + s * h * 0.5)} ${f1(x - 0.8)} ${f1(y0 + s * h * 0.45)} ${f1(x + 1.2)} ${f1(y0)}" fill="${accent ? "#f8aa06" : "#e7c98a"}" class="ink" style="stroke-width:.5px"/>`);
  }
  a.push(`</g></g>`);
  o.push(a.join(""));
  o.push(`<path d="${wd.path}" class="ink" fill="none"/>`);
  return wrap(name, o.join(""));
}

/** Kidney (bean) outline in local (u,v-down) units: half length L, half width W, with a dent on the lower side. */
export function beanPts(L, W, scale = 1, n = 24) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * L * scale;
    let y = Math.sin(a) * W * scale;
    if (y > 0) y *= 1 - 0.28 * Math.cos((x / (L * scale)) * (Math.PI / 2)) ** 2;      // dent on the lower side
    pts.push([x, y - 0.12 * W * scale * Math.cos((x / (L * scale)) * (Math.PI / 2)) ** 2 * (y < 0 ? 0 : 0)]);
  }
  return pts;
}
/** Mitochondrion drawn as a bean with a double membrane and folded cristae. 2D art on the face plane with flat thickness. */
export function beanArt(L, W, level = 2, accent = false) {
  const body = O.smoothPath(beanPts(L, W), true);
  const inner = O.smoothPath(beanPts(L, W, 0.8), true);
  const a = [];
  a.push(`<path d="${body}" fill="#c9b27c" class="ink" style="stroke-width:.85px" transform="translate(0 2)"/>`);
  a.push(`<path d="${body}" fill="${accent ? "#ffe6a0" : "#f6e4b4"}" class="ink" style="stroke-width:.85px"/>`);
  a.push(`<path d="${inner}" fill="${accent ? "#ffd77a" : "#fbf1d4"}" class="ink" style="stroke-width:.55px"/>`);
  const n = Math.max(4, Math.round(L / 2.7));
  for (let i = 0; i < n; i++) {
    const t = -0.74 + (1.48 * i) / (n - 1);
    const x = t * L;
    const top = i % 2 === 0;
    const yEdge = (top ? -1 : 1) * W * 0.8 * Math.sqrt(Math.max(0.05, 1 - (x / (L * 0.8)) ** 2)) * (top ? 1 : 0.84);
    const s = top ? 1 : -1;
    const depth = W * (0.62 + (level / 8) * 0.12);
    a.push(`<path d="M${f1(x - 1.1)} ${f1(yEdge)}C${f1(x - 1.6)} ${f1(yEdge - s * depth * 0.4)} ${f1(x + 1.4)} ${f1(yEdge - s * depth * 0.6)} ${f1(x + 0.5)} ${f1(yEdge - s * depth * 0.98)}C${f1(x + 1.9)} ${f1(yEdge - s * depth * 0.6)} ${f1(x - 0.6)} ${f1(yEdge - s * depth * 0.4)} ${f1(x + 1.1)} ${f1(yEdge)}" fill="${accent ? "#f8aa06" : "#e8c98a"}" class="ink" style="stroke-width:.5px"/>`);
  }
  return a.join("");
}
function bean2d(name, cx, cz, dn, L, W, rot = 0, accent = false) {
  reg(name, cx, cz, dn);
  const M = FM(cx, cz, dn);
  return wrap(name, `<g transform="${M}"><g transform="rotate(${rot})" data-part="${name}-art">${beanArt(L, W, 2, accent)}</g></g>`);
}

/* ---------------- lysosome (acid vesicle) ---------------- */
function lyso(name, cx, cz, dn, rad) {
  reg(name, cx, cz, dn);
  const e = E(cx, cz, dn, [rad, rad, rad], { steps: 36 });
  const o = [S(e, { tone: "hi", className: "acid", crease: "none" })];
  // enzyme dots on the face
  const dots = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.9, rr = rad * (0.25 + 0.5 * ((i * 0.37) % 1));
    dots.push(cp(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, dn + rad * 0.7));
  }
  o.push(Dm(dots, { size: 0.55, tone: "hi" }));
  return wrap(name, o.join(""));
}

/* ---------------- ribosomes + free dots ---------------- */
function ribosomes() {
  const o = [];
  seed = 3;
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 70, z = (rnd() - 0.5) * 72, dn = (rnd() - 0.3) * 20;
    if (Math.hypot(x, z * 0.92) > 41) continue;
    pts.push(`<g data-rib><circle cx="${f1(cp(x, z, dn)[0])}" cy="${f1(cp(x, z, dn)[1])}" r="0.85" class="f-dk" style="stroke-width:.3px"/></g>`);
  }
  return `<g data-part="ribosomes">${pts.join("")}</g>`;
}

export function cellInside() {
  const items = [];
  const push = (key, svg) => items.push({ key, svg });
  push(0, er());
  push(1, vacuole());
  push(2, nucleus());
  push(3, ribosomes());
  push(4, bean2d("mito1", -4, -34, 10, 13, 7.2, -6));
  push(5, bean2d("mito2", 38, 17, 4, 10, 5.6, 28));
  push(6, golgi());
  push(7, lyso("lyso1", -9, -14, 10, 5.6));
  push(8, lyso("lyso2", 26, 33, 6, 4.4));
  push(9, lyso("lyso3", -45, 20, 14, 4.2));
  items.sort((a, b) => a.key - b.key);
  return items.map((i) => i.svg).join("");
}
