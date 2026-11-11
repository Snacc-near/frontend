import "./landing.css";
import { useEffect, useRef, useState } from "react";
import { ChapterRail } from "./ChapterRail.tsx";
import { SiteFooter } from "./SiteFooter.tsx";
import { SiteHeader } from "./SiteHeader.tsx";
import { CHAPTER_IDS } from "./chapters.ts";
import { loadFigure, type FigureSource } from "./lib/figure.ts";
import { StaticStory, TheatreStory } from "./Story.tsx";
import { useLive } from "./useLive.ts";
import { useFinePointer, useReveal, useTheatreMode } from "./useMedia.ts";
import { useScrollSpy } from "./useScrollSpy.ts";
import { useMagnetic } from "./useMagnetic.ts";

export default function Landing() {
  const active = useScrollSpy(CHAPTER_IDS);
  const theatre = useTheatreMode();
  const fine = useFinePointer();
  const live = useLive();
  const [source, setSource] = useState<FigureSource | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let on = true;
    void loadFigure().then((s) => on && setSource(s));
    return () => {
      on = false;
    };
  }, []);

  useReveal(pageRef, [theatre, source]);
  useMagnetic(pageRef, fine);

  return (
    <div className="ln-page" ref={pageRef} data-mode={theatre ? "theatre" : "static"}>
      <a className="ln-skip" href="#main">
        Skip to content
      </a>
      <SiteHeader live={live.status} />
      <ChapterRail active={active} />

      <main id="main">
        <div id="story">
          {theatre ? <TheatreStory source={source} live={live} finePointer={fine} /> : <StaticStory source={source} live={live} />}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
