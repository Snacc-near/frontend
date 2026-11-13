/**
 * Copy for the first-run intro, the Help window (rules, glossary, costs) and the legal pages' shared
 * facts (UI-151). Numbers come only from code constants or the contract source; every "what things
 * cost" row names where its value is defined. `CONTRACT_FIGURES` is the one place that repeats
 * contract constants (contracts/snacc/src/state.rs, `constants` module) that the frontend does not
 * already hold; `test/ui-151.test.ts` checks the frontend-held ones against it.
 */
import { BASE_BURST_BPS, INITIAL_ATP, MAX_BURST_BPS, VITALITY_MAX } from "../config/constants.ts";
import { FEVER_THRESHOLD_MK, HYPOTHERMIA_THRESHOLD_MK } from "../config/zones.ts";
import {
  DEFAULT_FEED_SNACC,
  DEFAULT_STAKE_NEAR,
  GAS,
  LOW_NEAR_YOCTO,
  MAX_STAKE_NEAR,
  MIN_STAKE_NEAR,
  STORAGE_MIN_FALLBACK_YOCTO,
  formatYocto,
} from "../chain/actions.ts";
import { DISTRESS_MAX_EFFECTIVE_VITALITY } from "../data/collection.ts";
import type { IconName } from "../ui/fd.tsx";

/** Source file paths as they are named in the org's repos. */
export const STATE_RS = "contracts/snacc/src/state.rs";
export const LIB_RS = "contracts/snacc/src/lib.rs";
export const ACTIONS_TS = "frontend/src/chain/actions.ts";

/**
 * Contract constants (state.rs `constants` module) as plain numbers. `bps` values are basis points
 * (100 bps = 1%). Kept here only for display; the contract is the source of truth.
 */
export const CONTRACT_FIGURES = {
  INITIAL_VITALITY: 8500,
  VITALITY_CAP: 10000,
  METABOLIC_RECOVERY_VITALITY: 500,
  BMR_EXTRACTOR_PER_HOUR: 100,
  BMR_FERMENTER_PER_HOUR: 120,
  BMR_SYNTHESIZER_PER_HOUR: 150,
  STAKE_TREASURY_BPS: 2000,
  STORAGE_DEPOSIT_MILLINEAR: 5,
  RESCUE_MIN_FEE_BPS: 2000,
  FEVER_BURN_BPS: 350,
  REBATE_BPS: 200,
  LIQUIDATOR_BOUNTY_BPS: 1000,
  HOSTILE_PREMIUM_BPS: 1500,
  HOSTILE_SELLER_BPS: 9500,
  HOSTILE_TREASURY_BPS: 500,
  MERGER_TAX_BPS: 250,
  DIVIDEND_INFLOW_BPS: 5000,
  MAX_DIVIDEND_CLAIM_EPOCHS: 8,
  EPOCH_DURATION_SEC: 86_400,
  MAX_ORGANEL_LEVEL: 5,
  ORGANEL_BPS_PER_LEVEL: 1000,
  ATP_YOCTO_UNIT: "1000000000000000",
  MAX_COLONY_SIZE: 5,
  MAX_GENERATION: 8,
} as const;

