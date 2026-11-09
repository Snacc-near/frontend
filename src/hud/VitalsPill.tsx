import React from "react";
import type { OptimisticVitalityState } from "../data/optimistic.ts";
import type { SkinMode } from "../config/constants.ts";
import { SKIN_LABELS, VITALITY_MAX } from "../config/constants.ts";
import { formatLiveVitality } from "../data/liveView.ts";

interface VitalsPillProps {
  optimistic: OptimisticVitalityState;
  /** Live vitality from the API for the selected strain; "—" when absent. */
  liveVitality: number | null;
  /** Live strain status (e.g. Active | Distressed | Liquidated | SplicedBurned). */
  liveStatus: string | null;
  skin: SkinMode;
  mode: "demo" | "live";
  onFeedClick?: () => void;
}

export const VitalsPill: React.FC<VitalsPillProps> = ({
  optimistic,
  liveVitality,
  liveStatus,
  skin,
  mode,
  onFeedClick,
}) => {
  const labels = SKIN_LABELS[skin];
  const isPending = optimistic.status === "pending";
  const shownValue = mode === "live" ? formatLiveVitality(liveVitality) : optimistic.currentVitality.toLocaleString("en-US");
  const pct =
    mode === "live"
      ? typeof liveVitality === "number"
        ? Math.min(100, Math.max(0, (liveVitality / VITALITY_MAX) * 100))
        : 0
      : Math.min(100, Math.max(0, (optimistic.currentVitality / VITALITY_MAX) * 100));

  return (
    <div
      className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-slate-950/85 border border-slate-700/50 backdrop-blur-md shadow-lg"
      role="region"
      aria-label={labels.vitality}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 sm:gap-3 text-xs">
          <span className="text-slate-300 lowercase hidden min-[380px]:inline">{labels.vitality}</span>
          <span className="font-mono text-slate-100 font-bold text-[11px] sm:text-xs">
            {shownValue}{" "}
            {mode === "live" && liveVitality === null ? null : (
              <span className="text-slate-400 font-normal hidden sm:inline">/ {VITALITY_MAX.toLocaleString("en-US")}</span>
            )}
          </span>
        </div>
        {mode === "live" && liveStatus && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 lowercase">
            <span>status:</span>
            <span
              className={`font-mono font-semibold ${
                liveStatus === "Liquidated"
                  ? "text-red-400"
                  : liveStatus === "SplicedBurned"
                    ? "text-slate-500"
                    : "text-emerald-400"
              }`}
            >
              {liveStatus}
            </span>
          </div>
        )}

        {/* Progress bar with a striped animation while pending (UI-126) */}
        <div
          className="w-20 sm:w-36 h-2 mt-1 rounded-full bg-slate-900 border border-slate-800 overflow-hidden relative"
          role="progressbar"
          aria-label={labels.vitality}
          aria-valuenow={mode === "live" ? liveVitality ?? 0 : optimistic.currentVitality}
          aria-valuemin={0}
          aria-valuemax={VITALITY_MAX}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isPending
                ? "bg-gradient-to-r from-emerald-500 via-amber-300 to-emerald-500 animate-pulse bg-[length:200%_100%]"
                : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {isPending && (
          <span className="text-[10px] text-amber-300 mt-0.5 animate-pulse lowercase font-mono">
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
        className={`px-2.5 sm:px-4 py-2 rounded-full text-xs font-semibold lowercase transition-all min-h-[40px] sm:min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none max-w-[110px] sm:max-w-none truncate ${
          mode === "live"
            ? "bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-800"
            : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 shadow-md shadow-emerald-500/20 cursor-pointer font-bold"
        }`}
      >
        {labels.feedAction}
      </button>
    </div>
  );
};
