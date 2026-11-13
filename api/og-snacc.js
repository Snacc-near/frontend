// @ts-check
// Vercel function: GET /api/og/snacc/<id> (rewritten to /api/og-snacc?id=<id> in vercel.json) -> 1200x630 PNG
// share card for one Snacc. A static file name, because the SPA catch-all rewrite ran before Vercel's
// dynamic `[id].js` function routes and served index.html instead.
import { handleSnaccImage } from "../server/share/image.js";

export default function handler(/** @type {import("../server/share/http.js").Req} */ req, /** @type {import("../server/share/http.js").Res} */ res) {
  return handleSnaccImage(req, res);
}
