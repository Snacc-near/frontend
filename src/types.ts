/**
 * Snacc M6 Biolab 3D Console — Model Data & Kamus Angka Resmi (§13a).
 * Mematuhi aturan kejujuran: angka diambil persis dari state kontrak & Kamus Angka.
 */

export const KAMUS_ANGKA = {
  HYPOTHERMIA_THRESHOLD_MK: 600,
  FEVER_THRESHOLD_MK: 610, // ECON-111: Superseded 1400 -> 610 mK agar termostat aktif
  FEVER_BURN_BPS: 350, // I-01: 3.50% fee burn saat Fever (>610 mK)
  HYPO_REBATE_BPS: 200, // I-04: 2.00% rebate subsidi saat Hypothermia (<600 mK)
  MAX_EPOCH_TREASURY_DRAIN_BPS: 500, // I-04: Plafon 5.00% treasury per epoch
  BASE_BURST_BPS: 200, // EN-102: base burst 2.00% (contract BASE_BURST_BPS)
  MAX_BURST_BPS: 2000, // EN-102: burst cap 20.00% (contract MAX_BURST_BPS)
  VOLUME_SCALE: 5, // §13a: Skala volume termostat
  MAX_COLONY_SIZE: 5, // EN-124: Pagar populasi koloni
  MAX_GENERATION: 8, // EN-124: Pagar generasi
  VITALITY_INITIAL: 8500, // F1: Vitalitas awal inkubasi
  VITALITY_MAX: 10000,
  ORGANELLE_BONUS_BPS_PER_LEVEL: 1000, // EN-119: +10% per level (Mitokondria ATP, Nukleus output, Lisosom -BMR)
  RENDER_LATENCY_SLA_MS: 2000, // DoD UI-117..119: Event tampil < 2 detik
} as const;

export type MacroZone = "Hypothermia" | "Goldilocks" | "Fever";
export type SkinMode = "biolab" | "fintech";
export type RenderMode = "3d" | "2d-fallback";

export interface OrganelleAllocation {
  mitokondria: number; // +10% ATP/level
  nukleus: number; // +10% enzyme/elixir output/level
  lisosom: number; // -10% BMR decay/level
}

export interface StrainTelemetry {
  strainId: number;
  ownerId: string;
  vaultSubaccount: string;
  vitality: number;
  effectiveVitality: number;
  efficiencyBps: number;
  bmrPerHour: number;
  roleMask: number;
  generation: number;
  atpBalance: number;
  snaccBalanceFormatted: string;
  status: "Active" | "Distressed" | "Liquidated" | "SplicedBurned";
  organel: OrganelleAllocation;
}

export interface NutrientBurstState {
  isActive: boolean;
  activeBurstBps: number; // 0 atau 2000..3000
  untilEpoch: number;
  releasedVita: number;
  triggeringStrainId: number | null;
  lastUpdatedMs: number;
}

export interface MacroTelemetryState {
  crucibleTemp: number; // miliKelvin (mK)
  zone: MacroZone;
  currentEpoch: number;
  totalSnaccSupply: string;
  totalSnaccBurned: string;
  ruleBoundTreasury: string;
  epochVolume: string;
  feastTargetVolume: string;
  contractId: string;
  blockHeight: number;
}

export type BreachEventKind =
  | "zone_changed"
  | "nutrient_burst_released"
  | "strain_liquidated"
  | "feast_result";

export interface ThresholdBreachEvent {
  id: string;
  kind: BreachEventKind;
  actor: string;
  strainId?: number;
  epoch: number;
  fromZone?: MacroZone;
  toZone?: MacroZone;
  crucibleTemp: number;
  tempDeltaMk: number;
  burstBps?: number;
  releasedVita?: number;
  untilEpoch?: number;
  summary: string;
  emittedAtMs: number;
  renderedAtMs: number;
  txHash?: string;
}

/**
 * Klasifikasi zona suhu CrucibleTemp sesuai Kamus Angka & ECON-111.
 */
export function classifyZone(crucibleTemp: number): MacroZone {
  if (crucibleTemp > KAMUS_ANGKA.FEVER_THRESHOLD_MK) return "Fever";
  if (crucibleTemp < KAMUS_ANGKA.HYPOTHERMIA_THRESHOLD_MK) return "Hypothermia";
  return "Goldilocks";
}

/**
 * Hitung diskon Nutrient Burst aktif (bps) sesuai EN-102:
 * If currentEpoch < untilEpoch, the discount is active at clamp(burstBps, 0, MAX_BURST_BPS).
 * When currentEpoch >= untilEpoch, the burst expires automatically (0 bps).
 */
