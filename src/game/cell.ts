/**
 * The organic living-cell entity (The Living Strain).
 * It breathes and pulses procedurally, has internal organelles (mitochondria, nucleus, lysosome),
 * and projects a soft shadow onto the petri dish floor.
 */

import type { MacroZone } from "../config/zones.ts";
import { ZONE_THEMES } from "../config/zones.ts";

export interface CellOptions {
  id: number;
  label: string;
  owner?: string;
  isPlayer?: boolean;
  isHighlighted?: boolean;
  x: number;
  y: number;
  radius?: number;
  vitalityRatio?: number;
  zone?: MacroZone;
  mitokondria?: number;
  nukleus?: number;
  lisosom?: number;
  isLiquidated?: boolean;
  status?: string;
}

export class LivingCell {
  public id: number;
  public label: string;
  public owner?: string;
  public isPlayer: boolean;
  public isHighlighted: boolean;
  public x: number;
  public y: number;
  public targetX: number;
  public targetY: number;
  public vx = 0;
  public vy = 0;
  public baseRadius: number;
  public vitalityRatio: number;
  public zone: MacroZone;
  public mitokondria: number;
  public nukleus: number;
  public lisosom: number;
  public isLiquidated: boolean;
  public status?: string;
  public fedPulse = 0;
  private phaseOffset: number;

  constructor(opts: CellOptions) {
    this.id = opts.id;
    this.label = opts.label;
    this.owner = opts.owner;
    this.isPlayer = opts.isPlayer ?? false;
    this.isHighlighted = opts.isHighlighted ?? false;
    this.x = opts.x;
    this.y = opts.y;
    this.targetX = opts.x;
    this.targetY = opts.y;
    this.baseRadius = opts.radius ?? (opts.isPlayer ? 44 : 32);
    this.vitalityRatio = opts.vitalityRatio ?? 0.85;
    this.zone = opts.zone ?? "Goldilocks";
    this.mitokondria = opts.mitokondria ?? 2;
    this.nukleus = opts.nukleus ?? 1;
    this.lisosom = opts.lisosom ?? 1;
    this.isLiquidated = opts.isLiquidated ?? false;
    this.status = opts.status;
    this.phaseOffset = Math.random() * Math.PI * 2;
  }

  public containsPoint(px: number, py: number): boolean {
    return Math.hypot(this.x - px, this.y - py) <= this.baseRadius * 1.35;
  }

  public triggerFedPulse(): void {
    this.fedPulse = 1.0;
  }

  public update(dt: number, dishRadiusX: number, dishRadiusY: number, dishCenterX: number, dishCenterY: number): void {
    if (this.fedPulse > 0) {
      this.fedPulse = Math.max(0, this.fedPulse - dt * 2.2);
    }

    if (this.isPlayer) {
      // Gentle inertia toward the pointer/keyboard target
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      this.vx = dx * 0.12;
      this.vy = dy * 0.12;
      this.x += this.vx;
      this.y += this.vy;
    } else {
      // Slow floating movement for the other cells in the arena
      this.x += Math.sin(Date.now() * 0.001 + this.phaseOffset) * 0.3;
      this.y += Math.cos(Date.now() * 0.0008 + this.phaseOffset) * 0.25;
    }

    // The safe boundary inside the petri dish ellipse (a 0.82 safety radius)
    const normX = (this.x - dishCenterX) / (dishRadiusX * 0.82);
    const normY = (this.y - dishCenterY) / (dishRadiusY * 0.82);
    const distSq = normX * normX + normY * normY;
    if (distSq > 1) {
      const dist = Math.sqrt(distSq);
      this.x = dishCenterX + (normX / dist) * dishRadiusX * 0.82;
      this.y = dishCenterY + (normY / dist) * dishRadiusY * 0.82;
      this.targetX = this.x;
      this.targetY = this.y;
    }
  }

