// @ts-check
// Vercel function: GET /api/og/p/<account> (rewritten to /api/og-profile?account=<account> in vercel.json) ->
// 1200x630 PNG share card for one player profile. Static file name for the same reason as og-snacc.js.
import { handleProfileImage } from "../server/share/image.js";

export default function handler(/** @type {import("../server/share/http.js").Req} */ req, /** @type {import("../server/share/http.js").Res} */ res) {
  return handleProfileImage(req, res);
}