/** `2000` -> `20%`, `350` -> `3.5%`, `250` -> `2.5%`. */
export function bpsToPct(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "")}%`;
}

/** `10000` -> `100%`: the vitality scale used by the contract, shown as a percentage. */
export function vitalityPct(units: number): string {
  return bpsToPct(units);
}

// ------------------------------------------------------------------ first-run intro

export interface IntroStep {
  id: string;
  icon: IconName;
  /** Short caption above the text. */
  topic: string;
  title: string;
  body: string;
  points: readonly string[];
}

export const INTRO_STEPS: readonly IntroStep[] = [
  {
    id: "what",
    icon: "cell",
    topic: "what it is",
    title: "Meet your Snacc",
    body: "A Snacc is an NFT that behaves like a small living organism. It owns a balance of $SNACC and has a vitality that drains every hour.",
    points: [
      "Vitality is its health, shown as a percentage. Keep it fed and it stays healthy.",
      "$SNACC is the memecoin it eats. On testnet it has no monetary value.",
      "This is an experimental game on NEAR testnet. Nothing here is a promise of profit.",
    ],
  },
  {
    id: "modes",
    icon: "chain",
    topic: "demo and live",
    title: "Demo or live",
    body: "The demo and live switch in the header decides where the numbers come from.",
    points: [
      "Demo is simulated on your device. No wallet, no transactions, nothing is written to the chain.",
      "Live testnet reads the real contract. You can look around without logging in.",
      "To hatch and feed in live mode, press connect wallet and pick a NEAR wallet. If email login is switched on for this site it shows up in the same picker, powered by Privy. Either way you sign testnet transactions yourself and the app never sees your keys.",
    ],
  },
  {
    id: "hatch",
    icon: "spark",
    topic: "hatching",
    title: "Hatch your first Snacc",
    body: "In live mode, once your wallet is linked, press Hatch in the action bar at the bottom.",
    points: [
      "Pick a role and a testnet NEAR stake, then approve the transaction in your wallet. The new Snacc appears in my collection.",
      "No testnet NEAR? The wallet panel links to the free NEAR faucet.",
      "In demo, tap a cell to open the lab and try every action with simulated numbers.",
    ],
  },
  {
    id: "feed",
    icon: "warn",
    topic: "daily feeding",
    title: "Feed it daily, or it gets snacked",
    body: "Vitality drains every hour, so check in about once a day and press Feed. Feeding burns a little $SNACC from the Snacc's own balance and refills its vitality.",
    points: [
      `At ${vitalityPct(DISTRESS_MAX_EFFECTIVE_VITALITY)} effective vitality or less a Snacc is Distressed, and another player can adopt it.`,
      `At zero it is starving, and anyone can snack it: the hunter keeps ${bpsToPct(CONTRACT_FIGURES.LIQUIDATOR_BOUNTY_BPS)} of its $SNACC and the rest goes to The Pantry.`,
      "Open help any time for the rules, the glossary and what things cost.",
    ],
  },
];

// ------------------------------------------------------------------ rules

export interface RuleBlock {
  id: string;
  title: string;
  body: string;
}

export const RULES: readonly RuleBlock[] = [
  {
    id: "loop",
    title: "The loop",
    body: "Hatch a Snacc, feed it about once a day, and keep its vitality out of the red. A fed Snacc stays yours; a hungry one can be adopted or snacked by other players.",
  },
  {
    id: "hatch",
    title: "Hatching",
    body: `Hatching (incubate_strain) needs a connected wallet in live mode. You choose a role (Extractor, Fermenter or Synthesizer) and a NEAR stake, and the wallet signs the call. A new Snacc starts at ${vitalityPct(CONTRACT_FIGURES.INITIAL_VITALITY)} vitality with ${INITIAL_ATP} ATP.`,
  },
  {
    id: "feed",
    title: "Feeding",
    body: `Feeding (feed_strain) burns $SNACC from the Snacc's own balance. It sets vitality to the current effective vitality plus ${CONTRACT_FIGURES.METABOLIC_RECOVERY_VITALITY} (at most ${CONTRACT_FIGURES.VITALITY_CAP}) and restarts the hunger clock. Only the owner can feed.`,
  },
  {
    id: "decay",
    title: "Hunger",
    body: "Effective vitality is the stored vitality minus the hours since the last feed times the hunger rate (BMR). The contract works it out whenever it is read, so nothing needs to run in the background.",
  },
  {
    id: "risk",
    title: "When hunger bites",
    body: `Between 1 and ${DISTRESS_MAX_EFFECTIVE_VITALITY} effective vitality a Snacc is Distressed and a rival can adopt it. At 0 it is starving and anyone can snack it. A starving Snacc cannot be fed.`,
  },
  {
    id: "zones",
    title: "Zones",
    body: `A central-bank style thermostat, CrucibleTemp, sets the zone from its reading in mK. Below ${HYPOTHERMIA_THRESHOLD_MK} mK it is Hypothermia (Famine on the home page), from ${HYPOTHERMIA_THRESHOLD_MK} to ${FEVER_THRESHOLD_MK} mK Goldilocks (Normal appetite), above ${FEVER_THRESHOLD_MK} mK Fever (Feeding Frenzy). The fintech skin renames them stimulus rebate, market balance and counter-cyclical burn.`,
  },
  {
    id: "modes",
    title: "What works in live mode today",
    body: "In live testnet mode the game signs two actions: hatch and feed. Produce ATP, extract, transmute, synthesize, divide and harvest run in the demo only.",
  },
];

// ------------------------------------------------------------------ glossary

