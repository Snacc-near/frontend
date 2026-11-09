// Cell Lab - anatomy-hero bio-reactor rig, round 3 (framework-free build).
// Plain theme (cream body, tan base edge, dark-brown offset shadow, marigold accent) per the owner reference set.
// MIT: anatomy skill by April Zhu. No external requests.
// Usage: node build.mjs [--audit]   -> ../../../public/figures/cell-lab.html
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { k, A, R, HR, P, W, H, layers, emit, dep, CELLC, PLATE, at } from "./ctx.mjs";
import { PLAIN_CSS } from "./theme.mjs";
import { base } from "./scene/base.mjs";
import { chamber, glass } from "./scene/chamber.mjs";
import { cellShell, CC, FP } from "./scene/cellshell.mjs";
import { cellInside, ORG } from "./scene/cell.mjs";
import { hero, GEO } from "./scene/mito.mjs";
import { rig, ATP_ROUTE, FEED_ROUTE, FEED_PORT, DIAL, ATTEST_ROUTE } from "./scene/rig.mjs";
import { lensStatic, LENS } from "./scene/lens.mjs";
import * as F from "./scene/frame.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const stripExport = (s) => s.replace(/^export /gm, "");
const kitSrc = readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8");
const mechScript = stripExport(readFileSync(join(HERE, "mech.mjs"), "utf8"));
const liveSrc = readFileSync(join(HERE, "live.js"), "utf8");
const scenesSrc = readFileSync(join(HERE, "scenes.js"), "utf8");
const live2Src = readFileSync(join(HERE, "live2.js"), "utf8");
/** Keep only the kit functions the page runtime (transitively) uses: no CSS strings, no build-only helpers. */
function shake(src, runtime) {
  const start = /^(?:export )?(?:function\*?|const|let|var)\s+(\w+)/;
  const chunks = []; let cur = { name: null, text: "" };
  for (const ln of src.split("\n")) { const m = ln.match(start); if (m) { chunks.push(cur); cur = { name: m[1], text: "", exported: ln.startsWith("export ") }; } cur.text += ln + "\n"; }
  chunks.push(cur);
  const byName = new Map(chunks.filter((c) => c.name).map((c) => [c.name, c]));
  const used = new Set(), queue = [];
  const mark = (code) => { for (const id of new Set(code.match(/\b[A-Za-z_$][\w$]*\b/g) || [])) if (byName.has(id) && !used.has(id)) { used.add(id); queue.push(id); } };
  mark(runtime);
  while (queue.length) mark(byName.get(queue.pop()).text);
  const kept = chunks.filter((c) => c.name && used.has(c.name));
  return { code: chunks[0].text + kept.map((c) => c.text).join(""), names: kept.filter((c) => c.exported).map((c) => c.name) };
}
const noComments = (s) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\n{2,}/g, "\n");
const shaken = shake(kitSrc, [mechScript, liveSrc, live2Src, scenesSrc].join("\n"));
const kitScript = `const k=(()=>{${noComments(stripExport(shaken.code))}\nreturn {${shaken.names.join(",")}};})();`;

/* ---------- assemble the static scene ---------- */
base();
chamber();
const g = glass();
const sh = cellShell();
const D0 = dep(CELLC[0], CELLC[1], 0);
const bodyCell = cellInside();
emit(D0, g.back + `<g data-dyn="cellroot"><g data-dyn="bud"></g>` + sh.shell + sh.rim + sh.backdrop + `<g data-part="cell-inside">${bodyCell}</g><g data-dyn="cell-fx"></g></g>`, "cell");
emit(D0 + 1, `<g data-glass>${g.front + g.foot + g.fin}</g><g data-dyn="glass-fx"></g>`, "glass-front");
const heroItems = hero();
const rigItems = rig();
// the cutaway cell: the back half of the ovoid (flat = the cut plane facing the viewer), resting on the bath floor
R.put({ piece: "cell", key: D0, at: [0, 0, 0], svg: "", shapes: [R.solid(A.ball(CC, 58.8, { name: "cell.shell", flats: [[FP.n[0], FP.n[1], 0, 0]] }))] });

