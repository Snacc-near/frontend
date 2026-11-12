import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SwapPanel } from "../src/hud/SwapPanel.tsx";

describe("SwapPanel", () => {
  for (const mode of ["demo", "live"] as const) {
    it(`renders the same real-data panel in ${mode} mode, with no sample prices`, () => {
      const html = renderToStaticMarkup(<SwapPanel mode={mode} onClose={() => {}} />);
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain("Rhea price");
      expect(html).toContain("1Click dry quote");
      expect(html).toContain("$SNACC is a testnet token with no monetary value.");
      // the old demo shortcut invented a wNEAR price and a x1250 rate for any asset
      expect(html).not.toContain("$5.42");
      expect(html).not.toContain("1,250");
    });
  }
});
