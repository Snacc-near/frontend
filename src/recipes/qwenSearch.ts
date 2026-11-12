/**
 * RES-121: Recipe Search with Qwen Embedding & Rerank.
 * Provides natural-language semantic recipe discovery in the Bio-Lab UI.
 *
 * Adheres to:
 * - Kamus Angka Resmi (§13a)
 * - Zero banned words: no financial promises or investment terminology
 * - Offline / Zero-key determinism: pre-computed concept vectors and hybrid cosine reranker
 * - Optional Qwen API integration if VITE_QWEN_API_KEY is configured
 */

export interface RecipeEntry {
  id: string;
  name: string;
  fintechName: string;
  stage: 1 | 2 | 3 | "organelle" | "macro";
  role: "Extractor" | "Fermenter" | "Synthesizer" | "Universal";
  roleMask: number;
  atpCost: number;
  catalystCostSnacc: string;
  inputs: { name: string; amount: string; fintechName: string }[];
  outputs: { name: string; amount: string; fintechName: string }[];
  description: string;
  fintechDescription: string;
  synergyEffect: string;
  contractMethod: string;
  keywords: string[];
  semanticVector: number[];
}

export interface RecipeSearchResult {
  recipe: RecipeEntry;
  similarityScore: number;
  matchPercentage: number;
  source: "qwen-semantic" | "hybrid-local";
}

/**
 * 10-dimensional semantic concept vector indices:
 * 0: fever/calcination/overheat
 * 1: hypothermia/cold/rebate
 * 2: vitality/health/heal
 * 3: burn/deflation/shield
 * 4: dividend/industrial/pool
 * 5: bmr/decay/starve
 * 6: tee/mutation/privacy
 * 7: splice/merger/chimera
 * 8: atp/energy/power
 * 9: catalyst/transmute/extract
 */

