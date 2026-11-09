import { describe, it, expect } from "vitest";
import { OptimisticManager } from "../src/data/optimistic.ts";

describe("UI-123..126: Pengelola Status Optimis (Pending, Confirm, Revert)", () => {
  it("menginisialisasi dengan status idle dan nilai dasar", () => {
    const mgr = new OptimisticManager(8000);
    const state = mgr.getState();
    expect(state.baseVitality).toBe(8000);
    expect(state.currentVitality).toBe(8000);
    expect(state.status).toBe("idle");
    expect(state.pendingDelta).toBe(0);
  });

  it("menaikkan vitalitas seketika dengan status pending saat feed", () => {
    const mgr = new OptimisticManager(8000);
    mgr.applyFeed(250);
    const state = mgr.getState();
    expect(state.baseVitality).toBe(8000);
    expect(state.currentVitality).toBe(8250);
    expect(state.pendingDelta).toBe(250);
    expect(state.status).toBe("pending");
  });

  it("mengonfirmasi perubahan vitalitas dan memperbarui baseVitality", () => {
    const mgr = new OptimisticManager(8000);
    mgr.applyFeed(250);
    mgr.confirm();
    const state = mgr.getState();
    expect(state.baseVitality).toBe(8250);
    expect(state.currentVitality).toBe(8250);
    expect(state.status).toBe("confirmed");
    expect(state.pendingDelta).toBe(0);
  });

  it("mengembalikan nilai vitalitas (rollback) saat transaksi gagal / di-revert", () => {
    const mgr = new OptimisticManager(8000);
    mgr.applyFeed(300);
    expect(mgr.getState().currentVitality).toBe(8300);

    mgr.revert("gagal on-chain");
    const state = mgr.getState();
    expect(state.baseVitality).toBe(8000);
    expect(state.currentVitality).toBe(8000);
    expect(state.status).toBe("reverted");
  });
});
