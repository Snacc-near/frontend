/**
 * Konfigurasi ambang suhu zona cawan reaktor (ECON-111 & Backlog §13a).
 * Sesuai aturan: SATU-SATUNYA file yang memuat konstanta ambang zona untuk alat ukur.
 * Zona aktif saat live tetap bersumber dari API / kontrak on-chain.
 */

export const HYPOTHERMIA_THRESHOLD_MK = 600;
export const FEVER_THRESHOLD_MK = 610;

export type MacroZone = "Hypothermia" | "Goldilocks" | "Fever";

/**
 * Mengklasifikasikan suhu mK ke dalam zona metabolisme:
 * - Hypothermia: < 600 mK (stimulus rabat 2,00%)
 * - Goldilocks: 600 .. 610 mK (keseimbangan netral)
 * - Fever: > 610 mK (pembakaran suplai 3,50%)
 */
export function classifyZone(crucibleTempMk: number): MacroZone {
  if (crucibleTempMk > FEVER_THRESHOLD_MK) return "Fever";
  if (crucibleTempMk < HYPOTHERMIA_THRESHOLD_MK) return "Hypothermia";
  return "Goldilocks";
}

/**
 * Palet warna pendaran cawan dan sel sesuai zona aktif.
 */
export const ZONE_THEMES = {
  Hypothermia: {
    color: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.45)",
    dishGlow: "rgba(6, 182, 212, 0.22)",
    label: "hipotermia",
    description: "pendinginan metabolisme · rabat katalis +2,00%",
  },
  Goldilocks: {
    color: "#10b981",
    glow: "rgba(16, 185, 129, 0.45)",
    dishGlow: "rgba(16, 185, 129, 0.22)",
    label: "goldilocks",
    description: "keseimbangan homeostatis · bebas pajak pembakaran",
  },
  Fever: {
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.5)",
    dishGlow: "rgba(249, 115, 22, 0.26)",
    label: "demam",
    description: "pembakaran suplai reaktif · burn -3,50%",
  },
} as const;
