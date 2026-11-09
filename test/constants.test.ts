import { describe, it, expect } from "vitest";
import {
  MAX_DPR,
  TARGET_FPS,
  BURST_BASE_BPS,
  BURST_CAP_BPS,
  SKIN_LABELS,
} from "../src/config/constants.ts";

describe("Konstanta Permainan & Dual-Skin ADR-31", () => {
  it("membatasi DPR maksimum ke 2 untuk performa baterai & GPU", () => {
    expect(MAX_DPR).toBe(2);
  });

  it("menargetkan 60 FPS untuk pergerakan sel organik yang mulus", () => {
    expect(TARGET_FPS).toBe(60);
  });

  it("memiliki batasan diskon Nutrient Burst 20% s.d. 30%", () => {
    expect(BURST_BASE_BPS).toBe(2000);
    expect(BURST_CAP_BPS).toBe(3000);
  });

  it("memiliki padanan istilah 1:1 antara Bio-Lab dan FinTech tanpa kata pemasaran", () => {
    const biolabKeys = Object.keys(SKIN_LABELS.biolab);
    const fintechKeys = Object.keys(SKIN_LABELS.fintech);

    expect(biolabKeys.sort()).toEqual(fintechKeys.sort());

    for (const k of biolabKeys) {
      expect(SKIN_LABELS.biolab[k]).toBeTruthy();
      expect(SKIN_LABELS.fintech[k]).toBeTruthy();
      // Seluruh salinan diawali huruf kecil
      expect(SKIN_LABELS.biolab[k]![0]).toBe(SKIN_LABELS.biolab[k]![0]?.toLowerCase());
      expect(SKIN_LABELS.fintech[k]![0]).toBe(SKIN_LABELS.fintech[k]![0]?.toLowerCase());
    }
  });
});
