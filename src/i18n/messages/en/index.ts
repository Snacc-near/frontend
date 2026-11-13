/**
 * English dictionaries, one file per namespace (UI-161). English is the source of truth: the key set
 * of `MessageKey` is derived from this object, and `../id/index.ts` must match its shape.
 *
 * To add a namespace: create `<ns>.ts` here and in `../id/`, then add one line to this file and one
 * to the Indonesian index.
 */
import common from "./common.ts";
import demos from "./demos.ts";
import landing from "./landing.ts";
import settings from "./settings.ts";

export const en = { common, demos, landing, settings };
