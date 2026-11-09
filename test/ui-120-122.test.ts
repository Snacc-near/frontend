import { describe, it, expect } from "vitest";
import {
  SVG_DATA_URI_PREFIX,
  buildDemoSvgDataUri,
  svgToSafeDataUri,
} from "../src/data/svg.ts";
import {
  formatAppetiteBigInt,
  formatAppetiteNumber,
  mapAppetite,
} from "../src/data/appetite.ts";
import { NO_DATA_PLACEHOLDER } from "../src/data/liveView.ts";
import { PetriDish } from "../src/game/petriDish.ts";

const LIVE_APPETITE = {
  zone: "FEVER",
  crucible_temp: 1040,
  current_epoch: 1,
  burst_bps: 360,
  burst_until: 2,
  burst_epochs_left: 1,
  dormant: false,
  feast_volume: "200293280499590063589814",
  feast_target: "110706572717372356453912",
  risk_heat: 10000,
  top_feeders: [{ account_id: "snacc-v001.testnet", amount: "200293280499590063589814" }],
  contractId: "snacc-v001.testnet",
  blockHeight: 276886572,
};

const LIVE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#0b0f1a"/></svg>';

describe("UI-120..122: SVG inspector live", () => {
  it("converts a real nft_token svg to a safe img data uris", () => {
    const uri = svgToSafeDataUri(LIVE_SVG);
    expect(uri).not.toBeNull();
    expect(uri!.startsWith(SVG_DATA_URI_PREFIX)).toBe(true);
    const payload = uri!.slice(SVG_DATA_URI_PREFIX.length);
    const decoded =
      typeof Buffer !== "undefined"
        ? Buffer.from(payload, "base64").toString("utf-8")
        : atob(payload);
    expect(decoded).toBe(LIVE_SVG);
  });

  it("rejects empty and non-svg payloads instead of injecting them", () => {
    expect(svgToSafeDataUri("")).toBeNull();
    expect(svgToSafeDataUri("not svg at all")).toBeNull();
    expect(svgToSafeDataUri("<html>hi</html>")).toBeNull();
  });

  it("accepts xml-prefixed svg documents", () => {
    expect(svgToSafeDataUri('<?xml version="1.0"?>' + LIVE_SVG)).not.toBeNull();
  });

  it("builds a labelled simulated svg for demo mode", () => {
    const uri = buildDemoSvgDataUri(1);
    expect(uri).not.toBeNull();
    expect(uri!.startsWith(SVG_DATA_URI_PREFIX)).toBe(true);
  });
});

describe("UI-120..122: appetite meter mapping", () => {
  it("maps the live /api/appetite fields verbatim", () => {
    const vm = mapAppetite(LIVE_APPETITE);
    expect(vm).not.toBeNull();
    expect(vm!.zone).toBe("FEVER");
    expect(vm!.crucibleTempMk).toBe(1040);
    expect(vm!.currentEpoch).toBe(1);
    expect(vm!.burstBps).toBe(360);
    expect(vm!.burstUntil).toBe(2);
    expect(vm!.burstEpochsLeft).toBe(1);
    expect(vm!.dormant).toBe(false);
    expect(vm!.feastVolume).toBe("200293280499590063589814");
    expect(vm!.feastTarget).toBe("110706572717372356453912");
    expect(vm!.riskHeat).toBe(10000);
    expect(vm!.topFeeders).toHaveLength(1);
    expect(vm!.contractId).toBe("snacc-v001.testnet");
  });

  it("computes feast progress and risk heat percent from big values", () => {
    const vm = mapAppetite(LIVE_APPETITE)!;
    expect(vm.feastProgressPct).not.toBeNull();
    expect(vm.feastProgressPct!).toBeGreaterThan(100 * 0.5);
    expect(vm.riskHeatPct).toBe(100);
  });

  it("returns null for missing payloads so the ui can show the placeholder", () => {
    expect(mapAppetite(null)).toBeNull();
    expect(mapAppetite(undefined)).toBeNull();
  });

  it("keeps unknown values null and formats them as an em dash", () => {
    const vm = mapAppetite({ zone: "FEVER" })!;
    expect(vm.crucibleTempMk).toBeNull();
    expect(vm.currentEpoch).toBeNull();
    expect(vm.feastVolume).toBeNull();
    expect(vm.feastProgressPct).toBeNull();
    expect(vm.riskHeatPct).toBeNull();
    expect(formatAppetiteNumber(null)).toBe(NO_DATA_PLACEHOLDER);
    expect(formatAppetiteBigInt(null)).toBe(NO_DATA_PLACEHOLDER);
    expect(formatAppetiteBigInt("123456789")).toBe("123,456,789");
  });
});

describe("UI-123..126: mobile dish clears hud at 390x844", () => {
  it("keeps the dish top below the header band on a portrait phone", () => {
    const dish = new PetriDish();
    dish.resize(390, 844);
    expect(dish.centerX).toBe(195);
    expect(dish.centerY).toBe(422);
    expect(dish.radiusX).toBeLessThanOrEqual(390 * 0.42);
    const dishTop = dish.centerY - dish.radiusY;
    // Header on phones stacks to at most ~200px; the dish must start below it.
    expect(dishTop).toBeGreaterThan(200);
    const dishBottom = dish.centerY + dish.radiusY;
    // Footer stacks to at most ~280px; the dish must end above it.
    expect(dishBottom).toBeLessThan(844 - 160);
  });

  it("keeps desktop dish sizing unchanged at 1280x800", () => {
    const dish = new PetriDish();
    dish.resize(1280, 800);
    expect(dish.centerX).toBe(640);
    expect(dish.centerY).toBe(400);
    expect(dish.radiusX).toBe(460);
    expect(dish.radiusY).toBe(310);
  });
});
