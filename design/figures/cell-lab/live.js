/* Cell Lab runtime. Kit (k), MECH factory, GEOM and ACTIONS are inlined above this file. */
const { P: PJ, GEO, ORG, ATP_ROUTE, FEED_ROUTE, FEED_PORT, DIAL, CELLC, LENS, W: VW, H: VH, SCARS } = GEOM;
const root = document.querySelector(".iso-stage");
const svg = root.querySelector("svg");
const $ = (s) => svg.querySelector(s);
const $$ = (s) => [...svg.querySelectorAll(s)];
const dyn = {};
svg.querySelectorAll("[data-dyn]").forEach((e) => { dyn[e.dataset.dyn] = e; });
const M = makeMech(k, PJ, GEO);
const { W3, A: Aw } = M;
const f1 = M.f1;
const EMBED = /[?&]embed=1/.test(location.search);
if (EMBED) document.documentElement.classList.add("embed");
const FREEZE = (location.search.match(/[?&]freeze=([a-z]+)@([0-9.]+)/) || null);
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ORIGIN = location.origin;
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const win = (t, a, b) => clamp((t - a) / (b - a));
const readout = document.querySelector("[data-readout]");
const atpEl = document.querySelector("[data-counter-atp]");
const vitEl = document.querySelector("[data-counter-vit]");

/* ---------------- state ---------------- */
const S = { status: "Active", vitality: 70, evit: 70, atp: 0, org: { mitokondria: 2, nukleus: 2, lisosom: 2 }, gen: 0, role: 0, zone: "Normal" };
const LABEL = { feed: "Feed", atp: "ATP", extract: "Extract", transmute: "Transmute", synthesize: "Synthesize", nucleus: "Nucleus", lysosome: "Lysosome", divide: "Divide", lysis: "Lysis", splice: "Splice", vacuole: "Vacuole", attest: "Attest" };
function setReadout(t) { if (readout && readout.textContent !== t) readout.textContent = t; }
function setCounters() { if (atpEl) atpEl.textContent = "ATP " + S.atp; if (vitEl) vitEl.textContent = "Vitality " + Math.round(S.evit); }

/* ---------------- helpers ---------------- */
const route = (pts) => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])); return { pts, cum, len: cum[cum.length - 1] }; };
const along = (r, s) => { s = clamp(s) * r.len; let i = 1; while (i < r.cum.length - 1 && r.cum[i] < s) i++; const a = r.pts[i - 1], b = r.pts[i], t = (s - r.cum[i - 1]) / ((r.cum[i] - r.cum[i - 1]) || 1); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
const ATP_R = route(ATP_ROUTE);
const arc3 = (a, b, h, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) + Math.sin(t * Math.PI) * h];
const FILL = { mari: "#f8aa06" };
function glow(el, on) { if (el) el.classList.toggle("is-lit", !!on); }
function rotBox(u, v, w, d, ang, z, h, cls, o = {}) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const ring = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => { const lu = u + x * c - y * s, lv = v + x * s + y * c; const p = W3(lu, lv, 0); return [p[0], p[1]]; });
  return k.solidSvg(k.extrude(ring, z, h, PJ, { bevel: o.bevel ?? 0.2 }), { tone: "hi", className: cls || "", crease: "faint" });
}
const coinAt = (p, r = 2.2) => k.solidSvg(k.cylinder(p[0], p[1], r, p[2], 0.9, PJ, 20, 0.2), { tone: "hi", className: "mari" });
const coinMark = (p, txt) => { const T = M.planeMat([p[0] - 1.2, p[1] + 0.8, p[2] + 0.95], [1, 0, 0], [0, 1, 0]); return `<g transform="${T}"><text class="tk-txt" x="1.2" y="0.1" text-anchor="middle" style="font-size:1.55px">${txt}</text></g>`; };
const pill = (p, r = 1.2) => k.solidSvg(k.cylinder(p[0], p[1], r, p[2], 1.6, PJ, 14, 0.15), { tone: "hi", className: "warm" });