/* ---------- settle the painter's keys from the recorded geometry (assembled and hero separately) ---------- */
A.settle(R, P);
A.settle(HR, P);
const keyOf = (rec, piece, fallback) => { const it = rec.items.find((i) => i.piece === piece); return it ? it.key : fallback; };
for (const it of heroItems) it.key = keyOf(HR, it.name, it.key);
heroItems.sort((a, b) => a.key - b.key);
emit(dep(F.MC[0], F.MC[1], 0), heroItems.map((i) => i.svg).join("") + `<g data-dyn="hero-tokens"></g>`, "hero");
for (const it of rigItems) emit(keyOf(R, it.name, it.key), it.svg, it.name);
for (const l of layers) if (l.name === "stage" || l.name === "clamps" || l.name === "clamps.back") l.key = keyOf(R, l.name, l.key);
emit(1e5, `<g data-dyn="tokens"></g>`, "tokens");
emit(1e5 + 1, `<g data-dyn="over"></g>`, "over");
layers.sort((a, b) => a.key - b.key);

/* ---------- lens (imagination layer popup) ---------- */
const lens = lensStatic();

const DEFS = `<defs>
<linearGradient id="gl-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff" stop-opacity=".85"/><stop offset=".7" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gl-v2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2"/></filter>
</defs>`;

const svg = k.figureSvg({
  width: W, height: H,
  label: "Cell Lab bio-reactor rig. A glass bell jar holds a yeast-like cell cut open: cell wall and membrane, nucleus with a double envelope and pores drawn as a film archive, Golgi cisternae, rough ER with ribosome dots, a large vacuole, bean-shaped mitochondria with cristae, and lysosomes. In front, a large cut-open mitochondrion is drawn as a power plant: membrane transporter gate, glycolysis splitter, a Krebs Ferris wheel with eight gondolas, electron cable car over complexes I, III and IV, a proton reservoir and an ATP synthase water turbine whose rotor spins and pops marigold ATP coins that ride a glass tube to an ATP dial. Around the plate: instrument panel with pH, turgor, BMR and CrucibleTemp gauges, feed hopper, enclave safe with frosted window, receipt printer, and a spore and elixir shelf.",
  body: [DEFS, ...layers.map((l) => slim(l.svg)), slim(lens.svg)],
});

/** Shorten SVG path data: drop spaces after commands and before minus signs, strip leading zeros, merge repeated commands. */
function rdp(pts, tol) {
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let far = -1, dmax = tol;
    const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const dd = Math.abs((pts[i][0] - x1) * dy - (pts[i][1] - y1) * dx) / len; if (dd > dmax) { dmax = dd; far = i; } }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/** RDP that survives rings: split at the point farthest from the start so both halves have a real chord. */
function ringSafe(pts) {
  let m = 0, best = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > best) { best = d; m = i; } }
  if (m < 2 || m > pts.length - 2) return rdp(pts, 0.2);
  const a = rdp(pts.slice(0, m + 1), 0.2), b = rdp(pts.slice(m), 0.2);
  return [...a, ...b.slice(1)];
}
/** Polyline-only paths (M/L/Z): drop points that lie within 0.1 px of the chord (the kit samples curves densely). */
function thin(toks) {
  if (toks.some((t) => /[A-Za-z]/.test(t) && !/[MLZ]/.test(t))) return toks;
  const out = []; let cur = null, mode = "";
  const flush = (closed) => { if (!cur) return; const p = cur.length > 2 ? ringSafe(cur) : cur; out.push("M", p[0][0], p[0][1]); if (p.length > 1) { out.push("L"); for (let i = 1; i < p.length; i++) out.push(p[i][0], p[i][1]); } if (closed) out.push("Z"); cur = null; };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === "M") { flush(false); cur = []; mode = "M"; } else if (t === "L") mode = "L"; else if (t === "Z") flush(true);
    else { if (!cur) cur = []; cur.push([Number(t), Number(toks[++i])]); }
  }
  flush(false);
  return out.map(String);
}
function minD(d) {
  let toks = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  if (!toks) return d;
  toks = thin(toks);
  let out = "", last = "", prevNum = "";
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { if (t === last && t !== "M" && t !== "m" && t !== "Z" && t !== "z" && t !== "A" && t !== "a") continue; out += t; last = t; prevNum = ""; continue; }
    let n = String(Math.round(Number(t) * 100) / 100);
    if (n === "-0") n = "0";
    n = n.replace(/^(-?)0\./, "$1.");
    if (prevNum && !n.startsWith("-") && !(n.startsWith(".") && prevNum.includes("."))) out += " ";
    out += n; prevNum = n;
  }
  return out;
}
function slim(s) { return s.replace(/ d="([^"]*)"/g, (m, d) => ` d="${minD(d)}"`); }

