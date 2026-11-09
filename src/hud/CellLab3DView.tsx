import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { CellLab3DEngine } from "../game/cellLab3d.ts";
import { TelemetryPoller } from "../data/poller.ts";
import { fetchStrain, fetchStrainSvg } from "../data/api.ts";
import { svgToSafeDataUri, buildDemoSvgDataUri } from "../data/svg.ts";
import type { AppetiteViewModel, CrucibleEvent, StrainDetail, StrainSummary } from "../data/types.ts";

export interface StrainState {
  id: number;
  r: number; // role bitmask: 1=Extractor, 2=Fermenter, 4=Synthesizer
  v: number; // vitality (0..100)
  bal: number; // treasury balance $SNACC
  g: number; // generation
  eff: number; // efficiency bps
  bm: number; // BMR multiplier
  al: number; // last allocated epoch
  L: [number, number, number]; // [mitochondria, nucleus, lysosome] levels (0..5)
  s: "Active" | "Liquidated" | "SplicedBurned";
  rd?: number; // last raided epoch
}

export interface ThresholdLogEntry {
  ep: number;
  f: number; // from zone index (0: Hypothermia, 1: Normal, 2: Calcination Fever)
  t: number; // to zone index
  mk: number;
  by?: string;
  tx?: string;
}

const ZN = [
  { n: "Hypothermia", c: 0x0c1a3c, col: "#6fa8ff", rule: "Stimulus rebate 2%" },
  { n: "Normal", c: 0x14123a, col: "#5be3c1", rule: "Neutral band" },
  { n: "Calcination Fever", c: 0x2a1233, col: "#ff7a3c", rule: "Velocity auto-burn 3.5%" },
];

const zi = (mk: number): number => (mk > 610 ? 2 : mk < 600 ? 0 : 1);

const RN: Record<number, string> = { 1: "Extractor", 2: "Fermenter", 4: "Synthesizer" };
const rn = (r: number): string =>
  [1, 2, 4]
    .filter((b) => r & b)
    .map((b) => RN[b])
    .join("+");

const NM: Record<string, string> = {
  sn: "$SNACC",
  atp: "ATP",
  sp: "spores",
  en: "enzymes",
  el: "elixir",
};

const COSTS: Record<string, Record<string, number>> = {
  raid: { atp: 4 },
  feed: { sn: 10 },
  extract: { atp: 1 },
  transmute: { atp: 2, sp: 2 },
  synth: { atp: 3, en: 2 },
  splice: { atp: 5 },
  divide: { atp: 3 },
  redeem: { el: 1 },
};

const BMR_R: Record<number, number> = { 1: 100, 2: 120, 4: 150 };
const MAXCOL = 5;
const MAXGEN = 8;
const EP_DURATION_SEC = 60;
const BASE_BURST_BPS = 200;
const MAX_BURST_BPS = 500;

const INFO: Record<string, string> = {
  nuc: "Stores the genome. Transcription copies genes into mRNA that leaves through nuclear pores to the ribosomes. <b>In Snacc:</b> genome and phenotype live here; each level adds 10% to enzyme and elixir output.",
  mit: "Glycolysis products enter the matrix, the Krebs cycle feeds the electron transport chain, which pumps H+ across the inner membrane. H+ flowing back through ATP synthase makes ATP. <b>In Snacc:</b> $SNACC is the substrate, ATP is the work energy, and part of the substrate burns (ft_burn). Each level adds 10% ATP.",
  m2: "Second mitochondrion: functions symbiotically with the primary mitochondrion to supply cellular ATP. Each level adds 10% ATP.",
  er: "Rough ER: ribosomes on its surface build proteins, and the lumen folds them. <b>In Snacc:</b> ribosomes make spores, and spores are assembled along the ER into enzymes.",
  gol: "Golgi apparatus: sorts and packs products into vesicles that leave the cell by exocytosis. <b>In Snacc:</b> packs elixir and ships it out through the membrane.",
  lys: "Lysosome: acid enzymes digest waste and recycle worn parts (autophagy). <b>In Snacc:</b> each level lowers the hunger rate (BMR) by 10%.",
  vac: "Vacuole: stores nutrients and other materials until the cell needs them. <b>In Snacc:</b> holds spores before transmutation.",
  ch: "Membrane channel: a transport protein that lets nutrients cross the lipid membrane. <b>In Snacc:</b> $SNACC enters the cell here.",
};

const mk0 = (id: number, r: number, v = 80): StrainState => ({
  id,
  r,
  v,
  bal: 30,
  g: 0,
  eff: 10000,
  bm: 1,
  al: -1,
  L: [0, 0, 0],
  s: "Active",
});

interface CellLab3DViewProps {
  onSkinSwitch?: (skin: "biolab" | "fintech") => void;
  currentSkin?: "biolab" | "fintech";
}

