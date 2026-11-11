import "./landing.css";
import { ChapterRail } from "./ChapterRail.tsx";
import { SiteFooter } from "./SiteFooter.tsx";
import { SiteHeader } from "./SiteHeader.tsx";
import { Stage } from "./Stage.tsx";
import { CHAPTERS, CHAPTER_IDS, LINKS } from "./chapters.ts";
import { useScrollSpy } from "./useScrollSpy.ts";

const [HERO, ...STORY] = CHAPTERS;

export default function Landing() {
  const active = useScrollSpy(CHAPTER_IDS);

  return (
    <div className="ln-page">
      <a className="ln-skip" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <ChapterRail active={active} />

      <main id="main">
        <section id={HERO.id} className="ln-chapter ln-hero" aria-labelledby="ln-hero-title">
          <div className="ln-chapter__text">
            <p className="ln-eyebrow">
              <span>Chapter {HERO.num}</span> · Enter
            </p>
            <h1 id="ln-hero-title" className="ln-hero__title">
              {HERO.headline}
            </h1>
            <p className="ln-chapter__line">{HERO.line}</p>
            <div className="ln-cta">
              <a className="keycap keycap--primary ln-btn" href={LINKS.app}>
                Enter the lab
              </a>
              <a className="keycap ln-btn" href={`#${STORY[0].id}`}>
                Scroll
              </a>
            </div>
          </div>
          <Stage num={HERO.num} fig={HERO.fig}>
            {/* Temporary static figure; the illustrated incubator replaces it in a later item. */}
            <div className="ln-stage__chip" aria-hidden="true">
              <img src="/brand/snacc-app-icon.png" alt="" width={512} height={512} decoding="async" />
            </div>
          </Stage>
        </section>

        <div id="story">
          {STORY.map((c, i) => {
            const last = i === STORY.length - 1;
            const titleId = `${c.id}-title`;
            return (
              <section key={c.id} id={c.id} className="ln-chapter" aria-labelledby={titleId}>
                <div className="ln-chapter__text">
                  <p className="ln-eyebrow">
                    <span>Chapter {c.num}</span> · {c.fig}
                  </p>
                  <h2 id={titleId} className="ln-chapter__title">
                    {c.headline}
                  </h2>
                  <p className="ln-chapter__line">{c.line}</p>
                  {last ? (
                    <div className="ln-cta">
                      <a className="keycap keycap--primary ln-btn" href={LINKS.app}>
                        Launch app (testnet)
                      </a>
                    </div>
                  ) : null}
                </div>
                <Stage num={c.num} fig={c.fig} />
              </section>
            );
          })}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
