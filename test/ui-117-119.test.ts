/**
 * Unit Test Suite for the `UI-117..119` work package (FE-04 `node --test`).
 * Tests:
 * - UI-117: the NutrientBurstBadge view-model, the discount computation, the epoch expiry, and the 30% cap.
 * - UI-118: the ZoneBanner temperature classification (Hypothermia <600, Goldilocks 600..610, Fever >610 mK),
 *           the I-01 policy (3.50% burn) & I-04 (2.00% rebate), and the Dual-Skin ADR-31.
 * - UI-119: the ThresholdBreachLog ("who crossed the threshold"), the temperature delta formatting, and the SLA <2000 ms.
 * - Motionmaxxing easing curves (FE-26): the mathematical boundaries f(0)=0 and f(1)=1.
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  OFFICIAL_CONSTANTS,
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
  it("shows an active discount of -20.00% to -30.00% before untilEpoch", () => {
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

  it("clamps the discount at MAX_BURST_BPS (2000 bps = 20.00%) and expires when currentEpoch >= untilEpoch", () => {
    assert.equal(computeActiveBurstBps(4500, 5, 2), OFFICIAL_CONSTANTS.MAX_BURST_BPS);
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
  it("classifies Hypothermia (<600 mK), Goldilocks (600..610 mK), and Fever (>610 mK)", () => {
    assert.equal(classifyZone(599), "Hypothermia");
    assert.equal(classifyZone(600), "Goldilocks");
    assert.equal(classifyZone(605), "Goldilocks");
    assert.equal(classifyZone(610), "Goldilocks");
    assert.equal(classifyZone(611), "Fever");
  });

  it("produces an accurate view-model for both the Bio-Lab 3D and FinTech modes (ADR-31)", () => {
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
    // On the dynamic 0..2x-FEVER scale (0..1220 mK), 600 mK sits just below the midpoint
    assert.ok(Math.abs(computeThermalGaugeRatio(600) - 600 / 1220) < 1e-9);
    assert.equal(computeThermalGaugeRatio(1220), 1);
  });
});

describe("UI-119: Threshold Breach Telemetry Log ('who crossed the threshold')", () => {
  it("formats the zone_changed event and verifies the render SLA < 2000 ms (DoD)", () => {
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
  it("binds every motion curve function to f(0)=0 and f(1)=1", () => {
    for (const fn of [ease.softLand, ease.snapSettle, ease.popOver, ease.softInOut, ease.accelExit]) {
      assert.equal(fn(0), 0);
      assert.ok(Math.abs(fn(1) - 1) < 1e-3);
    }
    // popOver must slightly exceed 1.0 (the spring overshoot) mid-curve
    assert.ok(ease.popOver(0.55) > 1.0);
  });
});
