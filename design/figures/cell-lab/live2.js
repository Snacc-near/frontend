/* ---------------- cell-level helpers (screen space) ---------------- */
const CS = GEOM.CELLSCR, KS = GEOM.KS;
const cpx = (dx, dz, dn = 0) => [CS[0] + dx * KS, CS[1] - dz * 0.866 * KS + dn * 0.5 * KS];
const orgEl = (n) => $(`[data-org="${n}"]`);
const orgS = (n) => ORG[n].screen;
function lift(n, a) { const e = orgEl(n); if (!e) return; if (a <= 0.001) { e.style.transform = ""; e.classList.remove("is-lit"); return; } e.style.transform = `translate(0px,${f1(-9 * a)}px) scale(${f1(1 + 0.26 * a)})`; e.classList.add("is-lit"); }
const dot = (p, r, fill, sw = 0.7) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r}" class="ink" style="fill:${fill};stroke-width:${sw}px"/>`;
const gline = (pts, sw, col, extra = "") => `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${f1(p[0])} ${f1(p[1])}`).join("")}" fill="none" style="stroke:${col};stroke-width:${sw}px;stroke-linecap:round;stroke-linejoin:round;${extra}"/>`;
const bez = (a, b, c, d, t) => { const u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]; };
const arcS = (a, b, h, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * h];
const fx = (s) => { if (dyn["cell-fx"]) dyn["cell-fx"].innerHTML = fxBase() + s; };
const fxBase = () => { let s = ""; for (let i = 0; i < Math.min(8, S.gen); i++) { const p = SCARS[i]; s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.8" class="f-top"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.2" fill="none" class="ink"/>`; } return s; };
const shelfBay = (i) => { const p = W3 ? M.W3 : null; return Aw([112 + 4 + i * 12.5 + 5.2, 50 + 11, 9]); };
const shelfVial = () => Aw([112 + 46, 50 + 12, 12]);
const needleSet = (name, cx, cy, r, turn, col) => { const e = $(`[data-needle="${name}"]`); if (!e) return; const a = (-135 + clamp(turn) * 270) * Math.PI / 180; e.setAttribute("d", `M${cx} ${cy}L${f1(cx + Math.sin(a) * r * 0.74)} ${f1(cy - Math.cos(a) * r * 0.74)}`); if (col) e.style.stroke = col; };
const NEEDLES = { pH: [10, 17, 8], TURGOR: [29, 17, 8], BMR: [48, 17, 8], TEMP: [65, 17, 7] };
const gauge = (n, turn, col) => needleSet(n, ...NEEDLES[n], turn, col);

/* lens control */
function lensOn(name, t, target, a0 = 0.05, a1 = 0.94) {
  const sc = SCENES[name]; if (!sc) return;
  const op = sstep(0, a0, t) * (1 - sstep(a1, 1, t));
  dyn.lens.setAttribute("opacity", f1(op));
  dyn["lens-scene"].innerHTML = `<g transform="translate(${LENS.cx} ${LENS.cy - 4}) scale(1.1)">${sc.draw(t)}</g>`;
  const L = dyn["lens-leader"]; L.setAttribute("opacity", f1(op));
  const to = target ? orgS(target) : cpx(0, 0);
  const from = [LENS.cx - LENS.r * 0.92, LENS.cy + LENS.r * 0.38];
  L.innerHTML = gline([from, [lerp(from[0], to[0], 0.5), lerp(from[1], to[1], 0.5) - 14], to], 1.1, "#161412", "stroke-dasharray:2.6 2.6") + `<circle cx="${f1(to[0])}" cy="${f1(to[1])}" r="${f1(5 + Math.sin(t * 20))}" fill="none" style="stroke:#f8aa06;stroke-width:1.8px"/>`;
  let st = sc.steps[0][1]; for (const [a, txt] of sc.steps) if (t >= a) st = txt;
  chip(sc.title, st, sc.note);
}
function lensOff() { if (dyn.lens) dyn.lens.setAttribute("opacity", "0"); if (dyn["lens-leader"]) dyn["lens-leader"].setAttribute("opacity", "0"); chip(null); }

/* thesis receipt printer */
function receipt(p) { // p 0..1 paper out; prints "in = out + stored ✓"
  const e = dyn.receipt; if (!e) return;
  if (p <= 0.001) { e.innerHTML = ""; return; }
  const T = M.planeMat([-66 + 8, 52 + 9.5, 14.9], [1, 0, 0], [0, 1, 0]);
  const L = 20 * clamp(p * 1.1);
  const rows = p > 0.5 ? `<text x="1.4" y="3.4" style="font:600 1.5px ui-monospace,Menlo,monospace;fill:#161412">in  = out + stored</text><text x="1.4" y="6.6" style="font:700 2.1px ui-monospace,Menlo,monospace;fill:#2f7a26">✓ balanced</text><path d="M1.4 8.6L22 8.6" class="ink3" style="stroke-width:.3px"/>` : "";
  e.innerHTML = `<g transform="${T}"><rect x="0" y="0" width="24" height="${f1(L)}" fill="#fffdf6" class="ink" style="stroke-width:.5px"/>${rows}</g>`;
}

/* zone looks: heat shimmer + HSP barrels (Fever), frost + extra transporter doors (Hypothermia) */
function zoneFx(now) {
  const g = dyn["glass-fx"]; if (!g) return;
  const T = now / 1000; let s = "";
  const jar = [CS[0], CS[1] - 4];
  if (S.zone === "Fever") {
    for (let i = 0; i < 5; i++) { const x = jar[0] - 70 + i * 35; const pts = Array.from({ length: 12 }, (_, j) => [x + Math.sin(T * 2 + j * 0.8 + i) * 4, jar[1] - 120 - j * 7]); s += gline(pts, 1.4, "#e8762b", `opacity:${f1(0.45)}`); }
    for (let i = 0; i < 3; i++) { const p = [CS[0] - 30 + i * 30, CS[1] + 92 + (i % 2) * 6]; s += `<rect x="${f1(p[0] - 7)}" y="${f1(p[1] - 12)}" width="14" height="14" rx="3" class="ink" style="fill:#e8762b;stroke-width:.9px"/><path d="M${f1(p[0] - 7)} ${f1(p[1] - 8)}L${f1(p[0] + 7)} ${f1(p[1] - 8)}M${f1(p[0] - 7)} ${f1(p[1] - 3)}L${f1(p[0] + 7)} ${f1(p[1] - 3)}" class="ink" style="stroke-width:.6px"/><text x="${f1(p[0])}" y="${f1(p[1] - 4.6)}" text-anchor="middle" style="font:700 4px ui-monospace,monospace;fill:#fff">HSP</text>`; }
  } else if (S.zone === "Hypothermia") {
    const pts = [[-60, -40], [-52, 10], [-62, 60], [-50, 100]]; for (let i = 0; i < 4; i++) { const b = [jar[0] - 118 + i * 3, jar[1] - 26 + i * 52]; s += `<path d="M${f1(b[0])} ${f1(b[1])}l8 -14l4 8l8 -10l-2 16l7 4l-9 4l3 10l-9 -6l-5 9l-3 -10l-9 -2z" fill="#e4f3fb" class="ink" style="stroke:#6aa3c4;stroke-width:.8px;opacity:.9"/>`; s += `<path d="M${f1(jar[0] + 112 - i * 3)} ${f1(jar[1] - 18 + i * 56)}l-8 -14l-4 8l-8 -10l2 16l-7 4l9 4l-3 10l9 -6l5 9l3 -10l9 -2z" fill="#e4f3fb" class="ink" style="stroke:#6aa3c4;stroke-width:.8px;opacity:.9"/>`; }
    for (let i = 0; i < 3; i++) { const p = cpx(-46 + i * 3, -14 + i * 14, 0); s += `<rect x="${f1(p[0] - 3)}" y="${f1(p[1] - 5)}" width="6" height="10" rx="2" fill="#a9d4ec" class="ink" style="stroke-width:.8px"/><path d="M${f1(p[0])} ${f1(p[1] - 3)}L${f1(p[0])} ${f1(p[1] + 3)}" class="ink" style="stroke-width:.6px"/>`; }
  }
  g.innerHTML = s;
}

/* ---------------- per-action cell effects ---------------- */
const route3 = (pts) => route(pts);
const FEED_R = route3(FEED_ROUTE), ATT_R = route3(GEOM.ATTEST_ROUTE);
const bay = (i, n, col) => { const e = $(`[data-bay="${["ember", "ice", "glow"][i]}"]`); if (!e) return; const p = Aw([112 + 4 + i * 12.5 + 5.2, 50 + 11, 8]); let s = ""; for (let j = 0; j < n; j++) s += dot([p[0] - 4 + j * 4.4, p[1] - 1 - (j % 2) * 1.2], 2.2, col, 0.6); e.innerHTML = s; };
const spores = { ember: 0, ice: 0, glow: 0 };

const ANIMS = {
  atp: {
    dur: ATP_DUR,
    update(t) {
      const p = atpPose(t); drawHero(p); drawDial(p.coinsArrived ? 0.012 * Math.min(8, p.coinsArrived) : 0);
      let st = ATP_STEPS[0][1]; for (const [a, txt] of ATP_STEPS) if (t >= a) st = txt;
      chip("Mitochondrion · power plant", st, "textbook: 3 ATP per rotor turn · ≈30–32 ATP per glucose");
      glow(dyn.wheel, t > 0.28 && t < 0.78); glow(dyn.rotor, t > 0.5); glow(dyn.f1, t > 0.5); glow(dyn.car, t > 0.35 && t < 0.78); glow(dyn.gate, t < 0.18); glow(dyn.split, t > 0.17 && t < 0.3); glow(dyn["tank-level"], t > 0.4 && t < 0.9);
      lift("mito1", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)));
      const to = orgS("mito1"), lead = dyn["lens-leader"]; const a = sstep(0, 0.08, t) * (1 - sstep(0.92, 1, t));
      lead.setAttribute("opacity", f1(a)); lead.innerHTML = gline([to, [lerp(to[0], Aw(W3(-78, 0, 18))[0], 0.5), to[1] + 70], Aw(W3(-78, 0, 18))], 1.1, "#f8aa06", "stroke-dasharray:2.6 2.6") + `<circle cx="${f1(to[0])}" cy="${f1(to[1])}" r="${f1(6 + Math.sin(t * 20))}" fill="none" style="stroke:#f8aa06;stroke-width:1.8px"/>`;
      receipt(sstep(0.9, 1, t));
    },
    end() { ["wheel", "rotor", "f1", "car", "gate", "split", "tank-level"].forEach((n) => glow(dyn[n], false)); lift("mito1", 0); dyn["lens-leader"].setAttribute("opacity", "0"); },
  },
  feed: {
    dur: 6200,
    update(t) {
      const hopper = Aw([-150, 55, 24]), portS = Aw([FEED_PORT[0], FEED_PORT[1], 14]);
      const wall = cpx(-45, -26, 0), inside = cpx(-24, -12, 3);
      let s = "";
      const pel = (p) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="8" fill="#f8aa06" fill-opacity=".28" stroke="none"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="5" class="ink" style="fill:#f8aa06;stroke-width:1.1px"/><circle cx="${f1(p[0] - 1.6)}" cy="${f1(p[1] - 1.6)}" r="1.5" fill="#fff" stroke="none"/><text x="${f1(p[0])}" y="${f1(p[1] + 1.6)}" text-anchor="middle" style="font:700 4.4px ui-monospace,monospace;fill:#161412">S</text>`;
      const a = win(t, 0.05, 0.42);
      let tk = "";
      for (let i = 0; i < 3; i++) { const q = win(t, 0.05 + i * 0.07, 0.42 + i * 0.05); if (q > 0 && q < 1) { const pp = along(FEED_R, q); tk += pel(Aw(pp)); } }
      // arc from the port into the cell, receptor + transporter vesicle at the wall
      const q2 = win(t, 0.42, 0.62); if (q2 > 0 && q2 < 1) tk += pel(arcS(portS, wall, 22, q2));
      const q3 = win(t, 0.62, 0.8), flip = sstep(0.55, 0.78, t);
      if (q3 > 0 && q3 < 1) tk += pel(arcS(wall, inside, 4, q3));
      if (q3 >= 1) for (let i = 0; i < 3; i++) { const w2 = win(t, 0.8, 1); tk += pel([inside[0] + Math.cos(i * 2.2) * 12 * w2, inside[1] + Math.sin(i * 2.2) * 9 * w2]); }
      // signal receptor (Y) + vesicle fusing + flipping gate door at the membrane
      s += `<g transform="translate(${f1(wall[0])} ${f1(wall[1])}) scale(1.7)"><path d="M-5 -9L0 -3L5 -9M0 -3L0 3" class="ink" style="stroke:#161412;stroke-width:1.3px"/>` +
        `<rect x="-6" y="-2" width="12" height="4" rx="1" class="ink" style="fill:#fef8ed;stroke-width:.9px"/><g transform="rotate(${f1(flip * 180)})"><rect x="-1" y="-6.5" width="2" height="13" rx="1" class="ink" style="fill:#f8aa06;stroke-width:.9px"/></g></g>`;
      const ve = win(t, 0.3, 0.6); if (ve > 0 && ve < 1) s += dot(arcS(cpx(-30, -34, 6), wall, 8, ve), 3.2, "#fff8e6");
      fx(s + tk);
      glow($('[data-org="lyso3"]'), false);
      lensOff(); chip("Feed · receptor + transporter", t < 0.42 ? "① hopper chute delivers $SNACC pellets to the jar port" : t < 0.62 ? "② signal binds the receptor, a transporter vesicle fuses with the membrane" : "③ the channel flips — the pellet enters and spreads", "feed_strain · macro signal CrucibleTemp acts as the hormone");
      glow($(".iso-svg [data-dyn=glass-fx]"), false);
    },
    end() { fx(""); chip(null); },
  },
  nucleus: {
    dur: 7600, target: "nucleus",
    update(t) {
      lensOn("nucleus", t, "nucleus");
      lift("nucleus", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)));
      const rp = $('[data-part="rnapol"]'); if (rp) rp.setAttribute("transform", `translate(${f1(lerp(-9, 8, win(t, 0.22, 0.62)))} 0)`);
      const a = cpx(28, 8, 6), b = cpx(40, 16, 6), c = cpx(30, 40, 6), d = cpx(8, 33, 6);
      let s = "";
      if (t > 0.4) { const w = win(t, 0.4, 0.85); const pts = Array.from({ length: 16 }, (_, i) => bez(a, b, c, d, (i / 15) * w)); s += gline(pts, 2.6, "#161412") + gline(pts, 1.4, "#fffdf6") + gline(pts, 1.4, "#f8aa06", `stroke-dasharray:1 3;stroke-dashoffset:${f1(-t * 40)}`); }
      const kn = win(t, 0.7, 1); for (let i = 0; i < Math.floor(kn * 7); i++) s += dot([d[0] - 14 + i * 4, d[1] - 4 - Math.sin(i) * 2], 1.5, "#f8aa06", 0.5);
      fx(s);
    },
    end() { lift("nucleus", 0); lensOff(); fx(""); const rp = $('[data-part="rnapol"]'); if (rp) rp.removeAttribute("transform"); },
  },
  attest: {
    dur: 7800, target: "nucleus",
    update(t) {
      lensOn("attest", t, "nucleus");
      lift("nucleus", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)));
      let s = "";
      // capsule along the pneumatic tube, then into the nucleus
      const q = win(t, 0.14, 0.5);
      const port = Aw(ATT_R.pts[ATT_R.pts.length - 1]), nuc = orgS("nucleus");
      if (q > 0 && q < 0.7) { const p = Aw(along(ATT_R, q / 0.7)); s += `<rect x="${f1(p[0] - 6)}" y="${f1(p[1] - 3.4)}" width="12" height="6.8" rx="3.4" class="ink" style="fill:#fef8ed;stroke-width:.9px"/><circle cx="${f1(p[0] + 2)}" cy="${f1(p[1])}" r="2.6" class="ink" style="fill:#f8aa06;stroke-width:.7px"/>`; }
      else if (q >= 0.7 && q < 1) { const p = arcS(port, nuc, 6, (q - 0.7) / 0.3); s += `<rect x="${f1(p[0] - 5)}" y="${f1(p[1] - 3)}" width="10" height="6" rx="3" class="ink" style="fill:#fef8ed;stroke-width:.9px"/><circle cx="${f1(p[0] + 1.6)}" cy="${f1(p[1])}" r="2.2" class="ink" style="fill:#f8aa06;stroke-width:.7px"/>`; }
      const ff = $('[data-part="film-frame"]'); if (ff) ff.style.fill = t > 0.55 ? "#f8aa06" : "#fff8e6";
      // MHC semaphore flag rises on the membrane (top rim)
      const rim = cpx(30, 52, 0), fh = sstep(0.62, 0.8, t);
      s += `<path d="M${f1(rim[0])} ${f1(rim[1])}L${f1(rim[0])} ${f1(rim[1] - 22 * fh - 2)}" class="ink" style="stroke-width:1.4px"/><path d="M${f1(rim[0])} ${f1(rim[1] - 22 * fh - 2)}l14 4l-14 4z" class="ink" style="fill:#f8aa06;stroke-width:.9px"/>` + (t > 0.78 ? `<text x="${f1(rim[0] + 16)}" y="${f1(rim[1] - 22 * fh + 3)}" style="font:700 7px ui-monospace,Menlo,monospace;fill:#161412">MHC</text>` : "");
      fx(s);
      const pr = dyn.probe; if (pr) pr.firstChild && (pr.style.filter = t > 0.72 ? "drop-shadow(0 0 3px #4a9b3a)" : "none"); const lamp = $('[data-lamp="attest"]'); if (lamp) lamp.style.fill = t > 0.72 ? "#4a9b3a" : "#d94135";
    },
    end() { lift("nucleus", 0); lensOff(); fx(""); const ff = $('[data-part="film-frame"]'); if (ff) ff.style.fill = ""; const lamp = $('[data-lamp="attest"]'); if (lamp) lamp.style.fill = "#4a9b3a"; if (dyn.probe) dyn.probe.style.filter = ""; },
  },
  vacuole: {
    dur: 6600, target: "vacuole",
    update(t) {
      lensOn("vacuole", t, "vacuole");
      lift("vacuole", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)));
      const lv = sstep(0.25, 0.85, t); const w = $('[data-part="vac-water"]'); if (w) w.setAttribute("y", f1(10 - lv * 14));
      const m = $('[data-part="manometer-needle"]'); if (m) m.setAttribute("d", `M0 0L${f1(Math.sin((-60 + lv * 150) * Math.PI / 180) * 3.2)} ${f1(-Math.cos((-60 + lv * 150) * Math.PI / 180) * 3.2)}`);
      gauge("TURGOR", 0.3 + 0.5 * lv, "#f8aa06");
      let s = ""; for (let i = 0; i < 4; i++) { const q = win(t, 0.02 + i * 0.1, 0.4 + i * 0.1); if (q > 0 && q < 1) s += dot(arcS(cpx(26, 12 + i * 4, 6), orgS("vacuole"), 14, q), 2.6, ["#e8762b", "#a9d4ec", "#c8e36a", "#f8aa06"][i]); }
      fx(s);
    },
    end() { lift("vacuole", 0); lensOff(); fx(""); gauge("TURGOR", 0.5); const w = $('[data-part="vac-water"]'); if (w) w.setAttribute("y", "-2"); },
  },
  lysosome: {
    dur: 7000, target: "lyso1",
    update(t) {
      lensOn("lysosome", t, "lyso1");
      lift("lyso1", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)));
      const q = win(t, 0.05, 0.5); let s = "";
      if (q > 0 && q < 1) { const p = arcS(orgS("mito1"), orgS("lyso1"), 10, q); s += `<rect x="${f1(p[0] - 3)}" y="${f1(p[1] - 3)}" width="6" height="6" rx="1" class="ink" style="fill:#b9a06c;stroke-width:.8px"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="7" fill="#fff" fill-opacity=".4" class="ink" style="stroke-width:.7px"/>`; }
      const rb = win(t, 0.55, 1); for (let i = 0; i < 4; i++) { const qq = rb * 1.4 - i * 0.2; if (qq > 0 && qq < 1) s += dot(arcS(orgS("lyso1"), orgS("mito1"), 12, qq), 2.1, "#f8aa06", 0.6); }
      fx(s); gauge("BMR", 0.55 - 0.3 * sstep(0.78, 1, t), "#f8aa06");
    },
    end() { lift("lyso1", 0); lensOff(); fx(""); gauge("BMR", 0.42); },
  },
  synthesize: {
    dur: 7400, target: "golgi",
    update(t) {
      lensOn("synthesize", t, "golgi");
      lift("golgi", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)));
      const st = $('[data-part="stamp"]'); if (st) st.setAttribute("transform", st.getAttribute("transform").replace(/ translate\(.*$/, "") + ` translate(0 ${f1(sstep(0.28, 0.4, t) * (1 - sstep(0.4, 0.5, t)) * 6)})`);
      const g0 = orgS("golgi"); let s = "";
      const v = win(t, 0.0, 0.5); if (v > 0 && v < 1) s += dot([g0[0] - 16 + v * 20, g0[1] + 14 - v * 22], 2.6, "#fff8e6");
      const ex = win(t, 0.78, 1); const vial = shelfVial(); const wall = cpx(54, -8, 0);
      if (ex > 0) { const p = ex < 0.4 ? arcS(g0, wall, 8, ex / 0.4) : arcS(wall, vial, 60, (ex - 0.4) / 0.6); s += `<rect x="${f1(p[0] - 3.4)}" y="${f1(p[1] - 6)}" width="6.8" height="10" rx="2.2" class="ink" style="fill:#fffdf6;stroke-width:.9px"/><rect x="${f1(p[0] - 2.4)}" y="${f1(p[1] - 1)}" width="4.8" height="5" rx="1.2" fill="#f8aa06" stroke="none"/>`; }
      fx(s);
      if (dyn.vials) dyn.vials.innerHTML = t > 0.96 ? (() => { const p = shelfVial(); return `<rect x="${f1(p[0] - 3.4)}" y="${f1(p[1] - 6)}" width="6.8" height="10" rx="2.2" class="ink" style="fill:#fffdf6;stroke-width:.9px"/><rect x="${f1(p[0] - 2.4)}" y="${f1(p[1] - 1)}" width="4.8" height="5" rx="1.2" fill="#f8aa06" stroke="none"/>`; })() : "";
    },
    end() { lift("golgi", 0); lensOff(); fx(""); const st = $('[data-part="stamp"]'); if (st) st.setAttribute("transform", st.getAttribute("transform").replace(/ translate\(.*$/, "")); },
  },
  divide: {
    dur: 8000, target: "nucleus",
    update(t) {
      lensOn("divide", t, "nucleus");
      lift("nucleus", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)) * 0.6);
      const b = sstep(0, 0.45, t), sp = sstep(0.82, 1, t) * 6;
      const e = dyn.bud; const c = cpx(52, 38, -6);
      if (e) e.innerHTML = b > 0.01 ? `<ellipse cx="${f1(c[0] + sp)}" cy="${f1(c[1] - sp)}" rx="${f1(30 * b)}" ry="${f1(28 * b)}" fill="#d9c08a" class="ink" style="stroke-width:1px"/><ellipse cx="${f1(c[0] + sp - 3 * b)}" cy="${f1(c[1] - sp + 3 * b)}" rx="${f1(24 * b)}" ry="${f1(22 * b)}" fill="#f1dfae" stroke="none"/>` : "";
      // taffy nucleus through the neck + septum zip + chromosomes (screen space on the cell)
      const n = win(t, 0.3, 0.7), nuc = orgS("nucleus"); let s = "";
      if (n > 0 && t < 0.86) { const nx = lerp(nuc[0] + 14, c[0] - 6, n); s += `<path d="M${f1(nuc[0] + 10)} ${f1(nuc[1] - 10 + 6 * n)}Q${f1((nuc[0] + nx) / 2)} ${f1(lerp(nuc[1], c[1], n * 0.5) - 8 * (1 - n * 0.5))} ${f1(nx + 8)} ${f1(lerp(nuc[1], c[1], n) - 6)}Q${f1(nx + 12)} ${f1(lerp(nuc[1], c[1], n))} ${f1(nx + 8)} ${f1(lerp(nuc[1], c[1], n) + 6)}Q${f1((nuc[0] + nx) / 2)} ${f1(lerp(nuc[1], c[1], n * 0.5) + 8 * (1 - n * 0.5))} ${f1(nuc[0] + 10)} ${f1(nuc[1] + 10 - 6 * n)}Z" fill="#ffd57a" class="ink" style="stroke-width:1px;opacity:.9"/>`; }
      const z = win(t, 0.62, 0.86); if (z > 0) { const a0 = cpx(36, 30, 0); for (let i = 0; i < 7; i++) if (i / 6 <= z) s += `<rect x="${f1(a0[0] + i * 1.2)}" y="${f1(a0[1] + i * 3.2)}" width="6" height="1.6" fill="#161412"/>`; }
      if (t > 0.86) s += `<circle cx="${f1(cpx(38, 36, 0)[0])}" cy="${f1(cpx(38, 36, 0)[1])}" r="5" fill="none" style="stroke:#161412;stroke-width:2px"/><circle cx="${f1(cpx(38, 36, 0)[0])}" cy="${f1(cpx(38, 36, 0)[1])}" r="1.8" fill="#f8aa06"/>`;
      fx(s);
    },
    end() { lift("nucleus", 0); lensOff(); fx(""); if (dyn.bud) dyn.bud.innerHTML = ""; if (!EMB()) S.gen = Math.min(8, S.gen + 1); },
  },
  splice: {
    dur: 7800, target: "nucleus",
    update(t) {
      lensOn("splice", t, "nucleus");
      lift("nucleus", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)) * 0.6);
      let s = ""; const nuc = orgS("nucleus");
      for (let i = 0; i < 3; i++) { const q = (t * 1.5 + i / 3) % 1; if (t < 0.6) s += `<path d="M${f1(cpx(-58, 18)[0] - 8 + q * 22)} ${f1(cpx(-58, 18)[1] - q * 10)}q8 -8 16 0" fill="none" style="stroke:#f8aa06;stroke-width:1.8px;opacity:${f1(1 - q)}"/>`; }
      const m = win(t, 0.3, 0.9); const g = [cpx(-62, 6, 6)[0] + (nuc[0] - cpx(-62, 6, 6)[0]) * m, nuc[1] + (1 - m) * 6];
      s += `<circle cx="${f1(g[0])}" cy="${f1(g[1])}" r="${f1(11 + 4 * m)}" fill="#ffd57a" class="ink" style="stroke-width:1px;opacity:${f1(0.9 - 0.4 * sstep(0.85, 1, t))}"/>`;
      fx(s);
    },
    end() { lift("nucleus", 0); lensOff(); fx(""); },
  },
  extract: {
    dur: 7000, target: "er",
    update(t) {
      lensOn("extract", t, "er");
      lift("er", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)));
      let s = ""; const cr = sstep(0.32, 0.5, t), c0 = cpx(2, 22, 8);
      if (t > 0.04 && t < 0.62) s += `<path d="M${f1(c0[0] - 14)} ${f1(c0[1] + 2)}Q${f1(c0[0] - 14)} ${f1(c0[1] - 18)} ${f1(c0[0])} ${f1(c0[1] - 18)}Q${f1(c0[0] + 14)} ${f1(c0[1] - 18)} ${f1(c0[0] + 14)} ${f1(c0[1] + 2)}Q${f1(c0[0])} ${f1(c0[1] + 10)} ${f1(c0[0] - 14)} ${f1(c0[1] + 2)}Z" fill="#f6e6bf" class="ink" style="stroke-width:1px"/>` + [0, 1, 2, 3].map((i) => dot([c0[0] - 8 + i * 5.4, c0[1] - 4 + (i % 2) * 3], 2.4, ["#e8762b", "#a9d4ec", "#c8e36a", "#e8762b"][i], 0.6)).join("") + (cr > 0.2 ? `<path d="M${f1(c0[0] - 2)} ${f1(c0[1] - 18)}l3 6l-3 5l3 6" fill="none" class="ink" style="stroke-width:1.2px"/>` : "");
      const fly = win(t, 0.5, 1);
      const cols = ["#e8762b", "#a9d4ec", "#c8e36a", "#e8762b"], target = [0, 1, 2, 0];
      cols.forEach((col, i) => { const q = clamp(fly * 1.4 - i * 0.12); if (q > 0 && q < 1) s += dot(arcS(c0, shelfBay(target[i]), 54, q), 2.8, col); });
      fx(s);
      if (fly > 0.95) { spores.ember = 2; spores.ice = 1; spores.glow = 1; }
      bay(0, fly > 0.75 ? 2 : 0, "#e8762b"); bay(1, fly > 0.85 ? 1 : 0, "#a9d4ec"); bay(2, fly > 0.95 ? 1 : 0, "#c8e36a");
    },
    end() { lift("er", 0); lensOff(); fx(""); },
  },
  transmute: {
    dur: 6800, target: "er",
    update(t) {
      lensOn("transmute", t, "er");
      lift("er", sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t)));
      const q = win(t, 0.74, 1); let s = "";
      if (q > 0) s += (() => { const p = arcS(orgS("er"), orgS("vacuole"), 22, q); return `<path d="M${f1(p[0] - 5)} ${f1(p[1])}l8 0M${f1(p[0] + 3)} ${f1(p[1])}l0 4M${f1(p[0] + 3)} ${f1(p[1] + 4)}l-3 0" fill="none" style="stroke:#161412;stroke-width:3.4px;stroke-linecap:round"/><path d="M${f1(p[0] - 5)} ${f1(p[1])}l8 0M${f1(p[0] + 3)} ${f1(p[1])}l0 4M${f1(p[0] + 3)} ${f1(p[1] + 4)}l-3 0" fill="none" style="stroke:#f8aa06;stroke-width:1.8px;stroke-linecap:round"/>`; })();
      fx(s);
    },
    end() { lift("er", 0); lensOff(); fx(""); },
  },
  lysis: {
    dur: 7600,
    update(t) {
      const sw = sstep(0.05, 0.5, t), tear = sstep(0.5, 0.62, t);
      const root = dyn.cellroot; const cs = CS;
      if (root) root.style.transform = `translate(${f1(Math.sin(t * 90) * (1 - tear) * sw * 0.9)}px,0) scale(${f1(1 + 0.045 * sw * (1 - 0.6 * tear))})`, root.style.transformOrigin = `${cs[0]}px ${cs[1]}px`;
      let s = "";
      // pressure needle: TURGOR gauge into the red zone
      gauge("TURGOR", 0.35 + 0.6 * sw, t > 0.4 ? "#d94135" : "#f8aa06");
      const seam = [cpx(24, 51), cpx(28, 48), cpx(31, 45), cpx(35, 42), cpx(38, 40), cpx(44, 33)];
      if (tear > 0) s += gline(seam.slice(0, 2 + Math.floor(tear * 4)), 2.2, "#d94135") + gline(seam, 1, "#161412");
      // contents float out of the tear
      if (t > 0.58) for (let i = 0; i < 10; i++) { const q = (win(t, 0.58, 1) * 1.1 + i * 0.07) % 1; const p = [seam[2][0] + Math.sin(i * 2.1 + q * 4) * 14 + q * 28, seam[2][1] - q * 70 - (i % 3) * 4]; s += dot(p, 2 + (i % 3) * 0.7, ["#f8aa06", "#fef8ed", "#c8e36a"][i % 3], 0.6); }
      // liquidator pipette drone takes 10%
      const dp = win(t, 0.68, 0.98), dx = lerp(CS[0] + 190, seam[3][0] + 6, sstep(0, 0.45, dp)) - sstep(0.7, 1, dp) * 220, dy = seam[3][1] - 44 + Math.sin(t * 8) * 2 - sstep(0.7, 1, dp) * 30;
      if (dp > 0 && dp < 1) { s += `<g transform="translate(${f1(dx)} ${f1(dy)})"><ellipse cx="0" cy="0" rx="14" ry="6" class="ink" style="fill:#fef8ed;stroke-width:1px"/><ellipse cx="0" cy="1.5" rx="14" ry="2.5" fill="#d8c399" stroke="none"/><ellipse cx="-11" cy="-7" rx="9" ry="1.6" fill="#161412" opacity="${f1(0.35 + 0.3 * Math.sin(t * 120))}"/><ellipse cx="11" cy="-7" rx="9" ry="1.6" fill="#161412" opacity="${f1(0.35 + 0.3 * Math.cos(t * 120))}"/><path d="M-1 6L-1 22L1 22L1 6" class="ink" style="fill:#e7f3f1;stroke-width:.9px"/><circle cx="0" cy="0" r="2" fill="#f8aa06" class="ink" style="stroke-width:.7px"/><text x="0" y="-11" text-anchor="middle" style="font:700 5px ui-monospace,monospace;fill:#161412">10%</text></g>`; for (let i = 0; i < 4; i++) { const q = clamp(win(dp, 0.35, 0.8) * 1.2 - i * 0.14); if (q > 0 && q < 1) s += dot([lerp(seam[3][0] + 4, dx, q), lerp(seam[3][1] - 10, dy + 20, q)], 2, "#f8aa06", 0.6); } }
      fx(s); lensOff();
      chip("Lysis · harvest a starving strain", t < 0.5 ? "① ATP empty: ion pumps stop, the cell swells, pressure needle climbs" : t < 0.68 ? "② the membrane tears along its seam, contents float out" : "③ a liquidator pipette drone takes the 10% bounty", "harvest_starving_strain · bounty 10% · the rest returns to the treasury");
    },
    end() { const root = dyn.cellroot; if (root) { root.style.transform = ""; } gauge("TURGOR", 0.5); fx(""); chip(null); },
  },
};
const TOUR = [["Mitochondrion", "power plant: Krebs wheel · cable car · water turbine", () => { glow(dyn.wheel, true); glow(dyn.rotor, true); }, () => { glow(dyn.wheel, false); glow(dyn.rotor, false); }], ["Nucleus", "genome film archive", () => lift("nucleus", 1), () => lift("nucleus", 0)], ["Vacuole", "water tower and warehouse", () => lift("vacuole", 1), () => lift("vacuole", 0)], ["Golgi", "post office: NEP-245 stamps", () => lift("golgi", 1), () => lift("golgi", 0)], ["Lysosome", "recycling plant: acid vat pH ≈ 4.5–5", () => lift("lyso1", 1), () => lift("lyso1", 0)]];
const EMB = () => EMBED;

