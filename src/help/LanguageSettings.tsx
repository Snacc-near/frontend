/**
 * "Language / Bahasa" section of the Settings window (UI-161). Self-contained: it reads and sets the
 * language through `useT()` and needs nothing from the rest of Settings. Two buttons, like the other
 * option groups in that window; the choice is saved in this browser under `snacc_locale`.
 */
import { LOCALE_KEY } from "../i18n/locale.ts";
import { useT } from "../i18n/react.tsx";
import { LOCALES } from "../i18n/types.ts";
import "../ui/fd.css";
import "./guide.css";

export function LanguageSettings() {
  const { locale, setLocale, t, rich } = useT();
  return (
    <section className="guide-section" aria-labelledby="settings-language-h" data-testid="settings-language">
      <h4 id="settings-language-h" className="fd-h">
        {t("settings.language.heading")}
      </h4>
      <div className="fd-tabs fd-dither skin-switch" role="group" aria-label={t("settings.language.group")}>
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            className="fd-tab skin-switch__opt"
            lang={l}
            aria-pressed={locale === l}
            onClick={() => setLocale(l)}
            data-testid={`settings-language-${l}`}
          >
            {t(`common.language.${l}`)}
          </button>
        ))}
      </div>
      <p className="fd-field__hint">{rich("settings.language.hint", { key: <code>{LOCALE_KEY}</code> })}</p>
      <p className="fd-field__hint">{t("settings.language.exceptions")}</p>
    </section>
  );
}

export default LanguageSettings;
