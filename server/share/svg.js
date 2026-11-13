// @ts-check
/**
 * The on-chain SVG of a Snacc is chain data, so it is treated as untrusted before it goes into a card:
 * `svgFromMedia` applies the same checks as `safeNftMediaSrc` in the app, and `embedSvg` turns the document
 * into a nested `<svg>` element with scripts, styles, foreign objects, event handlers and external
 * references removed. (The renderer never runs scripts or fetches URLs anyway; this keeps the card's own
 * text and layout out of reach of a stray `<style>` rule.)
 */

const PREFIX = "data:image/svg+xml;base64,";
export const MAX_MEDIA_CHARS = 200_000;

/** The SVG text of an `nft_token` `metadata.media` data URI, or null when it is not a plain SVG data URI. */
export function svgFromMedia(/** @type {unknown} */ media) {
  if (typeof media !== "string" || !media.startsWith(PREFIX) || media.length > MAX_MEDIA_CHARS) return null;
  const body = media.slice(PREFIX.length);
  if (!/^[A-Za-z0-9+/]+=*$/.test(body)) return null;
  const text = Buffer.from(body, "base64").toString("utf8");
  return /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(text) ? text : null;
}

const ROOT_ATTRS_DROPPED = new Set(["width", "height", "viewbox", "x", "y", "preserveaspectratio", "style", "class", "id", "version", "baseprofile"]);
const ATTR_RE = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * The SVG as a nested `<svg x y width height viewBox>` element that fits the given box, or null when the
 * document cannot be used (no root element, a DOCTYPE or entity declaration, not an SVG).
 */
export function embedSvg(
  /** @type {string} */ svg,
  /** @type {{ x: number, y: number, width: number, height: number }} */ box,
) {
  if (typeof svg !== "string" || svg.length === 0 || svg.length > MAX_MEDIA_CHARS * 2) return null;
  if (/<!DOCTYPE|<!ENTITY/i.test(svg)) return null;

  let s = svg
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|foreignObject|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|foreignObject|iframe|object|embed)\b[^>]*\/>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    // the card's fonts have no emoji or pictographs; drop them from text nodes instead of drawing empty boxes
    .replace(/>([^<]+)</g, (_all, t) => `>${String(t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "")}<`)
    // external references: only in-document fragments and inline images survive
    .replace(/\s+(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (all, a, b) => {
      const v = String(a ?? b ?? "").trim().toLowerCase();
      return v.startsWith("#") || v.startsWith("data:image/") ? all : "";
    })
    .trim();

  const root = /^<svg\b((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(s);
  if (!root) return null;
  const end = s.lastIndexOf("</svg>");
  const selfClosing = root[1].trimEnd().endsWith("/");
  if (end < root[0].length && !selfClosing) return null;

  /** @type {Record<string, string>} */
  const attrs = {};
  /** @type {string[]} */
  const kept = [];
  for (const m of root[1].matchAll(ATTR_RE)) {
    const name = m[1];
    const value = m[2] ?? m[3] ?? "";
    const lower = name.toLowerCase();
    attrs[lower] = value;
    if (ROOT_ATTRS_DROPPED.has(lower) || lower.startsWith("on")) continue;
    kept.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }

  const w = Number.parseFloat(attrs.width ?? "");
  const h = Number.parseFloat(attrs.height ?? "");
  const vb = /^\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*$/.exec(attrs.viewbox ?? "");
  const viewBox = vb && Number(vb[3]) > 0 && Number(vb[4]) > 0 ? `${vb[1]} ${vb[2]} ${vb[3]} ${vb[4]}` : `0 0 ${w > 0 ? w : 320} ${h > 0 ? h : 320}`;

  const open =
    `<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="${viewBox}" ` +
    `preserveAspectRatio="xMidYMid meet" overflow="hidden"${kept.length ? ` ${kept.join(" ")}` : ""}>`;
  return selfClosing ? `${open}</svg>` : `${open}${s.slice(root[0].length, end)}</svg>`;
}
