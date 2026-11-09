/**
 * Local demo simulation for the colony production loop.
 * Pure functions with no React or network dependency so they stay testable.
 * Every number comes from the official constants in `src/types.ts` (OFFICIAL_CONSTANTS)
 * and the zone thresholds in `src/config/zones.ts`. Demo output is simulated
 * and must never be presented as on-chain data.
 */

export type LabAction =
  | "feed"
  | "atp"
  | "extract"
  | "transmute"
  | "synthesize"
  | "nucleus"
  | "lysosome"
  | "divide"
  | "lysis"
  | "splice"
  | "vacuole"
  | "attest";

export type DockAction = LabAction | "harvest";

export type ProductionKind = "atp" | "spores" | "enzymes" | "elixir";

export interface OrganelleLevels {
  mitokondria: number;
  nukleus: number;
  lisosom: number;
}

export interface ProductionItem {
  id: string;
  kind: ProductionKind;
  durationSec: number;
  remainingSec: number;
  ready: boolean;
  amount: number;
}

export interface SimulationState {
  snacc: number;
  atp: number;
  spores: number;
  enzymes: number;
  elixir: number;
  vitality: number;
  atpBalance: number;
  organel: OrganelleLevels;
  births: number;
  merges: number;
  lyses: number;
  generation: number;
  crucibleTempMk: number;
  queue: ProductionItem[];
  log: string[];
  totalIn: number;
  totalOut: number;
}

export const VITALITY_MAX = 10000;
export const VITALITY_INITIAL = 8500;
export const MAX_ORGANELLE_LEVEL = 5;

// Official constants mirrored from the number dictionary (src/types.ts).
export const SIM_CONSTANTS = {
  FEVER_BURN_BPS: 350,
  HYPO_REBATE_BPS: 200,
  BASE_BURST_BPS: 200,
  MAX_BURST_BPS: 2000,
  ORGANELLE_BONUS_BPS_PER_LEVEL: 1000,
} as const;

// Demo production timing in seconds. Short on purpose for the demo loop.
export const PRODUCTION_SECONDS: Record<ProductionKind, number> = {
  atp: 6,
  spores: 8,
  enzymes: 10,
  elixir: 14,
};

export const PRODUCTION_COST: Partial<Record<ProductionKind, Partial<Record<"atp" | "spores" | "enzymes", number>>>> = {
  enzymes: { spores: 3 },
  elixir: { enzymes: 2 },
};

export interface ProductionReward {
  baseAmount: number;
  output: string;
}

const baseReward = (kind: ProductionKind): ProductionReward => {
  switch (kind) {
    case "atp":
      return { baseAmount: 25, output: "atp" };
    case "spores":
      return { baseAmount: 6, output: "spores" };
    case "enzymes":
      return { baseAmount: 4, output: "enzymes" };
    case "elixir":
      return { baseAmount: 2, output: "elixir" };
  }
};

// Nucleus level raises all output, mitochondria raises ATP, lysosome lowers hunger.
// One organelle step is +10% output (1000 bps) per the official dictionary.
export function outputMultiplier(organel: OrganelleLevels, kind: ProductionKind): number {
  const nucleusBonus = 1 + (organel.nukleus * SIM_CONSTANTS.ORGANELLE_BONUS_BPS_PER_LEVEL) / 10000;
  if (kind === "atp") {
    const mitoBonus = 1 + (organel.mitokondria * SIM_CONSTANTS.ORGANELLE_BONUS_BPS_PER_LEVEL) / 10000;
    return mitoBonus * nucleusBonus;
  }
  return nucleusBonus;
}

export function costAtLevel(level: number): number {
  return 40 * (level + 1);
}

export function hungerRate(bmr: number, lisosomLevel: number): number {
  const reduction = 1 - (lisosomLevel * 10) / 100;
  return Math.max(0, Math.round(bmr * reduction * 10) / 10);
}

export function createInitialSimulation(): SimulationState {
  return {
    snacc: 2500,
    atp: 50,
    spores: 4,
    enzymes: 2,
    elixir: 1,
    vitality: VITALITY_INITIAL,
    atpBalance: 50,
    organel: { mitokondria: 2, nukleus: 1, lisosom: 1 },
    births: 0,
    merges: 0,
    lyses: 0,
    generation: 1,
    crucibleTempMk: 605,
    queue: [],
    log: ["demo · simulated: colony seeded at 600..610 mk balance band"],
    totalIn: 0,
    totalOut: 0,
  };
}

