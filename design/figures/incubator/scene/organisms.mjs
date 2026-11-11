// The living part of the world: the colony on the agar (ch-colony), one opened hero cell (ch-cell) and its mitochondrion (ch-mito).
// Each level is drawn in the same world units but under its own magnified projection (ctx.nest), then shrunk back by a transform,
// so the kit's 0.1 px rounding, curve sampling and stroke weights stay right at every zoom stop.
import { k, G, P, S, Ln, Dm, at, r1, r2, pathOf, nest, DISH, AGAR_Z, bbAdd, bbBall, bbCircleH } from "../ctx.mjs";
import { mulberry } from "./interior.mjs";

const RAD = Math.PI / 180;
const sA = Math.sin(P.azimuth * RAD), cA = Math.cos(P.azimuth * RAD);
const E1 = [sA, -cA, 0];      // screen right, horizontal
const NV = [cA, sA, 0];       // toward the viewer, horizontal
/** Point on a viewer-facing vertical plane through c: u to the right, v up, w toward the viewer. */
const pl = (c, u, v, w = 0) => [c[0] + u * E1[0] + w * NV[0], c[1] + u * E1[1] + w * NV[1], c[2] + v];
const poly = (pts, closed = true) => pathOf(pts, closed);
const PTS = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2));

const circleOnFace = (Pr, c, rho, n = 56) => PTS(n, (a) => k.iso(pl(c, rho * Math.cos(a), rho * Math.sin(a)), Pr));
const shadowOf = (Pr, cx, cy, r) => `<path class="cshadow" d="${k.ring(cx, cy, r, 0.05, Pr, 36)}"/>`;
const dotsIn = (Pr, c, rho, n, seed, keep = () => true) => {
  const rnd = mulberry(seed), out = [];
  for (let i = 0; i < n * 4 && out.length < n; i++) { const a = rnd() * 6.283, rr = Math.sqrt(rnd()) * rho; const u = rr * Math.cos(a), v = rr * Math.sin(a); if (keep(u, v)) out.push(k.iso(pl(c, u, v, 0.05), Pr)); }
  return out;
};

