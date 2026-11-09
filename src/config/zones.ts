/**
 * The reactor dish temperature-zone threshold configuration (ECON-111 & Backlog §13a).
 * Per the rules: this is the ONLY file holding the zone threshold constants for the gauge.
 * The live zone still comes from the API / on-chain contract.
 */

export const HYPOTHERMIA_THRESHOLD_MK = 600;
export const FEVER_THRESHOLD_MK = 610;

export type MacroZone = "Hypothermia" | "Goldilocks" | "Fever";

/**
 * Classify a mK temperature into the metabolic zone:
 * - Hypothermia: < 600 mK (the 2.00% stimulus rebate)
 * - Goldilocks: 600 .. 610 mK (neutral balance)
 * - Fever: > 610 mK (the 3.50% supply burn)
 */
export function classifyZone(crucibleTempMk: number): MacroZone {
  if (crucibleTempMk > FEVER_THRESHOLD_MK) return "Fever";
  if (crucibleTempMk < HYPOTHERMIA_THRESHOLD_MK) return "Hypothermia";
  return "Goldilocks";
}

/**
 * The dish and cell glow palette per active zone.
 */
export const ZONE_THEMES = {
  Hypothermia: {
    color: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.45)",
    dishGlow: "rgba(6, 182, 212, 0.22)",
    label: "hypothermia",
    description: "metabolic cooling · catalyst rebate +2.00%",
  },
  Goldilocks: {
    color: "#10b981",
    glow: "rgba(16, 185, 129, 0.45)",
    dishGlow: "rgba(16, 185, 129, 0.22)",
    label: "goldilocks",
    description: "homeostatic balance · no burn fee",
  },
  Fever: {
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.5)",
    dishGlow: "rgba(249, 115, 22, 0.26)",
    label: "fever",
    description: "reactive supply burn · burn -3.50%",
  },
} as const;
