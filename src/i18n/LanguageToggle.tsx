/**
 * Compact `EN | ID` switch (UI-161), used in the landing header. Two buttons in a labelled group;
 * the pressed one is the current language. The visible text is the language code; the accessible
 * name is the language's own name plus the code ("English (EN)"), so it contains the visible text.
 * Styles: `.lang-toggle` in `landing/landing.css`.
 */
import { LOCALES } from "./types.ts";
import { useT } from "./react.tsx";

export function LanguageToggle({ label }: { label: string }) {
  const { locale, setLocale, t } = useT();
  return (
    <div className="lang-toggle" role="group" aria-label={label} data-testid="lang-toggle">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className="lang-toggle__opt"
          lang={l}
          aria-pressed={locale === l}
          aria-label={`${t(`common.language.${l}`)} (${l.toUpperCase()})`}
          onClick={() => setLocale(l)}
          data-testid={`lang-toggle-${l}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
