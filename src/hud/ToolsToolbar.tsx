/**
 * One toolbar for the game's tools: telemetry toggle plus the tool windows (the seven game tools, the market,
 * quests, profile, help and settings). Below 1240 px (1460 px when the profile key is shown too) the tool keys
 * fold into a "tools" key that opens a sheet.
 */
import { useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import { tEn, type Translate } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";
import { Modal } from "../ui/Modal.tsx";
import { KeycapButton } from "../ui/controls.tsx";
import type { IconName } from "../ui/fd.tsx";

export type ToolId = "collection" | "market" | "npc" | "swap" | "social" | "thesis" | "recipes" | "guest" | "quests" | "profile" | "notifications" | "help" | "settings";

export interface ToolDef {
  id: ToolId;
  /** English label; the toolbar shows `toolLabel(t, ...)` in the reader's language. */
  label: (skin: SkinMode, guestLabel: string | null) => string;
  icon: IconName;
}

/** A tool's label in the language of `tr`. The guest tool shows the label the player chose, when set. */
export function toolLabel(tr: Translate, id: ToolId, skin: SkinMode, guestLabel: string | null): string {
  switch (id) {
    case "npc":
      return tr(`hud.tools.npc.${skin}`);
    case "social":
      return tr(`hud.tools.social.${skin}`);
    case "guest":
      return guestLabel ? tr("hud.tools.guestNamed", { name: guestLabel }) : tr("hud.tools.guest");
    default:
      return tr(`hud.tools.${id}`);
  }
}

const en = (id: ToolId): ToolDef["label"] => (skin, guest) => toolLabel(tEn, id, skin, guest);

export const TOOLS: readonly ToolDef[] = [
  { id: "collection", label: en("collection"), icon: "cell" },
  // UI-164: the testnet demo marketplace.
  { id: "market", label: en("market"), icon: "grid" },
  { id: "npc", label: en("npc"), icon: "scale" },
  { id: "swap", label: en("swap"), icon: "swap" },
  { id: "social", label: en("social"), icon: "podium" },
  { id: "thesis", label: en("thesis"), icon: "doc" },
  { id: "recipes", label: en("recipes"), icon: "search" },
  { id: "guest", label: en("guest"), icon: "user" },
  // UI-153 and UI-148: hidden (see `hidden`) when the profile features are off.
  { id: "quests", label: en("quests"), icon: "check" },
  { id: "profile", label: en("profile"), icon: "user" },
  { id: "help", label: en("help"), icon: "spark" },
  { id: "settings", label: en("settings"), icon: "gauge" },
];

/** With every tool shown (the profile key included) the strip is wider, so it folds at a wider screen (see `fd.css`). */
export const FULL_TOOL_COUNT = TOOLS.length;

export interface ToolsToolbarProps {
  skin: SkinMode;
  panelsOpen: boolean;
  onTogglePanels: () => void;
  onOpen: (id: ToolId) => void;
  guestLabel: string | null;
  /** Tools to leave out, e.g. `profile` and `quests` when the profile features are off. */
  hidden?: readonly ToolId[];
}

export function ToolsToolbar({ skin, panelsOpen, onTogglePanels, onOpen, guestLabel, hidden = [] }: ToolsToolbarProps) {
  const { t } = useT();
  const [sheet, setSheet] = useState(false);
  const tools = TOOLS.filter((tool) => !hidden.includes(tool.id));
  return (
    <>
      <div
        className={`fd-toolbar fd-dither tools-bar pointer-events-auto${tools.length >= FULL_TOOL_COUNT ? " tools-bar--full" : ""}`}
        role="group"
        aria-label={t("hud.tools.group")}
        data-testid="tools-bar"
      >
        <KeycapButton mono icon="lines" aria-expanded={panelsOpen} onClick={onTogglePanels}>
          {t("hud.tools.telemetry")}
        </KeycapButton>
        {tools.map((tool) => (
          <KeycapButton key={tool.id} mono icon={tool.icon} className="tools-bar__tool" aria-haspopup="dialog" onClick={() => onOpen(tool.id)}>
            <span className="tools-bar__label">{toolLabel(t, tool.id, skin, guestLabel)}</span>
          </KeycapButton>
        ))}
        <KeycapButton mono icon="more" className="tools-bar__more" aria-haspopup="dialog" aria-expanded={sheet} onClick={() => setSheet(true)}>
          {t("hud.tools.more")}
        </KeycapButton>
      </div>
      {sheet ? (
        <Modal title="tools.menu" heading={t("hud.tools.heading")} onClose={() => setSheet(false)} testId="tools-sheet">
          <div className="fd-tiles">
            {tools.map((tool) => (
              <KeycapButton
                key={tool.id}
                mono
                icon={tool.icon}
                onClick={() => {
                  setSheet(false);
                  onOpen(tool.id);
                }}
              >
                {toolLabel(t, tool.id, skin, guestLabel)}
              </KeycapButton>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
