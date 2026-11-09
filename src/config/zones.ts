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
    color: "#2b7a8c",
    glow: "rgba(43, 122, 140, 0.4)",
    dishGlow: "rgba(43, 122, 140, 0.2)",
    label: "hypothermia",
    description: "metabolic cooling · catalyst rebate +2.00%",
  },
  Goldilocks: {
    color: "#b87800",
    glow: "rgba(184, 120, 0, 0.4)",
    dishGlow: "rgba(248, 170, 6, 0.2)",
    label: "goldilocks",
    description: "homeostatic balance · no burn fee",
  },
  Fever: {
    color: "#b3402e",
    glow: "rgba(179, 64, 46, 0.45)",
    dishGlow: "rgba(179, 64, 46, 0.22)",
    label: "fever",
    description: "reactive supply burn · burn -3.50%",
  },
} as const;
