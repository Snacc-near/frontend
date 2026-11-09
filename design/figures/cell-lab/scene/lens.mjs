// Imagination lens: a magnifier popup in the empty top-right of the card where the micro-factory machine of the
// active organelle is drawn (film archive, post office, water tower...). Static frame only here; scenes are drawn live.
import { f1 } from "../ctx.mjs";

export const LENS = { cx: 838, cy: 150, r: 112 };

export function lensStatic() {
  const { cx, cy, r } = LENS;
  const ring = (rad, cls, extra = "") => `<circle cx="${cx}" cy="${cy}" r="${rad}" class="${cls}" ${extra}/>`;
  let ticks = "";
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    ticks += `M${f1(cx + Math.cos(a) * (r + 7.2))} ${f1(cy + Math.sin(a) * (r + 7.2))}L${f1(cx + Math.cos(a) * (r + 9.6))} ${f1(cy + Math.sin(a) * (r + 9.6))}`;
  }
  const svg = `<g data-dyn="lens" opacity="0" style="pointer-events:none">
<circle cx="${cx + 8}" cy="${cy + 9}" r="${r + 14}" fill="#2a2218"/>
<circle cx="${cx}" cy="${cy}" r="${r + 14}" class="f-tan" style="stroke-width:1.1px"/>
<circle cx="${cx}" cy="${cy}" r="${r + 11}" fill="#e6d4a6" class="ink" style="stroke-width:.7px"/>
<path d="${ticks}" class="ink2" style="stroke-width:.7px"/>
<clipPath id="lens-clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fffdf6" class="ink" style="stroke-width:1px"/>
<g clip-path="url(#lens-clip)"><g data-dyn="lens-bg"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#f9f0da"/></g><g data-dyn="lens-scene"></g>
<path d="M${f1(cx - r * 0.78)} ${f1(cy - r * 0.38)}A${f1(r * 0.86)} ${f1(r * 0.86)} 0 0 1 ${f1(cx - r * 0.3)} ${f1(cy - r * 0.78)}" fill="none" style="stroke:#fff;stroke-width:4px;stroke-linecap:round;opacity:.8"/></g>
<g data-dyn="lens-chip"></g>
</g>
<g data-dyn="lens-leader" opacity="0"></g>`;
  return { svg };
}
