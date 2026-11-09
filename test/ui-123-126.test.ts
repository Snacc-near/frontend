import { describe, it, expect } from "vitest";
import { PetriDish } from "../src/game/petriDish.ts";
import { EffectsManager } from "../src/game/effects.ts";
import { SKIN_LABELS } from "../src/config/constants.ts";
import { ZONE_THEMES } from "../src/config/zones.ts";
import { OptimisticManager } from "../src/data/optimistic.ts";

describe("Tahap 3: UI-123..126 Polish & Verification", () => {
  describe("UI-123: Layout Responsif Cawan Petri", () => {
    it("menyesuaikan skala elips cawan secara proporsional pada layar HP potret (360x640)", () => {
      const dish = new PetriDish();
      dish.resize(360, 640);

      expect(dish.centerX).toBe(180);
      expect(dish.centerY).toBe(320);
      expect(dish.radiusX).toBeLessThanOrEqual(360 * 0.44);
      // Pada potret, radiusY proporsional terhadap radiusX agar tidak menjadi lonjong berlebihan
      expect(dish.radiusY).toBeLessThan(dish.radiusX);
    });

    it("menyesuaikan skala elips cawan secara proporsional pada desktop lanskap (1920x1080)", () => {
      const dish = new PetriDish();
      dish.resize(1920, 1080);

      expect(dish.centerX).toBe(960);
      expect(dish.centerY).toBe(540);
      expect(dish.radiusX).toBe(460); // mentok pada batas maksimal radiusX 460
      expect(dish.radiusY).toBe(310); // mentok pada batas maksimal radiusY 310
    });
  });

  describe("UI-124: Mode Gelap Bioluminescent & Kamus ADR-31", () => {
    it("memiliki pemetaan label yang lengkap dan tepat untuk kedua skin (Bio-Lab dan FinTech)", () => {
      const biolab = SKIN_LABELS.biolab;
      const fintech = SKIN_LABELS.fintech;

      expect(biolab.vitality).toBe("vitalitas");
      expect(fintech.vitality).toBe("runway solvabilitas");

      expect(biolab.atp).toBe("energi atp");
      expect(fintech.atp).toBe("energi internal atp");

      expect(biolab.burst).toBe("semburan nutrisi lisis");
      expect(fintech.burst).toBe("diskon likuidasi");

      expect(biolab.optimisticPending).toBe("menunggu konfirmasi...");
      expect(fintech.optimisticPending).toBe("menunggu konfirmasi...");
    });

    it("memiliki tema warna dan deskripsi tekstual zona yang lengkap (tidak hanya mengandalkan warna)", () => {
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
    it("EffectsManager menginisialisasi peredam getar dan partikel dengan aman", () => {
      const effects = new EffectsManager();
      expect(effects.shockwaves).toEqual([]);
      expect(effects.particles).toEqual([]);

      // Pemicu getaran dan partikel
      effects.triggerShake(8);
      effects.triggerNutrientBurst(100, 100, 10, "#34d399");

      expect(effects.shockwaves.length).toBeGreaterThan(0);
      expect(effects.particles.length).toBeGreaterThan(0);

      // Update efek visual
      const { offsetX, offsetY } = effects.update(0.016);
      expect(typeof offsetX).toBe("number");
      expect(typeof offsetY).toBe("number");
    });
  });

  describe("UI-126: State Optimis (Pending, Confirmed, Reverted)", () => {
    it("melakukan transisi state optimis dengan kenaikan vitalitas seketika", () => {
      const opt = new OptimisticManager(8000);
      expect(opt.getState().status).toBe("idle");
      expect(opt.getState().currentVitality).toBe(8000);

      // Terapkan aksi makan optimis
      opt.applyFeed(300);
      const pendingState = opt.getState();
      expect(pendingState.status).toBe("pending");
      expect(pendingState.currentVitality).toBe(8300);
      expect(pendingState.baseVitality).toBe(8000);

      // Konfirmasi berhasil
      opt.confirm();
      const confirmedState = opt.getState();
      expect(confirmedState.status).toBe("confirmed");
      expect(confirmedState.currentVitality).toBe(8300);
      expect(confirmedState.baseVitality).toBe(8300);
    });

    it("mengembalikan nilai vitalitas awal jika transaksi optimis gagal atau di-revert", () => {
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
