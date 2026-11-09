import React from "react";
import type { SkinMode } from "../config/constants.ts";

interface SkinSwitchProps {
  skin: SkinMode;
  onChange: (skin: SkinMode) => void;
}

export const SkinSwitch: React.FC<SkinSwitchProps> = ({ skin, onChange }) => {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 shadow-[0_2px_0_var(--edge)]"
      role="group"
      aria-label="the ADR-31 terminology choice"
    >
      <button
        type="button"
        onClick={() => onChange("biolab")}
        aria-pressed={skin === "biolab"}
        className={`keycap min-h-[40px] rounded-lg px-2.5 py-1.5 text-[11px] sm:min-h-[44px] sm:px-3.5 sm:text-xs ${skin === "biolab" ? "keycap--primary" : ""} focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none`}
      >
        bio-lab
      </button>

      <button
        type="button"
        onClick={() => onChange("fintech")}
        aria-pressed={skin === "fintech"}
        className={`keycap min-h-[40px] rounded-lg px-2.5 py-1.5 text-[11px] sm:min-h-[44px] sm:px-3.5 sm:text-xs ${skin === "fintech" ? "keycap--primary" : ""} focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none`}
      >
        fintech
      </button>
    </div>
  );
};
