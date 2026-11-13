/**
 * React side of the language layer (UI-161): `<I18nProvider>` and `useT()`.
 *
 * `useT()` also works without a provider (it then follows the global choice in `locale.ts`), so a
 * component can be rendered on its own in a test or a preview. A provider with a `locale` prop pins
 * the language for its subtree, which is how tests render Indonesian with `renderToStaticMarkup`.
 */
import { Fragment, createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { rawMessage, translator, type MessageKey, type Translate } from "./catalog.ts";
import { splitTemplate } from "./format.ts";
import { applyDocumentLang, getLocale, getServerLocale, setLocale, subscribeLocale } from "./locale.ts";
import type { Locale, RichVars } from "./types.ts";

const LocaleContext = createContext<Locale | null>(null);

function useGlobalLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
}

/**
 * Wrap a route in this to make it follow the saved language and keep `<html lang>` in step. Without
 * the `locale` prop it follows the global choice; with it, the subtree is pinned (tests, previews).
 */
export function I18nProvider({ locale, children }: { locale?: Locale; children: ReactNode }) {
  const global = useGlobalLocale();
  const active = locale ?? global;
  useEffect(() => {
    if (locale === undefined) applyDocumentLang(active);
  }, [locale, active]);
  return <LocaleContext.Provider value={active}>{children}</LocaleContext.Provider>;
}

export type Rich = (key: MessageKey, vars: RichVars) => ReactNode;

/** Like `t()`, but the `{name}` placeholders can hold elements: a link, `<strong>`, a ref'd span. */
export function richFor(locale: Locale): Rich {
  return (key, vars) => (
    <>
      {splitTemplate(rawMessage(locale, key)).map((part, i) =>
        typeof part === "string" ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <Fragment key={i}>{part.name in vars ? vars[part.name] : `{${part.name}}`}</Fragment>
        ),
      )}
    </>
  );
}

export interface I18n {
  locale: Locale;
  /** Plain text: `t("landing.hero.cta")`, `t("demos.feed.note", { bite: 10 })`. */
  t: Translate;
  /** Text with elements in the placeholders. */
  rich: Rich;
  setLocale: (locale: Locale) => void;
}

export function useT(): I18n {
  const pinned = useContext(LocaleContext);
  const global = useGlobalLocale();
  const locale = pinned ?? global;
  return useMemo(() => ({ locale, t: translator(locale), rich: richFor(locale), setLocale }), [locale]);
}