/* ---------------- hero (mitochondrion) pose + tokens ---------------- */
const idle = { wheel: 0.3, rotor: 0, f1: 0, carU: GEO.car.u0 + 8, last: 0 };
const GW = GEO.wheel, GT = GEO.turb, GK = GEO.tank, GC = GEO.complexes, GR = GEO.ridge, GCar = GEO.car;
const complexPort = (j) => W3(GC[j].u + GC[j].w - 2.8, -6.4, GR.z0 + GR.h + 11 + 3.2);
const intake = (j) => W3(GC[j].u + GC[j].w - 2.8, GK.v + GK.r + 0.8, GK.z + 0.4);
const rackSlot = (n) => W3(GEO.rack.u + 2.6 + (n % 3) * 2.5, GEO.rack.v + 4, 13.4 + Math.floor(n / 3) * 2.8);
const wheelRelease = () => W3(GW.u + GW.R * Math.cos(-0.25), GW.v, GW.z + GW.R * Math.sin(-0.25));

let heroPose = null;
function drawHero(p) {
  heroPose = p;
  if (dyn.wheel) dyn.wheel.innerHTML = M.wheel(p.wheel, p.carrying || [], p.glowG ?? -1);
  if (dyn.rotor) dyn.rotor.innerHTML = M.rotor(p.rotor, p.rotorSpeed || 0);
  if (dyn.f1) dyn.f1.innerHTML = M.f1head(p.f1);
  if (dyn.car) {
    const u = p.carU, v = GCar.v, zc = GCar.zCable;
    const hang = `<path class="ink" style="stroke-width:.8px" d="${M.pts([Aw(W3(u - 1.6, v, zc)), Aw(W3(u - 1.6, v, zc - 2))])}"/><path class="ink" style="stroke-width:.8px" d="${M.pts([Aw(W3(u + 1.6, v, zc)), Aw(W3(u + 1.6, v, zc - 2))])}"/>`;
    const body = M.box(u - 3.4, v - 2, 6.8, 4, zc - 6, 4, { cls: "warm", r: 1, bevel: 0.2 });
    const lamp = M.box(u - 1, v - 0.8, 2, 1.6, zc - 2, 0.8, { cls: "mari", crease: "none", bevel: 0 });
    const spk = p.spark ? M.spark(W3(u, v + 2.4, zc - 4), 1.7 + 0.5 * Math.sin(p.t * 40)) : "";
    dyn.car.innerHTML = hang + body + lamp + spk + (p.arc || "");
  }
  if (dyn["tank-level"]) {
    const t = GK, x0 = t.u0 + 3, x1 = t.u0 + 3 + (t.u1 - t.u0 - 6) * p.tank;
    const a = Aw(W3(x0, t.v + t.r * 0.62, t.z - 1.2)), b = Aw(W3(x1, t.v + t.r * 0.62, t.z - 1.2));
    dyn["tank-level"].innerHTML = p.tank > 0.02 ? `<path d="${M.pts([a, b])}" fill="none" style="stroke:#161412;stroke-width:3.6px;stroke-linecap:round"/><path d="${M.pts([a, b])}" fill="none" style="stroke:#f8aa06;stroke-width:2.2px;stroke-linecap:round"/>` : "";
  }
  if (dyn["rack-cells"]) { let s = ""; for (let i = 0; i < Math.min(6, p.rack || 0); i++) { const c = rackSlot(i); s += `<g class="mari">${k.solidSvg(k.cylinder(c[0], c[1], 1.0, c[2], 2.4, PJ, 12, 0.1), { tone: "hi" })}</g>`; } dyn["rack-cells"].innerHTML = s; }
  if (dyn.gate) {
    const g = GEO.gate;
    dyn.gate.innerHTML = rotBox(g.u - 2.8, g.v, 7.6, 1.2, p.gate, 8, 9, "mari", { bevel: 0.15 }) + `<g>${k.solidSvg(k.cylinder(W3(g.u - 2.8, g.v, 0)[0], W3(g.u - 2.8, g.v, 0)[1], 1.0, 7.4, 10.4, PJ, 10, 0), { tone: "hi", className: "steel" })}</g>`;
  }
  if (dyn.split) {
    const sp = GEO.split;
    const y = 7 + sp.h + 6 - p.cleaver * 5.4;
    dyn.split.innerHTML = M.box(sp.u + 5, sp.v + 2.6, 2, sp.d - 5.2, y, 6.4, { cls: "steel", r: 0.4, bevel: 0.15 }) + M.box(sp.u + 4, sp.v + 2.2, 4, 0.8, y + 6.4, 1.4, { cls: "tan", r: 0.3, bevel: 0.1 });
  }
  if (dyn.beaker) {
    const b = GEO.beaker, c = W3(b.u, b.v, 0), lvl = p.beaker || 0;
    let s = "";
    if (lvl > 0.01) s += k.solidSvg(k.cylinder(c[0], c[1], 3.5, 7.6, 0.6 + lvl * 6.4, PJ, 20, 0.1), { tone: "hi", className: "water", crease: "none" });
    const top = Array.from({ length: 28 }, (_, i) => Aw([c[0] + Math.cos((i / 28) * TAU) * 4, c[1] + Math.sin((i / 28) * TAU) * 4, 15.6]));
    const l = Aw([c[0] - 2.828, c[1] + 2.828, 15.6]), l0 = Aw([c[0] - 2.828, c[1] + 2.828, 7.6]), r1 = Aw([c[0] + 2.828, c[1] - 2.828, 15.6]), r0 = Aw([c[0] + 2.828, c[1] - 2.828, 7.6]);
    s += `<path d="${M.pts(top, true)}" fill="none" style="stroke:#161412;stroke-width:.8px"/><path d="${M.pts([l, l0])}" fill="none" class="ink" style="stroke-width:.7px"/><path d="${M.pts([r1, r0])}" fill="none" class="ink" style="stroke-width:.7px"/>`;
    dyn.beaker.innerHTML = s;
  }
  if (dyn.chimney) {
    const ch = GEO.chimney; let s = "";
    for (const q of p.puffs || []) s += M.puff(W3(ch.u + q.dx, ch.v, 7 + ch.h + 2.6 + q.dz), q.r, q.a);
    dyn.chimney.innerHTML = s;
  }
  if (dyn["hero-tokens"]) dyn["hero-tokens"].innerHTML = p.tokens || "";
}

