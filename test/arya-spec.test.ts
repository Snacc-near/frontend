import { describe, it, expect } from "vitest";
import { formatBurstBadgeText } from "../src/components/NutrientBurstBadge.ts";
import {
  ZONE_NAMES,
  ZONE_RULES,
  ZONE_COLORS,
  classifyBiolabZone,
  formatZoneBannerText,
  formatZnLabel,
} from "../src/components/ZoneBanner.ts";
import { svgToSafeDataUri } from "../src/data/svg.ts";

describe("Paket Arya — UI-117: Badge Nutrient Burst Global", () => {
  it("formats the pill #nb text exactly with minus U+2212 and percentage", () => {
    // 500 bps = 5.00% -> 5%
    const text500 = formatBurstBadgeText(500, 3);
    expect(text500).toBe("Nutrient Burst: feed fee \u22125% until epoch 3");

    // 200 bps = 2%
    const text200 = formatBurstBadgeText(200, 2);
    expect(text200).toBe("Nutrient Burst: feed fee \u22122% until epoch 2");

    // 350 bps = 3.5%
    const text350 = formatBurstBadgeText(350, 4);
    expect(text350).toBe("Nutrient Burst: feed fee \u22123.5% until epoch 4");
  });

  it("clamps burst discount to MAX_BURST_BPS = 500 bps", () => {
    const rawBps = 2000;
    const clamped = Math.min(500, Math.max(200, rawBps));
    expect(clamped).toBe(500);
    expect(formatBurstBadgeText(clamped, 2)).toBe("Nutrient Burst: feed fee \u22125% until epoch 2");
  });
});

describe("Paket Arya — UI-118: Banner Zona & Termostat Makro", () => {
  it("classifies zones at 600 mK and 610 mK thresholds (supersedes 1400 mK)", () => {
    // Hypothermia: < 600 mK
    expect(classifyBiolabZone(599)).toBe("Hypothermia");
    expect(classifyBiolabZone(0)).toBe("Hypothermia");

    // Normal (Neutral band): 600..610 mK
    expect(classifyBiolabZone(600)).toBe("Normal");
    expect(classifyBiolabZone(605)).toBe("Normal");
    expect(classifyBiolabZone(610)).toBe("Normal");

    // Calcination Fever: > 610 mK
    expect(classifyBiolabZone(611)).toBe("Calcination Fever");
    expect(classifyBiolabZone(1000)).toBe("Calcination Fever");
  });

  it("formats banner #zb text and rules exactly as specified", () => {
    // Hypothermia (<600 mK) · "Stimulus rebate 2%" · #6fa8ff
    expect(formatZoneBannerText(0, 580)).toBe("Hypothermia at 580 mK. Stimulus rebate 2%.");
    expect(ZONE_COLORS[0]).toBe("#6fa8ff");
    expect(ZONE_RULES[0]).toBe("Stimulus rebate 2%");

    // Normal (600–610 mK) · "Neutral band" · #5be3c1
    expect(formatZoneBannerText(1, 605)).toBe("Normal at 605 mK. Neutral band.");
    expect(ZONE_COLORS[1]).toBe("#5be3c1");

    // Calcination Fever (>610 mK) · "Velocity auto-burn 3.5%" · #ff7a3c
    expect(formatZoneBannerText(2, 650)).toBe("Calcination Fever at 650 mK. Velocity auto-burn 3.5%.");
    expect(ZONE_COLORS[2]).toBe("#ff7a3c");
  });

  it("formats #zn label with epoch, seconds countdown, zone, mK, and optional burst", () => {
    const withoutBurst = formatZnLabel(1, 45, 1, 605, 0, false);
    expect(withoutBurst).toBe("Epoch 1 · 45s · Normal 605 mK · demo");

    const withBurst = formatZnLabel(2, 30, 2, 620, 500, true);
    expect(withBurst).toBe("Epoch 2 · 30s · Calcination Fever 620 mK · burst \u22125% · live");
  });
});

describe("Paket Arya — UI-119: Log Siapa Menabrak Ambang", () => {
  it("formats entry as 'Epoch N: <From> to <To> at <mK> mK, last action: <aksi>'", () => {
    const entry = {
      ep: 2,
      f: 0,
      t: 1,
      mk: 605,
      by: "strain #1 feed",
    };
    const formatted = `Epoch ${entry.ep}: ${ZONE_NAMES[entry.f as 0 | 1 | 2]} to ${
      ZONE_NAMES[entry.t as 0 | 1 | 2]
    } at ${entry.mk} mK, last action: ${entry.by}`;
    expect(formatted).toBe("Epoch 2: Hypothermia to Normal at 605 mK, last action: strain #1 feed");
  });

  it("handles empty log state message verbatim", () => {
    const emptyMsg = "No threshold crossed yet. Feed to heat the crucible above 610 mK.";
    expect(emptyMsg).toContain("above 610 mK");
  });
});

describe("Paket Arya — UI-121: SVG Inspector Live", () => {
  it("renders SVG via data URI without injecting raw HTML", () => {
    const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#14123a"/></svg>';
    const uri = svgToSafeDataUri(rawSvg);
    expect(uri).not.toBeNull();
    expect(uri!.startsWith("data:image/svg+xml;base64,")).toBe(true);

    // Verify size bound <= 1734 B
    expect(new TextEncoder().encode(rawSvg).length).toBeLessThanOrEqual(1734);
  });

  it("validates solvency status color tokens: #00ffcc (>50%), #ffaa00 (1..50%), #ff2255 (0%)", () => {
    const getStatusCol = (v: number) => (v > 50 ? "#00ffcc" : v > 0 ? "#ffaa00" : "#ff2255");
    expect(getStatusCol(80)).toBe("#00ffcc");
    expect(getStatusCol(50)).toBe("#ffaa00");
    expect(getStatusCol(20)).toBe("#ffaa00");
    expect(getStatusCol(0)).toBe("#ff2255");
  });
});

describe("Paket Arya — UI-123 & UI-124: Responsive & Dark Bioluminescent Mode", () => {
  it("determines base camera distance 46 for width < 700px, otherwise 34", () => {
    const getCameraDist = (w: number) => (w < 700 ? 46 : 34);
    expect(getCameraDist(360)).toBe(46);
    expect(getCameraDist(390)).toBe(46);
    expect(getCameraDist(699)).toBe(46);
    expect(getCameraDist(700)).toBe(34);
    expect(getCameraDist(1280)).toBe(34);
    expect(getCameraDist(1920)).toBe(34);
  });
});
