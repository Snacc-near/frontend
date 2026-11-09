/**
 * Entitas sel hidup organik (The Living Strain).
 * Bernapas dan berdenyut secara prosedural, memiliki organel internal (mitokondria, nukleus, lisosom),
 * serta memproyeksikan bayangan lembut di dasar cawan petri.
 */

import type { MacroZone } from "../config/zones.ts";
import { ZONE_THEMES } from "../config/zones.ts";

export interface CellOptions {
  id: number;
  label: string;
  isPlayer?: boolean;
  x: number;
  y: number;
  radius?: number;
  vitalityRatio?: number;
  zone?: MacroZone;
  mitokondria?: number;
  nukleus?: number;
  lisosom?: number;
  isLiquidated?: boolean;
}

export class LivingCell {
  public id: number;
  public label: string;
  public isPlayer: boolean;
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
  private phaseOffset: number;

  constructor(opts: CellOptions) {
    this.id = opts.id;
    this.label = opts.label;
    this.isPlayer = opts.isPlayer ?? false;
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
    this.phaseOffset = Math.random() * Math.PI * 2;
  }

  public update(_dt: number, dishRadiusX: number, dishRadiusY: number, dishCenterX: number, dishCenterY: number): void {
    if (this.isPlayer) {
      // Inersia halus menuju target pointer/keyboard
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      this.vx = dx * 0.12;
      this.vy = dy * 0.12;
      this.x += this.vx;
      this.y += this.vy;
    } else {
      // Gerakan mengambang perlahan untuk sel lain di arena
      this.x += Math.sin(Date.now() * 0.001 + this.phaseOffset) * 0.3;
      this.y += Math.cos(Date.now() * 0.0008 + this.phaseOffset) * 0.25;
    }

    // Batasan di dalam elips cawan petri (radius aman 0.82)
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
    const cellColor = this.isLiquidated ? "#ef4444" : theme.color;
    const pulseSpeed = this.isPlayer ? 2.4 : 1.6;
    const pulseAmp = 0.06 + (1 - this.vitalityRatio) * 0.08;
    const breath = 1 + Math.sin(timeSec * pulseSpeed + this.phaseOffset) * pulseAmp;
    const r = this.baseRadius * breath;

    ctx.save();

    // 1. Bayangan lembut di bawah sel pada kaca cawan
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + r * 0.24, r * 1.08, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.filter = "blur(6px)";
    ctx.fill();
    ctx.filter = "none";

    // 2. Pendaran luar bioluminescent (outer glow)
    const haloRadius = r * 1.7;
    const haloGrad = ctx.createRadialGradient(this.x, this.y, r * 0.6, this.x, this.y, haloRadius);
    haloGrad.addColorStop(0, cellColor);
    haloGrad.addColorStop(0.4, theme.dishGlow);
    haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.beginPath();
    ctx.arc(this.x, this.y, haloRadius, 0, Math.PI * 2);
    ctx.fillStyle = haloGrad;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 3. Membran sel organik (gelombang harmonik prosedural)
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

    // Gradien sitoplasma sel
    const cytoGrad = ctx.createRadialGradient(
      this.x - r * 0.2,
      this.y - r * 0.2,
      r * 0.1,
      this.x,
      this.y,
      r,
    );
    cytoGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    cytoGrad.addColorStop(0.3, cellColor);
    cytoGrad.addColorStop(0.85, "rgba(9, 24, 40, 0.88)");
    cytoGrad.addColorStop(1, cellColor);

    ctx.fillStyle = cytoGrad;
    ctx.fill();

    // Garis tepi membran
    ctx.strokeStyle = cellColor;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 4. Nukleus sel (inti tengah)
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

    // Pendaran inti
    ctx.beginPath();
    ctx.arc(nucX, nucY, nucRadius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 5. Organel (mitokondria kecil & lisosom)
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

    // 6. Label identitas sel kecil di bawah sel
    ctx.font = "11px 'DM Sans', -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(241, 245, 249, 0.85)";
    ctx.fillText(this.label, this.x, this.y + r + 16);

    ctx.restore();
  }
}
