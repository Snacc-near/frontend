import React, { useState } from "react";
import type { BreachLogItem } from "../data/types.ts";

interface BreachLogProps {
  logs: BreachLogItem[];
  /** True while the backend reports `indexer_incomplete` (or a poll failed). */
  indexerIncomplete?: boolean;
}

export const BreachLog: React.FC<BreachLogProps> = ({ logs, indexerIncomplete = false }) => {
  const [isExpanded, setIsExpanded] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 640,
  );

  return (
    <aside
      className="plate-panel flex w-full max-w-sm flex-col gap-1.5 p-2 select-none"
      role="region"
      aria-label="the reactor threshold feed"
    >
      <div className="flex items-center justify-between px-1 font-mono text-[10px] lowercase text-[var(--ink)]">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg px-1 transition-colors hover:text-[var(--ink-hi)] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
          aria-expanded={isExpanded}
          aria-controls="breach-log-list"
        >
          <span className="inline-block h-2 w-2 rounded-full border border-[var(--ink-hi)] bg-[var(--accent)]" aria-hidden="true" />
          <span>threshold log & events</span>
          <span className="text-[var(--ink-mute)] text-[10px]">
            [{isExpanded ? "close" : "open"}]
          </span>
        </button>
        <span className="text-[var(--ink-mute)] font-mono">sla &lt; 2000 ms</span>
      </div>

      {indexerIncomplete && (
        <div
          className="rounded-lg border border-[var(--accent-dk)] bg-[var(--accent-dim)] px-3 py-1.5 font-mono text-[10px] lowercase text-[var(--accent-dk)]"
          role="status"
        >
          indexer catching up — the event list may be incomplete
        </div>
      )}

      {isExpanded && (
        <div
          id="breach-log-list"
          className="flex max-h-24 flex-col gap-1 overflow-y-auto pr-1 sm:max-h-36"
          role="log"
          aria-live="polite"
          aria-atomic="false"
        >
          {logs.length === 0 ? (
            <div className="rounded-xl border border-[var(--edge)] bg-white px-3 py-2 text-xs lowercase text-[var(--ink)]">
              no threshold events recorded yet
            </div>
          ) : (
            logs.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-0.5 rounded-xl border border-[var(--edge)] bg-white px-3 py-2 text-xs text-[var(--ink-hi)] shadow-[0_1px_0_var(--edge)]"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="max-w-[190px] truncate font-semibold lowercase text-[var(--ink-hi)]">
                    {item.actor}
                  </span>
                  <span className="font-mono text-[9px] text-[var(--ink)]">
                    {item.latencyMs} ms {item.meetsSla ? "sla pass" : "sla miss"}
                  </span>
                </div>
                <p className="text-[11px] lowercase leading-snug text-[var(--ink)]">
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