function pushLog(state: SimulationState, message: string): void {
  state.log = [message, ...state.log.slice(0, 7)];
}

let itemSeq = 1;

export function startProduction(
  state: SimulationState,
  kind: ProductionKind,
): { state: SimulationState; ok: boolean; error: string | null } {
  const next: SimulationState = { ...state, queue: [...state.queue], log: [...state.log] };
  const costs = PRODUCTION_COST[kind];
  if (costs?.spores && next.spores < costs.spores) {
    return { state: next, ok: false, error: `need ${costs.spores} spores, have ${next.spores}` };
  }
  if (costs?.enzymes && next.enzymes < costs.enzymes) {
    return { state: next, ok: false, error: `need ${costs.enzymes} enzymes, have ${next.enzymes}` };
  }
  if (costs?.spores) next.spores -= costs.spores;
  if (costs?.enzymes) next.enzymes -= costs.enzymes;
  next.totalIn += (costs?.spores ?? 0) + (costs?.enzymes ?? 0) + 0;

  const amount = Math.round(baseReward(kind).baseAmount * outputMultiplier(next.organel, kind));
  const item: ProductionItem = {
    id: `item-${itemSeq++}-${Date.now()}`,
    kind,
    durationSec: PRODUCTION_SECONDS[kind],
    remainingSec: PRODUCTION_SECONDS[kind],
    ready: false,
    amount,
  };
  next.queue = [...next.queue, item];
  pushLog(next, `started ${kind} production: +${amount} on collect`);
  return { state: next, ok: true, error: null };
}

export function tickSimulation(state: SimulationState, dtSec: number): SimulationState {
  if (dtSec <= 0) return state;
  const clamped = Math.min(dtSec, 60);
  const next: SimulationState = {
    ...state,
    queue: state.queue.map((item) => {
      if (item.ready) return item;
      const remaining = Math.max(0, item.remainingSec - clamped);
      return { ...item, remainingSec: remaining, ready: remaining === 0 };
    }),
    log: [...state.log],
  };
  return next;
}

export function collectProduction(
  state: SimulationState,
  id: string,
): { state: SimulationState; ok: boolean; error: string | null } {
  const item = state.queue.find((entry) => entry.id === id);
  if (!item) return { state, ok: false, error: "unknown item" };
  if (!item.ready) return { state, ok: false, error: "not ready yet" };
  const next: SimulationState = {
    ...state,
    queue: state.queue.filter((entry) => entry.id !== id),
    log: [...state.log],
  };
  if (item.kind === "atp") {
    next.atp += item.amount;
    next.atpBalance += item.amount;
  } else if (item.kind === "spores") {
    next.spores += item.amount;
  } else if (item.kind === "enzymes") {
    next.enzymes += item.amount;
  } else {
    next.elixir += item.amount;
  }
  next.totalOut += item.amount;
  pushLog(next, `collected +${item.amount} ${item.kind}`);
  return { state: next, ok: true, error: null };
}

export function feedStrain(
  state: SimulationState,
): { state: SimulationState; ok: boolean; error: string | null } {
  if (state.snacc < 10) return { state, ok: false, error: "need 10 snacc" };
  const next: SimulationState = {
    ...state,
    snacc: state.snacc - 10,
    atp: state.atp + 12,
    atpBalance: state.atpBalance + 12,
    vitality: Math.min(VITALITY_MAX, state.vitality + 220),
    crucibleTempMk: Math.min(680, state.crucibleTempMk + 2),
    totalIn: state.totalIn + 10,
    log: [...state.log],
  };
  pushLog(next, "fed strain: +12 atp, +220 vitality (demo · simulated)");
  return { state: next, ok: true, error: null };
}

