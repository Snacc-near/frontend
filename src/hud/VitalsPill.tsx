import React from "react";
import type { OptimisticVitalityState } from "../data/optimistic.ts";
import type { SkinMode } from "../config/constants.ts";
import { SKIN_LABELS, VITALITY_MAX } from "../config/constants.ts";

interface VitalsPillProps {
  optimistic: OptimisticVitalityState;
  skin: SkinMode;
  mode: "demo" | "live";
  onFeedClick?: () => void;
}

export const VitalsPill: React.FC<VitalsPillProps> = ({
  optimistic,
  skin,
  mode,
  onFeedClick,
}) => {
  const labels = SKIN_LABELS[skin];
  const isPending = optimistic.status === "pending";
  const pct = Math.min(100, Math.max(0, (optimistic.currentVitality / VITALITY_MAX) * 100));

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 rounded-full bg-slate-950/80 border border-slate-700/50 backdrop-blur-md shadow-lg"
      role="region"
      aria-label={labels.vitality}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 lowercase">{labels.vitality}</span>
          <span className="font-mono text-slate-100 font-bold">
            {optimistic.currentVitality.toLocaleString("id-ID")}{" "}
            <span className="text-slate-500 font-normal">/ {VITALITY_MAX.toLocaleString("id-ID")}</span>
          </span>
        </div>

        {/* Progress bar dengan garis belang saat pending */}
        <div
          className="w-36 h-2 mt-1 rounded-full bg-slate-900 border border-slate-800 overflow-hidden relative"
          role="progressbar"
          aria-valuenow={optimistic.currentVitality}
          aria-valuemin={0}
          aria-valuemax={VITALITY_MAX}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isPending
                ? "bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500 animate-pulse"
                : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {isPending && (
          <span className="text-[10px] text-amber-400/90 mt-0.5 animate-pulse lowercase">
            {labels.optimisticPending}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onFeedClick}
        disabled={mode === "live"}
        title={mode === "live" ? labels.feedDisabled : labels.feedAction}
        aria-label={labels.feedAction}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold lowercase transition-all min-h-[36px] ${
          mode === "live"
            ? "bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800"
            : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 shadow-md shadow-emerald-500/20 cursor-pointer"
        }`}
      >
        {labels.feedAction}
      </button>
    </div>
  );
};