/* ----------------------------------------------------------- mitochondrion (ch-mito) ----------------------------------------------------------- */
function mitochondrion(parent, anchor3, id) {
  const lv = nest(parent.P, anchor3, 3.4);
  const Pm = lv.P, kk = k.cameraOf(Pm).k;
  const L = 10, Rr = 3.5;
  const c = [0, 0, 0];
  const o = [];
  // outer membrane: a turned capsule, tone warm
  const F = G.frameAlong(c, E1);
  const prof = [];
  for (let i = 0; i <= 16; i++) { const t = (i / 16) * 2 - 1; const r = Rr * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 3)), 1 / 3); prof.push([t * (L / 2), Math.max(r, 0.01), i > 0 && i < 16 ? 1 : 0]); }
  o.push(S(G.solidOf(prof, F, Pm, {}), { tone: "hi", className: "warm", crease: "none" }));
  // cut-open window on the viewer-facing side: stadium, outer membrane ring (ink) + inner membrane (marigold)
  const stad = (sx, sy, w = 1, n = 48) => PTS(n, (a) => {
    const t = Math.cos(a), s = Math.sin(a);
    const cx = Math.sign(t) * Math.pow(Math.abs(t), 0.62) * (L / 2) * kk * sx;
    const cy = Math.sign(s) * Math.pow(Math.abs(s), 0.62) * Rr * kk * sy * w;
    return [cx, cy];
  });
  const win = stad(0.9, 0.8);
  o.push(`<path class="f-matrix" d="${poly(win)}"/>`);
  const inner = stad(0.78, 0.6);
  o.push(`<path class="mito-inner" d="${poly(inner)}"/>`);
  // cristae: folds hanging from the inner membrane, alternating top and bottom
  const xs = [-0.58, -0.3, -0.02, 0.26, 0.54];
  const half = (L / 2) * kk * 0.78, hi_ = Rr * kk * 0.6;
  const fold = (i, x) => {
    const top = i % 2 === 0, X = x * half * 1.55, d = 0.12 * half * 1.5, h = hi_ * 1.38 * (0.9 + 0.1 * Math.sin(i * 2.1));
    const y0 = (top ? -1 : 1) * hi_ * Math.pow(Math.max(0.02, 1 - Math.pow(Math.abs(x) / 0.78 * 0.9, 3.2)), 0.31) * 0.98, y1 = y0 + (top ? 1 : -1) * h;
    return { path: `M${r1(X - d)} ${r1(y0)}C${r1(X - d * 1.7)} ${r1(y1)} ${r1(X + d * 1.7)} ${r1(y1)} ${r1(X + d)} ${r1(y0)}`, tip: [X, y1] };
  };
  const folds = xs.map((x, i) => fold(i, x));
  o.push(`<clipPath id="${id}-clip"><path d="${poly(inner)}"/></clipPath><path class="crista" clip-path="url(#${id}-clip)" d="${folds.map((f) => f.path).join("")}"/>`);
  // ATP synthase lollipops along the folds + matrix grain + mtDNA loop
  const lol = [];
  folds.forEach((f, i) => { const s = i % 2 === 0 ? 1 : -1; lol.push(`<circle cx="${r1(f.tip[0])}" cy="${r1(f.tip[1] - s * 0.35 * kk * 0.5)}" r="${r1(kk * 0.22)}"/>`); });
  o.push(`<g class="lolli">${lol.join("")}</g>`);
  const rnd = mulberry(5), grain = [];
  for (let i = 0; i < 30; i++) grain.push([(rnd() - 0.5) * 2 * half * 0.95, (rnd() - 0.5) * 2 * hi_ * 0.8]);
  o.push(`<g class="iso-dots" data-tone="lo">${grain.map(([x, y]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(kk * 0.06)}"/>`).join("")}</g>`);
  o.push(`<ellipse class="ink" cx="${r1(half * 0.18)}" cy="${r1(hi_ * 0.05)}" rx="${r1(kk * 0.5)}" ry="${r1(kk * 0.3)}" fill="none"/>`);
  // ATP tokens leaving the matrix (marigold coins)
  const coins = [[6.4, 1.9], [8.0, 3.6], [7.2, -0.7]];
  const atp = coins.map(([u, v], i) => `<g id="${id}-atp-${i}" class="coin-drift atp-speck-coin" style="animation-delay:${i * 0.9}s">${S(k.cylinder(u * E1[0], u * E1[1], 0.95, v, 0.26, Pm, 28, 0.04), { tone: "hi", className: "mari", lit: false })}</g>`);
  o.push(`<g id="${id}-atp">${atp.join("")}</g>`);
  o.push(Ln(poly([[half * 0.95, 0], [kk * 5.0, -kk * 0.2]], false), { tone: "lo", dotted: true }));
  // extents in the parent's coordinates
  const ext = [[-half * 1.1, -kk * 4.4], [kk * 9.2, Rr * kk * 1.1]];
  return { svg: lv.wrap(o.join(""), ` id="${id}"`), ext: ext.map((q) => parent.toParent(lv.toParent(q))), atpIds: coins.map((_, i) => `${id}-atp-${i}`) };
}

/* ----------------------------------------------------------- hero cell (ch-cell) ----------------------------------------------------------- */
function heroCell(pos, r, id) {
  const lv = nest(P, [pos[0], pos[1], AGAR_Z], 7);
  const Ph = lv.P, kk = k.cameraOf(Ph).k;
  const zc = r * 0.82, c = [0, 0, zc];
  const o = [];
  o.push(shadowOf(Ph, 0, 0, r * 1.12));
  o.push(S(G.sphereOf(c, r, Ph), { tone: "hi", className: "cream", crease: "none" }));
  // cut face: cytoplasm, cell wall ring, marigold membrane
  const rho = r * 0.965;
  o.push(`<path class="f-cut" d="${poly(circleOnFace(Ph, c, rho))}"/>`);
  o.push(`<path class="f-cut2" d="${poly(circleOnFace(Ph, c, rho * 0.86))}"/>`);
  o.push(`<path class="membrane" d="${poly(circleOnFace(Ph, c, rho * 0.93))}"/>`);
  o.push(`<path class="ink" d="${poly(circleOnFace(Ph, c, rho * 0.995))}"/>`);
  const keepOut = (u, v) => Math.hypot(u + 4.2, v + 0.4) > 6.6 && Math.hypot(u - 3.3, v - 2.8) > 5.2 && Math.hypot(u - 3.8, v + 6.4) > 5.1;
  o.push(Dm(dotsIn(Ph, c, rho * 0.88, 26, 31, keepOut), { size: 0.7, tone: "mid" }));
  // endoplasmic reticulum: two folded sheets, top left
  const er = [];
  for (let j = 0; j < 3; j++) { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(k.iso(pl(c, -9.2 + t * 7.2, 6.8 - j * 0.9 + Math.sin(t * 9 + j) * 0.38), Ph)); } er.push(pathOf(pts)); }
  o.push(Ln(er.join(""), { tone: "mid" }));
  // stomach vacuole ($SNACC): pale glass ball with marigold contents and a liquid level
  const vc = pl(c, -4.2, -0.4, 0.6), rv = 5.9;
  o.push(S(G.sphereOf(vc, rv, Ph), { tone: "hi", className: "water", crease: "none" }));
  {
    const [vx, vy] = k.iso(vc, Ph), R_ = rv * kk, lvl = vy + R_ * 0.12;
    const dy = lvl - vy, dx = Math.sqrt(R_ * R_ - dy * dy);
    o.push(`<path id="${id}-stomach" class="f-mari-hi" d="M${r1(vx - dx)} ${r1(lvl)}A${r1(R_)} ${r1(R_)} 0 0 0 ${r1(vx + dx)} ${r1(lvl)}Q${r1(vx + dx * 0.5)} ${r1(lvl - 1.4 * kk * 0.2)} ${r1(vx)} ${r1(lvl)}T${r1(vx - dx)} ${r1(lvl)}Z" style="stroke-width:.7px"/>`);
    o.push(Dm([[vx - R_ * 0.3, vy + R_ * 0.42], [vx + R_ * 0.1, vy + R_ * 0.55], [vx + R_ * 0.38, vy + R_ * 0.36], [vx - R_ * 0.08, vy + R_ * 0.3]], { size: 1.0, tone: "hi" }));
    o.push(`<path class="glass-hi" d="M${r1(vx - R_ * 0.62)} ${r1(vy - R_ * 0.25)}Q${r1(vx - R_ * 0.5)} ${r1(vy - R_ * 0.62)} ${r1(vx - R_ * 0.12)} ${r1(vy - R_ * 0.74)}" style="fill:none;stroke:#fff;stroke-width:1.6px;stroke-opacity:.9"/>`);
  }
  // nucleus with double envelope, pores and DNA
  const nc = pl(c, 3.3, 2.8, 0.4), rn = 4.3;
  o.push(S(G.sphereOf(nc, rn, Ph), { tone: "hi", className: "bone", crease: "none" }));
  {
    const [nx, ny] = k.iso(nc, Ph), R_ = rn * kk;
    o.push(`<circle class="ink2" cx="${r1(nx)}" cy="${r1(ny)}" r="${r1(R_ * 0.82)}" fill="none"/>`);
    const pores = PTS(10, (a) => [nx + R_ * 0.91 * Math.cos(a), ny + R_ * 0.91 * Math.sin(a)]);
    o.push(Dm(pores, { size: 0.9, tone: "hi" }));
    // DNA double helix crossing the nucleus
    const a = [], b = [], rungs = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, x = nx - R_ * 0.62 + t * R_ * 1.24, ph = t * Math.PI * 3.2;
      const y1 = ny + Math.sin(ph) * R_ * 0.26, y2 = ny + Math.sin(ph + Math.PI) * R_ * 0.26;
      a.push([x, y1]); b.push([x, y2]);
      if (i % 3 === 0 && i > 0 && i < 28) rungs.push(pathOf([[x, y1], [x, y2]]));
    }
    o.push(`<path id="${id}-dna" class="dna" d="${pathOf(a)}"/><path class="dna2" d="${pathOf(b)}"/><path class="ink3" d="${rungs.join("")}" style="stroke-width:.5px"/>`);
    o.push(`<circle class="mari-dot" cx="${r1(nx + R_ * 0.3)}" cy="${r1(ny - R_ * 0.5)}" r="${r1(R_ * 0.08)}"/>`);
  }
  // lysosomes
  for (const [u, v] of [[-7.6, -5.7], [8.1, -0.6]]) o.push(S(G.sphereOf(pl(c, u, v, 0.5), 1.25, Ph), { tone: "hi", className: "acid", crease: "none" }));
  // mitochondrion, lower right of the cut face
  const mpos = pl(c, 2.0, -5.8, 0.6);
  const mito = mitochondrion(lv, mpos, "ch-mito");
  o.push(mito.svg);
  const rim = circleOnFace(Ph, c, rho);
  bbAdd("ch-cell", rim.map(lv.toParent));
  bbBall("ch-cell", c, r, Ph, lv.toParent);
  bbAdd("ch-mito", mito.ext);
  return { svg: lv.wrap(o.join(""), ` id="${id}"`), atpIds: mito.atpIds, mito };
}

/* ----------------------------------------------------------- colony cells ----------------------------------------------------------- */
function plainCell(spec) {
  const { pos, r, cls, kind } = spec;
  const lv = nest(P, [pos[0], pos[1], AGAR_Z], 4);
  const Pc = lv.P, kk = k.cameraOf(Pc).k;
  const o = [shadowOf(Pc, 0, 0, r * 1.12)];
  o.push(S(G.sphereOf([0, 0, r * 0.85], r, Pc), { tone: "hi", className: cls, crease: "none" }));
  const [cx, cy] = k.iso([0, 0, r * 0.85], Pc);
  // the nucleus shows through the membrane as a pale disc (no pupil dot)
  o.push(`<ellipse cx="${r1(cx - r * 0.12 * kk)}" cy="${r1(cy - r * 0.1 * kk)}" rx="${r1(r * 0.36 * kk)}" ry="${r1(r * 0.32 * kk)}" style="fill:#d8c399;fill-opacity:.55;stroke:var(--ink);stroke-width:.5px;stroke-opacity:.6"/>`);
  if (kind === "mergeB") {
    // where the two cells fuse: a marigold dot of energy passing through the neck
    o.push(`<circle class="mari-dot idle-blink" cx="${r1(cx - r * 0.95 * kk)}" cy="${r1(cy + r * 0.15 * kk)}" r="${r1(r * 0.13 * kk)}"/>`);
  }
  if (kind === "hungry") {
    // cracked and leaking: a branching crack across the front, a dashed (leaking) membrane ring, pale droplets
    const c = [0, 0, r * 0.85];
    const cr = [[-0.1, 0.92], [0.12, 0.6], [-0.1, 0.34], [0.14, 0.05], [-0.08, -0.22], [0.1, -0.5]].map(([u, v]) => k.iso(pl(c, u * r, v * r, Math.sqrt(Math.max(0.02, 1 - u * u - v * v)) * r), Pc));
    const br = [[0.12, 0.6], [0.4, 0.5], [0.58, 0.28]].map(([u, v]) => k.iso(pl(c, u * r, v * r, Math.sqrt(Math.max(0.02, 1 - u * u - v * v)) * r), Pc));
    o.push(`<path class="crack" d="${pathOf(cr)}${pathOf(br)}"/>`);
    o.push(`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * kk * 1.06)}" class="leak"/>`);
    o.push(Dm([[cx + r * kk * 1.2, cy + r * kk * 0.1], [cx + r * kk * 1.32, cy + r * kk * 0.38], [cx - r * kk * 1.15, cy + r * kk * 0.5]], { size: 1.0, tone: "mid" }));
  }
  bbBall("ch-colony", [0, 0, r * 0.85], r * 1.1, Pc, lv.toParent);
  // the outer group is the animation handle (CSS transforms), the inner one carries the nesting transform
  const id = spec.id ? ` id="${spec.id}"` : "";
  return { svg: `<g${id} class="cw ${spec.anim || ""}" data-cell="${kind}">${lv.wrap(o.join(""))}</g>`, depth: pos[0] * cA + pos[1] * sA };
}

