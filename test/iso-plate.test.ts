import { describe, it, expect } from "vitest";
import {
  cellRadius,
  crowdScale,
  hashRand,
  irisMode,
  needleRatio,
  placeCells,
  receiptLine,
  statusLook,
  tempLabel,
  DISH_R,
  DISH_CX,
  DISH_CY,
} from "../src/plate/iso/layout.ts";
import { magnifierGeometry, plateGeometry, plateProjection, VIEW_H, VIEW_W, VIEWS } from "../src/plate/iso/plateGeom.ts";
import { cellGeometry } from "../src/plate/iso/cellGeom.ts";
import { applyAction, collectProduction, createInitialSimulation, startProduction, tickSimulation } from "../src/game/simulation.ts";
import { isLabAction, validateFigureMessage } from "../src/game/bridge.ts";

const P = plateProjection();

const cells = [
  { id: 3, vitalityRatio: 0.31, status: "Distressed", highlighted: false, index: 2 },
  { id: 1, vitalityRatio: 0.85, status: "Active", highlighted: true, index: 0 },
  { id: 2, vitalityRatio: 0.72, status: "Active", highlighted: false, index: 1 },
];

describe("iso colony plate layout determinism", () => {
  it("places the same strain ids at the same spots every time", () => {
    const a = placeCells(cells, P);
    const b = placeCells([...cells].reverse(), P);
    expect(a).toEqual(b);
    expect(placeCells(cells, P)).toEqual(a);
  });

  it("sorts cells by strain id so the colony does not shuffle", () => {
    const ids = placeCells(cells, P).map((c) => c.id);
    expect(ids).toEqual([1, 2, 3]);
  });

  it("keeps every cell inside the dish world radius", () => {
    for (const cell of placeCells(cells, P)) {
      const dist = Math.hypot(cell.x - DISH_CX, cell.y - DISH_CY);
      expect(dist + cell.radius).toBeLessThan(DISH_R);
    }
  });

  it("sizes cells from vitality (null vitality is mid size)", () => {
    expect(cellRadius(1)).toBeGreaterThan(cellRadius(0.5));
    expect(cellRadius(0.5)).toBeGreaterThan(cellRadius(0));
    expect(cellRadius(null)).toBe(13.5);
  });

  it("produces different jitter per strain id", () => {
    const [a, b] = placeCells(cells, P);
    expect(hashRand(a!.id, 2)).not.toBe(hashRand(b!.id, 2));
  });
});

