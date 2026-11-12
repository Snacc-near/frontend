import React from "react";
import type { SkinMode } from "../config/constants.ts";
import { Icon } from "../ui/fd.tsx";

interface SkinSwitchProps {
  skin: SkinMode;
  onChange: (skin: SkinMode) => void;
}

/** ADR-31 terminology switch: the same mechanics named as a bio-lab or as a fintech desk. */
export const SkinSwitch: React.FC<SkinSwitchProps> = ({ skin, onChange }) => {
  return (
    <div className="fd-tabs skin-switch" role="group" aria-label="the ADR-31 terminology choice">
      <button type="button" onClick={() => onChange("biolab")} aria-pressed={skin === "biolab"} className="fd-tab skin-switch__opt">
        <Icon name="cell" />
        <span>bio-lab</span>
      </button>
      <button type="button" onClick={() => onChange("fintech")} aria-pressed={skin === "fintech"} className="fd-tab skin-switch__opt">
        <Icon name="grid" />
        <span>fintech</span>
      </button>
    </div>
  );
};
