/**
 * The Petri Dish Game Engine (Canvas 2D / 60 FPS / DPR Max 2).
 * Runs entirely outside React state for smooth, jank-free performance.
 * Pauses when the tab is hidden (visibilitychange) to save resources.
 */

import { MAX_DPR } from "../config/constants.ts";
import type { MacroZone } from "../config/zones.ts";
import { LivingCell } from "./cell.ts";
import { EffectsManager } from "./effects.ts";
import { PetriDish } from "./petriDish.ts";
import { SporeManager } from "./spore.ts";

export type GameMode = "demo" | "live";

export interface GameEngineCallbacks {
  onSporeCollected?: (valueAtp: number, bonusTempMk: number) => void;
  onCellClick?: (cellId: number) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dish: PetriDish;
  private sporeManager: SporeManager;
  private effects: EffectsManager;
  private playerCell: LivingCell;
  private otherCells: LivingCell[] = [];
  private callbacks: GameEngineCallbacks;

  private mode: GameMode = "demo";
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private timeSec = 0;
  private width = 0;
  private height = 0;

  // Input state
  private keysDown = new Set<string>();
  private pointerDown = false;
  private targetPointerX = 0;
  private targetPointerY = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Failed to acquire the 2D canvas context");
    this.ctx = ctx;
    this.callbacks = callbacks;

    this.dish = new PetriDish();
    this.effects = new EffectsManager();
    this.sporeManager = new SporeManager(16);

    // Initialize the player cell in demo mode (Strain #1)
    this.playerCell = new LivingCell({
      id: 1,
      label: "strain #1",
      isPlayer: true,
      x: 0,
      y: 0,
      radius: 42,
      vitalityRatio: 0.85,
      zone: "Goldilocks",
    });

