import { useEffect, useRef, useState } from "react";
import { CHAPTERS, LINKS } from "./chapters.ts";
import { eventLabel, formatToken, shortHash, zoneFromApi, zoneFromTemp } from "./lib/live.ts";
import { explorerAccount } from "./lib/chain.ts";
import type { LiveState } from "./useLive.ts";

const HERO = CHAPTERS[0]!;

function Words({ text, start = 0, step = 70 }: { text: string; start?: number; step?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className="ln-word" style={{ animationDelay: `${start + i * step}ms` }}>
          {w}{" "}
        </span>
      ))}
    </>
  );
}

/** Chapter 01: headline over the live incubator, CTAs, and the live ticker strip. */
export function HeroBlock({ live, finePointer }: { live: LiveState; finePointer: boolean }) {
  return (
    <section id={HERO.id} data-block="" className="ln-block ln-block--hero" aria-labelledby="ln-hero-title">
      <div className="ln-hero__copy">
        <p className="ln-pill ln-rise" style={{ animationDelay: "120ms" }}>
          <span className="ln-pill__k">FIG. 01</span> incubator · NEAR testnet
        </p>
        <h1 id="ln-hero-title" className="ln-hero__title">
          <Words text={HERO.headline} start={180} />
        </h1>
        <p className="ln-hero__line ln-rise" style={{ animationDelay: "560ms" }}>
          {HERO.line}
        </p>
        <div className="ln-cta ln-rise" style={{ animationDelay: "700ms" }}>
          <a className="keycap keycap--primary ln-btn" href={LINKS.app} data-magnetic="">
            Enter the lab
          </a>
          <a className="keycap ln-btn" href="#ch-02" data-magnetic="">
            Scroll <span aria-hidden="true">↓</span>
          </a>
        </div>
        {finePointer ? (
          <p className="ln-hint ln-rise" style={{ animationDelay: "900ms" }} aria-hidden="true">
            move the lens over the glass · hover the door
          </p>
        ) : null}
      </div>
      <Ticker live={live} />
    </section>
  );
}

export function Ticker({ live }: { live: LiveState }) {
  const m = live.macro;
  const zone = m ? (zoneFromApi(m.zone) ?? zoneFromTemp(m.crucibleTemp)) : null;
  const items: Array<[string, string]> = m
    ? [
        ["CrucibleTemp", `${m.crucibleTemp} mK`],
        ["zone", zone ? zone.label : "—"],
        ["strains alive", live.alive == null ? "—" : `${live.alive} of ${live.strains ?? "?"}`],
        ["total burned", `${formatToken(m.totalSnaccBurned)} $SNACC`],
        ["last event", live.last ? `${eventLabel(live.last.kind)} · ${shortHash(live.last.receipt_id)}` : "—"],
      ]
    : [];
  return (
    <div className="ln-ticker" role="region" aria-label="Live testnet ticker" data-status={live.status}>
      <a className="ln-ticker__state" href={explorerAccount(m?.contractId ?? "snacc-v001.testnet")} target="_blank" rel="noopener noreferrer">
        <span className="ln-dot" aria-hidden="true" />
        {live.status === "live" ? "live · testnet" : live.status === "loading" ? "connecting…" : "offline"}
      </a>
      {live.status === "live" ? (
        <ul className="ln-ticker__items">
          {items.map(([k, v]) => (
            <li key={k}>
              <span className="ln-ticker__k">{k}</span>
              <span className="ln-ticker__v">{v}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ln-ticker__off">
          {live.status === "offline" ? "The backend did not answer, so no numbers are shown." : "Reading the colony…"}
        </p>
      )}
    </div>
  );
}

/**
 * Incubator warm-up: a thermometer bar and a counter, gone after the figure is ready or 1 s,
 * whichever comes first. Absolutely positioned, so it never shifts layout.
 */
export function Loader({ ready }: { ready: boolean }) {
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
      <p className="ln-loader__txt">
        warming the incubator <span ref={numRef}>00</span>%
      </p>
    </div>
  );
}
