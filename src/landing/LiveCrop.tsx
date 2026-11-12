import { useEffect, useMemo, useRef, useState } from "react";
import type { Anchor } from "./lib/camera.ts";
import { cropUrl, prefixIds, type FigureSource } from "./lib/figure.ts";
import { World, worldBus } from "./world.ts";

/** viewBox string of an anchor crop (same box as `cropUrl`). */
export function cropBox(a: Anchor, pad: number): string {
  const px = a.w * pad;
  const py = a.h * pad;
  const r = (v: number) => Math.round(v * 10) / 10;
  return `${r(a.x - px)} ${r(a.y - py)} ${r(a.w + 2 * px)} ${r(a.h + 2 * py)}`;
}

/**
 * Static-mode chapter figure (mobile, reduced motion). Far from the viewport it is a plain `img`
 * crop; near it, an id-prefixed inline copy of the same figure is mounted so the chapter demos
 * drive the real parts (stomach, hungry cell, thermometer, capsule) through the world bus.
 */
export function LiveCrop({ source, anchor, pad, prefix }: { source: FigureSource | null; anchor: Anchor; pad: number; prefix: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const markup = useMemo(() => (source && near ? prefixIds(source.svg, prefix) : ""), [source, near, prefix]);
  const box = cropBox(anchor, pad);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setNear(!!e?.isIntersecting), { rootMargin: "60% 0px 60% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("viewBox", box);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("aria-hidden", "true");
    svg.removeAttribute("role");
    const world = new World(svg, prefix);
    return worldBus.on((ev) => world.apply(ev));
  }, [markup, box, prefix]);

  return (
    <div className="ln-crop" ref={ref} aria-hidden="true">
      {markup ? <div className="ln-crop__host" dangerouslySetInnerHTML={{ __html: markup }} /> : <img src={cropUrl(anchor, pad)} alt="" loading="lazy" width={anchor.w} height={anchor.h} />}
    </div>
  );
}