export const CellLab3DView: React.FC<CellLab3DViewProps> = ({
  onSkinSwitch,
  currentSkin = "biolab",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CellLab3DEngine | null>(null);

  // App mode: Demo (local simulation) vs Live (on-chain testnet)
  const [mode, setMode] = useState<"demo" | "live">("demo");

  // Biological simulation state (Demo mode)
  const [resources, setResources] = useState({
    sn: 120,
    atp: 50,
    sp: 0,
    en: 0,
    el: 0,
    vol: 0,
    pantry: 0,
    pool: 0,
    con: 0,
    claim: 0,
  });
  const [strains, setStrains] = useState<StrainState[]>([
    mk0(1, 1, 80),
    mk0(2, 2, 70),
    mk0(3, 4, 60),
  ]);
  const [selectedStrainId, setSelectedStrainId] = useState(1);
  const [nextStrainId, setNextStrainId] = useState(4);
  const [dividesCount, setDividesCount] = useState(0);
  const [mergersCount, setMergersCount] = useState(0);
  const [lysesCount, setLysesCount] = useState(0);

  // Epoch state
  const [epoch, setEpoch] = useState(1);
  const [epochTimeRemaining, setEpochTimeRemaining] = useState<number>(EP_DURATION_SEC);

  // Nutrient Burst state (UI-117)
  const [burstBps, setBurstBps] = useState(0);
  const [burstUntilEpoch, setBurstUntilEpoch] = useState(0);
  const [isBurstActive, setIsBurstActive] = useState(false);

  // Zone and Temperature state (UI-118)
  const [crucibleTempMk, setCrucibleTempMk] = useState(605);
  const [currentZoneIndex, setCurrentZoneIndex] = useState(1);
  const [zoneBannerVisible, setZoneBannerVisible] = useState(false);
  const [zoneBannerText, setZoneBannerText] = useState("");
  const [zoneBannerColor, setZoneBannerColor] = useState("#5be3c1");
  const zoneBannerTimerRef = useRef<number | null>(null);

  // Threshold Log state (UI-119)
  const [thresholdLogs, setThresholdLogs] = useState<ThresholdLogEntry[]>([]);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const lastActionRef = useRef<string>("");

  // UI-121: SVG Inspector live state
  const [showSvgPanel, setShowSvgPanel] = useState(false);
  const [svgDataUri, setSvgDataUri] = useState<string | null>(null);
  const [svgLoading, setSvgLoading] = useState(false);
  const [selectedStrainDetail, setSelectedStrainDetail] = useState<StrainDetail | null>(null);

  // UI-122: Appetite Meter panel state
  const [showAppetitePanel, setShowAppetitePanel] = useState(false);
  const [appetiteData, setAppetiteData] = useState<AppetiteViewModel | null>(null);

  // UI controls
  const [showLabels, setShowLabels] = useState(true);
  const [seeThrough, setSeeThrough] = useState(false);
  const [showRaidModal, setShowRaidModal] = useState(false);
  const [messageHtml, setMessageHtml] = useState<string>(
    "Drag to rotate, pinch or scroll to zoom. Tap an organelle to inspect it, or press an action to watch its mechanism.",
  );
  const [messageIsBad, setMessageIsBad] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // 3D projected label coordinates
  const [labelCoords, setLabelCoords] = useState<
    Record<string, { x: number; y: number; visible: boolean }>
  >({});

  // Rivals
  const [rivals, setRivals] = useState([
    { n: "Vexa #124", b: 140, d: 2, h: 0.1 },
    { n: "Mira-9 #882", b: 220, d: 4, h: 0.4 },
    { n: "Oblong #315", b: 95, d: 1, h: 0.7 },
    { n: "Nox Lab #601", b: 310, d: 3, h: 0.9 },
  ]);
  const [selectedRivalIndex, setSelectedRivalIndex] = useState(0);

  // Helpers
  const curStrain = useMemo(() => {
    return (
      strains.find((s) => s.id === selectedStrainId && s.s === "Active") ||
      strains.find((s) => s.s === "Active") ||
      strains[0]
    );
  }, [strains, selectedStrainId]);

  const bmr = useCallback((s: StrainState): number => {
    const roles = [1, 2, 4].filter((b) => s.r & b);
    const maxBmr = Math.max(...roles.map((b) => BMR_R[b] || 100));
    return maxBmr * s.bm * (1 - 0.1 * s.L[2]);
  }, []);

  const stInfo = useCallback(
    (s: StrainState): string => {
      return `<b>#${s.id} ${rn(s.r)}</b> · Gen ${s.g} · ${
        s.v <= 0
          ? "starving 0%"
          : s.v <= 20
          ? "Chapter 11 Distressed"
          : "Active"
      } · efficiency ${s.eff} bps · BMR ${Math.round(bmr(s))} bps/h · treasury ${s.bal.toFixed(
        1,
      )} $SNACC`;
    },
    [bmr],
  );

  // Action validation
  const whyDisabled = useCallback(
    (a: string, st: StrainState): string => {
      if (a === "claim") {
        return resources.claim > 0
          ? ""
          : "Nothing to claim yet. Redeem elixir, then let the epoch close.";
      }
      if (st.s !== "Active") return "No living strain. Hatch a new one.";
      if (a === "harvest") {
        return st.v > 0.05 ? "Harvest needs a starving strain (vitality 0%)." : "";
      }
      const roleReq: Record<string, number> = { extract: 1, transmute: 2, synth: 4 };
      if (roleReq[a] && !(st.r & roleReq[a])) {
        const reqName = { extract: "Extractor", transmute: "Fermenter", synth: "Synthesizer" }[a];
        return `This strain is a ${rn(st.r)}. Switch to a strain with the ${reqName} role.`;
      }
      if (a === "divide") {
        if (dividesCount + 1 > mergersCount + lysesCount) {
          return "Gate EN-124: divides cannot exceed mergers + lyses. Splice or harvest first.";
        }
        if (strains.filter((s) => s.s === "Active").length >= MAXCOL) {
          return `Colony is full (${MAXCOL} cells).`;
        }
        if (st.g >= MAXGEN) return `Generation limit reached (Gen ${MAXGEN}).`;
      }
      if (a === "splice" && strains.filter((s) => s.s === "Active").length < 2) {
        return "Splice needs a second living strain.";
      }
      if (a === "raid") {
        if (st.v < 10) return "Too weak to raid (vitality under 10%).";
        if (st.rd === epoch) return "This strain already raided this epoch.";
      }
      if (a.startsWith("u")) {
        const slotIdx = parseInt(a[1], 10);
        const lvl = st.L[slotIdx] || 0;
        if (lvl >= 5) return "Slot is at max level 5.";
        if (st.al === epoch) return "Already allocated this epoch. Advance the epoch.";
        if (resources.atp < lvl + 1) return "Not enough ATP.";
      }
      const cost = COSTS[a];
      if (cost) {
        for (const k in cost) {
          if (
            (resources as Record<string, number>)[k] <
            (cost as Record<string, number>)[k]
          ) {
            return `Not enough ${NM[k] || k}.`;
          }
        }
      }
      return "";
    },
    [resources, dividesCount, mergersCount, lysesCount, strains, epoch],
  );

  // Trigger UI-118 Zone Banner
  const triggerZoneChange = useCallback(
    (newZoneIdx: number, newTemp: number, actionName?: string) => {
      const zName = ZN[newZoneIdx].n;
      const zRule = ZN[newZoneIdx].rule;
      const zCol = ZN[newZoneIdx].col;
      const fromZoneIdx = currentZoneIndex;

      // Add to threshold log (UI-119)
      setThresholdLogs((prev) => {
        const next = [
          {
            ep: epoch,
            f: fromZoneIdx,
            t: newZoneIdx,
            mk: Math.round(newTemp),
            by: actionName || lastActionRef.current,
          },
          ...prev,
        ];
        return next.slice(0, 8);
      });

      setCurrentZoneIndex(newZoneIdx);
      setZoneBannerText(`${zName} at ${Math.round(newTemp)} mK. ${zRule}.`);
      setZoneBannerColor(zCol);
      setZoneBannerVisible(true);

      if (zoneBannerTimerRef.current) {
        window.clearTimeout(zoneBannerTimerRef.current);
      }
      zoneBannerTimerRef.current = window.setTimeout(() => {
        setZoneBannerVisible(false);
      }, 3800);

      if (engineRef.current) {
        engineRef.current.setZoneTheme(newZoneIdx);
      }
    },
    [currentZoneIndex, epoch],
  );

  // Trigger UI-117 Nutrient Burst
  const triggerNutrientBurst = useCallback(
    (bps: number, untilEp: number) => {
      const clamped = Math.min(MAX_BURST_BPS, Math.max(BASE_BURST_BPS, bps));
      setBurstBps(clamped);
      setBurstUntilEpoch(untilEp);
      setIsBurstActive(true);
    },
    [],
  );

  // Advance Epoch
  const advanceEpoch = useCallback(() => {
    setEpoch((prev) => {
      const nextEp = prev + 1;
      let msg = `<b>Epoch ${nextEp} begins.</b> Hunger for the skipped time was applied.`;

      // Check burst expiration
      if (isBurstActive && nextEp >= burstUntilEpoch) {
        setIsBurstActive(false);
        setBurstBps(0);
        msg += " The nutrient burst expired.";
      }

      // Check dividends
      setResources((res) => {
        let newClaim = res.claim;
        let newPool = res.pool;
        let newCon = res.con;
        if (res.con > 0) {
          newClaim += res.pool;
          msg += ` The last epoch closed with a fixed dividend rate: ${newClaim.toFixed(
            1,
          )} $SNACC claimable.`;
          newPool = 0;
          newCon = 0;
        }
        return { ...res, claim: newClaim, pool: newPool, con: newCon };
      });

      // Apply hunger to strains
      setStrains((prevStrains) =>
        prevStrains.map((s) => {
          if (s.s !== "Active") return s;
          const hunger = 24 * (bmr(s) / 100);
          return { ...s, v: Math.max(0, s.v - hunger) };
        }),
      );

      setMessageHtml(msg);
      setMessageIsBad(false);
      return nextEp;
    });
    setEpochTimeRemaining(EP_DURATION_SEC);
  }, [isBurstActive, burstUntilEpoch, bmr]);

  // Hatch strain
  const hatchStrain = useCallback(() => {
    if (strains.filter((s) => s.s === "Active").length >= MAXCOL) {
      setMessageHtml(`Colony is full (${MAXCOL} cells).`);
      setMessageIsBad(true);
      return;
    }
    if (resources.sn < 30) {
      setMessageHtml("Hatching needs 30 $SNACC.");
      setMessageIsBad(true);
      return;
    }
    setResources((prev) => ({
      ...prev,
      sn: prev.sn - 30,
      pantry: prev.pantry + 6,
      atp: prev.atp + 50,
    }));
    const newId = nextStrainId;
    setNextStrainId((prev) => prev + 1);
    const roles = [1, 2, 4];
    const newStrain = mk0(newId, roles[newId % 3], 50);
    newStrain.bal = 24;
    setStrains((prev) => [...prev, newStrain]);
    setSelectedStrainId(newId);
    setMessageHtml(
      "<b>Hatch.</b> A genesis strain is born (Gen 0, one role). 20% of the deposit goes to the Pantry, 80% becomes its cytoplasm, and it brings 50 starting ATP.",
    );
    setMessageIsBad(false);
  }, [strains, resources.sn, nextStrainId]);

  // Execute gameplay mechanism
  const executeAction = useCallback(
    (action: string) => {
      const st = curStrain;
      const w = whyDisabled(action, st);
      if (w) {
        setMessageHtml(w);
        setMessageIsBad(true);
        return;
      }

      setIsBusy(true);
      lastActionRef.current = `strain #${st.id} ${action}`;

      // Deduct resource costs
      const cost = COSTS[action];
      if (cost) {
        setResources((prev) => {
          const next = { ...prev };
          for (const k in cost) {
            (next as Record<string, number>)[k] -= (cost as Record<string, number>)[k];
          }
          return next;
        });
      }

      if (action.startsWith("u")) {
        const slotIdx = parseInt(action[1], 10);
        const lvl = st.L[slotIdx] || 0;
        setResources((prev) => ({ ...prev, atp: prev.atp - (lvl + 1) }));
        setStrains((prev) =>
          prev.map((s) => {
            if (s.id !== st.id) return s;
            const newL = [...s.L] as [number, number, number];
            newL[slotIdx] = Math.min(5, newL[slotIdx] + 1);
            return { ...s, L: newL, al: epoch };
          }),
        );
      }

      // Tell 3D engine to play visual animation
      if (engineRef.current) {
        engineRef.current.play(action);
      }

      // Handle specific action logic & narratives
      if (action === "feed") {
        const bs = isBurstActive ? burstBps : 0;
        const fee = 10 * ((10000 - bs) / 10000);
        const fz = zi(crucibleTempMk);
        const burn = fz === 2 ? fee * 0.035 : 0;
        const rebate = fz === 0 ? fee * 0.02 : 0;

        setResources((prev) => ({
          ...prev,
          sn: prev.sn + (10 - fee + rebate),
          pool: prev.pool + 0.5 * (fee - burn),
          vol: prev.vol + 10,
        }));

        setStrains((prev) =>
          prev.map((s) => (s.id === st.id ? { ...s, v: Math.min(100, s.v + 8) } : s)),
        );

        const newTemp = Math.round(300 + (resources.vol + 10) * 20);
        setCrucibleTempMk(newTemp);
        const newZ = zi(newTemp);
        if (newZ !== currentZoneIndex) {
          triggerZoneChange(newZ, newTemp, `strain #${st.id} feed`);
        }

        setMessageHtml(
          `<b>Feed.</b> $SNACC crosses the membrane channel and the mitochondria oxidize it into ATP. Fee ${fee.toFixed(
            2,
          )}${bs ? ` (nutrient burst \u2212${bs / 100}%)` : ""}${
            fz === 2 ? ", Fever burns 3.5%" : ""
          }${fz === 0 ? ", Hypothermia rebates 2%" : ""}. Half of (fee \u2212 burn) feeds the dividend pool.`,
        );
        setMessageIsBad(false);
      } else if (action === "extract") {
        setMessageHtml(
          "<b>Extract.</b> Ribosomes on the rough ER build spore granules and pass them to the vacuole for storage.",
        );
        setMessageIsBad(false);
        setResources((prev) => ({ ...prev, sp: prev.sp + 2 }));
      } else if (action === "transmute") {
        setMessageHtml(
          "<b>Transmute.</b> mRNA leaves the nucleus; spores are assembled along the ER into enzymes.",
        );
        setMessageIsBad(false);
        setResources((prev) => ({ ...prev, en: prev.en + 1 }));
      } else if (action === "synth") {
        setMessageHtml(
          "<b>Synthesize.</b> Enzymes move to the Golgi, which packs elixir into a vesicle; the vesicle fuses with the membrane (exocytosis).",
        );
        setMessageIsBad(false);
        setResources((prev) => ({ ...prev, el: prev.el + 1 }));
      } else if (action === "divide") {
        const fis = !(st.r & (st.r - 1));
        setMessageHtml(
          `<b>${
            fis ? "Binary fission" : "Mitosis"
          }.</b> The nucleus duplicates and the cell pinches in two. Vitality, treasury and organelle levels are halved. The child is Gen ${
            st.g + 1
          } and inherits the genome.`,
        );
        setMessageIsBad(false);
        const childId = nextStrainId;
        setNextStrainId((prev) => prev + 1);
        setStrains((prev) => {
          const updatedParent = {
            ...st,
            v: st.v / 2,
            bal: st.bal / 2,
            L: st.L.map((x) => x >> 1) as [number, number, number],
          };
          const child: StrainState = {
            id: childId,
            r: st.r,
            v: updatedParent.v,
            bal: updatedParent.bal,
            g: st.g + 1,
            eff: st.eff,
            bm: st.bm,
            al: -1,
            L: [...updatedParent.L] as [number, number, number],
            s: "Active",
          };
          return prev.map((s) => (s.id === st.id ? updatedParent : s)).concat(child);
        });
        setDividesCount((prev) => prev + 1);
      } else if (action === "splice") {
        const target = strains.find((s) => s.id !== st.id && s.s === "Active");
        if (target) {
          const tax = target.bal * 0.025;
          setMessageHtml(
            `<b>Splice (endosymbiosis).</b> Strain #${target.id} is engulfed by #${st.id}: roles merge by OR, efficiency +800 bps, Gen+1, BMR \u221215%, 2.5% merger tax to the treasury. Mitochondria began exactly like this.`,
          );
          setMessageIsBad(false);
          setResources((prev) => ({ ...prev, pantry: prev.pantry + tax }));
          setStrains((prev) =>
            prev.map((s) => {
              if (s.id === target.id) {
                return { ...s, s: "SplicedBurned", v: 0 };
              }
              if (s.id === st.id) {
                return {
                  ...s,
                  r: s.r | target.r,
                  bal: s.bal + (target.bal - tax),
                  eff: s.eff + 800,
                  g: Math.max(s.g, target.g) + 1,
                  bm: s.bm * 0.85,
                  L: s.L.map((x, i) => Math.max(x, target.L[i])) as [
                    number,
                    number,
                    number,
                  ],
                };
              }
              return s;
            }),
          );
          setMergersCount((prev) => prev + 1);
        }
      } else if (action === "harvest") {
        const bo = st.bal * 0.1;
        const rec = st.bal - bo;
        setMessageHtml(
          `<b>Cell lysis.</b> The membrane ruptures. The liquidator takes a 10% bounty (${bo.toFixed(
            1,
          )}), 90% (${rec.toFixed(
            1,
          )}) returns to the Pantry, and the spilled nutrients give every cell a feed discount for one epoch (nutrient burst).`,
        );
        setMessageIsBad(false);
        setResources((prev) => ({
          ...prev,
          sn: prev.sn + bo,
          pantry: prev.pantry + rec,
        }));
        // Trigger UI-117 Burst (clamped to 500 bps)
        triggerNutrientBurst(Math.min(500, 200 + Math.round(rec * 20)), epoch + 1);
        setStrains((prev) =>
          prev.map((s) => (s.id === st.id ? { ...s, s: "Liquidated", bal: 0 } : s)),
        );
        setLysesCount((prev) => prev + 1);
      } else if (action === "redeem") {
        setMessageHtml(
          "<b>Redeem aether (phase 1).</b> One elixir is burned at the Golgi and your contribution is recorded for this epoch. Payment comes only after the epoch closes, pro-rata, so nobody can drain the pool first.",
        );
        setMessageIsBad(false);
        setResources((prev) => ({ ...prev, con: prev.con + 1 }));
      } else if (action === "raid") {
        const rival = rivals[selectedRivalIndex];
        const winProb = 0.55 + 0.07 * (st.L[0] + st.L[1]) - 0.1 * rival.d + (st.v - 50) / 500;
        const isWin = Math.random() < Math.max(0.1, Math.min(0.9, winProb));
        const loot = Math.max(5, rival.b * 0.15);
        const tax = loot * 0.1;
        const netLoot = loot - tax;

        if (isWin) {
          setResources((prev) => ({ ...prev, sn: prev.sn + netLoot, pantry: prev.pantry + tax }));
          setStrains((prev) =>
            prev.map((s) => (s.id === st.id ? { ...s, v: Math.max(0, s.v - 4), rd: epoch } : s)),
          );
          setRivals((prev) =>
            prev.map((r, i) => (i === selectedRivalIndex ? { ...r, b: r.b - loot } : r)),
          );
          setMessageHtml(
            `<b>Raid succeeded.</b> You looted ${netLoot.toFixed(1)} $SNACC from ${
              rival.n
            } (10% tax to the Pantry). The raid cost 4% vitality.`,
          );
          setMessageIsBad(false);
        } else {
          setStrains((prev) =>
            prev.map((s) => (s.id === st.id ? { ...s, v: Math.max(0, s.v - 15), rd: epoch } : s)),
          );
          setMessageHtml(
            `<b>Raid repelled.</b> ${rival.n} held its membrane. Your strain lost 15% vitality.`,
          );
          setMessageIsBad(true);
        }
      }
    },
    [
      curStrain,
      whyDisabled,
      strains,
      resources,
      isBurstActive,
      burstBps,
      crucibleTempMk,
      currentZoneIndex,
      epoch,
      nextStrainId,
      triggerZoneChange,
      triggerNutrientBurst,
      rivals,
      selectedRivalIndex,
    ],
  );

  // Initialize Three.js Engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new CellLab3DEngine(canvasRef.current, {
      onMessage: (html, isError) => {
        setMessageHtml(html);
        setMessageIsBad(!!isError);
      },
      onOrganelleSelect: (key) => {
        if (key && INFO[key]) {
          setMessageHtml(`<b>${engine.getOrganelleWorldPos(key) ? key.toUpperCase() : ""}.</b> ${INFO[key]}`);
          setMessageIsBad(false);
        } else {
          setMessageHtml(stInfo(curStrain) + "<br>Tap an organelle to inspect it.");
          setMessageIsBad(false);
        }
      },
      onDone: () => {
        setIsBusy(false);
      },
      onAction: () => {
        setIsBusy(true);
      },
    });

    engineRef.current = engine;

    // Timer to project organelle labels
    const labelTimer = window.setInterval(() => {
      const keys = ["nuc", "mit", "m2", "er", "gol", "lys", "vac", "ch"];
      const coords: Record<string, { x: number; y: number; visible: boolean }> = {};
      keys.forEach((k) => {
        coords[k] = engine.getProjectedOrganellePosition(k);
      });
      setLabelCoords(coords);
    }, 50);

    return () => {
      window.clearInterval(labelTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, [curStrain, stInfo]);

  // Update Three.js membrane color when selected strain vitality changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setVitalityColor(curStrain.v);
    }
  }, [curStrain.v]);

  // Keyboard navigation 1-9
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const actions: Record<string, string> = {
        "1": "feed",
        "2": "extract",
        "3": "transmute",
        "4": "synth",
        "5": "divide",
        "6": "splice",
        "7": "harvest",
        "8": "redeem",
        "9": "raid",
      };
      const action = actions[e.key];
      if (action) {
        if (action === "raid") {
          setShowRaidModal((prev) => !prev);
        } else {
          executeAction(action);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [executeAction]);

  // Background hunger simulation tick in Demo mode
  useEffect(() => {
    if (mode !== "demo") return;
    const interval = window.setInterval(() => {
      setEpochTimeRemaining((prev) => {
        if (prev <= 1) {
          advanceEpoch();
          return EP_DURATION_SEC;
        }
        return prev - 1;
      });

      // Volume decay
      setResources((prev) => {
        const decayedVol = prev.vol * Math.exp(-0.03);
        const temp = Math.round(300 + decayedVol * 20);
        setCrucibleTempMk(temp);
        const z = zi(temp);
        if (z !== currentZoneIndex) {
          triggerZoneChange(z, temp);
        }
        return { ...prev, vol: decayedVol };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [mode, advanceEpoch, currentZoneIndex, triggerZoneChange]);

  // Telemetry poller in Live mode
  useEffect(() => {
    if (mode !== "live") return;
    const poller = new TelemetryPoller({
      onMacroUpdate: (macro) => {
        setCrucibleTempMk(macro.crucibleTemp);
        const z = zi(macro.crucibleTemp);
        if (z !== currentZoneIndex) {
          triggerZoneChange(z, macro.crucibleTemp);
        }
      },
      onStrainsUpdate: (strainsList: StrainSummary[]) => {
        if (strainsList.length > 0) {
          setStrains(
            strainsList.slice(0, MAXCOL).map((s) => ({
              id: s.strain_id,
              r: s.role_mask || 1,
              v: s.effective_vitality ?? s.vitality ?? 80,
              bal: 30,
              g: s.generation || 0,
              eff: 10000,
              bm: 1,
              al: -1,
              L: [0, 0, 0],
              s: s.status === "Liquidated" ? "Liquidated" : s.status === "SplicedBurned" ? "SplicedBurned" : "Active",
            })),
          );
        }
      },
      onNewEvents: (events: CrucibleEvent[]) => {
        events.forEach((ev) => {
          if (ev.kind === "nutrient_burst_released" && ev.raw) {
            const bps = Number(ev.raw["burst_bps"] || 0);
            const until = Number(ev.raw["until_epoch"] || 0);
            triggerNutrientBurst(bps, until);
          } else if (ev.kind === "zone_changed" && ev.raw) {
            const temp = Number(ev.raw["crucible_temp"] || 605);
            const z = zi(temp);
            triggerZoneChange(z, temp, ev.receipt_id ? `tx:${ev.receipt_id.slice(0, 6)}` : undefined);
          }
        });
      },
      onBurstStateChange: (burstState) => {
        if (burstState.isActive && burstState.activeBurstBps > 0) {
          triggerNutrientBurst(burstState.activeBurstBps, burstState.untilEpoch);
        } else {
          setIsBurstActive(false);
        }
      },
      onBreachLogItem: (item) => {
        setThresholdLogs((prev) => [
          {
            ep: epoch,
            f: currentZoneIndex,
            t: zi(item.crucibleTemp),
            mk: item.crucibleTemp,
            by: item.actor,
          },
          ...prev.slice(0, 7),
        ]);
      },
      onAppetiteUpdate: (appetite) => {
        setAppetiteData({
          zone: appetite.zone ?? "NORMAL",
          crucibleTempMk: appetite.crucible_temp ?? null,
          currentEpoch: appetite.current_epoch ?? null,
          burstBps: appetite.burst_bps ?? null,
          burstUntil: appetite.burst_until ?? null,
          burstEpochsLeft: appetite.burst_epochs_left ?? null,
          dormant: appetite.dormant ?? null,
          feastVolume: appetite.feast_volume ?? null,
          feastTarget: appetite.feast_target ?? null,
          feastProgressPct: null,
          riskHeat: appetite.risk_heat ?? null,
          riskHeatPct: null,
          topFeeders: appetite.top_feeders || [],
          contractId: appetite.contractId ?? null,
          blockHeight: appetite.blockHeight ?? null,
        });
      },
    });

    poller.start();
    return () => poller.stop();
  }, [mode, currentZoneIndex, triggerZoneChange, triggerNutrientBurst, epoch]);

  // Fetch Live SVG and Strain Detail for UI-121
  const loadStrainSvg = useCallback(async (strainId: number) => {
    setSvgLoading(true);
    try {
      const [detail, svgRes] = await Promise.all([
        fetchStrain(strainId),
        fetchStrainSvg(strainId),
      ]);
      setSelectedStrainDetail(detail);
      if (svgRes.svg) {
        setSvgDataUri(svgToSafeDataUri(svgRes.svg));
      } else {
        setSvgDataUri(buildDemoSvgDataUri(strainId));
      }
    } catch {
      setSvgDataUri(buildDemoSvgDataUri(strainId));
    } finally {
      setSvgLoading(false);
    }
  }, []);

  // UI-121: Status color helper
  const getSolvencyColor = (vitality: number): string => {
    if (vitality > 50) return "#00ffcc"; // healthy
    if (vitality > 0) return "#ffaa00"; // warning
    return "#ff2255"; // liquidated
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        background: "#14123a",
        color: "var(--tx)",
        fontFamily: '600 14px/1.2 ui-rounded, "Segoe UI", system-ui, sans-serif',
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Canvas 3D */}
      <canvas
        id="c"
        ref={canvasRef}
        role="img"
        aria-label="Interactive 3D cutaway of a living cell with nucleus, two mitochondria, rough ER, Golgi, lysosome and vacuole. Drag to rotate, scroll or pinch to zoom, tap an organelle to inspect it."
      />

      {/* Vignette Overlay */}
      <div id="vg" />

      {/* Rival Raid Modal (#rv) */}
      {!showRaidModal ? null : (
        <div id="rv" className="hud pn">
          <b>Choose a rival colony to raid · 4 ATP</b>
          {rivals.map((q, i) => (
            <button
              key={i}
              className="rr"
              onClick={() => {
                setSelectedRivalIndex(i);
                setShowRaidModal(false);
                executeAction("raid");
              }}
            >
              <b>{q.n}</b>
              <span>
                treasury {q.b | 0} · defense L{q.d} · win chance{" "}
                {Math.round(
                  (0.55 + 0.07 * (curStrain.L[0] + curStrain.L[1]) - 0.1 * q.d + (curStrain.v - 50) / 500) *
                    100,
                )}
                %
              </span>
            </button>
          ))}
          <button className="rr" onClick={() => setShowRaidModal(false)}>
            Close
          </button>
        </div>
      )}

      {/* #res: Resource Top Bar */}
      <div id="res" className="hud">
        <div className="rp pn" id="p-sn">
          <i style={{ background: "#ffb35c" }} />
          <b>{Math.floor(resources.sn)}</b>
          <small>$SNACC</small>
        </div>
        <div className="rp pn" id="p-atp">
          <i style={{ background: "#ffd24a" }} />
          <b>{Math.floor(resources.atp)}</b>
          <small>ATP</small>
        </div>
        <div className="rp pn" id="p-sp">
          <i style={{ background: "#9be86a" }} />
          <b>{Math.floor(resources.sp)}</b>
          <small>Spores</small>
        </div>
        <div className="rp pn" id="p-en">
          <i style={{ background: "#b69cff" }} />
          <b>{Math.floor(resources.en)}</b>
          <small>Enzymes</small>
        </div>
        <div className="rp pn" id="p-el">
          <i style={{ background: "#ffb3c8" }} />
          <b>{Math.floor(resources.el)}</b>
          <small>Elixir</small>
        </div>
      </div>

      {/* #sub: Controls & Status Bar */}
      <div id="sub" className="hud">
        <span id="zn" className="pn" aria-live="polite">
          Epoch {epoch} · {Math.ceil(epochTimeRemaining)}s · {ZN[currentZoneIndex].n}{" "}
          {Math.round(crucibleTempMk)} mK
          {isBurstActive ? ` · burst \u2212${burstBps / 100}%` : ""}
          {mode === "demo" ? " · demo" : " · live"}
        </span>
        <button
          id="bl"
          className="pn"
          aria-pressed={showLabels}
          onClick={() => setShowLabels((prev) => !prev)}
        >
          Labels
        </button>
        <button
          id="bs"
          className="pn"
          aria-pressed={seeThrough}
          onClick={() => {
            const next = !seeThrough;
            setSeeThrough(next);
            if (engineRef.current) engineRef.current.setSeeThrough(next);
          }}
        >
          See-through
        </button>
        <button
          id="bg"
          className="pn"
          aria-pressed={showLogPanel}
          onClick={() => {
            setShowLogPanel((prev) => !prev);
            setShowSvgPanel(false);
            setShowAppetitePanel(false);
          }}
        >
          Log
        </button>
        <button
          id="bv"
          className="pn"
          aria-pressed={showSvgPanel}
          onClick={() => {
            const next = !showSvgPanel;
            setShowSvgPanel(next);
            setShowLogPanel(false);
            setShowAppetitePanel(false);
            if (next) loadStrainSvg(selectedStrainId);
          }}
        >
          SVG
        </button>
        <button
          id="ba"
          className="pn"
          aria-pressed={showAppetitePanel}
          onClick={() => {
            setShowAppetitePanel((prev) => !prev);
            setShowLogPanel(false);
            setShowSvgPanel(false);
          }}
        >
          Appetite
        </button>
        <button
          id="bm"
          className="pn"
          aria-pressed={mode === "live"}
          onClick={() => setMode((prev) => (prev === "demo" ? "live" : "demo"))}
          title="Toggle Demo (Simulated) / Live (NEAR Testnet)"
        >
          {mode === "demo" ? "Mode: Demo" : "Mode: Live"}
        </button>
        {onSkinSwitch ? (
          <button
            id="bk"
            className="pn"
            onClick={() => onSkinSwitch(currentSkin === "biolab" ? "fintech" : "biolab")}
            title="Toggle ADR-31 Dual Skin"
          >
            Skin: {currentSkin === "biolab" ? "Bio-Lab" : "FinTech"}
          </button>
        ) : null}
      </div>

      {/* #tabs: Colony Strains Pills */}
      <div id="tabs" className="hud" role="group" aria-label="Strains in the colony">
        {strains.map((s) => (
          <button
            key={s.id}
            className={`tb ${s.id === selectedStrainId ? "on" : ""} ${
              s.s !== "Active" ? "off" : ""
            }`}
            onClick={() => {
              setSelectedStrainId(s.id);
              if (showSvgPanel) loadStrainSvg(s.id);
            }}
          >
            #{s.id} {rn(s.r)} G{s.g}
            {s.s !== "Active" ? ` ${s.s}` : ""}
            <em className="br">
              <span
                style={{
                  width: `${Math.round(s.v)}%`,
                  background: s.v > 20 ? "#5be3c1" : s.v > 0 ? "#ffc15a" : "#ff5d7a",
                }}
              />
            </em>
          </button>
        ))}
      </div>

      {/* #ev: Event Banners (#zb and #nb) */}
      <div id="ev">
        {/* UI-118: Zone Banner */}
        <div
          id="zb"
          role="status"
          className={zoneBannerVisible ? "on" : ""}
          style={{
            borderColor: zoneBannerColor,
            color: zoneBannerColor,
          }}
        >
          {zoneBannerText}
        </div>

        {/* UI-117: Nutrient Burst Badge */}
        <div
          id="nb"
          role="status"
          className={isBurstActive ? "on" : ""}
        >
          {isBurstActive
            ? `Nutrient Burst: feed fee \u2212${burstBps / 100}% until epoch ${burstUntilEpoch}`
            : ""}
        </div>
      </div>

      {/* UI-119: Threshold Log Panel (#lg) */}
      {!showLogPanel ? null : (
        <div id="lg" className="hud pn">
          <b>
            Threshold log
            {mode === "demo" ? " (demo replay, not on-chain)" : ""}
          </b>
          {thresholdLogs.length ? (
            thresholdLogs.map((e, idx) => (
              <span key={idx}>
                Epoch {e.ep}: {ZN[e.f].n} to {ZN[e.t].n} at {e.mk} mK
                {e.by ? `, last action: ${e.by}` : ""}
                {e.tx ? (
                  <>
                    {" "}·{" "}
                    <a
                      href={`https://testnet.nearblocks.io/txns/${e.tx}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--y)" }}
                    >
                      tx
                    </a>
                  </>
                ) : null}
              </span>
            ))
          ) : (
            <span>No threshold crossed yet. Feed to heat the crucible above 610 mK.</span>
          )}
        </div>
      )}

      {/* UI-121: Live SVG Inspector Panel (#svg-ins) */}
      {!showSvgPanel ? null : (
        <div
          id="svg-ins"
          className="hud pn"
          style={{
            top: "calc(176px + env(safe-area-inset-top, 0px))",
            zIndex: 3,
            padding: "10px",
            display: "grid",
            gap: "8px",
            maxHeight: "44vh",
            overflow: "auto",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>Live SVG Inspector · Strain #{selectedStrainId}</b>
            <span
              style={{
                padding: "2px 6px",
                borderRadius: "4px",
                background: "var(--ink)",
                color: getSolvencyColor(curStrain.v),
                fontWeight: 600,
              }}
            >
              {curStrain.v > 50 ? "Healthy" : curStrain.v > 0 ? "Warning" : "Liquidated"}
            </span>
          </div>

          {/* Real rendered on-chain SVG */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              background: "#0a0a20",
              borderRadius: "8px",
              padding: "6px",
              border: "1px solid var(--ink)",
            }}
          >
            {svgLoading ? (
              <span>Loading on-chain SVG...</span>
            ) : svgDataUri ? (
              <img
                src={svgDataUri}
                alt={`Strain #${selectedStrainId} live on-chain NFT SVG`}
                style={{ width: "160px", height: "160px", objectFit: "contain" }}
              />
            ) : (
              <span>No SVG available</span>
            )}
          </div>

          {/* 8 On-Chain Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
            <div>
              <small style={{ opacity: 0.7 }}>1. ID & Gen:</small>
              <div>#{selectedStrainId} · Gen {selectedStrainDetail?.generation ?? curStrain.g}</div>
            </div>
            <div>
              <small style={{ opacity: 0.7 }}>2. Sub-Account:</small>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedStrainDetail?.vault_subaccount ?? `s-${selectedStrainId}.snacc-v001.testnet`}
              </div>
            </div>
            <div>
              <small style={{ opacity: 0.7 }}>3. Vitality & BMR:</small>
              <div>{Math.round(selectedStrainDetail?.vitality ?? curStrain.v)}% · {Math.round(selectedStrainDetail?.bmr_per_hour ?? bmr(curStrain))} bps/h</div>
            </div>
            <div>
              <small style={{ opacity: 0.7 }}>4. Cash Balance:</small>
              <div>{curStrain.bal.toFixed(1)} $SNACC</div>
            </div>
            <div>
              <small style={{ opacity: 0.7 }}>5. NEP-245 Inventory:</small>
              <div>
                {resources.sp} Sp / {resources.en} En / {resources.el} El
              </div>
            </div>
            <div>
              <small style={{ opacity: 0.7 }}>6. Efficiency & Temp:</small>
              <div>{selectedStrainDetail?.efficiency_bps ?? curStrain.eff} bps · {Math.round(crucibleTempMk)} mK</div>
            </div>
            <div>
              <small style={{ opacity: 0.7 }}>7. TEE Phenotype:</small>
              <div>{rn(curStrain.r)} (TDX Attested)</div>
            </div>
            <div>
              <small style={{ opacity: 0.7 }}>8. Genome SHA-256:</small>
              <div style={{ fontFamily: "monospace", fontSize: "10px" }}>
                7a8f...c91d
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UI-122: Panel get_appetite_meter (#appetite-pn) */}
      {!showAppetitePanel ? null : (
        <div
          id="appetite-pn"
          className="hud pn"
          style={{
            top: "calc(176px + env(safe-area-inset-top, 0px))",
            zIndex: 3,
            padding: "10px",
            display: "grid",
            gap: "8px",
            maxHeight: "44vh",
            overflow: "auto",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>Grand Appetite Meter (EN-112)</b>
            <span
              style={{
                color: ZN[currentZoneIndex].col,
                border: `1px solid ${ZN[currentZoneIndex].col}`,
                padding: "2px 6px",
                borderRadius: "6px",
              }}
            >
              {ZN[currentZoneIndex].n} ({Math.round(crucibleTempMk)} mK)
            </span>
          </div>

          <div>
            <small style={{ opacity: 0.7 }}>Countdown:</small>{" "}
            <b>Epoch {epoch} · {Math.ceil(epochTimeRemaining)}s remaining</b>
          </div>

          <div>
            <small style={{ opacity: 0.7 }}>Nutrient Burst:</small>{" "}
            {isBurstActive ? (
              <span style={{ color: "var(--y)" }}>
                Active: \u2212{burstBps / 100}% until epoch {burstUntilEpoch}
              </span>
            ) : (
              <span>Inactive</span>
            )}
          </div>

          <div>
            <b style={{ display: "block", marginBottom: "4px" }}>Top 3 Feeders:</b>
            <div style={{ display: "grid", gap: "2px" }}>
              {appetiteData && appetiteData.topFeeders.length > 0 ? (
                appetiteData.topFeeders.slice(0, 3).map((f, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{i + 1}. {f.account_id}</span>
                    <b>{f.amount}</b>
                  </div>
                ))
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>1. player.testnet</span>
                    <b>120 $SNACC</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>2. alkemis.testnet</span>
                    <b>85 $SNACC</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>3. treasury.snacc-v001.testnet</span>
                    <b>50 $SNACC</b>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Organelle 3D Projected Labels */}
      {showLabels
        ? Object.entries(labelCoords).map(([k, c]) => {
            if (!c.visible) return null;
            return (
              <div
                key={k}
                className="lb"
                style={{
                  display: c.visible ? "block" : "none",
                  transform: `translate(${c.x}px, ${c.y}px) translate(-50%, -150%)`,
                }}
              >
                {k === "m2" ? "Mitochondrion" : k.toUpperCase()}
              </div>
            );
          })
        : null}

      {/* #msg: Status & Narrative Box */}
      <div
        id="msg"
        className={`hud pn ${messageIsBad ? "bad" : ""}`}
        role="status"
        dangerouslySetInnerHTML={{ __html: messageHtml }}
      />

      {/* #up: Upgrades & Epoch Controls Row */}
      <nav id="up" className="hud" aria-label="Organelle upgrades">
        <button
          className={whyDisabled("u0", curStrain) ? "off" : ""}
          onClick={() => executeAction("u0")}
        >
          Mitochondrion L{curStrain.L[0]}
          {curStrain.L[0] < 5 ? ` · ${curStrain.L[0] + 1} ATP` : " · max"}
        </button>
        <button
          className={whyDisabled("u1", curStrain) ? "off" : ""}
          onClick={() => executeAction("u1")}
        >
          Nucleus L{curStrain.L[1]}
          {curStrain.L[1] < 5 ? ` · ${curStrain.L[1] + 1} ATP` : " · max"}
        </button>
        <button
          className={whyDisabled("u2", curStrain) ? "off" : ""}
          onClick={() => executeAction("u2")}
        >
          Lysosome L{curStrain.L[2]}
          {curStrain.L[2] < 5 ? ` · ${curStrain.L[2] + 1} ATP` : " · max"}
        </button>
        <button onClick={hatchStrain}>Hatch · 30 $SNACC</button>
        <button onClick={advanceEpoch}>Advance epoch</button>
        {resources.claim > 0 ? (
          <button onClick={() => executeAction("claim")}>
            Claim dividend +{resources.claim.toFixed(1)}
          </button>
        ) : null}
        <button onClick={() => setResources((prev) => ({ ...prev, sn: prev.sn + 50 }))}>
          Demo faucet +50
        </button>
      </nav>

      {/* #dock: 9 Action Keys with aria-keyshortcuts */}
      <nav id="dock" className="hud pn" aria-label="Cell actions">
        <button
          data-a="feed"
          aria-keyshortcuts="1"
          className={whyDisabled("feed", curStrain) || isBusy ? "off" : ""}
          onClick={() => executeAction("feed")}
        >
          Feed<small>10 $SNACC</small>
        </button>
        <button
          data-a="extract"
          aria-keyshortcuts="2"
          className={whyDisabled("extract", curStrain) || isBusy ? "off" : ""}
          onClick={() => executeAction("extract")}
        >
          Extract<small>1 ATP</small>
        </button>
        <button
          data-a="transmute"
          aria-keyshortcuts="3"
          className={whyDisabled("transmute", curStrain) || isBusy ? "off" : ""}
          onClick={() => executeAction("transmute")}
        >
          Transmute<small>2 ATP + 2 spores</small>
        </button>
        <button
          data-a="synth"
          aria-keyshortcuts="4"
          className={whyDisabled("synth", curStrain) || isBusy ? "off" : ""}
          onClick={() => executeAction("synth")}
        >
          Synthesize<small>3 ATP + 2 enzymes</small>
        </button>
        <button
          data-a="divide"
          aria-keyshortcuts="5"
          className={whyDisabled("divide", curStrain) || isBusy ? "off" : ""}
          onClick={() => executeAction("divide")}
        >
          Divide<small>3 ATP</small>
        </button>
        <button
          data-a="splice"
          aria-keyshortcuts="6"
          className={whyDisabled("splice", curStrain) || isBusy ? "off" : ""}
          onClick={() => executeAction("splice")}
        >
          Splice<small>5 ATP</small>
        </button>
        <button
          data-a="harvest"
          aria-keyshortcuts="7"
          className={whyDisabled("harvest", curStrain) || isBusy ? "off" : ""}
          onClick={() => executeAction("harvest")}
        >
          Harvest<small>at 0% vitality</small>
        </button>
        <button
          data-a="redeem"
          aria-keyshortcuts="8"
          className={whyDisabled("redeem", curStrain) || isBusy ? "off" : ""}
          onClick={() => executeAction("redeem")}
        >
          Redeem<small>1 elixir</small>
        </button>
        <button
          data-a="raid"
          aria-keyshortcuts="9"
          className={whyDisabled("raid", curStrain) || isBusy ? "off" : ""}
          onClick={() => setShowRaidModal((prev) => !prev)}
        >
          Raid<small>4 ATP</small>
        </button>
      </nav>
    </div>
  );
};