  public render(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const theme = ZONE_THEMES[this.zone];
    const burned = this.status === "SplicedBurned";
    const cellColor = this.isLiquidated || this.status === "Liquidated"
      ? "#ef4444"
      : burned
        ? "#64748b"
        : this.isHighlighted
          ? "#38bdf8"
          : theme.color;

    const pulseSpeed = this.isPlayer || this.isHighlighted ? 2.4 : 1.6;
    const pulseAmp = 0.06 + (1 - this.vitalityRatio) * 0.08;
    const breath = 1 + Math.sin(timeSec * pulseSpeed + this.phaseOffset) * pulseAmp + this.fedPulse * 0.15;
    const r = this.baseRadius * breath;

    ctx.save();

    // Terminal statuses are drawn dimmed so they read as dead cells, not live ones
    if (burned || this.isLiquidated || this.status === "Liquidated") {
      ctx.globalAlpha = 0.55;
    }

    // 1. A soft shadow under the cell on the dish glass
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + r * 0.24, r * 1.08, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.filter = "blur(6px)";
    ctx.fill();
    ctx.filter = "none";

    // 2. The player-account highlight ring (when highlighted)
    if (this.isHighlighted || this.isPlayer) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 1.45, 0, Math.PI * 2);
      ctx.strokeStyle = this.isHighlighted ? "rgba(56, 189, 248, 0.75)" : "rgba(52, 211, 153, 0.75)";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // 3. The bioluminescent outer glow
    const haloRadius = r * (this.isHighlighted ? 2.1 : 1.7);
    const haloGrad = ctx.createRadialGradient(this.x, this.y, r * 0.6, this.x, this.y, haloRadius);
    haloGrad.addColorStop(0, cellColor);
    haloGrad.addColorStop(0.4, this.isHighlighted ? "rgba(56, 189, 248, 0.25)" : theme.dishGlow);
    haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.beginPath();
    ctx.arc(this.x, this.y, haloRadius, 0, Math.PI * 2);
    ctx.fillStyle = haloGrad;
    ctx.globalAlpha = this.isHighlighted ? 0.85 : 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 4. The organic cell membrane (procedural harmonic waves)
    const pointsCount = 36;
    ctx.beginPath();
    for (let i = 0; i <= pointsCount; i++) {
      const angle = (i / pointsCount) * Math.PI * 2;
      const wave =
        Math.sin(angle * 4 + timeSec * 3 + this.phaseOffset) * (r * 0.04) +
        Math.cos(angle * 7 - timeSec * 2) * (r * 0.025);
      const pr = r + wave;
      const px = this.x + Math.cos(angle) * pr;
      const py = this.y + Math.sin(angle) * pr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // The cell cytoplasm gradient
    const cytoGrad = ctx.createRadialGradient(
      this.x - r * 0.2,
      this.y - r * 0.2,
      r * 0.1,
      this.x,
      this.y,
      r,
    );
    cytoGrad.addColorStop(0, this.fedPulse > 0 ? "rgba(110, 231, 183, 0.98)" : "rgba(255, 255, 255, 0.95)");
    cytoGrad.addColorStop(0.3, cellColor);
    cytoGrad.addColorStop(0.85, "rgba(9, 24, 40, 0.88)");
    cytoGrad.addColorStop(1, cellColor);

    ctx.fillStyle = cytoGrad;
    ctx.fill();

    // The membrane edge stroke
    ctx.strokeStyle = cellColor;
    ctx.lineWidth = this.isHighlighted ? 2.8 : 2.2;
    ctx.stroke();

    // 5. The cell nucleus (the center core)
    const nucRadius = r * 0.32;
    const nucX = this.x + Math.sin(timeSec * 1.2 + this.phaseOffset) * 2;
    const nucY = this.y + Math.cos(timeSec * 1.1 + this.phaseOffset) * 2;

    ctx.beginPath();
    ctx.arc(nucX, nucY, nucRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(4, 12, 22, 0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // The core glow
    ctx.beginPath();
    ctx.arc(nucX, nucY, nucRadius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 6. Organelles (small mitochondria & lysosomes)
    for (let m = 0; m < Math.min(this.mitokondria, 4); m++) {
      const mAngle = (m / 4) * Math.PI * 2 + timeSec * 0.6;
      const mDist = r * 0.62;
      const mx = this.x + Math.cos(mAngle) * mDist;
      const my = this.y + Math.sin(mAngle) * mDist;

      ctx.beginPath();
      ctx.ellipse(mx, my, 4.5, 2.2, mAngle, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
    }

    // 7. The small cell identity label under the cell
    ctx.font = "11px 'DM Sans', -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = this.isHighlighted ? "#7dd3fc" : "rgba(241, 245, 249, 0.85)";
    const statusSuffix = this.isLiquidated || this.status === "Liquidated"
      ? " (liquidated)"
      : this.status === "SplicedBurned"
        ? " (burned)"
        : "";
    ctx.fillText(
      this.isHighlighted ? `${this.label} (yours)${statusSuffix}` : `${this.label}${statusSuffix}`,
      this.x,
      this.y + r + 16,
    );

    ctx.restore();
  }
}
