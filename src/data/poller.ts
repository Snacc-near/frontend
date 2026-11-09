/**
 * The on-chain data poller and event-log processor (UI-117..119).
 * Polling at <= 1000 ms, event dedupe, receipt_id correlation, and a < 2 s SLA audit.
 */

import { EVENT_POLL_INTERVAL_MS, SLA_LATENCY_MAX_MS, MAX_BURST_BPS } from "../config/constants.ts";
import { fetchEvents, fetchMacro, fetchStrains } from "./api.ts";
import type { CrucibleEvent, BreachLogItem, NutrientBurstState, MacroTelemetry, StrainSummary } from "./types.ts";

/**
 * Build the unique dedupe key for each event.
 */
export function buildEventDedupeKey(event: CrucibleEvent, index: number): string {
  if (event.receipt_id) {
    return `${event.receipt_id}:${event.kind}:${index}`;
  }
  // Fallback when receipt_id is missing: a rough hash of the data
  const rawStr = JSON.stringify(event.raw ?? {});
  return `block_${event.block_height ?? 0}:${event.kind}:${index}:${rawStr}`;
}

/**
 * Resolve the actor of an event.
 * For `zone_changed`, which carries no direct actor:
 * look for another event in the set with the same `receipt_id`,
 * take its `strain_id`, then map it to the `owner_id` from the strains list.
 * When nothing is found, return "cause not recorded" (no guessing).
 */
export function resolveEventActor(
  targetEvent: CrucibleEvent,
  allEvents: CrucibleEvent[],
  strains: Map<number, string>,
): string {
  const raw = targetEvent.raw ?? {};

  // If the event carries an explicit actor
  if (typeof raw.actor === "string" && raw.actor.trim().length > 0) {
    return raw.actor;
  }
  if (typeof raw.liquidator === "string" && raw.liquidator.trim().length > 0) {
    return raw.liquidator;
  }
  if (typeof raw.owner_id === "string" && raw.owner_id.trim().length > 0) {
    return raw.owner_id;
  }
  if (typeof raw.adopter === "string" && raw.adopter.trim().length > 0) {
    return raw.adopter;
  }

  // If the event carries a direct strain_id
  if (typeof raw.strain_id === "number") {
    const owner = strains.get(raw.strain_id);
    if (owner) return `${owner} (strain #${raw.strain_id})`;
    return `strain #${raw.strain_id}`;
  }
  if (typeof raw.target_id === "number") {
    const owner = strains.get(raw.target_id);
    if (owner) return `${owner} (strain #${raw.target_id})`;
    return `strain #${raw.target_id}`;
  }

  // Correlate via receipt_id for zone_changed or events without a strain_id
  if (targetEvent.receipt_id) {
    const matching = allEvents.find(
      (ev) =>
        ev !== targetEvent &&
        ev.receipt_id === targetEvent.receipt_id &&
        (typeof ev.raw?.strain_id === "number" || typeof ev.raw?.target_id === "number"),
    );

    if (matching) {
      const strainId = (matching.raw?.strain_id ?? matching.raw?.target_id) as number;
      const owner = strains.get(strainId);
      if (owner) return `${owner} (strain #${strainId})`;
      return `strain #${strainId}`;
    }
  }

  return "cause not recorded";
}

/**
 * Format the event summary text for the threshold log.
 */
export function formatEventSummary(event: CrucibleEvent, actor: string): string {
  const raw = event.raw ?? {};
  switch (event.kind) {
    case "zone_changed": {
      const fromZone = String(raw.from_zone ?? "initial");
      const toZone = String(raw.to_zone ?? "new");
      const temp = raw.crucible_temp ?? 0;
      return `${actor} triggered a zone shift from ${fromZone} to ${toZone} (${temp} mK)`;
    }
    case "nutrient_burst_released": {
      const released = String(raw.released_vita ?? "0");
      const bps = Number(raw.burst_bps ?? 0);
      const untilEpoch = raw.until_epoch ?? 0;
      return `cell lysis released ${released} nutrients · discount -${(bps / 100).toFixed(2)}% until epoch ${untilEpoch}`;
    }
    case "strain_liquidated": {
      const targetId = raw.target_id ?? 0;
      return `cell #${targetId} lysed from starvation`;
    }
    case "fed": {
      const strainId = raw.strain_id ?? 0;
      return `cell #${strainId} was fed nutrients`;
    }
    default:
      return `${event.kind.replace(/_/g, " ")}`;
  }
}