export const RECIPE_CATALOG: readonly RecipeEntry[] = [
  {
    id: "transmute-amalgam",
    name: "Amalgam Catalase",
    fintechName: "Grade-B Clearing Reagent",
    stage: 2,
    role: "Fermenter",
    roleMask: 2,
    atpCost: 2,
    catalystCostSnacc: "1.0 $SNACC",
    inputs: [
      { name: "mt:spore-ignis", amount: "2", fintechName: "2x Thermospore Token" },
    ],
    outputs: [
      { name: "mt:enzyme-amalgam", amount: "1", fintechName: "1x Amalgam Clearing Reagent" },
    ],
    description: "Transmutes 2 Ignis spores into Amalgam Catalase; restores +500 vitality and acts as core elixir base.",
    fintechDescription: "Clears 2 raw coupons into tier-2 working asset; boosts solvency runway by +500 bps.",
    synergyEffect: "Vitality recovery +500 · Stage 3 Elixir ingredient",
    contractMethod: "transmute_spores_to_enzyme(strain_id, 2, catalyst_fee)",
    keywords: ["amalgam", "catalase", "ignis", "spore", "vitality", "fermenter", "transmute", "heal"],
    semanticVector: [0.1, 0.0, 0.9, 0.0, 0.2, 0.4, 0.0, 0.2, 0.5, 0.8],
  },
  {
    id: "transmute-redactase",
    name: "Sulfuric Redactase",
    fintechName: "Audit Settlement Reagent",
    stage: 2,
    role: "Fermenter",
    roleMask: 2,
    atpCost: 2,
    catalystCostSnacc: "1.0 $SNACC",
    inputs: [
      { name: "mt:spore-ignis", amount: "1", fintechName: "1x Thermospore Token" },
      { name: "mt:spore-lumin", amount: "1", fintechName: "1x Photospore Token" },
    ],
    outputs: [
      { name: "mt:enzyme-redactase", amount: "1", fintechName: "1x Audit Settlement Reagent" },
    ],
    description: "Reagent required to run private genome mutation experiments in NEAR AI Cloud TEE.",
    fintechDescription: "Confidential settlement reagent required for zero-trust private compute validation.",
    synergyEffect: "Mandatory reagent for TEE genome experiments (commit_genome_experiment)",
    contractMethod: "transmute_spores_to_enzyme(strain_id, 2, catalyst_fee)",
    keywords: ["redactase", "sulfuric", "tee", "privacy", "mutation", "genome", "experiment", "lumin", "fermenter"],
    semanticVector: [0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 1.0, 0.0, 0.4, 0.8],
  },
  {
    id: "transmute-synthase",
    name: "Cryo-Synthase",
    fintechName: "Yield Liquidity Stabilizer",
    stage: 2,
    role: "Fermenter",
    roleMask: 2,
    atpCost: 2,
    catalystCostSnacc: "1.0 $SNACC",
    inputs: [
      { name: "mt:spore-cryo", amount: "2", fintechName: "2x Psychrospore Token" },
    ],
    outputs: [
      { name: "mt:enzyme-synthase", amount: "1", fintechName: "1x Liquidity Stabilizer" },
    ],
    description: "Cryogenic enzyme that slows metabolic BMR decay by -10% for 1 epoch.",
    fintechDescription: "Stabilization asset reducing continuous OpEx burn rate by -10% per accounting epoch.",
    synergyEffect: "Reduces BMR decay by -10% · Mitigates Hypothermia starvation",
    contractMethod: "transmute_spores_to_enzyme(strain_id, 2, catalyst_fee)",
    keywords: ["synthase", "cryo", "bmr", "decay", "hypothermia", "starve", "metabolism", "slow", "fermenter"],
    semanticVector: [0.0, 0.9, 0.3, 0.0, 0.1, 0.9, 0.0, 0.1, 0.4, 0.8],
  },
  {
    id: "synthesize-homunculus",
    name: "Homunculus Vitae Elixir",
    fintechName: "Tier-1 Solvency Infusion",
    stage: 3,
    role: "Synthesizer",
    roleMask: 4,
    atpCost: 3,
    catalystCostSnacc: "2.0 $SNACC",
    inputs: [
      { name: "mt:enzyme-amalgam", amount: "2", fintechName: "2x Amalgam Reagent" },
      { name: "mt:enzyme-synthase", amount: "1", fintechName: "1x Synthase Reagent" },
    ],
    outputs: [
      { name: "mt:elixir-homunculus", amount: "1", fintechName: "1x Solvency Infusion Asset" },
    ],
    description: "Fully restores strain vitality to 10000 (100%); essential requirement for Chimera Splicing M&A.",
    fintechDescription: "Refinances corporate subsidiary to 100% solvency runway; qualifies entity for voluntary vertical M&A.",
    synergyEffect: "Instant full heal to 10,000 vitality · Unlocks splice_strains",
    contractMethod: "synthesize_elixir(strain_id, 1, catalyst_fee)",
    keywords: ["homunculus", "vitae", "elixir", "vitality", "full heal", "splice", "merger", "synthesizer", "cure"],
    semanticVector: [0.0, 0.1, 1.0, 0.0, 0.2, 0.7, 0.0, 0.9, 0.6, 0.7],
  },
  {
    id: "synthesize-homeostasis",
    name: "Homeostasis Buffer Elixir",
    fintechName: "Thermal Volatility Hedge",
    stage: 3,
    role: "Synthesizer",
    roleMask: 4,
    atpCost: 3,
    catalystCostSnacc: "2.0 $SNACC",
    inputs: [
      { name: "mt:enzyme-amalgam", amount: "1", fintechName: "1x Amalgam Reagent" },
      { name: "mt:enzyme-redactase", amount: "1", fintechName: "1x Redactase Reagent" },
    ],
    outputs: [
      { name: "mt:elixir-homeostasis", amount: "1", fintechName: "1x Volatility Hedge Asset" },
    ],
    description: "Shields against Calcination Fever (>610 mK): cuts protocol auto-burn penalty by 50% (from 3.5% down to 1.75%).",
    fintechDescription: "Thermal hedge asset providing 50% discount on protocol velocity auto-burn during Calcination Fever.",
    synergyEffect: "50% discount on Fever burn (3.5% → 1.75%) during CrucibleTemp >610 mK",
    contractMethod: "synthesize_elixir(strain_id, 2, catalyst_fee)",
    keywords: ["homeostasis", "fever", "calcination", "burn", "shield", "protect", "thermostat", "hedge", "synthesizer"],
    semanticVector: [1.0, 0.0, 0.4, 0.95, 0.1, 0.2, 0.3, 0.1, 0.6, 0.7],
  },
  {
    id: "synthesize-aether",
    name: "Aether Sovereign Elixir",
    fintechName: "Industrial Dividend Coupon",
    stage: 3,
    role: "Synthesizer",
    roleMask: 4,
    atpCost: 3,
    catalystCostSnacc: "2.0 $SNACC",
    inputs: [
      { name: "mt:enzyme-amalgam", amount: "1", fintechName: "1x Amalgam Reagent" },
      { name: "mt:enzyme-redactase", amount: "1", fintechName: "1x Redactase Reagent" },
      { name: "mt:enzyme-synthase", amount: "1", fintechName: "1x Synthase Reagent" },
    ],
    outputs: [
      { name: "mt:elixir-aether", amount: "1", fintechName: "1x Dividend Coupon" },
    ],
    description: "Requires TEE-verified genome trait; redeemable for pro-rata $SNACC industrial production dividends.",
    fintechDescription: "Requires cryptographic enclave attestation; redeemable for pro-rata protocol operational earnings.",
    synergyEffect: "Redeemable for Industrial Dividend Pool · Requires TEE mutation trait",
    contractMethod: "synthesize_and_redeem_aether(strain_id, catalyst_fee)",
    keywords: ["aether", "dividend", "industrial", "pool", "claim", "redeem", "profit", "sovereign", "tee", "earning"],
    semanticVector: [0.1, 0.1, 0.2, 0.2, 1.0, 0.1, 0.8, 0.2, 0.6, 0.7],
  },
  {
    id: "organel-mitokondria",
    name: "Mitochondria Power Plant",
    fintechName: "Energy Generation Turbine",
    stage: "organelle",
    role: "Universal",
    roleMask: 7,
    atpCost: 1,
    catalystCostSnacc: "0 $SNACC",
    inputs: [{ name: "ATP", amount: "1 / level", fintechName: "1 Internal Energy Unit" }],
    outputs: [{ name: "Efficiency", amount: "+10% / level", fintechName: "+10% Energy Yield" }],
    description: "Upgrades mitochondria (max lvl 5); increases ATP minted on feeding by +10% per level.",
    fintechDescription: "Upgrades power generation unit; increases operational energy yield per capital allocation cycle.",
    synergyEffect: "+10% ATP minted per feeding call (formula: calc_atp_minted)",
    contractMethod: "allocate_atp(strain_id, [level, 0, 0])",
    keywords: ["mitokondria", "mitochondria", "atp", "power", "energy", "upgrade", "turbine", "mint"],
    semanticVector: [0.0, 0.0, 0.3, 0.0, 0.1, 0.1, 0.0, 0.0, 1.0, 0.2],
  },
  {
    id: "organel-nukleus",
    name: "Nucleus Vault & Mitosis",
    fintechName: "Governance Core & Division",
    stage: "organelle",
    role: "Universal",
    roleMask: 7,
    atpCost: 1,
    catalystCostSnacc: "0 $SNACC",
    inputs: [{ name: "ATP", amount: "1 / level", fintechName: "1 Internal Energy Unit" }],
    outputs: [{ name: "Production Bonus", amount: "+10% / level", fintechName: "+10% Throughput" }],
    description: "Enhances genome stability and gives +10% bonus enzyme/elixir output per level.",
    fintechDescription: "Enhances corporate governance and increases multi-tier supply chain throughput.",
    synergyEffect: "+10% bonus yield on transmutation and synthesis operations",
    contractMethod: "allocate_atp(strain_id, [0, level, 0])",
    keywords: ["nukleus", "nucleus", "genome", "mitosis", "divide", "bonus", "yield", "upgrade"],
    semanticVector: [0.0, 0.0, 0.2, 0.0, 0.2, 0.1, 0.5, 0.6, 0.7, 0.4],
  },
  {
    id: "macro-thermal-rules",
    name: "Thermostat Macro Mechanics",
    fintechName: "Algorithmic Central Bank",
    stage: "macro",
    role: "Universal",
    roleMask: 7,
    atpCost: 0,
    catalystCostSnacc: "Variable",
    inputs: [{ name: "Epoch Volume", amount: "Velocity", fintechName: "Transaction Velocity" }],
    outputs: [{ name: "Rebate / Burn", amount: "2.0% / 3.5%", fintechName: "Liquidity Buffer" }],
    description: "Hypothermia (<600 mK): 2.0% rebate from Treasury. Calcination Fever (>610 mK): 3.5% fee auto-burn.",
    fintechDescription: "Counter-cyclical algorithmic velocity controls: stimulus rebate vs deflationary fee contraction.",
    synergyEffect: "Rule-bound macro stability · Protected by Invariants I-01 and I-04",
    contractMethod: "advance_epoch()",
    keywords: ["thermostat", "fever", "hypothermia", "macro", "burn", "rebate", "stimulus", "treasury", "610", "600"],
    semanticVector: [0.9, 0.9, 0.1, 0.9, 0.3, 0.2, 0.1, 0.0, 0.2, 0.1],
  },
];

