import { describe, it, expect } from "vitest";
import { PetriDish } from "../src/game/petriDish.ts";
import { EffectsManager } from "../src/game/effects.ts";
import { SKIN_LABELS } from "../src/config/constants.ts";
import { ZONE_THEMES } from "../src/config/zones.ts";
import { OptimisticManager } from "../src/data/optimistic.ts";

describe("Stage 3: UI-123..126 Polish & Verification", () => {
  describe("UI-123: Responsive Petri Dish Layout", () => {
    it("scales the dish ellipse proportionally on a portrait phone screen (360x640)", () => {
      const dish = new PetriDish();
      dish.resize(360, 640);

      expect(dish.centerX).toBe(180);
      expect(dish.centerY).toBe(320);
      expect(dish.radiusX).toBeLessThanOrEqual(360 * 0.44);
      // In portrait, radiusY stays proportional to radiusX so the dish does not become overly elongated
      expect(dish.radiusY).toBeLessThan(dish.radiusX);
    });

    it("scales the elliptical dish proportionally on landscape desktop (1920x1080)", () => {
      const dish = new PetriDish();
      dish.resize(1920, 1080);

      expect(dish.centerX).toBe(960);
      expect(dish.centerY).toBe(540);
      expect(dish.radiusX).toBe(460); // caps at the max radiusX of 460
      expect(dish.radiusY).toBe(310); // caps at the max radiusY of 310
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

  describe("UI-125: Aksesibilitas & Prefers-Reduced-Motion", () => {
    it("initializes the shake damper and particles of EffectsManager safely", () => {
      const effects = new EffectsManager();
      expect(effects.shockwaves).toEqual([]);
      expect(effects.particles).toEqual([]);

      // The shake and particle triggers
      effects.triggerShake(8);
      effects.triggerNutrientBurst(100, 100, 10, "#34d399");

      expect(effects.shockwaves.length).toBeGreaterThan(0);
      expect(effects.particles.length).toBeGreaterThan(0);

      // Update the visual effects
      const { offsetX, offsetY } = effects.update(0.016);
      expect(typeof offsetX).toBe("number");
      expect(typeof offsetY).toBe("number");
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