/* ---------------- ATP animation ---------------- */
const ATP_DUR = 8200;
function rotAngleAt(t, lvl) { // integral of rotor angular speed
  const om = TAU * (0.42 + 0.09 * lvl);
  let a = 0; const n = 160; const T = ATP_DUR / 1000;
  for (let i = 0; i < n; i++) { const tt = (i + 0.5) / n * t; a += om * sstep(0.40, 0.56, tt) * (1 - 0.8 * sstep(0.93, 1.0, tt)) * (t / n) * T; }
  return a;
}
function atpPose(t) {
  const lvl = clamp(S.org.mitokondria | 0, 0, 5);
  const T = ATP_DUR / 1000;
  const o = { t, wheel: 0, rotor: 0, f1: 0, carU: GCar.u0 + 8, tank: 0, rack: 0, gate: 0, cleaver: 0, beaker: 0, puffs: [], tokens: "", carrying: [], spark: false, rotorSpeed: 0 };
  // gate flips (0.05-0.14), coin enters
  o.gate = sstep(0.06, 0.15, t) * Math.PI;
  // splitter cleaver chops (0.19-0.24)
  o.cleaver = sstep(0.19, 0.22, t) * (1 - sstep(0.23, 0.27, t));
  // wheel spins from 0.28
  const wOm = sstep(0.27, 0.36, t) * (1.1 + 0.2 * lvl) * 0.5;
  o.wheel = 0.3 + wOm * (t - 0.2) * T * 0.9;
  o.glowG = -1;
  // coin $SNACC (outside -> gate -> splitter)
  const tk = [];
  const coinA = W3(-92, 0, 14), coinB = W3(-67, 0, 12.5), coinC = W3(GEO.split.u + 3, GEO.split.v + 5, 7 + GEO.split.h + 2);
  if (t < 0.16) { const p = arc3(coinA, coinB, 5, sstep(0.0, 0.14, t)); tk.push(coinAt(p) + coinMark(p, "$")); }
  else if (t < 0.215) { const p = arc3(coinB, coinC, 3, sstep(0.15, 0.2, t)); tk.push(coinAt(p) + coinMark(p, "$")); }
  // pyruvate pills along conveyor
  const pyA = W3(GEO.split.u + GEO.split.w + 1, GEO.split.v + 5, 8.8), pyB = W3(GW.u - GW.R + 2, GW.v + 1, 8);
  for (let i = 0; i < 2; i++) { const s = win(t, 0.24 + i * 0.03, 0.34 + i * 0.03); if (s > 0 && s < 1) { const p = [lerp(pyA[0], pyB[0], s), lerp(pyA[1], pyB[1], s), lerp(pyA[2], pyB[2], s) + Math.sin(s * Math.PI) * 0.8]; tk.push(pill(p)); } }
  // NADH cells dropping into the rack, CO2 puffs
  const drops = 6; let rack = 0;
  for (let i = 0; i < drops; i++) {
    const td = 0.36 + i * 0.065, s = win(t, td, td + 0.07);
    if (s >= 1) rack++;
    if (s > 0 && s < 1) { const p = arc3(wheelRelease(), rackSlot(i), 6, s); tk.push(`<g class="mari">${k.solidSvg(k.cylinder(p[0], p[1], 1.0, p[2], 2.4, PJ, 12, 0.1), { tone: "hi" })}</g>`); }
    const ps = win(t, td - 0.01, td + 0.13);
    if (ps > 0 && ps < 1) o.puffs.push({ dx: Math.sin(i * 2.3 + ps * 3) * 1.4, dz: ps * 14, r: 1.3 + ps * 1.9, a: 0.9 * (1 - ps) });
  }
  o.rack = rack;
  o.carrying = Array.from({ length: GW.n }, (_, i) => t > 0.3 && t < 0.78 && (i % 3 === 0));
  o.glowG = t > 0.3 && t < 0.8 ? Math.floor(((o.wheel / TAU) * GW.n) % GW.n) : -1;
  // cable car: stops at I (0.40), III (0.52), IV (0.66)
  const stops = [[0.0, GCar.u0 + 8], [0.38, GC[0].u + 5], [0.5, GC[1].u + 5], [0.64, GC[2].u + 5], [0.76, GCar.u1 - 4]];
  let carU = stops[0][1];
  for (let i = 1; i < stops.length; i++) if (t >= stops[i - 1][0]) { const a = stops[i - 1], b = stops[i]; carU = lerp(a[1], b[1], sstep(a[0], b[0] - 0.04, t)); }
  o.carU = carU;
  const stopWin = [[0.36, 0.44], [0.48, 0.56], [0.62, 0.7]];
  let arcs = "";
  stopWin.forEach(([a, b], j) => {
    if (t > a && t < b) {
      o.spark = true;
      const port = complexPort(j), from = W3(carU, GCar.v + 2, GCar.zCable - 4);
      const mid = [(port[0] + from[0]) / 2 + Math.sin(t * 90) * 1.2, (port[1] + from[1]) / 2, (port[2] + from[2]) / 2];
      arcs += `<path d="${M.pts([Aw(from), Aw(mid), Aw(port)])}" fill="none" style="stroke:#f8aa06;stroke-width:1.6px;stroke-linejoin:round;opacity:.95"/>`;
      // protons pumped: 3 droplets from nozzle to the tank intake
      for (let i = 0; i < 4; i++) { const s = win(t, a + 0.02 + i * 0.012, a + 0.1 + i * 0.012); if (s > 0 && s < 1) tk.push(M.drop(arc3(complexPort(j).map((x, ii) => (ii === 2 ? x + 3 : x)), intake(j), 4, s))); }
    }
  });
  o.arc = arcs;
  // late pump droplets finishing
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const a = stopWin[j][0]; const s = win(t, a + 0.02 + i * 0.012, a + 0.1 + i * 0.012); if (s >= 1) { /* arrived */ } }
  o.tank = 0.12 + 0.62 * sstep(0.38, 0.8, t) - 0.12 * sstep(0.85, 1, t);
  o.tank = clamp(o.tank, 0, 1);
  // O2 + e- -> water drop in the beaker (0.66 - 0.8)
  const o2 = GEO.o2; const o2p = W3(o2.u + 1, o2.v - 4, 22), wd = W3(GEO.beaker.u, GEO.beaker.v, 17);
  const ox = win(t, 0.64, 0.72);
  if (ox > 0 && ox < 1) { const p = [lerp(o2p[0], wd[0] - 4, ox), lerp(o2p[1], wd[1] - 2, ox), o2p[2] - 2]; tk.push(`<circle cx="${f1(Aw(p)[0])}" cy="${f1(Aw(p)[1])}" r="1.6" fill="#fff" class="ink" style="stroke-width:.6px"/>`); tk.push(M.spark(p, 1.1)); }
  const dr = win(t, 0.72, 0.8);
  if (dr > 0 && dr < 1) tk.push(M.drop([wd[0] - 0, wd[1], lerp(17, 9, dr * dr)], 1.3));
  o.beaker = 0.1 + 0.5 * sstep(0.78, 0.92, t);
  // turbine
  const ra = rotAngleAt(t, lvl);
  o.rotor = ra; o.rotorSpeed = sstep(0.42, 0.6, t) * (1 - sstep(0.93, 1, t));
  o.f1 = (ra / TAU) * 3; // phase in thirds; ratchet snap
  const ph = o.f1; const stepN = Math.floor(ph), fr = ph - stepN; o.f1 = stepN + sstep(0.55, 0.9, fr);
  // H+ cascade into the blades while spinning
  if (t > 0.44 && t < 0.97) {
    const a = W3(GK.u1 + 1, GK.v + 2, GK.z), b = W3(GT.u + 6.5, GT.v - 2.5, 19);
    for (let i = 0; i < 9; i++) { const s = ((t * T * 1.3 + i / 9) % 1); const p = [lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s) - 3 * Math.pow(s, 2) + Math.sin(s * Math.PI) * 2]; tk.push(M.drop(p, 0.9)); }
  }
  // coins: popped 3 per full revolution; ride the glass tube to the dial
  const coins = []; const popsTotal = Math.floor(ra / (TAU / 3));
  const popT = []; { let a2 = 0; const nn = 400; let want = 1; for (let i = 1; i <= nn && want <= popsTotal; i++) { const tt = (i / nn) * t; const a = rotAngleAt(tt, lvl); if (a >= want * (TAU / 3)) { popT.push(tt); want++; } } }
  popT.forEach((tp, i) => {
    const age = (t - tp) * T; // seconds
    if (age < 0.4) { const p = W3(GT.u, GT.v, GT.zf1 + 12 + age * 8); tk.push(coinAt(p)); coins.push(1); }
    else if (age < 2.0) { const s = (age - 0.4) / 1.6; const p = along(ATP_R, sstep(0, 1, s) * 0.98); tk.push(`<g class="mari">${k.solidSvg(k.cylinder(p[0], p[1], 1.8, p[2] - 1.8, 1.2, PJ, 16, 0.15), { tone: "hi" })}</g>`); coins.push(2); }
  });
  o.coinsArrived = popT.filter((tp) => (t - tp) * T >= 2.0).length;
  o.popsTotal = popsTotal;
  o.tokens = tk.join("");
  return o;
}

