/**
 * One quiet line at the foot of the game (UI-151): the testnet disclaimer and links to the terms and
 * privacy pages. Plain links, so they open the static pages in the same tab. The line and the link
 * names follow the language (UI-161); the pages they open stay English.
 */
import { useT } from "../i18n/react.tsx";

export function AppLegalLinks() {
  const { t } = useT();
  return (
    <nav className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-0 font-mono text-[10px] lowercase text-[var(--ink)]" aria-label={t("help.legal.aria")} data-testid="app-legal">
      <span>{t("help.legal.line")}</span>
      <a className="fd-a" href="/terms" data-testid="app-terms">
        {t("help.legal.terms")}
      </a>
      <a className="fd-a" href="/privacy" data-testid="app-privacy">
        {t("help.legal.privacy")}
      </a>
    </nav>
  );
}