const geoJson = JSON.stringify({
  P, GEO, W, H,
  ORG: Object.fromEntries(Object.entries(ORG).map(([n, o]) => [n, { screen: o.screen, cx: o.cx, cz: o.cz, dn: o.dn }])),
  ATP_ROUTE, FEED_ROUTE, FEED_PORT, DIAL, CELLC, LENS: LENS, ATTEST_ROUTE,
  SCARS: Array.from({ length: 8 }, (_, i) => sh.scarPoint(i)),
  CELLSCR: at(CC), KS: k.cameraOf(P).k,
  EVB: [8, 0, 972, 612],                       // tight embed viewBox (content bounds, lens included)
  PLANT: at(F.W3(0, 0, 16)),                   // zoom target: the power plant
});

/* ---------- audit: stage + rig + cell (R), then the cut-open mitochondrion (HR) ---------- */
{
  R.items.sort((a, b) => a.key - b.key);
  HR.items.sort((a, b) => a.key - b.key);
  console.log(`recorded: rig/stage/cell ${R.items.length} items ${R.solids.length} solids · mitochondrion ${HR.items.length} items ${HR.solids.length} solids`);
  A.auditOrExit(R, P, { flag: "--audit", quiet: false });
  A.auditOrExit(HR, P, { flag: "--audit", quiet: false });
}

/* ---------- page ---------- */
const PAGE_CSS = `
.stage-shell{position:relative}
.iso-plate{padding:36px 18px 40px}
.dock{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0 4px}
.dock button{font:600 11px/1 ui-sans-serif,system-ui;letter-spacing:.03em;padding:7px 11px;border-radius:999px;border:1.5px solid #161412;background:#fffdf5;color:#161412;cursor:pointer}
.dock button:hover,.dock button.on{background:#f8aa06}
.counters{display:flex;gap:16px;justify-content:center;color:#161412;font:600 12px ui-monospace,Menlo,monospace;margin:6px 0 2px}
.credit{display:block;text-align:right;font:500 9.5px ui-monospace,Menlo,monospace;color:#9a8f78;margin-top:6px}
.svgbox{position:relative}
/* embed: cream page (never dark), the figure fills the frame and re-fits on resize (viewBox is the tight content box) */
html.embed,html.embed body{height:100%;margin:0;background:#efefec;overflow:hidden}
.embed .iso-page{width:100%;max-width:none;height:100%;margin:0;padding:0}
.embed .iso-figure,.embed .iso-plate,.embed .iso-stage{margin:0;padding:0;height:100%;box-shadow:none;background:transparent;border-radius:0}
.embed .svgbox{position:absolute;inset:0}
.embed .iso-svg{position:absolute;inset:0;width:100%;height:100%;margin:0;overflow:hidden}
.embed .iso-plate-corners,.embed .iso-legend,.embed .dock,.embed .counters,.embed .credit{display:none}
.is-lit{filter:drop-shadow(0 0 2px #f8aa06) drop-shadow(0 0 5px rgba(248,170,6,.55))}
[data-org].on .cr{fill:#f8aa06}
.chip-h{position:absolute;left:8px;bottom:8px;max-width:min(540px,calc(100% - 16px));padding:5px 10px 5px 14px;background:#fffdf6;border:1px solid #161412;border-radius:6px;box-shadow:3px 3px 0 #2a2218;font:600 11px/1.35 ui-monospace,Menlo,monospace;color:#161412;pointer-events:none}
.chip-h[hidden]{display:none}
.chip-h::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#f8aa06;border-right:1px solid #161412;border-radius:5px 0 0 5px}
.chip-h b{display:block;font-weight:700}
.chip-h span{display:block;font-weight:500;font-size:10px;color:#3a3226}
.chip-h i{display:block;font-style:normal;font-weight:500;font-size:9px;color:#8a7f68}
@media (max-width:520px){.chip-h{padding:4px 8px 4px 12px}.chip-h b{font-size:10px}.chip-h span{font-size:9px}.chip-h i{display:none}}
.tools{position:absolute;left:8px;top:8px;display:flex;gap:4px;z-index:2}
.tools button{font:600 10px/1 ui-sans-serif,system-ui;padding:5px 8px;border:1.5px solid #161412;border-radius:999px;background:#fffdf5;color:#161412;cursor:pointer}
.tools button:hover,.tools button[aria-pressed=true]{background:#f8aa06}
.labels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.labels[hidden]{display:none}
.labels span{position:absolute;transform:translate(9px,-50%);font:700 9.5px/1 ui-monospace,Menlo,monospace;color:#161412;background:#fffdf6;border:1px solid #161412;border-radius:3px;padding:2px 4px;white-space:nowrap}
.labels span::before{content:"";position:absolute;left:-11px;top:50%;width:6px;height:6px;margin-top:-4px;border-radius:50%;background:#f8aa06;border:1px solid #161412}
.seethru [data-glass]{opacity:.1;transition:opacity .25s}
.calm *{transition:none!important;animation:none!important}
.status-dim{opacity:.62}
.status-grey{filter:grayscale(1);opacity:.7}
.frost{opacity:0}
.tk-txt{font:700 2px ui-monospace,Menlo,monospace;fill:#161412}
@media (prefers-reduced-motion: reduce){.is-lit{filter:drop-shadow(0 0 3px #f8aa06)}}
`;

