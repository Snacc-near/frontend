/**
 * One toolbar for the game's tools: telemetry toggle plus the tool windows (the seven game tools, the market,
 * quests, profile, help and settings). Below 1240 px (1460 px when the profile key is shown too) the tool keys
 * fold into a "tools" key that opens a sheet.
 */
import { useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import { Modal } from "../ui/Modal.tsx";
import { KeycapButton } from "../ui/controls.tsx";
import type { IconName } from "../ui/fd.tsx";

export type ToolId = "collection" | "market" | "npc" | "swap" | "social" | "thesis" | "recipes" | "guest" | "quests" | "profile" | "notifications" | "help" | "settings";

export interface ToolDef {
  id: ToolId;
  label: (skin: SkinMode, guestLabel: string | null) => string;
  icon: IconName;
}

export const TOOLS: readonly ToolDef[] = [
  { id: "collection", label: () => "my collection", icon: "cell" },
  // UI-164: the testnet demo marketplace.
  { id: "market", label: () => "market", icon: "grid" },
  { id: "npc", label: (s) => (s === "fintech" ? "market makers" : "npc merchants"), icon: "scale" },
  { id: "swap", label: () => "swap quote", icon: "swap" },
  { id: "social", label: (s) => (s === "fintech" ? "top feeders" : "great feast"), icon: "podium" },
  { id: "thesis", label: () => "thesis", icon: "doc" },
  { id: "recipes", label: () => "recipes", icon: "search" },
  { id: "guest", label: (_s, g) => (g ? `guest: ${g}` : "guest label"), icon: "user" },
  // UI-153 and UI-148: hidden (see `hidden`) when the profile features are off.
  { id: "quests", label: () => "quests", icon: "check" },
  { id: "profile", label: () => "profile", icon: "user" },
  { id: "help", label: () => "help", icon: "spark" },
  { id: "settings", label: () => "settings", icon: "gauge" },
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
  const [sheet, setSheet] = useState(false);
  const tools = TOOLS.filter((t) => !hidden.includes(t.id));
  return (
    <>
      <div
        className={`fd-toolbar fd-dither tools-bar pointer-events-auto${tools.length >= FULL_TOOL_COUNT ? " tools-bar--full" : ""}`}
        role="group"
        aria-label="game tools"
        data-testid="tools-bar"
      >
        <KeycapButton mono icon="lines" aria-expanded={panelsOpen} onClick={onTogglePanels}>
          telemetry
        </KeycapButton>
        {tools.map((t) => (
          <KeycapButton key={t.id} mono icon={t.icon} className="tools-bar__tool" aria-haspopup="dialog" onClick={() => onOpen(t.id)}>
            <span className="tools-bar__label">{t.label(skin, guestLabel)}</span>
          </KeycapButton>
        ))}
        <KeycapButton mono icon="more" className="tools-bar__more" aria-haspopup="dialog" aria-expanded={sheet} onClick={() => setSheet(true)}>
          tools
        </KeycapButton>
      </div>
      {sheet ? (
        <Modal title="tools.menu" heading="Tools" onClose={() => setSheet(false)} testId="tools-sheet">
          <div className="fd-tiles">
            {tools.map((t) => (
              <KeycapButton
                key={t.id}
                mono
                icon={t.icon}
                onClick={() => {
                  setSheet(false);
                  onOpen(t.id);
                }}
              >
                {t.label(skin, guestLabel)}
              </KeycapButton>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
