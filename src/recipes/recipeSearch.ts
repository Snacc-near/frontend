/**
 * Local recipe search (keyword). No model and no network call: the query is split into words and
 * matched against each recipe's names, inputs, outputs, method and tags.
 *
 * Recipes, method names and argument names are copied from the `snacc-v001` contract source
 * (`snacc/src/lib.rs`); effects are listed only where the contract implements them.
 */

export type RecipeStage = "stage 1" | "stage 2" | "stage 3" | "organelle" | "feed" | "npc" | "rule";

export interface RecipeEntry {
  id: string;
  name: string;
  fintechName: string;
  stage: RecipeStage;
  /** Strain role the contract asserts, or "any". */
  role: "Extractor" | "Fermenter" | "Synthesizer" | "any";
  inputs: string[];
  outputs: string[];
  /** What the contract does with it; "no effect wired yet" when nothing reads the output. */
  effect: string;
  /** Contract method, or null for a rule that has no call of its own. */
  method: keyof typeof CONTRACT_SIGNATURES | null;
  /** Example JSON args; `<...>` marks a value the player fills in. */
  args: Record<string, string | number>;
  keywords: string[];
}

/** Change-method parameters, in order, as declared in the contract. */
export const CONTRACT_SIGNATURES = {
  extract_spores: ["strain_id", "spore_type", "snacc_catalyst_fee"],
  transmute_spores_to_enzyme: ["strain_id", "spores_to_burn", "snacc_catalyst_fee"],
  synthesize_elixir: ["strain_id", "elixir_type", "enzymes_to_burn", "snacc_catalyst_fee"],
  synthesize_and_redeem_aether: ["strain_id", "amount"],
  allocate_atp: ["strain_id", "mitokondria", "nukleus", "lisosom"],
  feed_strain: ["strain_id", "amount"],
  npc_buy_spores: ["strain_id", "npc_id", "buy_amount"],
  advance_epoch: [],
} as const satisfies Record<string, readonly string[]>;

const FEE = "<yocto $SNACC, 24 decimals>";

