import { useEffect, useRef, useState } from "react";
import { Accent, Cap, Chip, Win } from "../ui/fd.tsx";
import type { MessageKey } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";
import { CONTRACT_ID, EVIDENCE_TXS, explorerAccount, explorerTx, fetchNftCards, type NftCard } from "./lib/chain.ts";
import { countUp, formatToken, liveChipText, shortHash, tokenToNumber, zoneFromApi, zoneFromTemp, zoneLabel, zoneRate } from "./lib/live.ts";
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

/** Labels of the number cells (`landing.live.nums.<key>`) and their unit; the placeholder grid uses the same ones so nothing moves when data lands. */
type NumKey = "temp" | "supply" | "burned" | "pantry" | "minted" | "alive" | "events" | "block";
const NUM_KEYS: ReadonlyArray<{ key: NumKey; unit?: string }> = [
  { key: "temp", unit: "mK" },
  { key: "supply" },
  { key: "burned" },
  { key: "pantry", unit: "$SNACC" },
  { key: "minted" },
  { key: "alive" },
  { key: "events" },
  { key: "block" },
];

function Numbers({ live, run }: { live: LiveState; run: boolean }) {
  const { t, rich } = useT();
  const m = live.macro;
  if (!m) {
    return (
      <>
        <p className="ln-live__offline" data-status={live.status}>
          <span className="ln-dot" aria-hidden="true" />
          {live.status === "loading" ? t("landing.live.reading") : t("landing.live.offline")}
        </p>
        <dl className="ln-live__nums" aria-busy={live.status === "loading" ? "true" : undefined}>
          {NUM_KEYS.map((n) => (
            <div key={n.key} className="ln-num" data-reveal="">
              <dt>{t(`landing.live.nums.${n.key}`)}</dt>
              <dd>
                —{n.unit ? <small> {n.unit}</small> : null}
              </dd>
            </div>
          ))}
        </dl>
      </>
    );
  }
  const zone = zoneFromApi(m.zone) ?? zoneFromTemp(m.crucibleTemp);
  const cells: Array<{ k: NumKey; to: number | null; final: string; unit?: string; digits?: number }> = [
    { k: "temp", to: m.crucibleTemp, final: String(m.crucibleTemp), unit: "mK" },
    { k: "supply", to: tokenToNumber(m.totalSnaccSupply), final: formatToken(m.totalSnaccSupply), digits: 4 },
    { k: "burned", to: tokenToNumber(m.totalSnaccBurned), final: formatToken(m.totalSnaccBurned), digits: 5 },
    { k: "pantry", to: tokenToNumber(m.ruleBoundTreasury), final: formatToken(m.ruleBoundTreasury), unit: "$SNACC", digits: 4 },
    { k: "minted", to: live.strains, final: live.strains == null ? "—" : String(live.strains) },
    { k: "alive", to: live.alive, final: live.alive == null ? "—" : String(live.alive) },
    { k: "events", to: live.events, final: live.events == null ? "—" : String(live.events) },
    { k: "block", to: m.blockHeight, final: m.blockHeight.toLocaleString("en-US") },
  ];
  return (
    <>
      <p className="ln-live__zone" data-zone={zone.key} data-status="live">
        <span className="ln-dot" aria-hidden="true" />
        {rich("landing.live.zone", { zone: <strong>{zoneLabel(t, zone.key)}</strong>, rate: zoneRate(t, zone.key) })}
      </p>
      <dl className="ln-live__nums">
        {cells.map((c) => (
          <div key={c.k} className="ln-num" data-reveal="">
            <dt>{t(`landing.live.nums.${c.k}`)}</dt>
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

/**
 * Dictionary key of each rehearsal transaction's description, by action name. The action names are
 * method names and stay as written; an action added to the evidence list without a key here shows
 * its English `detail`.
 */
const TX_DETAIL_KEYS: Readonly<Record<string, MessageKey>> = {
  incubate: "landing.live.txs.detail.incubate",
  feed: "landing.live.txs.detail.feed",
  "merge (splice)": "landing.live.txs.detail.merge",
  "extract spores": "landing.live.txs.detail.extract",
  transmute: "landing.live.txs.detail.transmute",
  "synthesize elixir": "landing.live.txs.detail.synthesize",
  apply_tee_mutation_zero_trust: "landing.live.txs.detail.tee",
  ft_burn: "landing.live.txs.detail.burn",
  harvest_starving_strain: "landing.live.txs.detail.harvest",
  hostile_takeover_splice: "landing.live.txs.detail.takeover",
  nft_transfer: "landing.live.txs.detail.transfer",
  advance_epoch: "landing.live.txs.detail.epoch",
};

const shortAccount = (a: string) => (a.length > 22 ? `${a.slice(0, 10)}…${a.slice(-9)}` : a);

function Gallery({ run }: { run: boolean }) {
  const { t } = useT();
  const [cards, setCards] = useState<NftCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!run) return;
    const ac = new AbortController();
    void fetchNftCards(GALLERY_SLOTS, ac.signal).then((c) => {
      if (ac.signal.aborted) return;
      if (c) setCards(c);
      else setFailed(true);
    });
    return () => ac.abort();
  }, [run]);

  // Placeholders have the real card's exact box (1:1 image + the three-row table), and the grid
  // always holds GALLERY_SLOTS cards, so the section never changes height when the NFTs arrive.
  if (failed || !cards) {
    return (
      <div className="ln-gallery-wrap">
        <ul className="ln-gallery" aria-busy={failed ? undefined : "true"} aria-hidden={failed ? "true" : undefined}>
          {Array.from({ length: GALLERY_SLOTS }, (_, i) => (
            <GhostCard key={i} n={i} />
          ))}
        </ul>
        {failed ? <p className="ln-live__offline ln-gallery__msg">{t("landing.live.gallery.failed")}</p> : null}
      </div>
    );
  }
  const shown = cards.slice(0, GALLERY_SLOTS);
  return (
    <ul className="ln-gallery">
      {shown.map((c, i) => (
        <Win key={c.tokenId} as="li" title={t("landing.live.gallery.specimen", { id: c.tokenId })} className="ln-nft" bodyClass="ln-nft__body">
          <div className="ln-nft__media" style={{ animationDelay: `${i * 70}ms` }}>
            {c.src ? (
              <img src={c.src} alt={t("landing.live.gallery.imgAlt", { title: c.title })} width={320} height={320} loading="lazy" decoding="async" />
            ) : (
              <span>{t("landing.live.gallery.noImage")}</span>
            )}
            <span className="ln-nft__slide" aria-hidden="true">
              #{String(i + 1).padStart(2, "0")}
            </span>
          </div>
          <dl className="fd-kv ln-nft__meta">
            <div className="fd-kv__row">
              <dt>{t("landing.live.gallery.rows.title")}</dt>
              <dd className="ln-nft__title">{c.title}</dd>
            </div>
            <div className="fd-kv__row">
              <dt>{t("landing.live.gallery.rows.owner")}</dt>
              <dd>{shortAccount(c.owner)}</dd>
            </div>
            <div className="fd-kv__row">
              <dt>{t("landing.live.gallery.rows.token")}</dt>
              <dd>
                <a href={explorerAccount(CONTRACT_ID)} target="_blank" rel="noopener noreferrer">
                  #{c.tokenId} ↗
                </a>
              </dd>
            </div>
          </dl>
        </Win>
      ))}
      {Array.from({ length: GALLERY_SLOTS - shown.length }, (_, i) => (
        <GhostCard key={`ghost-${i}`} n={shown.length + i} />
      ))}
    </ul>
  );
}

const GALLERY_SLOTS = 9;

/** Empty specimen slide with the same box as a loaded one. */
function GhostCard({ n }: { n: number }) {
  const { t } = useT();
  return (
    <Win as="li" title={t("landing.live.gallery.specimen", { id: String(n + 1).padStart(2, "0") })} className="ln-nft ln-nft--ghost" bodyClass="ln-nft__body">
      <div className="ln-nft__media" />
      <dl className="fd-kv ln-nft__meta" aria-hidden="true">
        {(["title", "owner", "token"] as const).map((k) => (
          <div key={k} className="fd-kv__row">
            <dt>{t(`landing.live.gallery.rows.${k}`)}</dt>
            <dd>—</dd>
          </div>
        ))}
      </dl>
    </Win>
  );
}

/** "Live from testnet": real numbers, the real NFTs (their on-chain SVGs) and real transactions. */
export function LiveLab({ live }: { live: LiveState }) {
  const { t } = useT();
  const [numRef, numsSeen] = useInView<HTMLDivElement>();
  const [galRef, galSeen] = useInView<HTMLDivElement>("0px 0px 300px 0px");
  return (
    <section id="live" className="ln-section ln-live" aria-labelledby="ln-live-title">
      <div className="ln-section__inner">
        <header className="ln-section__head" data-reveal="">
          <Chip dot={live.status === "live" ? "live" : "off"}>{liveChipText(live.status, CONTRACT_ID, t)}</Chip>
          <h2 id="ln-live-title" className="ln-section__title">
            <Accent text={t("landing.live.title")} accent={t("landing.live.accent")} />
          </h2>
          <p className="ln-section__line">{t("landing.live.line")}</p>
        </header>

        <div ref={numRef}>
          <Numbers live={live} run={numsSeen} />
        </div>

        <div className="ln-live__grid">
          <div ref={galRef}>
            <h3 className="ln-sub">
              <Cap icon="cell">{t("landing.live.gallery.heading")}</Cap> <span className="fd-tag">nft_tokens</span>
            </h3>
            <Gallery run={galSeen} />
          </div>
          <div>
            <h3 className="ln-sub">
              <Cap icon="chain">{t("landing.live.txs.heading")}</Cap> <span className="fd-tag">testnet</span>
            </h3>
            <Win title="txs.testnet" className="ln-txs-win">
              <ol className="ln-txs">
                {EVIDENCE_TXS.map((tx, i) => (
                  <li key={tx.hash} data-reveal="" style={{ transitionDelay: `${i * 45}ms` }}>
                    <a href={explorerTx(tx.hash)} target="_blank" rel="noopener noreferrer">
                      <span className="ln-txs__n" aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="ln-txs__act">{tx.action}</span>
                      <span className="ln-txs__det">{TX_DETAIL_KEYS[tx.action] ? t(TX_DETAIL_KEYS[tx.action]!) : tx.detail}</span>
                      <span className="ln-txs__hash">{shortHash(tx.hash, 5, 4)} ↗</span>
                    </a>
                  </li>
                ))}
              </ol>
            </Win>
            <p className="ln-demo__note">{t("landing.live.txs.note")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
