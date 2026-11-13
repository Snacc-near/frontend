/**
 * The Strain Detail Modal (the on-chain NFT strain inspector), on the shared `Modal` window.
 * Shows the clicked strain's genetics, organelles, vitality, BMR, and ATP balance.
 * Escape, the focus trap and focus return come from `Modal`.
 */

import React from "react";
import type { StrainDetail, SvgLoadStatus } from "../data/types.ts";
import type { SkinMode } from "../config/constants.ts";
import { SKIN_LABELS, VITALITY_MAX } from "../config/constants.ts";
import type { GameMode } from "../config/constants.ts";
import { healthOf } from "../data/collection.ts";
import { Modal } from "../ui/Modal.tsx";
import { Empty, KeycapButton } from "../ui/controls.tsx";
import type { GameActionKey } from "./GameActions.tsx";
import { StrainChain } from "./ChainSections.tsx";

interface StrainDetailModalProps {
  strain: StrainDetail | null;
  isLoading?: boolean;
  svgDataUri?: string | null;
  svgStatus?: SvgLoadStatus;
  /** Where a ready live SVG came from; defaults to the backend route. */
  svgSource?: string;
  skin: SkinMode;
  mode: GameMode;
  onClose: () => void;
  onFeedClick?: () => void;
  /** Live mode: the connected wallet owns this strain, so "inject nutrients" opens the signed feed. */
  feedEnabled?: boolean;
  /** Live mode: why feeding is unavailable (e.g. "connect a wallet to feed"). */
  feedHint?: string;
  /** UI-150: the connected wallet owns this strain; opens another signed action for it. */
  onAction?: (key: GameActionKey) => void;
  /** UI-155: opens another Snacc's detail (a parent, child or sibling in the lineage section); ids are plain text without it. */
  onOpenStrain?: (strainId: number) => void;
}

/** Signed actions offered on an owned strain (UI-150). */
const DETAIL_ACTIONS: { key: GameActionKey; label: string }[] = [
  { key: "allocate", label: "allocate ATP" },
  { key: "divide", label: "divide" },
  { key: "extract", label: "produce" },
  { key: "npc", label: "buy spores" },
  { key: "pool", label: "industrial pool" },
  { key: "gift", label: "give away" },
];

const SVG_BOX = "h-40 w-full border border-[var(--ink-hi)] bg-[var(--paper)]";

