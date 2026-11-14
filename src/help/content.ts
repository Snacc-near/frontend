/**
 * Copy for the first-run intro and the Help window (rules, glossary, costs) (UI-151). Numbers come
 * only from code constants or the contract source; every "what things cost" row names where its value
 * is defined. `CONTRACT_FIGURES` is the one place that repeats contract constants
 * (contracts/snacc/src/state.rs, `constants` module) that the frontend does not already hold;
 * `test/ui-151.test.tsx` checks the frontend-held ones against it.
 *
 * UI-161 phase B4: the words live in the `onboarding` and `help` dictionaries (English and Indonesian)
 * and carry `{placeholders}`; `FIGURES` below computes every number from the constants and fills them.
 * `introSteps(locale)`, `rules(locale)`, `glossary(locale)` and `costs(locale)` build the records for
 * one language. `INTRO_STEPS`, `RULES`, `GLOSSARY` and `COSTS` are the English records, kept as data
 * for tests and search. The `source` column of a cost row is code (file and constant names): it is the
 * same in every language.
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
import { t, type MessageKey } from "../i18n/catalog.ts";
import type { Locale, Vars } from "../i18n/types.ts";
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

const near = (yocto: string) => formatYocto(yocto, 6);

// ------------------------------------------------------------------ figures for the placeholders

/**
 * Every number the help texts quote, computed from the code constants and `CONTRACT_FIGURES`. A
 * dictionary entry names the ones it needs as `{name}`; none of these is typed into a dictionary.
 */
const FIGURES: Vars = {
  initialVitality: CONTRACT_FIGURES.INITIAL_VITALITY,
  initialVitalityPct: vitalityPct(CONTRACT_FIGURES.INITIAL_VITALITY),
  initialAtp: INITIAL_ATP,
  recovery: CONTRACT_FIGURES.METABOLIC_RECOVERY_VITALITY,
  vitalityCap: CONTRACT_FIGURES.VITALITY_CAP,
  vitalityMax: VITALITY_MAX,
  distressMax: DISTRESS_MAX_EFFECTIVE_VITALITY,
  distressPct: vitalityPct(DISTRESS_MAX_EFFECTIVE_VITALITY),
  hypoMk: HYPOTHERMIA_THRESHOLD_MK,
  feverMk: FEVER_THRESHOLD_MK,
  bmrExtractor: CONTRACT_FIGURES.BMR_EXTRACTOR_PER_HOUR,
  bmrFermenter: CONTRACT_FIGURES.BMR_FERMENTER_PER_HOUR,
  bmrSynthesizer: CONTRACT_FIGURES.BMR_SYNTHESIZER_PER_HOUR,
  hoursEmpty: CONTRACT_FIGURES.INITIAL_VITALITY / CONTRACT_FIGURES.BMR_EXTRACTOR_PER_HOUR,
  organelPct: bpsToPct(CONTRACT_FIGURES.ORGANEL_BPS_PER_LEVEL),
  maxOrganelLevel: CONTRACT_FIGURES.MAX_ORGANEL_LEVEL,
  rebatePct: bpsToPct(CONTRACT_FIGURES.REBATE_BPS),
  feverBurnPct: bpsToPct(CONTRACT_FIGURES.FEVER_BURN_BPS),
  adoptPremiumPct: bpsToPct(CONTRACT_FIGURES.HOSTILE_PREMIUM_BPS),
  adoptSellerPct: bpsToPct(CONTRACT_FIGURES.HOSTILE_SELLER_BPS),
  adoptTreasuryPct: bpsToPct(CONTRACT_FIGURES.HOSTILE_TREASURY_BPS),
  bountyPct: bpsToPct(CONTRACT_FIGURES.LIQUIDATOR_BOUNTY_BPS),
  pantryPct: bpsToPct(10000 - CONTRACT_FIGURES.LIQUIDATOR_BOUNTY_BPS),
  mergerPct: bpsToPct(CONTRACT_FIGURES.MERGER_TAX_BPS),
  dividendPct: bpsToPct(CONTRACT_FIGURES.DIVIDEND_INFLOW_BPS),
  epochHours: CONTRACT_FIGURES.EPOCH_DURATION_SEC / 3600,
  claimEpochs: CONTRACT_FIGURES.MAX_DIVIDEND_CLAIM_EPOCHS,
  baseBurstPct: bpsToPct(BASE_BURST_BPS),
  maxBurstPct: bpsToPct(MAX_BURST_BPS),
  stakeDefault: DEFAULT_STAKE_NEAR,
  stakeMin: MIN_STAKE_NEAR,
  stakeMax: MAX_STAKE_NEAR,
  stakePantryPct: bpsToPct(CONTRACT_FIGURES.STAKE_TREASURY_BPS),
  lowNear: near(LOW_NEAR_YOCTO),
  storageNear: near(STORAGE_MIN_FALLBACK_YOCTO),
  tgas: Number(BigInt(GAS.feed_strain) / 10n ** 12n),
  feedDefault: DEFAULT_FEED_SNACC,
  rescuePct: bpsToPct(CONTRACT_FIGURES.RESCUE_MIN_FEE_BPS),
};

/** Looks a key up whose last segments come from a data record (`help.rules.<id>.title`). */
const say = (locale: Locale, key: string) => t(locale, key as MessageKey, FIGURES);

