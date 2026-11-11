// Incubator world figure (UI-135): one standalone isometric SVG, camera-ready.
// Usage: node build.mjs [--audit]  ->  public/figures/incubator.svg + public/figures/incubator.cam.json
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { k, A, P, W, H, R, BB, bbAdd, r2, at, DISH, AGAR_Z } from "./ctx.mjs";
import { incubatorCss } from "./css.mjs";
import * as M from "./scene/machine.mjs";
import * as I from "./scene/interior.mjs";
import { enclave } from "./scene/enclave.mjs";
import { colony } from "./scene/organisms.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "..", "public", "figures");

/* ---------- assemble, back to front ---------- */
const plate = M.plate();
const enc = enclave();
const feet = M.feet();
const body = M.body();
const cav = I.cavity();
const shelf = I.shelf();
const lamp = I.lamp();
const thermo = I.thermo();
const dish = I.dish();
const col = colony();
const bezel = M.bezel();
const hood = M.hood();
const door = M.door();

const g = (id, inner, attrs = "") => `<g id="${id}"${attrs}>${inner}</g>`;
const [gx, gy] = at([DISH.cx, DISH.cy, AGAR_Z + 34]);
const glow = `<ellipse class="win-glow" cx="${r2(gx)}" cy="${r2(gy)}" rx="250" ry="150" fill="url(#gl-warm)"/>`;

const interior = g("ch-interior", cav + glow + shelf + lamp + g("ch-thermo", thermo) +
  g("ch-dish", dish.back + col.svg + dish.front), ` clip-path="url(#win-clip)"`);

// depth groups for pointer parallax: back = bench + side chamber, mid = the machine and everything inside it, front = glass, steam
const world = g("ch-incubator",
  g("layer-back", plate + g("ch-enclave", enc.svg)) +
  g("layer-mid", feet + body + interior + hood) +
  g("layer-front", bezel + g("ch-door", door.leaf + door.spill) + `<g class="steam">${M.steam()}</g>`));

const DEFS = `<defs>
<linearGradient id="gl-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff" stop-opacity=".85"/><stop offset=".7" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gl-v2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="gl-warm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f8aa06" stop-opacity=".5"/><stop offset=".55" stop-color="#f8aa06" stop-opacity=".16"/><stop offset="1" stop-color="#f8aa06" stop-opacity="0"/></radialGradient>
<clipPath id="win-clip"><path d="${M.windowClipPath()}"/></clipPath>
</defs>`;

