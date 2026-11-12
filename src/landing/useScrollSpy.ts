import { useEffect, useState } from "react";
import { PROBE, activeIndex } from "./sections.ts";

/** Pick the first id (document order) that is currently inside the reading band. */
export function pickActive(ids: readonly string[], inBand: ReadonlySet<string>, fallback: string): string {
  return ids.find((id) => inBand.has(id)) ?? fallback;
}

/**
 * Scrollspy: the active id is the last section whose top has crossed a probe line at 45% of the
 * viewport. One rAF-throttled read of the section tops per scroll frame; nothing runs while idle.
 */
export function useScrollSpy(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      // Theatre blocks overlap; `data-spy` (viewport heights) moves the top the spy sees to where the
      // block's card fades in.
      const tops = ids.map((id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const k = Number(el.dataset.spy ?? 0);
        return el.getBoundingClientRect().top + (Number.isFinite(k) ? k * window.innerHeight : 0);
      });
      const next = ids[activeIndex(tops, window.innerHeight * PROBE)] ?? ids[0] ?? "";
      setActive((prev) => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Sections mount late (figure, live data): re-measure once things have settled.
    const late = window.setTimeout(schedule, 1200);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);

  return active;
}
