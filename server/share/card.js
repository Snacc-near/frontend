// @ts-check
/**
 * The 1200x630 share cards as SVG strings (UI-157). Pure functions: data in, SVG text out, so they are
 * unit-tested without a renderer. `render.js` turns the string into a PNG. Colours and fonts follow the
 * app's tokens (`src/index.css`): paper background, ink text, marigold accent, DM Sans and JetBrains Mono.
 */
import { embedSvg } from "./svg.js";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
const VITALITY_MAX = 10000;
const DISTRESS_MAX = 2000;

const C = {
  bg: "#efefec",
  panel: "#fbfbf9",
  edge: "#e1e1dd",
  ink: "#16181a",
  mute: "#5d6165",
  faint: "#8d9194",
  accent: "#f8aa06",
  ok: "#3f7d4e",
  okBg: "#e8f1e6",
  warm: "#b3402e",
  warmBg: "#f7e6df",
};
const SANS = "DM Sans";
const MONO = "JetBrains Mono";
/** Average glyph width as a fraction of the font size, used to fit text without a layout engine. */
const EM = { sans: 0.56, bold: 0.64, mono: 0.6 };

/** Escapes text for an XML text node or attribute and drops control characters. */
export function xmlEscape(/** @type {unknown} */ s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * One `<text>` element. When `maxWidth` is set the font shrinks (down to `min`) and finally truncates
 * so the estimated width stays inside it.
 * @param {{ x: number, y: number, size: number, content: string, family?: string, weight?: number, fill?: string,
 *   anchor?: "start" | "middle" | "end", maxWidth?: number, min?: number }} o
 */
export function text(o) {
  const family = o.family ?? SANS;
  const em = family === MONO ? EM.mono : (o.weight ?? 400) >= 600 ? EM.bold : EM.sans;
  let size = o.size;
  let content = Array.from(o.content);
  if (o.maxWidth) {
    const min = o.min ?? Math.round(o.size * 0.5);
    size = Math.max(min, Math.min(o.size, Math.floor(o.maxWidth / (Math.max(1, content.length) * em))));
    const maxChars = Math.floor(o.maxWidth / (size * em));
    if (content.length > maxChars) content = [...content.slice(0, Math.max(1, maxChars - 1)), "…"];
  }
  return (
    `<text x="${o.x}" y="${o.y}" font-family="${family}" font-size="${size}" font-weight="${o.weight ?? 400}" ` +
    `fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? "start"}">${xmlEscape(content.join(""))}</text>`
  );
}

/** Shared chrome: paper, panel, brand row and the small print footer. */
function frame(/** @type {string} */ body, /** @type {string} */ label) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">` +
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${C.bg}"/>` +
    `<rect x="28" y="28" width="1144" height="574" rx="28" fill="${C.panel}" stroke="${C.edge}" stroke-width="2"/>` +
    `<circle cx="84" cy="82" r="11" fill="${C.accent}" stroke="${C.ink}" stroke-width="2"/>` +
    text({ x: 106, y: 93, size: 32, weight: 700, content: "Snacc" }) +
    text({ x: 1116, y: 91, size: 20, family: MONO, fill: C.faint, anchor: "end", content: label }) +
    body +
    `<line x1="84" y1="556" x2="1116" y2="556" stroke="${C.edge}" stroke-width="2"/>` +
    text({ x: 84, y: 584, size: 19, family: MONO, fill: C.mute, content: "NEAR testnet · no money value" }) +
    text({ x: 1116, y: 584, size: 19, family: MONO, fill: C.faint, anchor: "end", content: "snacc-nu.vercel.app" }) +
    `</svg>`
  );
}

/** Health words follow `healthOf` in the app: dead, starving, distressed, healthy. */
export function healthOf(/** @type {string | null} */ status, /** @type {number | null} */ effectiveVitality) {
  if (status === "Liquidated" || status === "SplicedBurned") return "dead";
  if (effectiveVitality !== null && effectiveVitality <= 0) return "starving";
  if (status === "Distressed" || (effectiveVitality !== null && effectiveVitality <= DISTRESS_MAX)) return "distressed";
  return "healthy";
}

