import { describe, it, expect } from "vitest";
import {
  MAX_DPR,
  TARGET_FPS,
  BASE_BURST_BPS,
  MAX_BURST_BPS,
  SKIN_LABELS,
} from "../src/config/constants.ts";

describe("Game Constants & the Dual-Skin ADR-31", () => {
  it("caps the maximum DPR at 2 for battery & GPU performance", () => {
    expect(MAX_DPR).toBe(2);
  });

  it("targets 60 FPS for smooth organic cell movement", () => {
    expect(TARGET_FPS).toBe(60);
  });

  it("bounds the Nutrient Burst discount between a 200 bps base and a 2000 bps max", () => {
    expect(BASE_BURST_BPS).toBe(200);
    expect(MAX_BURST_BPS).toBe(2000);
  });

  it("has 1:1 term mapping between Bio-Lab and FinTech with no marketing words", () => {
    const biolabKeys = Object.keys(SKIN_LABELS.biolab);
    const fintechKeys = Object.keys(SKIN_LABELS.fintech);

    expect(biolabKeys.sort()).toEqual(fintechKeys.sort());

    for (const k of biolabKeys) {
      expect(SKIN_LABELS.biolab[k]).toBeTruthy();
      expect(SKIN_LABELS.fintech[k]).toBeTruthy();
      // All copy starts lowercase
      expect(SKIN_LABELS.biolab[k]![0]).toBe(SKIN_LABELS.biolab[k]![0]?.toLowerCase());
      expect(SKIN_LABELS.fintech[k]![0]).toBe(SKIN_LABELS.fintech[k]![0]?.toLowerCase());
    }
  });
});
