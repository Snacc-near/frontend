import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MacroZone } from "./config/zones.ts";
import { classifyZone } from "./config/zones.ts";
import type { SkinMode } from "./config/constants.ts";
import { INITIAL_ATP } from "./config/constants.ts";
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
import type { GameMode } from "./game/engine.ts";
import { bioSound } from "./sound.ts";

const ColonyPlate = lazy(() => import("./plate/ColonyPlate.tsx").then((m) => ({ default: m.ColonyPlate })));

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
  const [skin, setSkin] = useState<SkinMode>("biolab");
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [zone, setZone] = useState<MacroZone>("Goldilocks");
  const [crucibleTempMk, setCrucibleTempMk] = useState(605);
  const [atpBalance, setAtpBalance] = useState(INITIAL_ATP);
  const [userAccount, setUserAccount] = useState("");
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
  const [toast, setToast] = useState<string | null>(null);
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

  const matchedStrainsCount = useMemo(() => {
    const q = userAccount.trim().toLowerCase();
    if (!q) return 0;
    if (mode === "demo") return 1;
    return liveStrains.filter((s) => s.owner_id.toLowerCase().includes(q)).length;
  }, [userAccount, liveStrains, mode]);

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
      onMacroUpdate: (macro) => {
        setIsBackendConnected(true);
        if (mode === "live") {
          setCrucibleTempMk(macro.crucibleTemp);
          setZone(classifyZone(macro.crucibleTemp));
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
  }, [mode, userAccount]);

  const loadStrain = useCallback(
    async (cellId: number) => {
      setSelectedId(cellId);
      setLabOpen(true);
      if (mode === "demo") {
        if (cellId === 1) {
          const vitality = simRef.current.vitality;
          setSelectedStrain({
            strain_id: 1,
            owner_id: userAccount.trim() || "player.testnet",
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
    [mode, userAccount],
  );

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

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const doSimAction = useCallback((action: LabAction | "harvest") => {
    const result = applySimAction(simRef.current, action as LabAction);
    if (!result.ok) {
      bioSound.playDenied();
      showToast(result.error ?? "action unavailable");
      return;
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
  }, []);

  const handleLabAction = useCallback(
    (action: LabAction) => {
      if (mode === "live") {
        // Preview only: play is handled by CellLab; live numbers never change.
        showToast("preview only (live numbers unchanged)");
        return;
      }
      doSimAction(action);
    },
    [mode, doSimAction],
  );

  const handleDock = useCallback(
    (key: string) => {
      const def = DOCK_DEFS.find((d) => d.key === key);
      if (!def) return;
      if (mode === "live") {
        showToast("on-chain transactions need a wallet — outside this demo");
        return;
      }
      doSimAction(def.action);
    },
    [mode, doSimAction],
  );

  const handleCollect = useCallback((id: string) => {
    const result = collectProduction(simRef.current, id);
    if (!result.ok) {
      showToast(result.error ?? "not ready");
      return;
    }
    setSim(result.state);
    bioSound.playCollect();
    showToast(result.state.log[0] ?? "collected");
  }, []);

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
      return [
        { id: 1, vitalityRatio: sim.vitality / 10000, status: "Active", highlighted: true, index: 0 },
        { id: 2, vitalityRatio: 0.72, status: "Active", index: 1 },
        { id: 3, vitalityRatio: 0.31, status: "Distressed", index: 2 },
      ];
    }
    return liveStrains.map((s, i) => ({
      id: s.strain_id,
      vitalityRatio: typeof s.vitality === "number" ? s.vitality / 10000 : null,
      status: s.status ?? "Active",
      highlighted: Boolean(userAccount && s.owner_id.toLowerCase().includes(userAccount.trim().toLowerCase())),
      index: i,
    }));
  }, [mode, sim.vitality, liveStrains, userAccount]);

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
      DOCK_DEFS.map((d) => ({
        key: d.key,
        label: d.label,
        hint: d.hint,
        disabled: mode === "live",
      })),
    [mode],
  );

  const governedLogs = useMemo(() => filterLogsForMode(logs, mode), [logs, mode]);
  const vitalityLabel =
    mode === "live"
      ? formatLiveVitality(selectedStrain?.vitality ?? null)
      : optimistic.currentVitality.toLocaleString("en-US");

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center text-xs lowercase text-slate-400" role="status">
              loading colony plate…
            </div>
          }
        >
          <ColonyPlate cells={plateCells} zone={zone} selectedId={selectedId} onCellSelect={loadStrain} />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-2 p-2.5 select-none sm:p-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wider text-slate-100">
              $SNACC <span className="font-normal text-slate-500">·</span>{" "}
              <span className="hidden font-medium text-slate-300 min-[420px]:inline">living cell crucible</span>
            </span>
            <ModeSwitch mode={mode} onChange={handleModeChange} isBackendConnected={isBackendConnected} />
            <AccountFilter account={userAccount} onChange={setUserAccount} matchedCount={matchedStrainsCount} />
            <span className="rounded-full bg-slate-950/80 px-2 py-1 text-[10px] lowercase text-slate-300 backdrop-blur-md">
              vitality: <span className="font-mono font-bold text-emerald-300">{vitalityLabel}</span>
              {mode === "live" ? " · select a cell for lab" : " · tap a cell to open the lab"}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="pointer-events-auto">
              <SkinSwitch skin={skin} onChange={setSkin} />
            </div>
            <ResourceBar mode={mode} resources={resources} />
          </div>
        </header>

        {toast ? (
          <div
            className="pointer-events-auto mx-auto max-w-md rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold lowercase text-slate-950 shadow-lg"
            role="status"
            data-testid="hud-toast"
          >
            {toast}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPanelsOpen((v) => !v)}
              aria-expanded={panelsOpen}
              className="pointer-events-auto min-h-[40px] rounded-full bg-slate-950/85 px-4 text-[11px] font-semibold lowercase backdrop-blur-md focus-visible:ring-2 focus-visible:ring-cyan-300 focus:outline-none"
            >
              telemetry {panelsOpen ? "hide" : "show"}
            </button>
            <span className="pointer-events-auto rounded-full bg-slate-950/80 px-2 py-1 text-[10px] lowercase text-slate-400 backdrop-blur-md">
              {mode === "demo" ? "demo · simulated" : "live · /api data only"}
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
          {mode === "live" ? (
            <span className="pointer-events-auto text-center text-[10px] lowercase text-slate-400">
              on-chain transactions need a wallet — outside this demo
            </span>
          ) : (
            <span className="pointer-events-auto text-center text-[10px] lowercase text-slate-500">
              demo · simulated — numbers come from local constants, not the chain
            </span>
          )}
        </div>
      </div>

      {labOpen ? (
        <CellLab
          strain={selectedStrain}
          isLoading={isLoadingStrain}
          zone={zone}
          mode={mode}
          svgDataUri={svgDataUri}
          svgStatus={svgStatus}
          simOrganel={sim.organel}
          atpAvailable={sim.atp}
          onClose={() => {
            setLabOpen(false);
            setSelectedId(null);
          }}
          onAction={handleLabAction}
          onUpgrade={handleUpgrade}
        />
      ) : null}
    </main>
  );
};
