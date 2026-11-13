/**
 * UI-143: landing leftovers. The FAQ gets its own tab in the bottom status bar (scrollspy) and the
 * Live section chip only says "live" while the backend actually answers. Runs in node, so the DOM
 * parts are checked through server-rendered markup and the pure helpers.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Faq } from "../src/landing/Finale.tsx";
import { LiveLab } from "../src/landing/LiveLab.tsx";
import { StatusBar } from "../src/landing/StatusBar.tsx";
import { liveChipText } from "../src/landing/lib/live.ts";
import { PROBE, SECTIONS, SECTION_IDS, activeIndex } from "../src/landing/sections.ts";
import type { LiveState } from "../src/landing/useLive.ts";

const BASE: LiveState = { status: "loading", macro: null, alive: null, strains: null, events: null, last: null, updatedAt: null };

describe("UI-143 FAQ tab", () => {
  it("lists the FAQ last, after the finale, with unique ids", () => {
    expect(SECTIONS[SECTIONS.length - 1]).toEqual({ id: "faq", label: "FAQ" });
    expect(SECTION_IDS.indexOf("faq")).toBeGreaterThan(SECTION_IDS.indexOf("ch-07"));
    expect(new Set(SECTION_IDS).size).toBe(SECTION_IDS.length);
  });

  it("points at the id the FAQ section really carries", () => {
    expect(renderToStaticMarkup(<Faq />)).toContain('id="faq"');
  });

  it("scrollspy activates the FAQ once its top crosses the probe line, and only then", () => {
    const faq = SECTION_IDS.indexOf("faq");
    const open = SECTION_IDS.indexOf("ch-07");
    const probe = 900 * PROBE;
    // every section above the FAQ has already passed the probe line
    const tops = (faqTop: number) => SECTION_IDS.map((_id, i) =>(i === faq ? faqTop : -1000 * (faq - i)));
    expect(activeIndex(tops(probe + 1), probe)).toBe(open);
    expect(activeIndex(tops(probe), probe)).toBe(faq);
    expect(activeIndex(tops(-200), probe)).toBe(faq);
  });

  it("renders the FAQ tab in the status bar and marks it current when active", () => {
    const html = renderToStaticMarkup(<StatusBar active="faq" live={BASE} />);
    expect(html).toContain('<a href="#faq" aria-current="true">FAQ</a>');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });
});

describe("UI-143 honest live chip", () => {
  it("says live only when the backend answers", () => {
    expect(liveChipText("live", "snacc-v001.testnet")).toBe("live · NEAR testnet · snacc-v001.testnet");
    expect(liveChipText("loading", "snacc-v001.testnet")).toBe("connecting… · NEAR testnet · snacc-v001.testnet");
    expect(liveChipText("offline", "snacc-v001.testnet")).toBe("offline · NEAR testnet · snacc-v001.testnet");
  });

  it("the Live section follows the state in its markup", () => {
    const off = renderToStaticMarkup(<LiveLab live={{ ...BASE, status: "offline" }} />);
    expect(off).toContain("offline · NEAR testnet");
    expect(off).not.toContain("live · NEAR testnet");
    const loading = renderToStaticMarkup(<LiveLab live={BASE} />);
    expect(loading).toContain("connecting… · NEAR testnet");
    expect(loading).not.toContain("live · NEAR testnet");
  });
});
