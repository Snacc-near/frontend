import { describe, it, expect } from "vitest";
import { CHAPTERS, CHAPTER_IDS } from "../src/landing/chapters.ts";
import { pickActive } from "../src/landing/useScrollSpy.ts";

describe("landing chapters", () => {
  it("has seven sequential chapters with unique ids", () => {
    expect(CHAPTERS).toHaveLength(7);
    expect(CHAPTERS.map((c) => c.num)).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
    expect(new Set(CHAPTER_IDS).size).toBe(7);
    expect(CHAPTER_IDS[0]).toBe("ch-01");
  });

  it("keeps the copy free of banned claims", () => {
    const text = CHAPTERS.map((c) => `${c.headline} ${c.line}`).join(" ").toLowerCase();
    for (const banned of ["gamefi", "investment", "yield", "guarantee"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("only quotes the official burn and relief figures", () => {
    const numbers = CHAPTERS.flatMap((c) => c.line.match(/\d+(?:\.\d+)?%/g) ?? []);
    expect(numbers.sort()).toEqual(["2%", "3.5%"]);
  });
});

describe("pickActive", () => {
  it("returns the first chapter in document order inside the band", () => {
    expect(pickActive(CHAPTER_IDS, new Set(["ch-04", "ch-03"]), "ch-01")).toBe("ch-03");
  });

  it("keeps the fallback when nothing is in the band", () => {
    expect(pickActive(CHAPTER_IDS, new Set(), "ch-07")).toBe("ch-07");
  });
});
