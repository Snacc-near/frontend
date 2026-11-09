import { describe, it, expect } from "vitest";
import { resolveEventActor, buildEventDedupeKey } from "../src/data/poller.ts";
import { placeCells, statusLook } from "../src/plate/iso/layout.ts";
import { plateProjection } from "../src/plate/iso/plateGeom.ts";
import type { CrucibleEvent } from "../src/data/types.ts";

describe("Stage 2: Live Mode & Game World Integration", () => {
  describe("Colony plate cell placement & highlighting", () => {
    it("places owner-highlighted strains deterministically like every strain", () => {
      const P = plateProjection();
      const cells = [
        { id: 7, vitalityRatio: 0.5, status: "Active", highlighted: false, index: 1 },
        { id: 12, vitalityRatio: 0.9, status: "Active", highlighted: true, index: 0 },
      ];
      const placed = placeCells(cells, P);
      expect(placed.map((c) => c.id)).toEqual([7, 12]);
      expect(placed.find((c) => c.id === 12)?.highlighted).toBe(true);
      expect(placeCells(cells, P)).toEqual(placed);
    });

    it("gives the highlighted owner strain a selected marigold ring when chosen", () => {
      expect(statusLook("Active", true).selectedRing).toBe(true);
      expect(statusLook("Active", false).selectedRing).toBe(false);
    });
  });

  describe("Event Mapping & Actor Correlation", () => {
    it("matches the receipt_id on zone_changed to find the account that crossed the threshold", () => {
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

    it("strictly returns 'cause not recorded' when no receipt_id correlation exists", () => {
      const allEvents: CrucibleEvent[] = [
        {
          kind: "zone_changed",
          receipt_id: "rcpt-orphan-999",
          raw: { from_zone: "Goldilocks", to_zone: "Hypothermia", crucible_temp: 588 },
        },
      ];

      const strainsMap = new Map<number, string>();
      const actor = resolveEventActor(allEvents[0]!, allEvents, strainsMap);
      expect(actor).toBe("cause not recorded");
    });

    it("produces a unique dedupe key for every event", () => {
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
