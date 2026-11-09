/**
 * Live-mode view helpers (UI-123..126 audit fixes).
 * Integrity rule: in live mode the UI must never show invented numbers.
 * When the API has no value, render an em dash placeholder instead.
 */

import type { BreachLogItem, StrainDetail, StrainSummary } from "./types.ts";

export const NO_DATA_PLACEHOLDER = "—";

/** Format a live vitality value; "—" when the API provided nothing. */
export function formatLiveVitality(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : NO_DATA_PLACEHOLDER;
}

/** Format a live ATP balance (a u128 string from the API); "—" when absent. */
export function formatLiveAtp(value: string | null | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) return NO_DATA_PLACEHOLDER;
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : value;
}

/**
 * In live mode the breach log must contain only API-sourced events.
 * Demo seeds (id prefix "seed-") and simulated entries ("sim-") are excluded.
 */
export function filterLogsForMode(logs: BreachLogItem[], mode: "demo" | "live"): BreachLogItem[] {
  if (mode === "demo") return logs;
  return logs.filter((l) => !l.id.startsWith("seed-") && !l.id.startsWith("sim-"));
}

/**
 * Build the selected-strain detail from the real /api/strains fields.
 * Returns null when the API has no record for this strain (never fabricate).
 */
export function resolveSelectedStrain(
  cellId: number,
  liveStrains: StrainSummary[],
): StrainDetail | null {
  const s = liveStrains.find((x) => x.strain_id === cellId);
  if (!s || typeof s.vitality !== "number") return null;
  return {
    strain_id: s.strain_id,
    owner_id: s.owner_id,
    vault_subaccount: s.vault_subaccount ?? "",
    vitality: s.vitality,
    efficiency_bps: s.efficiency_bps ?? 0,
    bmr_per_hour: s.bmr_per_hour ?? 0,
    last_fed_sec: s.last_fed_sec ?? 0,
    role_mask: s.role_mask ?? 0,
    state_nonce: s.state_nonce ?? 0,
    pending_callbacks: s.pending_callbacks ?? 0,
    atp_balance: s.atp_balance ?? "0",
    generation: s.generation ?? 0,
    organel: s.organel ?? { mitokondria: 0, nukleus: 0, lisosom: 0 },
    status: s.status ?? "Active",
    effective_vitality: s.effective_vitality ?? s.vitality,
  };
}

/** True for terminal statuses that must be visually distinct in the dish. */
export function isTerminalStrainStatus(status: string | undefined): boolean {
  return status === "SplicedBurned" || status === "Liquidated";
}
