/**
 * How to play (UI-161 phase B4): the Help window, its rules, glossary and "what things cost" rows, the
 * legal line at the foot of the game and the note on the legal pages. `help/content.ts` builds the
 * rule, glossary and cost records from these keys and fills the `{...}` figures from the code
 * constants and the contract figures it holds, so a number is never typed in here. The `source:`
 * column of the cost rows (file and constant names) is code and stays untranslated.
 *
 * The glossary defines the game's own fee-sharing term; the UI-140 honesty guard allows that word
 * in this file and in `help/content.ts` only.
 */
const help = {
  modal: {
    heading: "How to play",
    footer: "numbers come from code constants or the contract source, each with its source",
    cap: "rules, glossary and costs",
    replay: "replay intro",
    tabsLabel: "help sections",
    tabRules: "rules",
    tabGlossary: "glossary",
    tabCosts: "what things cost",
  },

  costs: {
    lead: "What things cost.",
    note: "Testnet figures. $SNACC on testnet has no monetary value, and none of this is a promise of any return.",
    source: "source:",
  },

  /** The line at the foot of the game, with the links to the legal pages. */
  legal: {
    aria: "legal",
    line: "testnet only · $snacc has no monetary value",
    terms: "terms",
    privacy: "privacy",
    /** Shown at the top of Terms and Privacy when the UI is not English; the legal text itself stays English. */
    onlyEnglish: "This page is only available in English.",
  },

  rules: {
    loop: {
      title: "The loop",
      body: "Hatch a Snacc, feed it about once a day, and keep its vitality out of the red. A fed Snacc stays yours; a hungry one can be adopted or snacked by other players.",
    },
    hatch: {
      title: "Hatching",
      body: "Hatching (incubate_strain) needs a connected wallet in live mode. You choose a role (Extractor, Fermenter or Synthesizer) and a NEAR stake, and the wallet signs the call. A new Snacc starts at {initialVitalityPct} vitality with {initialAtp} ATP.",
    },
    feed: {
      title: "Feeding",
      body: "Feeding (feed_strain) burns $SNACC from the Snacc's own balance. It sets vitality to the current effective vitality plus {recovery} (at most {vitalityCap}) and restarts the hunger clock. Only the owner can feed.",
    },
    decay: {
      title: "Hunger",
      body: "Effective vitality is the stored vitality minus the hours since the last feed times the hunger rate (BMR). The contract works it out whenever it is read, so nothing needs to run in the background.",
    },
    risk: {
      title: "When hunger bites",
      body: "Between 1 and {distressMax} effective vitality a Snacc is Distressed and a rival can adopt it. At 0 it is starving and anyone can snack it. A starving Snacc cannot be fed.",
    },
    zones: {
      title: "Zones",
      body: "A central-bank style thermostat, CrucibleTemp, sets the zone from its reading in mK. Below {hypoMk} mK it is Hypothermia (Famine on the home page), from {hypoMk} to {feverMk} mK Goldilocks (Normal appetite), above {feverMk} mK Fever (Feeding Frenzy). The fintech skin renames them stimulus rebate, market balance and counter-cyclical burn.",
    },
    modes: {
      title: "What works in live mode today",
      body: "In live testnet mode your wallet signs every player action: hatch, feed, produce ATP, extract, transmute, synthesize, divide, splice, hostile takeover, adopt, harvest a starving Snacc, buy spores from the NPC, claim the industrial dividend, and gift or send Snaccs and $SNACC. Testnet $SNACC has no money value.",
    },
  },

  glossary: {
    snacc: {
      term: "Snacc",
      body: "A living NFT (a strain in the contract) with its own $SNACC balance, inventory and vitality. The code and the skin settings also call it a living cell or an NFT subsidiary.",
    },
    vitality: {
      term: "Vitality",
      body: "The stored health of a Snacc on a 0 to {vitalityMax} scale, shown as a percentage. Feeding raises it; the hours since the last feed lower the effective figure.",
    },
    "effective-vitality": {
      term: "Effective vitality",
      body: "Vitality as it is right now: stored vitality minus the hours since the last feed times the hunger rate. This is the number that decides Distressed and starving.",
    },
    bmr: {
      term: "Hunger rate (BMR)",
      body: "The vitality a Snacc loses per hour: {bmrExtractor} for an Extractor, {bmrFermenter} for a Fermenter and {bmrSynthesizer} for a Synthesizer. The Lysosome organelle lowers it by {organelPct} per level.",
    },
    atp: {
      term: "ATP",
      body: "Internal energy, not a token you can transfer. A new Snacc starts with {initialAtp}. Feeding mints more, scaled by efficiency and the Mitochondria level, and it is spent on internal work such as organelle upgrades.",
    },
    organelles: {
      term: "Organelles",
      body: "Three upgrade slots, each up to level {maxOrganelLevel}. Mitochondria raise ATP per feed, the Nucleus raises production output, and the Lysosome lowers the hunger rate, each by {organelPct} per level. One allocation per epoch, 1 ATP per level gained.",
    },
    zones: {
      term: "Zones: Hypothermia, Goldilocks, Fever",
      body: "The thermostat reading (CrucibleTemp, in mK) sets the zone. Hypothermia is below {hypoMk} mK and pays a {rebatePct} rebate; Goldilocks is {hypoMk} to {feverMk} mK with no burn and no rebate; Fever is above {feverMk} mK and burns {feverBurnPct} of the fee. The home page names them Famine relief, Normal appetite and Feeding Frenzy.",
    },
    distressed: {
      term: "Distressed",
      body: "Effective vitality from 1 to {distressMax} (up to {distressPct}). The Snacc is still the owner's, but another player may adopt it. The home page calls this band Starving.",
    },
    starving: {
      term: "Starving",
      body: "Effective vitality of 0. The Snacc cannot be fed any more and anyone may snack it. The home page calls this state Fainted.",
    },
    adopt: {
      term: "Adopt",
      body: "Taking over a Distressed Snacc (hostile_takeover_splice). The adopter pays its book value plus {adoptPremiumPct}; the old owner receives {adoptSellerPct} of that payment and {adoptTreasuryPct} goes to The Pantry. The adopted Snacc is absorbed into the adopter's.",
    },
    snack: {
      term: "Snack",
      body: "Cashing in a starving Snacc (harvest_starving_strain, also called Cell Lysis). Anyone may do it. The hunter receives {bountyPct} of its $SNACC and The Pantry receives the rest; the Snacc is then liquidated.",
    },
    pantry: {
      term: "The Pantry",
      body: "The rule-bound treasury: a pool the contract fills from fees and splits, and that no admin can withdraw from.",
    },
    sharePool: {
      term: "Dividends",
      body: "Each epoch ({epochHours} hours) {dividendPct} of the fee that is not burned is set aside for the dividend pool. Owners share it in proportion to the Aether they burned in that epoch and claim it with claim_industrial_dividend after the epoch closes, up to {claimEpochs} epochs back.",
    },
    epoch: {
      term: "Epoch",
      body: "The contract's day: {epochHours} hours. Allocations, burst discounts and dividends are counted per epoch.",
    },
    burst: {
      term: "Nutrient burst",
      body: "Snacking a Snacc releases a discount on feeding for one epoch. It starts at a base of {baseBurstPct}, grows with what was released, and is capped at {maxBurstPct}.",
    },
    profile: {
      term: "Profile",
      body: "Optional. \"Save progress — sign in\" next to the wallet asks the wallet to sign a short message (no transaction, no fee). You then get a username, a bio, an avatar picked from your own Snaccs, notifications, and a public page at /p/<your account>. The game works the same without one.",
    },
    achievements: {
      term: "Achievements and streak",
      body: "Badges the profile database awards from your recorded signed actions, such as a first hatch, ten feeds or a seven-day feed streak. The streak counts days in a row with at least one recorded feed. They are recorded only while you are signed in, and they have no value.",
    },
  },

  rows: {
    stake: {
      item: "Hatch stake",
      value: "{stakeDefault} NEAR by default",
      note: "The form accepts {stakeMin} to {stakeMax} NEAR on testnet. The amount is attached to incubate_strain.",
    },
    "stake-split": {
      item: "Where the stake goes",
      value: "{stakePantryPct} to The Pantry, the rest to the Snacc",
      note: "The Pantry share is the incubation fee; the remainder is the Snacc's working capital.",
    },
    "low-near": {
      item: "NEAR needed for one default hatch",
      value: "a wallet under {lowNear} NEAR is flagged as too low",
      note: "Covers the default stake, storage registration and gas.",
    },
    storage: {
      item: "First $SNACC registration",
      value: "{storageNear} NEAR fallback minimum",
      note: "The app reads the real minimum from storage_balance_bounds and uses this figure only if that read fails.",
    },
    gas: {
      item: "Gas",
      value: "up to {tgas} TGas prepaid per hatch or feed",
      note: "Prepaid gas is a limit. The protocol refunds what is not used, so you pay only for gas actually burnt.",
    },
    feed: {
      item: "Feed",
      value: "{feedDefault} $SNACC by default",
      note: "Burnt from the Snacc's own balance, no NEAR attached. Each feed restores {recovery} vitality (up to {vitalityCap}).",
    },
    rescue: {
      item: "Rescue discount on feeding",
      value: "fee scales from {rescuePct} (at 0 effective vitality) to 100% (at full)",
      note: "The hungrier the Snacc, the cheaper its next feed.",
    },
    hunger: {
      item: "Hunger per hour",
      value: "{bmrExtractor} / {bmrFermenter} / {bmrSynthesizer} vitality",
      note: "For an Extractor, Fermenter and Synthesizer. A Snacc starts at {initialVitality}, so an unfed Extractor runs out after {hoursEmpty} hours (derived: {initialVitality} / {bmrExtractor}).",
    },
    thermostat: {
      item: "Thermostat",
      value: "Fever burns {feverBurnPct} of the fee; Hypothermia rebates {rebatePct}",
      note: "Zone edges are {hypoMk} mK and {feverMk} mK.",
    },
    snack: {
      item: "Snacking a starving Snacc",
      value: "hunter {bountyPct}, The Pantry {pantryPct}",
      note: "Split of the starving Snacc's $SNACC balance.",
    },
    adopt: {
      item: "Adopting a Distressed Snacc",
      value: "book value + {adoptPremiumPct}",
      note: "Of the payment, {adoptSellerPct} goes to the old owner and {adoptTreasuryPct} to The Pantry.",
    },
    merge: {
      item: "Merging two of your Snaccs",
      value: "{mergerPct} merger tax to The Pantry",
      note: "Applies to splice_strains.",
    },
    organel: {
      item: "Organelle upgrade",
      value: "1 ATP per level gained",
      note: "One allocation per epoch, each slot up to level {maxOrganelLevel}.",
    },
    sharePool: {
      item: "Dividend pool",
      value: "{dividendPct} of the non-burned fee",
      note: "Claimed after the epoch closes, up to {claimEpochs} epochs back.",
    },
  },
};

export default help;
