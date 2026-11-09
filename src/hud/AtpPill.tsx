import React from "react";
import type { SkinMode } from "../config/constants.ts";
import { SKIN_LABELS } from "../config/constants.ts";

interface AtpPillProps {
  atpBalance: number;
  skin: SkinMode;
}

export const AtpPill: React.FC<AtpPillProps> = ({ atpBalance, skin }) => {
  const labels = SKIN_LABELS[skin];

  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-950/85 border border-slate-700/50 backdrop-blur-md shadow-lg select-none"
      role="region"
      aria-label={labels.atp}
    >
      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      <div className="flex flex-col text-xs">
        <span className="text-slate-300 text-[10px] lowercase">{labels.atp}</span>
        <span className="font-mono text-amber-300 font-bold">
          {atpBalance.toLocaleString("id-ID")}{" "}
          <span className="text-slate-400 font-normal">atp</span>
        </span>
      </div>
    </div>
  );
};
