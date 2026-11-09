import React from "react";
import type { AppetiteViewModel } from "../data/types.ts";
import { NO_DATA_PLACEHOLDER } from "../data/liveView.ts";
import { formatAppetiteBigInt, formatAppetiteNumber } from "../data/appetite.ts";

interface AppetitePanelProps {
  appetite: AppetiteViewModel | null;
  isLoading: boolean;
  error: boolean;
  mode: "demo" | "live";
}

export const AppetitePanel: React.FC<AppetitePanelProps> = ({
  appetite,
  isLoading,
  error,
  mode,
}) => {
  if (mode === "demo") {
    return (
      <section
        className="flex flex-col gap-1 px-3.5 py-2.5 rounded-2xl bg-slate-950/85 border border-slate-700/50 backdrop-blur-md shadow-lg min-w-[210px] select-none"
        aria-label="appetite meter"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 lowercase">appetite meter</span>
          <span className="text-[10px] text-amber-300 font-mono lowercase">
            demo, simulated
          </span>
        </div>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span className="lowercase">zone</span>
          <span className="font-mono text-slate-200">goldilocks (demo)</span>
        </div>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span className="lowercase">risk heat</span>
          <span className="font-mono text-slate-200">—</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="flex flex-col gap-1 px-3.5 py-2.5 rounded-2xl bg-slate-950/85 border border-slate-700/50 backdrop-blur-md shadow-lg min-w-[210px] max-w-[280px] select-none"
      aria-label="appetite meter"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 lowercase">appetite meter</span>
        {isLoading && !appetite ? (
          <span className="text-[10px] text-slate-400 font-mono lowercase animate-pulse">
            loading…
          </span>
        ) : error && !appetite ? (
          <span className="text-[10px] text-red-300 font-mono lowercase">
            unavailable
          </span>
        ) : (
          <span className="text-[10px] text-emerald-300 font-mono lowercase">
            live · /api/appetite
          </span>
        )}
      </div>

      {!appetite ? (
        <div className="flex justify-between text-[11px] text-slate-400">
          <span className="lowercase">no appetite data</span>
          <span className="font-mono text-slate-200">{NO_DATA_PLACEHOLDER}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span className="lowercase">zone</span>
            <span className="font-mono text-slate-100">{appetite.zone}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span className="lowercase">crucible_temp</span>
            <span className="font-mono text-slate-200">
              {appetite.crucibleTempMk === null
                ? NO_DATA_PLACEHOLDER
                : `${formatAppetiteNumber(appetite.crucibleTempMk)} mk`}
            </span>
          </div>
          <div className="hidden sm:flex justify-between text-[11px] text-slate-400">
            <span className="lowercase">current_epoch</span>
            <span className="font-mono text-slate-200">
              {formatAppetiteNumber(appetite.currentEpoch)}
            </span>
          </div>
          <div className="hidden sm:flex justify-between text-[11px] text-slate-400">
            <span className="lowercase">burst_bps</span>
            <span className="font-mono text-slate-200">
              {formatAppetiteNumber(appetite.burstBps)}
            </span>
          </div>
          <div className="hidden sm:flex justify-between text-[11px] text-slate-400">
            <span className="lowercase">dormant</span>
            <span className="font-mono text-slate-200">
              {appetite.dormant === null
                ? NO_DATA_PLACEHOLDER
                : appetite.dormant
                  ? "true"
                  : "false"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 pt-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span className="lowercase">risk_heat</span>
              <span className="font-mono text-amber-300">
                {formatAppetiteNumber(appetite.riskHeat)}
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={appetite.riskHeat ?? 0}
              aria-valuemin={0}
              aria-valuemax={10000}
              aria-label="risk heat"
            >
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${appetite.riskHeatPct ?? 0}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 pt-0.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span className="lowercase">feast progress</span>
              <span className="font-mono text-slate-200">
                {appetite.feastProgressPct === null
                  ? NO_DATA_PLACEHOLDER
                  : `${appetite.feastProgressPct.toFixed(1)}%`}
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={appetite.feastProgressPct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="feast progress"
            >
              <div
                className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${appetite.feastProgressPct ?? 0}%` }}
              />
            </div>
            <div className="hidden sm:grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-mono">
              <span className="break-all">vol {formatAppetiteBigInt(appetite.feastVolume)}</span>
              <span className="break-all text-right">tgt {formatAppetiteBigInt(appetite.feastTarget)}</span>
            </div>
          </div>
          {appetite.topFeeders.length > 0 && (
            <div className="hidden sm:flex flex-col gap-0.5 pt-1 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-500 lowercase">top_feeders</span>
              {appetite.topFeeders.map((f) => (
                <div
                  key={f.account_id}
                  className="flex justify-between text-[11px] text-slate-400 gap-2"
                >
                  <span className="font-mono text-cyan-300 truncate">
                    {f.account_id}
                  </span>
                  <span className="font-mono text-slate-300 shrink-0">
                    {formatAppetiteBigInt(f.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};
