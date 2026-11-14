/**
 * Settings window copy (UI-161): the language section and, from phase B4, the sound, motion, wording
 * and "Reset local data" sections of `help/SettingsModal.tsx`. The one-tap section is in `onetap.ts`.
 * `keys.*` repeats the descriptions in `APP_LOCAL_KEY_INFO` (`prefs/prefs.ts`), which stay English
 * data for the privacy page; a test keeps the two in step.
 */
const settings = {
  language: {
    /** Written in both languages on purpose, so it can be found from either. */
    heading: "Language / Bahasa",
    group: "Language",
    /** `{key}` is the localStorage key, shown in code font. */
    hint: "Saved in this browser only, as {key}. Reset local data below clears it too.",
    /** Remove this line once every screen is translated. */
    partial:
      "The landing page, the game screen, the action windows and the help windows are translated; the remaining windows (profile, notifications, market and others) are still English and follow soon.",
  },

  modal: {
    heading: "Settings",
    footer: "saved in this browser only",
    tag: "local",
  },

  sound: {
    heading: "Sound",
    on: "sound effects on",
    off: "sound effects off",
    volume: "volume {pct}%",
  },

  motion: {
    heading: "Reduce motion",
    group: "reduce motion",
    system: "follow system",
    reduce: "reduce",
    full: "full motion",
    /** `{current}` is `motion.reduceNow` or `motion.full`, as the device reports it. */
    hint: "Follow system uses your device setting, which is currently {current}. Your choice here is saved and wins over it.",
    reduceNow: "reduce motion",
  },

  skin: {
    heading: "Wording",
    hint: "The same mechanics named as a bio-lab or as a fintech desk.",
  },

  data: {
    heading: "Local data",
    /** `{reset}` is the bold button name, `{walletKey}` and `{db}` are in code font. */
    note: "{reset} clears exactly these keys in this browser, then reloads the page. Your wallet's own entries, such as the {walletKey} key NEAR Connect keeps, are not touched. The intro will show again. It also deletes the one-tap play key database (IndexedDB {db}) in this browser; that does not remove a one-tap key from your account, so turn one-tap play off first if it is on.",
    resetName: "Reset local data",
    confirmGroup: "confirm reset",
    confirm: "clear these keys and reload",
    cancel: "cancel",
    reset: "reset local data",
  },

  keys: {
    onboarding: "the intro has been shown",
    sound: "sound on or off and the volume",
    motion: "your reduce-motion choice",
    skin: "bio-lab or fintech wording",
    guest: "your guest label and highlighted account",
    legacySession: "a leftover key from an earlier build",
    profileSession: "your profile sign-in session, only after you sign in to a profile",
    browserAlerts: "browser alerts turned on for notifications",
    telemetry: "your choice about sharing anonymous usage stats",
    deviceId: "a random id for anonymous usage stats (a new one is made after a reset)",
    oneTap:
      "the one-tap play key, only if you turned one-tap play on and this browser blocks IndexedDB (clearing it does not remove the key from your account; turn one-tap play off for that)",
    locale: "your language choice (English or Bahasa Indonesia)",
  },
};

export default settings;
