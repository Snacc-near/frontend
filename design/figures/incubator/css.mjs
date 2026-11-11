// CSS for the standalone SVG: kit rules (svg parts only) + the cell-lab plain theme + incubator extras,
// every selector scoped under `.inc` so the file can be inlined into the app page without leaking.
import { ISO_CSS } from "../cell-lab/kit/iso-kit.mjs";
import { PLAIN_CSS } from "../cell-lab/theme.mjs";
import { AZ, EL, KPX } from "./ctx.mjs";

/** Split top-level CSS rules (handles one level of @media nesting). */
function rules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") { depth--; if (depth === 0) { out.push(css.slice(start, i + 1).trim()); start = i + 1; } }
  }
  return out.filter(Boolean);
}
const DROP = /^(\.iso-page|\.iso-figure|\.iso-plate|\.iso-legend|\.iso-key|\.iso-caption|\.iso-swatch|body|html|\*|\.iso-svg\{display)/;
function scopeSel(sel) {
  sel = sel.trim();
  if (/^\.iso(-svg)?(?![\w-])/.test(sel)) return ".inc" + sel;  // the root carries the iso, iso-svg and inc classes
  return ".inc " + sel;
}
function scope(rule) {
  if (rule.startsWith("@keyframes")) return rule;
  if (rule.startsWith("@media")) {
    const head = rule.slice(0, rule.indexOf("{") + 1);
    const inner = rule.slice(head.length, rule.lastIndexOf("}"));
    return head + rules(inner).map(scope).filter(Boolean).join("") + "}";
  }
  const i = rule.indexOf("{");
  const sels = rule.slice(0, i).split(",").map((s) => s.trim());
  if (sels.every((s) => DROP.test(s))) return "";
  return sels.filter((s) => !DROP.test(s)).map(scopeSel).join(",") + rule.slice(i);
}
const min = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\n\s*/g, "").replace(/;}/g, "}");

const fx = (n) => Math.round(n * 10) / 10;
const RAD = Math.PI / 180;

/** State that always applies (also with reduced motion): resting poses and the door hinge map. */
function stateCss() {
  const sA = Math.sin(AZ * RAD), cA = Math.cos(AZ * RAD), sE = Math.sin(EL * RAD);
  return `
@property --door{syntax:"&lt;angle&gt;";inherits:false;initial-value:0deg}
.inc #door{transform:matrix(calc(cos(var(--door) - ${AZ}deg) / ${fx(cA * 1000) / 1000}),calc((sin(var(--door) - ${AZ}deg) + ${fx(sA * 1000) / 1000}) * ${sE} / ${fx(cA * 1000) / 1000}),0,1,0,0)}
.inc[data-door="open"] #door{--door:100deg}
.inc #door-spill{opacity:0}
.inc[data-door="open"] #door-spill{opacity:1}
.inc #needle{transform:rotate(-8deg)}
.inc .needle-line{fill:none;stroke:#f8aa06;stroke-width:1.8px;stroke-linecap:round}
.inc .dial-zone{fill:none;stroke-width:3px}
.inc #thermo-fill{transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(.42)}
.inc .key-lamp{opacity:0}.inc .key-2{opacity:1}
.inc .atp-speck{fill:#f8aa06;stroke:var(--ink);stroke-width:.5px}
.inc .drop{fill:#fff;fill-opacity:.6;stroke:#9a8f78;stroke-width:.5px}
.inc .vent-steam{fill:none;stroke:var(--anatomy-mid);stroke-width:1.3px;stroke-linecap:round;opacity:0}
.inc .win-glow{opacity:.85}
`;
}

