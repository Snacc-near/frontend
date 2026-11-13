// @ts-check
// Vercel function: GET /api/og/p/<account> -> 1200x630 PNG share card for one player profile.
import { handleProfileImage } from "../../../server/share/image.js";

export default function handler(/** @type {import("../../../server/share/http.js").Req} */ req, /** @type {import("../../../server/share/http.js").Res} */ res) {
  return handleProfileImage(req, res);
}
