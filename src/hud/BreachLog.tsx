import React from "react";
import type { BreachLogItem } from "../data/types.ts";

interface BreachLogProps {
  logs: BreachLogItem[];
}

export const BreachLog: React.FC<BreachLogProps> = ({ logs }) => {
  return (
    <aside
      className="flex flex-col gap-1.5 max-w-sm w-full"
      role="region"
      aria-label="umpan ambang reaktor"
    >
      <div className="flex items-center justify-between px-2 text-[10px] text-slate-500 font-mono lowercase">
        <span>log ambang & peristwa</span>
        <span>sla &lt; 2 dtk</span>
      </div>

      <div
        className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {logs.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-500 rounded-xl bg-slate-950/60 border border-slate-800/60 lowercase">
            belum ada peristiwa ambang tercatat
          </div>
        ) : (
          logs.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-md text-xs text-slate-200 transition-all"
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-emerald-400 lowercase truncate max-w-[190px]">
                  {item.actor}
                </span>
                <span className="font-mono text-slate-500 text-[9px]">
                  {item.latencyMs} ms {item.meetsSla ? "✓" : ""}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 lowercase leading-snug">
                {item.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
