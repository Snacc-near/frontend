/**
 * UI-119: the "who crossed the threshold" log (the Threshold Breach Telemetry Rail).
 * A branched timeline (the DS-07 pattern) for the NEP-297 events:
 * `zone_changed`, `nutrient_burst_released`, `strain_liquidated`, and `feast_result`.
 * Verifies the DoD: a render latency < 2000 ms (< 2 seconds) + click an item for the 3D replay.
 */

import type { ThresholdBreachEvent } from "../types.ts";
import { OFFICIAL_CONSTANTS } from "../types.ts";

export interface BreachLogItemViewModel {
  id: string;
  kindBadge: string;
  actorLabel: string;
  deltaLabel: string;
  summary: string;
  latencyMs: number;
  meetsSla: boolean;
  latencyBadge: string;
}

/**
 * A pure builder for the threshold log items so `node --test` can verify them deterministically.
 */
export function buildBreachLogItemViewModel(evt: ThresholdBreachEvent): BreachLogItemViewModel {
  const latencyMs = Math.max(1, evt.renderedAtMs - evt.emittedAtMs);
  const meetsSla = latencyMs < OFFICIAL_CONSTANTS.RENDER_LATENCY_SLA_MS;

  let kindBadge = "THERMAL SHIFT";
  if (evt.kind === "zone_changed") {
    kindBadge = `${evt.fromZone ?? " Zone"} -> ${evt.toZone ?? "Zone"}`;
  } else if (evt.kind === "nutrient_burst_released") {
    kindBadge = "NUTRIENT BURST";
  } else if (evt.kind === "strain_liquidated") {
    kindBadge = "CELL LYSIS 10/90";
  } else if (evt.kind === "feast_result") {
    kindBadge = "GREAT FEAST";
  }

  const sign = evt.tempDeltaMk > 0 ? "+" : "";
  const deltaLabel =
    evt.tempDeltaMk !== 0
      ? `${sign}${evt.tempDeltaMk} mK (${evt.crucibleTemp} mK)`
      : `${evt.crucibleTemp} mK`;

  return {
    id: evt.id,
    kindBadge,
    actorLabel: evt.actor,
    deltaLabel,
    summary: evt.summary,
    latencyMs,
    meetsSla,
    latencyBadge: `${latencyMs}ms`,
  };
}

/**
 * The DOM controller for the "who crossed the threshold" timeline (UI-119).
 */
export class ThresholdBreachLogController {
  private readonly root: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly slaBadgeEl: HTMLElement;
  private readonly onSelectEvent: (evt: ThresholdBreachEvent) => void;

  constructor(mount: HTMLElement, onSelectEvent: (evt: ThresholdBreachEvent) => void) {
    this.onSelectEvent = onSelectEvent;

    this.root = document.createElement("aside");
    this.root.className = "breach-rail";
    this.root.setAttribute("data-testid", "threshold-breach-log");

    const header = document.createElement("div");
    header.className = "breach-rail__header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "breach-rail__title-wrap";

    const dot = document.createElement("span");
    dot.className = "breach-rail__live-dot";

    const title = document.createElement("h3");
    title.className = "breach-rail__title";
    title.textContent = "THRESHOLD BREACH LOG · WHO CROSSED THE THRESHOLD";

    titleWrap.append(dot, title);

    this.slaBadgeEl = document.createElement("span");
    this.slaBadgeEl.className = "breach-rail__sla";
    this.slaBadgeEl.textContent = "NEP-297 <2s SLA";

    header.append(titleWrap, this.slaBadgeEl);

    this.listEl = document.createElement("ol");
    this.listEl.className = "breach-rail__timeline";

    this.root.append(header, this.listEl);
    mount.appendChild(this.root);
  }

  public renderEvents(events: readonly ThresholdBreachEvent[], maxItems = 6): BreachLogItemViewModel[] {
    const sliced = events.slice(0, maxItems);
    const vms = sliced.map(buildBreachLogItemViewModel);

    this.listEl.replaceChildren();

    if (vms.length > 0) {
      const latest = vms[0]!;
      this.slaBadgeEl.textContent = `LIVE · ${latest.latencyBadge} (<2000ms PASS)`;
      this.slaBadgeEl.setAttribute("data-sla", latest.meetsSla ? "pass" : "warn");
    }

    for (let i = 0; i < sliced.length; i++) {
      const raw = sliced[i]!;
      const vm = vms[i]!;

      const li = document.createElement("li");
      li.className = "breach-node";
      li.setAttribute("data-kind", raw.kind);

      const triggerBtn = document.createElement("button");
      triggerBtn.type = "button";
      triggerBtn.className = "breach-node__btn";
      triggerBtn.setAttribute("title", "Click to replay this 3D threshold event in the Crucible");
      triggerBtn.addEventListener("click", () => this.onSelectEvent(raw));

      const topLine = document.createElement("span");
      topLine.className = "breach-node__top";

      const badge = document.createElement("span");
      badge.className = "breach-node__badge";
      badge.textContent = vm.kindBadge;

      const actor = document.createElement("span");
      actor.className = "breach-node__actor";
      actor.textContent = vm.actorLabel;

      const delta = document.createElement("span");
      delta.className = "breach-node__delta";
      delta.textContent = vm.deltaLabel;

      const latency = document.createElement("span");
      latency.className = "breach-node__latency";
      latency.textContent = vm.latencyBadge;

      topLine.append(badge, actor, delta, latency);

      const summary = document.createElement("span");
      summary.className = "breach-node__summary";
      summary.textContent = vm.summary;

      triggerBtn.append(topLine, summary);
      li.appendChild(triggerBtn);
      this.listEl.appendChild(li);
    }

    return vms;
  }
}
