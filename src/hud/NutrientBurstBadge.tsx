import React from "react";
import type { NutrientBurstState } from "../data/types.ts";
import type { SkinMode } from "../config/constants.ts";
import { useT } from "../i18n/react.tsx";
import { useSkinLabels } from "../i18n/skin.ts";

interface NutrientBurstBadgeProps {
  burst: NutrientBurstState;
  skin: SkinMode;
}

export const NutrientBurstBadge: React.FC<NutrientBurstBadgeProps> = ({ burst, skin }) => {
  const { t } = useT();
  const labels = useSkinLabels(skin);
  const isActive = burst.isActive;

  return (
    <div
      className={`flex items-center gap-2.5 px-3.5 py-2 rounded-full border backdrop-blur-md transition-all select-none ${
        isActive
          ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-200 shadow-md shadow-emerald-500/15"
          : "bg-slate-950/80 border-slate-800 text-slate-300"
      }`}
      role="status"
      aria-label={
        isActive
          ? t("hud.burst.ariaActive", { label: labels.burst, pct: (burst.activeBurstBps / 100).toFixed(0) })
          : t("hud.burst.ariaStandby", { label: labels.burst })
      }
    >
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          isActive
            ? "bg-emerald-400 motion-safe:animate-pulse shadow-[0_0_8px_#34d399]"
            : "bg-slate-600"
        }`}
      />
      <div className="flex items-baseline gap-2 text-xs">
        <span className="font-semibold lowercase">{labels.burst}</span>
        {isActive ? (
          <>
            <span className="font-mono font-bold text-emerald-300">
              -{(burst.activeBurstBps / 100).toFixed(2)}%
            </span>
            <span className="text-[10px] text-emerald-300 font-mono">
              {t("hud.burst.until", { epoch: burst.untilEpoch })}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-slate-400 lowercase">{t("hud.burst.standby")}</span>
        )}
      </div>
    </div>
  );
};
