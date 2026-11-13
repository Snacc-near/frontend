// @ts-check
/**
 * Input rules and crawler detection for the share-preview functions (UI-157).
 * Plain JavaScript on purpose: Vercel runs the files in `api/` and `server/` as native ES modules, so
 * nothing here needs a compile step. The rules mirror `src/route.ts` (`parsePublicPath`); a unit test pins
 * the two together.
 */

export const SITE_ORIGIN = "https://snacc-nu.vercel.app";
export const CONTRACT_ID = "snacc-v001.testnet";

/** NEAR account id: 2 to 64 chars, lowercase alphanumerics joined by single `-`, `_` or `.` (same as `src/route.ts`). */
const ACCOUNT_RE = /^(?:[a-z\d]+[-_.])*[a-z\d]+$/;

/**
 * The id of `/snacc/<id>`: 1 to 9 digits, at least 1. Returns null for anything else.
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseStrainId(raw) {
  if (typeof raw !== "string" || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

/**
 * The account of `/p/<account>`: returned as given when valid, else null. No decoding: the router already did it.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function parseAccountId(raw) {
  if (typeof raw !== "string") return null;
  return raw.length >= 2 && raw.length <= 64 && ACCOUNT_RE.test(raw) ? raw : null;
}

/**
 * Lower-case substrings of the user agents that unfurl links: X, Facebook, Discord, Telegram, Slack,
 * LinkedIn, WhatsApp and a few more. `vercel.json` routes these (and only these) to the meta page.
 */
export const CRAWLER_UA_TOKENS = [
  "twitterbot",
  "facebookexternalhit",
  "facebot",
  "discordbot",
  "telegrambot",
  "slackbot",
  "slack-imgproxy",
  "linkedinbot",
  "whatsapp",
  "mastodon",
  "cardyb",
];

/**
 * True when the user agent belongs to a link-preview crawler.
 * @param {unknown} ua
 */
export function isCrawlerUserAgent(ua) {
  if (typeof ua !== "string" || ua.length === 0) return false;
  const s = ua.toLowerCase();
  return CRAWLER_UA_TOKENS.some((t) => s.includes(t));
}

/** The same list as an RE2 regex for a `has` header condition in `vercel.json` (case-insensitive, whole value). */
export function crawlerUserAgentPattern() {
  return `(?i).*(${CRAWLER_UA_TOKENS.join("|")}).*`;
}

/** Host names a request may carry for the page to build absolute URLs on it: production and Vercel previews. */
const HOST_RE = /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+vercel\.app$/;

/**
 * Origin for the absolute URLs in the meta tags. Production host and `*.vercel.app` previews are used as they
 * are (so a preview deployment points at its own image function); anything else gets the production origin.
 * @param {unknown} host
 */
export function originFromHost(host) {
  if (typeof host !== "string") return SITE_ORIGIN;
  const h = host.trim().toLowerCase();
  return HOST_RE.test(h) ? `https://${h}` : SITE_ORIGIN;
}

/**
 * Shortens `text` to at most `max` characters with an ellipsis.
 * @param {string} text
 * @param {number} max
 */
export function truncate(text, max) {
  const chars = Array.from(String(text));
  return chars.length <= max ? chars.join("") : `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}