export function colony() {
  const pc = [120, -42], dd = 6.1;       // merging pair: two cells whose membranes overlap
  const specs = [
    { kind: "hungry", id: "cell-hungry", anim: "wob-1", pos: [76, 8], r: 8.6, cls: "steel" },
    { kind: "mergeA", id: "cell-merge-a", anim: "merge-a", pos: [pc[0] - dd * E1[0], pc[1] - dd * E1[1]], r: 8.2, cls: "warm" },
    { kind: "mergeB", id: "cell-merge-b", anim: "merge-b", pos: [pc[0] + dd * E1[0], pc[1] + dd * E1[1]], r: 8.2, cls: "warm" },
    { kind: "bud", anim: "wob-2", pos: [102, 24], r: 4.6, cls: "bone" },
    { kind: "small", anim: "wob-3", pos: [124, 0], r: 6.6, cls: "bone" },
    { kind: "small", anim: "wob-2", pos: [66, -30], r: 4.6, cls: "warm" },
  ];
  const hero = { pos: [100, -20], r: 13 };
  const items = specs.map(plainCell).map((c) => ({ depth: c.depth + (c.svg.includes("cell-merge-b") ? 1e-3 : 0), svg: c.svg }));
  const hc = heroCell(hero.pos, hero.r, "ch-cell");
  items.push({ depth: hero.pos[0] * cA + hero.pos[1] * sA, svg: `<g class="cw idle-breathe">${hc.svg}</g>` });
  items.sort((a, b) => a.depth - b.depth);
  // tiny marigold ATP specks drifting above the agar
  const specks = [[90, -48], [112, -26], [78, -4], [124, -8], [96, 14], [66, -30]].map(([x, y], i) => {
    const [sx, sy] = at([x, y, AGAR_Z + 4 + (i % 3) * 3]);
    return `<circle class="atp-speck" style="animation-delay:${(i * 1.3).toFixed(1)}s" cx="${r1(sx)}" cy="${r1(sy)}" r="1.1"/>`;
  }).join("");
  // a marigold ring on the agar marks the specimen the story opens up
  const ring = `<path class="spec-ring idle-blink" d="${k.ring(hero.pos[0], hero.pos[1], hero.r * 1.35, AGAR_Z + 0.05, P, 48)}"/>`;
  bbCircleH("ch-colony", [DISH.cx, DISH.cy, AGAR_Z], DISH.r - 8);
  // the colony group includes the hero; ch-cell lives inside it (id on the nested group)
  return { svg: `<g id="ch-colony">${ring}${items.map((i) => i.svg).join("")}${specks}</g>`, heroId: "ch-cell", atpIds: hc.atpIds };
}
