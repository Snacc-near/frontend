import { useEffect, useState } from "react";

export function useMedia(query: string, fallback = false): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : fallback,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");

/** Full scroll theatre only on wide screens with motion allowed. */
export const useTheatreMode = () => {
  const wide = useMedia("(min-width: 900px) and (min-height: 560px)", true);
  const reduced = useReducedMotion();
  return wide && !reduced;
};

export const useFinePointer = () => useMedia("(hover: hover) and (pointer: fine)");

/** Adds `.is-in` to `[data-reveal]` descendants as they enter the viewport. */
export function useReveal(root: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>("[data-reveal]");
    if (typeof IntersectionObserver === "undefined") {
      items.forEach((i) => i.classList.add("is-in"));
      return;
    }
    const watched = new WeakSet<Element>();
    const watch = (node: Element) => {
      if (watched.has(node) || node.classList.contains("is-in")) return;
      watched.add(node);
      io.observe(node);
    };
    // Content that renders later (live numbers, gallery) is picked up as it appears.
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.hasAttribute("data-reveal")) watch(n);
          n.querySelectorAll("[data-reveal]").forEach(watch);
        });
      }
    });
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    items.forEach(watch);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
