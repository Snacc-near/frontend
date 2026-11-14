/**
 * Cell Lab window (the shared `Modal`): cutaway figure iframe, action keycaps, organelle cards,
 * production chain, on-chain SVG. Escape, the focus trap and focus return come from `Modal`.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { StrainDetail, SvgLoadStatus } from "../data/types.ts";
import type { MacroZone } from "../config/zones.ts";
import type { SkinMode } from "../config/constants.ts";
import { useT } from "../i18n/react.tsx";
import { useSkinLabels } from "../i18n/skin.ts";
import { Icon, Tag } from "../ui/fd.tsx";
import { Modal } from "../ui/Modal.tsx";
import type { HudMode } from "./GameHud.tsx";
import type { LabAction } from "../game/simulation.ts";
import type { OrganelleLevels } from "../game/simulation.ts";
import { MAX_ORGANELLE_LEVEL, costAtLevel } from "../game/simulation.ts";
import {
  CELL_LAB_SRC,
  buildPlayMessage,
  currentOrigin,
  postToFigure,
  validateFigureMessage,
} from "../game/bridge.ts";
import {
  BUSY_TIMEOUT_MS,
  LAB_KEYCAPS,
  buildLabStateMessage,
  busyReducer,
  createStateSender,
  idleBusy,
  isKeyDisabled,
  resolveOrganelLevels,
  type BusyEvent,
  type BusyState,
} from "../game/labState.ts";
import { IconElixir, IconEnzyme, IconSpore } from "./ResourceIcons.tsx";

interface CellLabProps {
  strain: StrainDetail | null;
  isLoading: boolean;
  zone: MacroZone;
  mode: HudMode;
  skin?: SkinMode;
  svgDataUri: string | null;
  svgStatus: SvgLoadStatus;
  simOrganel: OrganelleLevels;
  atpAvailable: number;
  onClose: () => void;
  /** Runs the demo sim effect (or a live "preview only" toast). Return false to refuse (no animation). */
  onAction: (action: LabAction) => boolean | void;
  onUpgrade: (slot: "mitokondria" | "nucleus" | "lysosome") => void;
  onOpenNpcMarket?: () => void;
}

/** The three organelle rows; their names and notes come from `collection.lab.organelle.<key>` (UI-161). */
const ORGANELLES: {
  slot: "mitokondria" | "nucleus" | "lysosome";
  key: "mitokondria" | "nukleus" | "lisosom";
  anim: LabAction;
}[] = [
  { slot: "mitokondria", key: "mitokondria", anim: "atp" },
  { slot: "nucleus", key: "nukleus", anim: "nucleus" },
  { slot: "lysosome", key: "lisosom", anim: "lysosome" },
];

/**
 * An iframe whose document `color-scheme` differs from the iframe element's gets an opaque
 * canvas (black for dark). Same-origin, so read the figure's scheme and mirror it on the
 * element: the page then stays transparent over the cream card whichever scheme it declares.
 */
function matchEmbedColorScheme(frame: HTMLIFrameElement): void {
  try {
    const doc = frame.contentDocument;
    const view = doc?.defaultView;
    if (!doc || !view) return;
    const scheme = view.getComputedStyle(doc.documentElement).colorScheme;
    frame.style.colorScheme = scheme && scheme !== "normal" ? scheme : "light";
  } catch {
    // cross-origin or not ready: the stylesheet default applies
  }
}

/** If the figure has not answered snacc:ready after this long, say so instead of spinning forever. */
const READY_SLOW_MS = 12000;

