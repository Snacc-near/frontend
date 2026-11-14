/**
 * English dictionaries, one file per namespace (UI-161). English is the source of truth: the key set
 * of `MessageKey` is derived from this object, and `../id/index.ts` must match its shape.
 *
 * To add a namespace: create `<ns>.ts` here and in `../id/`, then add one line to this file and one
 * to the Indonesian index.
 */
import actions from "./actions.ts";
import collection from "./collection.ts";
import common from "./common.ts";
import demos from "./demos.ts";
import hud from "./hud.ts";
import landing from "./landing.ts";
import market from "./market.ts";
import settings from "./settings.ts";
import skin from "./skin.ts";
import social from "./social.ts";
import tx from "./tx.ts";

export const en = { actions, collection, common, demos, hud, landing, market, settings, skin, social, tx };
