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
  indexerIncomplete: boolean;
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
  indexerIncomplete,
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
    <div className="absolute inset-0 pointer-events-none p-3 sm:p-6 flex flex-col justify-between z-10 select-none overflow-hidden">
      {/* Top bar: brand, mode switch, account filter, burst badge, vitals, ATP */}
      <header className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-col gap-2 pointer-events-auto">
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

        <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
          <NutrientBurstBadge burst={burst} skin={skin} />
          <ZoneBanner zone={zone} skin={skin} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pointer-events-auto">
          <SkinSwitch skin={skin} onChange={onSkinChange} />
          <AtpPill
            atpBalance={atpBalance}
            isLive={mode === "live"}
            liveAtp={mode === "live" ? selectedStrain?.atp_balance ?? null : null}
            skin={skin}
          />
          <VitalsPill
            optimistic={optimistic}
            liveVitality={selectedStrain?.vitality ?? null}
            liveStatus={selectedStrain?.status ?? null}
            skin={skin}
            mode={mode}
            onFeedClick={onFeedClick}
          />
        </div>
      </header>

      {/* Quick simulation-test controls (demo mode only, for judge demos) */}
      {mode === "demo" && (
        <div className="flex items-center justify-center gap-2 pointer-events-auto my-auto opacity-80 hover:opacity-100 transition-opacity flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-slate-950/75 border border-slate-800 text-[11px] backdrop-blur-md flex-wrap justify-center">
            <span className="text-slate-400 px-2 lowercase">dish simulation:</span>
            <button
              type="button"
              onClick={() => onShiftZone?.("Hypothermia")}
              className="px-3 py-1.5 rounded-full text-cyan-300 hover:bg-cyan-950/60 cursor-pointer lowercase focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none min-h-[36px]"
            >
              hypothermia (575)
            </button>
            <button
              type="button"
              onClick={() => onShiftZone?.("Goldilocks")}
              className="px-3 py-1.5 rounded-full text-emerald-300 hover:bg-emerald-950/60 cursor-pointer lowercase focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none min-h-[36px]"
            >
              goldilocks (605)
            </button>
            <button
              type="button"
              onClick={() => onShiftZone?.("Fever")}
              className="px-3 py-1.5 rounded-full text-orange-300 hover:bg-orange-950/60 cursor-pointer lowercase focus-visible:ring-2 focus-visible:ring-orange-400 focus:outline-none min-h-[36px]"
            >
              fever (632)
            </button>
            <button
              type="button"
              onClick={onTriggerBurst}
              className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold cursor-pointer lowercase focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none min-h-[36px]"
            >
              lysis / burst!
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar: the threshold log & the temperature gauge */}
      <footer className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 mt-auto">
        <div className="pointer-events-auto">
          <BreachLog logs={logs} indexerIncomplete={indexerIncomplete} />
        </div>

        <div className="pointer-events-auto">
          <ThermalGauge crucibleTempMk={crucibleTempMk} skin={skin} />
        </div>
      </footer>

      {/* The strain detail modal when a cell is clicked */}
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
