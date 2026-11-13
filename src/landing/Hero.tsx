import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CHAPTERS, LINKS, chapterText } from "./chapters.ts";
import { Cap, Chip } from "../ui/fd.tsx";
import { useT } from "../i18n/react.tsx";
import { eventLabel, formatToken, shortHash, zoneFromApi, zoneFromTemp, zoneLabel } from "./lib/live.ts";
import { explorerAccount } from "./lib/chain.ts";
import type { LiveState } from "./useLive.ts";

const HERO = CHAPTERS[0]!;

/** Headline split into rising words; the accent phrase keeps its colour. */
function Words({ text, accent, start = 0, step = 70 }: { text: string; accent?: string; start?: number; step?: number }) {
  const i = accent ? text.indexOf(accent) : -1;
  const parts: Array<[string, boolean]> = i < 0 ? [[text, false]] : [
    [text.slice(0, i), false],
    [accent!, true],
    [text.slice(i + accent!.length), false],
  ];
  let n = 0;
  return (
    <>
      {parts.flatMap(([t, hot], p) =>
        t.split(/(\s+)/).map((w, j) => {
          if (!w) return null;
          if (/^\s+$/.test(w)) return " ";
          const delay = start + n++ * step;
          return (
            <span key={`${p}-${j}`} className={hot ? "ln-word fd-accent" : "ln-word"} style={{ animationDelay: `${delay}ms` }}>
              {w}
            </span>
          );
        }),
      )}
    </>
  );
}

/**
 * Chapter 01: headline over the live incubator, CTAs, the live ticker and the ruler strip. The
 * content sits in a sticky layer; the theatre fades it out in place before the camera moves.
 */
export function HeroBlock({ live, finePointer, style }: { live: LiveState; finePointer: boolean; style?: CSSProperties }) {
  const { t } = useT();
  const hero = chapterText(t, HERO);
  return (
    <section id={HERO.id} data-block="" className="ln-block ln-block--hero" style={style} aria-labelledby="ln-hero-title">
      <div className="ln-pin">
        <div className="ln-hero__copy">
          <Chip className="ln-rise" dot={live.status === "live" ? "live" : "accent"}>
            {t("landing.hero.chip")}
          </Chip>
          <h1 id="ln-hero-title" className="ln-hero__title">
            <Words key={hero.headline} text={hero.headline} accent={hero.accent} start={180} />
          </h1>
          <p className="ln-hero__line ln-rise" style={{ animationDelay: "560ms" }}>
            {hero.line}
          </p>
          <div className="ln-cta ln-rise" style={{ animationDelay: "700ms" }}>
            <a className="fd-btn fd-btn--primary" href={LINKS.app} data-magnetic="">
              {t("landing.hero.cta")}
            </a>
            <a className="fd-btn" href="#ch-02" data-magnetic="">
              {t("landing.hero.scroll")} <span aria-hidden="true">↓</span>
            </a>
          </div>
          {finePointer ? (
            <p className="ln-hint ln-rise" style={{ animationDelay: "900ms" }} aria-hidden="true">
              <Cap icon="eye">{t("landing.hero.hintLens")}</Cap>
              <Cap icon="grid">{t("landing.hero.hintDoor")}</Cap>
            </p>
          ) : null}
        </div>
        <div className="ln-hero__foot">
          <Ticker live={live} />
          <Ruler />
        </div>
      </div>
    </section>
  );
}

/** Ruler tick strip (decorative), under the hero. */
export function Ruler() {
  return <div className="fd-ruler" aria-hidden="true" />;
}

export function Ticker({ live }: { live: LiveState }) {
  const { t } = useT();
  const m = live.macro;
  const zone = m ? (zoneFromApi(m.zone) ?? zoneFromTemp(m.crucibleTemp)) : null;
  const items: Array<[string, string]> = m
    ? [
        [t("landing.ticker.items.temp"), `${m.crucibleTemp.toLocaleString("en-US")} mK`],
        [t("landing.ticker.items.zone"), zone ? zoneLabel(t, zone.key) : "—"],
        [t("landing.ticker.items.strains"), live.alive == null ? "—" : t("landing.ticker.alive", { alive: live.alive, total: live.strains ?? "?" })],
        [t("landing.ticker.items.burned"), `${formatToken(m.totalSnaccBurned)} $SNACC`],
        [t("landing.ticker.items.last"), live.last ? `${eventLabel(live.last.kind)} · ${shortHash(live.last.receipt_id)}` : "—"],
      ]
    : [];
  return (
    <div className="ln-ticker" role="region" aria-label={t("landing.ticker.label")} data-status={live.status}>
      <a className="ln-ticker__state" href={explorerAccount(m?.contractId ?? "snacc-v001.testnet")} target="_blank" rel="noopener noreferrer">
        <span className="ln-dot" aria-hidden="true" />
        {live.status === "live" ? t("landing.ticker.live") : live.status === "loading" ? t("landing.ticker.connecting") : t("landing.ticker.offline")}
      </a>
      {live.status === "live" ? (
        <ul className="ln-ticker__items">
          {items.map(([k, v], i) => (
            <li key={i}>
              <span className="ln-ticker__k">{k}</span>
              <span className="ln-ticker__v">{v}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ln-ticker__off">{live.status === "offline" ? t("landing.ticker.offlineMsg") : t("landing.ticker.reading")}</p>
      )}
    </div>
  );
}

/**
 * Incubator warm-up: a thermometer bar and a counter, gone after the figure is ready or 1 s,
 * whichever comes first. Absolutely positioned, so it never shifts layout.
 */
export function Loader({ ready }: { ready: boolean }) {
  const { rich } = useT();
  const [gone, setGone] = useState(false);
  const numRef = useRef<HTMLSpanElement>(null);
  const t0 = useRef(performance.now());

  useEffect(() => {
    const cap = window.setTimeout(() => setGone(true), 1000);
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0.current) / 850);
      if (numRef.current) numRef.current.textContent = String(Math.round(k * 100)).padStart(2, "0");
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.clearTimeout(cap);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, 450 - (performance.now() - t0.current));
    const id = window.setTimeout(() => setGone(true), wait);
    return () => window.clearTimeout(id);
  }, [ready]);

  return (
    <div className="ln-loader" data-gone={gone ? "" : undefined} aria-hidden="true">
      <div className="ln-loader__thermo">
        <span className="ln-loader__fill" />
      </div>
      <p className="ln-loader__txt">{rich("landing.loader.text", { pct: <span ref={numRef}>00</span> })}</p>
    </div>
  );
}