export interface GlossaryEntry {
  id: string;
  term: string;
  body: string;
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: "snacc",
    term: "Snacc",
    body: "A living NFT (a strain in the contract) with its own $SNACC balance, inventory and vitality. The code and the skin settings also call it a living cell or an NFT subsidiary.",
  },
  {
    id: "vitality",
    term: "Vitality",
    body: `The stored health of a Snacc on a 0 to ${VITALITY_MAX} scale, shown as a percentage. Feeding raises it; the hours since the last feed lower the effective figure.`,
  },
  {
    id: "effective-vitality",
    term: "Effective vitality",
    body: "Vitality as it is right now: stored vitality minus the hours since the last feed times the hunger rate. This is the number that decides Distressed and starving.",
  },
  {
    id: "bmr",
    term: "Hunger rate (BMR)",
    body: `The vitality a Snacc loses per hour: ${CONTRACT_FIGURES.BMR_EXTRACTOR_PER_HOUR} for an Extractor, ${CONTRACT_FIGURES.BMR_FERMENTER_PER_HOUR} for a Fermenter and ${CONTRACT_FIGURES.BMR_SYNTHESIZER_PER_HOUR} for a Synthesizer. The Lysosome organelle lowers it by ${bpsToPct(CONTRACT_FIGURES.ORGANEL_BPS_PER_LEVEL)} per level.`,
  },
  {
    id: "atp",
    term: "ATP",
    body: `Internal energy, not a token you can transfer. A new Snacc starts with ${INITIAL_ATP}. Feeding mints more, scaled by efficiency and the Mitochondria level, and it is spent on internal work such as organelle upgrades.`,
  },
  {
    id: "organelles",
    term: "Organelles",
    body: `Three upgrade slots, each up to level ${CONTRACT_FIGURES.MAX_ORGANEL_LEVEL}. Mitochondria raise ATP per feed, the Nucleus raises production output, and the Lysosome lowers the hunger rate, each by ${bpsToPct(CONTRACT_FIGURES.ORGANEL_BPS_PER_LEVEL)} per level. One allocation per epoch, 1 ATP per level gained.`,
  },
  {
    id: "zones",
    term: "Zones: Hypothermia, Goldilocks, Fever",
    body: `The thermostat reading (CrucibleTemp, in mK) sets the zone. Hypothermia is below ${HYPOTHERMIA_THRESHOLD_MK} mK and pays a ${bpsToPct(CONTRACT_FIGURES.REBATE_BPS)} rebate; Goldilocks is ${HYPOTHERMIA_THRESHOLD_MK} to ${FEVER_THRESHOLD_MK} mK with no burn and no rebate; Fever is above ${FEVER_THRESHOLD_MK} mK and burns ${bpsToPct(CONTRACT_FIGURES.FEVER_BURN_BPS)} of the fee. The home page names them Famine relief, Normal appetite and Feeding Frenzy.`,
  },
  {
    id: "distressed",
    term: "Distressed",
    body: `Effective vitality from 1 to ${DISTRESS_MAX_EFFECTIVE_VITALITY} (up to ${vitalityPct(DISTRESS_MAX_EFFECTIVE_VITALITY)}). The Snacc is still the owner's, but another player may adopt it. The home page calls this band Starving.`,
  },
  {
    id: "starving",
    term: "Starving",
    body: "Effective vitality of 0. The Snacc cannot be fed any more and anyone may snack it. The home page calls this state Fainted.",
  },
  {
    id: "adopt",
    term: "Adopt",
    body: `Taking over a Distressed Snacc (hostile_takeover_splice). The adopter pays its book value plus ${bpsToPct(CONTRACT_FIGURES.HOSTILE_PREMIUM_BPS)}; the old owner receives ${bpsToPct(CONTRACT_FIGURES.HOSTILE_SELLER_BPS)} of that payment and ${bpsToPct(CONTRACT_FIGURES.HOSTILE_TREASURY_BPS)} goes to The Pantry. The adopted Snacc is absorbed into the adopter's.`,
  },
  {
    id: "snack",
    term: "Snack",
    body: `Cashing in a starving Snacc (harvest_starving_strain, also called Cell Lysis). Anyone may do it. The hunter receives ${bpsToPct(CONTRACT_FIGURES.LIQUIDATOR_BOUNTY_BPS)} of its $SNACC and The Pantry receives the rest; the Snacc is then liquidated.`,
  },
  {
    id: "pantry",
    term: "The Pantry",
    body: "The rule-bound treasury: a pool the contract fills from fees and splits, and that no admin can withdraw from.",
  },
  {
    id: "dividends",
    term: "Dividends",
    body: `Each epoch (${CONTRACT_FIGURES.EPOCH_DURATION_SEC / 3600} hours) ${bpsToPct(CONTRACT_FIGURES.DIVIDEND_INFLOW_BPS)} of the fee that is not burned is set aside for the dividend pool. Owners share it in proportion to the Aether they burned in that epoch and claim it with claim_industrial_dividend after the epoch closes, up to ${CONTRACT_FIGURES.MAX_DIVIDEND_CLAIM_EPOCHS} epochs back.`,
  },
  {
    id: "epoch",
    term: "Epoch",
    body: `The contract's day: ${CONTRACT_FIGURES.EPOCH_DURATION_SEC / 3600} hours. Allocations, burst discounts and dividends are counted per epoch.`,
  },
  {
    id: "burst",
    term: "Nutrient burst",
    body: `Snacking a Snacc releases a discount on feeding for one epoch. It starts at a base of ${bpsToPct(BASE_BURST_BPS)}, grows with what was released, and is capped at ${bpsToPct(MAX_BURST_BPS)}.`,
  },
];

