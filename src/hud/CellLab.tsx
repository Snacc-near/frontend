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
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cell-lab-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-6xl flex-col overflow-hidden bg-slate-950/95 text-slate-100 sm:rounded-3xl sm:border sm:border-slate-700/60"
        data-testid="cell-lab"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <span className="block text-[10px] font-mono lowercase tracking-wide text-emerald-300">
              {mode === "demo" ? "demo · simulated" : "live · mechanism preview"}
            </span>
            <h2 id="cell-lab-title" className="truncate text-lg font-bold">
              cell lab{strain ? ` — strain #${strain.strain_id}` : ""}
            </h2>
            <span className="block text-xs lowercase text-slate-400">
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
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-900 px-4 text-xs font-semibold lowercase focus-visible:ring-2 focus-visible:ring-emerald-300 focus:outline-none"
          >
            close
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
          <section className="flex min-h-[320px] flex-col border-b border-slate-800 lg:border-b-0 lg:border-r" aria-label="cell figure">
            <div className="relative min-h-[320px] flex-1 bg-slate-900/40">
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
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-950 via-slate-950 to-violet-950 px-6 text-center"
                  role="status"
                  data-testid="cell-figure-placeholder"
                >
                  <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden="true">
                    <circle cx="60" cy="60" r="46" fill="#0e2a4a" stroke="#38bdf8" strokeWidth="4" />
                    <circle cx="48" cy="50" r="18" fill="#7c3aed" stroke="#e879f9" strokeWidth="3" />
                    <ellipse cx="82" cy="72" rx="16" ry="9" fill="#f472b6" />
                    <ellipse cx="76" cy="40" rx="12" ry="6" fill="#fb923c" />
                    <path d="M30 78c10-8 22 6 32 0s22 6 30-2" fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <p className="max-w-sm text-sm lowercase text-slate-200">
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
                        className={`min-h-[44px] rounded-full px-4 text-xs font-semibold lowercase focus-visible:ring-2 focus-visible:ring-emerald-300 focus:outline-none ${
                          liveDisabled ? "bg-slate-800 text-slate-300" : "bg-emerald-500 text-slate-950"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <p className="break-words border-t border-slate-800 px-4 py-2 text-[11px] lowercase text-slate-400" aria-live="polite">
              {ready ? `figure connected${lastDone ? ` · last: ${lastDone}` : ""}` : "waiting for figure (snacc:ready)…"} · origin
              validated · same-origin iframe
            </p>
          </section>

          <aside className="flex flex-col gap-4 p-4" aria-label="cell details">
            <section className="rounded-2xl bg-slate-900/60 p-3" aria-label="organelle upgrades">
              <h3 className="mb-2 text-sm font-semibold lowercase">organelles</h3>
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
                    <div key={item.slot} className="flex items-center gap-3 rounded-xl bg-slate-950/70 p-2.5">
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold lowercase">{item.label}</span>
                        <span className="block text-[11px] lowercase text-slate-400">{item.note}</span>
                        <span className="mt-1 flex gap-1" aria-label={`${item.label} level ${liveLevelLabel} of ${MAX_ORGANELLE_LEVEL}`}>
                          {Array.from({ length: MAX_ORGANELLE_LEVEL }, (_, i) => (
                            <span
                              key={i}
                              className={`h-2 w-6 rounded-full ${i < level ? "bg-emerald-400" : "bg-slate-700"}`}
                            />
                          ))}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold">{liveLevelLabel}</span>
                      <button
                        type="button"
                        disabled={!canUpgrade}
                        onClick={() => {
                          onUpgrade(item.slot);
                          play(item.slot === "nucleus" ? "nucleus" : item.slot === "lysosome" ? "lysosome" : "atp");
                        }}
                        title={liveDisabled ? disabledNote : canUpgrade ? `upgrade for ${cost} atp` : level >= MAX_ORGANELLE_LEVEL ? "max level" : `need ${cost} atp`}
                        aria-label={`${item.label} upgrade`}
                        className={`min-h-[44px] rounded-full px-3 text-[11px] font-semibold lowercase focus-visible:ring-2 focus-visible:ring-emerald-300 focus:outline-none ${
                          canUpgrade ? "bg-emerald-500 text-slate-950" : "cursor-not-allowed bg-slate-800 text-slate-500"
                        }`}
                      >
                        {level >= MAX_ORGANELLE_LEVEL ? "max" : liveDisabled ? "preview" : `up ${cost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
              {liveDisabled ? (
                <p className="mt-2 text-[11px] lowercase text-slate-400">{disabledNote}</p>
              ) : null}
            </section>

            <section className="rounded-2xl bg-slate-900/60 p-3" aria-label="production chain">
              <h3 className="mb-2 text-sm font-semibold lowercase">production chain</h3>
              <ol className="flex items-center gap-1 text-[11px] lowercase text-slate-300">
                <li className="flex items-center gap-1 rounded-full bg-slate-950 px-2 py-1">
                  <IconSpore className="h-3.5 w-3.5 text-cyan-300" /> spores
                </li>
                <li aria-hidden="true">→</li>
                <li className="flex items-center gap-1 rounded-full bg-slate-950 px-2 py-1">
                  <IconEnzyme className="h-3.5 w-3.5 text-violet-300" /> enzyme
                </li>
                <li aria-hidden="true">→</li>
                <li className="flex items-center gap-1 rounded-full bg-slate-950 px-2 py-1">
                  <IconElixir className="h-3.5 w-3.5 text-pink-300" /> elixir
                </li>
              </ol>
            </section>

            <section className="rounded-2xl bg-slate-900/60 p-3" aria-label="on chain svg">
              <h3 className="mb-2 text-sm font-semibold lowercase">on-chain svg</h3>
              {mode === "live" && svgStatus === "loading" ? (
                <div className="flex h-32 items-center justify-center rounded-xl bg-slate-950 text-xs lowercase text-slate-400 animate-pulse">
                  loading…
                </div>
              ) : svgDataUri ? (
                <img
                  src={svgDataUri}
                  alt={strain ? `on-chain svg for strain ${strain.strain_id}` : "strain svg"}
                  className="h-32 w-full rounded-xl bg-slate-950 object-contain"
                />
              ) : (
                <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-xl bg-slate-950 text-xs lowercase text-slate-500">
                  <span className="font-mono text-lg text-slate-300">—</span>
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
                className={`min-h-[44px] rounded-xl text-xs font-semibold lowercase focus-visible:ring-2 focus-visible:ring-emerald-300 focus:outline-none ${
                  liveDisabled ? "cursor-not-allowed bg-slate-800 text-slate-500" : "bg-emerald-500 text-slate-950"
                }`}
              >
                divide
              </button>
              <button
                type="button"
                disabled={liveDisabled}
                onClick={() => play("lysis")}
                title={liveDisabled ? disabledNote : "harvest / lyse"}
                aria-label={`harvest strain${liveDisabled ? ` — ${disabledNote}` : ""}`}
                className={`min-h-[44px] rounded-xl text-xs font-semibold lowercase focus-visible:ring-2 focus-visible:ring-emerald-300 focus:outline-none ${
                  liveDisabled ? "cursor-not-allowed bg-slate-800 text-slate-500" : "bg-rose-500 text-slate-950"
                }`}
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