/** Vitality as a whole percent of the maximum, clamped to 0..100. */
export function vitalityPercent(/** @type {number | null} */ units) {
  return units === null ? null : Math.round((Math.min(VITALITY_MAX, Math.max(0, units)) / VITALITY_MAX) * 100);
}

const RIGHT_X = 560;
const RIGHT_W = 556;

/** The art tile on the left: a framed square with the on-chain SVG inside, or a quiet placeholder. */
function artTile(/** @type {string | null} */ svg, /** @type {string} */ placeholder = "no svg") {
  const box = { x: 100, y: 142, width: 388, height: 388 };
  const art = svg ? embedSvg(svg, box) : null;
  return (
    `<rect x="90" y="132" width="408" height="408" rx="22" fill="${C.ink}" opacity="0.12" transform="translate(7 7)"/>` +
    `<rect x="90" y="132" width="408" height="408" rx="22" fill="#ffffff" stroke="${C.ink}" stroke-width="3"/>` +
    `<clipPath id="snacc-card-art"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="14"/></clipPath>` +
    (art
      ? `<g clip-path="url(#snacc-card-art)">${art}</g>`
      : text({ x: 294, y: 346, size: 30, family: MONO, fill: C.faint, anchor: "middle", content: placeholder }))
  );
}

/**
 * Card for `/snacc/<id>`.
 * @param {import("./data.js").SnaccData} data
 * @param {{ withArt?: boolean }} [opts]
 */
export function snaccCardSvg(data, opts = {}) {
  const title = text({ x: RIGHT_X, y: 252, size: 100, weight: 700, content: `Snacc #${data.id}`, maxWidth: RIGHT_W, min: 56 });
  if (data.state !== "ok") {
    const msg = data.state === "missing" ? "Not found on snacc-v001.testnet." : "Live data is not available right now.";
    return frame(
      artTile(null, data.state === "missing" ? "not found" : "no live data") +
        title +
        text({ x: RIGHT_X, y: 318, size: 30, fill: C.mute, content: msg, maxWidth: RIGHT_W, min: 20 }) +
        text({ x: RIGHT_X, y: 372, size: 30, fill: C.mute, content: "Feed your Snacc or it gets snacked." , maxWidth: RIGHT_W, min: 20 }),
      "living NFT",
    );
  }

  const health = healthOf(data.status, data.effectiveVitality);
  const pct = vitalityPercent(data.effectiveVitality);
  const good = health === "healthy";
  const tone = good ? C.ok : C.warm;
  const chipText = data.status ?? "status unknown";
  const chipW = Math.min(RIGHT_W, 52 + Array.from(chipText).length * 17);
  const barW = Math.round(((pct ?? 0) / 100) * RIGHT_W);

  const body =
    artTile(opts.withArt === false ? null : data.svg) +
    title +
    `<rect x="${RIGHT_X}" y="288" width="${chipW}" height="46" rx="23" fill="${good ? C.okBg : C.warmBg}" stroke="${tone}" stroke-width="2"/>` +
    `<circle cx="${RIGHT_X + 26}" cy="311" r="7" fill="${tone}"/>` +
    text({ x: RIGHT_X + 44, y: 320, size: 25, weight: 700, fill: tone, content: chipText, maxWidth: chipW - 60, min: 16 }) +
    text({ x: RIGHT_X, y: 380, size: 18, family: MONO, fill: C.faint, content: "VITALITY" }) +
    `<rect x="${RIGHT_X}" y="394" width="${RIGHT_W}" height="24" rx="12" fill="${C.edge}"/>` +
    (barW > 0 ? `<rect x="${RIGHT_X}" y="394" width="${Math.max(barW, 24)}" height="24" rx="12" fill="${tone}"/>` : "") +
    text({ x: RIGHT_X, y: 464, size: 38, weight: 700, content: pct === null ? "vitality unknown" : `${pct}% effective`, maxWidth: 330, min: 22 }) +
    text({ x: RIGHT_X + RIGHT_W, y: 462, size: 26, family: MONO, fill: C.mute, anchor: "end", content: data.generation === null ? "" : `generation ${data.generation}` }) +
    text({ x: RIGHT_X, y: 500, size: 18, family: MONO, fill: C.faint, content: "OWNER" }) +
    text({ x: RIGHT_X, y: 528, size: 26, family: MONO, fill: C.ink, content: data.owner ?? "unknown", maxWidth: RIGHT_W, min: 16 });
  return frame(body, "living NFT");
}

