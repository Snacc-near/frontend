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
        className="plate-panel flex min-w-[210px] flex-col gap-1 px-3.5 py-2.5 select-none"
        aria-label="appetite meter"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="lowercase text-[var(--ink)]">appetite meter</span>
          <span className="font-mono text-[10px] lowercase text-[var(--accent-dk)]">
            demo, simulated
          </span>
        </div>
        <div className="flex justify-between text-[11px] text-[var(--ink)]">
          <span className="lowercase">zone</span>
          <span className="font-mono text-[var(--ink-hi)]">goldilocks (demo)</span>
        </div>
        <div className="flex justify-between text-[11px] text-[var(--ink)]">
          <span className="lowercase">risk heat</span>
          <span className="font-mono text-[var(--ink-hi)]">—</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="plate-panel flex min-w-[210px] max-w-[280px] flex-col gap-1 px-3.5 py-2.5 select-none"
      aria-label="appetite meter"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="lowercase text-[var(--ink)]">appetite meter</span>
        {isLoading && !appetite ? (
          <span className="font-mono text-[10px] lowercase text-[var(--ink)] animate-pulse">
            loading…
          </span>
        ) : error && !appetite ? (
          <span className="font-mono text-[10px] lowercase text-[var(--warm)]">
            unavailable
          </span>
        ) : (
          <span className="font-mono text-[10px] lowercase text-[var(--ok)]">
            live · /api/appetite
          </span>
        )}
      </div>

      {!appetite ? (
        <div className="flex justify-between text-[11px] text-[var(--ink)]">
          <span className="lowercase">no appetite data</span>
          <span className="font-mono text-[var(--ink-hi)]">{NO_DATA_PLACEHOLDER}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between text-[11px] text-[var(--ink)]">
            <span className="lowercase">zone</span>
            <span className="font-mono text-[var(--ink-hi)]">{appetite.zone}</span>
          </div>
          <div className="flex justify-between text-[11px] text-[var(--ink)]">
            <span className="lowercase">crucible_temp</span>
            <span className="font-mono text-[var(--ink-hi)]">
              {appetite.crucibleTempMk === null
                ? NO_DATA_PLACEHOLDER
                : `${formatAppetiteNumber(appetite.crucibleTempMk)} mk`}
            </span>
          </div>
          <div className="hidden justify-between text-[11px] text-[var(--ink)] sm:flex">
            <span className="lowercase">current_epoch</span>
            <span className="font-mono text-[var(--ink-hi)]">
              {formatAppetiteNumber(appetite.currentEpoch)}
            </span>
          </div>
          <div className="hidden justify-between text-[11px] text-[var(--ink)] sm:flex">
            <span className="lowercase">burst_bps</span>
            <span className="font-mono text-[var(--ink-hi)]">
              {formatAppetiteNumber(appetite.burstBps)}
            </span>
          </div>
          <div className="hidden justify-between text-[11px] text-[var(--ink)] sm:flex">
            <span className="lowercase">dormant</span>
            <span className="font-mono text-[var(--ink-hi)]">
              {appetite.dormant === null
                ? NO_DATA_PLACEHOLDER
                : appetite.dormant
                  ? "true"
                  : "false"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 pt-1">
            <div className="flex justify-between text-[11px] text-[var(--ink)]">
              <span className="lowercase">risk_heat</span>
              <span className="font-mono text-[var(--accent-dk)]">
                {formatAppetiteNumber(appetite.riskHeat)}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full border border-[var(--line)] bg-[var(--body)]"
              role="progressbar"
              aria-valuenow={appetite.riskHeat ?? 0}
              aria-valuemin={0}
              aria-valuemax={10000}
              aria-label="risk heat"
            >
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${appetite.riskHeatPct ?? 0}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 pt-0.5">
            <div className="flex justify-between text-[11px] text-[var(--ink)]">
              <span className="lowercase">feast progress</span>
              <span className="font-mono text-[var(--ink-hi)]">
                {appetite.feastProgressPct === null
                  ? NO_DATA_PLACEHOLDER
                  : `${appetite.feastProgressPct.toFixed(1)}%`}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full border border-[var(--line)] bg-[var(--body)]"
              role="progressbar"
              aria-valuenow={appetite.feastProgressPct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="feast progress"
            >
              <div
                className="h-full rounded-full bg-[var(--frost)] transition-all duration-300"
                style={{ width: `${appetite.feastProgressPct ?? 0}%` }}
              />
            </div>
            <div className="hidden grid-cols-2 gap-2 font-mono text-[10px] text-[var(--ink)] sm:grid">
              <span className="break-all">vol {formatAppetiteBigInt(appetite.feastVolume)}</span>
              <span className="break-all text-right">tgt {formatAppetiteBigInt(appetite.feastTarget)}</span>
            </div>
          </div>
          {appetite.topFeeders.length > 0 && (
            <div className="flex flex-col gap-0.5 border-t border-[var(--edge)] pt-1 sm:flex">
              <span className="text-[10px] lowercase text-[var(--ink)]">top_feeders</span>
              {appetite.topFeeders.map((f) => (
                <div
                  key={f.account_id}
                  className="flex justify-between gap-2 text-[11px] text-[var(--ink)]"
                >
                  <span className="truncate font-mono text-[var(--frost)]">
                    {f.account_id}
                  </span>
                  <span className="shrink-0 font-mono text-[var(--ink-hi)]">
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
