/* Imagination lens scenes: micro-factory machines drawn in lens-local px (0,0 = lens centre, y down).
   Each scene: { title, note, steps:[[t0,text]...], draw(t) -> svg string }. Flat ink + cream/tan/marigold, original art. */
const LCX = LENS.cx, LCY = LENS.cy, LR = LENS.r;
const INK = "#161412", TAN = "#d8c399", TAND = "#b9a06c", CREAM = "#fef8ed", MARI = "#f8aa06", MARIH = "#ffd57a", BROWN = "#2a2218", WARM = "#f6e6bf";
const rr = (x, y, w, h, r, fill, sw = 1) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${r}" class="ink" style="fill:${fill};stroke-width:${sw}px"/>`;
const el = (cx, cy, rx, ry, fill, sw = 1) => `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" class="ink" style="fill:${fill};stroke-width:${sw}px"/>`;
const ci = (cx, cy, r, fill, sw = 0.9) => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" class="ink" style="fill:${fill};stroke-width:${sw}px"/>`;
const ln = (pts, sw = 1, col = INK, extra = "") => `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${f1(p[0])} ${f1(p[1])}`).join("")}" fill="none" style="stroke:${col};stroke-width:${sw}px;stroke-linecap:round;stroke-linejoin:round;${extra}"/>`;
const pa = (d, fill, sw = 1, extra = "") => `<path d="${d}" class="ink" style="fill:${fill};stroke-width:${sw}px;${extra}"/>`;
const tx = (x, y, s, size = 7, anchor = "middle", col = INK, w = 600) => `<text x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}" style="font:${w} ${size}px ui-monospace,Menlo,monospace;fill:${col};letter-spacing:.03em">${s}</text>`;
const plinth = (x, y, w, h) => `<rect x="${x + 7}" y="${y + 10}" width="${w}" height="${h}" rx="12" fill="${BROWN}"/>` + rr(x, y + 6, w, h, 12, TAND, 1) + rr(x, y, w, h, 12, CREAM, 1);
const beadG = (x, y, r = 3) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" class="ink" style="fill:${MARI};stroke-width:.8px"/><circle cx="${f1(x - r * 0.3)}" cy="${f1(y - r * 0.3)}" r="${f1(r * 0.28)}" fill="#fff" stroke="none"/>`;
const lampG = (x, y, on, col = MARI) => `<circle cx="${x}" cy="${y}" r="5" class="ink" style="fill:${on ? col : "#6a5e48"};stroke-width:1px"/>${on ? `<circle cx="${x}" cy="${y}" r="9" fill="${col}" opacity=".35"/>` : ""}`;
const reelG = (x, y, r, ang, hot = false) => {
  let s = ci(x, y, r, hot ? MARIH : CREAM, 1.1) + ci(x, y, r * 0.78, "none", 0.5);
  for (let i = 0; i < 3; i++) { const a = ang + (i / 3) * TAU; s += ci(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.18, "#3a2f22", 0.6); }
  return s + ci(x, y, r * 0.16, MARI, 0.7);
};
const gearG = (x, y, r, n, ang, fill = TAN) => { let d = ""; for (let i = 0; i < n * 2; i++) { const a = ang + (i / (n * 2)) * TAU; const rad = i % 2 ? r * 0.82 : r; d += `${i ? "L" : "M"}${f1(x + Math.cos(a) * rad)} ${f1(y + Math.sin(a) * rad)}`; } return `<path d="${d}Z" class="ink" style="fill:${fill};stroke-width:.9px"/>` + ci(x, y, r * 0.28, CREAM, 0.7); };
const dialG = (x, y, r, a, lab, zone) => {
  let t = ""; for (let i = 0; i <= 10; i++) { const q = (-135 + i * 27) * Math.PI / 180; t += `M${f1(x + Math.sin(q) * r * 0.72)} ${f1(y - Math.cos(q) * r * 0.72)}L${f1(x + Math.sin(q) * r * (i % 5 ? 0.84 : 0.9))} ${f1(y - Math.cos(q) * r * (i % 5 ? 0.84 : 0.9))}`; }
  const na = (-135 + a * 270) * Math.PI / 180;
  return ci(x, y, r, TAN, 1.1) + ci(x, y, r * 0.88, "#fffdf6", 0.6) + `<path d="${t}" fill="none" style="stroke:${INK};stroke-width:.6px"/>` + (zone ? `<path d="M${f1(x + Math.sin(zone[0]) * r * 0.62)} ${f1(y - Math.cos(zone[0]) * r * 0.62)}A${f1(r * 0.62)} ${f1(r * 0.62)} 0 0 1 ${f1(x + Math.sin(zone[1]) * r * 0.62)} ${f1(y - Math.cos(zone[1]) * r * 0.62)}" fill="none" style="stroke:${MARI};stroke-width:2.4px"/>` : "") + ln([[x, y], [x + Math.sin(na) * r * 0.74, y - Math.cos(na) * r * 0.74]], 1.5, INK) + ci(x, y, 1.6, INK, 0.4) + tx(x, y + r * 0.55, lab, r * 0.26, "middle", INK, 700);
};
const iris = (x, y, r, open) => { let s = ci(x, y, r, TAND, 1.1); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + open * 0.9; const x1 = x + Math.cos(a) * r * (0.9 - 0.62 * (1 - open)), y1 = y + Math.sin(a) * r * (0.9 - 0.62 * (1 - open)); s += pa(`M${f1(x + Math.cos(a) * r * 0.95)} ${f1(y + Math.sin(a) * r * 0.95)}L${f1(x + Math.cos(a + 0.9) * r * (0.35 + 0.55 * open))} ${f1(y + Math.sin(a + 0.9) * r * (0.35 + 0.55 * open))}L${f1(x + Math.cos(a + 1.5) * r * 0.95)} ${f1(y + Math.sin(a + 1.5) * r * 0.95)}Z`, CREAM, 0.7); } return s + ci(x, y, r * (0.1 + 0.42 * open), "#2a2218", 0.6); };
const frostRect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="ink" style="fill:#eef2f1;stroke-width:1px"/>`;

const SCENES = {
  nucleus: {
    title: "Nucleus · genome film archive", note: "genotype stays inside; only an mRNA copy leaves through the pores",
    steps: [[0, "① chromatin spools light up"], [0.22, "② RNA polymerase head reads a gene frame"], [0.5, "③ mRNA ticker tape passes the guarded turnstile pore"], [0.72, "④ ribosome knitting machine strings the protein"]],
    draw(t) {
      const adv = win(t, 0.2, 0.9);
      let s = plinth(-92, -2, 184, 66);
      // nuclear envelope wall (double) with turnstile pore
      s += rr(30, -22, 4, 80, 2, TAN, 0.9) + rr(37, -22, 4, 80, 2, TAN, 0.9);
      s += rr(41, -22, 56, 80, 4, WARM, 0.8) + tx(69, -29, "cytoplasm", 6, "middle", "#5e5340");
      s += tx(-28, -29, "nucleoplasm", 6, "middle", "#5e5340");
      // film strip across the top of the reels
      const fx0 = -78, fx1 = 18, fy = 6;
      s += reelG(-62, 34, 17, adv * 9 + 0.4, t > 0.02 && t < 0.3) + reelG(2, 34, 17, -adv * 9 + 1, false);
      s += rr(fx0 + 2, fy - 6, fx1 - fx0 - 4, 12, 1.5, "#2a2218", 1);
      for (let i = 0; i < 13; i++) { const x = fx0 + 6 + i * 7.1 - (adv * 14.2) % 7.1; if (x > fx0 + 2 && x < fx1 - 6) { const act = i === 7 && t > 0.5; s += `<rect x="${f1(x)}" y="${fy - 3.5}" width="5.2" height="7" rx="1" fill="${act ? MARI : CREAM}" stroke="${INK}" stroke-width=".5"/>`; } }
      for (let i = 0; i < 26; i++) { const x = fx0 + 4 + i * 3.6 - (adv * 14.4) % 3.6; if (x > fx0 + 2 && x < fx1 - 3) s += `<rect x="${f1(x)}" y="${fy - 5.3}" width="1.2" height="1.3" fill="${CREAM}"/><rect x="${f1(x)}" y="${fy + 4}" width="1.2" height="1.3" fill="${CREAM}"/>`; }
      s += ln([[-62, 17], [-62, fy + 6]], 1.4, INK) + ln([[2, 17], [2, fy + 6]], 1.4, INK);
      // reading head (RNA polymerase) slides along the film
      const hx = lerp(-70, 4, win(t, 0.22, 0.62));
      s += rr(hx - 7, -16, 14, 13, 3, MARI, 1.1) + ci(hx, -4, 3.4, CREAM, 0.8) + ln([[hx, -2], [hx, fy - 5]], 1, INK) + (t > 0.22 && t < 0.7 ? `<path d="M${f1(hx - 4)} ${fy - 4}L${f1(hx + 4)} ${fy - 4}" style="stroke:${MARI};stroke-width:2px" opacity=".7"/>` : "");
      // mRNA ticker tape: out of the head, through the turnstile, to the knitter
      const tape = [[hx + 8, -8], [24, -8], [24, 32], [50, 32], [74, 32]];
      const th = win(t, 0.42, 0.9);
      if (t > 0.3) { s += ln(tape, 6.6, INK) + ln(tape, 4.4, "#fffdf6", `stroke-dasharray:none`); s += `<path d="${tape.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("")}" fill="none" style="stroke:${INK};stroke-width:4.4px;stroke-dasharray:1.4 3.2;stroke-dashoffset:${f1(-th * 60)};opacity:.0"/>`; for (let i = 0; i < 10; i++) { const q = (th * 3 + i / 10) % 1; const p = [lerp(24, 74, q), 32]; if (q > 0.0) s += `<rect x="${f1(p[0] - 1)}" y="29.6" width="2" height="4.8" fill="${["#e8762b", "#a9d4ec", "#c8e36a", MARI][i % 4]}" stroke="${INK}" stroke-width=".3"/>`; } }
      // turnstile at the pore
      const ta = th * 12;
      s += ci(38.5, 32, 7, TAND, 1) + [0, 1, 2].map((i) => { const a = ta + (i / 3) * TAU; return ln([[38.5, 32], [38.5 + Math.cos(a) * 11, 32 + Math.sin(a) * 6]], 2.4, INK); }).join("") + ci(38.5, 32, 2.4, MARI, 0.7);
      // knitting machine
      const kn = win(t, 0.6, 1);
      s += rr(66, 10, 28, 30, 4, CREAM, 1.1) + tx(80, 20, "RIBO", 6, "middle", INK, 700) + ln([[72, 40], [72, 46]], 1) + ln([[88, 40], [88, 46]], 1);
      const nd = Math.sin(kn * 30) * 4;
      s += ln([[74, 26], [74 + nd, 36]], 1.6, INK) + ln([[86, 26], [86 - nd, 36]], 1.6, INK);
      for (let i = 0; i < Math.floor(kn * 9); i++) s += beadG(80 + Math.sin(i * 1.4) * 2.4, 46 + i * 5.2 - 0, 2.8);
      s += tx(-28, 58, "histone spools = film reels", 6, "middle", "#5e5340") + tx(-28, 66, "polymerase = reading head", 6, "middle", "#5e5340");
      return s;
    },
  },
  attest: {
    title: "Attest · sealed genome experiment", note: "only the verdict leaves; the contents stay behind frosted glass",
    steps: [[0, "① capsule sealed with a hash wax stamp"], [0.2, "② pneumatic tube to the TEE enclave (frosted glass: silhouettes only)"], [0.55, "③ one film frame changes colour"], [0.72, "④ MHC flag rises, probe lamp: attested ✓"]],
    draw(t) {
      let s = plinth(-92, -4, 184, 68);
      // film strip with the mutating frame
      for (let i = 0; i < 9; i++) { const x = -86 + i * 11; const hot = i === 4; const frame = hot && t > 0.55 ? MARI : CREAM; s += `<rect x="${x}" y="46" width="9" height="11" rx="1.5" fill="${frame}" stroke="${INK}" stroke-width=".7"/>`; }
      s += ln([[-88, 45], [12, 45]], 1) + ln([[-88, 58], [12, 58]], 1) + tx(-38, 70, "genome film · segment 5", 6, "middle", "#5e5340");
      // enclave safe with frosted window
      s += `<rect x="30" y="-18" width="64" height="70" rx="6" fill="${BROWN}" transform="translate(6 8)"/>` + rr(30, -18, 64, 70, 6, CREAM, 1.2) + rr(36, -4, 52, 40, 4, TAN, 1);
      s += frostRect(40, 0, 44, 32);
      s += `<g filter="url(#soft)" opacity=".7"><rect x="46" y="6" width="9" height="20" rx="4" fill="#6a5e48"/><rect x="60" y="14" width="16" height="12" rx="4" fill="#6a5e48"/><circle cx="66" cy="9" r="4.5" fill="#6a5e48"/></g><rect x="40" y="0" width="44" height="32" rx="3" fill="#fff" opacity=".45"/>`;
      s += tx(62, 46, "ENCLAVE · TEE", 6, "middle", INK, 700);
      // probe lamp
      const ok = t > 0.72;
      s += rr(58, -26, 8, 8, 2, TAND, 1) + lampG(62, -32, true, ok ? "#4a9b3a" : "#d94135") + (ok ? tx(62, -46, "attested ✓", 8, "middle", "#2f7a26", 700) : tx(62, -46, "inspecting…", 7, "middle", "#7a2b20", 600));
      // capsule along the pneumatic tube
      const tube = [[-82, -18], [-40, -18], [-6, -4], [30, 16]];
      s += ln(tube, 9, INK) + ln(tube, 6.6, "#e7f3f1");
      const q = win(t, 0.16, 0.55);
      if (q < 1) { const seg = q * 3, i = Math.min(2, Math.floor(seg)), f = seg - i; const p = [lerp(tube[i][0], tube[i + 1][0], f), lerp(tube[i][1], tube[i + 1][1], f)]; s += rr(p[0] - 8, p[1] - 4.4, 16, 8.8, 4.4, CREAM, 1) + ci(p[0] + 3, p[1], 3.6, MARI, 0.8) + tx(p[0] + 3, p[1] + 1.8, "#", 5, "middle", INK, 700); }
      // MHC semaphore flag on a membrane stub
      const fh = sstep(0.6, 0.8, t);
      s += rr(-86, 4, 5, 30, 2, TAND, 1) + rr(-90, 32, 13, 6, 2, TAN, 1);
      s += ln([[-83.5, 6], [-83.5, 6 - 0]], 1) + `<g transform="translate(0 ${f1(-fh * 4)})">${pa(`M-83 ${f1(30 - fh * 22)}L-62 ${f1(25 - fh * 22)}L-83 ${f1(20 - fh * 22)}Z`, MARI, 1)}</g>` + tx(-76, 52 - 12, "MHC", 5.4, "middle", INK, 700);
      return s;
    },
  },
  vacuole: {
    title: "Vacuole · water tower & warehouse", note: "turgor pressure held by the vacuole; stored items = inventory",
    steps: [[0, "① crate hoisted toward the tank"], [0.3, "② water level and turgor manometer rise"], [0.6, "③ shelves fill: spores, enzymes, elixir"]],
    draw(t) {
      const lv = sstep(0.25, 0.85, t);
      let s = plinth(-92, -2, 184, 66);
      // tower: legs, tank, roof
      for (const x of [-62, -38]) s += rr(x - 2, 8, 4, 48, 1.5, TAN, 1);
      s += ln([[-60, 14], [-40, 50]], 1.2) + ln([[-40, 14], [-60, 50]], 1.2);
      s += rr(-70, -26, 40, 36, 8, "#d9eef8", 1.2) + `<clipPath id="vtank"><rect x="-70" y="-26" width="40" height="36" rx="8"/></clipPath><g clip-path="url(#vtank)"><rect x="-70" y="${f1(8 - lv * 30)}" width="40" height="40" fill="#aed9ee"/></g>` + rr(-70, -26, 40, 36, 8, "none", 1.2);
      s += pa("M-72 -26L-50 -42L-28 -26Z", MARI, 1.1) + ci(-50, -42, 2.4, CREAM, 0.7);
      for (let i = 0; i < 4; i++) s += ln([[-66 + i * 9, -20], [-66 + i * 9, 4]], 0.5, "#6a8aa0");
      // manometer
      s += dialG(-12, -6, 16, 0.2 + 0.62 * lv, "TURGOR", [0.2, 0.62].map((a) => (-135 + (0.7 + a * 0.3) * 270) * Math.PI / 180)) + ln([[-26, -2], [-30, -2]], 2, INK);
      // hoist: crate rises to the tank door
      const c = sstep(0.02, 0.35, t);
      s += ln([[-50, -62], [-50, f1(40 - c * 62)]], 1, INK) + rr(-58, 40 - c * 62, 16, 12, 2, WARM, 1) + ln([[-58, 46 - c * 62], [-42, 46 - c * 62]], 0.7) + (c < 1 ? tx(-50, 36 - c * 62 - 6, "▲", 7, "middle", INK) : "");
      // warehouse shelves
      s += rr(20, -22, 66, 76, 4, CREAM, 1.1);
      for (let r = 0; r < 3; r++) { const y = -2 + r * 24; s += ln([[24, y + 12], [82, y + 12]], 2, INK); const cols = [["#e8762b", "#a9d4ec", "#c8e36a", "#e8762b", "#a9d4ec"], [MARI, MARI, MARIH, MARIH, MARI], ["#fff", "#fff", "#e8762b", "#a9d4ec", "#c8e36a"]][r]; cols.forEach((col, i) => { const on = t > 0.6 + (r * 5 + i) * 0.02 || t > 0.95; s += on ? ci(31 + i * 12, y + 6.5, 4.6, col, 0.9) : ""; }); }
      s += tx(53, -28, "warehouse", 6, "middle", "#5e5340");
      return s;
    },
  },
  lysosome: {
    title: "Lysosome · recycling plant", note: "acid vat pH ≈ 4.5–5 (textbook); recycled beads return",
    steps: [[0, "① shrink-wrap membrane closes round the worn organelle"], [0.3, "② it fuses with the acid vat"], [0.55, "③ debris dissolves, recycled beads ride the conveyor"], [0.8, "④ the BMR gauge drops"]],
    draw(t) {
      let s = plinth(-92, -2, 184, 66);
      // acid vat
      s += rr(-20, -22, 48, 56, 8, "#d8e58a", 1.2) + rr(-20, -22, 48, 12, 6, "#f0f6bb", 1.1) + tx(4, -12, "ACID VAT", 6, "middle", INK, 700);
      const bub = [[-4, 4], [10, 14], [-12, 18], [14, 0], [2, 24]];
      bub.forEach(([x, y], i) => { const w = ((t * 2 + i * 0.3) % 1); s += `<circle cx="${x}" cy="${f1(y - w * 10)}" r="${f1(1.2 + w)}" fill="none" stroke="${INK}" stroke-width=".6" opacity="${f1(0.8 * (1 - w))}"/>`; });
      s += dialG(-52, -4, 16, 0.52, "pH 4.5–5", [0.25, 0.42].map((a) => (-135 + a * 270) * Math.PI / 180));
      // autophagosome: debris wrapped, moving into the vat
      const m = sstep(0.0, 0.42, t), wrap = sstep(0, 0.2, t);
      const ax = lerp(-74, -2, m), ay = lerp(30, 8, m);
      if (t < 0.56) { s += rr(ax - 7, ay - 6, 12, 12, 2, "#b9a06c", 1) + rr(ax - 3, ay - 3, 8, 8, 1, "#8e7a56", 0.8); s += `<circle cx="${f1(ax)}" cy="${f1(ay)}" r="${f1(16 - wrap * 3)}" fill="#fff" fill-opacity=".45" class="ink" style="stroke-width:${f1(0.6 + wrap * 0.8)}px"/>`; }
      // conveyor with recycled beads
      s += rr(34, 28, 52, 9, 3, "#8e7a56", 1) + [0, 1, 2, 3, 4].map((i) => ln([[38 + i * 10, 29], [40 + i * 10, 36]], 0.7, "#2a2218")).join("");
      const rb = win(t, 0.5, 1);
      for (let i = 0; i < 6; i++) { const q = rb * 1.6 - i * 0.18; if (q > 0 && q < 1) s += beadG(lerp(34, 82, q), 24, 3.2); }
      // BMR gauge top-right drops
      s += dialG(62, -6, 16, 0.78 - 0.5 * sstep(0.78, 1, t) * 0.92, "BMR", null);
      s += tx(-20, 58, "autophagosome → lysosome", 6, "middle", "#5e5340");
      return s;
    },
  },
  synthesize: {
    title: "Golgi · post office", note: "NEP-245 token stamp · kinesin walks cargo on a microtubule rail · exocytosis iris",
    steps: [[0, "① parcels arrive at the cis tray"], [0.28, "② stamp arm thunks the NEP-245 token"], [0.5, "③ two-legged kinesin courier walks the parcel on the rail"], [0.78, "④ iris opens: the elixir vial exits"]],
    draw(t) {
      let s = plinth(-92, -2, 184, 66);
      // three curved trays (cisternae)
      for (let i = 0; i < 3; i++) { const y = 20 - i * 12; s += pa(`M-78 ${y + 10}Q-50 ${y - 10} -22 ${y + 10}L-22 ${y + 16}Q-50 ${y - 4} -78 ${y + 16}Z`, i % 2 ? WARM : CREAM, 1.1); }
      // stamp arm
      const th = sstep(0.28, 0.4, t) * (1 - sstep(0.4, 0.5, t));
      s += rr(-60, -34, 6, 30, 2, TAN, 1) + rr(-60, -36, 30, 6, 2, TAN, 1) + rr(-38, f1(-30 + th * 16), 12, 6, 1.5, CREAM, 1) + rr(-36, f1(-24 + th * 16), 8, 4, 1, MARI, 0.8);
      if (t > 0.4) s += rr(-44, 4, 22, 9, 2, MARIH, 0.9) + tx(-33, 10.4, "NEP-245", 5.2, "middle", INK, 700);
      // microtubule rail + kinesin courier
      s += ln([[-12, 36], [60, 36]], 4.4, INK) + ln([[-12, 36], [60, 36]], 2.6, "#e6d4a6") + Array.from({ length: 16 }, (_, i) => `<circle cx="${-8 + i * 4.4}" cy="36" r=".9" fill="${INK}"/>`).join("");
      const kx = lerp(-6, 50, sstep(0.46, 0.8, t)), sw = Math.sin(t * 60) * 4;
      s += ln([[kx, 22], [kx - 3 + sw, 34]], 2, INK) + ln([[kx, 22], [kx + 3 - sw, 34]], 2, INK) + ci(kx, 21, 4, CREAM, 1) + rr(kx - 7, 6, 14, 12, 2, WARM, 1) + tx(kx, 14.5, "NEP", 4.4, "middle", INK, 700) + ln([[kx, 18], [kx, 21]], 1);
      // iris exocytosis + vial
      const op = sstep(0.72, 0.86, t);
      s += rr(52, -22, 38, 52, 5, CREAM, 1.1) + iris(71, 2, 14, op) + tx(71, -14, "EXIT", 5.6, "middle", INK, 700);
      if (t > 0.82) { const vy = lerp(2, 46, sstep(0.82, 1, t)); s += rr(66, vy - 7, 10, 15, 3, "#fff", 1) + rr(67.5, vy - 1, 7, 8, 2, MARI, 0.6) + rr(67, vy - 10, 8, 4, 1.5, TAND, 0.7); }
      return s;
    },
  },
  divide: {
    title: "Budding · closed mitosis", note: "balloon bud · taffy nucleus through the neck · zipping septum · bud scar = generation",
    steps: [[0, "① the bud inflates like a balloon"], [0.3, "② the nucleus stretches through the neck, envelope intact"], [0.62, "③ the septum zips shut"], [0.82, "④ a bud scar is left behind"]],
    draw(t) {
      let s = plinth(-92, -2, 184, 66);
      const b = sstep(0.0, 0.4, t), sp = sstep(0.82, 1, t) * 9;
      // mother
      s += el(-30 - sp * 0.3, 26, 34, 28, WARM, 1.2);
      // bud
      const br = 4 + 18 * b;
      s += el(18 + br * 0.5 + sp, 26 - br * 0.1, br, br * 0.92, WARM, 1.2);
      // neck
      if (t < 0.84) s += rr(0, 22, 14, 8 - sstep(0.6, 0.84, t) * 7, 2, WARM, 0.8);
      // taffy nucleus
      const n = win(t, 0.28, 0.68);
      const nx0 = -36, nx1 = lerp(-36, 22 + br * 0.4, n);
      s += pa(`M${f1(nx0 - 10)} ${f1(26 - 11 + 9 * n)}Q${f1((nx0 + nx1) / 2)} ${f1(26 - 9 * (1 - n * 0.6) - 2)} ${f1(nx1 + 8 * n)} ${f1(26 - 8 + 6 * n)}Q${f1(nx1 + 12 * n)} 26 ${f1(nx1 + 8 * n)} ${f1(26 + 8 - 6 * n)}Q${f1((nx0 + nx1) / 2)} ${f1(26 + 9 * (1 - n * 0.6) + 2)} ${f1(nx0 - 10)} ${f1(26 + 11 - 9 * n)}Z`, MARIH, 1.1);
      if (n > 0.9 && t < 0.8) s += pa(`M${f1(nx1 - 14)} 26a5 5 0 1 0 10 0a5 5 0 1 0 -10 0`, MARI, 0.9);
      // septum zipper
      const z = win(t, 0.6, 0.86);
      if (z > 0) { const zy0 = 18, zy1 = 34; for (let i = 0; i < 8; i++) { const y = zy0 + i * 2.2; if ((y - zy0) / (zy1 - zy0) <= z) s += `<rect x="${f1(14 + sp * 0.5)}" y="${f1(y)}" width="5" height="1.4" fill="${INK}"/>`; } }
      // bud scar ring
      if (t > 0.84) s += ci(2 - sp * 0.3, 26, 5, "none", 1.8) + `<circle cx="${f1(2 - sp * 0.3)}" cy="26" r="2" fill="${MARI}"/>` + tx(-20, 62, "bud scar = 1 generation", 6, "middle", "#5e5340");
      s += tx(-30, -4, "mother", 6, "middle", "#5e5340");
      return s;
    },
  },
  splice: {
    title: "Mating · cell fusion", note: "pheromone rings · shmoo arms meet · the two nuclei merge",
    steps: [[0, "① pheromone rings radiate between the cells"], [0.3, "② shmoo arms grow and meet"], [0.62, "③ the wall dissolves, cytoplasm joins"], [0.8, "④ the nuclei merge"]],
    draw(t) {
      let s = plinth(-92, -2, 184, 66);
      const arm = sstep(0.28, 0.62, t), merge = sstep(0.72, 0.95, t);
      s += el(-48, 28, 28, 26, WARM, 1.2) + el(48, 28, 28, 26, WARM, 1.2);
      // shmoo arms
      s += pa(`M-22 20Q${f1(-22 + 22 * arm)} ${f1(14)} ${f1(-22 + 22 * arm)} 28Q${f1(-22 + 22 * arm)} 42 -22 36Z`, WARM, 1.1) + pa(`M22 20Q${f1(22 - 22 * arm)} 14 ${f1(22 - 22 * arm)} 28Q${f1(22 - 22 * arm)} 42 22 36Z`, WARM, 1.1);
      // pheromone radio rings
      for (let i = 0; i < 3; i++) { const q = ((t * 1.6 + i / 3) % 1); if (t < 0.62) { s += `<path d="M${f1(-18 + q * 16)} ${f1(8 - q * 6)}Q${f1(-6 + q * 14)} ${f1(8 - q * 14)} ${f1(-18 + q * 16 + 8)} ${f1(8 - q * 6 + 2)}" fill="none" style="stroke:${MARI};stroke-width:1.6px;opacity:${f1(1 - q)}"/><path d="M${f1(18 - q * 16)} ${f1(8 - q * 6)}Q${f1(6 - q * 14)} ${f1(8 - q * 14)} ${f1(18 - q * 16 - 8)} ${f1(8 - q * 6 + 2)}" fill="none" style="stroke:${MARI};stroke-width:1.6px;opacity:${f1(1 - q)}"/>`; } }
      // dissolving wall
      if (t > 0.6 && t < 0.8) s += `<rect x="-2" y="18" width="4" height="22" fill="${WARM}" opacity="${f1(1 - win(t, 0.6, 0.8))}"/>`;
      // nuclei merge
      const nx = lerp(40, 0, merge), nr = 9 + 5 * merge;
      s += el(-nx, 28, nr, nr, MARIH, 1.1) + (merge < 1 ? el(nx, 28, nr, nr, MARIH, 1.1) : "") + (merge > 0.95 ? ci(0, 28, 6, MARI, 0.8) : "");
      s += tx(-48, -4, "a", 7, "middle", "#5e5340", 700) + tx(48, -4, "α", 7, "middle", "#5e5340", 700);
      return s;
    },
  },
  extract: {
    title: "Sporulation · ascus pod", note: "textbook: 4 spores per ascus · ember, ice, glow",
    steps: [[0, "① the ascus pod forms (4 seeds)"], [0.35, "② the pod cracks"], [0.55, "③ spores released: ember · ice · glow"]],
    draw(t) {
      let s = plinth(-92, -2, 184, 66);
      const cr = sstep(0.32, 0.5, t), fly = win(t, 0.5, 1);
      const cols = ["#e8762b", "#a9d4ec", "#c8e36a", "#e8762b"];
      // pod halves
      s += pa(`M-44 ${f1(14 - cr * 6)}Q-44 -14 -6 ${f1(-16 - cr * 6)}Q-6 14 -6 ${f1(26 - cr * 4)}Z`, WARM, 1.2) + pa(`M-4 ${f1(14 + cr * 4)}Q-4 -14 32 ${f1(-12 + cr * 4)}Q32 14 32 ${f1(26 + cr * 4)}Z`, WARM, 1.2);
      // seeds
      cols.forEach((c, i) => { const x0 = -26 + (i % 2) * 22, y0 = 4 + Math.floor(i / 2) * 14; const tx1 = [-70, 4, 66, 66][i], ty1 = [50, 52, 48, 28][i]; const q = Math.max(0, fly * 1.3 - i * 0.12); const f = sstep(0, 1, Math.min(1, q)); s += ci(lerp(x0, tx1, f), lerp(y0, ty1, f) - Math.sin(f * Math.PI) * 14, 5.6 - 0.6 * f, c, 1); });
      if (cr > 0.2 && cr < 1) s += ln([[-8, -14], [-2, -4], [-8, 6], [-2, 18]], 1.6, INK);
      // bays
      [["spore_ignis", "#e8762b", -76], ["spore_cryo", "#a9d4ec", -6], ["spore_lumin", "#c8e36a", 64]].forEach(([n, c, x]) => { s += rr(x - 12, 40, 28, 14, 3, "#3a2f22", 1) + tx(x + 2, 63, n, 5, "middle", "#5e5340"); });
      return s;
    },
  },
  transmute: {
    title: "Rough ER · chaperone cage", note: "an amino-acid chain folds into a key-shaped enzyme",
    steps: [[0, "① spores arrive as a bead chain"], [0.3, "② the chaperone cage folds the chain"], [0.7, "③ a key-shaped enzyme leaves the ER"]],
    draw(t) {
      let s = plinth(-92, -2, 184, 66);
      const f = sstep(0.3, 0.7, t), out = sstep(0.72, 1, t);
      // ER ribbon
      s += pa("M-86 52Q-60 40 -30 52T30 52T90 52L90 60L-86 60Z", "#f1dca8", 1.1);
      // chain: straight -> key
      const n = 12; const key = [[0, 0], [8, 0], [16, 0], [24, 0], [32, 0], [32, 8], [28, 8], [28, 4], [24, 4], [24, 12], [20, 12]];
      const pts = Array.from({ length: n }, (_, i) => { const a = [-76 + i * 7, 20 + Math.sin(i * 1.2 + t * 8) * 4]; const kp = key[i] ? [-12 + key[i][0], 14 + key[i][1]] : [-12 + 32, 14]; return [lerp(a[0], kp[0], f) + out * 70, lerp(a[1], kp[1], f) - out * 0]; });
      s += ln(pts, 1.6, INK); pts.forEach((p, i) => s += beadG(p[0], p[1], i === 0 ? 4 : 2.8));
      // cage
      const cg = 1 - out;
      if (cg > 0) s += `<g opacity="${f1(cg)}">` + [0, 1, 2, 3].map((i) => pa(`M${f1(-26 + i * 4)} 2Q${f1(-6)} ${f1(-12 + i * 3)} ${f1(14 - i * 4)} 2`, "none", 1.2)).join("") + ln([[-26, 2], [-26, 36]], 1.4) + ln([[14, 2], [14, 36]], 1.4) + `</g>`;
      s += tx(0, -8, f > 0.9 ? "enzyme: a KEY" : "chaperone cage", 7, "middle", INK, 700);
      return s;
    },
  },
  feed: {
    title: "Feed · $SNACC in via transporter", note: "feed_strain · macro signal CrucibleTemp acts as the hormone",
    steps: [[0, "① the hopper chute drops $SNACC pellets toward the membrane"], [0.22, "② the signal binds the receptor Y"], [0.34, "③ the transporter door flips open"], [0.52, "④ pellets pass the door and spread in the cytoplasm"]],
    draw(t) {
      let s = plinth(-92, -2, 184, 66);
      const flip = sstep(0.3, 0.5, t), open = flip > 0.5;
      // membrane: bilayer of head circles (two rows), gap where the transporter sits
      const my = 14;
      s += rr(-90, my - 9, 180, 18, 2, WARM, 0.6);
      for (let i = 0; i < 21; i++) { const x = -84 + i * 8.4; if (Math.abs(x - 18) < 15) continue; s += ci(x, my - 6, 2.7, CREAM, 0.7) + ci(x, my + 6, 2.7, CREAM, 0.7) + ln([[x, my - 3.3], [x, my - 0.5]], 0.5, TAND) + ln([[x, my + 0.5], [x, my + 3.3]], 0.5, TAND); }
      // transporter: two barrels and a flipping marigold door
      s += rr(2, my - 10, 12, 20, 3, TAN, 1.1) + rr(22, my - 10, 12, 20, 3, TAN, 1.1);
      s += rr(14, my - 7, 8, 14, 0, open ? "#fffdf6" : TAND, 0.4);
      s += `<g transform="translate(18 ${my}) rotate(${f1(flip * 90)})">${rr(-9, -2.6, 18, 5.2, 2.4, MARI, 1.2)}</g>`;
      if (open) s += `<circle cx="18" cy="${my}" r="17" fill="none" style="stroke:${MARI};stroke-width:1.8px;opacity:${f1(0.5 + 0.4 * Math.sin(t * 30))}"/>`;
      // receptor Y on the outside and the signal dot landing on it
      s += ln([[-34, my - 10], [-34, -6], [-40, -14]], 2, INK) + ln([[-34, -6], [-28, -14]], 2, INK);
      const sg = win(t, 0.06, 0.24); if (sg > 0) s += ci(lerp(-80, -34, sstep(0, 1, sg)), lerp(-12, -12, sstep(0, 1, sg)), 3.2, MARIH, 0.8);
      // hopper + chute: pellets slide down and through the door
      s += pa("M-84 -50L-56 -50L-62 -36L-78 -36Z", CREAM, 1.1) + rr(-72, -36, 4, 8, 1, TAN, 0.8);
      const chute = [[-70, -30], [-70, -24], [18, -24], [18, my - 8]];
      s += ln(chute, 8, INK) + ln(chute, 5.6, "#e7f3f1");
      const pellet = (p, r) => ci(p[0], p[1], r, MARI, 1) + tx(p[0], p[1] + r * 0.36, "$", r * 1.1, "middle", INK, 700);
      const seg = (q) => { let d = q * 124; if (d < 6) return [-70, -30 + d]; d -= 6; if (d < 88) return [-70 + d, -24]; d -= 88; return [18, -24 + d]; };
      for (let i = 0; i < 5; i++) { const g = (t - 0.04 - i * 0.07) / 0.45; if (g > 0 && g < 1) s += pellet(seg(g), 5.6); }
      // after the door: pellets in the cytoplasm
      for (let i = 0; i < 5; i++) { const g = (t - 0.04 - i * 0.07 - 0.45) / 0.3; if (g > 0) { const q = Math.min(1, g); s += pellet([lerp(18, 18 + Math.cos(i * 1.3) * 56, sstep(0, 1, q)), lerp(my + 12, 44 + Math.sin(i * 2.1) * 6, sstep(0, 1, q))], 5.2 - 1.2 * q); } }
      s += tx(-52, -43, "hopper chute", 6, "start", "#5e5340") + tx(36, my - 20, "transporter door", 6, "start", INK, 700) + tx(0, 60, "cytoplasm · pellets = fuel", 6, "middle", "#5e5340") + tx(-58, -2, "receptor", 5.6, "middle", "#5e5340");
      return s;
    },
  },
  lysis: {
    title: "Lysis · harvest a starving strain", note: "harvest_starving_strain · bounty 10% · the rest returns to the treasury",
    steps: [[0, "① ATP empty: ion pumps stop, the cell swells and the pressure needle climbs"], [0.4, "② the needle is in the red: the membrane tears along its seam"], [0.5, "③ fragments and contents float out; a pipette drone takes the 10% bounty"]],
    draw(t) {
      let s = plinth(-92, -2, 184, 66);
      const sw = sstep(0.04, 0.4, t), tear = sstep(0.4, 0.55, t);
      const cx = -38, cy = 32, rx = 36 * (1 + 0.13 * sw), ry = 29 * (1 + 0.13 * sw);
      // cell wall + contents
      s += `<ellipse cx="${cx + 4}" cy="${cy + 5}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${BROWN}" opacity=".5"/>` + el(cx, cy, rx, ry, WARM, 1.3) + el(cx, cy, rx - 5, ry - 5, "#fffdf6", 0.6);
      s += ci(cx - 6, cy + 2, 9, MARIH, 0.9) + ci(cx + 14, cy + 8, 5, "#c8e36a", 0.8) + ci(cx - 18, cy + 12, 4.4, "#a9d4ec", 0.8);
      s += tx(cx, cy + 4, "ATP = 0", 6.2, "middle", "#7a2b20", 700);
      // seam on the upper right: red when torn, with a dark gap
      const a0 = -1.0, a1 = -0.1, np = 7;
      const sp = Array.from({ length: np }, (_, i) => { const a = a0 + (a1 - a0) * (i / (np - 1)); const r1 = 1 + (i % 2 ? 0.05 : -0.04) * tear; return [cx + Math.cos(a) * rx * r1, cy + Math.sin(a) * ry * r1]; });
      const torn = sp.slice(0, 2 + Math.round(tear * 5));
      if (tear > 0) s += ln(torn, 6.4, INK) + ln(torn, 3.8, "#d94135") + ln(torn, 1.2, "#fff3c8");
      else s += ln(sp, 1, "#d94135", "stroke-dasharray:2 3");
      // fragments + contents flying out
      const o = sp[3], fr = win(t, 0.46, 1);
      for (let i = 0; i < 7 && fr > 0; i++) { const q = clamp(fr * 1.3 - i * 0.04), a = -0.5 - i * 0.37, d = 26 + i * 6; if (q > 0 && q < 1) { const p = [o[0] + Math.cos(a) * d * q + 8 * q, o[1] + Math.sin(a) * d * q * 0.8 - 10 * q]; s += `<path d="M${f1(p[0] - 4)} ${f1(p[1])}L${f1(p[0] - 1)} ${f1(p[1] - 4.4)}L${f1(p[0] + 4.4)} ${f1(p[1] - 1)}L${f1(p[0] + 2)} ${f1(p[1] + 3.6)}Z" fill="${TAN}" class="ink" style="stroke-width:.9px" transform="rotate(${f1(q * 260 + i * 40)} ${f1(p[0])} ${f1(p[1])})"/>`; } }
      for (let i = 0; i < 8 && fr > 0; i++) { const q = (fr * 1.1 + i * 0.09) % 1; s += beadG(o[0] + Math.sin(i * 2.1 + q * 4) * 9 + q * 26, o[1] - q * 44, 2.6 + (i % 3) * 0.5); }
      // pressure gauge with a red zone
      const gx = 66, gy = 22;
      s += dialG(gx, gy, 24, 0.1 + 0.88 * sw, "kPa", null) + redZone(gx, gy, 24) + tx(gx, gy + 36, sw > 0.7 ? "RED: tear!" : "turgor pressure", 6.2, "middle", sw > 0.7 ? "#a8281f" : "#5e5340", 700);
      s += lampG(gx - 8, gy - 36, sw > 0.7, "#d94135");
      // liquidator pipette drone
      const dp = win(t, 0.42, 0.98), dxx = lerp(120, o[0] + 4, sstep(0, 0.35, dp)) - sstep(0.78, 1, dp) * 140, dyy = o[1] - 38 + Math.sin(t * 8) * 2 - sstep(0.78, 1, dp) * 30;
      if (dp > 0 && dp < 1) { s += droneG(dxx, dyy, 1.15, t); for (let i = 0; i < 4; i++) { const q = clamp(win(dp, 0.35, 0.8) * 1.2 - i * 0.14); if (q > 0 && q < 1) s += beadG(lerp(o[0] + 2, dxx, q), lerp(o[1] - 4, dyy + 20, q), 2.4); } }
      return s;
    },
  },
};
const droneG = (x, y, sc, t) => `<g transform="translate(${f1(x)} ${f1(y)}) scale(${sc})"><ellipse cx="0" cy="0" rx="14" ry="6" class="ink" style="fill:#fef8ed;stroke-width:1px"/><ellipse cx="0" cy="1.8" rx="13" ry="2.4" fill="#d8c399" stroke="none"/><path d="M-13 -3L-20 -8M13 -3L20 -8" class="ink" style="stroke-width:1.1px"/><ellipse cx="-20" cy="-9" rx="9" ry="1.7" fill="#161412" opacity="${f1(0.4 + 0.3 * Math.sin(t * 120))}"/><ellipse cx="20" cy="-9" rx="9" ry="1.7" fill="#161412" opacity="${f1(0.4 + 0.3 * Math.cos(t * 120))}"/><path d="M-1.6 6L-1.6 21L0 24.5L1.6 21L1.6 6Z" class="ink" style="fill:#e7f3f1;stroke-width:.9px"/><circle cx="0" cy="0" r="2.4" fill="#f8aa06" class="ink" style="stroke-width:.7px"/><rect x="-8" y="-17" width="16" height="8" rx="2" class="ink" style="fill:#fffdf6;stroke-width:.8px"/><text x="0" y="-11" text-anchor="middle" style="font:700 6px ui-monospace,monospace;fill:#161412">10%</text></g>`;
const redZone = (x, y, r) => { const q = (f) => (-135 + f * 270) * Math.PI / 180, R = r * 0.8; return `<path d="M${f1(x + Math.sin(q(0.72)) * R)} ${f1(y - Math.cos(q(0.72)) * R)}A${f1(R)} ${f1(R)} 0 0 1 ${f1(x + Math.sin(q(0.98)) * R)} ${f1(y - Math.cos(q(0.98)) * R)}" fill="none" style="stroke:#d94135;stroke-width:3.4px;stroke-linecap:round"/>`; };
const plinthMini = (x, y, w, h) => rr(x + 4, y + 6, w, h, 9, BROWN, 0.8) + rr(x, y, w, h, 9, CREAM, 1);
const sceneOrder = Object.keys(SCENES);