/**
 * Card for `/p/<account>`.
 * @param {import("./data.js").ProfileData} data
 */
export function profileCardSvg(data) {
  const name = data.username ?? data.account;
  const initial = Array.from(name)[0]?.toUpperCase() ?? "?";
  const hasLevel = data.level !== null;
  const emblem =
    `<circle cx="294" cy="337" r="177" fill="${C.ink}" opacity="0.12" transform="translate(7 7)"/>` +
    `<circle cx="294" cy="337" r="177" fill="${C.accent}" stroke="${C.ink}" stroke-width="3"/>` +
    (hasLevel
      ? text({ x: 294, y: 300, size: 30, family: MONO, fill: C.ink, anchor: "middle", content: "LEVEL" }) +
        text({ x: 294, y: 408, size: 130, weight: 700, anchor: "middle", content: String(data.level), maxWidth: 260, min: 60 })
      : text({ x: 294, y: 385, size: 150, weight: 700, anchor: "middle", content: initial }));

  const lines = [];
  if (hasLevel) {
    const xp = data.totalXp === null ? "" : ` · ${Math.round(data.totalXp).toLocaleString("en-US")} XP`;
    lines.push(`Level ${data.level}${xp}`);
  }
  if (data.snaccCount !== null) lines.push(`${data.snaccCount} Snacc${data.snaccCount === 1 ? "" : "s"} on NEAR testnet`);
  if (lines.length === 0) lines.push("Snacc player profile");

  const body =
    emblem +
    text({ x: RIGHT_X, y: 232, size: 18, family: MONO, fill: C.faint, content: "PLAYER" }) +
    text({ x: RIGHT_X, y: 318, size: 88, weight: 700, content: name, maxWidth: RIGHT_W, min: 36 }) +
    (data.username ? text({ x: RIGHT_X, y: 366, size: 28, family: MONO, fill: C.mute, content: data.account, maxWidth: RIGHT_W, min: 16 }) : "") +
    lines.map((l, i) => text({ x: RIGHT_X, y: 424 + i * 50, size: 38, weight: 700, content: l, maxWidth: RIGHT_W, min: 22 })).join("") +
    // The note sits 44 px under the last line; with two lines its baseline is 518, leaving ~38 px above the footer rule (y=556).
    (hasLevel ? text({ x: RIGHT_X, y: 424 + (lines.length - 1) * 50 + 44, size: 18, family: MONO, fill: C.faint, content: "XP is cosmetic and off-chain" }) : "");
  return frame(body, "player profile");
}

/** A plain card for any state the specific cards do not cover. */
export function messageCardSvg(/** @type {string} */ title, /** @type {string} */ message) {
  return frame(
    text({ x: 84, y: 290, size: 84, weight: 700, content: title, maxWidth: 1032, min: 40 }) +
      text({ x: 84, y: 360, size: 34, fill: C.mute, content: message, maxWidth: 1032, min: 20 }) +
      text({ x: 84, y: 420, size: 34, fill: C.mute, content: "NFTs that eat a memecoin.", maxWidth: 1032, min: 20 }),
    "NEAR testnet",
  );
}