export interface PollerCallbacks {
  onMacroUpdate: (macro: MacroTelemetry) => void;
  onNewEvents: (events: CrucibleEvent[]) => void;
  onBreachLogItem: (item: BreachLogItem) => void;
  onBurstStateChange: (burst: NutrientBurstState) => void;
  onStrainsUpdate?: (strains: StrainSummary[]) => void;
  onStrainFed?: (strainId: number) => void;
  onStrainLiquidated?: (strainId: number) => void;
}

export class TelemetryPoller {
  private timer: number | null = null;
  private isPolling = false;
  private seenKeys = new Set<string>();
  private strainsCache = new Map<number, string>();
  private lastTemp = 605;

  constructor(private callbacks: PollerCallbacks) {}

  public start(): void {
    if (this.timer) return;
    this.poll();
    this.timer = window.setInterval(() => {
      if (!document.hidden) {
        this.poll();
      }
    }, EVENT_POLL_INTERVAL_MS);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const [macro, eventsRes, strainsRes] = await Promise.all([
        fetchMacro(),
        fetchEvents(),
        fetchStrains(),
      ]);

      if (strainsRes?.strains) {
        for (const s of strainsRes.strains) {
          this.strainsCache.set(s.strain_id, s.owner_id);
        }
        this.callbacks.onStrainsUpdate?.(strainsRes.strains);
      }

      if (macro) {
        this.callbacks.onMacroUpdate(macro);
      }

      if (eventsRes?.events) {
        const receivedAt = Date.now();
        const newEvents: CrucibleEvent[] = [];

        eventsRes.events.forEach((ev, idx) => {
          const key = buildEventDedupeKey(ev, idx);
          if (!this.seenKeys.has(key)) {
            this.seenKeys.add(key);
            const enriched = { ...ev, received_at_ms: receivedAt };
            newEvents.push(enriched);

            // Latency SLA audit & threshold log
            if (ev.kind === "zone_changed" || ev.kind === "nutrient_burst_released" || ev.kind === "strain_liquidated") {
              const actor = resolveEventActor(ev, eventsRes.events, this.strainsCache);
              const summary = formatEventSummary(ev, actor);
              const renderedAt = Date.now();
              const latency = renderedAt - receivedAt;
              const currentTemp = (ev.raw?.crucible_temp as number | undefined) ?? macro?.crucibleTemp ?? this.lastTemp;
              const delta = currentTemp - this.lastTemp;
              this.lastTemp = currentTemp;

              const logItem: BreachLogItem = {
                id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                kind: ev.kind,
                actor,
                summary,
                crucibleTemp: currentTemp,
                tempDeltaMk: delta,
                timestampMs: receivedAt,
                renderedAtMs: renderedAt,
                latencyMs: latency,
                meetsSla: latency < SLA_LATENCY_MAX_MS,
              };

              this.callbacks.onBreachLogItem(logItem);

              if (ev.kind === "nutrient_burst_released") {
                const raw = ev.raw ?? {};
                this.callbacks.onBurstStateChange({
                  isActive: true,
                  activeBurstBps: Math.min(MAX_BURST_BPS, Number(raw.burst_bps ?? 0)),
                  untilEpoch: Number(raw.until_epoch ?? 1),
                  releasedVita: String(raw.released_vita ?? "0"),
                  triggeringStrainId: typeof raw.strain_id === "number" ? raw.strain_id : undefined,
                });
              }

              if (ev.kind === "strain_liquidated") {
                const raw = ev.raw ?? {};
                const targetId = typeof raw.target_id === "number" ? raw.target_id : undefined;
                if (targetId !== undefined) {
                  this.callbacks.onStrainLiquidated?.(targetId);
                }
              }
            }

            if (ev.kind === "fed") {
              const raw = ev.raw ?? {};
              const strainId = typeof raw.strain_id === "number" ? raw.strain_id : undefined;
              if (strainId !== undefined) {
                this.callbacks.onStrainFed?.(strainId);
              }
            }
          }
        });

        if (newEvents.length > 0) {
          this.callbacks.onNewEvents(newEvents);
        }
      }
    } finally {
      this.isPolling = false;
    }
  }
}