export const CellLab: React.FC<CellLabProps> = ({
  strain,
  isLoading,
  zone,
  mode,
  skin = "biolab",
  svgDataUri,
  svgStatus,
  simOrganel,
  atpAvailable,
  onClose,
  onAction,
  onUpgrade,
  onOpenNpcMarket,
}) => {
  const { t } = useT();
  const labels = useSkinLabels(skin);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [lastDone, setLastDone] = useState<LabAction | null>(null);
  const [busy, setBusy] = useState<BusyState>(idleBusy);
  const busyRef = useRef<BusyState>(idleBusy);
  const timers = useRef(new Map<LabAction, number>());
  const origin = currentOrigin();

  // Latest values for the long-lived message listener.
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  // One source of truth: the panel and the posted snacc:state read the same resolved levels.
  const resolved = resolveOrganelLevels(mode, strain, simOrganel);

  const senderRef = useRef<ReturnType<typeof createStateSender> | null>(null);
  if (!senderRef.current) {
    senderRef.current = createStateSender((message) => postToFigure(iframeRef.current, message, origin));
  }
  const sendState = useCallback(
    (force: boolean) => {
      if (!strain || !iframeRef.current) return;
      senderRef.current?.send(buildLabStateMessage(mode, strain, simOrganel, zone), force);
    },
    [strain, mode, simOrganel, zone, origin],
  );
  const sendStateRef = useRef(sendState);
  sendStateRef.current = sendState;

  const dispatchBusy = useCallback((event: BusyEvent) => {
    busyRef.current = busyReducer(busyRef.current, event);
    setBusy(busyRef.current);
  }, []);

  const releaseBusy = useCallback(
    (action: LabAction, type: "done" | "timeout") => {
      const timer = timers.current.get(action);
      if (timer !== undefined) window.clearTimeout(timer);
      timers.current.delete(action);
      dispatchBusy({ type, action });
    },
    [dispatchBusy],
  );

  const startBusy = useCallback(
    (action: LabAction) => {
      const existing = timers.current.get(action);
      if (existing !== undefined) window.clearTimeout(existing);
      dispatchBusy({ type: "start", action });
      timers.current.set(
        action,
        window.setTimeout(() => releaseBusy(action, "timeout"), BUSY_TIMEOUT_MS),
      );
    },
    [dispatchBusy, releaseBusy],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = validateFigureMessage({ origin: event.origin, data: event.data }, origin);
      if (!msg) return;
      if (msg.type === "snacc:ready") {
        setReady(true);
        // The figure may finish loading after our first post: always (re)send now.
        sendStateRef.current(true);
        return;
      }
      if (msg.type === "snacc:action") {
        // The figure echoes every run, including ones we started with snacc:play.
        if (busyRef.current.busy.has(msg.action)) return;
        // Figure-initiated click (standalone): same effect as a keycap, no replay needed.
        startBusy(msg.action);
        onActionRef.current(msg.action);
        return;
      }
      if (msg.type === "snacc:done") {
        setLastDone(msg.action);
        releaseBusy(msg.action, "done");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, startBusy, releaseBusy]);

  // Re-send on every change: strain switch, zone change, demo upgrade, mode switch.
  useEffect(() => {
    if (ready) sendState(false);
  }, [ready, sendState]);

  useEffect(() => {
    if (ready) return undefined;
    const timer = window.setTimeout(() => setSlow(true), READY_SLOW_MS);
    return () => window.clearTimeout(timer);
  }, [ready]);

  /** Animation only: used by the organelle upgrade buttons (the sim effect is `onUpgrade`). */
  const playAnimation = useCallback(
    (action: LabAction) => {
      if (!ready || isKeyDisabled(busyRef.current)) return;
      if (postToFigure(iframeRef.current, buildPlayMessage(action), origin)) startBusy(action);
    },
    [ready, origin, startBusy],
  );

  /** Keycap: run the sim effect (demo) / preview toast (live), then play the animation. */
  const press = (action: LabAction) => {
    if (isKeyDisabled(busyRef.current)) return;
    const result = onActionRef.current(action);
    if (result === false) return;
    playAnimation(action);
  };

  const showPlaceholder = !ready;
  const live = mode === "live";
  const keysLocked = isKeyDisabled(busy);
  const upgradeNote = t("collection.lab.upgradeNote");
  const previewNote = t("collection.lab.livePreviewNote");

  return (
    <Modal
      title={t("collection.lab.title")}
      heading={strain ? t("collection.lab.headingStrain", { id: strain.strain_id }) : t("collection.lab.heading")}
      onClose={onClose}
      size="xl"
      testId="cell-lab"
      footer={
        <>
          <span aria-live="polite">
            {ready
              ? `${t("collection.lab.connected")}${keysLocked ? t("collection.lab.playing") : lastDone ? t("collection.lab.last", { action: lastDone }) : ""}`
              : t("collection.lab.waiting")}
          </span>
          <span className="hidden sm:inline">{t("collection.lab.origin")}</span>
        </>
      }
    >
      <div className="fd-stack">
        <div className="fd-row fd-row--between">
          <p className="fd-sub">
            {strain
              ? t("collection.lab.statusLine", { status: strain.status, vit: strain.vitality.toLocaleString("en-US"), zone })
              : isLoading
                ? t("collection.lab.loadingStrain")
                : t("collection.lab.noStrain")}
          </p>
          <span className="fd-row">
            <Tag>{t("collection.lab.fig")}</Tag>
            <Tag>{mode === "demo" ? t("hud.resources.demo") : t("collection.lab.livePreview")}</Tag>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
          <section className="flex min-w-0 flex-col gap-3" aria-label={t("collection.lab.figureLabel")}>
            <div className="lab-figure relative aspect-[4/3] min-h-[260px] w-full flex-none border border-[var(--ink-hi)] lg:aspect-[3/2]">
              <iframe
                ref={iframeRef}
                src={CELL_LAB_SRC}
                title={t("collection.lab.iframeTitle")}
                className="lab-figure__frame absolute inset-0 h-full w-full border-0"
                sandbox="allow-scripts allow-same-origin"
                onLoad={(e) => matchEmbedColorScheme(e.currentTarget)}
                data-testid="cell-figure-iframe"
              />
              {showPlaceholder ? (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--panel)] px-6 text-center"
                  role="status"
                  data-testid="cell-figure-placeholder"
                >
                  <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
                    <circle cx="60" cy="60" r="46" fill="#fffdf5" stroke="#16181a" strokeWidth="3" />
                    <circle cx="48" cy="50" r="18" fill="#f3ead3" stroke="#16181a" strokeWidth="2.5" />
                    <circle cx="48" cy="50" r="7" fill="#f8aa06" stroke="#16181a" strokeWidth="2" />
                    <ellipse cx="82" cy="72" rx="16" ry="9" fill="#fffdf5" stroke="#16181a" strokeWidth="2.5" />
                    <ellipse cx="76" cy="40" rx="12" ry="6" fill="#f8aa06" stroke="#16181a" strokeWidth="2" />
                    <path d="M30 78c10-8 22 6 32 0s22 6 30-2" fill="none" stroke="#5d6165" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <p className="max-w-sm text-sm lowercase text-[var(--ink-hi)]">
                    {slow ? t("collection.lab.slow") : t("collection.lab.loadingFig")}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2" data-testid="lab-keycaps-wrap">
              <div
                className="flex snap-x gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-6 lg:overflow-visible lg:pb-0"
                role="group"
                aria-label={t("collection.lab.actionsLabel")}
                data-testid="lab-keycaps"
              >
                {LAB_KEYCAPS.map((cap) => {
                  const capLabel = t(`collection.lab.keycaps.${cap.action}`);
                  const note = live ? previewNote : cap.previewOnly ? t("collection.lab.previewOnly") : t("collection.lab.play", { label: capLabel });
                  return (
                    <button
                      key={cap.action}
                      type="button"
                      data-action={cap.action}
                      disabled={keysLocked}
                      aria-busy={busy.busy.has(cap.action) || undefined}
                      onClick={() => press(cap.action)}
                      title={note}
                      aria-label={`${capLabel} — ${note}`}
                      className={`keycap min-h-[44px] flex-none snap-start whitespace-nowrap px-3 text-xs focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none lg:px-2 ${cap.primary ? "keycap--primary" : ""}`}
                    >
                      {capLabel}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] lowercase text-[var(--ink)]" data-testid="lab-keycap-note">
                {live ? previewNote : t("collection.lab.demoNote")}
              </p>
            </div>

          </section>

          <aside className="flex min-w-0 flex-col gap-4" aria-label={t("collection.lab.detailsLabel")}>
            <section className="plate-panel p-3" aria-label={t("collection.lab.upgradesLabel")}>
              <h3 className="mb-2 text-sm font-semibold lowercase text-[var(--ink-hi)]">{t("collection.lab.organelles")}</h3>
              <div className="flex flex-col gap-2">
                {ORGANELLES.map((item) => {
                  const level = resolved.levels[item.key];
                  const levelLabel = resolved.known[item.key] ? String(level) : "—";
                  const cost = costAtLevel(Math.min(level, MAX_ORGANELLE_LEVEL));
                  const canUpgrade = !live && level < MAX_ORGANELLE_LEVEL && atpAvailable >= cost;
                  const itemLabel = t(`collection.lab.organelle.${item.key}.label`);
                  return (
                    <div key={item.slot} className="flex items-center gap-3 rounded-xl border border-[var(--edge)] bg-white p-2.5">
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold lowercase text-[var(--ink-hi)]">{itemLabel}</span>
                        <span className="block text-[11px] lowercase text-[var(--ink)]">{t(`collection.lab.organelle.${item.key}.note`)}</span>
                        <span className="mt-1 flex gap-1" aria-label={t("collection.lab.levelLabel", { label: itemLabel, level: levelLabel, max: MAX_ORGANELLE_LEVEL })}>
                          {Array.from({ length: MAX_ORGANELLE_LEVEL }, (_, i) => (
                            <span
                              key={i}
                              className={`h-2 w-6 rounded-full border border-[var(--line)] ${i < level ? "bg-[var(--accent)]" : "bg-[var(--body)]"}`}
                            />
                          ))}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[var(--ink-hi)]" data-testid={`organel-level-${item.key}`}>
                        {levelLabel}
                      </span>
                      <button
                        type="button"
                        disabled={!canUpgrade}
                        onClick={() => {
                          onUpgrade(item.slot);
                          playAnimation(item.anim);
                        }}
                        title={
                          live
                            ? upgradeNote
                            : canUpgrade
                              ? t("collection.lab.upgradeFor", { cost })
                              : level >= MAX_ORGANELLE_LEVEL
                                ? t("collection.lab.maxLevel")
                                : t("collection.lab.needAtp", { cost })
                        }
                        aria-label={t("collection.lab.upgradeLabel", { label: itemLabel })}
                        className={`keycap min-h-[44px] px-3 text-[11px] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none ${canUpgrade ? "keycap--primary" : ""}`}
                      >
                        {level >= MAX_ORGANELLE_LEVEL ? t("collection.lab.max") : live ? t("collection.lab.preview") : t("collection.lab.up", { cost })}
                      </button>
                    </div>
                  );
                })}
              </div>
              {live ? <p className="mt-2 text-[11px] lowercase text-[var(--ink)]">{upgradeNote}</p> : null}
            </section>

            <section className="plate-panel p-3" aria-label={t("collection.lab.chainLabel")}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold lowercase text-[var(--ink-hi)]">{labels.productionChain}</h3>
                {onOpenNpcMarket && (
                  <button
                    type="button"
                    onClick={onOpenNpcMarket}
                    aria-haspopup="dialog"
                    className="keycap inline-flex min-h-[40px] items-center gap-1.5 px-3 text-[11px] font-semibold focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
                  >
                    <Icon name="scale" />
                    <span>{skin === "fintech" ? t("collection.lab.makers") : t("collection.lab.merchants")}</span>
                  </button>
                )}
              </div>
              <ol className="flex flex-wrap items-center gap-1 text-[11px] lowercase text-[var(--ink-hi)]">
                <li className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2 py-1">
                  <IconSpore className="h-3.5 w-3.5" /> {labels.spores}
                </li>
                <li aria-hidden="true">→</li>
                <li className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2 py-1">
                  <IconEnzyme className="h-3.5 w-3.5" /> {labels.enzymes}
                </li>
                <li aria-hidden="true">→</li>
                <li className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2 py-1">
                  <IconElixir className="h-3.5 w-3.5" /> {labels.elixir}
                </li>
              </ol>
            </section>

            <section className="plate-panel p-3" aria-label={t("collection.lab.svgLabel")}>
              <h3 className="mb-2 text-sm font-semibold lowercase text-[var(--ink-hi)]">{labels.onChainSvg}</h3>
              <div className="onchain-frame rounded-xl border border-[var(--line)] bg-[var(--pl-base)] p-2">
                {live && svgStatus === "loading" ? (
                  <div className="eyepiece relative flex h-32 flex-col rounded-lg border border-[var(--line)]" role="status" aria-label={t("collection.lab.focusingLabel")}>
                    <div className="eyepiece-ring" aria-hidden="true" />
                    <span className="absolute bottom-2 font-mono text-[10px] lowercase text-[var(--ink)]">{t("collection.lab.focusing")}</span>
                  </div>
                ) : svgDataUri ? (
                  <img
                    src={svgDataUri}
                    alt={strain ? t("collection.detail.svgAlt", { id: strain.strain_id }) : t("collection.lab.svgAlt")}
                    className="h-32 w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg text-xs lowercase text-[var(--ink)]">
                    <span className="font-mono text-lg text-[var(--ink-hi)]">—</span>
                    <span>{svgStatus === "error" ? t("collection.detail.svgFailed") : t("collection.detail.svgMissing")}</span>
                  </div>
                )}
                <p className="onchain-frame__caption mt-1.5 text-center font-mono text-[10px] tracking-[0.18em] text-[var(--ink-mute)]">
                  {live ? t("collection.detail.svg") : t("collection.lab.svgDemoStub")}
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Modal>
  );
};
