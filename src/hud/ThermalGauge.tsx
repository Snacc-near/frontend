import React from "react";
import {
  HYPOTHERMIA_THRESHOLD_MK,
  FEVER_THRESHOLD_MK,
  classifyZone,
  ZONE_THEMES,
} from "../config/zones.ts";
import type { SkinMode } from "../config/constants.ts";
import { useT } from "../i18n/react.tsx";
import { useSkinLabels } from "../i18n/skin.ts";

interface ThermalGaugeProps {
  crucibleTempMk: number | null;
  skin: SkinMode;
}

export const ThermalGauge: React.FC<ThermalGaugeProps> = ({ crucibleTempMk, skin }) => {
  const temp = crucibleTempMk ?? 0;
  const zone = classifyZone(temp);
  const theme = ZONE_THEMES[zone];
  const { t } = useT();
  const labels = useSkinLabels(skin);

  const minTemp = 0;
  const maxTemp = FEVER_THRESHOLD_MK * 2;
  const ratio = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

  const hypoPct = ((HYPOTHERMIA_THRESHOLD_MK - minTemp) / (maxTemp - minTemp)) * 100;
  const feverPct = ((FEVER_THRESHOLD_MK - minTemp) / (maxTemp - minTemp)) * 100;

  return (
    <div
      className="plate-panel flex min-w-[210px] flex-col gap-1 px-4 py-2.5 select-none"
      role="region"
      aria-label={t("hud.thermal.region", { zone: labels.zone, temp: crucibleTempMk === null ? "—" : crucibleTempMk })}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="lowercase text-[var(--ink)]">{labels.zone}</span>
        <span className="font-mono font-bold text-[var(--ink-hi)]">
          {crucibleTempMk === null ? "—" : crucibleTempMk} <span className="font-normal text-[var(--ink)]">{t("hud.thermal.unit")}</span>
        </span>
      </div>

      <div className="relative my-1 h-3 w-full overflow-hidden rounded-full border border-[var(--line)] bg-[var(--body)]">
        <div
          className="absolute top-0 bottom-0 left-0 bg-[var(--frost)]/25"
          style={{ width: `${hypoPct}%` }}
          title={t("hud.thermal.hypothermia", { mk: HYPOTHERMIA_THRESHOLD_MK })}
        />
        <div
          className="absolute top-0 bottom-0 bg-[var(--accent)]/30"
          style={{ left: `${hypoPct}%`, width: `${feverPct - hypoPct}%` }}
          title={t("hud.thermal.goldilocks", { lo: HYPOTHERMIA_THRESHOLD_MK, hi: FEVER_THRESHOLD_MK })}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-[var(--warm)]/25"
          style={{ left: `${feverPct}%` }}
          title={t("hud.thermal.fever", { mk: FEVER_THRESHOLD_MK })}
        />
        <div
          className="absolute top-0 bottom-0 -ml-1 w-2 rounded-full border border-[var(--ink-hi)] bg-white transition-all duration-500"
          style={{ left: `${ratio * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-[var(--ink-hi)]">
          <span className="h-2 w-2 rounded-full border border-[var(--ink-hi)]" style={{ backgroundColor: theme.color }} />
          <span className="font-semibold lowercase">{theme.label}</span>
        </span>
        <span className="font-mono text-[10px] text-[var(--ink)]">
          {t("hud.thermal.thresholds")}
        </span>
      </div>
    </div>
  );
};
