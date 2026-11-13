import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MacroZone } from "./config/zones.ts";
import { classifyZone } from "./config/zones.ts";
import type { SkinMode } from "./config/constants.ts";
import { INITIAL_ATP, SKIN_LABELS } from "./config/constants.ts";
import type {
  AppetiteViewModel,
  BreachLogItem,
  NutrientBurstState,
  StrainDetail,
  StrainSummary,
  SvgLoadStatus,
} from "./data/types.ts";
import { fetchStrain, fetchStrainSvg } from "./data/api.ts";
import { mapAppetite } from "./data/appetite.ts";
import { buildDemoSvgDataUri, svgToSafeDataUri } from "./data/svg.ts";
import { filterLogsForMode, formatLiveAtp, formatLiveVitality, resolveSelectedStrain } from "./data/liveView.ts";
import { OptimisticManager, type OptimisticVitalityState } from "./data/optimistic.ts";
import { TelemetryPoller } from "./data/poller.ts";
import { ModeSwitch } from "./hud/ModeSwitch.tsx";
import { AccountFilter } from "./hud/AccountFilter.tsx";
import { SkinSwitch } from "./hud/SkinSwitch.tsx";
import { AppetitePanel } from "./hud/AppetitePanel.tsx";
import { ThermalGauge } from "./hud/ThermalGauge.tsx";
import { BreachLog } from "./hud/BreachLog.tsx";
import "./ui/fd.css";
import "./ui/hud.css";
import { Icon } from "./ui/fd.tsx";
import { ToolsToolbar, type ToolId } from "./hud/ToolsToolbar.tsx";
import { clearGuestLabel, readGuestLabel, saveGuestLabel, type GuestLabel } from "./auth/guestLabel.ts";
import { npcName } from "./data/npc.ts";
import { ActionDock, ProductionQueuePanel, ResourceBar, type DockButton } from "./hud/GameHud.tsx";
import { CellLab } from "./hud/CellLab.tsx";
import {
  applyAction as applySimAction,
  collectProduction,
  createInitialSimulation,
  tickSimulation,
  type LabAction,
  type SimulationState,
} from "./game/simulation.ts";
import type { GameMode } from "./config/constants.ts";
import { irisMode, receiptLine } from "./plate/iso/layout.ts";
import { useReducedMotion } from "./prefs/motionPref.ts";
import { readSkinPref } from "./prefs/prefs.ts";
import { GuideLayer } from "./help/GuideLayer.tsx";
import { AppLegalLinks } from "./help/AppLegalLinks.tsx";
import { bioSound } from "./sound.ts";

import { ColonyPlate } from "./plate/ColonyPlate.tsx";
import { IrisOverlay } from "./hud/IrisOverlay.tsx";
import { useWallet } from "./chain/wallet.tsx";
import { useAccountInfo } from "./chain/useAccountInfo.ts";
import { WalletControl } from "./hud/WalletControl.tsx";
import type { GameActionKey } from "./hud/GameActions.tsx";
import { useAccount } from "./account/session.tsx";
import { achievementToast } from "./account/model.ts";
import { AccountChip, StarterPackButton } from "./hud/AccountChip.tsx";
import { NotificationsBell } from "./hud/NotificationsBell.tsx";

// Tool windows load on first open, outside the game's entry chunk.
// UI-148/149: the profile and notification windows (shown only with the profile features on).
const ProfileModal = React.lazy(() => import("./hud/ProfileModal.tsx"));
// UI-153: the daily quests window (shown only with the profile features on).
const QuestsModal = React.lazy(() => import("./hud/QuestsModal.tsx"));
const NotificationsModal = React.lazy(() => import("./hud/NotificationsModal.tsx"));
const MyCollection = React.lazy(() => import("./hud/MyCollection.tsx"));
const SwapPanel = React.lazy(() => import("./hud/SwapPanel.tsx"));
const NpcPanel = React.lazy(() => import("./hud/NpcPanel.tsx"));
const SocialLeaderboardModal = React.lazy(() => import("./hud/SocialLeaderboardModal.tsx"));
const ThesisDashboardModal = React.lazy(() => import("./hud/ThesisDashboardModal.tsx"));
const GuestLabelModal = React.lazy(() => import("./hud/GuestLabelModal.tsx"));
const RecipeSearchModal = React.lazy(() => import("./hud/RecipeSearchModal.tsx"));
// Signed actions (UI-146) load on first open as well.
const HatchModal = React.lazy(() => import("./hud/ChainActions.tsx").then((m) => ({ default: m.HatchModal })));
const FeedModal = React.lazy(() => import("./hud/ChainActions.tsx").then((m) => ({ default: m.FeedModal })));
// UI-150: the remaining player actions, one chunk loaded on first open.
const GameActions = React.lazy(() => import("./hud/GameActions.tsx"));

/** Toolbar entries that need the optional profile features (UI-148). */
const PROFILE_TOOLS = ["profile", "quests"] as const;

/** `/app?strain=<id>` (the "Open in game" link of `/snacc/<id>`): the strain to open in the lab. */
export function strainFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("strain");
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

