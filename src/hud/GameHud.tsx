/** Cozy mobile-game style HUD: top resource bar, bottom action dock, production queue. */
import React from "react";
import type { ProductionItem } from "../game/simulation.ts";
import type { SkinMode } from "../config/constants.ts";
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
  skin?: SkinMode;
}

export const ResourceBar: React.FC<ResourceBarProps> = ({ mode, resources, skin = "biolab" }) => {
  const pills = [
    { key: "snacc", label: "$SNACC", value: resources.snacc, Icon: IconSnacc },
    { key: "atp", label: skin === "fintech" ? "int-atp" : "atp", value: resources.atp, Icon: IconAtp },
    { key: "spores", label: skin === "fintech" ? "coupons" : "spores", value: resources.spores, Icon: IconSpore },
    { key: "enzymes", label: skin === "fintech" ? "clearing" : "enzymes", value: resources.enzymes, Icon: IconEnzyme },
    { key: "elixir", label: skin === "fintech" ? "reserve" : "elixir", value: resources.elixir, Icon: IconElixir },
  ];
  return (
    <div
      className="pointer-events-auto flex flex-wrap items-center gap-1.5 max-sm:max-w-[calc(100vw-1.25rem)] max-sm:flex-nowrap max-sm:justify-end max-sm:overflow-x-auto max-sm:pb-0.5"
      role="region"
      aria-label="resources"
    >
      {mode === "demo" ? (
        <span className="label-plate max-sm:hidden">
          <span className="lp-label">demo · simulated</span>
        </span>
      ) : (
        <span className="label-plate max-sm:hidden">
          <span className="lp-label">live · testnet</span>
        </span>
      )}
      {pills.map(({ key, label, value, Icon }) => (
        <span
          key={key}
          className="label-plate"
          data-testid={`resource-${key}`}
          aria-label={`${label} ${value}`}
        >
          <Icon className="h-4 w-4 text-[var(--ink-hi)]" />
          <span className="lp-label hidden min-[420px]:inline">{label}</span>
          <span className="lp-value font-mono coin-roll" key={`${key}-${value}`}>
            {value}
          </span>
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
    className="plate-panel pointer-events-auto flex w-full flex-col gap-1 p-2.5 sm:max-w-sm"
    aria-label="production queue"
  >
    <div className="flex items-center justify-between text-[11px]">
      <span className="lowercase font-semibold text-[var(--ink-hi)]">production queue</span>
      <span className="font-mono text-[10px] lowercase text-[var(--ink)]">
        {mode === "demo" ? "demo · simulated" : "live values only"}
      </span>
    </div>
    {queue.length === 0 ? (
      <span className="text-[11px] lowercase text-[var(--ink)]">{queueEmptyText}</span>
    ) : (
      <ul className="flex flex-col gap-1.5">
        {queue.map((item) => {
          const pct = Math.min(100, Math.max(0, 100 - (item.remainingSec / item.durationSec) * 100));
          return (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-xl border border-[var(--edge)] bg-white px-2 py-1.5"
              data-testid="queue-item"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] lowercase text-[var(--ink-hi)]">
                  {item.kind} · +{item.amount}
                </span>
                <span
                  className="mt-1 block h-1.5 overflow-hidden rounded-full border border-[var(--edge)] bg-[var(--body)]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(pct)}
                  aria-label={`${item.kind} progress`}
                >
                  <span className="block h-full rounded-full bg-[var(--accent)] motion-safe:transition-all" style={{ width: `${pct}%` }} />
                </span>
                <span className="mt-0.5 block text-[10px] font-mono lowercase text-[var(--ink)]">
                  {item.ready ? "ready" : `${Math.ceil(item.remainingSec)}s left`}
                </span>
              </span>
              <button
                type="button"
                disabled={!item.ready}
                onClick={() => onCollect(item.id)}
                aria-label={item.ready ? `collect ${item.kind}` : `${item.kind} not ready`}
                className={`keycap min-h-[40px] px-3 text-[11px] ${item.ready ? "keycap--primary" : ""}`}
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
    className="plate-panel pointer-events-auto flex w-full items-end gap-1 overflow-x-auto p-1.5"
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
        className={`keycap flex min-h-[52px] min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] max-sm:min-w-0 max-sm:px-1 max-sm:text-[10px] focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none ${
          button.key === "atp" ? "keycap--primary" : ""
        }`}
      >
        <span>{button.label}</span>
        <span className="max-w-full truncate font-mono text-[9px] font-normal opacity-80 max-sm:hidden">{button.hint}</span>
      </button>
    ))}
  </nav>
);
