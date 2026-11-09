import React from "react";
import {
  HYPOTHERMIA_THRESHOLD_MK,
  FEVER_THRESHOLD_MK,
  classifyZone,
  ZONE_THEMES,
} from "../config/zones.ts";
import type { SkinMode } from "../config/constants.ts";
import { SKIN_LABELS } from "../config/constants.ts";

interface ThermalGaugeProps {
  crucibleTempMk: number;
  skin: SkinMode;
}

export const ThermalGauge: React.FC<ThermalGaugeProps> = ({ crucibleTempMk, skin }) => {
  const zone = classifyZone(crucibleTempMk);
  const theme = ZONE_THEMES[zone];
  const labels = SKIN_LABELS[skin];

  // Dynamic scale: 0 .. 2x the Fever threshold so live values (e.g. ~1040 mK) stay readable
  // while the 600/610 thresholds keep their proportional positions (official constants below).
  const minTemp = 0;
  const maxTemp = FEVER_THRESHOLD_MK * 2;
  const ratio = Math.max(0, Math.min(1, (crucibleTempMk - minTemp) / (maxTemp - minTemp)));

  const hypoPct = ((HYPOTHERMIA_THRESHOLD_MK - minTemp) / (maxTemp - minTemp)) * 100;
  const feverPct = ((FEVER_THRESHOLD_MK - minTemp) / (maxTemp - minTemp)) * 100;

  return (
    <div
      className="flex flex-col gap-1 px-4 py-2.5 rounded-2xl bg-slate-950/85 border border-slate-700/50 backdrop-blur-md shadow-lg min-w-[210px] select-none"
      role="region"
      aria-label={`${labels.zone} ${crucibleTempMk} milikelvin`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 lowercase">{labels.zone}</span>
        <span className="font-mono font-bold text-slate-100">
          {crucibleTempMk} <span className="text-slate-300 font-normal">mk</span>
        </span>
      </div>

      {/* Horizontal thermometer scale with the threshold markers (UI-118) */}
      <div className="relative w-full h-3 my-1 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
        {/* Hypothermia zone indicator (<600 mK) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-cyan-500/30"
          style={{ width: `${hypoPct}%` }}
          title={`hypothermia threshold: < ${HYPOTHERMIA_THRESHOLD_MK} mk`}
        />

        {/* Goldilocks zone indicator (600..610 mK) */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-500/35"
          style={{ left: `${hypoPct}%`, width: `${feverPct - hypoPct}%` }}
          title={`goldilocks range: ${HYPOTHERMIA_THRESHOLD_MK}..${FEVER_THRESHOLD_MK} mk`}
        />

        {/* Fever zone indicator (>610 mK) */}
        <div
          className="absolute top-0 bottom-0 right-0 bg-orange-500/35"
          style={{ left: `${feverPct}%` }}
          title={`fever threshold: > ${FEVER_THRESHOLD_MK} mk`}
        />

        {/* The current temperature needle */}
        <div
          className="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_8px_#fff] rounded-full transition-all duration-500 -ml-1"
          style={{ left: `${ratio * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5" style={{ color: theme.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.color }} />
          <span className="font-semibold lowercase">{theme.label}</span>
        </span>
        <span className="text-slate-400 font-mono text-[10px]">
          ambang 600 / 610
        </span>
      </div>
    </div>
  );
};
