import React from "react";
import type { MacroZone } from "../config/zones.ts";
import { ZONE_DESCRIPTION_KEYS, ZONE_THEMES } from "../config/zones.ts";
import type { SkinMode } from "../config/constants.ts";
import { useT } from "../i18n/react.tsx";
import { useSkinLabels } from "../i18n/skin.ts";

interface ZoneBannerProps {
  zone: MacroZone;
  skin: SkinMode;
}

export const ZoneBanner: React.FC<ZoneBannerProps> = ({ zone, skin }) => {
  const theme = ZONE_THEMES[zone];
  const labels = useSkinLabels(skin);
  const { t } = useT();

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 rounded-full bg-slate-950/85 border border-slate-700/50 backdrop-blur-md shadow-lg select-none"
      role="status"
      aria-live="polite"
    >
      <span
        className="w-2.5 h-2.5 rounded-full motion-safe:animate-pulse"
        style={{ backgroundColor: theme.color, boxShadow: `0 0 8px ${theme.color}` }}
      />
      <div className="flex flex-col">
        <span className="text-xs font-bold lowercase" style={{ color: theme.color }}>
          {labels[zone.toLowerCase()] ?? theme.label}
        </span>
        <span className="text-[10px] text-slate-300 lowercase">
          {t(ZONE_DESCRIPTION_KEYS[zone])}
        </span>
      </div>
    </div>
  );
};
