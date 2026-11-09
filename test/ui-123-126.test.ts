import { describe, it, expect } from "vitest";
import { SKIN_LABELS } from "../src/config/constants.ts";
import { ZONE_THEMES } from "../src/config/zones.ts";
import { OptimisticManager } from "../src/data/optimistic.ts";
import { placeCells, DISH_R } from "../src/plate/iso/layout.ts";
import { plateProjection, VIEW_H, VIEW_W } from "../src/plate/iso/plateGeom.ts";

describe("Stage 3: UI-123..126 Polish & Verification", () => {
  describe("UI-123: Responsive colony plate layout (SVG viewBox)", () => {
    it("fits the full machine in the viewBox so it scales to any screen", () => {
      const P = plateProjection();
      expect(P.scale).toBeGreaterThan(0);
      expect(VIEW_W / VIEW_H).toBeGreaterThan(1);
    });

    it("keeps the dish world radius inside the plate at every placement", () => {
      const P = plateProjection();
      const cells = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        vitalityRatio: 0.5 + (i % 4) * 0.12,
        status: "Active",
        highlighted: i === 0,
        index: i,
      }));
      for (const cell of placeCells(cells, P)) {
        expect(Math.abs(cell.x)).toBeLessThan(DISH_R + 20);
        expect(Math.abs(cell.y)).toBeLessThan(DISH_R + 20);
      }
    });
  });

  describe("UI-124: Bioluminescent Dark Mode & the ADR-31 Glossary", () => {
    it("has a complete and exact label mapping for both skins (Bio-Lab and FinTech)", () => {
      const biolab = SKIN_LABELS.biolab;
      const fintech = SKIN_LABELS.fintech;

      expect(biolab.vitality).toBe("vitality");
      expect(fintech.vitality).toBe("solvency runway");

      expect(biolab.atp).toBe("atp energy");
      expect(fintech.atp).toBe("internal atp energy");

      expect(biolab.burst).toBe("lysis nutrient burst");
      expect(fintech.burst).toBe("liquidation discount");

      expect(biolab.optimisticPending).toBe("waiting for confirmation...");
      expect(fintech.optimisticPending).toBe("waiting for confirmation...");
    });

    it("has complete color themes and textual zone descriptions (never color-only)", () => {
      for (const zoneKey of ["Goldilocks", "Fever", "Hypothermia"] as const) {
        const theme = ZONE_THEMES[zoneKey];
        expect(theme.label).toBeDefined();
        expect(theme.description).toBeDefined();
        expect(theme.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.dishGlow).toBeDefined();
      }
    });
  });

  describe("UI-125: Accessibility & Prefers-Reduced-Motion", () => {
    it("exposes an iris fallback branch for reduced motion", async () => {
      const { irisMode } = await import("../src/plate/iso/layout.ts");
      expect(irisMode(true)).toBe("fade");
      expect(irisMode(false)).toBe("iris");
    });
  });

  describe("UI-126: Optimistic State (Pending, Confirmed, Reverted)", () => {
    it("transitions the optimistic state with an instant vitality increase", () => {
      const opt = new OptimisticManager(8000);
      expect(opt.getState().status).toBe("idle");
      expect(opt.getState().currentVitality).toBe(8000);

      // Apply the optimistic feed action
      opt.applyFeed(300);
      const pendingState = opt.getState();
      expect(pendingState.status).toBe("pending");
      expect(pendingState.currentVitality).toBe(8300);
      expect(pendingState.baseVitality).toBe(8000);

      // Confirm succeeds
      opt.confirm();
      const confirmedState = opt.getState();
      expect(confirmedState.status).toBe("confirmed");
      expect(confirmedState.currentVitality).toBe(8300);
      expect(confirmedState.baseVitality).toBe(8300);
    });

    it("restores the original vitality when the optimistic transaction fails or reverts", () => {
      const opt = new OptimisticManager(7500);
      opt.applyFeed(400);
      expect(opt.getState().currentVitality).toBe(7900);

      opt.revert();
      const revertedState = opt.getState();
      expect(revertedState.status).toBe("reverted");
      expect(revertedState.currentVitality).toBe(7500);
      expect(revertedState.baseVitality).toBe(7500);
    });
  });
});
