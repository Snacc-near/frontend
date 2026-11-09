/**
 * Poller data on-chain dan pemroses event log (UI-117..119).
 * Polling ≤ 1000 ms, deduplikasi event, korelasi receipt_id, dan audit SLA < 2 dtk.
 */

import { EVENT_POLL_INTERVAL_MS, SLA_LATENCY_MAX_MS, BURST_BASE_BPS, BURST_CAP_BPS } from "../config/constants.ts";
import { fetchEvents, fetchMacro, fetchStrains } from "./api.ts";
import type { CrucibleEvent, BreachLogItem, NutrientBurstState, MacroTelemetry, StrainSummary } from "./types.ts";

/**
 * Menghasilkan kunci unik deduplikasi untuk setiap event.
 */
export function buildEventDedupeKey(event: CrucibleEvent, index: number): string {
  if (event.receipt_id) {
    return `${event.receipt_id}:${event.kind}:${index}`;
  }
  // Fallback bila receipt_id tidak ada: hash kasar dari data
  const rawStr = JSON.stringify(event.raw ?? {});
  return `block_${event.block_height ?? 0}:${event.kind}:${index}:${rawStr}`;
}

/**
 * Mencari pelaku (actor) dari event.
 * Untuk `zone_changed` yang tidak memuat pelaku langsung:
 * Cari event lain dalam kumpulan event yang memiliki `receipt_id` yang sama,
 * ambil `strain_id`, lalu petakan ke `owner_id` dari daftar strains.
 * Jika tidak ditemukan, kembalikan "penyebab tidak tercatat" (tanpa menebak).
 */
export function resolveEventActor(
  targetEvent: CrucibleEvent,
  allEvents: CrucibleEvent[],
  strains: Map<number, string>,
): string {
  const raw = targetEvent.raw ?? {};

  // Jika event memiliki pelaku eksplisit
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

  // Jika ada strain_id langsung pada event
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

  // Korelasi via receipt_id untuk zone_changed atau event tanpa strain_id
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

  return "penyebab tidak tercatat";
}

/**
 * Memformat ringkasan teks event untuk log ambang.
 */
export function formatEventSummary(event: CrucibleEvent, actor: string): string {
  const raw = event.raw ?? {};
  switch (event.kind) {
    case "zone_changed": {
      const fromZone = String(raw.from_zone ?? "awal");
      const toZone = String(raw.to_zone ?? "baru");
      const temp = raw.crucible_temp ?? 0;
      return `${actor} memicu pergeseran zona dari ${fromZone} ke ${toZone} (${temp} mK)`;
    }
    case "nutrient_burst_released": {
      const released = String(raw.released_vita ?? "0");
      const bps = Number(raw.burst_bps ?? BURST_BASE_BPS);
      const untilEpoch = raw.until_epoch ?? 0;
      return `lisis sel melepas ${released} nutrisi · diskon -${(bps / 100).toFixed(2)}% sampai epoch ${untilEpoch}`;
    }
    case "strain_liquidated": {
      const targetId = raw.target_id ?? 0;
      return `sel #${targetId} dilisis karena kelaparan`;
    }
    case "fed": {
      const strainId = raw.strain_id ?? 0;
      return `sel #${strainId} diberi makan nutrisi`;
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

            // Audit SLA latensi & log ambang
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
                  activeBurstBps: Math.min(BURST_CAP_BPS, Number(raw.burst_bps ?? BURST_BASE_BPS)),
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