    this.bindEvents();
    this.handleResize();
  }

  public setMode(mode: GameMode): void {
    this.mode = mode;
    if (mode === "live") {
      // In live mode, the cell position is pinned steady in the dish
      this.keysDown.clear();
      this.pointerDown = false;
    }
  }

  public setZone(zone: MacroZone): void {
    this.dish.zone = zone;
    this.playerCell.zone = zone;
    for (const c of this.otherCells) {
      c.zone = zone;
    }
  }

  public setPlayerVitality(ratio: number): void {
    this.playerCell.vitalityRatio = Math.max(0.1, Math.min(1, ratio));
  }

  /**
   * Trigger the Nutrient Burst visual effect inside the dish.
   */
  public triggerNutrientBurst(x?: number, y?: number): void {
    const burstX = x ?? this.dish.centerX + (Math.random() - 0.5) * 160;
    const burstY = y ?? this.dish.centerY + (Math.random() - 0.5) * 120;
    this.effects.triggerNutrientBurst(burstX, burstY, 32, "#34d399");
  }

  /**
   * Trigger the lysis of a specific on-chain strain.
   */
  public triggerNutrientBurstOnStrain(strainId: number): void {
    const target =
      this.otherCells.find((c) => c.id === strainId) ??
      (this.playerCell.id === strainId ? this.playerCell : null);

    if (target) {
      target.isLiquidated = true;
      this.effects.triggerNutrientBurst(target.x, target.y, 36, "#34d399");
    } else {
      this.triggerNutrientBurst();
    }
  }

  /**
   * Trigger the on-chain cell-fed visual effect.
   */
  public triggerCellFed(strainId: number): void {
    const target =
      this.otherCells.find((c) => c.id === strainId) ??
      (this.playerCell.id === strainId ? this.playerCell : null);

    if (target) {
      target.triggerFedPulse();
      this.effects.triggerShockwave(target.x, target.y, "#10b981", 65);
    }
  }

  /**
   * Highlight the cells owned by a specific NEAR account.
   */
  public highlightAccount(account: string): void {
    const norm = account.trim().toLowerCase();
    this.playerCell.isHighlighted = Boolean(norm && this.playerCell.owner?.toLowerCase() === norm);
    for (const c of this.otherCells) {
      c.isHighlighted = Boolean(norm && c.owner?.toLowerCase() === norm);
    }
  }

  /**
   * Update the cell list from the on-chain Live data (/api/strains).
   */
  public setLiveStrains(
    strains: { id: number; owner: string; vitality?: number }[],
    highlightOwner?: string,
  ): void {
    const normFilter = highlightOwner?.trim().toLowerCase();

    // Map the on-chain strains to living cells in the petri dish
    this.otherCells = strains.map((s, idx) => {
      const total = Math.max(strains.length, 1);
      const angle = (idx / total) * Math.PI * 2;
      const dist = Math.min(this.dish.radiusX, this.dish.radiusY) * 0.58;
      const isOwner = Boolean(normFilter && s.owner.toLowerCase() === normFilter);

      return new LivingCell({
        id: s.id,
        label: `strain #${s.id}`,
        owner: s.owner,
        isPlayer: isOwner,
        isHighlighted: isOwner,
        x: this.dish.centerX + Math.cos(angle) * dist,
        y: this.dish.centerY + Math.sin(angle) * dist,
        radius: isOwner ? 38 : 30,
        vitalityRatio: (s.vitality ?? 8000) / 10000,
        zone: this.dish.zone,
      });
    });
  }

  /**
   * Backward compatibility alias untuk mode demo.
   */
  public setLiveCells(strains: { id: number; owner: string; vitality?: number }[]): void {
    this.setLiveStrains(strains);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private loop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.timeSec += dt;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    // 1. Process the player cell's movement input in demo mode only
    if (this.mode === "demo") {
      let moveX = 0;
      let moveY = 0;
      if (this.keysDown.has("KeyW") || this.keysDown.has("ArrowUp")) moveY -= 1;
      if (this.keysDown.has("KeyS") || this.keysDown.has("ArrowDown")) moveY += 1;
      if (this.keysDown.has("KeyA") || this.keysDown.has("ArrowLeft")) moveX -= 1;
      if (this.keysDown.has("KeyD") || this.keysDown.has("ArrowRight")) moveX += 1;

      if (moveX !== 0 || moveY !== 0) {
        const len = Math.hypot(moveX, moveY);
        const speed = 220 * dt;
        this.playerCell.targetX += (moveX / len) * speed;
        this.playerCell.targetY += (moveY / len) * speed;
      } else if (this.pointerDown) {
        this.playerCell.targetX = this.targetPointerX;
        this.playerCell.targetY = this.targetPointerY;
      }
    }

    // 2. Update the cell entities
    if (this.mode === "demo") {
      this.playerCell.update(dt, this.dish.radiusX, this.dish.radiusY, this.dish.centerX, this.dish.centerY);
    }
    for (const cell of this.otherCells) {
      cell.update(dt, this.dish.radiusX, this.dish.radiusY, this.dish.centerX, this.dish.centerY);
    }

    // 3. Update the spores & detect collisions (the harvesting) in demo mode
    this.sporeManager.update(this.timeSec);

    if (this.mode === "demo") {
      const spores = this.sporeManager.spores;
      for (let i = spores.length - 1; i >= 0; i--) {
        const sp = spores[i]!;
        const dist = Math.hypot(this.playerCell.x - sp.x, this.playerCell.y - sp.y);
        if (dist < this.playerCell.baseRadius + sp.radius + 6) {
          // Harvest the spore!
          this.effects.triggerShockwave(sp.x, sp.y, "#fbbf24", 75);
          this.callbacks.onSporeCollected?.(sp.valueAtp, sp.bonusTempMk);

          // Respawn a spore at a new random position
          spores.splice(i, 1);
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 0.76;
          sp.baseX = this.dish.centerX + Math.cos(angle) * this.dish.radiusX * r;
          sp.baseY = this.dish.centerY + Math.sin(angle) * this.dish.radiusY * r;
          sp.x = sp.baseX;
          sp.y = sp.baseY;
          spores.push(sp);
        }
      }
    }

    // 4. Update efek visual
    this.effects.update(dt);
  }

  private render(): void {
    const { offsetX, offsetY } = this.effects.update(0);

    this.ctx.save();
    // Apply the screen shake when a burst/lysis occurs
    this.ctx.translate(offsetX, offsetY);

    // 1. Draw the night-time petri dish & the vignette
    this.dish.render(this.ctx, this.width, this.height, this.timeSec);

    // 2. Draw the floating spores
    this.sporeManager.render(this.ctx, this.timeSec);

    // 3. Gambar efek gelombang & partikel
    this.effects.render(this.ctx);

    // 4. Draw the other cells in the arena
    for (const cell of this.otherCells) {
      cell.render(this.ctx, this.timeSec);
    }

    // 5. Draw the player's main cell in demo mode
    if (this.mode === "demo") {
      this.playerCell.render(this.ctx, this.timeSec);
    }

    this.ctx.restore();
  }

  private handlePointerClick(clickX: number, clickY: number): void {
    // Check whether the pointer clicked one of the cells in the dish
    for (const cell of this.otherCells) {
      if (cell.containsPoint(clickX, clickY)) {
        this.callbacks.onCellClick?.(cell.id);
        return;
      }
    }

    if (this.mode === "demo" && this.playerCell.containsPoint(clickX, clickY)) {
      this.callbacks.onCellClick?.(this.playerCell.id);
    }
  }

  private handleResize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    this.dish.resize(this.width, this.height);
    if (this.playerCell.x === 0 && this.playerCell.y === 0) {
      this.playerCell.x = this.dish.centerX;
      this.playerCell.y = this.dish.centerY;
      this.playerCell.targetX = this.dish.centerX;
      this.playerCell.targetY = this.dish.centerY;
    }
  };

  private bindEvents(): void {
    window.addEventListener("resize", this.handleResize);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    });

    window.addEventListener("keydown", (e) => {
      this.keysDown.add(e.code);
    });

    window.addEventListener("keyup", (e) => {
      this.keysDown.delete(e.code);
    });

    let pointerStartTime = 0;
    let pointerStartX = 0;
    let pointerStartY = 0;

    this.canvas.addEventListener("pointerdown", (e) => {
      this.pointerDown = true;
      this.targetPointerX = e.clientX;
      this.targetPointerY = e.clientY;
      pointerStartTime = performance.now();
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
    });

    window.addEventListener("pointermove", (e) => {
      if (this.pointerDown) {
        this.targetPointerX = e.clientX;
        this.targetPointerY = e.clientY;
      }
    });

    this.canvas.addEventListener("pointerup", (e) => {
      this.pointerDown = false;
      const duration = performance.now() - pointerStartTime;
      const dist = Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY);

      // When the touch lasts < 350 ms and moves < 8 px, treat it as a cell click
      if (duration < 350 && dist < 8) {
        this.handlePointerClick(e.clientX, e.clientY);
      }
    });

    window.addEventListener("pointercancel", () => {
      this.pointerDown = false;
    });
  }

  public dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
  }
}