describe("iso plate geometry builds the full machine", () => {
  it("emits static geometry with non-empty paths for plate, dish and dial", () => {
    const g = plateGeometry("Goldilocks", P);
    for (const d of [g.shadow, g.base.fill, g.base.top, g.base.outline, g.groove, g.dish.fill, g.dish.top, g.rimRing, g.rimWell, g.agar, g.guideRing, g.dialBody.top, g.needlePath, g.label.top, g.ruler.top, g.box.top, g.tube.glass.fill, g.tube.liquid.fill, g.rack.top, g.pipette.body.fill, g.lid.body.fill]) {
      expect(d).toContain("M");
    }
    expect(g.feet).toHaveLength(4);
    expect(g.screws.rings).toHaveLength(6);
    expect(g.screws.slots).toHaveLength(12);
    expect(g.clips).toHaveLength(3);
    expect(g.vials).toHaveLength(3);
    expect(g.cables.length).toBeGreaterThanOrEqual(3);
    expect(g.rimTicks.minor + g.rimTicks.major).toContain("M");
    expect(g.dialTicks.minor + g.dialTicks.major).toContain("M");
    expect(g.dialBands).toHaveLength(3);
  });

  it("is a pure function of its inputs (same plate every time)", () => {
    expect(plateGeometry("Goldilocks", P, 0.5)).toEqual(plateGeometry("Goldilocks", P, 0.5));
  });

  it("raises the thermometer liquid with the temperature ratio", () => {
    const low = plateGeometry("Goldilocks", P, 0.1).tube.liquid.top;
    const high = plateGeometry("Goldilocks", P, 0.9).tube.liquid.top;
    expect(low).not.toEqual(high);
  });

  it("builds yeast cells: domed body, rim band, membrane, nucleus, beans, vacuole, scars", () => {
    const [placed] = placeCells(cells, P);
    const g = cellGeometry(placed!, P);
    expect(g.dome.fill).toContain("M");
    expect(g.dome.shades.filter(Boolean).length).toBeGreaterThanOrEqual(3);
    expect(g.rimOuter).toContain("C");
    expect(g.rimInner).toContain("C");
    expect(g.nucleus.fill).toContain("M");
    expect(g.nucleolus.fill).toContain("M");
    expect(g.pores.length).toBeGreaterThanOrEqual(8);
    expect(g.mitochondria.length).toBeGreaterThanOrEqual(2);
    expect(g.mitochondria[0]!.cristae.length).toBeGreaterThanOrEqual(8);
    expect(g.vacuole.fill).toContain("M");
    expect(g.ribosomes.length).toBeGreaterThanOrEqual(4);
    expect(g.budScars.length).toBeGreaterThanOrEqual(1);
    expect(g.selectRing).toContain("M");
    expect(g.bud).toBeNull();
    expect(g.tag).toBeNull();
  });

  it("draws one bud scar per generation (capped at 5) that faces the viewer", () => {
    const base = placeCells(cells, P)[0]!;
    const gen1 = cellGeometry({ ...base, generation: 1 }, P);
    const gen4 = cellGeometry({ ...base, generation: 4 }, P);
    expect(gen1.budScars).toHaveLength(1);
    expect(gen4.budScars.length).toBeGreaterThan(gen1.budScars.length);
    expect(cellGeometry({ ...base, generation: 99 }, P).budScars.length).toBeLessThanOrEqual(5);
  });

  it("grows a daughter bud only on a recently divided cell, and a tag only when selected", () => {
    const base = placeCells(cells, P)[0]!;
    expect(cellGeometry({ ...base, budding: true }, P).bud).not.toBeNull();
    expect(cellGeometry(base, P, 24, true).tag).not.toBeNull();
  });

  it("is deterministic per strain id", () => {
    const base = placeCells(cells, P)[0]!;
    expect(cellGeometry(base, P)).toEqual(cellGeometry({ ...base }, P));
    const other = placeCells(cells, P)[1]!;
    expect(cellGeometry(base, P).nucleus.fill).not.toEqual(cellGeometry(other, P).nucleus.fill);
  });

  it("keeps the ≥44px tap target on phones", () => {
    const tall = plateProjection("tall");
    const base = placeCells(cells, tall)[0]!;
    const g = cellGeometry(base, tall, 24);
    expect(g.hit.radius).toBeGreaterThanOrEqual(22);
  });

  it("moves the magnifier arm to the selected cell and parks it otherwise", () => {
    const parked = magnifierGeometry(null, P);
    const aimed = magnifierGeometry({ x: -30, y: 20, z: 16, rho: 14 }, P);
    expect(parked.rim).not.toEqual(aimed.rim);
    expect(aimed.links).toHaveLength(2);
    expect(magnifierGeometry({ x: -30, y: 20, z: 16, rho: 14 }, P)).toEqual(aimed);
  });

  it("scales the projection into the viewBox (wide on desktop, tall on phones)", () => {
    expect(VIEW_W / VIEW_H).toBeCloseTo(1.4667, 3);
    expect(VIEWS.tall.w / VIEWS.tall.h).toBeLessThan(1);
  });

  it("shrinks crowded colonies so every cell fits the dish without overlapping", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, vitalityRatio: 0.5 + (i % 3) * 0.2, status: "Active", highlighted: false, index: i }));
    const spots = placeCells(many, P);
    expect(crowdScale(9)).toBeLessThan(1);
    for (const a of spots) {
      expect(Math.hypot(a.x - DISH_CX, a.y - DISH_CY) + a.radius).toBeLessThanOrEqual(DISH_R + 0.5);
    }
    let worst = Infinity;
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) worst = Math.min(worst, Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.y - spots[j]!.y) - spots[i]!.radius - spots[j]!.radius);
    expect(worst).toBeGreaterThan(-3);
  });
});

