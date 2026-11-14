/**
 * Indonesian dictionaries, one file per namespace (UI-161). Every file is written
 * `{ ... } satisfies Messages<typeof en>`, and this index too, so a missing namespace, a missing key
 * or an extra key is a `tsc` error (`npm run build`).
 */
import type { Messages } from "../../types.ts";
import type { en } from "../en/index.ts";
import actions from "./actions.ts";
import checks from "./checks.ts";
import collection from "./collection.ts";
import common from "./common.ts";
import demo from "./demo.ts";
import demos from "./demos.ts";
import help from "./help.ts";
import hud from "./hud.ts";
import landing from "./landing.ts";
import market from "./market.ts";
import npc from "./npc.ts";
import onboarding from "./onboarding.ts";
import onetap from "./onetap.ts";
import settings from "./settings.ts";
import skin from "./skin.ts";
import social from "./social.ts";
import tx from "./tx.ts";

export const id = { actions, checks, collection, common, demo, demos, help, hud, landing, market, npc, onboarding, onetap, settings, skin, social, tx } satisfies Messages<typeof en>;
