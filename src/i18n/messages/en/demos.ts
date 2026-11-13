/**
 * Copy of the five chapter demos on the landing page (UI-161). `{sim}` is the small mono
 * `simulation` / `illustration` tag, `{bite}` `{burn}` `{pct}` and friends are official figures.
 */
const demos = {
  feed: {
    fullness: "fullness",
    state: "state",
    bites: "bites",
    burned: "burned",
    button: "Feed",
    note: "one bite = {bite} $SNACC, {burn} burns in a Feeding Frenzy {sim}",
  },

  metabolism: {
    group: "Production stage",
    spores: { label: "Spores", role: "Extractor", note: "Extractors pull raw spores out of the medium." },
    enzymes: { label: "Enzymes", role: "Fermenter", note: "Fermenters refine spores into enzymes." },
    elixirs: { label: "Elixirs", role: "Synthesizer", note: "Synthesizers brew enzymes into elixirs. Every job costs ATP." },
  },

  colony: {
    hungry: "hungry cell",
    snacked: "snacked",
    open: "Fainted · open to anyone",
    split: "split",
    toPantry: "{pct} to The Pantry",
    mergePair: "merge pair",
    merged: "merged · generation +1",
    healthy: "two healthy cells",
    mergeTax: "merge tax",
    snack: "Snack it",
    merge: "Merge",
    reset: "reset",
    note: "{bounty} bounty to the hunter {sim}",
  },

  appetite: {
    slider: "Appetite Meter (CrucibleTemp)",
    /** Spoken value of the slider: `{temp}` mK in `{zone}`. */
    valueText: "{temp} mK, {zone}",
    liveMarker: "live {temp} mK",
    rows: {
      temp: "CrucibleTemp",
      zone: "zone",
      rate: "rate",
      frenzy: "frenzy",
      famine: "famine",
      live: "live",
    },
    frenzyValue: "> {mk} mK · {burn} burn",
    famineValue: "< {mk} mK · {relief} relief",
    snap: "snap to live",
    offline: "offline",
    reading: "reading…",
    note: "drag the meter: the needle, the thermometer, the medium and the dew on the glass follow {sim}",
    markerNote: " · marker = live CrucibleTemp from {contract}",
  },

  enclave: {
    steps: {
      request: "1 · request",
      enclave: "2 · enclave",
      signature: "3 · signature",
      contract: "4 · contract",
    },
    computing: "computing plan…",
    signed: "signed in TEE",
    verified: "verified ✓",
    seeTx: "See the verified tx ↗",
    again: "again",
    /** `{sim}` is the `illustration` tag, `{action}` the method name of the real transaction. */
    noteSealed: "rows are an {sim}; the link is the real testnet tx {action}",
    hold: "Hold to send the plan",
    noteIdle: "the enclave signs; the contract checks the signature {sim}",
  },
};

export default demos;
