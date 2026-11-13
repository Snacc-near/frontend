import React from "react";
import { useT } from "../i18n/react.tsx";
import { Icon } from "../ui/fd.tsx";

interface AccountFilterProps {
  account: string;
  onChange: (account: string) => void;
  matchedCount: number;
}

export const AccountFilter: React.FC<AccountFilterProps> = ({
  account,
  onChange,
  matchedCount,
}) => {
  const { t } = useT();
  return (
    <div
      className="plate-panel flex flex-col gap-1 px-2.5 py-1.5 sm:px-3.5"
      role="search"
      aria-label={t("hud.filter.region")}
    >
      <div className="flex items-center gap-2">
        <label htmlFor="near-account-input" className="whitespace-nowrap text-[11px] lowercase text-[var(--ink)]">
          {t("hud.filter.label")}
        </label>
        <input
          id="near-account-input"
          type="text"
          value={account}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("hud.filter.placeholder")}
          className="min-h-[40px] w-36 border border-[var(--ink-hi)] bg-white px-2.5 py-1.5 font-mono text-xs text-[var(--ink-hi)] placeholder:text-[var(--ink-mute)] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none sm:min-h-[44px] sm:w-48"
          spellCheck={false}
          autoComplete="off"
        />
        {account && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("hud.filter.clear")}
            className="keycap flex h-10 w-10 shrink-0 items-center justify-center font-mono text-xs sm:h-11 sm:w-11 focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
          >
            <Icon name="close" />
          </button>
        )}
      </div>

      {account.trim().length > 0 && (
        <span className="font-mono text-[10px] lowercase">
          {matchedCount > 0 ? (
            <span className="font-semibold text-[var(--ok)]">
              {t("hud.filter.highlighting", { n: matchedCount })}
            </span>
          ) : (
            <span className="text-[var(--ink)]">
              {t("hud.filter.none")}
            </span>
          )}
        </span>
      )}
    </div>
  );
};
