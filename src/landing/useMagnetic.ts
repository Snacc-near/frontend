import { useEffect, type RefObject } from "react";

/** Primary CTAs (`[data-magnetic]`) lean toward the pointer a little; fine pointers only. */
export function useMagnetic(root: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = root.current;
    if (!el || !enabled) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let target: HTMLElement | null = null;
    let dx = 0;
    let dy = 0;
    const apply = () => {
      raf = 0;
      if (target) target.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
    };
    const onMove = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.<HTMLElement>("[data-magnetic]") ?? null;
      if (t !== target && target) target.style.translate = "";
      target = t;
      if (!t) return;
      const r = t.getBoundingClientRect();
      dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
      dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onOut = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.<HTMLElement>("[data-magnetic]");
      if (t && !t.contains(e.relatedTarget as Node | null)) {
        t.style.translate = "";
        if (target === t) target = null;
      }
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerout", onOut);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerout", onOut);
    };
  }, [root, enabled]);
}