export function computeActiveBurstBps(
  burstBps: number,
  untilEpoch: number,
  currentEpoch: number,
): number {
  if (burstBps <= 0 || currentEpoch >= untilEpoch) return 0;
  return Math.min(burstBps, KAMUS_ANGKA.MAX_BURST_BPS);
}

/**
 * Hitung sisa epoch aktif untuk Nutrient Burst.
 */
export function computeBurstEpochsRemaining(untilEpoch: number, currentEpoch: number): number {
  return Math.max(0, untilEpoch - currentEpoch);
}

/**
 * Format basis points ke persentase 2 desimal (misal 2000 -> "20.00%").
 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Hitung posisi jarum termometer dalam skala 0..1 untuk rentang visual 350..850 mK.
 */
export function computeThermalGaugeRatio(crucibleTemp: number): number {
  const minMk = 350;
  const maxMk = 850;
  const clamped = Math.min(Math.max(crucibleTemp, minMk), maxMk);
  return (clamped - minMk) / (maxMk - minMk);
}

/**
 * Deskripsi kebijakan moneter bank sentral untuk masing-masing mode skin (ADR-31).
 */
export function describeZonePolicy(
  zone: MacroZone,
  skin: SkinMode,
): {
  badgeLabel: string;
  headline: string;
  policyRule: string;
  rateLabel: string;
  invariantCode: string;
} {
  if (zone === "Fever") {
    return {
      badgeLabel: skin === "fintech" ? "DEFLATIONARY CONTRACTION" : "CALCINATION FEVER",
      headline:
        skin === "fintech"
          ? "Overheated Velocity — Automatic Supply Contraction"
          : "Pyrolytic Fever — Excess Spore Liquidity Vaporized",
      policyRule:
        skin === "fintech"
          ? `Protocol burns ${formatBps(KAMUS_ANGKA.FEVER_BURN_BPS)} of every catalyst fee permanently via ft_burn.`
          : `Crucible heat > ${KAMUS_ANGKA.FEVER_THRESHOLD_MK} mK incinerates ${formatBps(KAMUS_ANGKA.FEVER_BURN_BPS)} of all feeding & transmutation fees.`,
      rateLabel: `-${formatBps(KAMUS_ANGKA.FEVER_BURN_BPS)} SUPPLY BURN`,
      invariantCode: "I-01",
    };
  }

  if (zone === "Hypothermia") {
    return {
      badgeLabel: skin === "fintech" ? "LIQUIDITY STIMULUS" : "HYPOTHERMIC STASIS",
      headline:
        skin === "fintech"
          ? "Sub-Threshold Velocity — Rule-Bound Treasury Rebate"
          : "Cryo-Metabolic Slowdown — Catalyst Subsidy Active",
      policyRule:
        skin === "fintech"
          ? `Rule-Bound Treasury subsidizes ${formatBps(KAMUS_ANGKA.HYPO_REBATE_BPS)} of catalyst fees (capped at ${formatBps(KAMUS_ANGKA.MAX_EPOCH_TREASURY_DRAIN_BPS)}/epoch).`
          : `Crucible temp < ${KAMUS_ANGKA.HYPOTHERMIA_THRESHOLD_MK} mK releases ${formatBps(KAMUS_ANGKA.HYPO_REBATE_BPS)} enzyme rebate to prevent colony extinction.`,
      rateLabel: `+${formatBps(KAMUS_ANGKA.HYPO_REBATE_BPS)} TREASURY REBATE`,
      invariantCode: "I-04",
    };
  }

  return {
    badgeLabel: skin === "fintech" ? "MONETARY EQUILIBRIUM" : "GOLDILOCKS HOMEOSTASIS",
    headline:
      skin === "fintech"
        ? "Target Velocity Band — Zero Surcharge / Zero Subsidy"
        : "Homeostatic Balance — Optimal Cellular Division & Synthesis",
    policyRule:
      skin === "fintech"
        ? `Velocity inside ${KAMUS_ANGKA.HYPOTHERMIA_THRESHOLD_MK}–${KAMUS_ANGKA.FEVER_THRESHOLD_MK} mK band; 100% of non-burn fees route to Treasury & Industrial Dividend Pool.`
        : `Thermal equilibrium (${KAMUS_ANGKA.HYPOTHERMIA_THRESHOLD_MK}–${KAMUS_ANGKA.FEVER_THRESHOLD_MK} mK) sustains steady basal metabolic rate across all castes.`,
    rateLabel: "0.00% NEUTRAL BAND",
    invariantCode: "EN-105",
  };
}
