import type { CSSProperties, ReactNode } from "react";
import { CHAPTERS } from "./chapters.ts";
import { AppetiteDemo, ColonyDemo, EnclaveDemo, FeedDemo, MetabolismDemo } from "./demos.tsx";
import { Accent, Cap, Chip, Win } from "../ui/fd.tsx";
import { HeroBlock, Loader, Ruler, Ticker } from "./Hero.tsx";
import { DEFAULT_ANCHORS, FIGURE_SVG_URL, type FigureSource } from "./lib/figure.ts";
import { LiveCrop } from "./LiveCrop.tsx";
import { STAGE_CUES, theatreMap, type TheatreBlock } from "./story.ts";
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

/** Window title used for a chapter: `fig-02.organism`. */
export const figTitle = (num: string, name: string) => `fig-${num}.${name}`;

function ChapterCard({ index, live }: { index: number; live: LiveState }) {
  const c = STORY[index]!;
  const titleId = `${c.id}-title`;
  return (
    <Win as="article" title={figTitle(c.num, c.fig)} className="ln-card" labelledBy={titleId} card>
      <h2 id={titleId} className="ln-card__title">
        <Accent text={c.headline} accent={c.accent} />
      </h2>
      <p className="ln-card__line">{c.line}</p>
      {demoFor(c.id, live)}
    </Win>
  );
}

const MAP = theatreMap();

/** Block position from the static scroll map: CSS lays the theatre out, so it never shifts later. */
export function blockStyle(b: TheatreBlock): CSSProperties {
  const r = (v: number) => String(Math.round(v * 10000) / 10000);
  return { "--top": r(b.top), "--len": r(b.len), "--to-stop": r(b.toStop) } as CSSProperties;
}

/** Desktop: pinned stage + camera. */
export function TheatreStory({ source, live, finePointer }: { source: FigureSource | null; live: LiveState; finePointer: boolean }) {
  const blocks = [
    <HeroBlock key="hero" live={live} finePointer={finePointer} style={blockStyle(MAP.blocks[0]!)} />,
    ...STORY.map((c, i) => {
      const cue = STAGE_CUES[i + 1]!;
      const b = MAP.blocks[i + 1]!;
      return (
        <section
          key={c.id}
          id={c.id}
          data-block=""
          data-spy={String(Math.round(b.spy * 10000) / 10000)}
          className={`ln-block ln-block--${cue.side}`}
          style={blockStyle(b)}
          aria-labelledby={`${c.id}-title`}
        >
          <div className="ln-pin">
            <ChapterCard index={i} live={live} />
          </div>
        </section>
      );
    }),
  ];
  return <Theatre source={source} finePointer={finePointer} blocks={blocks} map={MAP} overlay={<Loader ready={!!source} />} />;
}

/**
 * Mobile and reduced motion: one chapter per screen. Each chapter shows its crop of the same
 * figure; the crop is mounted as a live copy near the viewport so the demos still move it.
 */
export function StaticStory({ source, live }: { source: FigureSource | null; live: LiveState }) {
  const anchors = { ...DEFAULT_ANCHORS, ...(source?.cam.anchors ?? {}) };
  const hero = CHAPTERS[0]!;
  return (
    <>
      <section id={hero.id} className="ln-sblock ln-sblock--hero" aria-labelledby="ln-hero-title">
        <img className="ln-sblock__fig--hero" src={FIGURE_SVG_URL} alt="Isometric cutaway of the Snacc incubator: a petri dish colony behind the glass, a thermometer and a frosted enclave." width={1600} height={1000} />
        <div className="ln-hero__copy ln-hero__copy--static">
          <Chip>fig-01.incubator · NEAR testnet</Chip>
          <h1 id="ln-hero-title" className="ln-hero__title">
            <Accent text={hero.headline} accent={hero.accent} />
          </h1>
          <p className="ln-hero__line">{hero.line}</p>
          <div className="ln-cta">
            <a className="fd-btn fd-btn--primary" href="/app">
              Enter the lab
            </a>
            <a className="fd-btn" href="#ch-02">
              Scroll <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <Ticker live={live} />
        <Ruler />
      </section>
      {STORY.map((c, i) => {
        const cue = STAGE_CUES[i + 1]!;
        const a = anchors[cue.anchor] ?? DEFAULT_ANCHORS[cue.anchor]!;
        return (
          <section key={c.id} id={c.id} className="ln-sblock" aria-labelledby={`${c.id}-title`} data-reveal="">
            <Win as="figure" title={`${figTitle(c.num, c.fig)} · ${cue.part}`} className="ln-sblock__crop">
              <LiveCrop source={source} anchor={a} pad={cue.anchor === "ch-mito" ? 0.6 : 0.25} prefix={`s${c.num}-`} />
              <Cap icon="ring" className="ln-sblock__cap">
                {cue.part}
              </Cap>
            </Win>
            <ChapterCard index={i} live={live} />
          </section>
        );
      })}
    </>
  );
}
