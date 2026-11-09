/**
 * Arena cawan petri malam hari (The Living Petri Dish).
 * Menggambar cawan elips dengan pendaran cairan sesuai zona aktif,
 * bayangan lembut tepi kaca, dan vinyet gelap di sekeliling arena.
 */

import type { MacroZone } from "../config/zones.ts";
import { ZONE_THEMES } from "../config/zones.ts";

export class PetriDish {
  public centerX = 0;
  public centerY = 0;
  public radiusX = 380;
  public radiusY = 250;
  public zone: MacroZone = "Goldilocks";

  public resize(width: number, height: number): void {
    this.centerX = width / 2;
    this.centerY = height / 2;
    // Skala cawan elips memenuhi ruang tanpa menabrak batas
    this.radiusX = Math.min(width * 0.44, 460);
    this.radiusY = Math.min(height * 0.42, 310);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number, timeSec: number): void {
    const theme = ZONE_THEMES[this.zone];

    ctx.save();

    // 1. Latar gelap pekat malam hari
    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, width, height);

    // 2. Vinyet gelap di tepi layar
    const outerVignette = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      Math.min(this.radiusX, this.radiusY) * 0.8,
      this.centerX,
      this.centerY,
      Math.max(width, height) * 0.65,
    );
    outerVignette.addColorStop(0, "rgba(3, 7, 18, 0)");
    outerVignette.addColorStop(1, "rgba(1, 3, 8, 0.96)");
    ctx.fillStyle = outerVignette;
    ctx.fillRect(0, 0, width, height);

    // 3. Pendaran cairan di dalam cawan sesuai zona
    const liquidBreath = 1 + Math.sin(timeSec * 0.8) * 0.04;
    const liquidGrad = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      this.radiusX * 0.15,
      this.centerX,
      this.centerY,
      this.radiusX * liquidBreath,
    );
    liquidGrad.addColorStop(0, theme.dishGlow);
    liquidGrad.addColorStop(0.55, "rgba(7, 18, 30, 0.82)");
    liquidGrad.addColorStop(0.92, "rgba(3, 8, 16, 0.95)");
    liquidGrad.addColorStop(1, "rgba(2, 6, 12, 1)");

    ctx.beginPath();
    ctx.ellipse(this.centerX, this.centerY, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
    ctx.fillStyle = liquidGrad;
    ctx.fill();

    // 4. Bibir kaca cawan petri (kaca ganda elips)
    // Cincin luar kaca
    ctx.beginPath();
    ctx.ellipse(this.centerX, this.centerY, this.radiusX + 10, this.radiusY + 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(147, 197, 253, 0.08)";
    ctx.lineWidth = 14;
    ctx.stroke();

    // Pantulan cahaya kaca (rim highlight)
    const rimGrad = ctx.createLinearGradient(
      this.centerX - this.radiusX,
      this.centerY - this.radiusY,
      this.centerX + this.radiusX,
      this.centerY + this.radiusY,
    );
    rimGrad.addColorStop(0, "rgba(255, 255, 255, 0.32)");
    rimGrad.addColorStop(0.2, "rgba(255, 255, 255, 0.06)");
    rimGrad.addColorStop(0.5, "rgba(147, 197, 253, 0.18)");
    rimGrad.addColorStop(0.8, "rgba(255, 255, 255, 0.04)");
    rimGrad.addColorStop(1, "rgba(255, 255, 255, 0.28)");

    ctx.beginPath();
    ctx.ellipse(this.centerX, this.centerY, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cincin dalam tipis
    ctx.beginPath();
    ctx.ellipse(this.centerX, this.centerY, this.radiusX - 8, this.radiusY - 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}
