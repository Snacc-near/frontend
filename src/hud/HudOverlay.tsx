import React from "react";
import type { MacroZone } from "../config/zones.ts";
import type { SkinMode } from "../config/constants.ts";
import type { BreachLogItem, NutrientBurstState, StrainDetail } from "../data/types.ts";
import type { OptimisticVitalityState } from "../data/optimistic.ts";
import type { GameMode } from "../game/engine.ts";
import { VitalsPill } from "./VitalsPill.tsx";
import { AtpPill } from "./AtpPill.tsx";
import { ThermalGauge } from "./ThermalGauge.tsx";
import { ZoneBanner } from "./ZoneBanner.tsx";
import { NutrientBurstBadge } from "./NutrientBurstBadge.tsx";
import { BreachLog } from "./BreachLog.tsx";
import { SkinSwitch } from "./SkinSwitch.tsx";
import { ModeSwitch } from "./ModeSwitch.tsx";
import { AccountFilter } from "./AccountFilter.tsx";
import { StrainDetailModal } from "./StrainDetailModal.tsx";

interface HudOverlayProps {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  isBackendConnected: boolean;
  skin: SkinMode;
  onSkinChange: (skin: SkinMode) => void;
  zone: MacroZone;
  crucibleTempMk: number;
  atpBalance: number;
  burst: NutrientBurstState;
  optimistic: OptimisticVitalityState;
  logs: BreachLogItem[];
  userAccount: string;
  onUserAccountChange: (account: string) => void;
  matchedStrainsCount: number;
  selectedStrain: StrainDetail | null;
  isLoadingStrain: boolean;
  onCloseStrainModal: () => void;
  onFeedClick: () => void;
  onTriggerBurst?: () => void;
  onShiftZone?: (zone: MacroZone) => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  mode,
  onModeChange,
  isBackendConnected,
  skin,
  onSkinChange,
  zone,
  crucibleTempMk,
  atpBalance,
  burst,
  optimistic,
  logs,
  userAccount,
  onUserAccountChange,
  matchedStrainsCount,
  selectedStrain,
  isLoadingStrain,
  onCloseStrainModal,
  onFeedClick,
  onTriggerBurst,
  onShiftZone,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none p-4 sm:p-6 flex flex-col justify-between z-10 select-none">
      {/* Bilah Atas: Brand, Mode Switch, Filter Akun, Burst Badge, Vitals, ATP */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2.5 pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-100 tracking-wider">
              $SNACC
            </span>
            <span className="text-slate-500 text-xs">·</span>
            <span className="text-xs text-slate-300 font-medium lowercase">
              living cell crucible
            </span>
          </div>
          <ModeSwitch
            mode={mode}
            onChange={onModeChange}
            isBackendConnected={isBackendConnected}
          />
          <AccountFilter
            account={userAccount}
            onChange={onUserAccountChange}
            matchedCount={matchedStrainsCount}
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pointer-events-auto">
          <NutrientBurstBadge burst={burst} skin={skin} />
          <ZoneBanner zone={zone} skin={skin} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pointer-events-auto">
          <SkinSwitch skin={skin} onChange={onSkinChange} />
          <AtpPill atpBalance={atpBalance} skin={skin} />
          <VitalsPill
            optimistic={optimistic}
            skin={skin}
            mode={mode}
            onFeedClick={onFeedClick}
          />
        </div>
      </header>

      {/* Kontrol Cepat Uji Simulasi (Khusus Mode Demo untuk Demo Juri) */}
      {mode === "demo" && (
        <div className="flex items-center justify-center gap-2 pointer-events-auto my-auto opacity-75 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-slate-950/70 border border-slate-800 text-[11px] backdrop-blur-md">
            <span className="text-slate-400 px-2 lowercase">simulasi cawan:</span>
            <button
              type="button"
              onClick={() => onShiftZone?.("Hypothermia")}
              className="px-2.5 py-1 rounded-full text-cyan-400 hover:bg-cyan-950/50 cursor-pointer lowercase"
            >
              hipotermia (575)
            </button>
            <button
              type="button"
              onClick={() => onShiftZone?.("Goldilocks")}
              className="px-2.5 py-1 rounded-full text-emerald-400 hover:bg-emerald-950/50 cursor-pointer lowercase"
            >
              goldilocks (605)
            </button>
            <button
              type="button"
              onClick={() => onShiftZone?.("Fever")}
              className="px-2.5 py-1 rounded-full text-orange-400 hover:bg-orange-950/50 cursor-pointer lowercase"
            >
              demam (632)
            </button>
            <button
              type="button"
              onClick={onTriggerBurst}
              className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold cursor-pointer lowercase"
            >
              lisis / burst!
            </button>
          </div>
        </div>
      )}

      {/* Bilah Bawah: Log Ambang & Alat Ukur Suhu */}
      <footer className="flex flex-wrap items-end justify-between gap-4 mt-auto">
        <div className="pointer-events-auto">
          <BreachLog logs={logs} />
        </div>

        <div className="pointer-events-auto">
          <ThermalGauge crucibleTempMk={crucibleTempMk} skin={skin} />
        </div>
      </footer>

      {/* Modal Rincian Strain Saat Sel Diklik */}
      <div className="pointer-events-auto">
        <StrainDetailModal
          strain={selectedStrain}
          isLoading={isLoadingStrain}
          skin={skin}
          mode={mode}
          onClose={onCloseStrainModal}
          onFeedClick={onFeedClick}
        />
      </div>
    </div>
  );
};
