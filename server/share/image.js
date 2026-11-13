// @ts-check
/**
 * `GET /api/og/snacc/<id>` and `GET /api/og/p/<account>` (UI-157): 1200x630 PNG share cards.
 * Any failure (RPC down, bad SVG, renderer error) ends in the static `/brand/og-image.png`, never in a 5xx.
 */
import { snaccCardSvg, profileCardSvg } from "./card.js";
import { allowGetHead, CACHE_OK, CACHE_SHORT, lastSegment, queryOf, requestOrigin, send } from "./http.js";
import { loadProfile, loadSnacc } from "./data.js";
import { isPng, renderPng } from "./render.js";
import { parseAccountId, parseStrainId } from "./validate.js";

/**
 * @typedef {import("./data.js").Deps & { render?: (svg: string) => Promise<Uint8Array> }} ImageDeps
 */

/** The site's static card, fetched from the request's own origin; a redirect to it when even that fails. */
async function sendStaticFallback(
  /** @type {import("./http.js").Req} */ req,
  /** @type {import("./http.js").Res} */ res,
  /** @type {ImageDeps} */ deps,
) {
  const origin = requestOrigin(req);
  const url = `${origin}/brand/og-image.png`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), deps.timeoutMs ?? 3000);
  try {
    const r = await (deps.fetch ?? fetch)(url, { signal: ac.signal });
    if (r.ok) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (isPng(bytes)) {
        send(req, res, 200, { "content-type": "image/png", "cache-control": CACHE_SHORT, "x-snacc-share": "fallback" }, bytes);
        return;
      }
    }
  } catch {
    // fall through to the redirect
  } finally {
    clearTimeout(timer);
  }
  send(req, res, 302, { location: url, "cache-control": CACHE_SHORT, "x-snacc-share": "fallback-redirect" }, "");
}

/** Renders the card; when the on-chain SVG is what breaks the render, retries once without it. */
async function renderWithArtRetry(
  /** @type {(withArt: boolean) => string} */ build,
  /** @type {ImageDeps} */ deps,
) {
  const render = deps.render ?? renderPng;
  try {
    return await render(build(true));
  } catch {
    return await render(build(false));
  }
}

/**
 * @param {import("./http.js").Req} req
 * @param {import("./http.js").Res} res
 * @param {ImageDeps} [deps]
 */
export async function handleSnaccImage(req, res, deps = {}) {
  if (!allowGetHead(req, res)) return;
  try {
    const id = parseStrainId(queryOf(req, "id") ?? lastSegment(req) ?? "");
    if (id === null) return await sendStaticFallback(req, res, deps);
    const data = await loadSnacc(id, deps);
    if (data.state === "unavailable") return await sendStaticFallback(req, res, deps);
    const png = await renderWithArtRetry((withArt) => snaccCardSvg(data, { withArt }), deps);
    send(req, res, 200, { "content-type": "image/png", "cache-control": data.state === "ok" ? CACHE_OK : CACHE_SHORT, "x-snacc-share": "png" }, png);
  } catch {
    await sendStaticFallback(req, res, deps);
  }
}

/**
 * @param {import("./http.js").Req} req
 * @param {import("./http.js").Res} res
 * @param {ImageDeps} [deps]
 */
export async function handleProfileImage(req, res, deps = {}) {
  if (!allowGetHead(req, res)) return;
  try {
    const account = parseAccountId(queryOf(req, "account") ?? lastSegment(req) ?? "");
    if (account === null) return await sendStaticFallback(req, res, deps);
    const data = await loadProfile(account, deps);
    const png = await (deps.render ?? renderPng)(profileCardSvg(data));
    send(req, res, 200, { "content-type": "image/png", "cache-control": CACHE_OK, "x-snacc-share": "png" }, png);
  } catch {
    await sendStaticFallback(req, res, deps);
  }
}
