/** Microscope iris transition: a circular aperture closes on the tapped cell,
 * the view blurs through the lens, then it opens into the Cell Lab. Under
 * reduced motion it is a plain fade. Purely presentational: the radius is
 * written to a ref style per frame, never re-rendered. */
import React, { useEffect, useRef } from "react";
import { irisMode } from "../plate/iso/layout.ts";
import { ease } from "../motion.ts";

export interface IrisState {
  phase: "closing" | "opening";
  cx: number;
  cy: number;
}

interface IrisOverlayProps {
  iris: IrisState | null;
  reducedMotion: boolean;
}

export const IrisOverlay: React.FC<IrisOverlayProps> = ({ iris, reducedMotion }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!iris || !ref.current) return;
    const mode = irisMode(reducedMotion);
    if (mode === "fade") {
      ref.current.style.opacity = iris.phase === "closing" ? "1" : "0";
      return;
    }
    const startR = Math.hypot(window.innerWidth, window.innerHeight);
    const endR = 46;
    const duration = iris.phase === "closing" ? 430 : 520;
    const begin = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - begin) / duration);
      const eased = ease.softInOut(t);
      const r = iris.phase === "closing"
        ? startR - (startR - endR) * eased
        : endR + (startR - endR) * eased;
      if (ref.current) {
        ref.current.style.background = `radial-gradient(circle at ${iris.cx}px ${iris.cy}px, transparent ${r}px, rgba(22,24,26,0.94) ${r + 2}px)`;
      }
      if (ringRef.current) {
        const lens = ringRef.current;
        lens.style.left = `${iris.cx}px`;
        lens.style.top = `${iris.cy}px`;
        lens.style.width = `${r * 2}px`;
        lens.style.height = `${r * 2}px`;
        lens.style.opacity = t < 0.5 ? String(0.35 + t * 0.5) : String(0.6 - (t - 0.5));
        lens.style.filter = `blur(${Math.round((1 - Math.abs(t - 0.5) * 2) * 4)}px)`;
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [iris, reducedMotion]);

  if (!iris) return null;
  if (irisMode(reducedMotion) === "fade") {
    return (
      <div
        ref={ref}
        className="iris-fade"
        aria-hidden="true"
        data-testid="iris-overlay"
        style={{ transition: "opacity 160ms ease" }}
      />
    );
  }
  return (
    <>
      <div ref={ref} className="iris-shade" aria-hidden="true" data-testid="iris-overlay" />
      <div ref={ringRef} className="iris-lens" aria-hidden="true" data-testid="iris-lens" />
    </>
  );
};
