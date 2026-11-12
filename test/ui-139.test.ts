import { describe, it, expect } from "vitest";
import { FOOTER_COLUMNS, FOOTER_DISCLAIMER } from "../src/landing/SiteFooter.tsx";
import { SECTION_IDS } from "../src/landing/sections.ts";
import { frameFor } from "../src/landing/story.ts";

describe("UI-139 footer", () => {
  it("has the four link columns in order", () => {
    expect(FOOTER_COLUMNS.map((c) => c.title)).toEqual(["Product", "Build", "Proof", "NEAR"]);
  });

  it("links only to the app, real page sections, Snacc-near repos, the testnet contract or NEAR", () => {
    const pageIds = new Set([...SECTION_IDS, "faq"]);
    for (const col of FOOTER_COLUMNS) {
      for (const l of col.links) {
        if (l.href.startsWith("#")) expect(pageIds.has(l.href.slice(1))).toBe(true);
        else if (l.href.startsWith("/")) expect(l.href).toBe("/app");
        else
          expect(l.href).toMatch(
            /^https:\/\/(github\.com\/Snacc-near(\/(contracts|oracle-tee|sdk|backend|frontend|scripts))?$|testnet\.nearblocks\.io(\/address\/snacc-v001\.testnet)?$|docs\.near\.org$|github\.com\/near\/NEPs\/blob\/master\/neps\/nep-0(171|245)\.md$)/,
          );
      }
    }
  });

  it("carries the honest one-line disclaimer", () => {
    expect(FOOTER_DISCLAIMER).toBe("Testnet only. $SNACC has no monetary value. Not financial advice.");
  });
});

describe("UI-139 hero frame", () => {
  it("keeps the machine right of the headline column and above the ticker strip", () => {
    const f = frameFor("hero", 1440, 900, { left: 540, bottom: 130 });
    expect(f.x).toBe(540);
    expect(f.y + f.h).toBeLessThanOrEqual(900 - 130);
    expect(f.x + f.w).toBeLessThanOrEqual(1440);
  });

  it("falls back to the default hero frame without measurements", () => {
    const f = frameFor("hero", 1440, 900);
    expect(f.x).toBeCloseTo(288);
    expect(f.h).toBeGreaterThan(600);
  });
});
