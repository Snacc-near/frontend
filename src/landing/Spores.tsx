import { useEffect, useRef } from "react";

interface Spore {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  ph: number;
  c: number;
}

const COLORS = ["rgba(22,24,26,0.22)", "rgba(184,120,0,0.32)", "rgba(248,170,6,0.45)", "rgba(195,169,114,0.4)"];

/**
 * Ambient drifting spores on one canvas (<=120 particles), gently pushed away by the cursor.
 * Off under reduced motion; paused while the tab is hidden.
 */
export function Spores({ count = 90 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const n = Math.min(120, count);
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    const mouse = { x: -999, y: -999 };
    const spores: Spore[] = [];

    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    for (let i = 0; i < n; i++) {
      spores.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.8 + Math.random() * 2.2,
        vx: (Math.random() - 0.5) * 6,
        vy: -4 - Math.random() * 10,
        ph: Math.random() * Math.PI * 2,
        c: i % COLORS.length,
      });
    }

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const s of spores) {
        s.ph += dt * 0.8;
        let ax = Math.sin(s.ph) * 4;
        let ay = 0;
        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120 && d2 > 1) {
          const f = (1 - Math.sqrt(d2) / 120) * 260;
          const d = Math.sqrt(d2);
          ax += (dx / d) * f;
          ay += (dy / d) * f;
        }
        s.vx += ax * dt;
        s.vy += ay * dt;
        s.vx *= 0.985;
        s.vy = s.vy * 0.985 + (-7 - s.r * 2) * 0.015;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.y < -10) {
          s.y = h + 10;
          s.x = Math.random() * w;
        }
        if (s.x < -10) s.x = w + 10;
        if (s.x > w + 10) s.x = -10;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[s.c]!;
        ctx.fill();
      }
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (!raf && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVis = () => (document.hidden ? stop() : start());
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [count]);

  return <canvas ref={ref} className="ln-spores" aria-hidden="true" />;
}
