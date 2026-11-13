import React from "react";
import type { SkinMode } from "../config/constants.ts";
import { useT } from "../i18n/react.tsx";
import { useSkinLabels } from "../i18n/skin.ts";
import { formatLiveAtp } from "../data/liveView.ts";

interface AtpPillProps {
  atpBalance: number;
  /** Live ATP balance (a u128 string from the API); "—" when absent. */
  liveAtp: string | null;
  /** Live mode never falls back to the demo ATP counter ("—" until a strain is selected). */
  isLive?: boolean;
  skin: SkinMode;
}

export const AtpPill: React.FC<AtpPillProps> = ({ atpBalance, liveAtp, isLive = false, skin }) => {
  const { t } = useT();
  const labels = useSkinLabels(skin);
  // Demo mode shows the in-game collected ATP; live mode shows only API data.
  const shown = isLive ? formatLiveAtp(liveAtp) : atpBalance.toLocaleString("en-US");

  return (
    <div
      className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-slate-950/85 border border-slate-700/50 backdrop-blur-md shadow-lg select-none"
      role="region"
      aria-label={labels.atp}
    >
      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      <div className="flex flex-col text-xs">
        <span className="text-slate-300 text-[10px] lowercase">{labels.atp}</span>
        <span className="font-mono text-amber-300 font-bold">
          {shown}{" "}
          <span className="text-slate-400 font-normal">{t("hud.atp.unit")}</span>
        </span>
      </div>
    </div>
  );
};
