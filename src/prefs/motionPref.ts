/**
 * Reduce-motion for the game (UI-151): the OS setting is the default and the user can override it in
 * Settings. The choice is mirrored on `<html data-motion>` so the CSS can follow it (see the
 * `data-motion` rules in `index.css`), and announced through a window event so code that reads
 * `prefersReducedMotion()` re-renders.
 */
import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "../motion.ts";
import { readMotionPref, saveMotionPref, type MotionPref } from "./prefs.ts";

export const MOTION_EVENT = "snacc:motion";

/** Sets or clears `data-motion` on the root element: `reduce` and `full` are overrides, `system` removes it. */
export function applyMotionAttribute(pref: MotionPref = readMotionPref(), root: HTMLElement | undefined = globalThis.document?.documentElement): void {
  if (!root) return;
  if (pref === "system") delete root.dataset.motion;
  else root.dataset.motion = pref;
}

/** Saves the override, updates the root attribute and tells subscribers. */
export function setMotionPref(pref: MotionPref): void {
  saveMotionPref(pref);
  applyMotionAttribute(pref);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MOTION_EVENT));
}

/** Subscribes to the override changing and to the OS preference changing. */
export function subscribeMotion(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const query = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  query?.addEventListener("change", onChange);
  window.addEventListener(MOTION_EVENT, onChange);
  return () => {
    query?.removeEventListener("change", onChange);
    window.removeEventListener(MOTION_EVENT, onChange);
  };
}

/** True when motion should be reduced, by the override first and the OS second. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false);
}
