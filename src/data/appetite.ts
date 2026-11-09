/**
 * Appetite meter mapping (UI-120..122).
 * Field names are copied verbatim from `GET /api/appetite`.
 * The mapper never invents values: missing numbers stay `null` so the UI
 * can render the "—" placeholder.
 */

import type { AppetiteTelemetry, AppetiteViewModel } from "./types.ts";

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asBigIntString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function mapAppetite(
  raw: AppetiteTelemetry | null | undefined,
): AppetiteViewModel | null {
  if (!raw || typeof raw !== "object") return null;
  const zone = asString(raw.zone) ?? "—";
  const crucibleTempMk = asNumber(raw.crucible_temp);
  const currentEpoch = asNumber(raw.current_epoch);
  const burstBps = asNumber(raw.burst_bps);
  const burstUntil = asNumber(raw.burst_until);
  const burstEpochsLeft = asNumber(raw.burst_epochs_left);
  const dormant = typeof raw.dormant === "boolean" ? raw.dormant : null;
  const feastVolume = asBigIntString(raw.feast_volume);
  const feastTarget = asBigIntString(raw.feast_target);
  const riskHeat = asNumber(raw.risk_heat);

  let feastProgressPct: number | null = null;
  if (feastVolume !== null && feastTarget !== null) {
    try {
      const vol = BigInt(feastVolume);
      const target = BigInt(feastTarget);
      if (target > 0n) {
        feastProgressPct = Math.min(
          100,
          Math.max(0, Number((vol * 10000n) / target) / 100),
        );
      }
    } catch {
      feastProgressPct = null;
    }
  }

  const riskHeatPct =
    riskHeat !== null ? Math.min(100, Math.max(0, riskHeat / 100)) : null;

  const topFeeders = Array.isArray(raw.top_feeders)
    ? raw.top_feeders
        .filter(
          (f): f is { account_id: string; amount: string } =>
            f !== null &&
            typeof f === "object" &&
            typeof f.account_id === "string" &&
            (typeof f.amount === "string" || typeof f.amount === "number"),
        )
        .map((f) => ({
          account_id: f.account_id,
          amount: String(f.amount),
        }))
        .slice(0, 3)
    : [];

  return {
    zone,
    crucibleTempMk,
    currentEpoch,
    burstBps,
    burstUntil,
    burstEpochsLeft,
    dormant,
    feastVolume,
    feastTarget,
    riskHeat,
    feastProgressPct,
    riskHeatPct,
    topFeeders,
    contractId: asString(raw.contractId),
    blockHeight: asNumber(raw.blockHeight),
  };
}

export function formatAppetiteNumber(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

export function formatAppetiteBigInt(value: string | null): string {
  if (value === null) return "—";
  try {
    return BigInt(value).toLocaleString("en-US");
  } catch {
    return value;
  }
}
