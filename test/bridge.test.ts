import { describe, it, expect } from "vitest";
import {
  buildPlayMessage,
  buildStateMessage,
  isValidStrainState,
  strainToBridgeState,
  validateFigureMessage,
} from "../src/game/bridge.ts";

const ORIGIN = "https://snacc.example";

const baseStrain = {
  strain_id: 1,
  status: "Active",
  vitality: 8500,
  effective_vitality: 8500,
  atp_balance: "50",
  organel: { mitokondria: 2, nukleus: 1, lisosom: 1 },
  generation: 1,
  role_mask: 1,
};

describe("cell lab bridge message validation", () => {
  it("accepts snacc:ready from the same origin", () => {
    const msg = validateFigureMessage({ origin: ORIGIN, data: { type: "snacc:ready" } }, ORIGIN);
    expect(msg).toEqual({ type: "snacc:ready" });
  });

  it("rejects messages from a foreign origin even with valid shape", () => {
    const msg = validateFigureMessage(
      { origin: "https://evil.example", data: { type: "snacc:ready" } },
      ORIGIN,
    );
    expect(msg).toBeNull();
  });

  it("accepts snacc:action only for known lab actions", () => {
    expect(
      validateFigureMessage({ origin: ORIGIN, data: { type: "snacc:action", action: "feed" } }, ORIGIN),
    ).toEqual({ type: "snacc:action", action: "feed" });
    expect(
      validateFigureMessage({ origin: ORIGIN, data: { type: "snacc:action", action: "drop-table" } }, ORIGIN),
    ).toBeNull();
  });

  it("accepts snacc:done only for known lab actions", () => {
    expect(
      validateFigureMessage({ origin: ORIGIN, data: { type: "snacc:done", action: "atp" } }, ORIGIN),
    ).toEqual({ type: "snacc:done", action: "atp" });
    expect(
      validateFigureMessage({ origin: ORIGIN, data: { type: "snacc:done" } }, ORIGIN),
    ).toBeNull();
  });

  it("rejects non-object payloads and unknown types", () => {
    expect(validateFigureMessage({ origin: ORIGIN, data: "snacc:ready" }, ORIGIN)).toBeNull();
    expect(validateFigureMessage({ origin: ORIGIN, data: null }, ORIGIN)).toBeNull();
    expect(validateFigureMessage({ origin: ORIGIN, data: [] }, ORIGIN)).toBeNull();
    expect(validateFigureMessage({ origin: ORIGIN, data: { type: "snacc:evil" } }, ORIGIN)).toBeNull();
  });

  it("validates the strain state shape with organelle bounds 0..5", () => {
    expect(isValidStrainState(baseStrain)).toBe(true);
    expect(isValidStrainState({ ...baseStrain, organel: { mitokondria: 6, nukleus: 1, lisosom: 1 } })).toBe(false);
    expect(isValidStrainState({ ...baseStrain, vitality: NaN })).toBe(false);
    expect(isValidStrainState(null)).toBe(false);
  });

  it("builds state and play messages per the GDD contract", () => {
    const state = buildStateMessage(baseStrain, "Goldilocks");
    expect(state.type).toBe("snacc:state");
    expect(state.strain.strain_id).toBe(1);
    expect(state.zone).toBe("Goldilocks");
    expect(buildPlayMessage("divide")).toEqual({ type: "snacc:play", action: "divide" });
  });

  it("normalizes a partial strain into a bridge state without inventing vitality", () => {
    const normalized = strainToBridgeState({ strain_id: 7 });
    expect(normalized.vitality).toBe(0);
    expect(normalized.atp_balance).toBe("0");
    expect(normalized.organel).toEqual({ mitokondria: 0, nukleus: 0, lisosom: 0 });
  });
});
