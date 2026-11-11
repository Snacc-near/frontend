import { CHAPTERS } from "./chapters.ts";

/** Sticky chapter rail (01–07). `active` comes from the scrollspy. */
export function ChapterRail({ active }: { active: string }) {
  return (
    <nav className="ln-rail" aria-label="Chapters">
      <ol>
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              aria-current={active === c.id ? "true" : undefined}
              aria-label={`Chapter ${Number(c.num)}: ${c.fig}`}
            >
              <span className="ln-rail__num">{c.num}</span>
              <span className="ln-rail__name">{c.fig}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