/** Idle motion: transform and opacity only, and only when the visitor has not asked for reduced motion. */
function motionCss() {
  const cosE = Math.cos(EL * RAD), sA = Math.sin(AZ * RAD), cA = Math.cos(AZ * RAD), sE = Math.sin(EL * RAD);
  const slideDx = fx(46 * KPX * cA), slideDy = fx(-46 * KPX * sA * sE);
  const py = (s) => fx(-(s - 0.42) * 90 * cosE * KPX);
  return `
@media (prefers-reduced-motion:no-preference){
.inc #door{transition:--door 1.6s cubic-bezier(.32,.72,0,1)}
.inc #door-spill{transition:opacity 1.2s ease}
.inc .idle-breathe{transform-box:fill-box;transform-origin:50% 100%;animation:inc-breathe 5.2s ease-in-out infinite}
.inc .idle-blink{animation:inc-blink 3.4s ease-in-out infinite}
.inc .coin-drift{animation:inc-coin 3.8s ease-in-out infinite}
.inc .win-glow{transform-box:fill-box;transform-origin:50% 50%;animation:inc-glow 6s ease-in-out infinite}
.inc .drop{animation:inc-drop 19s ease-in infinite}
.inc .drop:nth-child(2n){animation-duration:25s;animation-delay:-7s}
.inc .drop:nth-child(3n){animation-duration:31s;animation-delay:-16s}
.inc .vent-steam{transform-box:fill-box;transform-origin:50% 100%;animation:inc-steam 4.6s ease-out infinite}
.inc .vent-steam.s2{animation-delay:-1.5s}.inc .vent-steam.s3{animation-delay:-3s}
.inc .vent-steam.b{animation-delay:-2.3s;animation-duration:5.4s}
.inc .wob-1,.inc .wob-2,.inc .wob-3,.inc .merge-a,.inc .merge-b{transform-box:fill-box;transform-origin:50% 100%}
.inc .wob-1{animation:inc-wob 5.8s ease-in-out infinite}
.inc .wob-2{animation:inc-wob 6.9s ease-in-out -2s infinite}
.inc .wob-3{animation:inc-wob 7.9s ease-in-out -4s infinite}
.inc .merge-a{animation:inc-merge-a 7s ease-in-out infinite}
.inc .merge-b{animation:inc-merge-b 7s ease-in-out infinite}
.inc [data-cell="hungry"] .crack{animation:inc-crack 1.7s ease-in-out infinite}
.inc .atp-speck{animation:inc-speck 5.4s ease-out infinite}
.inc #thermo-fill{animation:inc-fill 9s ease-in-out infinite}
.inc #thermo-pointer{animation:inc-pointer 9s ease-in-out infinite}
.inc #needle{animation:inc-needle 9s ease-in-out infinite}
.inc .key-1,.inc .key-2,.inc .key-3{animation:inc-key 3.6s step-end infinite}
.inc .key-2{animation-delay:-2.4s}.inc .key-3{animation-delay:-1.2s}
.inc .capsule-slide{animation:inc-capsule 10s ease-in-out infinite}
.inc .stamp-blink{animation:inc-stamp 2.6s ease-in-out infinite}
@keyframes inc-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
@keyframes inc-blink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes inc-coin{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes inc-glow{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.07)}}
@keyframes inc-drop{0%{opacity:0;transform:translateY(0)}8%{opacity:.8}50%{transform:translateY(0);opacity:.8}100%{opacity:0;transform:translateY(46px)}}
@keyframes inc-steam{0%{opacity:0;transform:translateY(10px) scaleY(.6)}30%{opacity:.6}100%{opacity:0;transform:translateY(-24px) scaleY(1.12)}}
@keyframes inc-wob{0%,100%{transform:translate(0,0) scale(1,1)}50%{transform:translate(.9px,-.7px) scale(1.035,.965)}}
@keyframes inc-merge-a{0%,100%{transform:translateX(0)}50%{transform:translateX(5px) scale(1.04)}}
@keyframes inc-merge-b{0%,100%{transform:translateX(0)}50%{transform:translateX(-5px) scale(1.04)}}
@keyframes inc-crack{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes inc-speck{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(7px,-24px)}}
@keyframes inc-fill{0%,100%{transform:scaleY(.36)}50%{transform:scaleY(.52)}}
@keyframes inc-pointer{0%,100%{transform:translateY(${py(0.36)}px)}50%{transform:translateY(${py(0.52)}px)}}
@keyframes inc-needle{0%,100%{transform:rotate(-35deg)}50%{transform:rotate(25deg)}}
@keyframes inc-key{0%{opacity:1}33.3%,100%{opacity:0}}
@keyframes inc-capsule{0%{opacity:0;transform:translate(${slideDx}px,${slideDy}px)}14%{opacity:1}32%,76%{opacity:1;transform:translate(0,0)}92%,100%{opacity:0;transform:translate(${fx(-slideDx * 0.5)}px,${fx(-slideDy * 0.5)}px)}}
}
`;
}

