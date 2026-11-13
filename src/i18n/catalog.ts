/**
 * The dictionaries and the plain lookup `t(locale, key, vars?)` (UI-161). No React in here: plain
 * helpers, `telemetry.ts` and tests can translate too. React code uses `useT()` from `./react.tsx`.
 */
import { interpolate } from "./format.ts";
import { en } from "./messages/en/index.ts";
import { id } from "./messages/id/index.ts";
import type { Locale, Messages, Paths, Vars } from "./types.ts";

export type EnMessages = typeof en;
/** Namespace = first path segment (`common`, `landing`, ...). */
export type Namespace = keyof EnMessages;
/** Every key the UI can ask for, derived from the English dictionary: a typo fails `tsc`. */
export type MessageKey = Paths<EnMessages>;

/** English is the source of truth; `id` is type-checked against its shape (see `messages/id/index.ts`). */
export const CATALOG: Readonly<Record<Locale, Messages<EnMessages>>> = { en, id };

export type Translate = (key: MessageKey, vars?: Vars) => string;

/** `{ a: { b: "x" } }` -> `{ "a.b": "x" }`. */
export function flatten(dict: object, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dict)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[path] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v, path));
  }
  return out;
}

const flatCache: Partial<Record<Locale, Record<string, string>>> = {};
function table(locale: Locale): Record<string, string> {
  return (flatCache[locale] ??= flatten(CATALOG[locale]));
}

/** The raw template of a key (placeholders not filled), falling back to English, then to the key. */
export function rawMessage(locale: Locale, key: MessageKey): string {
  return table(locale)[key] ?? table("en")[key] ?? key;
}

/** Translates `key` into `locale`; `{name}` placeholders are filled from `vars`. */
export function t(locale: Locale, key: MessageKey, vars?: Vars): string {
  return interpolate(rawMessage(locale, key), vars);
}

/** `t` bound to one locale. */
export function translator(locale: Locale): Translate {
  return (key, vars) => t(locale, key, vars);
}

/** English text of a key, for data that has to keep its English form (tests, SEO, logs). */
export const tEn: Translate = translator("en");
