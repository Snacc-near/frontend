import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { useT } from "../i18n/react.tsx";
import { bioSound } from "../sound.ts";
import { Icon, Sim } from "../ui/fd.tsx";
import { OFFICIAL, gaugeToTemp, tempToGauge, zoneFromTemp, zoneLabel, zoneRate, type ZoneKey } from "./lib/live.ts";
import { TEE_TX, explorerTx, CONTRACT_ID } from "./lib/chain.ts";
import { worldBus } from "./world.ts";
import type { LiveState } from "./useLive.ts";

/** Segmented meter (0..1), drawn with a transform only. */
function Meter({ v, tone = "accent" }: { v: number; tone?: "accent" | "ink" | "frost" | "warm" }) {
  return (
    <span className={`fd-meter fd-meter--${tone}`} aria-hidden="true">
      <span className="fd-meter__fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, v)).toFixed(3)})` }} />
    </span>
  );
}

/** Bordered state chip. */
function State({ tone, children }: { tone: "ok" | "warn" | "bad" | "idle" | "accent"; children: React.ReactNode }) {
  return (
    <span className={`fd-state fd-state--${tone}`}>
      <span className="fd-state__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="fd-kv__row">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------- 02 organism: Feed */

const BITE = 10; // simulated $SNACC per bite
const BURN = 0.035; // official Feeding Frenzy burn rate

export function hungerState(f: number): "Fed" | "Starving" | "Fainted" {
  return f <= 0 ? "Fainted" : f <= 20 ? "Starving" : "Fed";
}

/** Dictionary key (`common.hunger.*`) of each hunger state. */
const HUNGER_KEY = { Fed: "fed", Starving: "starving", Fainted: "fainted" } as const;

export function FeedDemo() {
  const { t, rich } = useT();
  const [full, setFull] = useState(34);
  const [burned, setBurned] = useState(0);
  const [bites, setBites] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

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

  // The stomach in the figure follows the fullness.
  useEffect(() => {
    worldBus.emit({ type: "full", v: full / 100 });
  }, [full]);

  const feed = () => {
    setFull((f) => Math.min(100, f + 14));
    setBurned((b) => b + BITE * BURN);
    setBites((n) => n + 1);
    worldBus.emit({ type: "feed" });
    worldBus.emit({ type: "atp" });
    bioSound.playFeed();
  };

  const state = hungerState(full);
  return (
    <div className="ln-demo" ref={ref}>
      <dl className="fd-kv">
        <Row k={t("demos.feed.fullness")}>
          <Meter v={full / 100} tone={state === "Fed" ? "accent" : "warm"} />
          <span className="fd-kv__num">{full}%</span>
        </Row>
        <Row k={t("demos.feed.state")}>
          <State tone={state === "Fed" ? "ok" : state === "Starving" ? "warn" : "bad"}>{t(`common.hunger.${HUNGER_KEY[state]}`)}</State>
        </Row>
        <Row k={t("demos.feed.bites")}>
          <span className="fd-kv__num">{bites}</span>
        </Row>
        <Row k={t("demos.feed.burned")}>
          <span className="fd-kv__num">{burned.toFixed(2)} $SNACC</span>
        </Row>
      </dl>
      <div className="ln-demo__bar">
        <button type="button" className="fd-btn fd-btn--primary fd-btn--sm" onClick={feed}>
          <Icon name="cell" /> {t("demos.feed.button")}
        </button>
        <span className="ln-demo__note">{rich("demos.feed.note", { bite: BITE, burn: OFFICIAL.frenzyBurnPct, sim: <Sim /> })}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 03 metabolism */

/** Production stages in order; the words of each are in `demos.metabolism.<key>`. */
const STAGES = ["spores", "enzymes", "elixirs"] as const;

export function MetabolismDemo() {
  const { t } = useT();
  const [sel, setSel] = useState(0);
  const pick = (i: number) => {
    setSel(i);
    worldBus.emit({ type: "atp", stage: i });
    bioSound.playClick();
  };
  return (
    <div className="ln-demo">
      <div className="fd-tabs" role="group" aria-label={t("demos.metabolism.group")}>
        {STAGES.map((s, i) => (
          <button key={s} type="button" className="fd-tab" aria-pressed={i === sel} onClick={() => pick(i)}>
            {t(`demos.metabolism.${s}.label`)}
          </button>
        ))}
      </div>
      <ol className="fd-flow" aria-hidden="true">
        {STAGES.map((s, i) => (
          <li key={s} className="fd-flow__node" data-on={i === sel ? "" : undefined} data-done={i < sel ? "" : undefined}>
            <span className="fd-flow__k">{t(`demos.metabolism.${s}.role`)}</span>
            <span className="fd-flow__v">{t(`demos.metabolism.${s}.label`).toLowerCase()}</span>
          </li>
        ))}
      </ol>
      <p className="ln-demo__note" aria-live="polite">
        {t(`demos.metabolism.${STAGES[sel]!}.note`)} <span className="fd-tag">NEP-245</span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- 04 colony: snack + merge */

export function ColonyDemo() {
  const { t, rich } = useT();
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
    <div className="ln-demo">
      <dl className="fd-kv" aria-live="polite">
        <Row k={t("demos.colony.hungry")}>
          {snacked ? <State tone="bad">{t("demos.colony.snacked")}</State> : <State tone="warn">{t("demos.colony.open")}</State>}
        </Row>
        <Row k={t("demos.colony.split")}>
          <span className="fd-split" data-on={snacked ? "" : undefined}>
            <span className="fd-split__a" style={{ flexGrow: 1 }}>
              {OFFICIAL.lysisBountyPct}
            </span>
            <span className="fd-split__b" style={{ flexGrow: 9 }}>
              {t("demos.colony.toPantry", { pct: OFFICIAL.lysisPantryPct })}
            </span>
          </span>
        </Row>
        <Row k={t("demos.colony.mergePair")}>
          {merged ? <State tone="ok">{t("demos.colony.merged")}</State> : <State tone="idle">{t("demos.colony.healthy")}</State>}
        </Row>
        <Row k={t("demos.colony.mergeTax")}>
          <span className="fd-kv__num">{OFFICIAL.mergeTaxPct}</span>
        </Row>
      </dl>
      <div className="ln-demo__bar">
        <button type="button" className="fd-btn fd-btn--primary fd-btn--sm" onClick={snack} disabled={snacked}>
          <Icon name="split" /> {t("demos.colony.snack")}
        </button>
        <button type="button" className="fd-btn fd-btn--sm" onClick={merge} disabled={merged}>
          <Icon name="cell" /> {t("demos.colony.merge")}
        </button>
        {snacked || merged ? (
          <button type="button" className="fd-link" onClick={reset}>
            {t("demos.colony.reset")}
          </button>
        ) : null}
        <span className="ln-demo__note">{rich("demos.colony.note", { bounty: OFFICIAL.lysisBountyPct, sim: <Sim /> })}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 05 appetite: draggable meter */

export function AppetiteDemo({ live }: { live: LiveState }) {
  const { t, rich } = useT();
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
          aria-label={t("demos.appetite.slider")}
          aria-valuemin={0}
          aria-valuemax={1400}
          aria-valuenow={temp}
          aria-valuetext={t("demos.appetite.valueText", { temp, zone: zoneLabel(t, zone.key) })}
          aria-orientation="vertical"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onKeyDown={onKey}
        >
          <span className="ln-thermo__band ln-thermo__band--frenzy" style={{ bottom: `${frenzyBottom * 100}%`, top: 0 }} />
          <span className="ln-thermo__band ln-thermo__band--normal" style={{ bottom: `${famineTop * 100}%`, height: `${(frenzyBottom - famineTop) * 100}%` }} />
          <span className="ln-thermo__band ln-thermo__band--famine" style={{ bottom: 0, height: `${famineTop * 100}%` }} />
          <span className="ln-thermo__fill" style={{ transform: `scaleY(${g.toFixed(3)})` }} />
          <span className="ln-thermo__knob" style={{ bottom: `calc(${(g * 100).toFixed(2)}% - 7px)` }} />
          {liveTemp != null ? <span className="ln-thermo__live" style={{ bottom: `${tempToGauge(liveTemp) * 100}%` }} title={t("demos.appetite.liveMarker", { temp: liveTemp })} /> : null}
        </div>
        <dl className="fd-kv ln-appetite__kv">
          <Row k={t("demos.appetite.rows.temp")}>
            <span className="fd-kv__num">{temp.toLocaleString("en-US")} mK</span>
          </Row>
          <Row k={t("demos.appetite.rows.zone")}>
            <State tone={zone.key === "frenzy" ? "accent" : zone.key === "famine" ? "idle" : "ok"}>{zoneLabel(t, zone.key)}</State>
          </Row>
          <Row k={t("demos.appetite.rows.rate")}>
            <span className="fd-kv__num">{zoneRate(t, zone.key)}</span>
          </Row>
          <Row k={t("demos.appetite.rows.frenzy")}>
            <span className="fd-kv__num">{t("demos.appetite.frenzyValue", { mk: OFFICIAL.frenzyAboveMk, burn: OFFICIAL.frenzyBurnPct })}</span>
          </Row>
          <Row k={t("demos.appetite.rows.famine")}>
            <span className="fd-kv__num">{t("demos.appetite.famineValue", { mk: OFFICIAL.famineBelowMk, relief: OFFICIAL.famineReliefPct })}</span>
          </Row>
          <Row k={t("demos.appetite.rows.live")}>
            {liveTemp != null ? (
              <span className="fd-kv__num">
                {liveTemp.toLocaleString("en-US")} mK{" "}
                <button
                  type="button"
                  className="fd-link"
                  onClick={() => {
                    touched.current = false;
                    setG(tempToGauge(liveTemp));
                  }}
                >
                  {t("demos.appetite.snap")}
                </button>
              </span>
            ) : (
              <State tone="idle">{live.status === "offline" ? t("demos.appetite.offline") : t("demos.appetite.reading")}</State>
            )}
          </Row>
        </dl>
      </div>
      <div className="ln-demo__bar">
        <span className="ln-demo__note">
          {rich("demos.appetite.note", { sim: <Sim /> })}
          {liveTemp != null ? rich("demos.appetite.markerNote", { contract: CONTRACT_ID }) : null}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 06 enclave: press and hold */

const HOLD_MS = 1300;

/** Deterministic hex string for the illustrative request hash / signature (FNV-1a, not crypto). */
export function fakeHex(seed: string, len: number): string {
  let out = "";
  let h = 0x811c9dc5;
  for (let round = 0; out.length < len; round++) {
    for (const ch of `${seed}:${round}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out.slice(0, len);
}

export function EnclaveDemo() {
  const { t, rich } = useT();
  const [k, setK] = useState(0);
  const [sealed, setSealed] = useState(false);
  const [run, setRun] = useState(1);
  const raf = useRef(0);
  const t0 = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    setK((v) => {
      if (v < 1) worldBus.emit({ type: "capsule", k: 0 });
      return v >= 1 ? 1 : 0;
    });
  }, []);

  const start = () => {
    if (sealed || raf.current) return;
    t0.current = performance.now();
    const tick = () => {
      const v = Math.min(1, (performance.now() - t0.current) / HOLD_MS);
      setK(v);
      worldBus.emit({ type: "capsule", k: v });
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
    setRun((r) => r + 1);
    worldBus.emit({ type: "seal", on: false });
  };

  const req = fakeHex(`plan-${run}`, 64);
  const sig = fakeHex(`sig-${run}`, 128);
  const step = sealed ? 3 : k >= 0.66 ? 2 : k >= 0.33 ? 1 : k > 0 ? 0 : -1;

  return (
    <div className="ln-demo ln-enclave" data-sealed={sealed ? "" : undefined}>
      <dl className="fd-kv fd-kv--steps">
        <Row k={t("demos.enclave.steps.request")}>
          <span className="fd-kv__num" data-on={step >= 0 ? "" : undefined}>
            {step >= 0 ? `0x${req.slice(0, 10)}…${req.slice(-6)}` : "—"}
          </span>
        </Row>
        <Row k={t("demos.enclave.steps.enclave")}>
          {step >= 1 ? (
            <State tone={step >= 2 ? "ok" : "accent"}>{step >= 2 ? t("demos.enclave.signed") : t("demos.enclave.computing")}</State>
          ) : (
            <span className="fd-kv__num">—</span>
          )}
        </Row>
        <Row k={t("demos.enclave.steps.signature")}>
          <span className="fd-kv__num" data-on={step >= 2 ? "" : undefined}>
            {step >= 2 ? `${sig.slice(0, 12)}…${sig.slice(-6)}` : "—"}
          </span>
        </Row>
        <Row k={t("demos.enclave.steps.contract")}>{step >= 3 ? <State tone="ok">{t("demos.enclave.verified")}</State> : <span className="fd-kv__num">—</span>}</Row>
      </dl>
      <div className="ln-demo__bar">
        {sealed ? (
          <>
            <a className="fd-btn fd-btn--primary fd-btn--sm" href={explorerTx(TEE_TX.hash)} target="_blank" rel="noopener noreferrer">
              <Icon name="chain" /> {t("demos.enclave.seeTx")}
            </a>
            <button type="button" className="fd-link" onClick={reset}>
              {t("demos.enclave.again")}
            </button>
            <span className="ln-demo__note">
              {rich("demos.enclave.noteSealed", { sim: <Sim kind="illustration" />, action: <code>{TEE_TX.action}</code> })}
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              className="fd-btn fd-btn--primary fd-btn--sm ln-hold"
              style={{ ["--k" as string]: k.toFixed(3) }}
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
              <span className="ln-hold__fill" aria-hidden="true" />
              <Icon name="lock" /> {t("demos.enclave.hold")}
            </button>
            <span className="ln-demo__note">{rich("demos.enclave.noteIdle", { sim: <Sim kind="illustration" /> })}</span>
          </>
        )}
      </div>
    </div>
  );
}
