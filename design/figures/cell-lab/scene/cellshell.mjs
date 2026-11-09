// Cell shell: a yeast-like ovoid cut by a vertical plane facing the viewer. Wall + membrane rim, concave interior backdrop,
// bud scars. Organelles are drawn by cell.mjs in front of the backdrop.
import { k, O, P, S, Dm, at, f1, CELLC, CELL_R, CELL_Z } from "../ctx.mjs";

export const CC = [CELLC[0], CELLC[1], CELL_Z];
const [RH, RV] = CELL_R;
const AZ = Math.PI / 4;
export const FP = { e1: [Math.sin(AZ), -Math.cos(AZ), 0], e2: [0, 0, 1], n: [Math.cos(AZ), Math.sin(AZ), 0] };

/** World point from face-plane coords (dx right, dz up, dn toward viewer) about the cell centre. */
export const cw = (dx, dz, dn = 0, c = CC) => [c[0] + FP.e1[0] * dx + FP.n[0] * dn, c[1] + FP.e1[1] * dx + FP.n[1] * dn, c[2] + dz];
export const cp = (dx, dz, dn = 0, c = CC) => at(cw(dx, dz, dn, c));

export function cellShell() {
  const cutEll = (rh, rv, steps = 120) => O.ellipse3(CC, FP.e1, FP.e2, rh, rv, P, { steps });
  const c0 = at(CC);
  // outer shell (ovoid), clipped to: silhouette above the cut line + the lower half of the cut ellipse
  const shell = O.ellipsoidOf(CC, [RH, RH, RV], 0, P, { steps: 120 });
  const nums = shell.outline.match(/-?\d+\.?\d*/g).map(Number);
  const sp = [];
  for (let i = 0; i < nums.length; i += 2) sp.push([nums[i], nums[i + 1]]);
  const upper = sp.filter(([, y]) => y <= c0[1] + 0.5).sort((a, b) => a[0] - b[0]);
  const outer = cutEll(RH, RV);
  const lowerCut = outer.filter(([, y]) => y >= c0[1]).sort((a, b) => b[0] - a[0]);
  const clip = O.pathOf([...upper, ...lowerCut], true);
  const out = {};
  out.shell = `<defs><clipPath id="cell-clip"><path d="${clip}"/></clipPath></defs><g clip-path="url(#cell-clip)">${S(shell, { tone: "hi", className: "tan", crease: "none" })}</g><path class="ink" d="${clip}"/>`;
  // wall ring (cut thickness) + hatch of microfibrils + membrane
  const wo = cutEll(RH, RV), wi = cutEll(RH - 4.4, RV - 4.4), mi = cutEll(RH - 6, RV - 6);
  const hatch = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    const q0 = O.ellipse3(CC, FP.e1, FP.e2, RH - 0.3, RV - 0.3, P, { from: a, to: a, steps: 1 })[0];
    const q1 = O.ellipse3(CC, FP.e1, FP.e2, RH - 4.2, RV - 4.2, P, { from: a, to: a, steps: 1 })[0];
    return `M${f1(q0[0])} ${f1(q0[1])}L${f1(q1[0])} ${f1(q1[1])}`;
  }).join("");
  out.rim = `<path d="${O.pathOf(wo, true)}${O.pathOf(wi.slice().reverse(), true)}" fill-rule="evenodd" fill="#ead7a6" class="ink" style="stroke-width:1px"/>` +
    `<path d="${hatch}" class="ink3" style="stroke-width:.4px"/>` +
    `<path d="${O.pathOf(wi, true)}" class="ink" style="stroke-width:.8px"/>` +
    `<path d="${O.pathOf(mi, true)}" fill="none" style="stroke:#f8aa06;stroke-width:1.7px"/>`;
  // interior backdrop: concave inner wall banded toward the centre
  const bands = [[RH - 6, RV - 6, "#ecdbad"], [RH - 10, RV - 10, "#f2e5bc"], [RH - 17, RV - 17, "#f7edd2"], [RH - 27, RV - 28, "#fbf4e2"]];
  out.backdrop = bands.map(([rh, rv, col]) => `<path d="${O.pathOf(cutEll(rh, rv), true)}" fill="${col}"/>`).join("");
  const grain = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 120; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.92;
    grain.push(cp(Math.cos(a) * (RH - 8) * r, Math.sin(a) * (RV - 8) * r, 0));
  }
  out.backdrop += Dm(grain, { size: 0.5, tone: "lo" });
  // bud scars on the wall (generation counter): drawn per generation by the runtime too
  out.scarPoint = (i) => { const a = -0.95 + i * 0.34; return cp(Math.cos(a) * (RH + 0.4), Math.sin(a) * (RV + 0.4), 0); };
  return out;
}