const ACTIONS = ["feed", "atp", "extract", "transmute", "synthesize", "nucleus", "lysosome", "divide", "lysis", "splice", "vacuole", "attest"];
const dockButtons = ACTIONS.map((a) => `<button type="button" data-action="${a}">${a[0].toUpperCase() + a.slice(1)}</button>`).join("");

const bodyHtml = k.plateHtml({
  fig: "Fig 1",
  title: "Cell Lab — bio-reactor rig",
  hint: "Press an action",
  readout: "Ready",
  keys: [
    { mark: "lit", label: "Marigold: the working part (ATP coins, active organelle)" },
    { mark: "raised", label: "Glass bell jar: yeast-like cell cut open" },
    { mark: "flat", label: "Rig: gauges, hopper, enclave, printer, shelf" },
  ],
  caption: "A yeast-like cell in a glass jar, plus its mitochondrion enlarged as a power plant. Textbook figures: 3 ATP per rotor turn, about 30–32 ATP per glucose, lysosome pH about 4.5–5, 4 spores per ascus. Game numbers come from the app state.",
  body: `<div class="iso-stage stage-shell" tabindex="0" role="group" aria-label="Cell Lab actions"><div class="svgbox">${svg}<div class="labels" data-labels hidden></div><div class="chip-h" data-chip hidden role="status"><b></b><span></span><i></i></div><div class="tools" role="group" aria-label="View"><button type="button" data-tool="see" aria-pressed="false" title="See through the glass jar">See-through</button><button type="button" data-tool="labels" aria-pressed="false" title="Name the organelles">Labels</button><button type="button" data-tool="zoom" title="Zoom: cell, power plant, full view">Zoom</button></div></div><div class="counters"><span data-counter-atp>ATP 0</span><span data-counter-vit>Vitality 70</span></div><div class="dock" role="group" aria-label="Cell Lab action buttons">${dockButtons}</div><span class="credit">Drawn with the Anatomy kit (MIT) by April Zhu — plain marigold</span></div>`,
});

const live = `${kitScript}\n${mechScript}\nconst GEOM=${geoJson};\nconst ACTIONS=${JSON.stringify(ACTIONS)};\n${liveSrc}
${live2Src}
${scenesSrc}
boot();`;
const html = k.pageHtml({ title: "Cell Lab", theme: "light", width: 1100, body: `<style>${PLAIN_CSS}${PAGE_CSS}</style>${bodyHtml}`, script: live });
const outPath = join(HERE, "..", "..", "..", "public", "figures", "cell-lab.html");
writeFileSync(outPath, html);
console.log("wrote", outPath, (html.length / 1024).toFixed(1) + " KB", "layers", layers.length);
