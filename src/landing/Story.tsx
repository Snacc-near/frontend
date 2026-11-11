import type { ReactNode } from "react";
import { CHAPTERS } from "./chapters.ts";
import { AppetiteDemo, ColonyDemo, EnclaveDemo, FeedDemo, MetabolismDemo } from "./demos.tsx";
import { HeroBlock, Loader, Ticker } from "./Hero.tsx";
import { DEFAULT_ANCHORS, FIGURE_SVG_URL, cropUrl, type FigureSource } from "./lib/figure.ts";
import { STAGE_CUES } from "./story.ts";
import { Theatre } from "./Theatre.tsx";
import type { LiveState } from "./useLive.ts";

const STORY = CHAPTERS.slice(1, 6);

function demoFor(id: string, live: LiveState): ReactNode {
  switch (id) {
    case "ch-02":
      return <FeedDemo />;
    case "ch-03":
      return <MetabolismDemo />;
    case "ch-04":
      return <ColonyDemo />;
    case "ch-05":
      return <AppetiteDemo live={live} />;
    case "ch-06":
      return <EnclaveDemo />;
    default:
      return null;
  }
}

function ChapterCard({ index, live }: { index: number; live: LiveState }) {
  const c = STORY[index]!;
  const titleId = `${c.id}-title`;
  return (
    <article className="ln-card" data-card="" aria-labelledby={titleId}>
      <p className="ln-pill">
        <span className="ln-pill__k">FIG. {c.num}</span> {c.fig}
      </p>
      <h2 id={titleId} className="ln-card__title">
        {c.headline}
      </h2>
      <p className="ln-card__line">{c.line}</p>
      {demoFor(c.id, live)}
    </article>
  );
}

/** Desktop: pinned stage + camera. */
export function TheatreStory({ source, live, finePointer }: { source: FigureSource | null; live: LiveState; finePointer: boolean }) {
  const blocks = [
    <HeroBlock key="hero" live={live} finePointer={finePointer} />,
    ...STORY.map((c, i) => {
      const cue = STAGE_CUES[i + 1]!;
      return (
        <section key={c.id} id={c.id} data-block="" className={`ln-block ln-block--${cue.side}`} aria-labelledby={`${c.id}-title`}>
          <ChapterCard index={i} live={live} />
        </section>
      );
    }),
  ];
  return <Theatre source={source} finePointer={finePointer} blocks={blocks} overlay={<Loader ready={!!source} />} />;
}

/**
 * Mobile and reduced motion: one chapter per screen, a static crop of the same figure per
 * chapter (SVG view fragment, no extra DOM), every interaction still works.
 */
export function StaticStory({ source, live }: { source: FigureSource | null; live: LiveState }) {
  const anchors = { ...DEFAULT_ANCHORS, ...(source?.cam.anchors ?? {}) };
  const hero = CHAPTERS[0]!;
  return (
    <>
      <section id={hero.id} className="ln-sblock ln-sblock--hero" aria-labelledby="ln-hero-title">
        <img className="ln-sblock__fig ln-sblock__fig--hero" src={FIGURE_SVG_URL} alt="Isometric cutaway of the Snacc incubator: a petri dish colony behind the glass, a thermometer and a frosted enclave." width={1600} height={1000} />
        <div className="ln-hero__copy ln-hero__copy--static">
          <p className="ln-pill">
            <span className="ln-pill__k">FIG. 01</span> incubator · NEAR testnet
          </p>
          <h1 id="ln-hero-title" className="ln-hero__title">
            {hero.headline}
          </h1>
          <p className="ln-hero__line">{hero.line}</p>
          <div className="ln-cta">
            <a className="keycap keycap--primary ln-btn" href="/app">
              Enter the lab
            </a>
            <a className="keycap ln-btn" href="#ch-02">
              Scroll <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <Ticker live={live} />
      </section>
      {STORY.map((c, i) => {
        const cue = STAGE_CUES[i + 1]!;
        const a = anchors[cue.anchor] ?? DEFAULT_ANCHORS[cue.anchor]!;
        return (
          <section key={c.id} id={c.id} className="ln-sblock" aria-labelledby={`${c.id}-title`} data-reveal="">
            <figure className="ln-sblock__crop">
              <img src={cropUrl(a, cue.anchor === "ch-mito" ? 0.6 : 0.25)} alt="" loading="lazy" width={a.w} height={a.h} />
              <figcaption className="ln-pill">
                <span className="ln-pill__k">FIG. {c.num}</span> {cue.part}
              </figcaption>
            </figure>
            <ChapterCard index={i} live={live} />
          </section>
        );
      })}
    </>
  );
}
