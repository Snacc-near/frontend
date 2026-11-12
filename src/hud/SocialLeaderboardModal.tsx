import React, { useState } from "react";
import type { GameMode, SkinMode } from "../config/constants.ts";
import type { AppetiteViewModel } from "../data/types.ts";
import { formatSocialPost } from "../swap/socialFormat.ts";

interface SocialLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  appetite: AppetiteViewModel | null;
  mode: GameMode;
  skin?: SkinMode;
}

export const SocialLeaderboardModal: React.FC<SocialLeaderboardModalProps> = ({
  isOpen,
  onClose,
  appetite,
  mode,
  skin = "biolab",
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const topFeeders = appetite?.topFeeders ?? [
    { account_id: "snacc-v001.near", amount: "196514539503915099101877" },
  ];

  const postText = formatSocialPost({
    epoch: appetite?.currentEpoch ?? 1,
    crucibleTempMk: appetite?.crucibleTempMk ?? 650,
    zone: appetite?.zone ?? "FEVER",
    feastVolume: appetite?.feastVolume ?? "196514539503915099101877",
    feastTarget: appetite?.feastTarget ?? "110708605367226947928032",
    topFeeders,
    network: mode === "demo" ? "NEAR Protocol (demo)" : "NEAR Protocol",
  });

  const handleCopy = () => {
    navigator.clipboard?.writeText(postText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-label="social leaderboard publication"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        className="plate-panel relative flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-[var(--edge)] bg-[var(--panel)] p-5 text-[var(--ink-hi)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3">
          <div className="flex items-center gap-2">
            <span className="lp-label font-mono text-[10px] tracking-wider uppercase text-[var(--accent-dk)]">
              SocialDB
            </span>
            <h2 className="text-sm font-bold tracking-tight lowercase">
              {skin === "fintech"
                ? "protocol leaderboard & social verification"
                : "the great feast & socialdb publication"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close modal"
            className="keycap min-h-[32px] min-w-[32px] px-2 text-xs font-mono text-[var(--ink)] hover:text-[var(--ink-hi)] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
          >
            ✕
          </button>
        </div>

        {/* Podium list */}
        <div className="flex flex-col gap-1.5 rounded-xl bg-black/15 p-3">
          <div className="flex justify-between text-xs text-[var(--ink)]">
            <span className="font-semibold lowercase">
              {skin === "fintech" ? "top capital feeders" : "podium alchemists (great feast)"}
            </span>
            <span className="font-mono text-[10px] text-[var(--frost)]">
              epoch {appetite?.currentEpoch ?? 1}
            </span>
          </div>

          <div className="flex flex-col gap-1 pt-1">
            {topFeeders.slice(0, 3).map((f, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
              return (
                <div
                  key={f.account_id}
                  className="flex items-center justify-between rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{medal}</span>
                    <span className="truncate text-[var(--ink-hi)]">{f.account_id}</span>
                  </div>
                  <span className="shrink-0 font-semibold text-[var(--accent-dk)]">
                    {(BigInt(f.amount) / 10n ** 18n).toLocaleString("en-US")} $SNACC
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Formatted Markdown Post Preview */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs lowercase text-[var(--ink)]">
            social.near post payload (`type: md`)
          </label>
          <pre className="max-h-40 overflow-y-auto rounded-xl border border-[var(--edge)] bg-black/30 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--ink)]">
            {postText}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="keycap flex-1 min-h-[38px] rounded-xl bg-[var(--accent-dk)] px-4 text-xs font-semibold text-white shadow-sm hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
          >
            {copied ? "✓ copied to clipboard" : "copy social.near markdown"}
          </button>
          <a
            href="https://social.near.page"
            target="_blank"
            rel="noopener noreferrer"
            className="keycap flex min-h-[38px] items-center justify-center rounded-xl border border-[var(--edge)] px-4 text-xs font-semibold text-[var(--ink-hi)] hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
          >
            open social.near ↗
          </a>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--edge)] pt-2 text-center font-mono text-[10px] lowercase text-[var(--ink)]">
          RES-113 · standard NEP-297 log indexing & SocialDB contract payload
        </div>
      </div>
    </div>
  );
};
