import React, { useEffect, useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import {
  NPC_PROFILES,
  calculateNpcQuote,
  createDefaultNpcStates,
  type NpcId,
  type NpcMerchantState,
} from "../data/npc.ts";
import { NpcReasoningTooltip } from "./NpcReasoningTooltip.tsx";
import { IconSnacc, IconSpore } from "./ResourceIcons.tsx";

interface NpcPanelProps {
  isOpen: boolean;
  onClose: () => void;
  skin: SkinMode;
  crucibleTempMk: number;
  mode: "demo" | "live";
  userSnaccBalance: number;
  onBuySpores?: (npcId: NpcId, amount: number, totalCost: number) => boolean | void;
}

export const NpcPanel: React.FC<NpcPanelProps> = ({
  isOpen,
  onClose,
  skin,
  crucibleTempMk,
  mode,
  userSnaccBalance,
  onBuySpores,
}) => {
  const [selectedNpcId, setSelectedNpcId] = useState<NpcId>("npc-extractor");
  const [buyAmount, setBuyAmount] = useState<number>(10);
  const [npcStates, setNpcStates] = useState<Record<NpcId, NpcMerchantState>>(createDefaultNpcStates);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentNpc = npcStates[selectedNpcId];
  const profile = NPC_PROFILES[selectedNpcId];
  const skinInfo = skin === "biolab" ? profile.biolab : profile.fintech;

  const quote = calculateNpcQuote(currentNpc, buyAmount, crucibleTempMk, skin);
  const canAfford = userSnaccBalance >= quote.totalCostSnacc;
  const isStockAvailable = currentNpc.sporesStock >= buyAmount;

  const handleExecuteTrade = () => {
    if (mode === "live") {
      setFeedbackMessage("On-chain execution: invoke npc_buy_spores via an external wallet.");
      return;
    }

    if (!canAfford) {
      setFeedbackMessage(`Insufficient $SNACC (need ${quote.totalCostSnacc}, have ${userSnaccBalance}).`);
      return;
    }

    if (!isStockAvailable) {
      setFeedbackMessage(`Insufficient NPC inventory (${currentNpc.sporesStock} available).`);
      return;
    }

    // Update local NPC state
    setNpcStates((prev) => ({
      ...prev,
      [selectedNpcId]: {
        ...prev[selectedNpcId],
        sporesStock: quote.npcSporesStockAfter,
        snaccReserve: prev[selectedNpcId].snaccReserve + quote.totalCostSnacc,
        tradesExecuted: prev[selectedNpcId].tradesExecuted + 1,
      },
    }));

    if (onBuySpores) {
      onBuySpores(selectedNpcId, buyAmount, quote.totalCostSnacc);
    }

    setFeedbackMessage(
      `Acquired ${buyAmount} ${skinInfo.sporeType} from ${skinInfo.name} for ${quote.totalCostSnacc} $SNACC!`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="npc-panel-title"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-6 shadow-2xl overflow-y-auto max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--edge)] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent-dk)] font-semibold">
                ADR-30 Autonomous NPCs
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-[10px] text-[var(--ink)]">
                {mode === "demo" ? "simulated state" : "on-chain view"}
              </span>
            </div>
            <h2
              id="npc-panel-title"
              className="mt-0.5 text-base sm:text-lg font-bold text-[var(--ink-hi)] capitalize font-serif"
            >
              {skin === "biolab" ? "Alchemist Guild Spore Merchants" : "Institutional Market Maker Desks"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close modal"
            className="keycap min-h-[36px] min-w-[36px] px-2 text-sm text-[var(--ink)] hover:text-[var(--ink-hi)] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
          >
            ✕
          </button>
        </div>

        {/* NPC Selector Tabs */}
        <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="select NPC merchant">
          {(Object.keys(NPC_PROFILES) as NpcId[]).map((id) => {
            const p = NPC_PROFILES[id];
            const pSkin = skin === "biolab" ? p.biolab : p.fintech;
            const isSelected = id === selectedNpcId;
            return (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                onClick={() => {
                  setSelectedNpcId(id);
                  setFeedbackMessage(null);
                }}
                className={`flex flex-col items-start p-2.5 rounded-xl border transition-all text-left focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none ${
                  isSelected
                    ? "border-[var(--accent-dk)] bg-[var(--body)] shadow-[0_2px_0_var(--accent-dk)]"
                    : "border-[var(--edge)] bg-white hover:bg-[var(--panel-2)]"
                }`}
              >
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink-mute)]">
                  {p.archetype}
                </span>
                <span className="font-semibold text-xs text-[var(--ink-hi)] truncate w-full">
                  {pSkin.name}
                </span>
                <span className="text-[10px] text-[var(--ink)] truncate w-full lowercase">
                  {pSkin.roleTitle}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected NPC Overview */}
        <div className="mt-4 rounded-xl border border-[var(--edge)] bg-white p-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--edge)] pb-2 mb-2">
            <div>
              <span className="font-bold text-sm text-[var(--ink-hi)]">{skinInfo.name}</span>
              <span className="text-xs text-[var(--ink)] ml-2">({profile.archetype})</span>
              <p className="text-[11px] text-[var(--ink)] mt-0.5">{skinInfo.description}</p>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--ink-mute)] shrink-0">
              <span>wallet:</span>
              <span className="text-[var(--ink)] truncate max-w-[140px]">{profile.walletAccount}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-[var(--panel-2)] p-2">
              <span className="block font-mono text-[9px] text-[var(--ink-mute)] uppercase">Stock / Target</span>
              <span className="font-mono font-bold text-xs text-[var(--ink-hi)]">
                {currentNpc.sporesStock} / {currentNpc.targetSporesStock}
              </span>
            </div>
            <div className="rounded-lg bg-[var(--panel-2)] p-2">
              <span className="block font-mono text-[9px] text-[var(--ink-mute)] uppercase">Base Price</span>
              <span className="font-mono font-bold text-xs text-[var(--ink-hi)]">
                {currentNpc.baseSporePrice} VITA
              </span>
            </div>
            <div className="rounded-lg bg-[var(--panel-2)] p-2">
              <span className="block font-mono text-[9px] text-[var(--ink-mute)] uppercase">Executed Trades</span>
              <span className="font-mono font-bold text-xs text-[var(--ink-hi)]">
                {currentNpc.tradesExecuted}
              </span>
            </div>
          </div>
        </div>

        {/* Spore Trade Input & Quick Selector */}
        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor="buy-amount-input" className="text-xs font-semibold text-[var(--ink-hi)] lowercase">
            {skin === "biolab" ? "spores quantity to purchase:" : "catalyst coupon units to order:"}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="buy-amount-input"
              type="number"
              min="1"
              max={currentNpc.sporesStock}
              value={buyAmount}
              onChange={(e) => setBuyAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="keycap min-h-[40px] w-24 text-center font-mono font-bold text-sm bg-white border border-[var(--line)] rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
            />
            <div className="flex flex-wrap gap-1">
              {[1, 5, 10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBuyAmount(amt)}
                  className={`keycap min-h-[36px] px-2.5 text-[11px] rounded-lg ${
                    buyAmount === amt ? "keycap--primary" : ""
                  } focus-visible:ring-1 focus-visible:ring-[var(--accent-dk)] focus:outline-none`}
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Quote Box */}
        <div className="mt-4 rounded-xl border border-[var(--edge)] bg-[var(--deck)] p-3 text-[11px]">
          <div className="flex items-center justify-between font-mono mb-1 text-[10px] text-[var(--ink-mute)]">
            <span>Algorithmic Quote</span>
            <span>rule I-15</span>
          </div>
          <div className="grid grid-cols-3 gap-2 py-1 font-mono">
            <div>
              <span className="block text-[10px] text-[var(--ink)]">Unit Price</span>
              <span className="font-bold text-xs text-[var(--ink-hi)]">{quote.unitPriceVita} VITA</span>
            </div>
            <div>
              <span className="block text-[10px] text-[var(--ink)]">Total Cost</span>
              <span className="font-bold text-xs text-[var(--accent-dk)]">{quote.totalCostSnacc} $SNACC</span>
            </div>
            <div>
              <span className="block text-[10px] text-[var(--ink)]">Stock After</span>
              <span className="font-bold text-xs text-[var(--ink-hi)]">{quote.npcSporesStockAfter} units</span>
            </div>
          </div>
        </div>

        {/* ADR-30 Reasoning Tooltip Card */}
        <div className="mt-4">
          <NpcReasoningTooltip quote={quote} profile={profile} skin={skin} />
        </div>

        {/* Feedback message */}
        {feedbackMessage && (
          <div
            className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--accent-dim)] p-2 text-xs text-[var(--accent-ink)] font-semibold"
            role="status"
          >
            {feedbackMessage}
          </div>
        )}

        {/* Action Button */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--edge)] pt-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--ink)]">
            <IconSnacc className="h-4 w-4" />
            <span>Balance:</span>
            <span className="font-mono font-bold text-[var(--ink-hi)]">{userSnaccBalance} $SNACC</span>
          </div>
          <button
            type="button"
            onClick={handleExecuteTrade}
            disabled={!canAfford || !isStockAvailable}
            className={`keycap min-h-[44px] px-5 text-xs font-bold rounded-xl focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none ${
              canAfford && isStockAvailable
                ? "keycap--primary cursor-pointer"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <IconSpore className="h-4 w-4" />
              <span>
                {mode === "demo"
                  ? skin === "biolab"
                    ? `buy ${buyAmount} spores (${quote.totalCostSnacc} $SNACC)`
                    : `order ${buyAmount} coupons (${quote.totalCostSnacc} $SNACC)`
                  : "preview quote on-chain"}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
