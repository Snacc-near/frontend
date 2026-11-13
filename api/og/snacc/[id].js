// @ts-check
// Vercel function: GET /api/og/snacc/<id> -> 1200x630 PNG share card for one Snacc.
import { handleSnaccImage } from "../../../server/share/image.js";

export default function handler(/** @type {import("../../../server/share/http.js").Req} */ req, /** @type {import("../../../server/share/http.js").Res} */ res) {
  return handleSnaccImage(req, res);
}
