import { useT } from "../i18n/react.tsx";
import { CHAPTERS, chapterText } from "./chapters.ts";

/** Sticky chapter rail (01–07). `active` comes from the scrollspy. */
export function ChapterRail({ active }: { active: string }) {
  const { t } = useT();
  return (
    <nav className="ln-rail" aria-label={t("landing.rail.label")}>
      <ol>
        {CHAPTERS.map((c) => {
          const name = chapterText(t, c).fig;
          return (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-current={active === c.id ? "true" : undefined}
                aria-label={t("landing.rail.item", { num: Number(c.num), name })}
              >
                <span className="ln-rail__num">{c.num}</span>
                <span className="ln-rail__name">{name}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