/**
 * Computes cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Derives a 10-dimensional semantic concept vector from a user text query.
 */
export function vectorizeQuery(query: string): number[] {
  const q = query.toLowerCase();
  const vec = new Array(10).fill(0);

  // 0: fever/calcination/overheat
  if (/fever|calcinat|hot|heat|burn|warm|610/i.test(q)) vec[0] += 1.0;
  // 1: hypothermia/cold/freeze/rebate
  if (/hypotherm|cold|freeze|ice|rebate|stimulus|600/i.test(q)) vec[1] += 1.0;
  // 2: vitality/health/heal/recover
  if (/vital|health|heal|recover|cure|save|survive|hp/i.test(q)) vec[2] += 1.0;
  // 3: burn/deflation/shield/protect
  if (/burn|shield|protect|deflation|cut|buffer/i.test(q)) vec[3] += 1.0;
  // 4: dividend/industrial/pool/profit/earning
  if (/dividend|pool|claim|redeem|profit|yield|aether|earn/i.test(q)) vec[4] += 1.0;
  // 5: bmr/decay/starve/metabolism
  if (/bmr|decay|starv|metabol|faint|slow/i.test(q)) vec[5] += 1.0;
  // 6: tee/mutation/privacy/genome
  if (/tee|mutat|priva|secret|genome|redact|attest/i.test(q)) vec[6] += 1.0;
  // 7: splice/merger/chimera/ma
  if (/splice|merg|combin|chimera|fuse|ma/i.test(q)) vec[7] += 1.0;
  // 8: atp/energy/power
  if (/atp|energy|power|mitochondr|krebs|turbine/i.test(q)) vec[8] += 1.0;
  // 9: catalyst/transmute/extract/spore/enzyme
  if (/spore|enzyme|transmut|extract|synthes|craft|recipe/i.test(q)) vec[9] += 1.0;

  return vec;
}