export function incubatorCss() {
  // kit rules minus the dark/light theme variable blocks (the plain theme supplies the variables)
  const kit = rules(ISO_CSS).filter((r) => !/^\.iso(\[data-theme="light"\])?\s*\{/.test(r)).map(scope).join("");
  const plain = rules(PLAIN_CSS).map(scope).join("");
  const extra = `
.inc{overflow:hidden;display:block;width:100%;height:auto}
.inc .cav-b{fill:#c9b583}.inc .cav-r{fill:#ad9768}.inc .cav-f{fill:#d6c392}
.inc .cream{--anatomy-shade-0:#dcccA6;--anatomy-shade-1:#e8dbb9;--anatomy-shade-2:#f2e8cc;--anatomy-shade-3:#fef8ed}
.inc .beam{fill:#f8aa06;fill-opacity:.1;stroke:none}
.inc .spill{fill:#f8aa06;fill-opacity:.28;stroke:none}
.inc .agar{--anatomy-paper:#eccd82;--anatomy-face:#eccd82;--anatomy-top:#f3d994;--anatomy-shade-0:#c9a554;--anatomy-shade-1:#d6b466;--anatomy-shade-2:#e2c176;--anatomy-shade-3:#eccd82}
.inc .f-glassy{fill:#e9f2f4;stroke:none}
.inc .f-zone{stroke:var(--ink);stroke-width:.7px}
.inc .frost{fill:#eef3f2;fill-opacity:.82;stroke:none}
.inc .frost-line{fill:none;stroke:#fff;stroke-width:1.1px;stroke-opacity:.8}
.inc ellipse,.inc rect,.inc polygon,.inc .ink,.inc .ink2,.inc .ink3{vector-effect:non-scaling-stroke}
.inc .cshadow{fill:#2a2218;fill-opacity:.16;stroke:none}
.inc .f-matrix{fill:#f8e7bc;stroke:var(--ink);stroke-width:1px}
.inc .mito-inner{fill:#fbeecb;stroke:#b87800;stroke-width:1.2px}
.inc .crista{fill:#f6dca0;stroke:var(--ink);stroke-width:.8px;stroke-linecap:round}
.inc .lolli circle{fill:#fff;stroke:var(--ink);stroke-width:.6px}
.inc .f-cut{fill:#f6ead0;stroke:none}.inc .f-cut2{fill:#fcf5e1;stroke:none}
.inc .membrane{fill:none;stroke:#f8aa06;stroke-width:1.6px}
.inc .dna{fill:none;stroke:var(--ink);stroke-width:.9px;stroke-linecap:round}.inc .dna2{fill:none;stroke:#b87800;stroke-width:.9px}
.inc .mari-dot{fill:#f8aa06;stroke:var(--ink);stroke-width:.5px}
.inc .crack{fill:none;stroke:var(--ink);stroke-width:1.1px;stroke-linecap:round;stroke-linejoin:round}
.inc .leak{fill:none;stroke:var(--ink);stroke-width:.6px;stroke-dasharray:1.5 2.2;opacity:.7}
.inc .spec-ring{fill:none;stroke:#f8aa06;stroke-width:1.3px;stroke-dasharray:3 3}
`;
  return min(kit) + min(plain) + min(extra) + min(stateCss()) + min(motionCss());
}
