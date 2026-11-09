import { describe, it, expect } from "vitest";
import {
  HYPOTHERMIA_THRESHOLD_MK,
  FEVER_THRESHOLD_MK,
  classifyZone,
} from "../src/config/zones.ts";

describe("UI-118: Threshold Zona Termal (§13a & ECON-111)", () => {
  it("memiliki ambang batas tunggal Fever 610 mK dan Hypothermia 600 mK", () => {
    expect(HYPOTHERMIA_THRESHOLD_MK).toBe(600);
    expect(FEVER_THRESHOLD_MK).toBe(610);
  });

  it("mengklasifikasikan Hypothermia (<600 mK)", () => {
    expect(classifyZone(550)).toBe("Hypothermia");
    expect(classifyZone(599)).toBe("Hypothermia");
  });

  it("mengklasifikasikan Goldilocks (600..610 mK)", () => {
    expect(classifyZone(600)).toBe("Goldilocks");
    expect(classifyZone(605)).toBe("Goldilocks");
    expect(classifyZone(610)).toBe("Goldilocks");
  });

  it("mengklasifikasikan Fever (>610 mK)", () => {
    expect(classifyZone(611)).toBe("Fever");
    expect(classifyZone(632)).toBe("Fever");
    expect(classifyZone(700)).toBe("Fever");
  });
});
