import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n/react.tsx";
import { CHAPTERS, LINKS, chapterText } from "./chapters.ts";
import { CONTRACT_ID, explorerAccount } from "./lib/chain.ts";
import { OFFICIAL } from "./lib/live.ts";
import { prefixIds, type FigureSource } from "./lib/figure.ts";
import { World } from "./world.ts";
import { Accent, Cap, Chip, Win } from "../ui/fd.tsx";

const FINALE = CHAPTERS[6]!;

/**
 * Chapter 07: the whole incubator again; scrolling into it swings the door open and light spills
 * out. The figure copy (id-prefixed) mounts only when the section is near.
 */
export function Finale({ source }: { source: FigureSource | null }) {
  const { t } = useT();
  const text = chapterText(t, FINALE);
  const ref = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [open, setOpen] = useState(false);
  const markup = useMemo(() => (source && near ? prefixIds(source.svg, "fz-") : ""), [source, near]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ioNear = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (e?.isIntersecting) setNear(true);
        el.toggleAttribute("data-far", !e?.isIntersecting);
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    const ioOpen = new IntersectionObserver(([e]) => setOpen(!!e && e.intersectionRatio > 0.35), { threshold: [0, 0.35, 0.6] });
    ioNear.observe(el);
    ioOpen.observe(el);
    return () => {
      ioNear.disconnect();
      ioOpen.disconnect();
    };
  }, []);

  const worldRef = useRef<World | null>(null);
  useEffect(() => {
    const svg = hostRef.current?.querySelector("svg");
    if (!svg) return;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("aria-hidden", "true");
    svg.removeAttribute("role");
    worldRef.current = new World(svg, "fz-");
  }, [markup]);

  useEffect(() => {
    // small delay so the light comes up after the section has settled into view
    const id = window.setTimeout(() => worldRef.current?.setGlow(open), open ? 250 : 0);
    return () => window.clearTimeout(id);
  }, [open, markup]);

  return (
    <section id={FINALE.id} ref={ref} className="ln-finale" data-open={open ? "" : undefined} aria-labelledby="ln-finale-title">
      <div className="ln-finale__fig">
        <div className="ln-finale__glow" aria-hidden="true" />
        <div className="ln-finale__host" ref={hostRef} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />
        <Cap icon="spark" className="ln-finale__cap">
          {t("landing.finale.cap")}
        </Cap>
      </div>
      <div className="ln-finale__copy">
        <Chip>{`fig-${FINALE.num}.${text.fig}`}</Chip>
        <h2 id="ln-finale-title" className="ln-finale__title">
          <Accent text={text.headline} accent={text.accent} />
        </h2>
        <p className="ln-finale__line">{text.line}</p>
        <div className="ln-cta">
          <a className="fd-btn fd-btn--primary fd-btn--lg" href={LINKS.app} data-magnetic="">
            {t("landing.finale.launch")}
          </a>
          <a className="fd-btn fd-btn--lg" href={LINKS.github} target="_blank" rel="noopener noreferrer" data-magnetic="">
            {t("landing.finale.code")}
          </a>
        </div>
      </div>
    </section>
  );
}

/** FAQ entries, by dictionary key (`landing.faq.<key>.q` / `.a`). */
const FAQ_KEYS = ["token", "live", "hungry", "wallet"] as const;

export function Faq() {
  const { t, rich } = useT();
  const answers = {
    token: t("landing.faq.token.a"),
    live: rich("landing.faq.live.a", {
      contract: (
        <a href={explorerAccount(CONTRACT_ID)} target="_blank" rel="noopener noreferrer">
          {CONTRACT_ID}
        </a>
      ),
    }),
    hungry: t("landing.faq.hungry.a", { bounty: OFFICIAL.lysisBountyPct, pantry: OFFICIAL.lysisPantryPct }),
    wallet: t("landing.faq.wallet.a"),
  } as const;
  return (
    <section id="faq" className="ln-section ln-faq" aria-labelledby="ln-faq-title">
      <div className="ln-section__inner ln-faq__inner">
        <header data-reveal="">
          <Chip>{t("landing.faq.chip")}</Chip>
          <h2 id="ln-faq-title" className="ln-section__title">
            <Accent text={t("landing.faq.title")} accent={t("landing.faq.accent")} />
          </h2>
        </header>
        <Win title={t("landing.faq.window")} className="ln-faq__list">
          {FAQ_KEYS.map((key, i) => (
            <details key={key} className="ln-faq__item" data-reveal="">
              <summary>
                <span className="ln-faq__n" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="ln-faq__q">{t(`landing.faq.${key}.q`)}</span>
                <span className="ln-faq__pm" aria-hidden="true" />
              </summary>
              <p>{answers[key]}</p>
            </details>
          ))}
        </Win>
      </div>
    </section>
  );
}
