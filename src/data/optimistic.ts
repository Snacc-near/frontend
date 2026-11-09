/**
 * Pengelola status optimis untuk aksi pemain (UI-123..126).
 * Vitalitas langsung naik dengan tampilan garis belang "menunggu",
 * kemudian terkonfirmasi dari chain atau dikembalikan jika transaksi gagal.
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
   * Terapkan kenaikan vitalitas secara optimis (garis belang menunggu).
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

    // Bila tidak ada konfirmasi dalam waktu timeout, kembalikan ke nilai awal
    this.timeoutId = setTimeout(() => {
      this.revert("waktu tunggu konfirmasi habis");
    }, timeoutMs);
  }

  /**
   * Konfirmasi bahwa aksi berhasil tercatat on-chain.
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

    // Reset status ke idle setelah beberapa saat
    setTimeout(() => {
      if (this.state.status === "confirmed") {
        this.state = { ...this.state, status: "idle" };
        this.notify();
      }
    }, 1200);
  }

  /**
   * Kembalikan vitalitas ke nilai awal jika gagal.
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

    // Reset status ke idle setelah beberapa saat
    setTimeout(() => {
      if (this.state.status === "reverted") {
        this.state = { ...this.state, status: "idle" };
        this.notify();
      }
    }, 2000);
  }

  /**
   * Sinkronisasi nilai dasar dari API on-chain jika tidak sedang pending.
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
