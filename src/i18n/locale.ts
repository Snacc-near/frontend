/**
 * Which language the UI speaks (UI-161), and how that choice is remembered.
 *
 * Resolution order: the saved choice (`snacc_locale` in localStorage) -> the browser language when it
 * is Indonesian -> English. Without a browser (tests, server rendering) the answer is always English.
 *
 * This file imports nothing from the rest of the app on purpose: `telemetry.ts`, `prefs.ts` and any
 * non-React code can read the language (`getLocale()`) without creating an import cycle.
 */
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./types.ts";

/** localStorage key of the language choice. Registered with the other keys in `prefs/prefs.ts`. */
export const LOCALE_KEY = "snacc_locale";

export type LocaleStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface NavigatorLike {
  language?: string;
  languages?: readonly string[];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The browser's localStorage, or null when it is missing or blocked. */
function localeStorage(): LocaleStorage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * The browser's navigator, only inside a real browser. Node 21+ also has a global `navigator`, whose
 * language follows the machine, so tests and server rendering must not read it.
 */
function browserNavigator(): NavigatorLike | undefined {
  return typeof window !== "undefined" && typeof navigator !== "undefined" ? navigator : undefined;
}

/** `id`, `id-ID`, `id_ID`, and the legacy tag `in-ID` some Android WebViews still report. */
const INDONESIAN = /^(id|in)([-_]|$)/i;

/** `id` when the browser's preferred language is Indonesian, else `en`. */
export function detectLocale(nav: NavigatorLike | undefined): Locale {
  const tag = nav?.language ?? nav?.languages?.[0];
  return typeof tag === "string" && INDONESIAN.test(tag) ? "id" : DEFAULT_LOCALE;
}

export function readSavedLocale(store: LocaleStorage | null = localeStorage()): Locale | null {
  if (!store) return null;
  try {
    const raw = store.getItem(LOCALE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveLocale(locale: Locale, store: LocaleStorage | null = localeStorage()): void {
  if (!store) return;
  try {
    store.setItem(LOCALE_KEY, locale);
  } catch {
    /* storage full or blocked: the choice still holds for this page load */
  }
}

/** Saved choice, else the browser language, else English. */
export function resolveLocale(store: LocaleStorage | null = localeStorage(), nav: NavigatorLike | undefined = browserNavigator()): Locale {
  return readSavedLocale(store) ?? detectLocale(nav);
}

/** Keeps `<html lang>` in step with the UI language (screen readers, hyphenation, browser translate). */
export function applyDocumentLang(locale: Locale): void {
  if (typeof document !== "undefined" && document.documentElement) document.documentElement.lang = locale;
}

// ------------------------------------------------------------------ current locale (module state)

let current: Locale | null = null;
const listeners = new Set<() => void>();

/** The language in use right now. Safe outside React (telemetry, `<html lang>`, plain helpers). */
export function getLocale(): Locale {
  if (current === null) current = resolveLocale();
  return current;
}

/** Snapshot for server rendering and tests without a browser: always English. */
export function getServerLocale(): Locale {
  return DEFAULT_LOCALE;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Switches the language: remembers it, updates `<html lang>` and re-renders everything that reads it. */
export function setLocale(next: Locale, store: LocaleStorage | null = localeStorage()): void {
  saveLocale(next, store);
  applyDocumentLang(next);
  if (current === next) return;
  current = next;
  for (const fn of [...listeners]) fn();
}

/** Forgets the cached language and resolves it again (after the saved key was cleared, and in tests). */
export function reloadLocale(store: LocaleStorage | null = localeStorage(), nav: NavigatorLike | undefined = browserNavigator()): Locale {
  const next = resolveLocale(store, nav);
  const changed = next !== current;
  current = next;
  applyDocumentLang(next);
  if (changed) for (const fn of [...listeners]) fn();
  return next;
}
