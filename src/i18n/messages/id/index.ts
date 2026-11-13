/**
 * Indonesian dictionaries, one file per namespace (UI-161). Every file is written
 * `{ ... } satisfies Messages<typeof en>`, and this index too, so a missing namespace, a missing key
 * or an extra key is a `tsc` error (`npm run build`).
 */
import type { Messages } from "../../types.ts";
import type { en } from "../en/index.ts";
import common from "./common.ts";
import demos from "./demos.ts";
import hud from "./hud.ts";
import landing from "./landing.ts";
import settings from "./settings.ts";
import skin from "./skin.ts";

export const id = { common, demos, hud, landing, settings, skin } satisfies Messages<typeof en>;
