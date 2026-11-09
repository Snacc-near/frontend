/**
 * The Strain Detail Modal (the on-chain NFT strain inspector).
 * Shows the clicked strain's genetics, organelles, vitality, BMR, and ATP balance.
 * Keyboard accessible (Escape to close, a focus trap, and an initial focus on the close button)
 * and honors a >= 4.5:1 contrast ratio.
 */

import React, { useEffect, useRef } from "react";
import type { StrainDetail } from "../data/types.ts";
import type { SkinMode } from "../config/constants.ts";
import { SKIN_LABELS, VITALITY_MAX } from "../config/constants.ts";
import type { GameMode } from "../game/engine.ts";

interface StrainDetailModalProps {
  strain: StrainDetail | null;
  isLoading?: boolean;
  skin: SkinMode;
  mode: GameMode;
  onClose: () => void;
  onFeedClick?: () => void;
}

export const StrainDetailModal: React.FC<StrainDetailModalProps> = ({
  strain,
  isLoading,
  skin,
  mode,
  onClose,
  onFeedClick,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const labels = SKIN_LABELS[skin];

  // Close with the Escape key, trap Tab inside the dialog, and give it the initial focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Move the initial focus into the dialog when it opens
  useEffect(() => {
    if ((strain || isLoading) && modalRef.current) {
      modalRef.current.focus();
    }
  }, [strain, isLoading]);

  if (!strain && !isLoading) return null;

  const vitPct = strain ? Math.min(100, Math.max(0, (strain.vitality / VITALITY_MAX) * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strain-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md p-6 rounded-3xl bg-slate-950/90 border border-slate-700/60 shadow-2xl shadow-cyan-950/30 text-slate-100 flex flex-col gap-4 focus:outline-none"
        tabIndex={-1}
      >
        {/* The modal header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 pb-3">
          <div className="flex flex-col">
            <span className="text-[11px] text-emerald-400 font-mono lowercase tracking-wider">
              nft strain on-chain
            </span>
            <h2 id="strain-detail-title" className="text-lg font-bold font-mono text-slate-100">
              strain #{strain?.strain_id ?? "..."}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="close the strain details"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer text-sm font-mono"
          >
            esc
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-slate-400 text-xs lowercase animate-pulse">
            loading the strain data from the contract...
          </div>
        ) : strain ? (
          <>
            {/* Owner & Vault */}
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400 lowercase">owner</span>
                <span className="font-mono text-cyan-300 font-medium">
                  {strain.owner_id}
                </span>
              </div>
              {strain.vault_subaccount && (
                <div className="flex justify-between items-baseline text-[11px]">
                  <span className="text-slate-500 lowercase">vault subaccount</span>
                  <span className="font-mono text-slate-400 truncate max-w-[220px]">
                    {strain.vault_subaccount}
                  </span>
                </div>
              )}
            </div>

            {/* Vitality bar */}
            <div className="flex flex-col gap-1 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 lowercase">{labels.vitality}</span>
                <span className="font-mono font-bold text-slate-100">
                  {strain.vitality.toLocaleString("en-US")}{" "}
                  <span className="text-slate-500 font-normal">/ {VITALITY_MAX.toLocaleString("en-US")}</span>
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden my-1">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${vitPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span className="lowercase">hunger rate (bmr)</span>
                <span className="font-mono text-amber-300">{strain.bmr_per_hour} / jam</span>
              </div>
            </div>

            {/* Genetic stats & organelles */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col">
                <span className="text-slate-500 text-[10px] lowercase">mitokondria</span>
                <span className="font-mono text-amber-400 font-bold mt-0.5">
                  {strain.organel.mitokondria}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col">
                <span className="text-slate-500 text-[10px] lowercase">nukleus</span>
                <span className="font-mono text-cyan-400 font-bold mt-0.5">
                  {strain.organel.nukleus}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col">
                <span className="text-slate-500 text-[10px] lowercase">lisosom</span>
                <span className="font-mono text-emerald-400 font-bold mt-0.5">
                  {strain.organel.lisosom}
                </span>
              </div>
            </div>

            {/* ATP balance & generation */}
            <div className="flex justify-between items-center text-xs px-1 text-slate-400">
              <span className="lowercase">
                {labels.atp} balance:{" "}
                <span className="font-mono font-bold text-amber-400">
                  {strain.atp_balance}
                </span>
              </span>
              <span className="lowercase font-mono text-slate-500">
                generation #{strain.generation}
              </span>
            </div>

            {/* Feed action button */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onFeedClick}
                disabled={mode === "live"}
                aria-label={labels.feedAction}
                className={`w-full min-h-[44px] rounded-2xl text-xs font-semibold lowercase transition-all flex items-center justify-center ${
                  mode === "live"
                    ? "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer"
                }`}
              >
                {labels.feedAction}
              </button>
              {mode === "live" && (
                <span className="text-[10px] text-slate-500 text-center lowercase">
                  {labels.feedDisabled}
                </span>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