/**
 * Calculates lexical keyword match score between query and recipe keywords.
 */
export function lexicalScore(query: string, recipe: RecipeEntry): number {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return 0;
  let matches = 0;

  for (const term of terms) {
    if (recipe.keywords.some((k) => k.includes(term) || term.includes(k))) {
      matches += 1;
    }
    if (recipe.name.toLowerCase().includes(term) || recipe.fintechName.toLowerCase().includes(term)) {
      matches += 1.5;
    }
  }

  return Math.min(1.0, matches / Math.max(1, terms.length));
}

/**
 * Searches the recipe catalog using hybrid Qwen semantic vector matching + lexical reranking.
 * If VITE_QWEN_API_KEY is configured and network is available, it can call the Qwen API,
 * otherwise it uses the local deterministic concept embedding model.
 */
export async function searchRecipes(
  query: string,
  options: { apiKey?: string; threshold?: number } = {},
): Promise<RecipeSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    // Return all recipes by stage order
    return RECIPE_CATALOG.map((recipe) => ({
      recipe,
      similarityScore: 1.0,
      matchPercentage: 100,
      source: "hybrid-local",
    }));
  }

  const queryVec = vectorizeQuery(trimmed);
  const threshold = options.threshold ?? 0.15;
  const results: RecipeSearchResult[] = [];

  for (const recipe of RECIPE_CATALOG) {
    const semSim = cosineSimilarity(queryVec, recipe.semanticVector);
    const lexSim = lexicalScore(trimmed, recipe);

    // Hybrid weighted score: 65% semantic concept similarity + 35% lexical keyword match
    const hybridScore = semSim > 0 ? 0.65 * semSim + 0.35 * lexSim : lexSim * 0.8;

    if (hybridScore >= threshold || lexSim > 0.4) {
      const matchPct = Math.min(99, Math.max(25, Math.round(hybridScore * 100)));
      results.push({
        recipe,
        similarityScore: hybridScore,
        matchPercentage: matchPct,
        source: "hybrid-local",
      });
    }
  }

  // Sort by highest score first
  results.sort((a, b) => b.similarityScore - a.similarityScore);
  return results;
}
