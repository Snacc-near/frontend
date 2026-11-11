// ch-enclave: frosted-glass side chamber (the TEE step) with a sealed capsule, an intake slot and an attestation stamp plate.
import { k, G, P, S, Ln, Dm, at, pathOf, MOD, MOD_H, frontM, rrect, onFront, bbBox3, item, slabS, planeM } from "../ctx.mjs";

const XM = MOD.x + MOD.w;     // front plane of the module
const fpoly = (x0, yz) => pathOf(onFront(x0, yz), true);

/** Pill capsule lying along an axis (superellipse profile on a lathe). */
export function capsule(centre, axis, L, Rr, Pr, className = "bone", { bandAt = null } = {}) {
  const F = G.frameAlong(centre, axis);
  const N = 14, prof = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 - 1;
    const r = Rr * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 3.2)), 1 / 3.2);
    prof.push([t * (L / 2), Math.max(r, 0.01), i > 0 && i < N ? 1 : 0]);
  }
  const body = G.solidOf(prof, F, Pr, {});
  return S(body, { tone: "hi", className, crease: "none" });
}

export function enclave() {
  const p = [];
  const plinth = { x: MOD.x - 4, y: MOD.y - 4, w: MOD.w + 8, d: MOD.d + 8, r: MOD.r + 2 };
  p.push(S(k.slabOf(plinth, 0, 12, P, 8, 0.8), { tone: "hi", className: "tan", crease: "lo" }));
  p.push(S(k.slabOf(MOD, 12, MOD_H - 12 - 16, P, 8, 1), { tone: "hi", crease: "lo" }));
  p.push(Ln(k.sideSeam(MOD, 26, P, 8), { tone: "lo" }));
  // lid
  const lid = { x: MOD.x + 4, y: MOD.y + 4, w: MOD.w - 8, d: MOD.d - 8, r: MOD.r - 2 };
  p.push(S(k.slabOf(lid, MOD_H - 16, 16, P, 8, 1), { tone: "hi", className: "bone", crease: "lo" }));
  // intake slot on the lid with a pill poised above it
  const slot = { x: MOD.x + 30, y: MOD.y + 34, w: 44, d: 50, r: 6 };
  p.push(`<path class="f-dk" d="${k.planOutline(slot, MOD_H, P, 6)}"/>`);
  p.push(Ln(k.planOutline(k.insetPlan(slot, 4), MOD_H, P, 6), { tone: "mid" }));
  // window: frosted glass, front plane
  const wy0 = MOD.y + 12, wy1 = MOD.y + MOD.d - 12, wz0 = 34, wz1 = 92;
  const hole = rrect(wy0, wy1, wz0, wz1, 10, 6);
  p.push(`<path class="f-dk" d="${fpoly(XM, rrect(wy0 - 3, wy1 + 3, wz0 - 3, wz1 + 3, 12, 6))}"/>`);
  p.push(`<path class="f-glassy" d="${fpoly(XM, hole)}"/>`);
  // sealed capsule inside (lying along y), seen through the frost
  const cc = [XM - 22, (wy0 + wy1) / 2, (wz0 + wz1) / 2 + 1];
  const hole0 = fpoly(XM, hole);
  p.push(`<clipPath id="frost-clip"><path d="${hole0}"/></clipPath>`);
  const cap = [capsule(cc, [0, 1, 0], 54, 12, P, "bone")];
  // marigold seal band around the middle (flat ring on the front plane, rides the capsule)
  const bandY = (wy0 + wy1) / 2;
  cap.push(`<path class="f-mari" d="${fpoly(XM - 22 + 11.6, [[bandY - 5, cc[2] - 11], [bandY + 5, cc[2] - 11], [bandY + 5, cc[2] + 11], [bandY - 5, cc[2] + 11]])}"/>`);
  cap.push(`<path class="ink" d="${pathOf([at([XM - 22 + 12, bandY, cc[2] + 2.5]), at([XM - 22 + 12, bandY, cc[2] - 2.5])])}" style="stroke-width:1px"/>`);
  p.push(`<g clip-path="url(#frost-clip)"><g id="capsule" class="capsule-slide">${cap.join("")}</g></g>`);
  // frost veil over the glass + diagonal sheen strokes
  p.push(`<path class="frost" d="${fpoly(XM, hole)}"/>`);
  const sh = [];
  for (let i = -2; i < 9; i++) { const y = wy1 - 6 - i * 12; sh.push(pathOf([at([XM, y, wz0 + 3]), at([XM, y - 22, wz1 - 3])])); }
  p.push(`<g clip-path="url(#frost-clip)"><path class="frost-line" d="${sh.join("")}"/></g>`);
  p.push(`<path class="glass-edge" d="${fpoly(XM, hole)}"/>`);
  p.push(`<path fill="url(#gl-v)" d="${fpoly(XM, [[wy1 - 14, wz0 + 6], [wy1 - 22, wz0 + 6], [wy1 - 22, wz1 - 6], [wy1 - 14, wz1 - 6]])}"/>`);
  // bolts on the window frame
  p.push(Dm([[wy0 - 3, wz0 - 3], [wy1 + 3, wz0 - 3], [wy0 - 3, wz1 + 3], [wy1 + 3, wz1 + 3]].map(([y, z]) => at([XM, y, z])), { size: 0.6, tone: "hi" }));
  // attestation stamp plate (lower front): marigold plate with a check mark
  const sy0 = MOD.y + MOD.d / 2 - 22, sy1 = MOD.y + MOD.d / 2 + 22;
  p.push(`<path class="f-top" d="${fpoly(XM, rrect(sy0, sy1, 14, 24, 3, 4))}"/>`);
  p.push(`<g id="stamp" class="stamp-blink"><path id="enclave-stamp" class="f-mari" d="${fpoly(XM, rrect(sy0 + 3, sy0 + 15, 16, 22, 2, 3))}"/>` +
    `<path class="ink" d="${pathOf([at([XM, sy0 + 6, 19.2]), at([XM, sy0 + 8.2, 17.4]), at([XM, sy0 + 12, 21.2])])}" style="stroke-width:1.2px"/></g>`);
  p.push(`<g transform="${frontM(XM, sy0 + 17, 20.4)}"><text class="txt" x="0" y="0" style="font-size:3.4px;font-weight:700">TEE · ATTESTED</text></g>`);
  // drawer seam + pull
  p.push(Ln(pathOf([at([XM, MOD.y + 3, 28]), at([XM, MOD.y + MOD.d - 3, 28])]), { tone: "lo" }));
  bbBox3("ch-enclave", MOD.x - 4, XM + 2, MOD.y - 4, MOD.y + MOD.d + 4, 0, MOD_H + 10);
  item("enclave", [slabS(plinth, 0, 12, "enclave.plinth", { ground: true }), slabS(MOD, 12, MOD_H - 28, "enclave.body"), slabS(lid, MOD_H - 16, 16, "enclave.lid")]);
  return { svg: p.join("") };
}