/**
 * Record ids that are not their own dictionary key: the fee-sharing entries use `sharePool`, so the
 * Indonesian dictionary (which the honesty guard scans word by word) never needs the English term as a key.
 */
const DICT_KEY: Readonly<Record<string, string>> = { dividends: "sharePool", dividend: "sharePool" };
const dk = (id: string) => DICT_KEY[id] ?? id;

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

const INTRO_SPEC: readonly { id: string; icon: IconName }[] = [
  { id: "what", icon: "cell" },
  { id: "modes", icon: "chain" },
  { id: "hatch", icon: "spark" },
  { id: "feed", icon: "warn" },
];

export function introSteps(locale: Locale): IntroStep[] {
  return INTRO_SPEC.map(({ id, icon }) => {
    const at = (field: string) => say(locale, `onboarding.steps.${id}.${field}`);
    return { id, icon, topic: at("topic"), title: at("title"), body: at("body"), points: [at("p1"), at("p2"), at("p3")] };
  });
}

export const INTRO_STEPS: readonly IntroStep[] = introSteps("en");

// ------------------------------------------------------------------ rules

export interface RuleBlock {
  id: string;
  title: string;
  body: string;
}

const RULE_IDS = ["loop", "hatch", "feed", "decay", "risk", "zones", "modes"] as const;

export function rules(locale: Locale): RuleBlock[] {
  return RULE_IDS.map((id) => ({ id, title: say(locale, `help.rules.${id}.title`), body: say(locale, `help.rules.${id}.body`) }));
}

export const RULES: readonly RuleBlock[] = rules("en");

// ------------------------------------------------------------------ glossary

export interface GlossaryEntry {
  id: string;
  term: string;
  body: string;
}

const GLOSSARY_IDS = [
  "snacc",
  "vitality",
  "effective-vitality",
  "bmr",
  "atp",
  "organelles",
  "zones",
  "distressed",
  "starving",
  "adopt",
  "snack",
  "pantry",
  "dividends",
  "epoch",
  "burst",
  "profile",
  "achievements",
] as const;

export function glossary(locale: Locale): GlossaryEntry[] {
  return GLOSSARY_IDS.map((id) => ({ id, term: say(locale, `help.glossary.${dk(id)}.term`), body: say(locale, `help.glossary.${dk(id)}.body`) }));
}

export const GLOSSARY: readonly GlossaryEntry[] = glossary("en");

// ------------------------------------------------------------------ what things cost

export interface CostRow {
  id: string;
  item: string;
  value: string;
  note: string;
  /** File and constant (or function) that defines the value. Code, not translated. */
  source: string;
}

/** Row ids with the file and constant that define each value. */
const COST_SOURCES: readonly (readonly [string, string])[] = [
  ["stake", `${ACTIONS_TS} DEFAULT_STAKE_NEAR, MIN_STAKE_NEAR, MAX_STAKE_NEAR`],
  ["stake-split", `${STATE_RS} STAKE_TREASURY_BPS; ${LIB_RS} incubate_strain`],
  ["low-near", `${ACTIONS_TS} LOW_NEAR_YOCTO`],
  ["storage", `${ACTIONS_TS} STORAGE_MIN_FALLBACK_YOCTO; ${STATE_RS} STORAGE_DEPOSIT_MILLINEAR`],
  ["gas", `${ACTIONS_TS} GAS`],
  ["feed", `${ACTIONS_TS} DEFAULT_FEED_SNACC; ${LIB_RS} recover_metabolism; ${STATE_RS} METABOLIC_RECOVERY_VITALITY`],
  ["rescue", `${STATE_RS} RESCUE_MIN_FEE_BPS; ${LIB_RS} feed_strain`],
  ["hunger", `${STATE_RS} BMR_EXTRACTOR_PER_HOUR, BMR_FERMENTER_PER_HOUR, BMR_SYNTHESIZER_PER_HOUR, INITIAL_VITALITY`],
  ["thermostat", `${STATE_RS} FEVER_BURN_BPS, REBATE_BPS; frontend/src/config/zones.ts`],
  ["snack", `${STATE_RS} LIQUIDATOR_BOUNTY_BPS; ${LIB_RS} harvest_starving_strain`],
  ["adopt", `${STATE_RS} HOSTILE_PREMIUM_BPS, HOSTILE_SELLER_BPS, HOSTILE_TREASURY_BPS; ${LIB_RS} hostile_takeover_splice`],
  ["merge", `${STATE_RS} MERGER_TAX_BPS`],
  ["organel", `${LIB_RS} allocate_atp; ${STATE_RS} MAX_ORGANEL_LEVEL`],
  ["dividend", `${STATE_RS} DIVIDEND_INFLOW_BPS, MAX_DIVIDEND_CLAIM_EPOCHS; ${LIB_RS} claim_industrial_dividend`],
];

export function costs(locale: Locale): CostRow[] {
  return COST_SOURCES.map(([id, source]) => ({
    id,
    item: say(locale, `help.rows.${dk(id)}.item`),
    value: say(locale, `help.rows.${dk(id)}.value`),
    note: say(locale, `help.rows.${dk(id)}.note`),
    source,
  }));
}

export const COSTS: readonly CostRow[] = costs("en");
