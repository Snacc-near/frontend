/**
 * English dictionaries, one file per namespace (UI-161). English is the source of truth: the key set
 * of `MessageKey` is derived from this object, and `../id/index.ts` must match its shape.
 *
 * To add a namespace: create `<ns>.ts` here and in `../id/`, then add one line to this file and one
 * to the Indonesian index.
 */
import actions from "./actions.ts";
import checks from "./checks.ts";
import collection from "./collection.ts";
import common from "./common.ts";
import demo from "./demo.ts";
import demos from "./demos.ts";
import hud from "./hud.ts";
import landing from "./landing.ts";
import market from "./market.ts";
import npc from "./npc.ts";
import settings from "./settings.ts";
import skin from "./skin.ts";
import social from "./social.ts";
import tx from "./tx.ts";

export const en = { actions, checks, collection, common, demo, demos, hud, landing, market, npc, settings, skin, social, tx };
