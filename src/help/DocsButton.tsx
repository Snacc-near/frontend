/**
 * A "Docs" keycap in the game header (DOC-LINK). Shown to every player, signed in or not, so anyone who
 * is stuck can open the docs site in a new tab without leaving the game.
 */
import { LINKS } from "../landing/chapters.ts";
import { useT } from "../i18n/react.tsx";

export function DocsButton({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  return (
    <a
      href={LINKS.docs}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("help.docs.aria")}
      title={t("help.docs.aria")}
      data-testid={compact ? "docs-button-mobile" : "docs-button"}
      className={`keycap inline-flex items-center justify-center gap-1 font-mono text-xs font-bold text-[var(--ink-hi)] no-underline focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none ${
        compact ? "min-h-[40px] min-w-[40px] px-2" : "min-h-[36px] px-2.5"
      }`}
    >
      {t("help.docs.label")}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
