// Cell Lab - anatomy-hero bio-reactor rig, round 3 (framework-free build).
// Plain theme (cream body, tan base edge, dark-brown offset shadow, marigold accent) per the owner reference set.
// MIT: anatomy skill by April Zhu. No external requests.
// Usage: node build.mjs [--audit]   -> ../../../public/figures/cell-lab.html
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { k, A, R, P, W, H, layers, emit, dep, CELLC, PLATE, at } from "./ctx.mjs";
import { PLAIN_CSS } from "./theme.mjs";
import { base } from "./scene/base.mjs";
import { chamber, glass } from "./scene/chamber.mjs";
import { cellShell, CC } from "./scene/cellshell.mjs";
import { cellInside, ORG } from "./scene/cell.mjs";
import { hero, GEO } from "./scene/mito.mjs";
import { rig, ATP_ROUTE, FEED_ROUTE, FEED_PORT, DIAL, ATTEST_ROUTE } from "./scene/rig.mjs";
import { lensStatic, LENS } from "./scene/lens.mjs";
import * as F from "./scene/frame.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const stripExport = (s) => s.replace(/^export /gm, "");
const kitSrc = readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8");
const kitNames = [...kitSrc.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
const kitScript = `const k=(()=>{${stripExport(kitSrc)}\nreturn {${kitNames.join(",")}};})();`;
const mechScript = stripExport(readFileSync(join(HERE, "mech.mjs"), "utf8"));
const liveSrc = readFileSync(join(HERE, "live.js"), "utf8");
const scenesSrc = readFileSync(join(HERE, "scenes.js"), "utf8");
const live2Src = readFileSync(join(HERE, "live2.js"), "utf8");

/* ---------- assemble the static scene ---------- */
base();
chamber();
const g = glass();
const sh = cellShell();
const D0 = dep(CELLC[0], CELLC[1], 0);
const bodyCell = cellInside();
emit(D0, g.back + `<g data-dyn="cellroot"><g data-dyn="bud"></g>` + sh.shell + sh.rim + sh.backdrop + `<g data-part="cell-inside">${bodyCell}</g><g data-dyn="cell-fx"></g></g>`, "cell");
emit(D0 + 1, g.front + g.foot + g.fin + `<g data-dyn="glass-fx"></g>`, "glass-front");
const heroItems = hero();
emit(dep(F.MC[0], F.MC[1], 0), heroItems.map((i) => i.svg).join("") + `<g data-dyn="hero-tokens"></g>`, "hero");
for (const it of rig()) emit(it.key, it.svg, it.name);
emit(1e5, `<g data-dyn="tokens"></g>`, "tokens");
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
  body: [DEFS, ...layers.map((l) => l.svg), lens.svg],
});

const geoJson = JSON.stringify({
  P, GEO, W, H,
  ORG: Object.fromEntries(Object.entries(ORG).map(([n, o]) => [n, { screen: o.screen, cx: o.cx, cz: o.cz, dn: o.dn }])),
  ATP_ROUTE, FEED_ROUTE, FEED_PORT, DIAL, CELLC, LENS: LENS, ATTEST_ROUTE,
  SCARS: Array.from({ length: 8 }, (_, i) => sh.scarPoint(i)),
  CELLSCR: at(CC), KS: k.cameraOf(P).k,
});

/* ---------- audit (recorded solids and tubes only) ---------- */
{
  const shapes = [];
  A.settle(R, P);
  R.items.sort((a, b) => a.key - b.key);
  A.auditOrExit(R, P, { flag: "--audit", quiet: false });
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
.embed .iso-page{max-width:none;padding:0}
.embed body,.embed{background:transparent}
.embed .iso-figure{margin:0}
.embed .iso-plate{padding:0;box-shadow:none;background:transparent}
.embed .iso-plate-corners,.embed .iso-legend,.embed .dock,.embed .counters,.embed .credit{display:none}
.embed .iso-svg{overflow:visible}
.is-lit{filter:drop-shadow(0 0 2px #f8aa06) drop-shadow(0 0 5px rgba(248,170,6,.55))}
.chip rect{fill:#fffdf6;stroke:#161412;stroke-width:1px}
.chip .t{font:700 10.8px ui-monospace,Menlo,monospace;fill:#161412;letter-spacing:.04em}
.chip .s{font:500 8.6px ui-monospace,Menlo,monospace;fill:#5e5340}
.chip .n{font:500 8.5px ui-monospace,Menlo,monospace;fill:#9a8f78}
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
  body: `<div class="iso-stage stage-shell" tabindex="0" role="group" aria-label="Cell Lab actions">${svg}<div class="counters"><span data-counter-atp>ATP 0</span><span data-counter-vit>Vitality 70</span></div><div class="dock" role="group" aria-label="Cell Lab action buttons">${dockButtons}</div><span class="credit">Drawn with the Anatomy kit (MIT) by April Zhu — plain marigold</span></div>`,
});

const live = `${kitScript}\n${mechScript}\nconst GEOM=${geoJson};\nconst ACTIONS=${JSON.stringify(ACTIONS)};\n${liveSrc}
${live2Src}
${scenesSrc}
boot();`;
const html = k.pageHtml({ title: "Cell Lab", theme: "light", width: 1100, body: `<style>${PLAIN_CSS}${PAGE_CSS}</style>${bodyHtml}`, script: live });
const outPath = join(HERE, "..", "..", "..", "public", "figures", "cell-lab.html");
writeFileSync(outPath, html);
console.log("wrote", outPath, (html.length / 1024).toFixed(1) + " KB", "layers", layers.length);
