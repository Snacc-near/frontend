import React, { useEffect, useRef, useState, useMemo } from "react";
import type { MacroZone } from "./config/zones.ts";
import { classifyZone } from "./config/zones.ts";
import type { SkinMode } from "./config/constants.ts";
import { INITIAL_ATP } from "./config/constants.ts";
import type {
  BreachLogItem,
  NutrientBurstState,
  StrainDetail,
  StrainSummary,
} from "./data/types.ts";
import { fetchStrain } from "./data/api.ts";
import { filterLogsForMode, resolveSelectedStrain } from "./data/liveView.ts";
import { OptimisticManager, type OptimisticVitalityState } from "./data/optimistic.ts";
import { TelemetryPoller } from "./data/poller.ts";
import { GameEngine, type GameMode } from "./game/engine.ts";
import { HudOverlay } from "./hud/HudOverlay.tsx";

// Demo-mode seed entries for the breach log. Never rendered in live mode:
// there the log only contains events from /api/events.
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

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const optimisticManagerRef = useRef<OptimisticManager>(new OptimisticManager(8500));

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
  const [isLoadingStrain, setIsLoadingStrain] = useState(false);

  const [burst, setBurst] = useState<NutrientBurstState>({
    isActive: false,
    activeBurstBps: 0,
    untilEpoch: 0,
    releasedVita: "0",
    triggeringStrainId: null,
  });

  const [optimistic, setOptimistic] = useState<OptimisticVitalityState>(
    optimisticManagerRef.current.getState(),
  );

  // Refs mirroring the values used inside stable engine/poller callbacks
  const liveStrainsRef = useRef<StrainSummary[]>([]);
  const userAccountRef = useRef("");
  const atpBalanceRef = useRef(INITIAL_ATP);

  const [logs, setLogs] = useState<BreachLogItem[]>(demoSeedLogs);

  // Count the strains matching the account filter
  const matchedStrainsCount = useMemo(() => {
    const q = userAccount.trim().toLowerCase();
    if (!q) return 0;
    if (mode === "demo") return 1;
    return liveStrains.filter((s) => s.owner_id.toLowerCase().includes(q)).length;
  }, [userAccount, liveStrains, mode]);

  // 1. Initialize the engine canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current, {
      onSporeCollected: (valueAtp, bonusTempMk) => {
        setAtpBalance((prev) => prev + valueAtp);
        setCrucibleTempMk((prev) => {
          const next = Math.min(680, prev + bonusTempMk);
          const nextZone = classifyZone(next);
          setZone(nextZone);
          engine.setZone(nextZone);
          return next;
        });
      },
      onCellClick: async (cellId) => {
        if (mode === "demo" && cellId === 1) {
          setSelectedStrain({
            strain_id: 1,
            owner_id: userAccountRef.current.trim() || "player.testnet",
            vault_subaccount: "v1.snacc-crucible.testnet",
            vitality: optimisticManagerRef.current.getState().currentVitality,
            efficiency_bps: 9850,
            bmr_per_hour: 45,
            last_fed_sec: Math.floor(Date.now() / 1000) - 120,
            role_mask: 1,
            state_nonce: 12,
            pending_callbacks: 0,
            atp_balance: String(atpBalanceRef.current),
            generation: 1,
            organel: {
              mitokondria: 2,
              nukleus: 1,
              lisosom: 1,
            },
            status: "Active",
            effective_vitality: optimisticManagerRef.current.getState().currentVitality,
          });
          return;
        }

        // Live mode: fetch the on-chain data from /api/strains/:id.
        // If the API has no record, show nothing rather than inventing values.
        setIsLoadingStrain(true);
        try {
          const detail = await fetchStrain(cellId);
          setSelectedStrain(detail ?? resolveSelectedStrain(cellId, liveStrainsRef.current));
        } finally {
          setIsLoadingStrain(false);
        }
      },
    });

    engineRef.current = engine;
    // The engine is re-created on every mode change and defaults to demo: set the real mode,
    // otherwise the demo player cell would also be drawn on top of the live strains.
    engine.setMode(mode);
    engine.start();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [mode]);

  // Keep the callback-facing refs in sync with state
  useEffect(() => {
    liveStrainsRef.current = liveStrains;
  }, [liveStrains]);
  useEffect(() => {
    userAccountRef.current = userAccount;
  }, [userAccount]);
  useEffect(() => {
    atpBalanceRef.current = atpBalance;
  }, [atpBalance]);

  // Push the live strains into the dish whenever the data or the mode changes
  useEffect(() => {
    if (mode === "live" && engineRef.current) {
      engineRef.current.setLiveStrains(
        liveStrains.map((s) => ({
          id: s.strain_id,
          owner: s.owner_id,
          vitality: s.vitality,
          status: s.status,
        })),
        userAccount,
      );
    }
  }, [liveStrains, mode, userAccount]);

  // 2. Subscribe to the optimistic state
  useEffect(() => {
    const unsub = optimisticManagerRef.current.subscribe((nextState) => {
      setOptimistic(nextState);
      if (engineRef.current && mode === "demo") {
        engineRef.current.setPlayerVitality(nextState.currentVitality / 10000);
      }
    });
    return unsub;
  }, [mode]);

  // 3. Poller on-chain telemetry
  useEffect(() => {
    const poller = new TelemetryPoller({
      onMacroUpdate: (macro) => {
        setIsBackendConnected(true);
        if (mode === "live") {
          setCrucibleTempMk(macro.crucibleTemp);
          const computedZone = classifyZone(macro.crucibleTemp);
          setZone(computedZone);
          if (engineRef.current) {
            engineRef.current.setZone(computedZone);
          }
        }
      },
      onStrainsUpdate: (strains) => {
        setIsBackendConnected(true);
        setLiveStrains(strains);
      },
      onNewEvents: (_events) => {
        setIsBackendConnected(true);
      },
      onIndexerIncomplete: (incomplete) => {
        setIndexerIncomplete(incomplete);
      },
      onBreachLogItem: (item) => {
        setLogs((prev) => [item, ...prev.slice(0, 15)]);
      },
      onBurstStateChange: (burstState) => {
        setBurst(burstState);
        if (engineRef.current) {
          if (burstState.triggeringStrainId) {
            engineRef.current.triggerNutrientBurstOnStrain(burstState.triggeringStrainId);
          } else {
            engineRef.current.triggerNutrientBurst();
          }
        }
      },
      onStrainFed: (strainId) => {
        if (engineRef.current) {
          engineRef.current.triggerCellFed(strainId);
        }
      },
      onStrainLiquidated: (strainId) => {
        if (engineRef.current) {
          engineRef.current.triggerNutrientBurstOnStrain(strainId);
        }
      },
    });

    poller.start();
    return () => poller.stop();
  }, [mode, userAccount]);

  // The mode-change handler
  const handleModeChange = (nextMode: GameMode) => {
    setMode(nextMode);
    if (engineRef.current) {
      engineRef.current.setMode(nextMode);
    }
    // Live mode: the breach log must only ever contain API-sourced events,
    // so the demo seed entries are dropped on entry (and restored on exit).
    if (nextMode === "live") {
      setLogs([]);
      setSelectedStrain(null);
    } else {
      setLogs(demoSeedLogs);
    }
  };

  const handleUserAccountChange = (account: string) => {
    setUserAccount(account);
    if (engineRef.current) {
      engineRef.current.highlightAccount(account);
    }
  };

  const handleFeedClick = () => {
    if (mode === "live") return; // Real transactions are out of scope

    // Apply the optimistic action in demo mode
    optimisticManagerRef.current.applyFeed(220);
    setAtpBalance((prev) => Math.max(0, prev - 10));

    // Trigger the glow & a slight temperature rise
    setCrucibleTempMk((prev) => {
      const next = Math.min(680, prev + 2);
      const nextZone = classifyZone(next);
      setZone(nextZone);
      if (engineRef.current) {
        engineRef.current.setZone(nextZone);
      }
      return next;
    });

    // Simulate the confirmation after 1.2 s
    setTimeout(() => {
      optimisticManagerRef.current.confirm();
    }, 1200);
  };

  const handleTriggerBurst = () => {
    if (engineRef.current) {
      engineRef.current.triggerNutrientBurst();
    }
    setBurst((prev) => ({
      ...prev,
      isActive: true,
      activeBurstBps: Math.min(3000, prev.activeBurstBps + 500),
      untilEpoch: prev.untilEpoch + 1,
    }));
    setLogs((prev) => [
      {
        id: `sim-burst-${Date.now()}`,
        kind: "nutrient_burst_released",
        actor: "strain #3 (simulated)",
        summary: "cell lysis triggers a nutrient burst wave into the dish",
        crucibleTemp: crucibleTempMk,
        timestampMs: Date.now(),
        renderedAtMs: Date.now(),
        latencyMs: 12,
        meetsSla: true,
      },
      ...prev.slice(0, 15),
    ]);
  };

  const handleShiftZone = (newZone: MacroZone) => {
    const tempTarget = newZone === "Hypothermia" ? 575 : newZone === "Fever" ? 632 : 605;
    setCrucibleTempMk(tempTarget);
    setZone(newZone);
    if (engineRef.current) {
      engineRef.current.setZone(newZone);
    }
    setLogs((prev) => [
      {
        id: `sim-zone-${Date.now()}`,
        kind: "zone_changed",
        actor: "operator demo",
        summary: `manual temperature dial change to ${newZone.toLowerCase()} (${tempTarget} mK)`,
        crucibleTemp: tempTarget,
        timestampMs: Date.now(),
        renderedAtMs: Date.now(),
        latencyMs: 10,
        meetsSla: true,
      },
      ...prev.slice(0, 15),
    ]);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Full-screen game canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full cursor-crosshair touch-none"
        role="img"
        aria-label="snacc petri dish arena with living cells"
      />

      {/* The open DOM HUD layer */}
      <HudOverlay
        mode={mode}
        onModeChange={handleModeChange}
        isBackendConnected={isBackendConnected}
        skin={skin}
        onSkinChange={setSkin}
        zone={zone}
        crucibleTempMk={crucibleTempMk}
        atpBalance={atpBalance}
        burst={burst}
        optimistic={optimistic}
        logs={filterLogsForMode(logs, mode)}
        indexerIncomplete={indexerIncomplete}
        userAccount={userAccount}
        onUserAccountChange={handleUserAccountChange}
        matchedStrainsCount={matchedStrainsCount}
        selectedStrain={selectedStrain}
        isLoadingStrain={isLoadingStrain}
        onCloseStrainModal={() => setSelectedStrain(null)}
        onFeedClick={handleFeedClick}
        onTriggerBurst={handleTriggerBurst}
        onShiftZone={handleShiftZone}
      />
    </main>
  );
};
