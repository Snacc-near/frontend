import { describe, it, expect } from "vitest";
import {
  buildEventDedupeKey,
  resolveEventActor,
  formatEventSummary,
} from "../src/data/poller.ts";
import type { CrucibleEvent } from "../src/data/types.ts";

describe("UI-119: Poller, Deduplikasi & Korelasi Receipt ID", () => {
  it("menghasilkan kunci deduplikasi berbasis receipt_id + kind + index", () => {
    const ev: CrucibleEvent = {
      kind: "zone_changed",
      receipt_id: "rcpt-abc-123",
      raw: { from_zone: "Hypothermia", to_zone: "Goldilocks" },
    };
    expect(buildEventDedupeKey(ev, 2)).toBe("rcpt-abc-123:zone_changed:2");
  });

  it("menemukan pelaku eksplisit jika tersedia di payload", () => {
    const ev: CrucibleEvent = {
      kind: "strain_liquidated",
      receipt_id: "rcpt-1",
      raw: { liquidator: "likuidator.testnet", target_id: 3 },
    };
    const strains = new Map<number, string>([[3, "pemilik-3.testnet"]]);
    expect(resolveEventActor(ev, [ev], strains)).toBe("likuidator.testnet");
  });

  it("mengkorelasikan pelaku via receipt_id yang sama untuk zone_changed", () => {
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

    const strains = new Map<number, string>([[7, "peternak.testnet"]]);

    const actor = resolveEventActor(zoneEvt, [zoneEvt, fedEvt], strains);
    expect(actor).toBe("peternak.testnet (strain #7)");
  });

  it("mengembalikan 'penyebab tidak tercatat' bila korelasi tidak ditemukan (tidak menebak)", () => {
    const orphanEvt: CrucibleEvent = {
      kind: "zone_changed",
      receipt_id: "rcpt-orphan-999",
      raw: { from_zone: "Hypothermia", to_zone: "Goldilocks" },
    };
    const strains = new Map<number, string>();
    const actor = resolveEventActor(orphanEvt, [orphanEvt], strains);
    expect(actor).toBe("penyebab tidak tercatat");
  });

  it("memformat ringkasan event log dengan bahasa indonesia sederhana", () => {
    const ev: CrucibleEvent = {
      kind: "nutrient_burst_released",
      raw: { released_vita: "7200", burst_bps: 2000, until_epoch: 2 },
    };
    const summary = formatEventSummary(ev, "strain #3");
    expect(summary).toContain("lisis sel melepas 7200 nutrisi");
    expect(summary).toContain("-20.00%");
    expect(summary).toContain("sampai epoch 2");
  });
});
