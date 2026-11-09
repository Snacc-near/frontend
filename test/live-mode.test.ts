import { describe, it, expect } from "vitest";
import { LivingCell } from "../src/game/cell.ts";
import { resolveEventActor, buildEventDedupeKey } from "../src/data/poller.ts";
import type { CrucibleEvent } from "../src/data/types.ts";

describe("Tahap 2: Live Mode & Game World Integration", () => {
  describe("LivingCell Hit-Testing & Highlighting", () => {
    it("mendeteksi klik tepat pada sel dan mengabaikan klik di luar batas", () => {
      const cell = new LivingCell({
        id: 7,
        label: "strain #7",
        x: 200,
        y: 150,
        radius: 30,
      });

      // Tepat di pusat
      expect(cell.containsPoint(200, 150)).toBe(true);
      // Di dalam radius toleransi (30 * 1.35 = 40.5)
      expect(cell.containsPoint(230, 150)).toBe(true);
      // Di luar radius
      expect(cell.containsPoint(300, 300)).toBe(false);
    });

    it("mengaktifkan pulsa bioluminescent saat sel diberi makan", () => {
      const cell = new LivingCell({
        id: 3,
        label: "strain #3",
        x: 100,
        y: 100,
      });

      expect(cell.fedPulse).toBe(0);
      cell.triggerFedPulse();
      expect(cell.fedPulse).toBe(1.0);

      // Setelah pembaruan waktu (dt = 0.2), pulsa berkurang
      cell.update(0.2, 400, 300, 200, 150);
      expect(cell.fedPulse).toBeLessThan(1.0);
      expect(cell.fedPulse).toBeGreaterThan(0);
    });

    it("mendukung penanda penyorotan akun NEAR pemilik", () => {
      const cell = new LivingCell({
        id: 12,
        label: "strain #12",
        owner: "alice.testnet",
        isHighlighted: true,
        x: 120,
        y: 180,
      });

      expect(cell.isHighlighted).toBe(true);
      expect(cell.owner).toBe("alice.testnet");
    });
  });

  describe("Event Mapping & Korelasi Pelaku", () => {
    it("mencocokkan receipt_id pada zone_changed untuk menemukan akun penabrak ambang", () => {
      const allEvents: CrucibleEvent[] = [
        {
          kind: "zone_changed",
          receipt_id: "rcpt-abc-123",
          raw: { from_zone: "Goldilocks", to_zone: "Fever", crucible_temp: 615 },
        },
        {
          kind: "fed",
          receipt_id: "rcpt-abc-123",
          raw: { strain_id: 42 },
        },
      ];

      const strainsMap = new Map<number, string>([[42, "bob.testnet"]]);

      const actor = resolveEventActor(allEvents[0]!, allEvents, strainsMap);
      expect(actor).toBe("bob.testnet (strain #42)");
    });

    it("mengembalikan 'penyebab tidak tercatat' secara ketat jika tidak ada korelasi receipt_id", () => {
      const allEvents: CrucibleEvent[] = [
        {
          kind: "zone_changed",
          receipt_id: "rcpt-orphan-999",
          raw: { from_zone: "Goldilocks", to_zone: "Hypothermia", crucible_temp: 588 },
        },
      ];

      const strainsMap = new Map<number, string>();
      const actor = resolveEventActor(allEvents[0]!, allEvents, strainsMap);
      expect(actor).toBe("penyebab tidak tercatat");
    });

    it("menghasilkan kunci deduplikasi yang unik untuk setiap event", () => {
      const ev1: CrucibleEvent = {
        kind: "nutrient_burst_released",
        receipt_id: "rcpt-burst-1",
        raw: { strain_id: 5 },
      };
      const ev2: CrucibleEvent = {
        kind: "nutrient_burst_released",
        receipt_id: "rcpt-burst-1",
        raw: { strain_id: 5 },
      };

      const key1 = buildEventDedupeKey(ev1, 0);
      const key2 = buildEventDedupeKey(ev2, 0);
      expect(key1).toBe(key2);
      expect(key1).toBe("rcpt-burst-1:nutrient_burst_released:0");
    });
  });
});
