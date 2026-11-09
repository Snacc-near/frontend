/**
 * Entitas spora nutrisi di dalam cawan petri.
 * Berpendar lembut seperti lentera kuning malam hari dengan bayangan lembut.
 */

export interface SporeData {
  id: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  phase: number;
  speed: number;
  kind: "ignis" | "snacc" | "myco";
  valueAtp: number;
  bonusTempMk: number;
}

export class SporeManager {
  public spores: SporeData[] = [];

  constructor(count = 14, dishRadiusX = 360, dishRadiusY = 240, centerX = 0, centerY = 0) {
    this.spawnSpores(count, dishRadiusX, dishRadiusY, centerX, centerY);
  }

  public spawnSpores(
    count: number,
    dishRadiusX: number,
    dishRadiusY: number,
    centerX: number,
    centerY: number,
  ): void {
    this.spores = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.78; // tersebar di dalam radius cawan
      const x = centerX + Math.cos(angle) * dishRadiusX * r;
      const y = centerY + Math.sin(angle) * dishRadiusY * r;

      const kinds: ("ignis" | "snacc" | "myco")[] = ["snacc", "snacc", "ignis", "myco"];
      const kind = kinds[i % kinds.length]!;

      this.spores.push({
        id: `spore-${i}-${Date.now()}`,
        x,
        y,
        baseX: x,
        baseY: y,
        radius: kind === "ignis" ? 7 : kind === "snacc" ? 6 : 5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.8,
        kind,
        valueAtp: kind === "ignis" ? 40 : kind === "snacc" ? 25 : 15,
        bonusTempMk: kind === "ignis" ? 8 : kind === "snacc" ? 5 : 3,
      });
    }
  }

  public update(timeSec: number): void {
    for (const sp of this.spores) {
      // Gerakan mengambang harmonik lembut
      sp.x = sp.baseX + Math.sin(timeSec * sp.speed + sp.phase) * 6;
      sp.y = sp.baseY + Math.cos(timeSec * sp.speed * 0.8 + sp.phase) * 5;
    }
  }

  public render(ctx: CanvasRenderingContext2D, timeSec: number): void {
    ctx.save();
    for (const sp of this.spores) {
      const glowScale = 1 + Math.sin(timeSec * 2.5 + sp.phase) * 0.18;
      const lanternColor =
        sp.kind === "ignis" ? "#f97316" : sp.kind === "snacc" ? "#fbbf24" : "#34d399";

      // 1. Bayangan lembut di bawah spora pada kaca cawan
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y + 9, sp.radius * 1.1, sp.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fill();

      // 2. Pendaran luar lentera (halo glow)
      const glowGrad = ctx.createRadialGradient(
        sp.x,
        sp.y,
        sp.radius * 0.3,
        sp.x,
        sp.y,
        sp.radius * 3.2 * glowScale,
      );
      glowGrad.addColorStop(0, lanternColor);
      glowGrad.addColorStop(0.35, "rgba(251, 191, 36, 0.28)");
      glowGrad.addColorStop(1, "rgba(251, 191, 36, 0)");

      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius * 3.2 * glowScale, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // 3. Inti lentera spora
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#fffbeb";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = lanternColor;
      ctx.fill();
    }
    ctx.restore();
  }
}
