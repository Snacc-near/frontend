/**
 * Konstanta permainan, parameter tampilan, dan kamus label dua skin (ADR-31).
 * Anti-slop: tanpa kartu dashboard, tanpa huruf kapital berlebih, tanpa teks pemasaran.
 */

export const MAX_DPR = 2;
export const TARGET_FPS = 60;

export const EVENT_POLL_INTERVAL_MS = 1000;
export const MACRO_POLL_INTERVAL_MS = 1000;
export const SLA_LATENCY_MAX_MS = 2000;

export const BURST_BASE_BPS = 2000; // 20,00%
export const BURST_CAP_BPS = 3000;  // 30,00%

export const VITALITY_MAX = 10000;
export const INITIAL_ATP = 50;

export type SkinMode = "biolab" | "fintech";

/**
 * Peta label ADR-31 (Bio-Lab vs FinTech Institutional).
 * Semua salinan berbahasa Indonesia sederhana dengan huruf kecil di awal.
 */
export const SKIN_LABELS: Record<SkinMode, Record<string, string>> = {
  biolab: {
    strain: "sel hidup",
    vitality: "vitalitas",
    atp: "energi atp",
    spores: "spora lentera",
    dish: "cawan petri",
    zone: "zona suhu",
    fever: "demam",
    goldilocks: "keseimbangan",
    hypothermia: "hipotermia",
    burst: "semburan nutrisi lisis",
    feedAction: "suntik makanan",
    feedDisabled: "transaksi on-chain di luar cakupan demo",
    optimisticPending: "menunggu konfirmasi...",
    optimisticReverted: "konfirmasi gagal, saldo dikembalikan",
    demoTag: "prototipe tampilan, data simulasi",
    unattributedReason: "penyebab tidak tercatat",
  },
  fintech: {
    strain: "anak perusahaan nft",
    vitality: "runway solvabilitas",
    atp: "energi internal atp",
    spores: "kupon katalis",
    dish: "reaktor likuiditas",
    zone: "status moneter",
    fever: "pembakaran kontra-siklus",
    goldilocks: "keseimbangan pasar",
    hypothermia: "stimulus rabat",
    burst: "diskon likuidasi",
    feedAction: "suntik likuiditas",
    feedDisabled: "transaksi on-chain di luar cakupan demo",
    optimisticPending: "menunggu konfirmasi...",
    optimisticReverted: "konfirmasi gagal, saldo dikembalikan",
    demoTag: "prototipe tampilan, data simulasi",
    unattributedReason: "penyebab tidak tercatat",
  },
};
