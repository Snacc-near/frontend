/** Cozy mobile-game style HUD: top resource bar, bottom action dock, production queue. */
import React from "react";
import type { ProductionItem } from "../game/simulation.ts";
import { IconAtp, IconElixir, IconEnzyme, IconSnacc, IconSpore } from "./ResourceIcons.tsx";

export type HudMode = "demo" | "live";

export interface ResourceValues {
  snacc: string;
  atp: string;
  spores: string;
  enzymes: string;
  elixir: string;
}

export interface DockButton {
  key: string;
  label: string;
  hint: string;
  disabled: boolean;
}

interface ResourceBarProps {
  mode: HudMode;
  resources: ResourceValues;
}

export const ResourceBar: React.FC<ResourceBarProps> = ({ mode, resources }) => {
  const pills = [
    { key: "snacc", label: "$SNACC", value: resources.snacc, Icon: IconSnacc, tint: "text-emerald-300" },
    { key: "atp", label: "atp", value: resources.atp, Icon: IconAtp, tint: "text-amber-300" },
    { key: "spores", label: "spores", value: resources.spores, Icon: IconSpore, tint: "text-cyan-300" },
    { key: "enzymes", label: "enzymes", value: resources.enzymes, Icon: IconEnzyme, tint: "text-violet-300" },
    { key: "elixir", label: "elixir", value: resources.elixir, Icon: IconElixir, tint: "text-pink-300" },
  ];
  return (
    <div
      className="pointer-events-auto flex flex-wrap items-center gap-1.5 max-sm:max-w-[calc(100vw-1.25rem)] max-sm:flex-nowrap max-sm:justify-end max-sm:overflow-x-auto max-sm:pb-0.5"
      role="region"
      aria-label="resources"
    >
      {mode === "demo" ? (
        <span className="rounded-full bg-amber-950/80 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-amber-200 max-sm:hidden">
          demo · simulated
        </span>
      ) : (
        <span className="rounded-full bg-emerald-950/80 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-emerald-200 max-sm:hidden">
          live · testnet
        </span>
      )}
      {pills.map(({ key, label, value, Icon, tint }) => (
        <span
          key={key}
          className="flex items-center gap-1.5 rounded-full bg-slate-950/85 px-2.5 py-1.5 text-xs backdrop-blur-md"
          data-testid={`resource-${key}`}
          aria-label={`${label} ${value}`}
        >
          <Icon className={`h-4 w-4 ${tint}`} />
          <span className="hidden text-[10px] lowercase text-slate-400 min-[420px]:inline">{label}</span>
          <span className={`font-mono font-bold ${tint}`}>{value}</span>
        </span>
      ))}
    </div>
  );
};

interface ProductionQueuePanelProps {
  mode: HudMode;
  queue: ProductionItem[];
  onCollect: (id: string) => void;
  queueEmptyText: string;
}

export const ProductionQueuePanel: React.FC<ProductionQueuePanelProps> = ({
  mode,
  queue,
  onCollect,
  queueEmptyText,
}) => (
  <section
    className="pointer-events-auto flex w-full flex-col gap-1 rounded-2xl bg-slate-950/85 p-2.5 backdrop-blur-md sm:max-w-sm"
    aria-label="production queue"
  >
    <div className="flex items-center justify-between text-[11px]">
      <span className="lowercase text-slate-300">production queue</span>
      <span className="font-mono text-[10px] lowercase text-slate-500">
        {mode === "demo" ? "demo · simulated" : "live values only"}
      </span>
    </div>
    {queue.length === 0 ? (
      <span className="text-[11px] lowercase text-slate-500">{queueEmptyText}</span>
    ) : (
      <ul className="flex flex-col gap-1.5">
        {queue.map((item) => {
          const pct = Math.min(100, Math.max(0, 100 - (item.remainingSec / item.durationSec) * 100));
          return (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-xl bg-slate-900/70 px-2 py-1.5"
              data-testid="queue-item"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] lowercase text-slate-200">
                  {item.kind} · +{item.amount}
                </span>
                <span
                  className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-800"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(pct)}
                  aria-label={`${item.kind} progress`}
                >
                  <span className="block h-full rounded-full bg-emerald-400 motion-safe:transition-all" style={{ width: `${pct}%` }} />
                </span>
                <span className="mt-0.5 block text-[10px] font-mono lowercase text-slate-500">
                  {item.ready ? "ready" : `${Math.ceil(item.remainingSec)}s left`}
                </span>
              </span>
              <button
                type="button"
                disabled={!item.ready}
                onClick={() => onCollect(item.id)}
                aria-label={item.ready ? `collect ${item.kind}` : `${item.kind} not ready`}
                className={`min-h-[40px] rounded-full px-3 text-[11px] font-semibold lowercase focus-visible:ring-2 focus-visible:ring-emerald-300 focus:outline-none ${
                  item.ready
                    ? "bg-emerald-400 text-slate-950 motion-safe:active:scale-95"
                    : "cursor-not-allowed bg-slate-800 text-slate-500"
                }`}
              >
                collect
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

interface ActionDockProps {
  dock: DockButton[];
  onDock: (key: string) => void;
}

export const ActionDock: React.FC<ActionDockProps> = ({ dock, onDock }) => (
  <nav
    className="pointer-events-auto flex w-full items-end gap-1 overflow-x-auto rounded-2xl bg-slate-950/85 p-1.5 backdrop-blur-md"
    aria-label="colony actions"
  >
    {dock.map((button) => (
      <button
        key={button.key}
        type="button"
        disabled={button.disabled}
        onClick={() => onDock(button.key)}
        title={button.hint}
        data-testid={`dock-${button.key}`}
        className={`flex min-h-[52px] min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold lowercase focus-visible:ring-2 focus-visible:ring-cyan-300 focus:outline-none max-sm:min-w-0 max-sm:px-1 max-sm:text-[10px] ${
          button.disabled
            ? "cursor-not-allowed bg-slate-900/80 text-slate-500"
            : "bg-emerald-500/90 text-slate-950 motion-safe:active:scale-95"
        }`}
      >
        <span>{button.label}</span>
        <span className="max-w-full truncate text-[9px] font-normal opacity-80 max-sm:hidden">{button.hint}</span>
      </button>
    ))}
  </nav>
);
