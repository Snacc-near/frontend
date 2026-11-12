import { useEffect, useRef } from "react";
import { zoneFromApi, zoneFromTemp } from "./lib/live.ts";
import { SECTIONS } from "./sections.ts";
import type { LiveState } from "./useLive.ts";

/** Status line text for the bottom bar. */
export function statusText(live: Pick<LiveState, "status" | "macro">): string {
  if (live.status === "loading") return "connecting…";
  const m = live.macro;
  if (live.status !== "live" || !m) return "offline";
  const zone = zoneFromApi(m.zone) ?? zoneFromTemp(m.crucibleTemp);
  return `live · ${zone.label} · ${m.crucibleTemp.toLocaleString("en-US")} mK`;
}

/**
 * Fixed bottom status bar: live status on the left, a tab per section on the right (scrollspy).
 * On narrow screens the tabs scroll horizontally and the status collapses to its dot.
 */
export function StatusBar({ active, live }: { active: string; live: LiveState }) {
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the active tab in view inside the horizontally scrolling list (narrow screens).
  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    const left = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
    list.scrollTo({ left, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);

  const text = statusText(live);
  return (
    <nav className="fd-status" aria-label="Sections">
      <p className="fd-status__state" data-status={live.status} title={text}>
        <span className="ln-dot" aria-hidden="true" />
        <span className="fd-status__txt">{text}</span>
      </p>
      <ol className="fd-status__tabs" ref={listRef}>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}>
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