/* ---------------- runner ---------------- */
let run = null, lastNow = 0, freezeT = null, tourIdx = -1, tourAt = 0;
const t0 = performance.now();
function startAction(action) {
  if (run || !ANIMS[action]) return;
  const an = ANIMS[action];
  window.parent.postMessage({ type: "snacc:action", action }, ORIGIN);
  setReadout(LABEL[action] + "…");
  tourOff();
  if (calm) { an.update(0.55); run = { action, an, calm: true }; setTimeout(() => finish(action), 900); return; }
  run = { action, an, t0: performance.now(), dur: an.dur };
}
function finish(action) {
  const an = run && run.an; if (an && an.end) an.end();
  if (action === "atp" && !EMBED) S.atp += 2;
  applyState(); receipt(0);
  run = null;
  setReadout(LABEL[action] + " done · ATP " + S.atp);
  window.parent.postMessage({ type: "snacc:done", action }, ORIGIN);
}
function tourOff() { if (tourIdx >= 0) { TOUR[tourIdx][3](); tourIdx = -1; if (!run) chip(null); } }
function tourTick(now) {
  if (run || calm) return;
  const k2 = (((Math.floor((now - t0) / 4200)) % TOUR.length) + TOUR.length) % TOUR.length;
  if (k2 !== tourIdx) { if (tourIdx >= 0) TOUR[tourIdx][3](); tourIdx = k2; TOUR[k2][2](); }
  const [n, d] = TOUR[tourIdx];
  chip("Idle tour · " + n, d, "pick an action to watch it work");
}
function frame(now) {
  lastNow = now;
  if (run && !run.calm) {
    const t = clamp((now - run.t0) / run.dur);
    run.an.update(t);
    if (t >= 1) finish(run.action);
  } else if (!run) { drawHero(idlePose(now - t0)); drawDial(0); tourTick(now); }
  cellIdle(now); zoneFx(now);
  if (!calm) requestAnimationFrame(frame);
}
const KNOWN = new Set(["snacc:state", "snacc:play"]);
window.addEventListener("message", (e) => {
  if (e.origin !== ORIGIN) return;
  const d = e.data; if (!d || typeof d.type !== "string" || !KNOWN.has(d.type)) return;
  if (d.type === "snacc:state") {
    const s = d.strain || {};
    if (typeof s.status === "string") S.status = s.status;
    const ev = typeof s.effective_vitality === "number" ? s.effective_vitality : s.vitality;
    if (typeof ev === "number") { S.evit = ev; S.vitality = typeof s.vitality === "number" ? s.vitality : ev; }
    if (typeof s.atp_balance === "number") S.atp = s.atp_balance;
    if (s.organel && typeof s.organel === "object") for (const key of ["mitokondria", "nukleus", "lisosom"]) if (typeof s.organel[key] === "number") S.org[key] = s.organel[key];
    if (typeof s.generation === "number") S.gen = s.generation;
    if (typeof s.role_mask === "number") S.role = s.role_mask;
    if (typeof d.zone === "string") S.zone = d.zone;
    applyState();
  } else if (d.type === "snacc:play") {
    if (typeof d.action === "string" && ACTIONS.includes(d.action)) startAction(d.action);
  }
});
document.querySelectorAll("[data-action]").forEach((b) => b.addEventListener("click", () => startAction(b.dataset.action)));
function boot() {
  applyState();
  const FZ = location.search.match(/[?&]freeze=([a-z]+)@([0-9.]+)/);
  const ZN = location.search.match(/[?&]zone=([A-Za-z]+)/); if (ZN) S.zone = ZN[1];
  const ST = location.search.match(/[?&]status=([A-Za-z]+)/); if (ST) { S.status = ST[1]; applyState(); }
  if (FZ) { freezeT = parseFloat(FZ[2]); const an = ANIMS[FZ[1]]; if (an) an.update(freezeT); setReadout(LABEL[FZ[1]] || FZ[1]); zoneFx(1000); }
  else { setReadout(calm ? "Still — highlights and numbers shown" : "Ready"); if (calm) { drawHero(idlePose(0)); drawDial(0); zoneFx(0); chip("Cell Lab", "Reduced motion: press an action for a still frame", "yeast-like cell · mitochondrion power plant"); } else requestAnimationFrame((n) => { lastNow = n; frame(n); }); }
  window.parent.postMessage({ type: "snacc:ready" }, ORIGIN);
}
