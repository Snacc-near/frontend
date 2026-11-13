/**
 * Mount point for the intro, Help and Settings windows (UI-151). It is the only piece the game entry
 * loads up front; the windows themselves load on first use. It opens the intro once per browser
 * (a localStorage flag) and again on "replay intro", and keeps the chosen skin saved.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import { hasSeenOnboarding, markOnboardingSeen, saveSkinPref } from "../prefs/prefs.ts";

const OnboardingModal = lazy(() => import("./OnboardingModal.tsx"));
const HelpModal = lazy(() => import("./HelpModal.tsx"));
const SettingsModal = lazy(() => import("./SettingsModal.tsx"));

export type GuideTool = "help" | "settings";

export interface GuideLayerProps {
  /** The tool the toolbar asked for; only `help` and `settings` are handled here. */
  tool: string | null;
  onCloseTool: () => void;
  skin: SkinMode;
  onSkin: (skin: SkinMode) => void;
}

export function GuideLayer({ tool, onCloseTool, skin, onSkin }: GuideLayerProps) {
  const [intro, setIntro] = useState(false);

  // First run: show the intro once. Checked after mount so the first paint is never blocked.
  useEffect(() => {
    if (!hasSeenOnboarding()) setIntro(true);
  }, []);

  // The skin is a setting too, so keep it for the next visit whichever control changed it.
  useEffect(() => {
    saveSkinPref(skin);
  }, [skin]);

  const finishIntro = useCallback(() => {
    markOnboardingSeen();
    setIntro(false);
  }, []);

  const replay = useCallback(() => {
    onCloseTool();
    setIntro(true);
  }, [onCloseTool]);

  return (
    <Suspense fallback={null}>
      {intro ? <OnboardingModal onDone={finishIntro} /> : null}
      {tool === "help" ? <HelpModal onClose={onCloseTool} onReplay={replay} /> : null}
      {tool === "settings" ? <SettingsModal onClose={onCloseTool} skin={skin} onSkin={onSkin} /> : null}
    </Suspense>
  );
}
