import React, { useEffect, useRef, useState } from "react";
import type { MacroZone } from "./config/zones.ts";
import { classifyZone } from "./config/zones.ts";
import type { SkinMode } from "./config/constants.ts";
import { INITIAL_ATP, BURST_BASE_BPS } from "./config/constants.ts";
import type { BreachLogItem, NutrientBurstState } from "./data/types.ts";
import { OptimisticManager, type OptimisticVitalityState } from "./data/optimistic.ts";
import { TelemetryPoller } from "./data/poller.ts";
import { GameEngine, type GameMode } from "./game/engine.ts";
import { HudOverlay } from "./hud/HudOverlay.tsx";

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
  const [burst, setBurst] = useState<NutrientBurstState>({
    isActive: true,
    activeBurstBps: BURST_BASE_BPS,
    untilEpoch: 2,
    releasedVita: "7200",
    triggeringStrainId: 3,
  });
  const [optimistic, setOptimistic] = useState<OptimisticVitalityState>(
    optimisticManagerRef.current.getState(),
  );
  const [logs, setLogs] = useState<BreachLogItem[]>([
    {
      id: "init-1",
      kind: "nutrient_burst_released",
      actor: "strain #3",
      summary: "lisis sel melepas 7200 nutrisi · diskon -20,00% sampai epoch 2",
      crucibleTemp: 591,
      tempDeltaMk: 0,
      timestampMs: Date.now() - 2400,
      renderedAtMs: Date.now() - 2380,
      latencyMs: 20,
      meetsSla: true,
    },
    {
      id: "init-2",
      kind: "zone_changed",
      actor: "alkemis.testnet",
      summary: "alkemis.testnet memicu pergeseran zona dari hipotermia ke goldilocks (605 mK)",
      crucibleTemp: 605,
      tempDeltaMk: 14,
      timestampMs: Date.now() - 1100,
      renderedAtMs: Date.now() - 1085,
      latencyMs: 15,
      meetsSla: true,
    },
  ]);

  // 1. Inisialisasi engine canvas
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
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // 2. Langganan state optimis
  useEffect(() => {
    const unsub = optimisticManagerRef.current.subscribe((nextState) => {
      setOptimistic(nextState);
      if (engineRef.current) {
        engineRef.current.setPlayerVitality(nextState.currentVitality / 10000);
      }
    });
    return unsub;
  }, []);

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
      onNewEvents: (_events) => {
        setIsBackendConnected(true);
      },
      onBreachLogItem: (item) => {
        setLogs((prev) => [item, ...prev.slice(0, 15)]);
      },
      onBurstStateChange: (burstState) => {
        setBurst(burstState);
        if (engineRef.current) {
          engineRef.current.triggerNutrientBurst();
        }
      },
    });

    poller.start();
    return () => poller.stop();
  }, [mode]);

  // Handler aksi pemain
  const handleModeChange = (nextMode: GameMode) => {
    setMode(nextMode);
    if (engineRef.current) {
      engineRef.current.setMode(nextMode);
    }
  };

  const handleFeedClick = () => {
    // Terapkan aksi optimis
    optimisticManagerRef.current.applyFeed(220);
    setAtpBalance((prev) => Math.max(0, prev - 10));

    // Pemicu pendaran & kenaikan suhu sedikit
    setCrucibleTempMk((prev) => {
      const next = Math.min(680, prev + 2);
      const nextZone = classifyZone(next);
      setZone(nextZone);
      if (engineRef.current) {
        engineRef.current.setZone(nextZone);
      }
      return next;
    });

    // Simulasi konfirmasi setelah 1.2 detik (di mode demo)
    if (mode === "demo") {
      setTimeout(() => {
        optimisticManagerRef.current.confirm();
      }, 1200);
    }
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
        actor: "strain #3 (simulasi)",
        summary: "lisis sel memicu gelombang semburan nutrisi ke cawan",
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
        summary: `perubahan ambang suhu buatan ke ${newZone.toLowerCase()} (${tempTarget} mK)`,
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
      {/* Kanvas Game Penuh Layar */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full cursor-crosshair touch-none"
        role="img"
        aria-label="arena cawan petri berisi sel hidup snacc"
      />

      {/* Lapisan HUD DOM Terbuka */}
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
        logs={logs}
        onFeedClick={handleFeedClick}
        onTriggerBurst={handleTriggerBurst}
        onShiftZone={handleShiftZone}
      />
    </main>
  );
};