export const StrainDetailModal: React.FC<StrainDetailModalProps> = ({
  strain,
  isLoading,
  svgDataUri,
  svgStatus = "idle",
  svgSource = "from /api/strains/{id}/svg",
  skin,
  mode,
  onClose,
  onFeedClick,
  feedEnabled = false,
  feedHint,
  onAction,
  onOpenStrain,
}) => {
  const labels = SKIN_LABELS[skin];

  if (!strain && !isLoading) return null;

  // The headline and the bar show the effective vitality (after bmr decay); the stored value sits in its own row.
  const shownVitality = strain ? (typeof strain.effective_vitality === "number" ? strain.effective_vitality : strain.vitality) : 0;
  const vitPct = Math.min(100, Math.max(0, (shownVitality / VITALITY_MAX) * 100));
  const starving = strain && typeof strain.effective_vitality === "number" && healthOf(strain.status, strain.effective_vitality) === "starving";

  return (
    <Modal
      title="strain.nft"
      heading={`strain #${strain?.strain_id ?? "..."}`}
      onClose={onClose}
      testId="strain-detail-modal"
      footer={<span>nft strain on-chain</span>}
    >
      {isLoading ? (
        <Empty icon="ring">loading the strain data from the contract...</Empty>
      ) : strain ? (
        <div className="fd-stack">
          {/* SVG inspector from nft_token media (rendered safely via img) */}
          <div className="fd-stack" style={{ gap: 6 }}>
            <div className="fd-row fd-row--between">
              <span className="fd-sub">on-chain svg</span>
              <span className="fd-field__hint">
                {mode === "live" ? (svgStatus === "ready" ? svgSource : svgStatus === "loading" ? "loading…" : svgStatus === "error" ? "unavailable" : "no data") : "demo, simulated"}
              </span>
            </div>
            {mode === "live" && svgStatus === "loading" ? (
              <div className={`${SVG_BOX} flex items-center justify-center text-xs lowercase text-[var(--ink)]`} role="status">
                loading the on-chain svg…
              </div>
            ) : mode === "live" && svgDataUri ? (
              <img src={svgDataUri} alt={`on-chain svg for strain ${strain.strain_id}`} className={`${SVG_BOX} object-contain`} />
            ) : mode === "live" ? (
              <div className={`${SVG_BOX} flex items-center justify-center text-xs lowercase text-[var(--ink)]`}>
                <span className="fd-num text-lg text-[var(--ink-hi)]">—</span>
                <span className="ml-2">{svgStatus === "error" ? "svg request failed" : "no svg for this strain yet"}</span>
              </div>
            ) : svgDataUri ? (
              <img src={svgDataUri} alt={`demo svg for strain ${strain.strain_id}`} className={`${SVG_BOX} object-contain`} />
            ) : null}
          </div>

          {/* Owner & Vault */}
          <dl className="fd-kv">
            <div className="fd-kv__row">
              <dt>owner</dt>
              <dd className="fd-kv__num">{strain.owner_id}</dd>
            </div>
            {strain.vault_subaccount && (
              <div className="fd-kv__row">
                <dt>vault subaccount</dt>
                <dd className="fd-kv__num">{strain.vault_subaccount}</dd>
              </div>
            )}
          </dl>

          {/* Vitality bar */}
          <div className="fd-stack border border-[var(--ink-hi)] bg-[var(--paper)] p-3" style={{ gap: 8 }}>
            <div className="fd-row fd-row--between">
              <span className="fd-sub lowercase">{labels.vitality}</span>
              <span className="fd-num text-sm font-semibold">
                {shownVitality.toLocaleString("en-US")}{" "}
                <span className="font-normal text-[var(--ink)]">/ {VITALITY_MAX.toLocaleString("en-US")}</span>
              </span>
            </div>
            <span
              className="fd-meter fd-meter--wide"
              role="meter"
              aria-label={labels.vitality}
              aria-valuemin={0}
              aria-valuemax={VITALITY_MAX}
              aria-valuenow={Math.min(VITALITY_MAX, Math.max(0, shownVitality))}
            >
              <span className="fd-meter__fill" style={{ transform: `scaleX(${(vitPct / 100).toFixed(3)})` }} />
            </span>
            <div className="fd-row fd-row--between">
              <span className="fd-field__hint">stored vitality (before bmr decay)</span>
              <span className="fd-num text-xs">{strain.vitality.toLocaleString("en-US")}</span>
            </div>
            <div className="fd-row fd-row--between">
              <span className="fd-field__hint">effective vitality (after bmr decay)</span>
              <span className="fd-num text-xs">
                {typeof strain.effective_vitality === "number" ? strain.effective_vitality.toLocaleString("en-US") : "—"}
              </span>
            </div>
            <div className="fd-row fd-row--between">
              <span className="fd-field__hint">status</span>
              <span className="fd-num text-xs">
                {strain.status ?? "—"}
                {starving ? " · starving (effective vitality 0)" : ""}
              </span>
            </div>
            <div className="fd-row fd-row--between">
              <span className="fd-field__hint">hunger rate (bmr)</span>
              <span className="fd-num text-xs">{strain.bmr_per_hour} / hour</span>
            </div>
          </div>

          {/* Genetic stats & organelles */}
          <div className="grid grid-cols-3 gap-2 text-center" role="group" aria-label="organelle levels">
            {(
              [
                ["mitochondria", strain.organel.mitokondria],
                ["nucleus", strain.organel.nukleus],
                ["lysosome", strain.organel.lisosom],
              ] as const
            ).map(([name, level]) => (
              <div key={name} className="flex flex-col gap-0.5 border border-[var(--ink-hi)] bg-[var(--paper)] p-2">
                <span className="fd-field__hint">{name}</span>
                <span className="fd-num text-sm font-semibold">{level}</span>
              </div>
            ))}
          </div>

          {/* ATP balance & generation */}
          <div className="fd-row fd-row--between">
            <span className="fd-field__hint lowercase">
              {labels.atp} balance: <span className="fd-num font-semibold text-[var(--ink-hi)]">{strain.atp_balance}</span>
            </span>
            <span className="fd-field__hint lowercase">generation #{strain.generation}</span>
          </div>

          {/* UI-155: lineage and history from the chain index (live mode only: demo strains have no chain history) */}
          {mode === "live" ? <StrainChain strainId={strain.strain_id} generation={strain.generation} onOpenStrain={onOpenStrain} /> : null}

          {/* Feed action button */}
          <div className="fd-stack border-t border-dashed border-[var(--rule-dash)] pt-3" style={{ gap: 6 }}>
            <KeycapButton
              variant="primary"
              block
              onClick={onFeedClick}
              disabled={mode === "live" && !feedEnabled}
              aria-label={labels.feedAction}
              data-testid="strain-feed"
            >
              {labels.feedAction}
            </KeycapButton>
            {mode === "live" ? (
              <span className="fd-field__hint text-center">
                {feedEnabled ? "feed_strain · signed in your wallet on testnet" : (feedHint ?? labels.feedDisabled)}
              </span>
            ) : null}
            {mode === "live" && onAction ? (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="group" aria-label="more signed actions" data-testid="strain-actions">
                {DETAIL_ACTIONS.map((a) => (
                  <KeycapButton key={a.key} onClick={() => onAction(a.key)} data-testid={`strain-action-${a.key}`}>
                    {a.label}
                  </KeycapButton>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
