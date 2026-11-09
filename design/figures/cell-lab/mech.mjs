// Dynamic mechanisms shared by the build (rest pose) and the live page (per frame). Pure functions of (k, P, GEO).
// In the page this file is inlined with `export` stripped; `k` is the kit namespace object.
export function makeMech(k, P, GEO) {
  const { MC } = GEO;
  const s2 = Math.SQRT1_2;
  const W3 = (u, v, z) => [MC[0] + (u + v) * s2, MC[1] + (v - u) * s2, z];
  const A = (p) => k.iso(p, P);
  const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
  const pts = (list, closed) => list.map((p, i) => `${i ? "L" : "M"}${f1(p[0])} ${f1(p[1])}`).join("") + (closed ? "Z" : "");
  const S = (paths, style) => k.solidSvg(paths, style);
  const rr = (u0, v0, w, d, r = 0.6, steps = 2) => {
    r = Math.max(0, Math.min(r, w / 2, d / 2));
    const out = [];
    for (const [cu, cv, a0] of [[u0 + w - r, v0 + r, -90], [u0 + w - r, v0 + d - r, 0], [u0 + r, v0 + d - r, 90], [u0 + r, v0 + r, 180]])
      for (let i = 0; i <= steps; i++) { const a = ((a0 + (90 * i) / steps) * Math.PI) / 180; const u = cu + Math.cos(a) * r, v = cv + Math.sin(a) * r; out.push([MC[0] + (u + v) * s2, MC[1] + (v - u) * s2]); }
    return out;
  };
  const box = (u0, v0, w, d, z, h, o = {}) => S(k.extrude(rr(u0, v0, w, d, o.r ?? 0.5), z, h, P, { bevel: o.bevel ?? 0.2 }), { tone: o.tone || "hi", className: o.cls || "", crease: o.crease || "faint" });
  const cyl = (u, v, r, z, h, o = {}) => { const p = W3(u, v, 0); return S(k.cylinder(p[0], p[1], r, z, h, P, o.steps || 24, o.bevel ?? 0.2), { tone: o.tone || "hi", className: o.cls || "", crease: o.crease || "faint" }); };
  const depthV = (v) => v;
  const TAU = Math.PI * 2;

  /** Ferris wheel (Krebs cycle): axis along v. ang in radians. carrying: array of booleans per gondola (NADH cell on board). */
  function wheel(ang, carrying = [], glow = -1) {
    const w = GEO.wheel; const { u, v, z, R, n, rv } = w;
    const rim = (vv, rad) => Array.from({ length: 64 }, (_, i) => { const t = (i / 64) * TAU; return A(W3(u + Math.cos(t) * rad, vv, z + Math.sin(t) * rad)); });
    const band = (vv) => `<path d="${pts(rim(vv, R + 1.1), true)}${pts(rim(vv, R - 1.1).reverse(), true)}" fill-rule="evenodd" class="f-cream" style="stroke-width:.8px"/>`;
    const out = [];
    // back rim + spokes
    out.push(band(v - rv));
    for (let i = 0; i < n; i++) { const t = ang + (i / n) * TAU; out.push(`<path class="ink3" style="stroke-width:.6px" d="${pts([A(W3(u, v - rv, z)), A(W3(u + Math.cos(t) * (R - 1), v - rv, z + Math.sin(t) * (R - 1)))])}"/>`); }
    // gondolas hang (always upright) between the rims
    const gs = [];
    for (let i = 0; i < n; i++) {
      const t = ang + (i / n) * TAU;
      const gu = u + Math.cos(t) * R, gz = z + Math.sin(t) * R;
      gs.push({ i, gu, gz, key: gz });
    }
    gs.sort((a, b) => a.key - b.key);
    // front rim + spokes + hub (gondolas hang in front of it, below)
    out.push(band(v + rv));
    for (let i = 0; i < n; i++) { const t = ang + (i / n) * TAU; out.push(`<path class="ink3" style="stroke-width:.6px" d="${pts([A(W3(u, v + rv, z)), A(W3(u + Math.cos(t) * (R - 1), v + rv, z + Math.sin(t) * (R - 1)))])}"/>`); }
    // hub: small drum along v
    const hubC = A(W3(u, v + rv + 0.4, z));
    out.push(`<circle cx="${f1(hubC[0])}" cy="${f1(hubC[1])}" r="2.7" class="f-tan"/><circle cx="${f1(hubC[0])}" cy="${f1(hubC[1])}" r="1.1" class="f-mari"/>`);
    // tooth marks around the rim (gear teeth) to show rotation
    for (let i = 0; i < n * 2; i++) { const t = ang + (i / (n * 2)) * TAU + 0.2; const p0 = A(W3(u + Math.cos(t) * (R + 1.1), v + rv, z + Math.sin(t) * (R + 1.1))), p1 = A(W3(u + Math.cos(t) * (R + 2.2), v + rv, z + Math.sin(t) * (R + 2.2))); out.push(`<path class="ink2" style="stroke-width:.55px" d="${pts([p0, p1])}"/>`); }
    // gondolas: hang upright from the front rim, in front of it, each with an engraved label
    for (const g of gs) {
      const hot = glow === g.i || carrying[g.i];
      const vg = v + rv + 0.9;
      const h1 = `<path class="ink" style="stroke-width:.75px" d="${pts([A(W3(g.gu - 1.9, v + rv, g.gz)), A(W3(g.gu - 1.9, vg + 0.3, g.gz - 2.0))])}"/>`;
      const h2 = `<path class="ink" style="stroke-width:.75px" d="${pts([A(W3(g.gu + 1.9, v + rv, g.gz)), A(W3(g.gu + 1.9, vg + 0.3, g.gz - 2.0))])}"/>`;
      const body = box(g.gu - 3.0, vg, 6.0, 4.2, g.gz - 6.6, 4.6, { cls: hot ? "mari" : "", bevel: 0.25, r: 0.9 });
      const Mx = planeMat(W3(g.gu - 2.6, vg + 4.21, g.gz - 3.0), [s2, -s2, 0], [0, 0, -1]);
      const lab = `<g transform="${Mx}"><text x="2.6" y="0" text-anchor="middle" class="txt" style="font-size:1.75px;font-weight:700">${w.labels[g.i]}</text><path d="M-0.3 0.9L5.5 0.9" class="ink3" style="stroke-width:.3px"/></g>`;
      const cell = carrying[g.i] ? `<g class="mari">${S(k.cylinder(W3(g.gu, vg + 2, 0)[0], W3(g.gu, vg + 2, 0)[1], 1.2, g.gz - 2.0, 2.2, P, 12, 0.1), { tone: "hi" })}</g>` : "";
      out.push(h1, h2, body, lab, cell);
    }
    return out.join("");
  }
  function planeMat(o3, e1, e2) {
    const o = A(o3), a = A([o3[0] + e1[0], o3[1] + e1[1], o3[2] + e1[2]]), b = A([o3[0] + e2[0], o3[1] + e2[1], o3[2] + e2[2]]);
    const r = (x) => (Math.round(x * 1000) / 1000).toString();
    return `matrix(${r(a[0] - o[0])} ${r(a[1] - o[1])} ${r(b[0] - o[0])} ${r(b[1] - o[1])} ${r(o[0])} ${r(o[1])})`;
  }

  /** c-ring rotor of the ATP synthase (water turbine). ang: rotor angle (rad). speed 0..1 draws motion arcs. */
  function rotor(ang, speed = 0) {
    const t = GEO.turb; const { u, v, z0 } = t;
    const out = [];
    const c = W3(u, v, 0);
    out.push(S(k.cylinder(c[0], c[1], 9.6, z0, 2.6, P, 36, 0.3), { tone: "hi", className: "steel" }));
    const N = t.n;
    const blades = [];
    for (let i = 0; i < N; i++) {
      const a = ang + (i / N) * TAU;
      const cu = u + Math.cos(a) * 7.4, cv = v + Math.sin(a) * 7.4;
      // paddle: tangential length 3.6, radial thickness 1.5, rotated with a
      const ca = Math.cos(a), sa = Math.sin(a);
      const half = [1.7, 0.75];
      const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
        const lu = cu + (-sa) * half[0] * sx * 0 + (ca * half[1] * sy) + (-sa * half[0] * sx);
        const lv = cv + (ca * half[0] * sx) + (sa * half[1] * sy);
        return [MC[0] + (lu + lv) * s2, MC[1] + (lv - lu) * s2];
      });
      blades.push({ ring, key: (MC[0] + (cu + cv) * s2) + (MC[1] + (cv - cu) * s2), mark: i === 0 });
    }
    blades.sort((a, b) => a.key - b.key);
    for (const b of blades) out.push(S(k.extrude(b.ring, z0 + 2.6, 5.2, P, { bevel: 0.2 }), { tone: "hi", className: b.mark ? "mari" : "bone" }));
    // hoop (cap ring) as a thin outline ring
    const hoop = Array.from({ length: 48 }, (_, i) => A(W3(u + Math.cos((i / 48) * TAU) * 9.6, v + Math.sin((i / 48) * TAU) * 9.6, z0 + 7.8)));
    out.push(`<path class="ink" style="stroke-width:.8px" d="${pts(hoop, true)}"/>`);
    // motion arcs
    if (speed > 0.05) {
      for (let j = 0; j < 3; j++) {
        const a0 = ang * 1.0 + j * (TAU / 3), span = 0.9 * speed;
        const arc = Array.from({ length: 12 }, (_, i) => { const a = a0 - (i / 11) * span; return A(W3(u + Math.cos(a) * 10.6, v + Math.sin(a) * 10.6, z0 + 8.2)); });
        out.push(`<path d="${pts(arc)}" fill="none" style="stroke:#f8aa06;stroke-width:1.8px;stroke-linecap:round;opacity:${f1(0.35 + 0.5 * speed)}"/>`);
      }
    }
    // hub + shaft marker
    const hc = A(W3(u, v, z0 + 8));
    out.push(`<circle cx="${f1(hc[0])}" cy="${f1(hc[1])}" r="2.3" class="f-tan"/><circle cx="${f1(hc[0] + Math.cos(ang) * 1.0)}" cy="${f1(hc[1] + Math.sin(ang) * 0.5)}" r=".7" class="inkf"/>`);
    return out.join("");
  }

  /** F1 head: 3 lobes on a shaft, ratcheting in 3 steps. phase = (step + frac) in units of 120 degrees. */
  function f1head(phase) {
    const t = GEO.turb; const { u, v, zf1 } = t;
    const out = [];
    const c = W3(u, v, 0);
    // gear (ratchet) disc below the head with teeth
    out.push(S(k.cylinder(c[0], c[1], 6.2, zf1 - 2.2, 1.8, P, 30, 0.2), { tone: "hi", className: "steel" }));
    const base = phase * (TAU / 3);
    for (let i = 0; i < 12; i++) { const a = base + (i / 12) * TAU; const p = A(W3(u + Math.cos(a) * 6.2, v + Math.sin(a) * 6.2, zf1 - 0.4)); out.push(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r=".5" class="inkf"/>`); }
    // lobes
    const lobes = [0, 1, 2].map((i) => { const a = base + (i / 3) * TAU + 0.5; const lu = u + Math.cos(a) * 3.9, lv = v + Math.sin(a) * 3.9; const p = W3(lu, lv, 0); return { lu, lv, key: p[0] + p[1], x: p[0], y: p[1] }; }).sort((a, b) => a.key - b.key);
    const shaftTop = W3(u, v, 0);
    out.push(S(k.cylinder(shaftTop[0], shaftTop[1], 1.6, zf1, 4, P, 14, 0), { tone: "hi", className: "tan" }));
    for (const l of lobes) out.push(S(k.cylinder(l.x, l.y, 3.5, zf1 + 0.2, 8.4, P, 22, 0.4), { tone: "hi", className: "warm" }));
    out.push(S(k.cylinder(shaftTop[0], shaftTop[1], 3.2, zf1 + 8.6, 1.4, P, 20, 0.2), { tone: "hi", className: "mari" }));
    const mk = A(W3(u + Math.cos(base + 0.5) * 2.1, v + Math.sin(base + 0.5) * 2.1, zf1 + 10.0));
    out.push(`<circle cx="${f1(mk[0])}" cy="${f1(mk[1])}" r=".8" class="inkf"/>`);
    return out.join("");
  }

  const coin = (x, y, z, r = 2.2, label = true) => {
    const s = S(k.cylinder(x, y, r, z, 0.9, P, 20, 0.2), { tone: "hi", className: "mari" });
    return s;
  };
  const drop = (p3, r = 0.95) => { const p = A(p3); return `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r}" class="f-none" style="fill:#d9eef8;stroke:#161412;stroke-width:.5px"/>`; };
  const spark = (p3, s = 1.7) => { const p = A(p3); const [x, y] = p; return `<path d="M${f1(x)} ${f1(y - s * 1.6)}L${f1(x + s * 0.5)} ${f1(y - s * 0.4)}L${f1(x + s * 1.6)} ${f1(y)}L${f1(x + s * 0.5)} ${f1(y + s * 0.4)}L${f1(x)} ${f1(y + s * 1.6)}L${f1(x - s * 0.5)} ${f1(y + s * 0.4)}L${f1(x - s * 1.6)} ${f1(y)}L${f1(x - s * 0.5)} ${f1(y - s * 0.4)}Z" class="f-mari-hi"/>`; };
  const puff = (p3, r, a) => { const p = A(p3); return `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(r)}" style="fill:#e8e2d2;stroke:#9d8e6c;stroke-width:.5px;opacity:${f1(a)}"/>`; };
  return { wheel, rotor, f1head, coin, drop, spark, puff, W3, A, box, cyl, planeMat, pts, f1, S };
}
