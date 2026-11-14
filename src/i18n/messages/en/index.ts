/**
 * English dictionaries, one file per namespace (UI-161). English is the source of truth: the key set
 * of `MessageKey` is derived from this object, and `../id/index.ts` must match its shape.
 *
 * To add a namespace: create `<ns>.ts` here and in `../id/`, then add one line to this file and one
 * to the Indonesian index.
 */
import actions from "./actions.ts";
import common from "./common.ts";
import demos from "./demos.ts";
import help from "./help.ts";
import hud from "./hud.ts";
import landing from "./landing.ts";
import onboarding from "./onboarding.ts";
import onetap from "./onetap.ts";
import settings from "./settings.ts";
import skin from "./skin.ts";
import tx from "./tx.ts";

export const en = { actions, common, demos, help, hud, landing, onboarding, onetap, settings, skin, tx };
