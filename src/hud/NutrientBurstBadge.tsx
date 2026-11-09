import React from "react";
import type { NutrientBurstState } from "../data/types.ts";
import type { SkinMode } from "../config/constants.ts";
import { SKIN_LABELS } from "../config/constants.ts";

interface NutrientBurstBadgeProps {
  burst: NutrientBurstState;
  skin: SkinMode;
}

export const NutrientBurstBadge: React.FC<NutrientBurstBadgeProps> = ({ burst, skin }) => {
  const labels = SKIN_LABELS[skin];
  const isActive = burst.isActive;

  return (
    <div
      className={`flex items-center gap-2.5 px-3.5 py-2 rounded-full border backdrop-blur-md transition-all select-none ${
        isActive
          ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-200 shadow-md shadow-emerald-500/15"
          : "bg-slate-950/80 border-slate-800 text-slate-300"
      }`}
      role="status"
      aria-label={`${labels.burst}: ${isActive ? `diskon ${burst.activeBurstBps / 100}%` : "siaga"}`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          isActive
            ? "bg-emerald-400 motion-safe:animate-pulse shadow-[0_0_8px_#34d399]"
            : "bg-slate-600"
        }`}
      />
      <div className="flex items-baseline gap-2 text-xs">
        <span className="font-semibold lowercase">{labels.burst}</span>
        {isActive ? (
          <>
            <span className="font-mono font-bold text-emerald-300">
              -{(burst.activeBurstBps / 100).toFixed(2)}%
            </span>
            <span className="text-[10px] text-emerald-300 font-mono">
              sampai epoch {burst.untilEpoch}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-slate-400 lowercase">siaga</span>
        )}
      </div>
    </div>
  );
};
