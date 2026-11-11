import { useEffect, useState } from "react";

/** Pick the first id (document order) that is currently inside the reading band. */
export function pickActive(ids: readonly string[], inBand: ReadonlySet<string>, fallback: string): string {
  return ids.find((id) => inBand.has(id)) ?? fallback;
}

/**
 * Scrollspy: tracks which section crosses a thin band in the middle of the viewport.
 * Plain IntersectionObserver, no scroll listeners; without it the first id stays active.
 */
export function useScrollSpy(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        // Past the last chapter nothing intersects: keep whatever was active.
        setActive((prev) => pickActive(ids, inBand, prev));
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
