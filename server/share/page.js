// @ts-check
/**
 * `GET /api/share?kind=snacc&id=<id>` and `?kind=p&account=<account>` (UI-157): the HTML page that `vercel.json`
 * serves to link-preview crawlers instead of the SPA shell. Never throws and never answers 5xx: a lookup that
 * fails simply falls back to the site's generic meta tags.
 */
import { buildShareHtml, genericMeta, profileMeta, snaccMeta } from "./meta.js";
import { allowGetHead, CACHE_OK, CACHE_SHORT, queryOf, requestOrigin, send } from "./http.js";
import { loadProfile, loadSnacc } from "./data.js";
import { parseAccountId, parseStrainId } from "./validate.js";

/**
 * @param {import("./http.js").Req} req
 * @param {import("./http.js").Res} res
 * @param {import("./data.js").Deps} [deps]
 */
export async function handleSharePage(req, res, deps = {}) {
  if (!allowGetHead(req, res)) return;
  const origin = requestOrigin(req);
  let meta = genericMeta(origin);
  let status = 200;
  let cache = CACHE_SHORT;
  try {
    const kind = queryOf(req, "kind");
    if (kind === "snacc") {
      const id = parseStrainId(queryOf(req, "id") ?? "");
      if (id === null) status = 404;
      else {
        meta = snaccMeta(await loadSnacc(id, deps), origin);
        cache = CACHE_OK;
      }
    } else if (kind === "p") {
      const account = parseAccountId(queryOf(req, "account") ?? "");
      if (account === null) status = 404;
      else {
        meta = profileMeta(await loadProfile(account, deps), origin);
        cache = CACHE_OK;
      }
    } else {
      status = 404;
    }
  } catch {
    meta = genericMeta(origin);
    status = 200;
    cache = CACHE_SHORT;
  }
  send(req, res, status, { "content-type": "text/html; charset=utf-8", "cache-control": status === 200 ? cache : CACHE_SHORT, "x-snacc-share": "meta" }, buildShareHtml(meta));
}