/* ---------------- idle pose ---------------- */
function idlePose(now) {
  const T = now / 1000, lvl = clamp(S.org.mitokondria | 0, 0, 5);
  return { t: T, wheel: 0.3 + T * 0.12, rotor: T * (0.5 + 0.1 * lvl), rotorSpeed: 0.12, f1: (T * (0.5 + 0.1 * lvl) / TAU) * 3, carU: GCar.u0 + 8 + 20 * (0.5 + 0.5 * Math.sin(T * 0.25)), tank: 0.35 + 0.05 * Math.sin(T * 0.4), rack: 2, gate: 0, cleaver: 0, beaker: 0.2, puffs: S.zone === "Fever" ? [0, 1, 2].map((i) => { const ps = (T * 0.25 + i / 3) % 1; return { dx: Math.sin(i + ps * 3) * 1.2, dz: ps * 14, r: 1.3 + ps * 1.9, a: 0.8 * (1 - ps) }; }) : [], tokens: "", carrying: [], spark: false, glowG: -1 };
}

/* ---------------- chip (caption) ---------------- */
function chip(title, step, note) {
  const g = dyn.chip || (dyn.chip = (() => { const e = document.createElementNS("http://www.w3.org/2000/svg", "g"); e.setAttribute("class", "chip"); e.setAttribute("data-dyn", "chip"); svg.appendChild(e); return e; })());
  if (!title) { g.setAttribute("opacity", "0"); return; }
  const w = Math.max(400, Math.min(620, step.length * 5.9 + 48)), h = 48, x = VW / 2 - w / 2 + 40, y = VH - 64;
  g.setAttribute("opacity", "1");
  g.innerHTML = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><rect x="${x}" y="${y}" width="6" height="${h}" rx="3" style="fill:#f8aa06;stroke:#161412"/><text class="t" x="${x + 16}" y="${y + 16}">${title}</text><text class="s" x="${x + 16}" y="${y + 30}">${step}</text><text class="n" x="${x + 16}" y="${y + 41}">${note || ""}</text>`;
}
const ATP_STEPS = [
  [0.0, "① $SNACC enters through the flipping membrane transporter"],
  [0.15, "② Glycolysis splits it into 2 pyruvate"],
  [0.27, "③ Krebs wheel: NADH cells to the rack, CO₂ out the chimney"],
  [0.4, "④ Electrons ride the cable car I → III → IV, pumping H⁺ into the reservoir"],
  [0.58, "⑤ H⁺ falls through the ATP synthase turbine — each rotor turn pops 3 ATP"],
  [0.8, "⑥ ATP coins ride the glass tube to the dial"],
];

/* ---------------- dial, needle, counter, cell idle ---------------- */
const DIAL_TOP = 20;
let needle = 0.05, needleKick = 0;
function drawDial(kick) {
  const turn = clamp(S.atp / 100) * 0.95 + 0.03 + kick;
  const a = (-135 + clamp(turn) * 270) * Math.PI / 180;
  const R = 17 - 2.6;
  const tip = Aw([DIAL.x + Math.sin(a) * R, DIAL.y - Math.cos(a) * R, DIAL_TOP + 0.3]), tail = Aw([DIAL.x - Math.sin(a) * 3.4, DIAL.y + Math.cos(a) * 3.4, DIAL_TOP + 0.3]), hub = Aw([DIAL.x, DIAL.y, DIAL_TOP + 0.3]);
  dyn.needle.innerHTML = `<path d="${M.pts([tail, tip])}" fill="none" style="stroke:#161412;stroke-width:2.4px;stroke-linecap:round"/><path d="${M.pts([tail, tip])}" fill="none" style="stroke:#f8aa06;stroke-width:1.3px;stroke-linecap:round"/><circle cx="${f1(hub[0])}" cy="${f1(hub[1])}" r="1.5" class="f-cream"/>`;
}
function drawCounter(txt) {
  const T = M.planeMat([DIAL.x - 9, DIAL.y + 16.03, 8.8], [1, 0, 0], [0, 0, -1]);
  dyn.counter.innerHTML = `<g transform="${T}"><rect x="-.6" y="-.6" width="19.2" height="5" rx=".9" class="f-tan" style="stroke-width:.6px"/><rect x="0" y="0" width="18" height="3.8" rx=".6" fill="#26211b" class="ink" style="stroke-width:.4px"/><text x="17" y="2.95" text-anchor="end" style="font:700 2.9px ui-monospace,Menlo,monospace;fill:#ffd57a;letter-spacing:.12em">${String(Math.max(0, Math.min(9999, S.atp))).padStart(4, "0")}</text><text x="1.1" y="2.7" style="font:600 1.3px ui-monospace,Menlo,monospace;fill:#b89a5a">ATP</text></g>`;
}

/* ---------------- idle cell life ---------------- */
const ribs = $$("[data-rib]");
function cellIdle(now) {
  const T = now / 1000;
  ribs.forEach((e, i) => { const x = Math.sin(T * 1.3 + i * 1.7) * 0.5, y = Math.cos(T * 1.1 + i * 2.3) * 0.5; e.setAttribute("transform", `translate(${f1(x)} ${f1(y)})`); });
}

/* ---------------- status + zone ---------------- */
function applyState() {
  svg.classList.toggle("status-dim", S.status === "Distressed");
  svg.classList.toggle("status-grey", S.status === "SplicedBurned");
  const lamp = $('[data-lamp="attest"]');
  setCounters();
  const gen = $("[data-gen]"); if (gen) gen.textContent = String(S.gen);
  if (dyn["cell-fx"]) {
    let s = "";
    for (let i = 0; i < Math.min(8, S.gen); i++) { const p = SCARS[i]; s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.8" class="f-top"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.2" fill="none" class="ink"/>`; }
    dyn["cell-fx"].innerHTML = s;
  }
  drawCounter();
}