const LABEL = "Isometric cutaway of a laboratory incubator. A rounded cream machine with a three-vent hood and a big front window holds a petri dish on a shelf under a marigold lamp; a thermometer with three zone bands stands inside. On the dish agar a small colony of cells: one hungry and cracked, a pair merging, and one opened to show its stomach vacuole, nucleus with DNA and a mitochondrion with cristae and marigold ATP tokens. Beside the incubator a frosted-glass chamber holds a sealed capsule. Drawn so a scroll camera can zoom from the machine down to one mitochondrion.";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="inc iso iso-svg" data-theme="light" viewBox="0 0 ${W} ${H}" role="img" aria-label="${LABEL}"><style>${incubatorCss()}</style>${DEFS}<g id="cam">${world}</g></svg>`;

/* ---------- audit (macro assembly: plate, feet, body shell, hood, shelf, lamp, thermometer, dish, enclave) ---------- */
{
  A.settle(R, P);
  console.log(`recorded: ${R.items.length} items ${R.solids.length} solids`);
  // Excused pairs: the shelf, lamp and thermometer stand inside the cavity and are painted after the body, clipped by the window
  // hole (clip-path), which is what makes the jambs, lintel and sill hide them. The audit sees solids, not clip paths.
  A.auditOrExit(R, P, { flag: "--audit", quiet: false, allow: [["body", "shelf"], ["body", "lamp"], ["body", "thermo"]] });
}

/* ---------- camera anchors (bounding boxes gathered from the drawn geometry) ---------- */
const ORDER = ["ch-incubator", "ch-dish", "ch-colony", "ch-cell", "ch-mito", "ch-thermo", "ch-enclave", "ch-door"];
const PARENT = { "ch-incubator": null, "ch-dish": "ch-incubator", "ch-colony": "ch-dish", "ch-cell": "ch-colony", "ch-mito": "ch-cell", "ch-thermo": "ch-incubator", "ch-enclave": "ch-incubator", "ch-door": "ch-incubator" };
const anchors = {};
for (const id of ORDER) {
  const b = BB.get(id);
  if (!b) throw new Error("no bbox for " + id);
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const margin = id === "ch-incubator" ? 1.0 : 1.55;
  const scale = Math.min(W / (w * margin), H / (h * margin));
  anchors[id] = { x: r2(b.x0), y: r2(b.y0), w: r2(w), h: r2(h), cx: r2(b.x0 + w / 2), cy: r2(b.y0 + h / 2), scale: r2(Math.min(scale, 60)), parent: PARENT[id] };
}
const cam = {
  viewBox: [0, 0, W, H], root: "cam",
  note: "x/y/w/h in viewBox units, computed by build.mjs from the drawn geometry. scale = suggested camera zoom that fits the box with a margin (capped at 60).",
  layers: ["layer-back", "layer-mid", "layer-front"],
  hooks: {
    door: "#door: set --door (an angle, 0deg closed .. 100deg open) or data-door=\"open\" on the svg root; #door-spill glows when open",
    needle: "#needle: rotate about its hub (CSS transform: rotate(var(--needle)))",
    thermoFill: "#thermo-fill: scaleY, origin bottom (CSS var --fill is not used while the idle animation runs; set animation:none first)",
    thermoPointer: "#thermo-pointer: marigold marker on the zone bar",
    capsule: "#capsule (slides in), #stamp (blinks)",
    cells: ["#cell-hungry", "#cell-merge-a", "#cell-merge-b"],
    classes: [".vent-steam", ".atp-speck", ".drop", ".key-lamp"],
    cell: col.heroId, mitoAtp: col.atpIds,
  },
  anchors,
};

writeFileSync(join(OUT, "incubator.svg"), svg);
writeFileSync(join(OUT, "incubator.cam.json"), JSON.stringify(cam, null, 2) + "\n");
/* ---------- preview page (not shipped): the svg inlined, camera buttons with a CSS transform transition, door and motion toggles ---------- */
const stops = Object.entries(anchors).map(([id, a]) => ({ id, cx: a.cx, cy: a.cy, s: a.scale }));
const preview = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>incubator preview</title>
<style>html,body{margin:0;height:100%;background:#efefec;overflow:hidden;font:600 11px/1 ui-monospace,Menlo,monospace}
#stage{position:fixed;inset:0}#stage svg{width:100%;height:100%;display:block}
#cam{transform-origin:0 0;transition:transform 1.5s cubic-bezier(.32,.72,0,1)}
#bar{position:fixed;left:10px;bottom:10px;display:flex;gap:6px;flex-wrap:wrap;z-index:2}
#bar button{font:inherit;padding:7px 10px;border:1.5px solid #161412;border-radius:999px;background:#fffdf5;color:#161412;cursor:pointer}
#bar button:hover,#bar button.on{background:#f8aa06}</style></head><body>
<div id="stage">${svg}</div>
<div id="bar">${stops.map((s) => `<button data-id="${s.id}">${s.id.replace("ch-", "")}</button>`).join("")}<button id="btn-door">open/close door</button><button id="par">parallax</button></div>
<script>
const STOPS=${JSON.stringify(stops)}, W=${W}, H=${H};
const cam=document.getElementById("cam"), root=document.querySelector("svg");
function go(id){const s=STOPS.find(x=>x.id===id); const k=id==="ch-incubator"?1:s.s; const tx=W/2-k*s.cx, ty=H/2-k*s.cy; cam.style.transform="translate("+(id==="ch-incubator"?0:tx)+"px,"+(id==="ch-incubator"?0:ty)+"px) scale("+k+")"; document.querySelectorAll("#bar [data-id]").forEach(b=>b.classList.toggle("on",b.dataset.id===id));}
document.querySelectorAll("#bar [data-id]").forEach(b=>b.onclick=()=>go(b.dataset.id));
document.getElementById("btn-door").onclick=()=>{root.dataset.door=root.dataset.door==="open"?"":"open"};
let par=false;addEventListener("pointermove",e=>{if(!par)return;const nx=e.clientX/innerWidth-.5,ny=e.clientY/innerHeight-.5;for(const [id,d] of [["layer-back",-10],["layer-mid",0],["layer-front",12]])document.getElementById(id).style.transform="translate("+nx*d+"px,"+ny*d*.6+"px)"});
document.getElementById("par").onclick=()=>{par=!par};
const q=new URLSearchParams(location.search); if(q.get("go")) go(q.get("go")); if(q.get("door")) root.dataset.door="open";
</script></body></html>`;
writeFileSync(join(HERE, "preview.html"), preview);

const nodes = (svg.match(/<(path|circle|ellipse|rect|polygon|polyline|line|text|use|g)\b/g) || []).length;
console.log("wrote incubator.svg", (svg.length / 1024).toFixed(1) + " KB", "elements", nodes);
