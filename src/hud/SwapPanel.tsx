import React, { useEffect, useState, useTransition } from "react";
import type { GameMode, SkinMode } from "../config/constants.ts";
import { fetchRefPrices, RefPriceModel } from "../swap/refPrice.ts";
import {
  fetchIntentsQuote,
  IntentsQuoteResult,
  PRESET_INPUT_ASSETS,
  SupportedAsset,
} from "../swap/intentsQuote.ts";
import { swapConfig } from "../swap/config.ts";

interface SwapPanelProps {
  mode: GameMode;
  onClose: () => void;
  skin?: SkinMode;
}

export const SwapPanel: React.FC<SwapPanelProps> = ({ mode, onClose, skin = "biolab" }) => {
  const [tab, setTab] = useState<"ref" | "intents">("ref");

  // Ref / Rhea state (RES-107)
  const [refPrice, setRefPrice] = useState<RefPriceModel | null>(null);
  const [refLoading, setRefLoading] = useState<boolean>(true);

  // NEAR Intents state (RES-108)
  const [selectedAssetIn, setSelectedAssetIn] = useState<SupportedAsset>(PRESET_INPUT_ASSETS[0]);
  const [amountIn, setAmountIn] = useState<string>("1");
  const [intentsQuote, setIntentsQuote] = useState<IntentsQuoteResult | null>(null);
  const [intentsLoading, setIntentsLoading] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Load Ref prices on mount
  useEffect(() => {
    let active = true;
    setRefLoading(true);

    if (mode === "demo") {
      // In demo mode, simulate realistic sample display data
      setRefPrice({
        status: "not_listed",
        snaccPriceUsd: "—",
        referencePriceUsd: "$5.42",
        relativePrice: null,
        referenceSymbol: "wNEAR",
        rheaSwapUrl: "https://app.rhea.finance",
        updatedAtMs: Date.now(),
        errorMessage: "not listed yet on dex pool",
      });
      setRefLoading(false);
      return;
    }

    fetchRefPrices(swapConfig)
      .then((res) => {
        if (active) {
          setRefPrice(res);
          setRefLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setRefPrice({
            status: "error",
            snaccPriceUsd: null,
            referencePriceUsd: null,
            relativePrice: null,
            referenceSymbol: "wNEAR",
            rheaSwapUrl: "https://app.rhea.finance",
            updatedAtMs: null,
            errorMessage: err instanceof Error ? err.message : "failed to load prices",
          });
          setRefLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [mode]);

  // Handle quote fetch
  const handleGetQuote = () => {
    if (!amountIn || parseFloat(amountIn) <= 0) return;
    setIntentsLoading(true);

    if (mode === "demo") {
      window.setTimeout(() => {
        startTransition(() => {
          setIntentsQuote({
            status: "ready",
            amountIn,
            assetInSymbol: selectedAssetIn.symbol,
            estimatedOut: (parseFloat(amountIn) * 1250).toLocaleString("en-US"),
            minAmountOut: (parseFloat(amountIn) * 1237).toLocaleString("en-US"),
            destSymbol: swapConfig.intentsDestSymbol,
            expirationTime: "60s",
          });
          setIntentsLoading(false);
        });
      }, 250);
      return;
    }

    fetchIntentsQuote({ assetIn: selectedAssetIn, amountIn }, swapConfig)
      .then((res) => {
        startTransition(() => {
          setIntentsQuote(res);
          setIntentsLoading(false);
        });
      })
      .catch((err) => {
        startTransition(() => {
          setIntentsQuote({
            status: "error",
            amountIn,
            assetInSymbol: selectedAssetIn.symbol,
            estimatedOut: "—",
            minAmountOut: "—",
            destSymbol: swapConfig.intentsDestSymbol,
            errorMessage: err instanceof Error ? err.message : "quote failed",
          });
          setIntentsLoading(false);
        });
      });
  };

  return (
    <div
      role="dialog"
      aria-label="swap terminal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        className="plate-panel relative flex w-full max-w-md flex-col gap-3 rounded-2xl border border-[var(--edge)] bg-[var(--panel)] p-5 text-[var(--ink-hi)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3">
          <div className="flex items-center gap-2">
            <span className="lp-label font-mono text-[10px] tracking-wider uppercase text-[var(--accent-dk)]">
              DEX
            </span>
            <h2 className="text-sm font-bold tracking-tight lowercase">
              {skin === "fintech"
                ? "secondary liquidity & cross-chain routing"
                : "swap & liquidity terminal"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close terminal"
            className="keycap min-h-[32px] min-w-[32px] px-2 text-xs font-mono text-[var(--ink)] hover:text-[var(--ink-hi)] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setTab("ref")}
            className={`keycap min-h-[34px] rounded-lg text-xs font-medium transition-colors ${
              tab === "ref"
                ? "bg-[var(--accent-dk)] text-white shadow-sm"
                : "text-[var(--ink)] hover:text-[var(--ink-hi)]"
            }`}
          >
            Ref / Rhea (DEX)
          </button>
          <button
            type="button"
            onClick={() => setTab("intents")}
            className={`keycap min-h-[34px] rounded-lg text-xs font-medium transition-colors ${
              tab === "intents"
                ? "bg-[var(--accent-dk)] text-white shadow-sm"
                : "text-[var(--ink)] hover:text-[var(--ink-hi)]"
            }`}
          >
            NEAR Intents (1Click)
          </button>
        </div>

        {/* Tab 1: Ref / Rhea */}
        {tab === "ref" && (
          <div className="flex flex-col gap-3" data-testid="tab-ref">
            <div className="flex flex-col gap-2 rounded-xl bg-black/10 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--ink)]">reference price ({refPrice?.referenceSymbol ?? "wNEAR"})</span>
                <span className="font-mono font-semibold">
                  {refLoading ? "loading…" : refPrice?.referencePriceUsd ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--ink)]">$SNACC token price</span>
                <span className="font-mono font-semibold text-[var(--accent-dk)]">
                  {refLoading ? "loading…" : refPrice?.snaccPriceUsd ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--ink)]">pool listing status</span>
                <span className="font-mono text-[11px] text-[var(--warm)]">
                  {refLoading ? "checking…" : refPrice?.errorMessage ?? "listed"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--edge)] bg-white/5 p-2.5 text-[10px] leading-relaxed text-[var(--ink)]">
              ℹ display only: external DEX market prices are presented for information and do not affect contract mechanics or monetary thermostats.
            </div>

            <a
              href={refPrice?.rheaSwapUrl ?? "https://app.rhea.finance"}
              target="_blank"
              rel="noopener noreferrer"
              className="keycap mt-1 flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-dk)] px-4 text-xs font-semibold text-white shadow-md hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
            >
              open in Rhea Finance ↗
            </a>
          </div>
        )}

        {/* Tab 2: NEAR Intents */}
        {tab === "intents" && (
          <div className="flex flex-col gap-3" data-testid="tab-intents">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--ink)]">pay with (cross-chain asset)</label>
              <div className="flex gap-2">
                <select
                  value={selectedAssetIn.id}
                  onChange={(e) => {
                    const found = PRESET_INPUT_ASSETS.find((a) => a.id === e.target.value);
                    if (found) setSelectedAssetIn(found);
                  }}
                  className="keycap min-h-[38px] flex-1 rounded-xl border border-[var(--edge)] bg-[var(--panel)] px-3 text-xs text-[var(--ink-hi)] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
                >
                  {PRESET_INPUT_ASSETS.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.symbol} ({asset.chain})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                  placeholder="0.0"
                  className="keycap min-h-[38px] w-28 rounded-xl border border-[var(--edge)] bg-black/20 px-3 text-right font-mono text-xs font-semibold text-[var(--ink-hi)] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGetQuote}
              disabled={intentsLoading || !amountIn}
              className="keycap min-h-[38px] rounded-xl bg-[var(--accent-dk)] px-4 text-xs font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
            >
              {intentsLoading ? "fetching quote…" : "fetch dry-run quote"}
            </button>

            {intentsQuote && (
              <div className="flex flex-col gap-2 rounded-xl bg-black/10 p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--ink)]">estimated output</span>
                  <span className="font-mono font-bold text-[var(--accent-dk)]">
                    {intentsQuote.estimatedOut} {intentsQuote.destSymbol}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--ink)]">minimum received</span>
                  <span className="font-mono text-[var(--ink-hi)]">
                    {intentsQuote.minAmountOut} {intentsQuote.destSymbol}
                  </span>
                </div>
                {intentsQuote.errorMessage && (
                  <div className="text-[11px] text-[var(--warm)] font-mono">
                    {intentsQuote.errorMessage}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-[var(--edge)] bg-white/5 p-2.5 text-[10px] leading-relaxed text-[var(--ink)]">
              ℹ preview only: quote provided by NEAR Intents 1Click service. On-chain execution requires an external web3 wallet.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-[var(--edge)] pt-2 text-center font-mono text-[10px] lowercase text-[var(--ink)]">
          {mode === "demo" ? "demo · simulated rates" : "live preview · external api"}
        </div>
      </div>
    </div>
  );
};
