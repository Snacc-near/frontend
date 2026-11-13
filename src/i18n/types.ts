/**
 * Shared types of the language layer (UI-161). Pure types, no runtime code except the locale list.
 */
import type { ReactNode } from "react";

/** The languages the UI ships. English is the source of truth; every other locale is checked against it. */
export type Locale = "en" | "id";

export const LOCALES: readonly Locale[] = ["en", "id"];
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Deep string shape of a dictionary: the same keys as `T`, every leaf a string. A translation file is
 * written `{ ... } satisfies Messages<typeof en>`, so a missing key, an extra key or a non-string leaf
 * is a `tsc` error (`npm run build`), not a runtime surprise.
 */
export type Messages<T> = { [K in keyof T]: T[K] extends string ? string : Messages<T[K]> };

type Join<P extends string, K extends string> = P extends "" ? K : `${P}.${K}`;

/** Every dot path to a string leaf of `T`: `"landing.hero.cta"`. */
export type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? Join<P, K> : Paths<T[K], Join<P, K>>;
}[keyof T & string];

/** Values for `{name}` placeholders in plain `t()` calls. */
export type Vars = Readonly<Record<string, string | number>>;

/** Values for `{name}` placeholders in `rich()` calls: any React node (links, `<strong>`, a ref'd span). */
export type RichVars = Readonly<Record<string, ReactNode>>;
