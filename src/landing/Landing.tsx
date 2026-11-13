import "../ui/fd.css";
import "./landing.css";
import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/react.tsx";
import { SiteFooter } from "./SiteFooter.tsx";
import { SiteHeader } from "./SiteHeader.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { SECTION_IDS } from "./sections.ts";
import { loadFigure, type FigureSource } from "./lib/figure.ts";
import { StaticStory, TheatreStory } from "./Story.tsx";
import { useLive } from "./useLive.ts";
import { useFinePointer, useReveal, useTheatreMode } from "./useMedia.ts";
import { useScrollSpy } from "./useScrollSpy.ts";
import { useMagnetic } from "./useMagnetic.ts";
import { LiveLab } from "./LiveLab.tsx";
import { UnderHood } from "./UnderHood.tsx";
import { Faq, Finale } from "./Finale.tsx";
import { Spores } from "./Spores.tsx";

export default function Landing() {
  const { t } = useT();
  const active = useScrollSpy(SECTION_IDS);
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
        {t("landing.skip")}
      </a>
      <SiteHeader live={live.status} />
      <div className="fd-guides" aria-hidden="true" />
      <Spores count={fine ? 90 : 36} />

      <main id="main">
        <div id="story">
          {theatre ? <TheatreStory source={source} live={live} finePointer={fine} /> : <StaticStory source={source} live={live} />}
        </div>
        <LiveLab live={live} />
        <UnderHood />
        <Finale source={source} />
        <Faq />
      </main>

      <SiteFooter />
      <StatusBar active={active} live={live} />
    </div>
  );
}
