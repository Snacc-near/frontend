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

  // Hitung rasio gauge antara rentang 550 mK s.d. 660 mK
  const minTemp = 550;
  const maxTemp = 660;
  const ratio = Math.max(0, Math.min(1, (crucibleTempMk - minTemp) / (maxTemp - minTemp)));

  const hypoPct = ((HYPOTHERMIA_THRESHOLD_MK - minTemp) / (maxTemp - minTemp)) * 100;
  const feverPct = ((FEVER_THRESHOLD_MK - minTemp) / (maxTemp - minTemp)) * 100;

  return (
    <div
      className="flex flex-col gap-1 px-4 py-2.5 rounded-2xl bg-slate-950/85 border border-slate-700/50 backdrop-blur-md shadow-lg min-w-[210px]"
      role="region"
      aria-label={`${labels.zone} ${crucibleTempMk} milikelvin`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 lowercase">{labels.zone}</span>
        <span className="font-mono font-bold text-slate-100">
          {crucibleTempMk} <span className="text-slate-400 font-normal">mk</span>
        </span>
      </div>

      {/* Skala termometer horizontal dengan penanda batas ambang */}
      <div className="relative w-full h-2.5 my-1 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
        {/* Indikator zona Hypothermia (<600 mK) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-cyan-500/25"
          style={{ width: `${hypoPct}%` }}
          title={`batas hipotermia: < ${HYPOTHERMIA_THRESHOLD_MK} mk`}
        />

        {/* Indikator zona Goldilocks (600..610 mK) */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-500/30"
          style={{ left: `${hypoPct}%`, width: `${feverPct - hypoPct}%` }}
          title={`rentang goldilocks: ${HYPOTHERMIA_THRESHOLD_MK}..${FEVER_THRESHOLD_MK} mk`}
        />

        {/* Indikator zona Fever (>610 mK) */}
        <div
          className="absolute top-0 bottom-0 right-0 bg-orange-500/30"
          style={{ left: `${feverPct}%` }}
          title={`batas demam: > ${FEVER_THRESHOLD_MK} mk`}
        />

        {/* Jarum penunjuk suhu saat ini */}
        <div
          className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_6px_#fff] rounded-full transition-all duration-500 -ml-0.5"
          style={{ left: `${ratio * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1.5" style={{ color: theme.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.color }} />
          <span className="font-semibold lowercase">{theme.label}</span>
        </span>
        <span className="text-slate-500 font-mono">
          ambang 600 / 610
        </span>
      </div>
    </div>
  );
};
