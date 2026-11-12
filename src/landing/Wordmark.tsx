import { useEffect, useRef } from "react";
import { Icon } from "./fd.tsx";

const INK = "#16181a";
const MARI = "#f8aa06";
const SPECK = "rgba(22, 24, 26, 0.2)";

interface Dot {
  x: number;
  y: number;
  /** Part of the letters (true) or an agar speck between them (false). */
  on: boolean;
  /** Stable 0..1 noise for nucleus offset and sparse specks. */
  seed: number;
}

interface Ripple {
  x: number;
  y: number;
  t: number;
}

const RIPPLE_MS = 1300;

/** Deterministic 0..1 noise for a grid cell. */
function noise(c: number, r: number): number {
  const v = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Giant dot-matrix wordmark: `text` rasterised onto a grid of small ink dots on paper. Near the
 * pointer the dots swell into marigold cells with a nucleus; a tap or click sends a ripple through
 * the culture. Static (one drawn frame, no listeners) under prefers-reduced-motion; the rAF loop
 * only runs while something is moving.
 */
export function Wordmark({ text = "Snacc" }: { text?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!box || !canvas || !ctx) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const st = {
      w: 0,
      h: 0,
      step: 8,
      dots: [] as Dot[],
      px: 0,
      py: 0,
      tx: 0,
      ty: 0,
      amp: 0,
      target: 0,
      raf: 0,
      ripples: [] as Ripple[],
      intro: false,
      visible: false,
    };

    const build = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;
      st.w = w;
      st.h = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const step = Math.max(5, Math.min(11, Math.round(w / 150)));
      st.step = step;
      const cols = Math.max(1, Math.floor(w / step));
      const rows = Math.max(1, Math.floor(h / step));
      const ox = (w - (cols - 1) * step) / 2;
      const oy = (h - (rows - 1) * step) / 2;

      // Rasterise the word at one pixel per grid cell, then keep the covered cells.
      const off = document.createElement("canvas");
      off.width = cols;
      off.height = rows;
      const o = off.getContext("2d", { willReadFrequently: true });
      if (!o) return;
      const font = (px: number) => `700 ${px.toFixed(2)}px "DM Sans", system-ui, sans-serif`;
      o.font = font(rows);
      let m = o.measureText(text);
      const fit = Math.min((cols * 0.94) / Math.max(1, m.actualBoundingBoxLeft + m.actualBoundingBoxRight), (rows * 0.84) / Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent));
      o.font = font(rows * fit);
      m = o.measureText(text);
      const tw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const th = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      o.fillStyle = "#000";
      o.fillText(text, (cols - tw) / 2 + m.actualBoundingBoxLeft, (rows - th) / 2 + m.actualBoundingBoxAscent);
      const data = o.getImageData(0, 0, cols, rows).data;

      const dots: Dot[] = [];
      let n = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const on = (data[(r * cols + c) * 4 + 3] ?? 0) > 110;
          const seed = noise(c, r);
          if (on) n++;
          // letters keep every cell; between them only a sparse scatter of agar specks
          if (on || seed < 0.2) dots.push({ x: ox + c * step, y: oy + r * step, on, seed });
        }
      }
      st.dots = dots;
      if (countRef.current) countRef.current.textContent = `${n.toLocaleString("en-US")} cells`;
      draw(performance.now());
    };

    const draw = (now: number) => {
      const { w, h, step: s } = st;
      ctx.clearRect(0, 0, w, h);
      const sig2 = 2 * (s * 7.5) ** 2;
      st.ripples = st.ripples.filter((rp) => now - rp.t < RIPPLE_MS);
      const waves = st.ripples.map((rp) => {
        const a = (now - rp.t) / RIPPLE_MS;
        return { x: rp.x, y: rp.y, r: a * Math.max(w, 600) * 0.75, k: 1 - a };
      });
      const band2 = 2 * (s * 2.2) ** 2;

      const swell = (d: Dot) => {
        let k = 0;
        if (st.amp > 0.003) {
          const dx = d.x - st.px;
          const dy = d.y - st.py;
          k = st.amp * Math.exp(-(dx * dx + dy * dy) / sig2);
        }
        for (const wv of waves) {
          const dd = Math.hypot(d.x - wv.x, d.y - wv.y) - wv.r;
          k = Math.max(k, wv.k * 0.85 * Math.exp(-(dd * dd) / band2));
        }
        return k;
      };

      // pass 1: resting dots in two batched paths (ink letters, faint specks)
      const cells: Array<[Dot, number]> = [];
      ctx.beginPath();
      for (const d of st.dots) {
        if (!d.on) continue;
        const k = swell(d);
        if (k > 0.1) {
          cells.push([d, k]);
          continue;
        }
        const r = s * (0.3 + 0.2 * k);
        ctx.moveTo(d.x + r, d.y);
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = INK;
      ctx.fill();

      ctx.beginPath();
      for (const d of st.dots) {
        if (d.on) continue;
        const k = swell(d);
        if (k > 0.35) {
          cells.push([d, k * 0.6]);
          continue;
        }
        const r = 0.7 + k * s * 0.3;
        ctx.moveTo(d.x + r, d.y);
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = SPECK;
      ctx.fill();

      // pass 2: swollen dots become little marigold cells with a membrane and a nucleus
      ctx.lineWidth = 1;
      ctx.strokeStyle = INK;
      for (const [d, k] of cells) {
        const r = s * Math.min(0.62, 0.3 + 0.36 * k);
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fillStyle = MARI;
        ctx.globalAlpha = Math.min(1, 0.35 + k);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
        if (r > s * 0.42) {
          const a = d.seed * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(d.x + Math.cos(a) * r * 0.32, d.y + Math.sin(a) * r * 0.32, r * 0.28, 0, Math.PI * 2);
          ctx.fillStyle = INK;
          ctx.fill();
        }
      }
    };

    const frame = (now: number) => {
      st.raf = 0;
      st.amp += (st.target - st.amp) * 0.12;
      st.px += (st.tx - st.px) * 0.28;
      st.py += (st.ty - st.py) * 0.28;
      draw(now);
      const moving = Math.abs(st.target - st.amp) > 0.004 || st.ripples.length > 0 || Math.abs(st.tx - st.px) + Math.abs(st.ty - st.py) > 0.4;
      if (moving && st.visible) st.raf = requestAnimationFrame(frame);
    };
    const schedule = () => {
      if (!st.raf && st.visible) st.raf = requestAnimationFrame(frame);
    };

    const local = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const onMove = (e: PointerEvent) => {
      const [x, y] = local(e);
      if (st.amp < 0.01) {
        st.px = x;
        st.py = y;
      }
      st.tx = x;
      st.ty = y;
      st.target = 1;
      schedule();
    };
    const onLeave = () => {
      st.target = 0;
      schedule();
    };
    const onDown = (e: PointerEvent) => {
      const [x, y] = local(e);
      st.ripples.push({ x, y, t: performance.now() });
      if (st.ripples.length > 4) st.ripples.shift();
      schedule();
    };

    const ro = new ResizeObserver(() => build());
    ro.observe(box);
    void document.fonts?.load(`700 40px "DM Sans"`).then(build, build);

    let io: IntersectionObserver | null = null;
    if (!still) {
      io = new IntersectionObserver(([entry]) => {
        st.visible = !!entry?.isIntersecting;
        if (!st.visible) {
          cancelAnimationFrame(st.raf);
          st.raf = 0;
          return;
        }
        // first time on screen: one ripple across the word, so it reads as alive
        if (!st.intro && st.w) {
          st.intro = true;
          st.ripples.push({ x: st.w * 0.18, y: st.h * 0.55, t: performance.now() });
        }
        schedule();
      });
      io.observe(box);
      box.addEventListener("pointermove", onMove, { passive: true });
      box.addEventListener("pointerleave", onLeave);
      box.addEventListener("pointerdown", onDown);
    }
    build();

    return () => {
      cancelAnimationFrame(st.raf);
      ro.disconnect();
      io?.disconnect();
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerleave", onLeave);
      box.removeEventListener("pointerdown", onDown);
    };
  }, [text]);

  return (
    <div className="ln-mark" ref={boxRef}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="fd-cap ln-mark__cap" aria-hidden="true">
        <Icon name="cell" />
        <span>
          fig-08.culture · <span ref={countRef}>cells</span>
        </span>
      </span>
    </div>
  );
}