export function upgradeOrganelle(
  state: SimulationState,
  slot: "mitokondria" | "nucleus" | "lysosome" | "nukleus" | "lisosom",
): { state: SimulationState; ok: boolean; error: string | null } {
  const axis = slot as string;
  const key: "mitokondria" | "nukleus" | "lisosom" =
    axis === "nucleus" ? "nukleus" : axis === "lysosome" ? "lisosom" : (axis as "mitokondria" | "nukleus" | "lisosom");
  const level = state.organel[key];
  if (level >= MAX_ORGANELLE_LEVEL) return { state, ok: false, error: `${key} already at max level ${MAX_ORGANELLE_LEVEL}` };
  const cost = costAtLevel(level);
  if (state.atp < cost) return { state, ok: false, error: `need ${cost} atp, have ${state.atp}` };
  const next: SimulationState = {
    ...state,
    atp: state.atp - cost,
    organel: { ...state.organel, [key]: level + 1 },
    log: [...state.log],
  };
  const note =
    key === "mitokondria"
      ? "+10% atp output"
      : key === "nukleus"
        ? "+10% output per level"
        : "-10% hunger per level";
  pushLog(next, `${key} upgraded to ${level + 1}: ${note}`);
  return { state: next, ok: true, error: null };
}

export function divideStrain(
  state: SimulationState,
): { state: SimulationState; ok: boolean; error: string | null } {
  if (state.births > state.merges + state.lyses) {
    return { state, ok: false, error: "divide gate: births must stay within merges + lyses" };
  }
  if (state.atp < 30) return { state, ok: false, error: "need 30 atp to divide" };
  const next: SimulationState = {
    ...state,
    atp: state.atp - 30,
    births: state.births + 1,
    generation: state.generation + 0,
    vitality: Math.max(1000, Math.round(state.vitality / 2)),
    log: [...state.log],
  };
  pushLog(next, "mitosis: cell split into two (demo · simulated)");
  return { state: next, ok: true, error: null };
}

export function harvestStrain(
  state: SimulationState,
): { state: SimulationState; ok: boolean; error: string | null } {
  const released = Math.round((state.vitality * SIM_CONSTANTS.BASE_BURST_BPS) / 10000);
  const next: SimulationState = {
    ...state,
    snacc: state.snacc + released,
    spores: state.spores + 3,
    vitality: VITALITY_INITIAL,
    lyses: state.lyses + 1,
    totalOut: state.totalOut + released,
    log: [...state.log],
  };
  pushLog(next, `lysis harvest: released ${released} nutrients (base burst 2.00%)`);
  return { state: next, ok: true, error: null };
}

export function spliceStrains(
  state: SimulationState,
): { state: SimulationState; ok: boolean; error: string | null } {
  if (state.atp < 20) return { state, ok: false, error: "need 20 atp to splice" };
  const next: SimulationState = {
    ...state,
    atp: state.atp - 20,
    merges: state.merges + 1,
    organel: {
      mitokondria: Math.min(MAX_ORGANELLE_LEVEL, state.organel.mitokondria + 1),
      nukleus: Math.min(MAX_ORGANELLE_LEVEL, state.organel.nukleus + 1),
      lisosom: Math.min(MAX_ORGANELLE_LEVEL, state.organel.lisosom + 1),
    },
    log: [...state.log],
  };
  pushLog(next, "splice: two strains merged (demo · simulated)");
  return { state: next, ok: true, error: null };
}

export function applyAction(
  state: SimulationState,
  action: LabAction | "harvest",
): { state: SimulationState; ok: boolean; error: string | null } {
  switch (action) {
    case "feed":
      return feedStrain(state);
    case "atp":
      return startProduction(state, "atp");
    case "extract":
      return startProduction(state, "spores");
    case "transmute":
      return startProduction(state, "enzymes");
    case "synthesize":
      return startProduction(state, "elixir");
    case "nucleus":
      return upgradeOrganelle(state, "nucleus");
    case "lysosome":
      return upgradeOrganelle(state, "lysosome");
    case "divide":
      return divideStrain(state);
    case "lysis":
    case "harvest":
      return harvestStrain(state);
    case "splice":
      return spliceStrains(state);
    case "vacuole": {
      // Demo only: the Cell Lab figure plays the vacuole pulse. No numbers move.
      const next: SimulationState = { ...state, log: [...state.log] };
      pushLog(next, "vacuole pulse played (demo · simulated)");
      return { state: next, ok: true, error: null };
    }
    case "attest": {
      // TEE verification preview. Changes no numbers, in demo and live alike.
      const next: SimulationState = { ...state, log: [...state.log] };
      pushLog(next, "attest: tee verification preview · no numbers changed");
      return { state: next, ok: true, error: null };
    }
  }
}