export const RECIPE_CATALOG: readonly RecipeEntry[] = [
  {
    id: "extract-spores",
    name: "Spore extraction",
    fintechName: "Coupon origination",
    stage: "stage 1",
    role: "Extractor",
    inputs: ["$SNACC catalyst fee"],
    outputs: ["1 spore: mt:spore-ignis, mt:spore-cryo or mt:spore-lumin"],
    effect: "Mints one spore per call. The catalyst fee goes through the thermostat: part is burned in Fever, rebated in Hypothermia.",
    method: "extract_spores",
    args: { strain_id: 1, spore_type: "mt:spore-ignis", snacc_catalyst_fee: FEE },
    keywords: ["extract", "spore", "spores", "ignis", "cryo", "lumin", "stage1", "fee", "catalyst", "extractor"],
  },
  {
    id: "transmute-amalgam",
    name: "Amalgam Catalase",
    fintechName: "Grade-B Clearing Reagent",
    stage: "stage 2",
    role: "Fermenter",
    inputs: ["N mt:spore-ignis (N even)", "$SNACC catalyst fee"],
    outputs: ["mt:enzyme-amalgam: N × efficiency, +10% per nucleus level"],
    effect: "Ingredient for all three elixirs. The contract picks the enzyme from inventory: N ignis gives amalgam first.",
    method: "transmute_spores_to_enzyme",
    args: { strain_id: 1, spores_to_burn: 2, snacc_catalyst_fee: FEE },
    keywords: ["amalgam", "catalase", "enzyme", "transmute", "ignis", "stage2", "fermenter"],
  },
  {
    id: "transmute-redactase",
    name: "Sulfuric Redactase",
    fintechName: "Audit Settlement Reagent",
    stage: "stage 2",
    role: "Fermenter",
    inputs: ["N/2 mt:spore-ignis + N/2 mt:spore-lumin", "$SNACC catalyst fee"],
    outputs: ["mt:enzyme-redactase: N × efficiency, +10% per nucleus level"],
    effect: "Ingredient for the homeostasis elixir. Made when the strain lacks N ignis but holds half ignis, half lumin.",
    method: "transmute_spores_to_enzyme",
    args: { strain_id: 1, spores_to_burn: 2, snacc_catalyst_fee: FEE },
    keywords: ["redactase", "sulfuric", "enzyme", "transmute", "lumin", "ignis", "stage2", "fermenter"],
  },
  {
    id: "transmute-synthase",
    name: "Cryo-Synthase",
    fintechName: "Liquidity Stabilizer Reagent",
    stage: "stage 2",
    role: "Fermenter",
    inputs: ["N mt:spore-cryo", "$SNACC catalyst fee"],
    outputs: ["mt:enzyme-synthase: N × efficiency, +10% per nucleus level"],
    effect: "Ingredient for the homunculus and aether elixirs. Made when neither of the two recipes above fits.",
    method: "transmute_spores_to_enzyme",
    args: { strain_id: 1, spores_to_burn: 2, snacc_catalyst_fee: FEE },
    keywords: ["synthase", "cryo", "enzyme", "transmute", "cold", "stage2", "fermenter"],
  },
  {
    id: "synthesize-homunculus",
    name: "Homunculus Vitae Elixir",
    fintechName: "Tier-1 Solvency Infusion",
    stage: "stage 3",
    role: "Synthesizer",
    inputs: ["2 mt:enzyme-amalgam + 1 mt:enzyme-synthase per batch", "$SNACC catalyst fee"],
    outputs: ["1 mt:elixir-homunculus per batch, +10% per nucleus level"],
    effect: "No effect wired yet: the contract mints it to inventory and no other method reads it.",
    method: "synthesize_elixir",
    args: { strain_id: 1, elixir_type: "mt:elixir-homunculus", enzymes_to_burn: 3, snacc_catalyst_fee: FEE },
    keywords: ["homunculus", "vitae", "elixir", "synthesize", "stage3", "synthesizer"],
  },
  {
    id: "synthesize-homeostasis",
    name: "Homeostasis Buffer Elixir",
    fintechName: "Thermal Volatility Hedge",
    stage: "stage 3",
    role: "Synthesizer",
    inputs: ["1 mt:enzyme-amalgam + 1 mt:enzyme-redactase per batch", "$SNACC catalyst fee"],
    outputs: ["1 mt:elixir-homeostasis per batch, +10% per nucleus level"],
    effect: "While the strain holds at least one, its Fever burn is halved (350 to 175 bps). Seen in the 2026-11-09 testnet rehearsal.",
    method: "synthesize_elixir",
    args: { strain_id: 1, elixir_type: "mt:elixir-homeostasis", enzymes_to_burn: 2, snacc_catalyst_fee: FEE },
    keywords: ["homeostasis", "buffer", "elixir", "fever", "burn", "shield", "hedge", "thermostat", "stage3", "synthesizer"],
  },
  {
    id: "synthesize-aether",
    name: "Aether Sovereign Elixir",
    fintechName: "Industrial Pool Claim Unit",
    stage: "stage 3",
    role: "Synthesizer",
    inputs: ["2 mt:enzyme-amalgam + 1 mt:enzyme-synthase per batch", "a TEE-applied phenotype trait on the strain", "$SNACC catalyst fee"],
    outputs: ["1 mt:elixir-aether per batch, +10% per nucleus level"],
    effect: "Only strains with a TEE-verified mutation can make it. Burn it with synthesize_and_redeem_aether.",
    method: "synthesize_elixir",
    args: { strain_id: 5, elixir_type: "mt:elixir-aether", enzymes_to_burn: 3, snacc_catalyst_fee: FEE },
    keywords: ["aether", "sovereign", "elixir", "tee", "mutation", "trait", "stage3", "synthesizer"],
  },
  {
    id: "redeem-aether",
    name: "Aether burn for the industrial pool",
    fintechName: "Industrial pool contribution",
    stage: "stage 3",
    role: "any",
    inputs: ["amount × mt:elixir-aether (at least 1)"],
    outputs: ["a contribution to this epoch's industrial pool"],
    effect: "Burns aether elixirs; after the epoch closes the strain can claim its pro-rata share of that epoch's pool. Testnet $SNACC has no monetary value.",
    method: "synthesize_and_redeem_aether",
    args: { strain_id: 5, amount: "1" },
    keywords: ["aether", "redeem", "burn", "pool", "industrial", "epoch", "claim"],
  },
  {
    id: "organelles",
    name: "Organelle upgrade",
    fintechName: "Capital allocation",
    stage: "organelle",
    role: "any",
    inputs: ["1 ATP per level raised, per slot (levels 0 to 5)"],
    outputs: ["mitokondria, nukleus and lisosom target levels"],
    effect: "Mitokondria: +10% ATP minted per feed per level. Nukleus: +10% enzyme and elixir output per level. Lisosom: -10% BMR per level.",
    method: "allocate_atp",
    args: { strain_id: 1, mitokondria: 1, nukleus: 1, lisosom: 1 },
    keywords: ["organelle", "allocate", "atp", "mitokondria", "mitochondria", "nukleus", "nucleus", "lisosom", "lysosome", "bmr", "upgrade", "level"],
  },
  {
    id: "feed",
    name: "Feed a strain",
    fintechName: "Fund a subsidiary",
    stage: "feed",
    role: "any",
    inputs: ["amount of $SNACC from the strain's balance"],
    outputs: ["ATP for the strain", "Great Feast volume for the epoch"],
    effect: "Mints ATP from the fee (more with mitokondria levels) and counts toward the epoch's Great Feast and its top-3 feeder board.",
    method: "feed_strain",
    args: { strain_id: 1, amount: "<yocto $SNACC, 24 decimals>" },
    keywords: ["feed", "atp", "energy", "feast", "leaderboard", "great", "vitality"],
  },
  {
    id: "npc-buy",
    name: "Buy spores from an NPC",
    fintechName: "Buy coupons from a market maker",
    stage: "npc",
    role: "any",
    inputs: ["total_cost_snacc from the strain's balance"],
    outputs: ["buy_amount × mt:spore-ignis"],
    effect: "Unit price = max(1, floor(P_base × S_target / max(S_after, 1))); it rises as the NPC's stock falls below target.",
    method: "npc_buy_spores",
    args: { strain_id: 1, npc_id: "npc-extractor", buy_amount: 10 },
    keywords: ["npc", "buy", "spores", "ignis", "alchemist", "market", "maker", "price", "pyre", "myco", "void"],
  },
  {
    id: "thermostat",
    name: "Thermostat rule",
    fintechName: "Velocity thermostat",
    stage: "rule",
    role: "any",
    inputs: ["the epoch's volume (CrucibleTemp, mK)"],
    outputs: ["a burn or a rebate on catalyst fees"],
    effect: "Fever above 610 mK burns 350 bps of each catalyst fee; Hypothermia below 600 mK rebates 200 bps; at most 500 bps of the pantry per epoch. advance_epoch closes an epoch after 24 h.",
    method: "advance_epoch",
    args: {},
    keywords: ["thermostat", "fever", "hypothermia", "rebate", "burn", "temperature", "crucible", "epoch", "zone", "goldilocks"],
  },
];

