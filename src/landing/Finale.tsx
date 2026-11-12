import { useEffect, useMemo, useRef, useState } from "react";
import { CHAPTERS, LINKS } from "./chapters.ts";
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
          door open · light on
        </Cap>
      </div>
      <div className="ln-finale__copy">
        <Chip>fig-{FINALE.num}.{FINALE.fig}</Chip>
        <h2 id="ln-finale-title" className="ln-finale__title">
          <Accent text={FINALE.headline} accent={FINALE.accent} />
        </h2>
        <p className="ln-finale__line">{FINALE.line}</p>
        <div className="ln-cta">
          <a className="fd-btn fd-btn--primary fd-btn--lg" href={LINKS.app} data-magnetic="">
            Launch app (testnet)
          </a>
          <a className="fd-btn fd-btn--lg" href={LINKS.github} target="_blank" rel="noopener noreferrer" data-magnetic="">
            Read the code
          </a>
        </div>
      </div>
    </section>
  );
}

const FAQ: ReadonlyArray<{ q: string; a: React.ReactNode }> = [
  {
    q: "What is $SNACC?",
    a: <>A NEP-141 token on NEAR testnet that every Snacc eats. It is a testnet token with no monetary value; it exists so the economy can be played and checked in the open.</>,
  },
  {
    q: "Is it live?",
    a: (
      <>
        Yes, on NEAR testnet. The contract is{" "}
        <a href={explorerAccount(CONTRACT_ID)} target="_blank" rel="noopener noreferrer">
          {CONTRACT_ID}
        </a>
        ; the ticker, the numbers and the gallery on this page are read from it.
      </>
    ),
  },
  {
    q: "What happens if I don't feed it?",
    a: (
      <>
        Its Fullness drains over time. A Starving Snacc can be taken over by another player; a Fainted one can be snacked by anyone: {OFFICIAL.lysisBountyPct} goes to the hunter and{" "}
        {OFFICIAL.lysisPantryPct} to The Pantry.
      </>
    ),
  },
  {
    q: "Do I need a wallet?",
    a: <>Not to look around. This page and the lab demo only read testnet data; nothing here asks you to sign anything.</>,
  },
];

export function Faq() {
  return (
    <section id="faq" className="ln-section ln-faq" aria-labelledby="ln-faq-title">
      <div className="ln-section__inner ln-faq__inner">
        <header data-reveal="">
          <Chip>faq.md</Chip>
          <h2 id="ln-faq-title" className="ln-section__title">
            <Accent text="Questions from the lab door." accent="lab door" />
          </h2>
        </header>
        <Win title="questions.md" className="ln-faq__list">
          {FAQ.map((f, i) => (
            <details key={f.q} className="ln-faq__item" data-reveal="">
              <summary>
                <span className="ln-faq__n" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="ln-faq__q">{f.q}</span>
                <span className="ln-faq__pm" aria-hidden="true" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </Win>
      </div>
    </section>
  );
}
