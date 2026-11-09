/**
 * Test Suite Unit untuk Paket Kerja Arya `UI-117..119` (FE-04 `node --test`).
 * Menguji:
 * - UI-117: NutrientBurstBadge view-model, perhitungan diskon, kedaluwarsa epoch, dan cap 30%.
 * - UI-118: ZoneBanner klasifikasi suhu (Hypothermia <600, Goldilocks 600..610, Fever >610 mK),
 *           kebijakan I-01 (3.50% burn) & I-04 (2.00% rebate), dan Dual-Skin ADR-31.
 * - UI-119: ThresholdBreachLog ("Siapa Menabrak Ambang"), pemformatan delta suhu, dan SLA <2000 ms.
 * - Motionmaxxing easing curves (FE-26): batas matematis f(0)=0 dan f(1)=1.
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  KAMUS_ANGKA,
  classifyZone,
  computeActiveBurstBps,
  computeBurstEpochsRemaining,
  computeThermalGaugeRatio,
  describeZonePolicy,
} from "../src/types.ts";
import { buildBurstBadgeViewModel } from "../src/components/NutrientBurstBadge.ts";
import { buildZoneBannerViewModel } from "../src/components/ZoneBanner.ts";
import { buildBreachLogItemViewModel } from "../src/components/ThresholdBreachLog.ts";
import { ease } from "../src/motion.ts";

describe("UI-117: Global Nutrient Burst Badge (EN-102)", () => {
  it("menampilkan diskon aktif -20.00% s.d. -30.00% sebelum untilEpoch", () => {
    const vm = buildBurstBadgeViewModel(
      {
        isActive: true,
        activeBurstBps: 2000,
        untilEpoch: 3,
        releasedVita: 7200,
        triggeringStrainId: 3,
        lastUpdatedMs: 1000,
      },
      1,
    );

    assert.equal(vm.stateAttr, "active");
    assert.equal(vm.discountLabel, "-20.00% FEED DISCOUNT");
    assert.equal(vm.epochRemainingLabel, "2 Epochs Left (Until E#3)");
    assert.equal(vm.donorLabel, "Donor: Strain #3");
    assert.equal(vm.vitaReleasedLabel, "+7,200 VITA Released");
  });

  it("memotong diskon pada plafon BURST_CAP_BPS (3000 bps = 30.00%) dan mati saat currentEpoch >= untilEpoch", () => {
    assert.equal(computeActiveBurstBps(4500, 5, 2), KAMUS_ANGKA.BURST_CAP_BPS);
    assert.equal(computeActiveBurstBps(2000, 2, 2), 0);
    assert.equal(computeBurstEpochsRemaining(2, 5), 0);

    const standbyVm = buildBurstBadgeViewModel(
      {
        isActive: true,
        activeBurstBps: 2000,
        untilEpoch: 2,
        releasedVita: 7200,
        triggeringStrainId: 3,
        lastUpdatedMs: 1000,
      },
      2,
    );
    assert.equal(standbyVm.stateAttr, "standby");
    assert.equal(standbyVm.discountLabel, "0.00% STANDBY");
  });
});

describe("UI-118: Macro Zone Banner & Thermostat Spectrum (ECON-111 & ADR-31)", () => {
  it("mengklasifikasikan Hypothermia (<600 mK), Goldilocks (600..610 mK), dan Fever (>610 mK)", () => {
    assert.equal(classifyZone(599), "Hypothermia");
    assert.equal(classifyZone(600), "Goldilocks");
    assert.equal(classifyZone(605), "Goldilocks");
    assert.equal(classifyZone(610), "Goldilocks");
    assert.equal(classifyZone(611), "Fever");
  });

  it("menghasilkan view-model yang akurat untuk mode Bio-Lab 3D maupun FinTech (ADR-31)", () => {
    const feverFintech = buildZoneBannerViewModel({ crucibleTemp: 635, currentEpoch: 4 }, "fintech");
    assert.equal(feverFintech.zone, "Fever");
    assert.equal(feverFintech.invariantCode, "I-01");
    assert.equal(feverFintech.rateLabel, "-3.50% SUPPLY BURN");
    assert.ok(feverFintech.policyRule.includes("3.50%"));

    const hypoBiolab = buildZoneBannerViewModel({ crucibleTemp: 560, currentEpoch: 4 }, "biolab");
    assert.equal(hypoBiolab.zone, "Hypothermia");
    assert.equal(hypoBiolab.invariantCode, "I-04");
    assert.equal(hypoBiolab.rateLabel, "+2.00% TREASURY REBATE");
    assert.ok(hypoBiolab.policyRule.includes("2.00%"));

    const goldPolicy = describeZonePolicy("Goldilocks", "biolab");
    assert.equal(goldPolicy.invariantCode, "EN-105");
    assert.equal(computeThermalGaugeRatio(600), 0.5);
  });
});

describe("UI-119: Threshold Breach Telemetry Log ('Siapa Menabrak Ambang')", () => {
  it("memformat event zone_changed dan memverifikasi SLA render < 2000 ms (DoD)", () => {
    const vm = buildBreachLogItemViewModel({
      id: "evt-101",
      kind: "zone_changed",
      actor: "alkemis.testnet",
      epoch: 2,
      fromZone: "Goldilocks",
      toZone: "Fever",
      crucibleTemp: 624,
      tempDeltaMk: 19,
      summary: "Heavy transmutation crossed 610 mK Fever threshold",
      emittedAtMs: 10_000,
      renderedAtMs: 10_145,
    });

    assert.equal(vm.kindBadge, "Goldilocks -> Fever");
    assert.equal(vm.actorLabel, "alkemis.testnet");
    assert.equal(vm.deltaLabel, "+19 mK (624 mK)");
    assert.equal(vm.latencyMs, 145);
    assert.equal(vm.meetsSla, true);
  });
});

describe("Motionmaxxing Easing Curves (FE-26)", () => {
  it("memastikan seluruh fungsi kurva gerak terikat pada f(0)=0 dan f(1)=1", () => {
    for (const fn of [ease.softLand, ease.snapSettle, ease.popOver, ease.softInOut, ease.accelExit]) {
      assert.equal(fn(0), 0);
      assert.ok(Math.abs(fn(1) - 1) < 1e-3);
    }
    // popOver harus sedikit melampaui 1.0 (overshoot pegas) di pertengahan kurva
    assert.ok(ease.popOver(0.55) > 1.0);
  });
});
