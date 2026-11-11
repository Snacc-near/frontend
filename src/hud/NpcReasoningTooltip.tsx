import React, { useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import type { NpcProfile, NpcQuoteView } from "../data/npc.ts";

interface NpcReasoningTooltipProps {
  quote: NpcQuoteView;
  profile: NpcProfile;
  skin: SkinMode;
  className?: string;
}

export const NpcReasoningTooltip: React.FC<NpcReasoningTooltipProps> = ({
  quote,
  profile,
  skin,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const skinInfo = skin === "biolab" ? profile.biolab : profile.fintech;

  return (
    <div
      className={`rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3 shadow-[0_2px_0_var(--edge)] ${className}`}
      role="region"
      aria-label="NPC reasoning rationale"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-[var(--accent-dk)]">
            ADR-30 on-chain reasoning
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="font-mono text-[10px] text-[var(--ink)] hover:text-[var(--ink-hi)] cursor-pointer focus-visible:ring-1 focus-visible:ring-[var(--accent-dk)] rounded px-1"
          aria-expanded={isExpanded}
        >
          {isExpanded ? "collapse" : "inspect"}
        </button>
      </div>

      <div className="relative rounded-lg border border-[var(--edge)] bg-white p-2.5 text-[11px] text-[var(--ink-hi)]">
        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold text-[var(--ink)]">
          <span className="capitalize">{skinInfo.name}</span>
          <span>·</span>
          <span className="lowercase">{skinInfo.roleTitle}</span>
        </div>
        <blockquote className="italic font-serif leading-relaxed text-[var(--ink-hi)]">
          &ldquo;{quote.reasoningTooltip}&rdquo;
        </blockquote>

        {isExpanded && (
          <div className="mt-2.5 pt-2 border-t border-[var(--edge)] flex flex-col gap-1 text-[10px] text-[var(--ink)] font-mono">
            <div className="flex justify-between">
              <span>Pricing Formula:</span>
              <span className="text-[var(--ink-hi)]">unit = max(1, floor(P_base × S_target / S_after))</span>
            </div>
            <div className="flex justify-between">
              <span>Stock Impact:</span>
              <span className="text-[var(--ink-hi)]">
                {quote.sporesStockBefore} → {quote.npcSporesStockAfter} units
              </span>
            </div>
            <div className="flex justify-between">
              <span>Unit Price / Total:</span>
              <span className="text-[var(--ink-hi)]">
                {quote.unitPriceVita} VITA / {quote.totalCostSnacc} $SNACC
              </span>
            </div>
            <div className="flex justify-between">
              <span>Wallet:</span>
              <span className="truncate max-w-[200px] text-[var(--ink-hi)]">{profile.walletAccount}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
