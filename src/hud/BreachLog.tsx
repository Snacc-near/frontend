import React, { useState } from "react";
import type { BreachLogItem } from "../data/types.ts";

interface BreachLogProps {
  logs: BreachLogItem[];
}

export const BreachLog: React.FC<BreachLogProps> = ({ logs }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <aside
      className="flex flex-col gap-1.5 max-w-sm w-full select-none"
      role="region"
      aria-label="the reactor threshold feed"
    >
      <div className="flex items-center justify-between px-2 text-[10px] text-slate-400 font-mono lowercase">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="hover:text-slate-200 transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none rounded-lg px-1"
          aria-expanded={isExpanded}
          aria-controls="breach-log-list"
        >
          <span>log ambang & peristiwa</span>
          <span className="text-slate-500 text-[10px]">
            [{isExpanded ? "tutup" : "buka"}]
          </span>
        </button>
        <span className="text-slate-500 font-mono">sla &lt; 2000 ms</span>
      </div>

      {isExpanded && (
        <div
          id="breach-log-list"
          className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1"
          role="log"
          aria-live="polite"
          aria-atomic="false"
        >
          {logs.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 rounded-xl bg-slate-950/80 border border-slate-800/80 lowercase">
              no threshold events recorded yet
            </div>
          ) : (
            logs.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-slate-950/85 border border-slate-800/80 backdrop-blur-md text-xs text-slate-200 transition-all shadow-md"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-emerald-400 lowercase truncate max-w-[190px]">
                    {item.actor}
                  </span>
                  <span className="font-mono text-slate-400 text-[9px]">
                    {item.latencyMs} ms {item.meetsSla ? "sla pass" : "sla miss"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 lowercase leading-snug">
                  {item.summary}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