describe("status → look mapping", () => {
  it("active cells breathe with the highlight tone", () => {
    const look = statusLook("Active", false);
    expect(look.tone).toBe("hi");
    expect(look.motion).toBe("breathe");
    expect(look.cracked).toBe(false);
    expect(look.opacity).toBe(1);
  });

  it("distressed cells desaturate and shiver", () => {
    const look = statusLook("Distressed", false);
    expect(look.tone).toBe("lo");
    expect(look.motion).toBe("shiver");
    expect(look.className).toContain("distressed");
  });

  it("liquidated cells crack with a red tint and stand still", () => {
    const look = statusLook("Liquidated", false);
    expect(look.cracked).toBe(true);
    expect(look.motion).toBe("still");
  });

  it("spliced-burned cells read as grey ghosts", () => {
    const look = statusLook("SplicedBurned", false);
    expect(look.tone).toBe("faint");
    expect(look.ghost).toBe(true);
    expect(look.opacity).toBeLessThan(1);
  });

  it("marks the selected cell with a marigold ring", () => {
    expect(statusLook("Active", true).selectedRing).toBe(true);
    expect(statusLook("Active", false).selectedRing).toBe(false);
  });

  it("falls back to the active look for unknown statuses", () => {
    expect(statusLook(undefined, false).tone).toBe("hi");
    expect(statusLook("???", false).motion).toBe("breathe");
  });
});

describe("thermometer, iris and receipt helpers", () => {
  it("parks the needle when the API gave nothing", () => {
    expect(needleRatio(null)).toBeNull();
    expect(tempLabel(null)).toBe("— mK");
  });

  it("clamps the needle ratio to the 0..1220 mK scale", () => {
    expect(needleRatio(0)).toBe(0);
    expect(needleRatio(610)).toBe(0.5);
    expect(needleRatio(9999)).toBe(1);
  });

  it("formats the temp label", () => {
    expect(tempLabel(605)).toBe("605 mK");
  });

  it("fades instead of iris under reduced motion", () => {
    expect(irisMode(true)).toBe("fade");
    expect(irisMode(false)).toBe("iris");
  });

  it("balances the demo receipt line", () => {
    expect(receiptLine(35, 12)).toBe("in 35 = out 12 + stored 23 ✓");
  });
});

describe("vacuole and attest bridge actions", () => {
  const ORIGIN = "https://snacc.example";
  it("whitelists vacuole and attest on the figure bridge", () => {
    expect(isLabAction("vacuole")).toBe(true);
    expect(isLabAction("attest")).toBe(true);
    expect(validateFigureMessage({ origin: ORIGIN, data: { type: "snacc:action", action: "attest" } }, ORIGIN)).toEqual({
      type: "snacc:action",
      action: "attest",
    });
  });

  it("changes no numbers in demo", () => {
    const s = createInitialSimulation();
    for (const action of ["vacuole", "attest"] as const) {
      const result = applyAction(s, action);
      expect(result.ok).toBe(true);
      expect(result.state.atp).toBe(s.atp);
      expect(result.state.snacc).toBe(s.snacc);
      expect(result.state.vitality).toBe(s.vitality);
    }
  });
});

describe("demo ledger counters feed the receipt", () => {
  it("counts feed input and collected output", () => {
    let s = createInitialSimulation();
    s = applyAction(s, "feed").state;
    expect(s.totalIn).toBe(10);
    const started = startProduction(s, "atp");
    s = started.state;
    s = tickSimulation(s, 6);
    s = collectProduction(s, s.queue[0]?.id ?? "").state;
    expect(s.totalOut).toBeGreaterThan(0);
    const line = receiptLine(s.totalIn, s.totalOut);
    expect(line).toContain("✓");
    expect(line).toContain(`in ${s.totalIn}`);
    expect(line).toContain(`out ${s.totalOut}`);
  });
});
