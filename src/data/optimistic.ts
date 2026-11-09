/**
 * The optimistic state manager for player actions (UI-123..126).
 * Vitality rises immediately with a striped "waiting" bar,
 * then is confirmed from the chain or rolled back when the transaction fails.
 */

import { VITALITY_MAX } from "../config/constants.ts";

export type OptimisticStatus = "idle" | "pending" | "confirmed" | "reverted";

export interface OptimisticVitalityState {
  baseVitality: number;
  currentVitality: number;
  pendingDelta: number;
  status: OptimisticStatus;
  lastActionTimestamp: number;
}

export class OptimisticManager {
  private state: OptimisticVitalityState;
  private subscribers = new Set<(state: OptimisticVitalityState) => void>();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(initialVitality = 8500) {
    this.state = {
      baseVitality: initialVitality,
      currentVitality: initialVitality,
      pendingDelta: 0,
      status: "idle",
      lastActionTimestamp: 0,
    };
  }

  public getState(): OptimisticVitalityState {
    return { ...this.state };
  }

  public subscribe(cb: (state: OptimisticVitalityState) => void): () => void {
    this.subscribers.add(cb);
    cb(this.getState());
    return () => this.subscribers.delete(cb);
  }

  private notify(): void {
    const s = this.getState();
    this.subscribers.forEach((cb) => cb(s));
  }

  /**
   * Apply the vitality increase optimistically (striped bar while pending).
   */
  public applyFeed(delta = 250, timeoutMs = 8000): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    const nextVitality = Math.min(VITALITY_MAX, this.state.baseVitality + delta);
    this.state = {
      ...this.state,
      currentVitality: nextVitality,
      pendingDelta: delta,
      status: "pending",
      lastActionTimestamp: Date.now(),
    };
    this.notify();

    // When no confirmation arrives within the timeout, roll back to the base value
    this.timeoutId = setTimeout(() => {
      this.revert("confirmation wait timed out");
    }, timeoutMs);
  }

  /**
   * Confirm that the action was recorded on-chain.
   */
  public confirm(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.state = {
      baseVitality: this.state.currentVitality,
      currentVitality: this.state.currentVitality,
      pendingDelta: 0,
      status: "confirmed",
      lastActionTimestamp: Date.now(),
    };
    this.notify();

    // Reset the status to idle after a moment
    this.timeoutId = setTimeout(() => {
      if (this.state.status === "confirmed") {
        this.state = { ...this.state, status: "idle" };
        this.notify();
      }
    }, 1200);
  }

  /**
   * Roll the vitality back to the base value on failure.
   */
  public revert(_reason?: string): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.state = {
      baseVitality: this.state.baseVitality,
      currentVitality: this.state.baseVitality,
      pendingDelta: 0,
      status: "reverted",
      lastActionTimestamp: Date.now(),
    };
    this.notify();

    // Reset the status to idle after a moment
    setTimeout(() => {
      if (this.state.status === "reverted") {
        this.state = { ...this.state, status: "idle" };
        this.notify();
      }
    }, 2000);
  }

  /**
   * Sync the base value from the on-chain API when not pending.
   */
  public syncFromChain(vitality: number): void {
    if (this.state.status === "pending") return;
    this.state = {
      ...this.state,
      baseVitality: vitality,
      currentVitality: vitality,
    };
    this.notify();
  }
}