// ------------------------------------------------------------------ what things cost

export interface CostRow {
  id: string;
  item: string;
  value: string;
  note: string;
  /** File and constant (or function) that defines the value. */
  source: string;
}

const near = (yocto: string) => formatYocto(yocto, 6);

export const COSTS: readonly CostRow[] = [
  {
    id: "stake",
    item: "Hatch stake",
    value: `${DEFAULT_STAKE_NEAR} NEAR by default`,
    note: `The form accepts ${MIN_STAKE_NEAR} to ${MAX_STAKE_NEAR} NEAR on testnet. The amount is attached to incubate_strain.`,
    source: `${ACTIONS_TS} DEFAULT_STAKE_NEAR, MIN_STAKE_NEAR, MAX_STAKE_NEAR`,
  },
  {
    id: "stake-split",
    item: "Where the stake goes",
    value: `${bpsToPct(CONTRACT_FIGURES.STAKE_TREASURY_BPS)} to The Pantry, the rest to the Snacc`,
    note: "The Pantry share is the incubation fee; the remainder is the Snacc's working capital.",
    source: `${STATE_RS} STAKE_TREASURY_BPS; ${LIB_RS} incubate_strain`,
  },
  {
    id: "low-near",
    item: "NEAR needed for one default hatch",
    value: `a wallet under ${near(LOW_NEAR_YOCTO)} NEAR is flagged as too low`,
    note: "Covers the default stake, storage registration and gas.",
    source: `${ACTIONS_TS} LOW_NEAR_YOCTO`,
  },
  {
    id: "storage",
    item: "First $SNACC registration",
    value: `${near(STORAGE_MIN_FALLBACK_YOCTO)} NEAR fallback minimum`,
    note: "The app reads the real minimum from storage_balance_bounds and uses this figure only if that read fails.",
    source: `${ACTIONS_TS} STORAGE_MIN_FALLBACK_YOCTO; ${STATE_RS} STORAGE_DEPOSIT_MILLINEAR`,
  },
  {
    id: "gas",
    item: "Gas",
    value: `up to ${Number(BigInt(GAS.feed_strain) / 10n ** 12n)} TGas prepaid per hatch or feed`,
    note: "Prepaid gas is a limit. The protocol refunds what is not used, so you pay only for gas actually burnt.",
    source: `${ACTIONS_TS} GAS`,
  },
  {
    id: "feed",
    item: "Feed",
    value: `${DEFAULT_FEED_SNACC} $SNACC by default`,
    note: `Burnt from the Snacc's own balance, no NEAR attached. Each feed restores ${CONTRACT_FIGURES.METABOLIC_RECOVERY_VITALITY} vitality (up to ${CONTRACT_FIGURES.VITALITY_CAP}).`,
    source: `${ACTIONS_TS} DEFAULT_FEED_SNACC; ${LIB_RS} recover_metabolism; ${STATE_RS} METABOLIC_RECOVERY_VITALITY`,
  },
  {
    id: "rescue",
    item: "Rescue discount on feeding",
    value: `fee scales from ${bpsToPct(CONTRACT_FIGURES.RESCUE_MIN_FEE_BPS)} (at 0 effective vitality) to 100% (at full)`,
    note: "The hungrier the Snacc, the cheaper its next feed.",
    source: `${STATE_RS} RESCUE_MIN_FEE_BPS; ${LIB_RS} feed_strain`,
  },
  {
    id: "hunger",
    item: "Hunger per hour",
    value: `${CONTRACT_FIGURES.BMR_EXTRACTOR_PER_HOUR} / ${CONTRACT_FIGURES.BMR_FERMENTER_PER_HOUR} / ${CONTRACT_FIGURES.BMR_SYNTHESIZER_PER_HOUR} vitality`,
    note: `For an Extractor, Fermenter and Synthesizer. A Snacc starts at ${CONTRACT_FIGURES.INITIAL_VITALITY}, so an unfed Extractor runs out after ${CONTRACT_FIGURES.INITIAL_VITALITY / CONTRACT_FIGURES.BMR_EXTRACTOR_PER_HOUR} hours (derived: ${CONTRACT_FIGURES.INITIAL_VITALITY} / ${CONTRACT_FIGURES.BMR_EXTRACTOR_PER_HOUR}).`,
    source: `${STATE_RS} BMR_EXTRACTOR_PER_HOUR, BMR_FERMENTER_PER_HOUR, BMR_SYNTHESIZER_PER_HOUR, INITIAL_VITALITY`,
  },
  {
    id: "thermostat",
    item: "Thermostat",
    value: `Fever burns ${bpsToPct(CONTRACT_FIGURES.FEVER_BURN_BPS)} of the fee; Hypothermia rebates ${bpsToPct(CONTRACT_FIGURES.REBATE_BPS)}`,
    note: `Zone edges are ${HYPOTHERMIA_THRESHOLD_MK} mK and ${FEVER_THRESHOLD_MK} mK.`,
    source: `${STATE_RS} FEVER_BURN_BPS, REBATE_BPS; frontend/src/config/zones.ts`,
  },
  {
    id: "snack",
    item: "Snacking a starving Snacc",
    value: `hunter ${bpsToPct(CONTRACT_FIGURES.LIQUIDATOR_BOUNTY_BPS)}, The Pantry ${bpsToPct(10000 - CONTRACT_FIGURES.LIQUIDATOR_BOUNTY_BPS)}`,
    note: "Split of the starving Snacc's $SNACC balance.",
    source: `${STATE_RS} LIQUIDATOR_BOUNTY_BPS; ${LIB_RS} harvest_starving_strain`,
  },
  {
    id: "adopt",
    item: "Adopting a Distressed Snacc",
    value: `book value + ${bpsToPct(CONTRACT_FIGURES.HOSTILE_PREMIUM_BPS)}`,
    note: `Of the payment, ${bpsToPct(CONTRACT_FIGURES.HOSTILE_SELLER_BPS)} goes to the old owner and ${bpsToPct(CONTRACT_FIGURES.HOSTILE_TREASURY_BPS)} to The Pantry.`,
    source: `${STATE_RS} HOSTILE_PREMIUM_BPS, HOSTILE_SELLER_BPS, HOSTILE_TREASURY_BPS; ${LIB_RS} hostile_takeover_splice`,
  },
  {
    id: "merge",
    item: "Merging two of your Snaccs",
    value: `${bpsToPct(CONTRACT_FIGURES.MERGER_TAX_BPS)} merger tax to The Pantry`,
    note: "Applies to splice_strains.",
    source: `${STATE_RS} MERGER_TAX_BPS`,
  },
  {
    id: "organel",
    item: "Organelle upgrade",
    value: "1 ATP per level gained",
    note: `One allocation per epoch, each slot up to level ${CONTRACT_FIGURES.MAX_ORGANEL_LEVEL}.`,
    source: `${LIB_RS} allocate_atp; ${STATE_RS} MAX_ORGANEL_LEVEL`,
  },
  {
    id: "dividend",
    item: "Dividend pool",
    value: `${bpsToPct(CONTRACT_FIGURES.DIVIDEND_INFLOW_BPS)} of the non-burned fee`,
    note: `Claimed after the epoch closes, up to ${CONTRACT_FIGURES.MAX_DIVIDEND_CLAIM_EPOCHS} epochs back.`,
    source: `${STATE_RS} DIVIDEND_INFLOW_BPS, MAX_DIVIDEND_CLAIM_EPOCHS; ${LIB_RS} claim_industrial_dividend`,
  },
];
