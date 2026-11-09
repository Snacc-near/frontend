/** Cell Lab sheet: cutaway figure iframe, organelle cards, production chain, on-chain SVG. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { StrainDetail, SvgLoadStatus } from "../data/types.ts";
import type { MacroZone } from "../config/zones.ts";
import type { HudMode } from "./GameHud.tsx";
import type { LabAction } from "../game/simulation.ts";
import type { OrganelleLevels } from "../game/simulation.ts";
import { MAX_ORGANELLE_LEVEL, costAtLevel } from "../game/simulation.ts";
import {
  CELL_LAB_SRC,
  buildPlayMessage,
  buildStateMessage,
  currentOrigin,
  postToFigure,
  strainToBridgeState,
  validateFigureMessage,
} from "../game/bridge.ts";
import { IconElixir, IconEnzyme, IconSpore } from "./ResourceIcons.tsx";

interface CellLabProps {
  strain: StrainDetail | null;
  isLoading: boolean;
  zone: MacroZone;
  mode: HudMode;
  svgDataUri: string | null;
  svgStatus: SvgLoadStatus;
  simOrganel: OrganelleLevels;
  atpAvailable: number;
  onClose: () => void;
  onAction: (action: LabAction) => void;
  onUpgrade: (slot: "mitokondria" | "nucleus" | "lysosome") => void;
}

const ORGANELLES: { slot: "mitokondria" | "nucleus" | "lysosome"; label: string; note: string }[] = [
  { slot: "mitokondria", label: "mitochondria", note: "+10% atp per level" },
  { slot: "nucleus", label: "nucleus", note: "+10% output per level" },
  { slot: "lysosome", label: "lysosome", note: "-10% hunger per level" },
];

export const CellLab: React.FC<CellLabProps> = ({
  strain,
  isLoading,
  zone,
  mode,
  svgDataUri,
  svgStatus,
  simOrganel,
  atpAvailable,
  onClose,
  onAction,
  onUpgrade,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [lastDone, setLastDone] = useState<LabAction | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);
  const strainRef = useRef(strain);
  strainRef.current = strain;
  const origin = currentOrigin();

  const sendState = useCallback(() => {
    const current = strainRef.current;
    if (!current || !iframeRef.current) return;
    postToFigure(
      iframeRef.current,
      buildStateMessage(strainToBridgeState(current), zone),
      origin || window.location.origin,
    );
  }, [origin, zone]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = validateFigureMessage({ origin: event.origin, data: event.data }, origin);
      if (!msg) return;
      if (msg.type === "snacc:ready") {
        setReady(true);
        sendState();
        return;
      }
      if (msg.type === "snacc:action") {
        onAction(msg.action);
        return;
      }
      if (msg.type === "snacc:done") {
        setLastDone(msg.action);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, sendState, onAction]);

  useEffect(() => {
    if (strain) sendState();
  }, [strain, sendState]);

  const play = (action: LabAction) => {
    if (iframeRef.current && ready) {
      postToFigure(iframeRef.current, buildPlayMessage(action), origin || window.location.origin);
    }
    onAction(action);
  };

  const showPlaceholder = !ready || iframeFailed;
  const liveDisabled = mode === "live";
  const disabledNote = "on-chain transactions need a wallet — outside this demo";

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-[rgba(22,24,26,0.35)] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cell-lab-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-6xl flex-col overflow-hidden rounded-none border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-hi)] sm:rounded-2xl"
        data-testid="cell-lab"
      >
        <div className="fig-frame__head">
          <span className="fig-frame__fig">Fig 01</span>
          <span className="fig-frame__title">
            {mode === "demo" ? "demo · simulated" : "live · mechanism preview"}
          </span>
        </div>
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2 id="cell-lab-title" className="truncate text-lg font-bold">
              cell lab{strain ? ` — strain #${strain.strain_id}` : ""}
            </h2>
            <span className="block text-xs lowercase text-[var(--ink)]">
              {strain
                ? `status ${strain.status} · vitality ${strain.vitality.toLocaleString("en-US")} · zone ${zone}`
                : isLoading
                  ? "loading strain"
                  : "no strain selected"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close cell lab"
            className="keycap flex min-h-[44px] min-w-[44px] items-center justify-center px-4 text-xs focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
          >
            close
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
          <section className="flex min-h-[320px] flex-col border-b border-[var(--edge)] lg:border-b-0 lg:border-r" aria-label="cell figure">
            <div className="fig-frame__body relative min-h-[320px] flex-1">
              <iframe
                ref={iframeRef}
                src={CELL_LAB_SRC}
                title="cell cutaway figure"
                className="absolute inset-0 h-full w-full border-0"
                sandbox="allow-scripts allow-same-origin"
                onError={() => setIframeFailed(true)}
                onLoad={() => {
                  // Some browsers fire load on 404; readiness still governs.
                }}
                data-testid="cell-figure-iframe"
              />
              {showPlaceholder ? (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--panel-2)] px-6 text-center"
                  role="status"
                  data-testid="cell-figure-placeholder"
                >
                  <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden="true">
                    <circle cx="60" cy="60" r="46" fill="#fffdf5" stroke="#16181a" strokeWidth="3" />
                    <circle cx="48" cy="50" r="18" fill="#f3ead3" stroke="#16181a" strokeWidth="2.5" />
                    <circle cx="48" cy="50" r="7" fill="#f8aa06" stroke="#16181a" strokeWidth="2" />
                    <ellipse cx="82" cy="72" rx="16" ry="9" fill="#fffdf5" stroke="#16181a" strokeWidth="2.5" />
                    <ellipse cx="76" cy="40" rx="12" ry="6" fill="#f8aa06" stroke="#16181a" strokeWidth="2" />
                    <path d="M30 78c10-8 22 6 32 0s22 6 30-2" fill="none" stroke="#5d6165" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <p className="max-w-sm text-sm lowercase text-[var(--ink-hi)]">
                    {mode === "demo"
                      ? "cutaway figure loading. buttons below still drive the simulated mechanism."
                      : "figure preview: pressing a button plays the mechanism without changing live numbers."}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {(
                      [
                        ["feed", "feed"],
                        ["atp", "produce atp"],
                        ["extract", "extract"],
                        ["transmute", "transmute"],
                        ["synthesize", "synthesize"],
                      ] as [LabAction, string][]
                    ).map(([action, label]) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => play(action)}
                        title={liveDisabled ? disabledNote : label}
                        aria-label={`${label}${liveDisabled ? ` — ${disabledNote}` : ""}`}
                        className={`keycap min-h-[44px] px-4 text-xs focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none ${action === "atp" ? "keycap--primary" : ""}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="fig-frame__foot">
              <span className="fig-frame__hint" aria-live="polite">
                {ready ? `figure connected${lastDone ? ` · last: ${lastDone}` : ""}` : "waiting for figure (snacc:ready)…"}
              </span>
              <span className="fig-frame__readout">origin validated · same-origin iframe</span>
            </div>
          </section>

          <aside className="flex flex-col gap-3 p-4" aria-label="cell details">
            <section className="plate-panel p-3" aria-label="organelle upgrades">
              <h3 className="mb-2 text-sm font-semibold lowercase text-[var(--ink-hi)]">organelles</h3>
              <div className="flex flex-col gap-2">
                {ORGANELLES.map((item) => {
                  const simKey: "mitokondria" | "nukleus" | "lisosom" =
                    item.slot === "nucleus" ? "nukleus" : item.slot === "lysosome" ? "lisosom" : "mitokondria";
                  const liveLevel = strain?.organel[simKey];
                  const level = mode === "live" ? (liveLevel ?? 0) : simOrganel[simKey];
                  const liveLevelLabel = mode === "live" && typeof liveLevel !== "number" ? "—" : String(level);
                  const cost = costAtLevel(Math.min(level, MAX_ORGANELLE_LEVEL));
                  const canUpgrade = !liveDisabled && level < MAX_ORGANELLE_LEVEL && atpAvailable >= cost;
                  return (
                    <div key={item.slot} className="flex items-center gap-3 rounded-xl border border-[var(--edge)] bg-white p-2.5">
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold lowercase text-[var(--ink-hi)]">{item.label}</span>
                        <span className="block text-[11px] lowercase text-[var(--ink)]">{item.note}</span>
                        <span className="mt-1 flex gap-1" aria-label={`${item.label} level ${liveLevelLabel} of ${MAX_ORGANELLE_LEVEL}`}>
                          {Array.from({ length: MAX_ORGANELLE_LEVEL }, (_, i) => (
                            <span
                              key={i}
                              className={`h-2 w-6 rounded-full border border-[var(--line)] ${i < level ? "bg-[var(--accent)]" : "bg-[var(--body)]"}`}
                            />
                          ))}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[var(--ink-hi)]">{liveLevelLabel}</span>
                      <button
                        type="button"
                        disabled={!canUpgrade}
                        onClick={() => {
                          onUpgrade(item.slot);
                          play(item.slot === "nucleus" ? "nucleus" : item.slot === "lysosome" ? "lysosome" : "atp");
                        }}
                        title={liveDisabled ? disabledNote : canUpgrade ? `upgrade for ${cost} atp` : level >= MAX_ORGANELLE_LEVEL ? "max level" : `need ${cost} atp`}
                        aria-label={`${item.label} upgrade`}
                        className={`keycap min-h-[44px] px-3 text-[11px] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none ${canUpgrade ? "keycap--primary" : ""}`}
                      >
                        {level >= MAX_ORGANELLE_LEVEL ? "max" : liveDisabled ? "preview" : `up ${cost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
              {liveDisabled ? (
                <p className="mt-2 text-[11px] lowercase text-[var(--ink)]">{disabledNote}</p>
              ) : null}
            </section>

            <section className="plate-panel p-3" aria-label="production chain">
              <h3 className="mb-2 text-sm font-semibold lowercase text-[var(--ink-hi)]">production chain</h3>
              <ol className="flex flex-wrap items-center gap-1 text-[11px] lowercase text-[var(--ink-hi)]">
                <li className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2 py-1">
                  <IconSpore className="h-3.5 w-3.5" /> spores
                </li>
                <li aria-hidden="true">→</li>
                <li className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2 py-1">
                  <IconEnzyme className="h-3.5 w-3.5" /> enzyme
                </li>
                <li aria-hidden="true">→</li>
                <li className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2 py-1">
                  <IconElixir className="h-3.5 w-3.5" /> elixir
                </li>
              </ol>
            </section>

            <section className="plate-panel p-3" aria-label="on chain svg">
              <h3 className="mb-2 text-sm font-semibold lowercase text-[var(--ink-hi)]">on-chain svg</h3>
              {mode === "live" && svgStatus === "loading" ? (
                <div className="flex h-32 items-center justify-center rounded-xl border border-[var(--edge)] bg-white text-xs lowercase text-[var(--ink)] animate-pulse">
                  loading…
                </div>
              ) : svgDataUri ? (
                <img
                  src={svgDataUri}
                  alt={strain ? `on-chain svg for strain ${strain.strain_id}` : "strain svg"}
                  className="h-32 w-full rounded-xl border border-[var(--edge)] bg-white object-contain"
                />
              ) : (
                <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--edge)] bg-white text-xs lowercase text-[var(--ink)]">
                  <span className="font-mono text-lg text-[var(--ink-hi)]">—</span>
                  <span>{svgStatus === "error" ? "svg request failed" : "no svg for this strain yet"}</span>
                </div>
              )}
            </section>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={liveDisabled}
                onClick={() => play("divide")}
                title={liveDisabled ? disabledNote : "divide strain"}
                aria-label={`divide strain${liveDisabled ? ` — ${disabledNote}` : ""}`}
                className="keycap min-h-[44px] text-xs focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
              >
                divide
              </button>
              <button
                type="button"
                disabled={liveDisabled}
                onClick={() => play("lysis")}
                title={liveDisabled ? disabledNote : "harvest / lyse"}
                aria-label={`harvest strain${liveDisabled ? ` — ${disabledNote}` : ""}`}
                className="keycap min-h-[44px] text-xs focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
              >
                harvest
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