/** Dock key shown only in live mode with a connected wallet (UI-146). */
const HATCH_DOCK = { key: "hatch", label: "Hatch", hint: "incubate_strain" } as const;
/** Live-mode dock key that opens the list of every signed action (UI-150), with or without a wallet. */
const MORE_DOCK = { key: "more", label: "Actions", hint: "every game action" } as const;
/** Dock keys that send a real transaction when a wallet is connected in live mode. */
const SIGNED_DOCK_KEYS = new Set(["hatch", "feed", "atp", "extract", "transmute", "synthesize", "divide", "harvest"]);
/** Live dock key → UI-150 window. */
const LIVE_DOCK_WINDOW: Record<string, GameActionKey> = {
  atp: "allocate",
  extract: "extract",
  transmute: "transmute",
  synthesize: "synthesize",
  divide: "divide",
  harvest: "hungry",
};

const demoSeedLogs: BreachLogItem[] = [
  {
    id: "seed-1",
    kind: "nutrient_burst_released",
    actor: "strain #3",
    summary: "cell lysis released 7200 nutrients · discount -20.00% until epoch 2",
    crucibleTemp: 591,
    tempDeltaMk: 0,
    timestampMs: Date.now() - 2400,
    renderedAtMs: Date.now() - 2380,
    latencyMs: 20,
    meetsSla: true,
  },
  {
    id: "seed-2",
    kind: "zone_changed",
    actor: "alkemis.testnet",
    summary: "alkemis.testnet triggered a zone shift from hypothermia to goldilocks (605 mK)",
    crucibleTemp: 605,
    tempDeltaMk: 14,
    timestampMs: Date.now() - 1100,
    renderedAtMs: Date.now() - 1085,
    latencyMs: 15,
    meetsSla: true,
  },
];

const DOCK_DEFS: { key: string; label: string; hint: string; action: LabAction | "harvest" }[] = [
  { key: "feed", label: "Feed", hint: "feed_strain", action: "feed" },
  { key: "atp", label: "Produce ATP", hint: "allocate_atp", action: "atp" },
  { key: "extract", label: "Extract", hint: "extract_spores", action: "extract" },
  { key: "transmute", label: "Transmute", hint: "transmute", action: "transmute" },
  { key: "synthesize", label: "Synthesize", hint: "synthesize", action: "synthesize" },
  { key: "divide", label: "Divide", hint: "divide_strain", action: "divide" },
  { key: "harvest", label: "Harvest", hint: "harvest_starving", action: "harvest" },
];

function formatSimNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>("demo");
  const [skin, setSkin] = useState<SkinMode>(() => readSkinPref());
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [zone, setZone] = useState<MacroZone>("Goldilocks");
  const [crucibleTempMk, setCrucibleTempMk] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const [atpBalance, setAtpBalance] = useState(INITIAL_ATP);
  const [guest, setGuest] = useState<GuestLabel | null>(() => readGuestLabel());
  // The guest label may only seed the highlight filter with a valid `.testnet` account.
  const [userAccount, setUserAccount] = useState(() => readGuestLabel()?.account ?? "");
  const [liveStrains, setLiveStrains] = useState<StrainSummary[]>([]);
  const [indexerIncomplete, setIndexerIncomplete] = useState(false);
  const [selectedStrain, setSelectedStrain] = useState<StrainDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [labOpen, setLabOpen] = useState(false);
  const [isLoadingStrain, setIsLoadingStrain] = useState(false);
  const [svgDataUri, setSvgDataUri] = useState<string | null>(null);
  const [svgStatus, setSvgStatus] = useState<SvgLoadStatus>("idle");
  const [appetite, setAppetite] = useState<AppetiteViewModel | null>(null);
  const [appetiteLoading, setAppetiteLoading] = useState(true);
  const [appetiteError, setAppetiteError] = useState(false);
  const [sim, setSim] = useState<SimulationState>(() => createInitialSimulation());
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [tool, setTool] = useState<ToolId | null>(null);
  const closeTool = useCallback(() => setTool(null), []);
  const [toast, setToast] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [iris, setIris] = useState<{ phase: "closing" | "opening"; cx: number; cy: number } | null>(null);
  const [coinBurst, setCoinBurst] = useState(0);
  const [coinKind, setCoinKind] = useState<string>("atp");
  const [milestones, setMilestones] = useState<Set<string>>(new Set());
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [, setBurst] = useState<NutrientBurstState>({
    isActive: false,
    activeBurstBps: 0,
    untilEpoch: 0,
    releasedVita: "0",
    triggeringStrainId: null,
  });
  const [optimistic, setOptimistic] = useState<OptimisticVitalityState>({
    baseVitality: 8500,
    currentVitality: 8500,
    pendingDelta: 0,
    status: "idle",
    lastActionTimestamp: 0,
  });
  const optimisticManagerRef = useRef<OptimisticManager>(new OptimisticManager(8500));
  const liveStrainsRef = useRef<StrainSummary[]>([]);
  const simRef = useRef(sim);
  simRef.current = sim;
  const atpBalanceRef = useRef(INITIAL_ATP);
  atpBalanceRef.current = atpBalance;

  const [logs, setLogs] = useState<BreachLogItem[]>(demoSeedLogs);

  // UI-145: a connected wallet is the effective account; the manual highlight still works without one.
  const wallet = useWallet();
  const [chainRefresh, setChainRefresh] = useState(0);
  const accountInfo = useAccountInfo(wallet.accountId, chainRefresh);
  const effectiveAccount = wallet.accountId ?? userAccount;
  // UI-148: optional profile session (inert without the Supabase env).
  const account = useAccount();
  const recordTxRef = useRef(account.recordTx);
  recordTxRef.current = account.recordTx;
  /** UI-149: strain a notification asked to open in My collection. */
  const [collectionFocus, setCollectionFocus] = useState<number | null>(null);
  /** UI-148: "Get testnet NEAR to start" beside the faucet link (renders nothing when the features are off). */
  const starterPack = account.enabled ? <StarterPackButton onSent={() => setChainRefresh((n) => n + 1)} /> : null;
  const walletConnected = wallet.status === "connected" && wallet.accountId !== null;
  /** Live mode + wallet: the hatch and feed keys send real testnet transactions. */
  const signedActions = mode === "live" && walletConnected;
  const [chainAction, setChainAction] = useState<"hatch" | "feed" | "menu" | GameActionKey | null>(null);
  /** Strain picked in My collection for the signed feed; the dock falls back to the plate selection. */
  const [feedTarget, setFeedTarget] = useState<number | null>(null);
  const closeChainAction = useCallback(() => setChainAction(null), []);
  const openFeedFor = useCallback((strainId: number) => {
    setFeedTarget(strainId);
    setChainAction("feed");
  }, []);
  /** UI-150: Strain Detail → a signed action window for that strain. */
  const openActionFor = useCallback((key: GameActionKey, strainId: number) => {
    setFeedTarget(strainId);
    setChainAction(key);
  }, []);

  const matchedStrainsCount = useMemo(() => {
    const q = effectiveAccount.trim().toLowerCase();
    if (!q) return 0;
    if (mode === "demo") return 1;
    return liveStrains.filter((s) => s.owner_id.toLowerCase().includes(q)).length;
  }, [effectiveAccount, liveStrains, mode]);

  // Simulation tick (demo only).
  useEffect(() => {
    if (mode !== "demo") return;
    const timer = window.setInterval(() => {
      setSim((prev) => {
        const next = tickSimulation(prev, 0.25);
        if (next.vitality !== prev.vitality) return next;
        if (next.queue.some((item, i) => item.ready !== prev.queue[i]?.ready || Math.abs(item.remainingSec - (prev.queue[i]?.remainingSec ?? 0)) > 0.01)) {
          return next;
        }
        return next;
      });
      setAtpBalance((prev) => Math.max(0, prev));
    }, 250);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode === "demo") {
      setAtpBalance(sim.atpBalance);
      const nextTemp = sim.crucibleTempMk;
      const nextZone = classifyZone(nextTemp);
      setCrucibleTempMk(nextTemp);
      setZone(nextZone);
      optimisticManagerRef.current.syncFromChain(sim.vitality);
    }
  }, [sim, mode]);

  useEffect(() => {
    const unsub = optimisticManagerRef.current.subscribe((next) => setOptimistic(next));
    return unsub;
  }, []);

  useEffect(() => {
    const enableSound = () => {
      bioSound.enabled = true;
    };
    window.addEventListener("pointerdown", enableSound, { once: true });
    window.addEventListener("keydown", enableSound, { once: true });
    const onKeycap = (event: Event) => {
      if ((event.target as HTMLElement | null)?.closest?.(".keycap")) bioSound.playClick();
    };
    document.addEventListener("click", onKeycap);
    return () => {
      window.removeEventListener("pointerdown", enableSound);
      window.removeEventListener("keydown", enableSound);
      document.removeEventListener("click", onKeycap);
    };
  }, []);

  useEffect(() => {
    liveStrainsRef.current = liveStrains;
  }, [liveStrains]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (appetite === null) {
        setAppetiteLoading(false);
        setAppetiteError(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const poller = new TelemetryPoller({
      onMacroUpdate: (macroData) => {
        setIsBackendConnected(true);
        if (mode === "live") {
          setCrucibleTempMk(macroData.crucibleTemp);
          setZone(classifyZone(macroData.crucibleTemp));
        }
      },
      onStrainsUpdate: (strains) => {
        setIsBackendConnected(true);
        setLiveStrains(strains);
      },
      onAppetiteUpdate: (raw) => {
        setIsBackendConnected(true);
        setAppetite(mapAppetite(raw));
        setAppetiteLoading(false);
        setAppetiteError(false);
      },
      onNewEvents: () => setIsBackendConnected(true),
      onIndexerIncomplete: (incomplete) => setIndexerIncomplete(incomplete),
      onBreachLogItem: (item) => setLogs((prev) => [item, ...prev.slice(0, 15)]),
      onBurstStateChange: (burstState) => setBurst(burstState),
      onStrainFed: () => undefined,
      onStrainLiquidated: () => undefined,
    });
    poller.start();
    return () => poller.stop();
  }, [mode, effectiveAccount, chainRefresh]);

  const loadStrain = useCallback(
    async (cellId: number) => {
      setSelectedId(cellId);
      setLabOpen(true);
      if (mode === "demo") {
        if (cellId === 1) {
          const vitality = simRef.current.vitality;
          setSelectedStrain({
            strain_id: 1,
            owner_id: effectiveAccount.trim() || "player.testnet",
            vault_subaccount: "v1.snacc-crucible.testnet",
            vitality,
            efficiency_bps: 9850,
            bmr_per_hour: 45,
            last_fed_sec: Math.floor(Date.now() / 1000) - 120,
            role_mask: 1,
            state_nonce: 12,
            pending_callbacks: 0,
            atp_balance: String(simRef.current.atpBalance),
            generation: simRef.current.generation,
            organel: simRef.current.organel,
            status: "Active",
            effective_vitality: vitality,
          });
          setSvgDataUri(buildDemoSvgDataUri(1));
          setSvgStatus("ready");
          return;
        }
        // Demo ambient strains use fixed simulated vitals.
        const demoStatus = cellId === 3 ? "Distressed" : "Active";
        const demoVitality = cellId === 3 ? 3100 : 7200;
        setSelectedStrain({
          strain_id: cellId,
          owner_id: cellId === 3 ? "strain-3.testnet" : "strain-2.testnet",
          vault_subaccount: "",
          vitality: demoVitality,
          efficiency_bps: 9000,
          bmr_per_hour: 40,
          last_fed_sec: Math.floor(Date.now() / 1000) - 60,
          role_mask: 0,
          state_nonce: 0,
          pending_callbacks: 0,
          atp_balance: "0",
          generation: 1,
          organel: { mitokondria: 1, nukleus: 1, lisosom: 0 },
          status: demoStatus,
          effective_vitality: demoVitality,
        });
        setSvgDataUri(buildDemoSvgDataUri(cellId));
        setSvgStatus("ready");
        return;
      }
      setIsLoadingStrain(true);
      setSvgStatus("loading");
      setSvgDataUri(null);
      try {
        const [detail, svgRes] = await Promise.all([fetchStrain(cellId), fetchStrainSvg(cellId)]);
        const resolved = detail ?? resolveSelectedStrain(cellId, liveStrainsRef.current);
        setSelectedStrain(resolved);
        const uri = svgRes.svg ? svgToSafeDataUri(svgRes.svg) : null;
        setSvgDataUri(uri);
        if (uri) setSvgStatus("ready");
        else if (svgRes.svg !== null) setSvgStatus("no-data");
        else if (svgRes.status === 404) setSvgStatus("no-data");
        else setSvgStatus("error");
      } finally {
        setIsLoadingStrain(false);
      }
    },
    [mode, effectiveAccount],
  );

  /** After a signed action: re-read the wallet views, restart the poller and reload the open strain. */
  const handleChainDone = useCallback(
    (ok: boolean, txHash?: string | null) => {
      if (!ok) return;
      setChainRefresh((n) => n + 1);
      bioSound.playFeed();
      if (selectedId !== null && labOpen) void loadStrain(selectedId);
      // UI-148: record the activity when signed in to the profile. Fire and forget: `recordTx` never
      // rejects, and a failure only means no achievement toast.
      void recordTxRef.current(txHash).then((codes) => {
        const text = achievementToast(codes);
        if (text) {
          setToast(text);
          window.setTimeout(() => setToast(null), 4000);
        }
      });
    },
    [selectedId, labOpen, loadStrain],
  );

  const handleCellSelect = useCallback(
    (cellId: number, cx: number, cy: number) => {
      if (irisMode(reducedMotion) === "fade") {
        void loadStrain(cellId);
        return;
      }
      setIris({ phase: "closing", cx, cy });
      window.setTimeout(() => {
        void loadStrain(cellId);
        setIris({ phase: "opening", cx, cy });
        window.setTimeout(() => setIris(null), 560);
      }, 460);
    },
    [loadStrain, reducedMotion],
  );

  const handleLabClose = useCallback(() => {
    if (irisMode(reducedMotion) === "fade") {
      setLabOpen(false);
      setSelectedId(null);
      return;
    }
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setIris({ phase: "closing", cx, cy });
    window.setTimeout(() => {
      setLabOpen(false);
      setSelectedId(null);
      setIris({ phase: "opening", cx, cy });
      window.setTimeout(() => setIris(null), 560);
    }, 340);
  }, [reducedMotion]);

  const handleModeChange = (nextMode: GameMode) => {
    setMode(nextMode);
    setSelectedStrain(null);
    setSelectedId(null);
    setLabOpen(false);
    setSvgDataUri(null);
    setSvgStatus("idle");
    if (nextMode === "live") {
      setLogs([]);
    } else {
      setLogs(demoSeedLogs);
      setSim(createInitialSimulation());
    }
  };

  // UI-148: `/app?strain=<id>` switches to live mode once and opens that strain in the lab.
  const deepStrain = useRef<number | null>(typeof window === "undefined" ? null : strainFromSearch(window.location.search));
  useEffect(() => {
    if (deepStrain.current === null) return;
    if (mode !== "live") {
      setMode("live");
      setLogs([]);
      return;
    }
    const id = deepStrain.current;
    deepStrain.current = null;
    void loadStrain(id);
  }, [mode, loadStrain]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const doSimAction = useCallback((action: LabAction | "harvest"): boolean => {
    const result = applySimAction(simRef.current, action as LabAction);
    if (!result.ok) {
      bioSound.playDenied();
      showToast(result.error ?? "action unavailable");
      return false;
    }
    setSim(result.state);
    if (action === "feed") {
      bioSound.playFeed();
      optimisticManagerRef.current.applyFeed(220);
      window.setTimeout(() => optimisticManagerRef.current.confirm(), 1200);
    } else if (action === "atp" || action === "extract" || action === "transmute" || action === "synthesize") {
      bioSound.playFeed();
      showToast("production started (demo · simulated)");
    }
    if (action === "feed" || action === "harvest") {
      showToast(result.state.log[0] ?? "done");
    }
    return true;
  }, []);

  const handleLabAction = useCallback(
    (action: LabAction): boolean => {
      if (mode === "live") {
        // Preview only: the animation is played by CellLab; live numbers never change.
        showToast("preview only — on-chain transactions need a wallet");
        return true;
      }
      return doSimAction(action);
    },
    [mode, doSimAction],
  );

  const handleDock = useCallback(
    (key: string) => {
      if (mode === "live") {
        if (key === "more") {
          setFeedTarget(null);
          setChainAction("menu");
          return;
        }
        if (signedActions && (key === "hatch" || key === "feed")) {
          setFeedTarget(null);
          setChainAction(key);
          return;
        }
        if (signedActions && LIVE_DOCK_WINDOW[key]) {
          setFeedTarget(null);
          setChainAction(LIVE_DOCK_WINDOW[key]);
          return;
        }
        showToast("connect a wallet to sign game actions on testnet");
        return;
      }
      const def = DOCK_DEFS.find((d) => d.key === key);
      if (!def) return;
      doSimAction(def.action);
    },
    [mode, doSimAction, signedActions, walletConnected],
  );

  const handleCollect = useCallback(
    (id: string) => {
      const item = simRef.current.queue.find((entry) => entry.id === id);
      const result = collectProduction(simRef.current, id);
      if (!result.ok) {
        showToast(result.error ?? "not ready");
        return;
      }
      setSim(result.state);
      bioSound.playCollect();
      showToast(result.state.log[0] ?? "collected");
      if (item) {
        setCoinKind(item.kind);
        setCoinBurst((n) => n + 1);
        window.setTimeout(() => setCoinBurst(0), 950);
        const milestone =
          item.kind === "atp" ? "First ATP" : item.kind === "spores" ? "First spore" : item.kind === "elixir" ? "First elixir" : null;
        if (milestone && !milestones.has(milestone)) {
          setMilestones((prev) => new Set(prev).add(milestone));
          setMilestoneToast(milestone);
          window.setTimeout(() => setMilestoneToast(null), 4200);
        }
      }
    },
    [milestones],
  );

  const handleUpgrade = useCallback(
    (slot: "mitokondria" | "nucleus" | "lysosome") => {
      if (mode === "live") {
        showToast("on-chain transactions need a wallet — outside this demo");
        return;
      }
      const directResult = ((): { state: SimulationState; ok: boolean; error: string | null } => {
        if (slot === "mitokondria") {
          const current = simRef.current;
          if (current.organel.mitokondria >= 5) return { state: current, ok: false, error: "mitokondria already at max level 5" };
          const cost = 40 * (current.organel.mitokondria + 1);
          if (current.atp < cost) return { state: current, ok: false, error: `need ${cost} atp, have ${current.atp}` };
          return {
            state: {
              ...current,
              atp: current.atp - cost,
              organel: { ...current.organel, mitokondria: current.organel.mitokondria + 1 },
              log: [`mitokondria upgraded to ${current.organel.mitokondria + 1}: +10% atp output`, ...current.log.slice(0, 7)],
            },
            ok: true,
            error: null,
          };
        }
        return applySimAction(simRef.current, slot === "nucleus" ? "nucleus" : "lysosome");
      })();
      if (!directResult.ok) {
        bioSound.playDenied();
        showToast(directResult.error ?? "upgrade unavailable");
        return;
      }
      setSim(directResult.state);
      showToast(directResult.state.log[0] ?? "upgraded");
    },
    [mode],
  );

  const plateCells = useMemo(() => {
    if (mode === "demo") {
      const producing = sim.queue.some((item) => item.kind === "atp" && !item.ready);
      return [
        { id: 1, vitalityRatio: sim.vitality / 10000, status: "Active", highlighted: true, index: 0, generation: sim.generation, producing, budding: sim.generation > 1 },
        { id: 2, vitalityRatio: 0.72, status: "Active", highlighted: false, index: 1, generation: 1, producing: false },
        { id: 3, vitalityRatio: 0.31, status: "Distressed", highlighted: false, index: 2, generation: 1, producing: false },
      ];
    }
    return liveStrains.map((s, i) => ({
      id: s.strain_id,
      vitalityRatio: typeof s.vitality === "number" ? s.vitality / 10000 : null,
      status: s.status ?? "Active",
      highlighted: Boolean(effectiveAccount && s.owner_id.toLowerCase().includes(effectiveAccount.trim().toLowerCase())),
      index: i,
      generation: s.generation ?? 1,
      producing: false,
    }));
  }, [mode, sim.vitality, sim.generation, sim.queue, liveStrains, effectiveAccount]);

  const resources = useMemo(
    () =>
      mode === "demo"
        ? {
            snacc: formatSimNumber(sim.snacc),
            atp: formatSimNumber(sim.atp),
            spores: formatSimNumber(sim.spores),
            enzymes: formatSimNumber(sim.enzymes),
            elixir: formatSimNumber(sim.elixir),
          }
        : {
            snacc: "—",
            atp: formatLiveAtp(selectedStrain?.atp_balance ?? null),
            spores: "—",
            enzymes: "—",
            elixir: "—",
          },
    [mode, sim, selectedStrain],
  );

  const dock: DockButton[] = useMemo(
    () =>
      [...(signedActions ? [HATCH_DOCK] : []), ...DOCK_DEFS, ...(mode === "live" ? [MORE_DOCK] : [])].map((d) => ({
        key: d.key,
        label: d.label,
        hint: d.hint,
        disabled: mode === "live" && d.key !== MORE_DOCK.key && !(signedActions && SIGNED_DOCK_KEYS.has(d.key)),
      })),
    [mode, signedActions],
  );

  const governedLogs = useMemo(() => filterLogsForMode(logs, mode), [logs, mode]);
  const vitalityLabel =
    mode === "live"
      ? formatLiveVitality(selectedStrain?.vitality ?? null)
      : optimistic.currentVitality.toLocaleString("en-US");

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[var(--bg)] font-sans text-[var(--ink-hi)]">
      <div className="plate-bg absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <ColonyPlate
          cells={plateCells}
          zone={zone}
          selectedId={selectedId}
          onCellSelect={handleCellSelect}
          crucibleTempMk={crucibleTempMk}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-2 p-2.5 select-none sm:p-4">
        <div className="flex flex-col gap-2">
          <header className="hidden flex-wrap items-start justify-between gap-2 sm:flex">
            <div className="pointer-events-auto flex flex-col gap-1.5">
              <span className="label-plate">
                <span className="lp-label">fig</span>
                <span className="font-mono text-xs font-bold tracking-wider text-[var(--ink-hi)]">
                  $SNACC <span className="font-normal text-[var(--ink)]">·</span>{" "}
                  <span className="hidden font-medium text-[var(--ink)] min-[420px]:inline">{SKIN_LABELS[skin].crucible}</span>
                </span>
              </span>
              <ModeSwitch mode={mode} onChange={handleModeChange} isBackendConnected={isBackendConnected} />
              {walletConnected ? null : (
                <AccountFilter account={userAccount} onChange={setUserAccount} matchedCount={matchedStrainsCount} />
              )}
              <span className="label-plate">
                vitality: <span className="lp-value font-mono">{vitalityLabel}</span>
                <span className="lp-label normal-case">{mode === "live" ? "select a cell for lab" : "tap a cell to open the lab"}</span>
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-end gap-1.5">
              <div className="pointer-events-auto flex items-start gap-1.5">
                <NotificationsBell onOpen={() => setTool("notifications")} />
                <AccountChip onOpenProfile={() => setTool("profile")} />
                <WalletControl wallet={wallet} info={accountInfo} lowBalanceExtra={starterPack} />
              </div>
              <div className="pointer-events-auto">
                <SkinSwitch skin={skin} onChange={setSkin} />
              </div>
              <ResourceBar mode={mode} resources={resources} skin={skin} />
            </div>
          </header>

          <header className="flex flex-col gap-2 sm:hidden" data-testid="mobile-header">
            <div className="flex items-center justify-between gap-2">
              <span className="label-plate shrink-0 whitespace-nowrap">
                <span className="lp-label">fig</span>
                <span className="font-mono text-[13px] font-bold tracking-wider text-[var(--ink-hi)]">$SNACC</span>
              </span>
              <div className="pointer-events-auto flex items-center gap-1.5">
                <ModeSwitch mode={mode} onChange={handleModeChange} isBackendConnected={isBackendConnected} />
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  aria-label="more options"
                  className="keycap inline-flex min-h-[40px] min-w-[40px] items-center justify-center px-2 focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
                >
                  <Icon name="more" />
                </button>
              </div>
            </div>
            <div className="pointer-events-auto w-full min-w-0">
              <ResourceBar mode={mode} resources={resources} skin={skin} />
            </div>
            <div className="pointer-events-auto flex w-full min-w-0 justify-end">
              <WalletControl wallet={wallet} info={accountInfo} compact lowBalanceExtra={starterPack} />
            </div>
            {account.enabled ? (
              <div className="pointer-events-auto flex w-full min-w-0 items-start justify-end gap-1.5">
                <NotificationsBell onOpen={() => setTool("notifications")} />
                <AccountChip compact onOpenProfile={() => setTool("profile")} />
              </div>
            ) : null}
            {moreOpen ? (
              <div className="pointer-events-auto flex flex-col gap-1.5 rounded-xl border border-[var(--edge)] bg-[var(--panel)] p-2 shadow-[0_2px_0_var(--edge)]" data-testid="mobile-more">
                {walletConnected ? null : (
                  <AccountFilter account={userAccount} onChange={setUserAccount} matchedCount={matchedStrainsCount} />
                )}
                <SkinSwitch skin={skin} onChange={setSkin} />
                <span className="label-plate">
                  vitality: <span className="lp-value font-mono">{vitalityLabel}</span>
                  <span className="lp-label normal-case">{mode === "live" ? "select a cell for lab" : "tap a cell to open the lab"}</span>
                </span>
              </div>
            ) : null}
          </header>
        </div>

        {milestoneToast ? (
          <div
            className="milestone-plate pointer-events-auto mx-auto max-w-xs rounded-xl border border-[var(--ink-hi)] bg-white px-4 py-2 text-center shadow-[0_3px_0_var(--ink-hi)]"
            role="status"
            data-testid="milestone-plate"
          >
            <span className="block font-mono text-[9px] tracking-[0.18em] text-[var(--ink)] uppercase">engraved</span>
            <span className="block text-sm font-bold lowercase text-[var(--ink-hi)]">{milestoneToast}</span>
          </div>
        ) : null}

        {toast ? (
          <div
            className="pointer-events-auto mx-auto max-w-md rounded-xl border border-[var(--ink-hi)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold lowercase text-[var(--accent-ink)] shadow-[0_3px_0_var(--ink-hi)]"
            role="status"
            data-testid="hud-toast"
          >
            {toast}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            <ToolsToolbar
              skin={skin}
              panelsOpen={panelsOpen}
              onTogglePanels={() => setPanelsOpen((v) => !v)}
              onOpen={setTool}
              guestLabel={guest?.label || null}
              hidden={account.enabled ? [] : PROFILE_TOOLS}
            />
            <span className="label-plate pointer-events-auto hidden lowercase sm:inline-flex">
              <span className="lp-label">
                {mode === "demo" ? "demo · simulated" : signedActions ? "live · testnet · wallet connected" : "live · testnet reads only"}
              </span>
            </span>
          </div>
          {panelsOpen ? (
            <div className="pointer-events-none flex max-h-[32dvh] flex-col gap-2 overflow-y-auto sm:max-h-none sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div className="pointer-events-auto min-w-0 flex-1">
                <BreachLog logs={governedLogs} indexerIncomplete={indexerIncomplete} />
              </div>
              <div className="pointer-events-auto flex flex-col gap-2">
                <AppetitePanel appetite={appetite} isLoading={appetiteLoading} error={appetiteError} mode={mode} />
                <ThermalGauge crucibleTempMk={crucibleTempMk} skin={skin} />
              </div>
              <div className="pointer-events-auto w-full sm:w-auto">
                <ProductionQueuePanel
                  mode={mode}
                  queue={mode === "demo" ? sim.queue : []}
                  onCollect={handleCollect}
                  queueEmptyText={
                    mode === "demo" ? "queue empty — press produce atp below" : "production runs on-chain; nothing local"
                  }
                />
              </div>
            </div>
          ) : mode === "demo" && sim.queue.length > 0 ? (
            <div className="pointer-events-auto sm:max-w-sm">
              <ProductionQueuePanel
                mode={mode}
                queue={sim.queue}
                onCollect={handleCollect}
                queueEmptyText="queue empty"
              />
            </div>
          ) : null}
          <ActionDock dock={dock} onDock={handleDock} />
          {mode === "demo" ? (
            <span
              className="receipt-tape pointer-events-auto mx-auto max-w-full overflow-x-auto text-center font-mono text-[10px] lowercase whitespace-nowrap text-[var(--ink)]"
              data-testid="receipt-tape"
              role="status"
            >
              demo · simulated — {receiptLine(sim.totalIn, sim.totalOut)}
            </span>
          ) : (
            <span className="pointer-events-auto text-center font-mono text-[10px] lowercase text-[var(--ink)]" data-testid="live-tx-note">
              {signedActions
                ? "game actions are signed in your wallet on testnet · $SNACC on testnet has no monetary value"
                : "connect a wallet to sign game actions on testnet · reads work without one"}
            </span>
          )}
          {mode === "demo" && walletConnected ? (
            <span className="pointer-events-auto text-center font-mono text-[10px] lowercase text-[var(--ink)]">
              wallet connected · switch to live to send real testnet transactions
            </span>
          ) : null}
          {mode === "demo" ? (
            <span className="pointer-events-auto text-center font-mono text-[10px] lowercase text-[var(--ink)]">
              demo · simulated — numbers come from local constants, not the chain
            </span>
          ) : null}
          <AppLegalLinks />
        </div>
      </div>

      <IrisOverlay iris={iris} reducedMotion={reducedMotion} />

      {coinBurst > 0 ? (
        <div className="coin-arc" aria-hidden="true" data-testid="coin-arc">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={`${coinBurst}-${i}`}
              className="coin"
              style={{ left: `${46 + i * 2}%`, animationDelay: `${i * 70}ms`, ["--arc"]: `${-30 - i * 2}vw` } as React.CSSProperties}
            >
              {coinKind}
            </span>
          ))}
        </div>
      ) : null}

      {labOpen ? (
        <CellLab
          strain={selectedStrain}
          isLoading={isLoadingStrain}
          zone={zone}
          mode={mode}
          skin={skin}
          svgDataUri={svgDataUri}
          svgStatus={svgStatus}
          simOrganel={sim.organel}
          atpAvailable={sim.atp}
          onClose={handleLabClose}
          onAction={handleLabAction}
          onUpgrade={handleUpgrade}
          onOpenNpcMarket={() => setTool("npc")}
        />
      ) : null}

      <React.Suspense fallback={<div className="fd-modal fd-ui" role="status" aria-label="loading tool" />}>
        {tool === "collection" ? (
          <MyCollection
            accountId={effectiveAccount || null}
            skin={skin}
            mode={mode}
            onClose={() => {
              setCollectionFocus(null);
              closeTool();
            }}
            onFeedStrain={walletConnected ? openFeedFor : undefined}
            onStrainAction={walletConnected ? openActionFor : undefined}
            refreshKey={chainRefresh}
            focusStrainId={collectionFocus}
          />
        ) : null}
        {tool === "profile" && account.enabled ? <ProfileModal onClose={closeTool} /> : null}
        {tool === "quests" && account.enabled ? <QuestsModal onClose={closeTool} /> : null}
        {tool === "notifications" && account.enabled ? (
          <NotificationsModal
            onClose={closeTool}
            onOpenStrain={(id) => {
              setCollectionFocus(id);
              setTool("collection");
            }}
          />
        ) : null}
        {tool === "swap" ? <SwapPanel mode={mode} onClose={closeTool} skin={skin} /> : null}
        {tool === "social" ? <SocialLeaderboardModal onClose={closeTool} appetite={appetite} mode={mode} skin={skin} /> : null}
        {tool === "thesis" ? <ThesisDashboardModal onClose={closeTool} mode={mode} skin={skin} /> : null}
        {tool === "npc" ? (
          <NpcPanel
            onClose={closeTool}
            skin={skin}
            crucibleTempMk={crucibleTempMk}
            mode={mode}
            userSnaccBalance={sim.snacc}
            onBuySpores={(npcId, amount, totalCost) => {
              setSim((prev) => ({
                ...prev,
                snacc: Math.max(0, prev.snacc - totalCost),
                spores: prev.spores + amount,
              }));
              setMilestoneToast(`+${amount} spores from ${npcName(npcId, skin)}`);
              showToast(`simulation: bought ${amount} spores for ${totalCost} $SNACC`);
            }}
          />
        ) : null}
        {tool === "guest" ? (
          <GuestLabelModal
            current={guest}
            skin={skin}
            onClose={closeTool}
            onSave={(next) => {
              const saved = saveGuestLabel(next);
              setGuest(saved);
              if (saved.account) setUserAccount(saved.account);
              setTool(null);
              showToast(saved.label ? `guest label set: ${saved.label} (local only)` : "guest label saved (local only)");
            }}
            onClear={() => {
              clearGuestLabel();
              if (guest?.account && userAccount === guest.account) setUserAccount("");
              setGuest(null);
              setTool(null);
              showToast("guest label cleared");
            }}
          />
        ) : null}
        {tool === "recipes" ? <RecipeSearchModal onClose={closeTool} skin={skin} zone={zone} /> : null}
        {chainAction === "hatch" && signedActions ? (
          <HatchModal wallet={wallet} info={accountInfo} onClose={closeChainAction} onDone={handleChainDone} />
        ) : null}
        {/* My collection is always live data, so its feed only needs the wallet; the dock also needs live mode. */}
        {chainAction === "feed" && walletConnected ? (
          <FeedModal
            wallet={wallet}
            info={accountInfo}
            onClose={closeChainAction}
            onDone={handleChainDone}
            preferredStrainId={feedTarget ?? selectedId}
          />
        ) : null}
        {/* UI-150: the action menu and its windows open in live mode (reads work without a wallet; signing needs one). */}
        {chainAction !== null && chainAction !== "hatch" && chainAction !== "feed" && (mode === "live" || walletConnected) ? (
          <GameActions
            action={chainAction}
            wallet={wallet}
            info={accountInfo}
            onPick={setChainAction}
            onClose={closeChainAction}
            onDone={handleChainDone}
            preferredStrainId={feedTarget ?? selectedId}
          />
        ) : null}
      </React.Suspense>
      <GuideLayer tool={tool} onCloseTool={closeTool} skin={skin} onSkin={setSkin} />
    </main>
  );
};
