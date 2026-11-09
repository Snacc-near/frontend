import { describe, it, expect } from "vitest";
import {
  applyAction,
  collectProduction,
  costAtLevel,
  createInitialSimulation,
  hungerRate,
  outputMultiplier,
  startProduction,
  tickSimulation,
} from "../src/game/simulation.ts";

describe("demo simulation loop", () => {
  it("starts from the official vitality constant and checks bounds", () => {
    const s = createInitialSimulation();
    expect(s.vitality).toBe(8500);
    expect(s.vitality).toBeLessThanOrEqual(10000);
    expect(s.crucibleTempMk).toBe(605);
  });

  it("produces atp on a timer and collect adds the boosted amount", () => {
    let s = createInitialSimulation();
    const start = startProduction(s, "atp");
    expect(start.ok).toBe(true);
    s = start.state;
    expect(s.queue).toHaveLength(1);
    s = tickSimulation(s, 6);
    expect(s.queue[0]?.ready).toBe(true);
    const collected = collectProduction(s, s.queue[0]?.id ?? "");
    expect(collected.ok).toBe(true);
    const expected = Math.round(25 * outputMultiplier(s.organel, "atp"));
    expect(collected.state.atp).toBe(s.atp + expected);
  });

  it("rejects transmute without enough spores", () => {
    const s = { ...createInitialSimulation(), spores: 2 };
    const result = startProduction(s, "enzymes");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("spores");
  });

  it("rejects synthesize without enough enzymes", () => {
    const s = { ...createInitialSimulation(), enzymes: 1 };
    const result = startProduction(s, "elixir");
    expect(result.ok).toBe(false);
  });

  it("feeds and is capped at maximum vitality", () => {
    const s = { ...createInitialSimulation(), vitality: 9900, snacc: 100 };
    const result = applyAction(s, "feed");
    expect(result.ok).toBe(true);
    expect(result.state.vitality).toBe(10000);
    expect(result.state.snacc).toBe(90);
  });

  it("upgrades organelles with scaling cost and caps at level 5", () => {
    expect(costAtLevel(0)).toBe(40);
    expect(costAtLevel(4)).toBe(200);
    let s = { ...createInitialSimulation(), atp: 500, organel: { mitokondria: 0, nukleus: 0, lisosom: 0 } };
    const up = applyAction(s, "nucleus");
    expect(up.ok).toBe(true);
    expect(up.state.organel.nukleus).toBe(1);
    expect(up.state.atp).toBe(460);
    const maxed = applyAction({ ...up.state, organel: { ...up.state.organel, nukleus: 5 } }, "nucleus");
    expect(maxed.ok).toBe(false);
    expect(maxed.error).toContain("max level");
  });

  it("raises output by 10% per nucleus level and cuts hunger per lysosome level", () => {
    const base = outputMultiplier({ mitokondria: 0, nukleus: 0, lisosom: 0 }, "enzymes");
    const plusTwo = outputMultiplier({ mitokondria: 0, nukleus: 2, lisosom: 0 }, "enzymes");
    expect(base).toBe(1);
    expect(plusTwo).toBeCloseTo(1.2);
    expect(hungerRate(100, 0)).toBe(100);
    expect(hungerRate(100, 5)).toBe(50);
  });

  it("enforces the divide gate within merges plus lyses", () => {
    let s = { ...createInitialSimulation(), atp: 100, births: 1, merges: 0, lyses: 0 };
    const blocked = applyAction(s, "divide");
    expect(blocked.ok).toBe(false);
    s = { ...s, merges: 1 };
    const allowed = applyAction(s, "divide");
    expect(allowed.ok).toBe(true);
    expect(allowed.state.births).toBe(2);
  });

  it("harvests using the base burst 200 bps and restores initial vitality", () => {
    const s = { ...createInitialSimulation(), vitality: 10000, snacc: 0 };
    const result = applyAction(s, "harvest");
    expect(result.ok).toBe(true);
    expect(result.state.snacc).toBe(200);
    expect(result.state.vitality).toBe(8500);
  });

  it("does not collect before the timer is ready", () => {
    let s = startProduction(createInitialSimulation(), "atp").state;
    s = tickSimulation(s, 1);
    const result = collectProduction(s, s.queue[0]?.id ?? "");
    expect(result.ok).toBe(false);
  });
});
