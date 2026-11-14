/**
 * Local preferences of the game UI (UI-151): the intro seen-flag, sound, the motion override and the
 * skin. Everything lives in this browser's localStorage under the `snacc_` keys listed in
 * `APP_LOCAL_KEYS`; nothing is sent anywhere. The pure functions take the storage as an argument so
 * they can be unit tested without a DOM.
 *
 * "Reset local data" removes exactly `APP_LOCAL_KEYS` and nothing else, so the wallet's own entries
 * (for example the `selected-wallet` key NEAR Connect writes) are never touched.
 */
import type { SkinMode } from "../config/constants.ts";
import { GUEST_LABEL_KEY, LEGACY_SESSION_KEY } from "../auth/guestLabel.ts";
import { BROWSER_ALERTS_KEY, SESSION_STORAGE_KEY } from "../account/config.ts";
import { DEVICE_KEY, TELEMETRY_KEY, track } from "../telemetry.ts";
import type { MessageKey } from "../i18n/catalog.ts";
import { LOCALE_KEY } from "../i18n/locale.ts";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const ONBOARDING_KEY = "snacc_onboarding_seen";
export const SOUND_KEY = "snacc_sound";
export const MOTION_KEY = "snacc_motion";
export const SKIN_KEY = "snacc_skin";
/** RES-111: the one-tap play key, only when this browser cannot keep it in IndexedDB (`chain/oneTapKeys.ts`). */
export const ONE_TAP_LOCAL_KEY = "snacc_one_tap";

/**
 * What each app-owned key holds, in the order the Settings window lists them. `what` is the English
 * text (the privacy page quotes it and it stays English); `label` is the dictionary key the Settings
 * window shows in the current language (`settings.keys.*`, kept in step with `what` by a test).
 */
export const APP_LOCAL_KEY_INFO: readonly { key: string; what: string; label: MessageKey }[] = [
  { key: ONBOARDING_KEY, what: "the intro has been shown", label: "settings.keys.onboarding" },
  { key: SOUND_KEY, what: "sound on or off and the volume", label: "settings.keys.sound" },
  { key: MOTION_KEY, what: "your reduce-motion choice", label: "settings.keys.motion" },
  { key: SKIN_KEY, what: "bio-lab or fintech wording", label: "settings.keys.skin" },
  { key: LOCALE_KEY, what: "your language choice (English or Bahasa Indonesia)", label: "settings.keys.locale" },
  { key: GUEST_LABEL_KEY, what: "your guest label and highlighted account", label: "settings.keys.guest" },
  { key: LEGACY_SESSION_KEY, what: "a leftover key from an earlier build", label: "settings.keys.legacySession" },
  { key: SESSION_STORAGE_KEY, what: "your profile sign-in session, only after you sign in to a profile", label: "settings.keys.profileSession" },
  { key: BROWSER_ALERTS_KEY, what: "browser alerts turned on for notifications", label: "settings.keys.browserAlerts" },
  { key: TELEMETRY_KEY, what: "your choice about sharing anonymous usage stats", label: "settings.keys.telemetry" },
  { key: DEVICE_KEY, what: "a random id for anonymous usage stats (a new one is made after a reset)", label: "settings.keys.deviceId" },
  {
    key: ONE_TAP_LOCAL_KEY,
    what: "the one-tap play key, only if you turned one-tap play on and this browser blocks IndexedDB (clearing it does not remove the key from your account; turn one-tap play off for that)",
    label: "settings.keys.oneTap",
  },
];

export const APP_LOCAL_KEYS: readonly string[] = APP_LOCAL_KEY_INFO.map((k) => k.key);

/** The browser's localStorage, or null when it is missing or blocked. */
export function appStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ intro seen-flag

const ONBOARDING_SEEN = "1";
/** Fallback for a browser without usable storage: the intro then shows once per page load. */
let seenInMemory = false;

export function resetOnboardingMemory(): void {
  seenInMemory = false;
}

export function hasSeenOnboarding(store: StorageLike | null = appStorage()): boolean {
  if (seenInMemory) return true;
  if (!store) return false;
  try {
    return store.getItem(ONBOARDING_KEY) === ONBOARDING_SEEN;
  } catch {
    return false;
  }
}

