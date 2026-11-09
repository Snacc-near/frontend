import { describe, it, expect } from "vitest";
import {
  HYPOTHERMIA_THRESHOLD_MK,
  FEVER_THRESHOLD_MK,
  classifyZone,
} from "../src/config/zones.ts";

describe("UI-118: Thermal Zone Thresholds (§13a & ECON-111)", () => {
  it("has a single Fever threshold of 610 mK and a Hypothermia threshold of 600 mK", () => {
    expect(HYPOTHERMIA_THRESHOLD_MK).toBe(600);
    expect(FEVER_THRESHOLD_MK).toBe(610);
  });

  it("classifies Hypothermia (<600 mK)", () => {
    expect(classifyZone(550)).toBe("Hypothermia");
    expect(classifyZone(599)).toBe("Hypothermia");
  });

  it("classifies Goldilocks (600..610 mK)", () => {
    expect(classifyZone(600)).toBe("Goldilocks");
    expect(classifyZone(605)).toBe("Goldilocks");
    expect(classifyZone(610)).toBe("Goldilocks");
  });

  it("classifies Fever (>610 mK)", () => {
    expect(classifyZone(611)).toBe("Fever");
    expect(classifyZone(632)).toBe("Fever");
    expect(classifyZone(700)).toBe("Fever");
  });
});
