import { describe, it, expect } from "vitest";
import { formatLiveAtp, formatLiveVitality, NO_DATA_PLACEHOLDER } from "../src/data/liveView.ts";
import { formatAppetiteBigInt, formatAppetiteNumber, mapAppetite } from "../src/data/appetite.ts";

describe("live mode em dash placeholders", () => {
  it("renders an em dash when live vitality is missing", () => {
    expect(formatLiveVitality(null)).toBe(NO_DATA_PLACEHOLDER);
    expect(formatLiveVitality(undefined)).toBe(NO_DATA_PLACEHOLDER);
    expect(NO_DATA_PLACEHOLDER).toBe("—");
  });

  it("renders an em dash when live atp is missing or blank", () => {
    expect(formatLiveAtp(null)).toBe("—");
    expect(formatLiveAtp(undefined)).toBe("—");
    expect(formatLiveAtp("")).toBe("—");
    expect(formatLiveAtp("   ")).toBe("—");
  });

  it("keeps real live values formatted", () => {
    expect(formatLiveVitality(8500)).toBe("8,500");
    expect(formatLiveAtp("1234")).toBe("1,234");
  });

  it("maps missing appetite numbers to null so the UI can render an em dash", () => {
    const vm = mapAppetite({ zone: "Fever" });
    expect(vm?.crucibleTempMk).toBeNull();
    expect(formatAppetiteNumber(vm?.crucibleTempMk ?? null)).toBe("—");
  });

  it("renders an em dash for missing appetite big integers", () => {
    expect(formatAppetiteBigInt(null)).toBe("—");
    expect(formatAppetiteBigInt("1000")).toBe("1,000");
  });

  it("returns null appetite when no payload arrived", () => {
    expect(mapAppetite(null)).toBeNull();
    expect(mapAppetite(undefined)).toBeNull();
  });
});
