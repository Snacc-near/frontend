import { describe, it, expect } from "vitest";
import {
  buildEventDedupeKey,
  resolveEventActor,
  formatEventSummary,
} from "../src/data/poller.ts";
import type { CrucibleEvent } from "../src/data/types.ts";

describe("UI-119: The Poller, Dedupe & Receipt-ID Correlation", () => {
  it("builds a dedupe key from receipt_id + kind + index", () => {
    const ev: CrucibleEvent = {
      kind: "zone_changed",
      receipt_id: "rcpt-abc-123",
      raw: { from_zone: "Hypothermia", to_zone: "Goldilocks" },
    };
    expect(buildEventDedupeKey(ev, 2)).toBe("rcpt-abc-123:zone_changed:2");
  });

  it("finds the explicit actor when the payload provides one", () => {
    const ev: CrucibleEvent = {
      kind: "strain_liquidated",
      receipt_id: "rcpt-1",
      raw: { liquidator: "liquidator.testnet", target_id: 3 },
    };
    const strains = new Map<number, string>([[3, "owner-3.testnet"]]);
    expect(resolveEventActor(ev, [ev], strains)).toBe("liquidator.testnet");
  });

  it("correlates the actor via the same receipt_id for zone_changed", () => {
    const zoneEvt: CrucibleEvent = {
      kind: "zone_changed",
      receipt_id: "rcpt-cross-456",
      raw: { from_zone: "Goldilocks", to_zone: "Fever", crucible_temp: 620 },
    };

    const fedEvt: CrucibleEvent = {
      kind: "fed",
      receipt_id: "rcpt-cross-456",
      raw: { strain_id: 7, base_fee: "1000" },
    };

    const strains = new Map<number, string>([[7, "breeder.testnet"]]);

    const actor = resolveEventActor(zoneEvt, [zoneEvt, fedEvt], strains);
    expect(actor).toBe("breeder.testnet (strain #7)");
  });

  it("returns 'cause not recorded' when no correlation is found (never guesses)", () => {
    const orphanEvt: CrucibleEvent = {
      kind: "zone_changed",
      receipt_id: "rcpt-orphan-999",
      raw: { from_zone: "Hypothermia", to_zone: "Goldilocks" },
    };
    const strains = new Map<number, string>();
    const actor = resolveEventActor(orphanEvt, [orphanEvt], strains);
    expect(actor).toBe("cause not recorded");
  });

  it("formats the event log summary in plain English", () => {
    const ev: CrucibleEvent = {
      kind: "nutrient_burst_released",
      raw: { released_vita: "7200", burst_bps: 2000, until_epoch: 2 },
    };
    const summary = formatEventSummary(ev, "strain #3");
    expect(summary).toContain("cell lysis released 7200 nutrients");
    expect(summary).toContain("-20.00%");
    expect(summary).toContain("until epoch 2");
  });
});
