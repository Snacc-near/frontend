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
        className={`px-3.5 py-2 rounded-full text-xs font-semibold lowercase transition-all min-h-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none ${
          skin === "biolab"
            ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
            : "text-slate-300 hover:text-slate-100"
        }`}
      >
        bio-lab
      </button>

      <button
        type="button"
        onClick={() => onChange("fintech")}
        aria-pressed={skin === "fintech"}
        className={`px-3.5 py-2 rounded-full text-xs font-semibold lowercase transition-all min-h-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none ${
          skin === "fintech"
            ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
            : "text-slate-300 hover:text-slate-100"
        }`}
      >
        fintech
      </button>
    </div>
  );
};
