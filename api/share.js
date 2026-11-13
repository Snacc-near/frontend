// @ts-check
// Vercel function: the meta-tag page that `vercel.json` serves to link-preview crawlers on /snacc/<id> and /p/<account>.
import { handleSharePage } from "../server/share/page.js";

export default function handler(/** @type {import("../server/share/http.js").Req} */ req, /** @type {import("../server/share/http.js").Res} */ res) {
  return handleSharePage(req, res);
}