export function markOnboardingSeen(store: StorageLike | null = appStorage()): void {
  if (!seenInMemory) track("onboarding_done");
  seenInMemory = true;
  if (!store) return;
  try {
    store.setItem(ONBOARDING_KEY, ONBOARDING_SEEN);
  } catch {
    /* storage full or blocked: the in-memory flag still holds for this page load */
  }
}

// ------------------------------------------------------------------ sound

export interface SoundPrefs {
  /** Sound effects enabled. */
  on: boolean;
  /** Master volume, 0..1. */
  volume: number;
}

export const DEFAULT_SOUND: SoundPrefs = { on: true, volume: 1 };

/** Clamps to 0..1 in steps of 0.01; anything that is not a finite number gives the default volume. */
export function clampVolume(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SOUND.volume;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

export function readSoundPrefs(store: StorageLike | null = appStorage()): SoundPrefs {
  if (!store) return { ...DEFAULT_SOUND };
  try {
    const raw = store.getItem(SOUND_KEY);
    if (!raw) return { ...DEFAULT_SOUND };
    const parsed = JSON.parse(raw) as Partial<SoundPrefs> | null;
    return {
      on: typeof parsed?.on === "boolean" ? parsed.on : DEFAULT_SOUND.on,
      volume: clampVolume(parsed?.volume),
    };
  } catch {
    return { ...DEFAULT_SOUND };
  }
}

export function saveSoundPrefs(next: SoundPrefs, store: StorageLike | null = appStorage()): SoundPrefs {
  const clean: SoundPrefs = { on: Boolean(next.on), volume: clampVolume(next.volume) };
  if (store) {
    try {
      store.setItem(SOUND_KEY, JSON.stringify(clean));
    } catch {
      /* keep the in-memory choice for this session */
    }
  }
  return clean;
}

// ------------------------------------------------------------------ motion

/** `system` follows the OS setting (the default); `reduce` and `full` are the user's override. */
export type MotionPref = "system" | "reduce" | "full";
export const MOTION_PREFS: readonly MotionPref[] = ["system", "reduce", "full"];

export function readMotionPref(store: StorageLike | null = appStorage()): MotionPref {
  if (!store) return "system";
  try {
    const raw = store.getItem(MOTION_KEY);
    return raw === "reduce" || raw === "full" ? raw : "system";
  } catch {
    return "system";
  }
}

/** Saves the override; `system` removes the key so a fresh browser and a reset one look the same. */
export function saveMotionPref(pref: MotionPref, store: StorageLike | null = appStorage()): void {
  if (!store) return;
  try {
    if (pref === "reduce" || pref === "full") store.setItem(MOTION_KEY, pref);
    else store.removeItem(MOTION_KEY);
  } catch {
    /* ignore */
  }
}

/** The override wins; without one the OS preference decides. */
export function resolveReducedMotion(pref: MotionPref, osReduces: boolean): boolean {
  if (pref === "reduce") return true;
  if (pref === "full") return false;
  return osReduces;
}

// ------------------------------------------------------------------ skin

export function readSkinPref(store: StorageLike | null = appStorage()): SkinMode {
  if (!store) return "biolab";
  try {
    return store.getItem(SKIN_KEY) === "fintech" ? "fintech" : "biolab";
  } catch {
    return "biolab";
  }
}

export function saveSkinPref(skin: SkinMode, store: StorageLike | null = appStorage()): void {
  if (!store) return;
  try {
    if (skin === "fintech") store.setItem(SKIN_KEY, skin);
    else store.removeItem(SKIN_KEY);
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ reset

/**
 * Removes the app's own keys (`APP_LOCAL_KEYS`, which includes the language choice `LOCALE_KEY`) and
 * returns the ones that were present. Any other key in the store, such as the wallet's, is left alone.
 */
export function resetLocalData(store: StorageLike | null = appStorage()): string[] {
  const removed: string[] = [];
  resetOnboardingMemory();
  if (!store) return removed;
  for (const key of APP_LOCAL_KEYS) {
    try {
      if (store.getItem(key) !== null) removed.push(key);
      store.removeItem(key);
    } catch {
      /* skip a key that cannot be read or removed */
    }
  }
  return removed;
}

// ------------------------------------------------------------------ language (UI-161)

/**
 * The language choice (`en` or `id`) lives under `snacc_locale`; `i18n/locale.ts` reads and writes it
 * and the Language section of Settings explains it. It is listed in `APP_LOCAL_KEY_INFO` above, so the
 * Settings key list, the privacy page and `resetLocalData` all name it.
 */
export { LOCALE_KEY };