/** `method({json})` call template; values in `<...>` are filled in by the player. */
export function callTemplate(recipe: RecipeEntry): string | null {
  if (!recipe.method) return null;
  return `${recipe.method}(${JSON.stringify(recipe.args)})`;
}

export interface RecipeSearchResult {
  recipe: RecipeEntry;
  score: number;
  /** Share of query words that matched, 0–100. */
  matchPercentage: number;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9$]+/)
    .filter((w) => w.length >= 2);
}

function recipeWords(r: RecipeEntry): Set<string> {
  return new Set(
    tokenize([r.name, r.fintechName, r.stage, r.role, r.method ?? "", ...r.inputs, ...r.outputs, ...r.keywords].join(" ")),
  );
}

/**
 * Scores each recipe: an exact word match counts 3, a prefix match (query word of 3+ letters)
 * counts 1. Two-letter words must match exactly. An empty query lists every recipe.
 */
export function searchRecipes(query: string, catalog: readonly RecipeEntry[] = RECIPE_CATALOG): RecipeSearchResult[] {
  const q = [...new Set(tokenize(query))];
  if (q.length === 0) return catalog.map((recipe) => ({ recipe, score: 0, matchPercentage: 0 }));
  const out: RecipeSearchResult[] = [];
  for (const recipe of catalog) {
    const words = recipeWords(recipe);
    let score = 0;
    let matched = 0;
    for (const t of q) {
      if (words.has(t)) {
        score += 3;
        matched += 1;
      } else if (t.length >= 3 && [...words].some((w) => w.startsWith(t))) {
        score += 1;
        matched += 1;
      }
    }
    if (score > 0) out.push({ recipe, score, matchPercentage: Math.round((matched / q.length) * 100) });
  }
  return out.sort((a, b) => b.score - a.score);
}
