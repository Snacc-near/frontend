/**
 * The Strain Detail Modal (the on-chain NFT strain inspector), on the shared `Modal` window.
 * Shows the clicked strain's genetics, organelles, vitality, BMR, and ATP balance.
 * Escape, the focus trap and focus return come from `Modal`.
 *
 * UI-161 phase B3: text comes from the `collection.detail` dictionary and the skin words from `useSkinLabels`.
 */

import React from "react";
import type { StrainDetail, SvgLoadStatus } from "../data/types.ts";
import type { SkinMode } from "../config/constants.ts";
import { VITALITY_MAX } from "../config/constants.ts";
import type { GameMode } from "../config/constants.ts";
import { healthOf } from "../data/collection.ts";
import type { MessageKey } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";
import { useSkinLabels } from "../i18n/skin.ts";
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

/** Signed actions offered on an owned strain (UI-150); the label is a dictionary key. */
const DETAIL_ACTIONS: { key: GameActionKey; label: MessageKey }[] = [
  { key: "allocate", label: "collection.detail.actions.allocate" },
  { key: "divide", label: "collection.detail.actions.divide" },
  { key: "extract", label: "collection.detail.actions.extract" },
  { key: "npc", label: "collection.detail.actions.npc" },
  { key: "pool", label: "collection.detail.actions.pool" },
  { key: "gift", label: "collection.detail.actions.gift" },
];

const SVG_BOX = "h-40 w-full border border-[var(--ink-hi)] bg-[var(--paper)]";

export const StrainDetailModal: React.FC<StrainDetailModalProps> = ({
  strain,
  isLoading,
  svgDataUri,
  svgStatus = "idle",
  svgSource,
  skin,
  mode,
  onClose,
  onFeedClick,
  feedEnabled = false,
  feedHint,
  onAction,
  onOpenStrain,
}) => {
  const { t } = useT();
  const labels = useSkinLabels(skin);

  if (!strain && !isLoading) return null;

  // The headline and the bar show the effective vitality (after bmr decay); the stored value sits in its own row.
  const shownVitality = strain ? (typeof strain.effective_vitality === "number" ? strain.effective_vitality : strain.vitality) : 0;
  const vitPct = Math.min(100, Math.max(0, (shownVitality / VITALITY_MAX) * 100));
  const starving = strain && typeof strain.effective_vitality === "number" && healthOf(strain.status, strain.effective_vitality) === "starving";

  return (
    <Modal
      title={t("collection.detail.title")}
      heading={strain ? t("collection.detail.heading", { id: strain.strain_id }) : t("collection.detail.headingLoading")}
      onClose={onClose}
      testId="strain-detail-modal"
      footer={<span>{t("collection.detail.footer")}</span>}
    >
      {isLoading ? (
        <Empty icon="ring">{t("collection.detail.loading")}</Empty>
      ) : strain ? (
        <div className="fd-stack">
          {/* SVG inspector from nft_token media (rendered safely via img) */}
          <div className="fd-stack" style={{ gap: 6 }}>
            <div className="fd-row fd-row--between">
              <span className="fd-sub">{t("collection.detail.svg")}</span>
              <span className="fd-field__hint">
                {mode === "live"
                  ? svgStatus === "ready"
                    ? (svgSource ?? t("collection.svgApi"))
                    : svgStatus === "loading"
                      ? t("collection.detail.svgLoading")
                      : svgStatus === "error"
                        ? t("collection.detail.svgError")
                        : t("collection.detail.svgNone")
                  : t("collection.detail.svgDemo")}
              </span>
            </div>
            {mode === "live" && svgStatus === "loading" ? (
              <div className={`${SVG_BOX} flex items-center justify-center text-xs lowercase text-[var(--ink)]`} role="status">
                {t("collection.detail.svgLoadingBox")}
              </div>
            ) : mode === "live" && svgDataUri ? (
              <img src={svgDataUri} alt={t("collection.detail.svgAlt", { id: strain.strain_id })} className={`${SVG_BOX} object-contain`} />
            ) : mode === "live" ? (
              <div className={`${SVG_BOX} flex items-center justify-center text-xs lowercase text-[var(--ink)]`}>
                <span className="fd-num text-lg text-[var(--ink-hi)]">—</span>
                <span className="ml-2">{svgStatus === "error" ? t("collection.detail.svgFailed") : t("collection.detail.svgMissing")}</span>
              </div>
            ) : svgDataUri ? (
              <img src={svgDataUri} alt={t("collection.detail.svgDemoAlt", { id: strain.strain_id })} className={`${SVG_BOX} object-contain`} />
            ) : null}
          </div>

          {/* Owner & Vault */}
          <dl className="fd-kv">
            <div className="fd-kv__row">
              <dt>{t("collection.detail.owner")}</dt>
              <dd className="fd-kv__num">{strain.owner_id}</dd>
            </div>
            {strain.vault_subaccount && (
              <div className="fd-kv__row">
                <dt>{t("collection.detail.vault")}</dt>
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
              <span className="fd-field__hint">{t("collection.detail.stored")}</span>
              <span className="fd-num text-xs">{strain.vitality.toLocaleString("en-US")}</span>
            </div>
            <div className="fd-row fd-row--between">
              <span className="fd-field__hint">{t("collection.detail.effective")}</span>
              <span className="fd-num text-xs">
                {typeof strain.effective_vitality === "number" ? strain.effective_vitality.toLocaleString("en-US") : "—"}
              </span>
            </div>
            <div className="fd-row fd-row--between">
              <span className="fd-field__hint">{t("collection.detail.status")}</span>
              <span className="fd-num text-xs">
                {strain.status ?? "—"}
                {starving ? t("collection.detail.starvingNote") : ""}
              </span>
            </div>
            <div className="fd-row fd-row--between">
              <span className="fd-field__hint">{t("collection.detail.bmr")}</span>
              <span className="fd-num text-xs">{t("collection.detail.perHour", { n: strain.bmr_per_hour })}</span>
            </div>
          </div>

          {/* Genetic stats & organelles */}
          <div className="grid grid-cols-3 gap-2 text-center" role="group" aria-label={t("collection.detail.organelLabel")}>
            {(
              [
                ["mitochondria", strain.organel.mitokondria],
                ["nucleus", strain.organel.nukleus],
                ["lysosome", strain.organel.lisosom],
              ] as const
            ).map(([name, level]) => (
              <div key={name} className="flex flex-col gap-0.5 border border-[var(--ink-hi)] bg-[var(--paper)] p-2">
                <span className="fd-field__hint">{t(`collection.detail.${name}`)}</span>
                <span className="fd-num text-sm font-semibold">{level}</span>
              </div>
            ))}
          </div>

          {/* ATP balance & generation */}
          <div className="fd-row fd-row--between">
            <span className="fd-field__hint lowercase">
              {t("collection.detail.balance", { atp: labels.atp })} <span className="fd-num font-semibold text-[var(--ink-hi)]">{strain.atp_balance}</span>
            </span>
            <span className="fd-field__hint lowercase">{t("collection.detail.generation", { n: strain.generation })}</span>
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
                {feedEnabled ? t("collection.detail.feedSigned") : (feedHint ?? labels.feedDisabled)}
              </span>
            ) : null}
            {mode === "live" && onAction ? (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="group" aria-label={t("collection.detail.actionsLabel")} data-testid="strain-actions">
                {DETAIL_ACTIONS.map((a) => (
                  <KeycapButton key={a.key} onClick={() => onAction(a.key)} data-testid={`strain-action-${a.key}`}>
                    {t(a.label)}
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
