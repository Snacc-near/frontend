import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { bioSound } from "../sound.ts";
import { OFFICIAL, gaugeToTemp, tempToGauge, zoneFromTemp, type ZoneKey } from "./lib/live.ts";
import { TEE_TX, explorerTx, CONTRACT_ID } from "./lib/chain.ts";
import { worldBus } from "./world.ts";
import type { LiveState } from "./useLive.ts";

const Sim = () => <span className="ln-sim">simulation</span>;

/* ---------------------------------------------------------------- 02 organism: Feed */

const BITE = 10; // simulated $SNACC per bite
const BURN = 0.035; // official Feeding Frenzy burn rate

function hungerState(f: number): "Fed" | "Starving" | "Fainted" {
  return f <= 0 ? "Fainted" : f <= 20 ? "Starving" : "Fed";
}

export function FeedDemo() {
  const [full, setFull] = useState(34);
  const [burned, setBurned] = useState(0);
  const [bites, setBites] = useState<number[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // It gets hungry again while you watch.
  useEffect(() => {
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    if (ref.current) io.observe(ref.current);
    const id = window.setInterval(() => {
      if (visible && !document.hidden) setFull((f) => Math.max(0, f - 1));
    }, 900);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, []);

  const feed = () => {
    setFull((f) => Math.min(100, f + 14));
    setBurned((b) => b + BITE * BURN);
    const n = ++seq.current;
    setBites((b) => [...b.slice(-3), n]);
    window.setTimeout(() => setBites((b) => b.filter((x) => x !== n)), 900);
    worldBus.emit({ type: "feed" });
    bioSound.playFeed();
  };

  const state = hungerState(full);
  return (
    <div className="ln-demo ln-feed" ref={ref}>
      <div className="ln-feed__row">
        <svg className="ln-feed__stomach" viewBox="0 0 120 100" aria-hidden="true">
          <defs>
            <clipPath id="ln-stomach-clip">
              <path d="M60 10c28 0 50 16 50 40s-22 42-50 42S10 74 10 50 32 10 60 10Z" />
            </clipPath>
          </defs>
          <path className="ln-feed__body" d="M60 10c28 0 50 16 50 40s-22 42-50 42S10 74 10 50 32 10 60 10Z" />
          <g clipPath="url(#ln-stomach-clip)">
            <rect className="ln-feed__level" x="0" y="0" width="120" height="100" style={{ transform: `translateY(${92 - (full / 100) * 82}px)` }} />
          </g>
          <path className="ln-feed__outline" d="M60 10c28 0 50 16 50 40s-22 42-50 42S10 74 10 50 32 10 60 10Z" />
          <circle className="ln-feed__nucleus" cx="78" cy="36" r="9" />
          {bites.map((b) => (
            <g key={b} className="ln-feed__crumbs">
              {[0, 1, 2, 3, 4].map((i) => (
                <circle key={i} r="3.2" style={{ ["--i" as string]: i, ["--dx" as string]: `${(i - 2) * 9}px` }} />
              ))}
            </g>
          ))}
        </svg>
        <dl className="ln-readout">
          <div>
            <dt>Fullness</dt>
            <dd>
              <span className="ln-meter" style={{ ["--v" as string]: full / 100 }} aria-hidden="true" />
              {full}%
            </dd>
          </div>
          <div>
            <dt>state</dt>
            <dd data-state={state}>{state}</dd>
          </div>
          <div>
            <dt>burned</dt>
            <dd>{burned.toFixed(2)} $SNACC</dd>
          </div>
        </dl>
      </div>
      <div className="ln-demo__bar">
        <button type="button" className="keycap keycap--primary ln-btn ln-btn--sm" onClick={feed}>
          Feed
        </button>
        <span className="ln-demo__note">
          one bite = {BITE} $SNACC, {OFFICIAL.frenzyBurnPct} burns in a Feeding Frenzy <Sim />
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 03 metabolism */

const STAGES = [
  { key: "spores", label: "Spores", note: "Extractors pull raw spores out of the medium." },
  { key: "enzymes", label: "Enzymes", note: "Fermenters refine spores into enzymes." },
  { key: "elixirs", label: "Elixirs", note: "Synthesizers brew enzymes into elixirs. Every job costs ATP." },
] as const;

export function MetabolismDemo() {
  const [sel, setSel] = useState(0);
  const pick = (i: number) => {
    setSel(i);
    worldBus.emit({ type: "atp" });
    bioSound.playClick();
  };
  return (
    <div className="ln-demo ln-meta" data-sel={sel}>
      <svg className="ln-meta__pipe" viewBox="0 0 300 92" aria-hidden="true">
        <path className="ln-meta__tube" d="M40 46H260" />
        <path className="ln-meta__flow" d="M40 46H260" />
        {STAGES.map((s, i) => (
          <g key={s.key} transform={`translate(${40 + i * 110} 46)`} className="ln-meta__node" data-on={i === sel ? "" : undefined}>
            <circle r="22" className="ln-meta__vial" />
            {i === 0 ? <path d="M-8 4l4-8 4 8 4-8 4 8" className="ln-meta__glyph" /> : null}
            {i === 1 ? <path d="M-9 0h18M0 -9v18M-6 -6l12 12M6 -6l-12 12" className="ln-meta__glyph" /> : null}
            {i === 2 ? <path d="M-5 -10h10M-3 -10v6l-7 12a3 3 0 0 0 3 4h14a3 3 0 0 0 3-4l-7-12v-6" className="ln-meta__glyph" /> : null}
          </g>
        ))}
        <g className="ln-meta__atp" transform="translate(260 46)">
          <circle r="4" cx="32" />
          <circle r="3" cx="-30" cy="10" />
          <circle r="3.5" cy="-31" />
        </g>
      </svg>
      <div className="ln-seg" role="group" aria-label="Production stage">
        {STAGES.map((s, i) => (
          <button key={s.key} type="button" className="ln-seg__btn" aria-pressed={i === sel} onClick={() => pick(i)}>
            <span className="ln-seg__n">{i + 1}</span> {s.label}
          </button>
        ))}
      </div>
      <p className="ln-demo__note" aria-live="polite">
        {STAGES[sel]!.note} <span className="ln-tag">NEP-245</span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- 04 colony: snack + merge */

export function ColonyDemo() {
  const [snacked, setSnacked] = useState(false);
  const [merged, setMerged] = useState(false);
  const snack = () => {
    if (snacked) return;
    setSnacked(true);
    worldBus.emit({ type: "snack" });
    bioSound.playNutrientBurst();
  };
  const merge = () => {
    if (merged) return;
    setMerged(true);
    worldBus.emit({ type: "merge" });
    bioSound.playCollect();
  };
  const reset = () => {
    setSnacked(false);
    setMerged(false);
    worldBus.emit({ type: "reset" });
  };
  return (
    <div className="ln-demo ln-colony" data-snacked={snacked ? "" : undefined} data-merged={merged ? "" : undefined}>
      <svg className="ln-colony__dish" viewBox="0 0 320 150" aria-hidden="true">
        <ellipse className="ln-colony__agar" cx="160" cy="78" rx="150" ry="64" />
        {/* hungry cell */}
        <g className="ln-colony__hungry" transform="translate(84 76)">
          <g className="ln-colony__hbody">
            <ellipse rx="34" ry="26" className="ln-cellbody ln-cellbody--pale" />
            <path className="ln-colony__crack" d="M-12 -24l6 12-8 8 10 10-4 14" />
            <circle cx="10" cy="-6" r="6" className="ln-nucleus" />
          </g>
          <g className="ln-colony__burst">
            {Array.from({ length: 10 }, (_, i) => (
              <circle key={i} r={i === 0 ? 4.5 : 3} style={{ ["--a" as string]: `${i * 36}deg`, ["--d" as string]: i === 0 ? "-1" : "1" }} />
            ))}
          </g>
        </g>
        {/* merge pair */}
        <g transform="translate(222 78)">
          <g className="ln-colony__ma">
            <ellipse rx="24" ry="19" className="ln-cellbody" />
            <circle cx="-4" cy="-3" r="5" className="ln-nucleus" />
          </g>
          <g className="ln-colony__mb">
            <ellipse rx="24" ry="19" className="ln-cellbody" />
            <circle cx="5" cy="2" r="5" className="ln-nucleus" />
          </g>
          <ellipse className="ln-colony__fused" rx="40" ry="28" />
        </g>
      </svg>
      <div className="ln-split" aria-live="polite">
        {snacked ? (
          <>
            <span className="ln-split__bar ln-split__bar--bounty" style={{ flexGrow: 1 }}>
              {OFFICIAL.lysisBountyPct} bounty to the hunter
            </span>
            <span className="ln-split__bar ln-split__bar--pantry" style={{ flexGrow: 9 }}>
              {OFFICIAL.lysisPantryPct} to The Pantry
            </span>
          </>
        ) : merged ? (
          <span className="ln-split__msg">Merged: roles combine, generation +1, {OFFICIAL.mergeTaxPct} merge tax.</span>
        ) : (
          <span className="ln-split__msg">A Fainted Snacc is open to anyone. Two healthy ones can merge.</span>
        )}
      </div>
      <div className="ln-demo__bar">
        <button type="button" className="keycap keycap--primary ln-btn ln-btn--sm" onClick={snack} disabled={snacked}>
          Snack it
        </button>
        <button type="button" className="keycap ln-btn ln-btn--sm" onClick={merge} disabled={merged}>
          Merge
        </button>
        {snacked || merged ? (
          <button type="button" className="ln-linkbtn" onClick={reset}>
            reset
          </button>
        ) : null}
        <Sim />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 05 appetite: draggable meter */

export function AppetiteDemo({ live }: { live: LiveState }) {
  const liveTemp = live.status === "live" && live.macro ? live.macro.crucibleTemp : null;
  const [g, setG] = useState(() => tempToGauge(liveTemp ?? 605));
  const touched = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const temp = Math.round(gaugeToTemp(g));
  const zone = zoneFromTemp(temp);

  useEffect(() => {
    if (!touched.current && liveTemp != null) setG(tempToGauge(liveTemp));
  }, [liveTemp]);

  const lastZone = useRef<ZoneKey | null>(null);
  useEffect(() => {
    worldBus.emit({ type: "thermo", g, zone: zone.key });
    if (lastZone.current && lastZone.current !== zone.key && touched.current) {
      bioSound.playZoneShift(zone.key === "frenzy" ? "Fever" : zone.key === "famine" ? "Hypothermia" : "Goldilocks");
    }
    lastZone.current = zone.key;
  }, [g, zone.key]);

  const setFromPointer = useCallback((clientY: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    touched.current = true;
    setG(Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height)));
  }, []);

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setFromPointer(e.clientY);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.buttons & 1) setFromPointer(e.clientY);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    let next = g;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") next = g + step;
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = g - step;
    else if (e.key === "PageUp") next = g + 0.1;
    else if (e.key === "PageDown") next = g - 0.1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    else return;
    e.preventDefault();
    touched.current = true;
    setG(Math.max(0, Math.min(1, next)));
  };

  const famineTop = tempToGauge(OFFICIAL.famineBelowMk);
  const frenzyBottom = tempToGauge(OFFICIAL.frenzyAboveMk);

  return (
    <div className="ln-demo ln-appetite" data-zone={zone.key}>
      <div className="ln-appetite__row">
        <div
          className="ln-thermo"
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Appetite Meter (CrucibleTemp)"
          aria-valuemin={0}
          aria-valuemax={1400}
          aria-valuenow={temp}
          aria-valuetext={`${temp} mK, ${zone.label}`}
          aria-orientation="vertical"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onKeyDown={onKey}
        >
          <span className="ln-thermo__band ln-thermo__band--frenzy" style={{ bottom: `${frenzyBottom * 100}%`, top: 0 }} />
          <span className="ln-thermo__band ln-thermo__band--normal" style={{ bottom: `${famineTop * 100}%`, height: `${(frenzyBottom - famineTop) * 100}%` }} />
          <span className="ln-thermo__band ln-thermo__band--famine" style={{ bottom: 0, height: `${famineTop * 100}%` }} />
          <span className="ln-thermo__fill" style={{ transform: `scaleY(${g})` }} />
          <span className="ln-thermo__knob" style={{ bottom: `calc(${g * 100}% - 9px)` }} />
          {liveTemp != null ? (
            <span className="ln-thermo__live" style={{ bottom: `${tempToGauge(liveTemp) * 100}%` }}>
              live {liveTemp} mK
            </span>
          ) : null}
        </div>
        <div className="ln-appetite__read">
          <svg viewBox="0 0 120 64" className="ln-appetite__dish" aria-hidden="true">
            <ellipse cx="60" cy="34" rx="56" ry="26" className="ln-appetite__rim" />
            <ellipse cx="60" cy="32" rx="48" ry="20" className="ln-appetite__medium" />
            <g className="ln-appetite__bubbles">
              <circle cx="40" cy="30" r="3" />
              <circle cx="66" cy="26" r="2.4" />
              <circle cx="82" cy="36" r="3.4" />
              <circle cx="52" cy="40" r="2" />
            </g>
          </svg>
          <p className="ln-appetite__zone">{zone.label}</p>
          <p className="ln-appetite__rate">
            {temp} mK · {zone.rate}
          </p>
          <p className="ln-demo__note">
            below {OFFICIAL.famineBelowMk} mK: {OFFICIAL.famineReliefPct} relief · above {OFFICIAL.frenzyAboveMk} mK: {OFFICIAL.frenzyBurnPct} burn
          </p>
        </div>
      </div>
      <div className="ln-demo__bar">
        <span className="ln-demo__note">
          drag the meter <Sim />
          {liveTemp != null ? (
            <>
              {" "}· marker = live CrucibleTemp from {CONTRACT_ID}{" "}
              <button
                type="button"
                className="ln-linkbtn"
                onClick={() => {
                  touched.current = false;
                  setG(tempToGauge(liveTemp));
                }}
              >
                snap to live
              </button>
            </>
          ) : live.status === "offline" ? (
            " · live reading offline"
          ) : null}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 06 enclave: press and hold */

const HOLD_MS = 1100;

export function EnclaveDemo() {
  const [k, setK] = useState(0);
  const [sealed, setSealed] = useState(false);
  const raf = useRef(0);
  const t0 = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    setK((v) => (v >= 1 ? 1 : 0));
  }, []);

  const start = () => {
    if (sealed || raf.current) return;
    t0.current = performance.now();
    const tick = () => {
      const v = Math.min(1, (performance.now() - t0.current) / HOLD_MS);
      setK(v);
      if (v >= 1) {
        raf.current = 0;
        setSealed(true);
        worldBus.emit({ type: "seal", on: true });
        bioSound.playCollect();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const reset = () => {
    setSealed(false);
    setK(0);
    worldBus.emit({ type: "seal", on: false });
  };

  return (
    <div className="ln-demo ln-enclave" data-sealed={sealed ? "" : undefined} style={{ ["--k" as string]: k }}>
      <svg className="ln-enclave__fig" viewBox="0 0 300 120" aria-hidden="true">
        <rect className="ln-enclave__chamber" x="150" y="14" width="130" height="92" rx="14" />
        <g className="ln-enclave__frost">
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={i} cx={162 + (i % 6) * 21} cy={30 + Math.floor(i / 6) * 30} r="1.6" />
          ))}
        </g>
        <path className="ln-enclave__rail" d="M20 64H150" />
        <g className="ln-enclave__capsule">
          <rect x="-26" y="-12" width="52" height="24" rx="12" />
          <path d="M0 -12v24" />
          <text y="4" x="-13">
            plan
          </text>
        </g>
        <g className="ln-enclave__stamp" transform="translate(215 60) rotate(-8)">
          <rect x="-46" y="-15" width="92" height="30" rx="6" />
          <text y="5" textAnchor="middle">
            attested ✓
          </text>
        </g>
      </svg>
      <div className="ln-demo__bar">
        {sealed ? (
          <>
            <a className="keycap keycap--primary ln-btn ln-btn--sm" href={explorerTx(TEE_TX.hash)} target="_blank" rel="noopener noreferrer">
              See the verified tx ↗
            </a>
            <span className="ln-demo__note">
              real testnet tx <code>{TEE_TX.action}</code>
            </span>
            <button type="button" className="ln-linkbtn" onClick={reset}>
              again
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="keycap keycap--primary ln-btn ln-btn--sm ln-hold"
              onPointerDown={start}
              onPointerUp={stop}
              onPointerLeave={stop}
              onPointerCancel={stop}
              onKeyDown={(e) => {
                if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                  e.preventDefault();
                  start();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === " " || e.key === "Enter") stop();
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className="ln-hold__ring" aria-hidden="true" />
              Hold to send the plan
            </button>
            <span className="ln-demo__note">the enclave signs; the contract checks the signature</span>
          </>
        )}
      </div>
    </div>
  );
}
