import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { CONTRACT_ID, EVIDENCE_TXS, explorerAccount, explorerTx, fetchNftCards, type NftCard } from "./lib/chain.ts";
import { countUp, formatToken, shortHash, tokenToNumber, zoneFromApi, zoneFromTemp } from "./lib/live.ts";
import type { LiveState } from "./useLive.ts";

function useInView<T extends Element>(margin = "0px 0px -10% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, seen]);
  return [ref, seen] as const;
}

/** Counts up once when visible; settles on the exact formatted string. */
function CountUp({ to, final, run, digits = 0 }: { to: number | null; final: string; run: boolean; digits?: number }) {
  const [text, setText] = useState(run ? "0" : "—");
  useEffect(() => {
    if (!run || to == null) {
      setText(to == null ? final : "0");
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setText(final);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1300);
      if (k >= 1) {
        setText(final);
        return;
      }
      setText(countUp(0, to, k).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to, final, digits]);
  return <>{text}</>;
}

function Numbers({ live, run }: { live: LiveState; run: boolean }) {
  const m = live.macro;
  if (!m) {
    return (
      <p className="ln-live__offline" data-status={live.status}>
        <span className="ln-dot" aria-hidden="true" />
        {live.status === "loading" ? "Reading the colony…" : "The backend did not answer, so no numbers are shown here."}
      </p>
    );
  }
  const zone = zoneFromApi(m.zone) ?? zoneFromTemp(m.crucibleTemp);
  const cells: Array<{ k: string; to: number | null; final: string; unit?: string; digits?: number }> = [
    { k: "CrucibleTemp", to: m.crucibleTemp, final: String(m.crucibleTemp), unit: "mK" },
    { k: "$SNACC supply", to: tokenToNumber(m.totalSnaccSupply), final: formatToken(m.totalSnaccSupply), digits: 4 },
    { k: "$SNACC burned", to: tokenToNumber(m.totalSnaccBurned), final: formatToken(m.totalSnaccBurned), digits: 5 },
    { k: "The Pantry", to: tokenToNumber(m.ruleBoundTreasury), final: formatToken(m.ruleBoundTreasury), unit: "$SNACC", digits: 4 },
    { k: "Snaccs minted", to: live.strains, final: live.strains == null ? "—" : String(live.strains) },
    { k: "alive now", to: live.alive, final: live.alive == null ? "—" : String(live.alive) },
    { k: "events indexed", to: live.events, final: live.events == null ? "—" : String(live.events) },
    { k: "block height", to: m.blockHeight, final: m.blockHeight.toLocaleString("en-US") },
  ];
  return (
    <>
      <p className="ln-live__zone" data-zone={zone.key} data-status="live">
        <span className="ln-dot" aria-hidden="true" />
        The colony is in <strong>{zone.label}</strong> right now ({zone.rate}).
      </p>
      <dl className="ln-live__nums">
        {cells.map((c) => (
          <div key={c.k} className="ln-num" data-reveal="">
            <dt>{c.k}</dt>
            <dd>
              <CountUp to={c.to} final={c.final} run={run} digits={c.digits} />
              {c.unit ? <small> {c.unit}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function tilt(e: RPointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty("--ry", `${(x * 14).toFixed(2)}deg`);
  el.style.setProperty("--rx", `${(-y * 12).toFixed(2)}deg`);
  el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
  el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
}

function untilt(e: RPointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty("--rx", "0deg");
  e.currentTarget.style.setProperty("--ry", "0deg");
}

const shortAccount = (a: string) => (a.length > 22 ? `${a.slice(0, 10)}…${a.slice(-9)}` : a);

function Gallery({ run }: { run: boolean }) {
  const [cards, setCards] = useState<NftCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!run) return;
    const ac = new AbortController();
    void fetchNftCards(9, ac.signal).then((c) => {
      if (ac.signal.aborted) return;
      if (c) setCards(c);
      else setFailed(true);
    });
    return () => ac.abort();
  }, [run]);

  if (failed) return <p className="ln-live__offline">The NEAR testnet RPC did not answer, so the gallery is empty.</p>;
  if (!cards) {
    return (
      <ul className="ln-gallery" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="ln-nft ln-nft--ghost" aria-hidden="true" />
        ))}
      </ul>
    );
  }
  return (
    <ul className="ln-gallery">
      {cards.map((c, i) => (
        <li key={c.tokenId} className="ln-nft" style={{ animationDelay: `${i * 70}ms` }} onPointerMove={tilt} onPointerLeave={untilt}>
          <div className="ln-nft__media">
            {c.src ? <img src={c.src} alt={`On-chain SVG of ${c.title}`} width={320} height={320} loading="lazy" decoding="async" /> : <span>no on-chain image</span>}
          </div>
          <div className="ln-nft__meta">
            <p className="ln-nft__title">{c.title}</p>
            <p className="ln-nft__row">
              <span>owner</span> {shortAccount(c.owner)}
            </p>
            <p className="ln-nft__row">
              <span>token</span> #{c.tokenId}
            </p>
            <a className="ln-nft__link" href={explorerAccount(CONTRACT_ID)} target="_blank" rel="noopener noreferrer">
              contract on nearblocks ↗
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "Live from testnet": real numbers, the real NFTs (their on-chain SVGs) and real transactions. */
export function LiveLab({ live }: { live: LiveState }) {
  const [numRef, numsSeen] = useInView<HTMLDivElement>();
  const [galRef, galSeen] = useInView<HTMLDivElement>("0px 0px 300px 0px");
  return (
    <section id="live" className="ln-section ln-live" aria-labelledby="ln-live-title">
      <div className="ln-section__inner">
        <header className="ln-section__head" data-reveal="">
          <p className="ln-pill">
            <span className="ln-pill__k">LIVE</span> NEAR testnet · {CONTRACT_ID}
          </p>
          <h2 id="ln-live-title" className="ln-section__title">
            Not a mockup. This colony is on-chain.
          </h2>
          <p className="ln-section__line">
            Every number here is read from the contract on testnet, every card is an NFT whose picture the contract draws itself.
            Testnet only: $SNACC has no monetary value.
          </p>
        </header>

        <div ref={numRef}>
          <Numbers live={live} run={numsSeen} />
        </div>

        <div className="ln-live__grid">
          <div ref={galRef}>
            <h3 className="ln-sub">
              On-chain gallery <span className="ln-tag">nft_tokens</span>
            </h3>
            <Gallery run={galSeen} />
          </div>
          <div>
            <h3 className="ln-sub">
              Real transactions <span className="ln-tag">testnet</span>
            </h3>
            <ol className="ln-txs">
              {EVIDENCE_TXS.map((t, i) => (
                <li key={t.hash} data-reveal="" style={{ transitionDelay: `${i * 45}ms` }}>
                  <a href={explorerTx(t.hash)} target="_blank" rel="noopener noreferrer">
                    <span className="ln-txs__act">{t.action}</span>
                    <span className="ln-txs__det">{t.detail}</span>
                    <span className="ln-txs__hash">{shortHash(t.hash, 5, 4)} ↗</span>
                  </a>
                </li>
              ))}
            </ol>
            <p className="ln-demo__note">From the rehearsal run of 2026-11-09 (evidence pack in the Snacc repo). Links open nearblocks.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
