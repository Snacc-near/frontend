/**
 * Applies the saved preferences to the running game: the reduce-motion attribute on `<html>`, and
 * the sound switch and volume on the sound engine. Called once when the game route loads
 * (`app-entry.tsx`), and again by Settings after each change through the small helpers below.
 */
import { bioSound } from "../sound.ts";
import { applyMotionAttribute } from "./motionPref.ts";
import { readSoundPrefs, saveSoundPrefs, type SoundPrefs } from "./prefs.ts";

export function applySoundPrefs(prefs: SoundPrefs = readSoundPrefs()): void {
  bioSound.muted = !prefs.on;
  bioSound.setVolume(prefs.volume);
}

/** Saves and applies a sound change from Settings; returns what was stored. */
export function setSoundPrefs(next: SoundPrefs): SoundPrefs {
  const saved = saveSoundPrefs(next);
  applySoundPrefs(saved);
  return saved;
}

export function applyStoredPrefs(): void {
  applyMotionAttribute();
  applySoundPrefs();
}
