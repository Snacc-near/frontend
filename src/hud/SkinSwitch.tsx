import React from "react";
import type { SkinMode } from "../config/constants.ts";
import { useT } from "../i18n/react.tsx";
import { Icon } from "../ui/fd.tsx";

interface SkinSwitchProps {
  skin: SkinMode;
  onChange: (skin: SkinMode) => void;
}

/** ADR-31 terminology switch: the same mechanics named as a bio-lab or as a fintech desk. */
export const SkinSwitch: React.FC<SkinSwitchProps> = ({ skin, onChange }) => {
  const { t } = useT();
  return (
    <div className="fd-tabs fd-dither skin-switch" role="group" aria-label={t("hud.skinSwitch.group")}>
      <button type="button" onClick={() => onChange("biolab")} aria-pressed={skin === "biolab"} className="fd-tab skin-switch__opt">
        <Icon name="cell" />
        <span>{t("hud.skinSwitch.biolab")}</span>
      </button>
      <button type="button" onClick={() => onChange("fintech")} aria-pressed={skin === "fintech"} className="fd-tab skin-switch__opt">
        <Icon name="grid" />
        <span>{t("hud.skinSwitch.fintech")}</span>
      </button>
    </div>
  );
};
