/**
 * Game constants, display parameters, and the dual-skin label dictionary (ADR-31).
 * Anti-slop: no dashboard cards, no excessive capitalization, no marketing copy.
 */

export const MAX_DPR = 2;
export const TARGET_FPS = 60;

export const EVENT_POLL_INTERVAL_MS = 1000;
export const MACRO_POLL_INTERVAL_MS = 1000;
export const SLA_LATENCY_MAX_MS = 2000;

export const BASE_BURST_BPS = 200; // EN-102: base burst 2.00% (contract BASE_BURST_BPS)
export const MAX_BURST_BPS = 2000; // EN-102: burst cap 20.00% (contract MAX_BURST_BPS)

export const VITALITY_MAX = 10000;
export const INITIAL_ATP = 50;

export type SkinMode = "biolab" | "fintech";
export type GameMode = "demo" | "live";

/**
 * The ADR-31 label map (Bio-Lab vs FinTech Institutional).
 * All copy is plain English, starting lowercase.
 */
export const SKIN_LABELS: Record<SkinMode, Record<string, string>> = {
  biolab: {
    strain: "living cell",
    vitality: "vitality",
    atp: "atp energy",
    spores: "glowing spores",
    dish: "petri dish",
    zone: "temperature zone",
    fever: "fever",
    goldilocks: "balance",
    hypothermia: "hypothermia",
    burst: "lysis nutrient burst",
    feedAction: "inject nutrients",
    feedDisabled: "on-chain transactions are outside the demo scope",
    optimisticPending: "waiting for confirmation...",
    optimisticReverted: "confirmation failed, balance rolled back",
    demoTag: "display prototype, simulated data",
    unattributedReason: "cause not recorded",
  },
  fintech: {
    strain: "nft subsidiary",
    vitality: "solvency runway",
    atp: "internal atp energy",
    spores: "catalyst coupons",
    dish: "liquidity reactor",
    zone: "monetary status",
    fever: "counter-cyclical burn",
    goldilocks: "market balance",
    hypothermia: "stimulus rebate",
    burst: "liquidation discount",
    feedAction: "inject liquidity",
    feedDisabled: "on-chain transactions are outside the demo scope",
    optimisticPending: "waiting for confirmation...",
    optimisticReverted: "confirmation failed, balance rolled back",
    demoTag: "display prototype, simulated data",
    unattributedReason: "cause not recorded",
  },
};
