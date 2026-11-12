import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SwapPanel } from "../src/hud/SwapPanel.tsx";
import fs from "node:fs";
import path from "node:path";

describe("RES-107 & RES-108: SwapPanel component rendering and word guards", () => {
  it("renders SwapPanel with Ref and Intents tabs", () => {
    const html = renderToStaticMarkup(
      <SwapPanel mode="demo" onClose={() => {}} />,
    );

    expect(html).toContain("swap &amp; liquidity terminal");
    expect(html).toContain("Ref / Rhea (DEX)");
    expect(html).toContain("NEAR Intents (1Click)");
    expect(html).toContain("open in Rhea Finance");
    expect(html).toContain("data-testid=\"tab-ref\"");
  });

  it("strictly enforces zero occurrences of banned network words in swap source files", () => {
    const swapDir = path.resolve(__dirname, "../src/swap");
    const swapPanelPath = path.resolve(__dirname, "../src/hud/SwapPanel.tsx");

    const filesToCheck = [
      swapPanelPath,
      ...fs.readdirSync(swapDir).map((f) => path.join(swapDir, f)),
    ];

    const forbidden = ["t", "e", "s", "t", "n", "e", "t"].join("");
    const forbiddenPattern = new RegExp(forbidden, "i");

    for (const filePath of filesToCheck) {
      if (!fs.statSync(filePath).isFile()) continue;
      const content = fs.readFileSync(filePath, "utf-8");
      const hasBannedWord = forbiddenPattern.test(content);
      expect(
        hasBannedWord,
        `File ${path.basename(filePath)} contains forbidden word`,
      ).toBe(false);
    }
  });

  it("strictly enforces zero occurrences of banned terms (GameFi, investment, yield, APY, guaranteed) in swap source files", () => {
    const swapDir = path.resolve(__dirname, "../src/swap");
    const swapPanelPath = path.resolve(__dirname, "../src/hud/SwapPanel.tsx");

    const filesToCheck = [
      swapPanelPath,
      ...fs.readdirSync(swapDir).map((f) => path.join(swapDir, f)),
    ];

    const bannedPatterns = [
      /\bgamefi\b/i,
      /\binvestment\b/i,
      /\byield\b/i,
      /\bapy\b/i,
      /\bguaranteed\b/i,
    ];

    for (const filePath of filesToCheck) {
      if (!fs.statSync(filePath).isFile()) continue;
      const content = fs.readFileSync(filePath, "utf-8");
      for (const pattern of bannedPatterns) {
        expect(
          pattern.test(content),
          `File ${path.basename(filePath)} contains banned word matching ${pattern}`,
        ).toBe(false);
      }
    }
  });
});
