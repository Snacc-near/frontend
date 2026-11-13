/**
 * Pure helpers for the live parts of the landing page (ticker, live numbers, appetite gauge,
 * on-chain NFT media). Numbers come only from the API/chain or the official figures below.
 */
import { FEVER_THRESHOLD_MK, HYPOTHERMIA_THRESHOLD_MK, classifyZone } from "../../config/zones.ts";

/** Official figures (Kamus Angka Resmi): thermostat rates and the Cell Lysis split. */
export const OFFICIAL = {
  frenzyBurnPct: "3.5%",
  famineReliefPct: "2%",
  lysisBountyPct: "10%",
  lysisPantryPct: "90%",
  mergeTaxPct: "2.5%",
  famineBelowMk: HYPOTHERMIA_THRESHOLD_MK,
  frenzyAboveMk: FEVER_THRESHOLD_MK,
} as const;

export type ZoneKey = "famine" | "normal" | "frenzy";

export interface ZoneInfo {
  key: ZoneKey;
  label: string;
  rate: string;
}

const ZONES: Record<ZoneKey, ZoneInfo> = {
  famine: { key: "famine", label: "Famine Relief", rate: `${OFFICIAL.famineReliefPct} relief` },
  normal: { key: "normal", label: "Normal Appetite", rate: "no burn, no relief" },
  frenzy: { key: "frenzy", label: "Feeding Frenzy", rate: `${OFFICIAL.frenzyBurnPct} burn` },
};

/** Product-language zone for a CrucibleTemp reading (mK). */
export function zoneFromTemp(mK: number): ZoneInfo {
  const z = classifyZone(mK);
  return z === "Fever" ? ZONES.frenzy : z === "Hypothermia" ? ZONES.famine : ZONES.normal;
}

/** Product-language zone for a zone string from the API ("Fever", "FEVER", "HYPO", "Goldilocks", ...). */
export function zoneFromApi(zone: string | null | undefined): ZoneInfo | null {
  const z = (zone ?? "").toLowerCase();
  if (z.startsWith("fever") || z.includes("frenzy")) return ZONES.frenzy;
  if (z.startsWith("hypo") || z.includes("famine")) return ZONES.famine;
  if (z.startsWith("gold") || z.startsWith("normal")) return ZONES.normal;
  return null;
}

/**
 * Appetite gauge: piecewise scale so the narrow Normal band stays visible.
 * 0..600 mK -> 0..0.45, 600..610 mK -> 0.45..0.55, 610..GAUGE_MAX -> 0.55..1.
 */
export const GAUGE_MAX_MK = 1400;
const G_LO = 0.45;
const G_HI = 0.55;

export function tempToGauge(mK: number): number {
  const lo = OFFICIAL.famineBelowMk;
  const hi = OFFICIAL.frenzyAboveMk;
  const t = Math.max(0, Math.min(GAUGE_MAX_MK, mK));
  if (t < lo) return (t / lo) * G_LO;
  if (t <= hi) return G_LO + ((t - lo) / (hi - lo)) * (G_HI - G_LO);
  return G_HI + ((t - hi) / (GAUGE_MAX_MK - hi)) * (1 - G_HI);
}

export function gaugeToTemp(g: number): number {
  const lo = OFFICIAL.famineBelowMk;
  const hi = OFFICIAL.frenzyAboveMk;
  const x = Math.max(0, Math.min(1, g));
  if (x < G_LO) return (x / G_LO) * lo;
  if (x <= G_HI) return lo + ((x - G_LO) / (G_HI - G_LO)) * (hi - lo);
  return hi + ((x - G_HI) / (1 - G_HI)) * (GAUGE_MAX_MK - hi);
}

/** Format a u128 token amount string (24 decimals for $SNACC) without float loss. */
export function formatToken(raw: string | null | undefined, decimals = 24, maxFrac = 4): string {
  if (raw == null || !/^\d+$/.test(raw)) return "—";
  const v = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  if (whole === 0n && frac === 0n) return "0";
  let fracStr = frac.toString().padStart(decimals, "0");
  if (whole === 0n) {
    // keep `maxFrac` significant digits for small amounts
    const lead = fracStr.search(/[1-9]/);
    fracStr = fracStr.slice(0, Math.min(decimals, lead + maxFrac));
  } else {
    fracStr = fracStr.slice(0, maxFrac);
  }
  fracStr = fracStr.replace(/0+$/, "");
  const wholeStr = whole.toLocaleString("en-US");
  return fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
}

/** Same amount as a float (display/animation only, never for accounting). */
export function tokenToNumber(raw: string | null | undefined, decimals = 24): number | null {
  if (raw == null || !/^\d+$/.test(raw)) return null;
  const s = raw.padStart(decimals + 1, "0");
  return Number(`${s.slice(0, s.length - decimals)}.${s.slice(s.length - decimals, s.length - decimals + 12)}`);
}

export function shortHash(h: string | null | undefined, head = 4, tail = 4): string {
  if (!h) return "—";
  return h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function countAlive(strains: ReadonlyArray<{ status?: string }> | null | undefined): number | null {
  if (!strains) return null;
  return strains.filter((s) => (s.status ?? "").toLowerCase() === "alive").length;
}

export interface EventLike {
  kind: string;
  block_height?: number;
  receipt_id?: string;
}

/** Most recent event by block height (the API returns them unsorted in places). */
export function latestEvent<T extends EventLike>(events: readonly T[] | null | undefined): T | null {
  if (!events || events.length === 0) return null;
  let best = events[0]!;
  for (const e of events) if ((e.block_height ?? -1) >= (best.block_height ?? -1)) best = e;
  return best;
}

export function eventLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

const NFT_PREFIX = "data:image/svg+xml;base64,";

/**
 * Accept only on-chain base64 SVG media and check that it really decodes to an `<svg>` document.
 * Returned as a data URI for an `<img>` (scripts never run inside an image), else null.
 */
export function safeNftMediaSrc(media: string | null | undefined): string | null {
  if (!media || !media.startsWith(NFT_PREFIX) || media.length > 200_000) return null;
  const body = media.slice(NFT_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+=*$/.test(body)) return null;
  try {
    const text = atob(body);
    return /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(text) ? media : null;
  } catch {
    return null;
  }
}

/**
 * Header chip of the Live section. "live" is claimed only while the backend actually answers;
 * while it is still being read the chip says so, and when it did not answer it says "offline".
 */
export function liveChipText(status: "loading" | "live" | "offline", contractId: string): string {
  const lead = status === "live" ? "live" : status === "loading" ? "connecting…" : "offline";
  return `${lead} · NEAR testnet · ${contractId}`;
}

/** Count-up easing for the live numbers (ease-out). */
export function countUp(from: number, to: number, t: number): number {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
  return from + (to - from) * k;
}
