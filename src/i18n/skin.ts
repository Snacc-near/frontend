/**
 * Terminology skin labels in the reader's language (UI-161). `SKIN_LABELS` in `config/constants.ts`
 * keeps the English text (tests, non-React callers); screens read these instead so the skin vocabulary
 * follows the language. Keys are the same as in `SKIN_LABELS`.
 */
import { useMemo } from "react";
import type { SkinMode } from "../config/constants.ts";
import { en } from "./messages/en/index.ts";
import type { Translate } from "./catalog.ts";
import { useT } from "./react.tsx";

export type SkinLabelKey = keyof typeof en.skin.biolab;
export type SkinLabels = Readonly<Record<SkinLabelKey, string>>;

const KEYS = Object.keys(en.skin.biolab) as SkinLabelKey[];

/** All labels of one skin in the language of `tr`. */
export function skinLabels(tr: Translate, skin: SkinMode): SkinLabels {
  const out = {} as Record<SkinLabelKey, string>;
  for (const k of KEYS) out[k] = tr(`skin.${skin}.${k}`);
  return out;
}

/** React hook form of `skinLabels`; typed like `SKIN_LABELS[skin]` so it can replace it in place. */
export function useSkinLabels(skin: SkinMode): Readonly<Record<string, string>> {
  const { t } = useT();
  return useMemo(() => skinLabels(t, skin), [t, skin]);
}
