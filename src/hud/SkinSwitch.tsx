import React from "react";
import type { SkinMode } from "../config/constants.ts";

interface SkinSwitchProps {
  skin: SkinMode;
  onChange: (skin: SkinMode) => void;
}

export const SkinSwitch: React.FC<SkinSwitchProps> = ({ skin, onChange }) => {
  return (
    <div
      className="inline-flex items-center p-1 rounded-full bg-slate-950/80 border border-slate-700/50 backdrop-blur-md"
      role="group"
      aria-label="pilihan terminologi adr-31"
    >
      <button
        type="button"
        onClick={() => onChange("biolab")}
        aria-pressed={skin === "biolab"}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold lowercase transition-all min-h-[36px] cursor-pointer ${
          skin === "biolab"
            ? "bg-emerald-500 text-slate-950 shadow-md"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        bio-lab
      </button>

      <button
        type="button"
        onClick={() => onChange("fintech")}
        aria-pressed={skin === "fintech"}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold lowercase transition-all min-h-[36px] cursor-pointer ${
          skin === "fintech"
            ? "bg-emerald-500 text-slate-950 shadow-md"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        fintech
      </button>
    </div>
  );
};
