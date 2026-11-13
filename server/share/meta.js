// @ts-check
/**
 * The HTML a link-preview crawler reads (UI-157): Open Graph and Twitter card tags plus a normal link for
 * humans. Every dynamic value goes through `escapeHtml`; the account ids and usernames are validated
 * before they get here, and escaping is the second line of defence.
 */
import { CONTRACT_ID, truncate } from "./validate.js";
import { healthOf, vitalityPercent } from "./card.js";

export const TAGLINE = "Feed your Snacc or it gets snacked.";
export const SMALL_PRINT = "Testnet only, no money value.";

/** Escapes text for an HTML text node or a quoted attribute value. */
export function escapeHtml(/** @type {unknown} */ s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** @typedef {{ title: string, description: string, url: string, image: string, imageAlt: string, linkText: string }} ShareMeta */

/** The complete document for a crawler. */
export function buildShareHtml(/** @type {ShareMeta} */ m) {
  const t = escapeHtml(m.title);
  const d = escapeHtml(m.description);
  const u = escapeHtml(m.url);
  const i = escapeHtml(m.image);
  const a = escapeHtml(m.imageAlt);
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${t}</title>`,
    `<meta name="description" content="${d}">`,
    `<link rel="canonical" href="${u}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Snacc">',
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${u}">`,
    `<meta property="og:image" content="${i}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${a}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${i}">`,
    `<meta name="twitter:image:alt" content="${a}">`,
    "</head>",
    '<body style="font-family:system-ui,sans-serif;margin:2rem;color:#16181a;background:#efefec">',
    `<h1>${t}</h1>`,
    `<p>${d}</p>`,
    `<p><a href="${u}">${escapeHtml(m.linkText)}</a></p>`,
    `<p><small>${escapeHtml(SMALL_PRINT)}</small></p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** Meta for any URL without its own data: the same words as `index.html`. */
export function genericMeta(/** @type {string} */ origin) {
  return /** @type {ShareMeta} */ ({
    title: "Snacc — NFTs that eat a memecoin",
    description: `${TAGLINE} An on-chain economic game on NEAR testnet.`,
    url: `${origin}/`,
    image: `${origin}/brand/og-image.png`,
    imageAlt: "Snacc, NFTs that eat a memecoin",
    linkText: "Open Snacc",
  });
}

/** Meta for `/snacc/<id>`. */
export function snaccMeta(/** @type {import("./data.js").SnaccData} */ data, /** @type {string} */ origin) {
  const id = data.id;
  let description;
  if (data.state === "missing") {
    description = `Snacc #${id} was not found on ${CONTRACT_ID} (NEAR testnet).`;
  } else if (data.state === "unavailable") {
    description = `Snacc #${id} on NEAR testnet. ${TAGLINE}`;
  } else {
    const pct = vitalityPercent(data.effectiveVitality);
    const status = data.status ?? "status unknown";
    const parts = [status, pct === null ? null : `${pct}% vitality`, data.generation === null ? null : `generation ${data.generation}`].filter(Boolean);
    const health = healthOf(data.status, data.effectiveVitality);
    description =
      `Snacc #${id} on NEAR testnet: ${parts.join(", ")}${data.owner ? `, owned by ${data.owner}` : ""}. ` +
      `${health === "healthy" ? TAGLINE : "It needs feeding."} ${SMALL_PRINT}`;
  }
  return /** @type {ShareMeta} */ ({
    title: `Snacc #${id} · Snacc`,
    description: truncate(description, 240),
    url: `${origin}/snacc/${id}`,
    image: `${origin}/api/og/snacc/${id}`,
    imageAlt: `Snacc #${id} on NEAR testnet`,
    linkText: `Open Snacc #${id}`,
  });
}

/** Meta for `/p/<account>`. */
export function profileMeta(/** @type {import("./data.js").ProfileData} */ data, /** @type {string} */ origin) {
  const name = data.username ?? data.account;
  const facts = [
    data.level === null ? null : `level ${data.level}`,
    data.snaccCount === null ? null : `${data.snaccCount} Snacc${data.snaccCount === 1 ? "" : "s"} on chain`,
  ].filter(Boolean);
  return /** @type {ShareMeta} */ ({
    title: `${name} · Snacc player profile`,
    description: truncate(`${name} on Snacc, the on-chain economic game on NEAR testnet${facts.length ? `: ${facts.join(", ")}` : ""}. ${SMALL_PRINT}`, 240),
    url: `${origin}/p/${encodeURIComponent(data.account)}`,
    image: `${origin}/api/og/p/${encodeURIComponent(data.account)}`,
    imageAlt: `${name} on Snacc`,
    linkText: `Open ${name} on Snacc`,
  });
}
