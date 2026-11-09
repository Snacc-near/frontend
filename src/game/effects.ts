/**
 * The petri-dish arena visual effects system (UI-117 Nutrient Burst & Screen Shake).
 * Honors prefers-reduced-motion to disable the shake and excessive particles.
 */

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  color: string;
  alpha: number;
}

export interface NutrientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export class EffectsManager {
  private shakeIntensity = 0;
  private shakeDecay = 0.9;
  public shockwaves: Shockwave[] = [];
  public particles: NutrientParticle[] = [];
  private reducedMotion = false;

  constructor() {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotion = mq.matches;
      mq.addEventListener("change", (e) => {
        this.reducedMotion = e.matches;
      });
    }
  }

  /**
   * Trigger a brief screen shake when a lysis/burst happens.
   */
  public triggerShake(intensity = 8): void {
    if (this.reducedMotion) return;
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  /**
   * Trigger a Nutrient Burst shockwave ring.
   */
  public triggerShockwave(x: number, y: number, color = "#10b981", maxRadius = 260): void {
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius,
      speed: this.reducedMotion ? 3 : 5,
      color,
      alpha: 1,
    });
  }

  /**
   * Trigger a nutrient particle burst into the dish medium.
   */
  public triggerNutrientBurst(x: number, y: number, count = 28, color = "#34d399"): void {
    this.triggerShake(10);
    this.triggerShockwave(x, y, color, 300);

    const particleCount = this.reducedMotion ? Math.min(8, count) : count;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2.5,
        color: i % 2 === 0 ? color : "#fbbf24",
        alpha: 1,
        life: 0,
        maxLife: 60 + Math.random() * 40,
      });
    }
  }

  public update(dt: number): { offsetX: number; offsetY: number } {
    // Screen shake update
    let offsetX = 0;
    let offsetY = 0;
    if (this.shakeIntensity > 0.1 && !this.reducedMotion) {
      offsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      offsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeIntensity *= Math.pow(this.shakeDecay, dt * 60);
    } else {
      this.shakeIntensity = 0;
    }

    // Shockwaves update
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i]!;
      sw.radius += sw.speed * (dt * 60);
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius || sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt * 60;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96; // gesekan medium cair
      p.vy *= 0.96;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife || p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    return { offsetX, offsetY };
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // Render shockwaves
    ctx.save();
    for (const sw of this.shockwaves) {
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(1, 3 * sw.alpha);
      ctx.globalAlpha = sw.alpha * 0.75;
      ctx.stroke();
    }
    ctx.restore();

    // Render particles
    ctx.save();
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    }
    ctx.restore();
  }
}
