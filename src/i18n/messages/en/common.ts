/**
 * Words shared by more than one screen (UI-161). English is the source of truth: the Indonesian file
 * next to it is type-checked against the shape of this one.
 */
const common = {
  /** Language names are written in their own language, so a visitor can always find theirs. */
  language: {
    en: "English",
    id: "Bahasa Indonesia",
  },
  /** Text of the loading screen shown before a route's code has arrived. */
  boot: {
    landing: "warming the incubator…",
    game: "loading the lab…",
  },
  brand: {
    backToTop: "Snacc, back to top",
  },
  /** The mono tag next to a made-up number: `simulation` (moves with the demo) or `illustration`. */
  sim: {
    simulation: "simulation",
    illustration: "illustration",
  },
  /** The three appetite zones of CrucibleTemp. `rate` takes the official percentage as `{pct}`. */
  zones: {
    famine: { label: "Famine Relief", rate: "{pct} relief" },
    normal: { label: "Normal Appetite", rate: "no burn, no relief" },
    frenzy: { label: "Feeding Frenzy", rate: "{pct} burn" },
  },
  /** Hunger states of a Snacc. */
  hunger: {
    fed: "Fed",
    starving: "Starving",
    fainted: "Fainted",
  },
};

export default common;
