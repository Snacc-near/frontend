import React from "react";
import type { GameMode } from "../config/constants.ts";
import { useT } from "../i18n/react.tsx";

interface ModeSwitchProps {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
  isBackendConnected: boolean;
}

export const ModeSwitch: React.FC<ModeSwitchProps> = ({
  mode,
  onChange,
  isBackendConnected,
}) => {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-1 items-start">
      <div
        className="hud-seg"
        role="group"
        aria-label={t("hud.mode.group")}
      >
        <button
          type="button"
          onClick={() => onChange("demo")}
          aria-pressed={mode === "demo"}
          className={`keycap min-h-[40px] rounded-lg px-2.5 py-1.5 text-[11px] sm:min-h-[44px] sm:px-3.5 sm:text-xs ${mode === "demo" ? "keycap--primary" : ""} focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none`}
        >
          {t("hud.mode.demo")}
        </button>

        <button
          type="button"
          onClick={() => onChange("live")}
          aria-pressed={mode === "live"}
          className={`keycap flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] sm:min-h-[44px] sm:px-3.5 sm:text-xs ${mode === "live" ? "keycap--primary" : ""} focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none`}
        >
          <span
            className="inline-block h-2 w-2 rounded-full border border-[var(--ink-hi)]"
            style={{ backgroundColor: isBackendConnected ? "var(--ok)" : "var(--accent)", boxShadow: isBackendConnected ? "0 0 0 1px var(--ok)" : "0 0 0 1px var(--accent)" }}
          />
          {t("hud.mode.live")}
        </button>
      </div>

      {mode === "demo" && (
        <span className="pl-2 font-mono text-[10px] lowercase text-[var(--accent-dk)]">
          {t("hud.mode.demo")}
        </span>
      )}
    </div>
  );
};
