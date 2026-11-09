import { describe, it, expect } from "vitest";
import { OptimisticManager } from "../src/data/optimistic.ts";

describe("UI-123..126: The Optimistic State Manager (Pending, Confirm, Revert)", () => {
  it("initializes with an idle status and the base value", () => {
    const mgr = new OptimisticManager(8000);
    const state = mgr.getState();
    expect(state.baseVitality).toBe(8000);
    expect(state.currentVitality).toBe(8000);
    expect(state.status).toBe("idle");
    expect(state.pendingDelta).toBe(0);
  });

  it("raises vitality instantly with a pending status on feed", () => {
    const mgr = new OptimisticManager(8000);
    mgr.applyFeed(250);
    const state = mgr.getState();
    expect(state.baseVitality).toBe(8000);
    expect(state.currentVitality).toBe(8250);
    expect(state.pendingDelta).toBe(250);
    expect(state.status).toBe("pending");
  });

  it("confirms the vitality change and updates baseVitality", () => {
    const mgr = new OptimisticManager(8000);
    mgr.applyFeed(250);
    mgr.confirm();
    const state = mgr.getState();
    expect(state.baseVitality).toBe(8250);
    expect(state.currentVitality).toBe(8250);
    expect(state.status).toBe("confirmed");
    expect(state.pendingDelta).toBe(0);
  });

  it("restores the vitality (rollback) when the transaction fails / reverts", () => {
    const mgr = new OptimisticManager(8000);
    mgr.applyFeed(300);
    expect(mgr.getState().currentVitality).toBe(8300);

    mgr.revert("on-chain failure");
    const state = mgr.getState();
    expect(state.baseVitality).toBe(8000);
    expect(state.currentVitality).toBe(8000);
    expect(state.status).toBe("reverted");
  });
});
