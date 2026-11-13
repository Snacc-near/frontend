/**
 * Pure builders for the state-changing calls the game sends through a NEAR wallet (UI-145/UI-146).
 *
 * Method names, argument names and the attached deposit per method mirror `sdk/src/client.ts`
 * (`SnaccClient`) and `contracts/snacc/src/lib.rs`; the SDK is not on npm, so only the pieces the
 * app needs are ported here. Deposit rules (from the SDK header):
 *   - `incubate_strain`  attached deposit == `initial_snacc_stake` (the stake comes from attached NEAR)
 *   - `feed_strain`      0 (the contract refunds any attached deposit)
 *   - `storage_deposit`  `storage_balance_bounds().min` for a new registration (NEP-145)
 * One deviation from the SDK, on purpose: `strain_id` is sent as a JSON number, because the
 * contract declares `StrainId = u64` (serde rejects a quoted u64) and the rehearsal script
 * (`scripts/gladi-run.mjs`) sends numbers too.
 *
 * No keys and no signing here: the wallet signs. Every amount is an integer string in yocto.
 */
import { CONTRACT_ID } from "../data/nearView.ts";

export { CONTRACT_ID };

/** 1 NEAR = 10^24 yoctoNEAR; `$SNACC` also has 24 decimals. */
export const YOCTO_PER_NEAR = 10n ** 24n;
/** 1 TGas = 10^12 gas. */
const TGAS = 10n ** 12n;

/** Prepaid gas per method. Unused gas is refunded by the protocol. */
export const GAS = {
  incubate_strain: (100n * TGAS).toString(),
  feed_strain: (100n * TGAS).toString(),
  storage_deposit: (30n * TGAS).toString(),
  allocate_atp: (50n * TGAS).toString(),
  divide_strain: (100n * TGAS).toString(),
  extract_spores: (100n * TGAS).toString(),
  transmute_spores_to_enzyme: (100n * TGAS).toString(),
  synthesize_elixir: (100n * TGAS).toString(),
  npc_buy_spores: (50n * TGAS).toString(),
  adopt: (150n * TGAS).toString(),
  harvest_starving_strain: (100n * TGAS).toString(),
  hostile_takeover_splice: (150n * TGAS).toString(),
  splice_strains: (150n * TGAS).toString(),
  claim_industrial_dividend: (50n * TGAS).toString(),
  synthesize_and_redeem_aether: (50n * TGAS).toString(),
  nft_transfer: (50n * TGAS).toString(),
  ft_transfer: (30n * TGAS).toString(),
} as const;

/** `StrainRole` in lib.rs (`state.rs`), serialised by name. */
export const STRAIN_ROLES = ["Extractor", "Fermenter", "Synthesizer"] as const;
export type StrainRole = (typeof STRAIN_ROLES)[number];

/** Genesis spores minted with a new strain; the value the testnet rehearsal used. */
export const DEFAULT_INITIAL_SPORES = 10;
/** Default hatch stake on testnet: 0.25 NEAR (the rehearsal stake for most strains). */
export const DEFAULT_STAKE_NEAR = "0.25";
export const STAKE_PRESETS_NEAR = ["0.1", "0.25", "0.5"] as const;
/** Sanity bounds for the stake input (testnet). */
export const MIN_STAKE_NEAR = "0.01";
export const MAX_STAKE_NEAR = "5";
/** Default feed: 0.05 $SNACC, burnt from the strain's own balance. */
export const DEFAULT_FEED_SNACC = "0.05";
/** Official NEAR testnet faucet page on docs.near.org (the old `/tools/faucet` path now returns 404). */
export const TESTNET_FAUCET_URL = "https://docs.near.org/getting-started/faucet";
/** Below this spendable balance one default hatch (0.25 NEAR stake + storage + gas) is out of reach. */
export const LOW_NEAR_YOCTO = (3n * 10n ** 23n).toString();
/** Fallback when `storage_balance_bounds` cannot be read: 5 milliNEAR (`STORAGE_DEPOSIT_MILLINEAR`). */
export const STORAGE_MIN_FALLBACK_YOCTO = (5n * 10n ** 21n).toString();

/** One `FunctionCall` on the Snacc contract, before it is turned into a wallet action. */
export interface ContractCall {
  methodName: string;
  args: Record<string, unknown>;
  /** Prepaid gas, integer string. */
  gas: string;
  /** Attached deposit in yoctoNEAR, integer string. */
  deposit: string;
}

/** The NEAR Connect `FunctionCall` action shape (`@hot-labs/near-connect` `ConnectorAction`). */
export interface FunctionCallAction {
  type: "FunctionCall";
  params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string };
}

const isUint = (s: string) => /^\d+$/.test(s);

function requireYocto(value: string, what: string): string {
  if (!isUint(value)) throw new Error(`${what} must be an integer amount in yocto`);
  return BigInt(value).toString();
}

/**
 * Parses a decimal amount ("0.25") into an integer string with `decimals` places. Returns null
 * for anything that is not a plain non-negative decimal or has more than `decimals` fraction digits.
 */
export function parseUnits(input: string, decimals = 24): string | null {
  const s = input.trim();
  const m = /^(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || s === "" || s === ".") return null;
  const whole = m[1] || "0";
  const frac = m[2] ?? "";
  if (frac.length > decimals) return null;
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0")).toString();
}

export const parseNear = (input: string) => parseUnits(input, 24);

/** Formats yocto (24 decimals) as a short decimal, e.g. `250000000000000000000000` → `0.25`. */
export function formatYocto(raw: string | bigint | null | undefined, maxFrac = 4): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  let v: bigint;
  try {
    v = BigInt(raw);
  } catch {
    return "—";
  }
  const whole = v / YOCTO_PER_NEAR;
  const frac = (v % YOCTO_PER_NEAR).toString().padStart(24, "0").slice(0, maxFrac).replace(/0+$/, "");
  if (whole === 0n && !frac && v > 0n) return `<0.${"0".repeat(Math.max(0, maxFrac - 1))}1`;
  return `${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
}

/** `incubate_strain(role, initial_snacc_stake, initial_spores)` with attached NEAR == stake. */
export function buildIncubate(input: { role: StrainRole; stakeYocto: string; initialSpores?: number }): ContractCall {
  const stake = requireYocto(input.stakeYocto, "stake");
  if (BigInt(stake) <= 0n) throw new Error("stake must be greater than zero");
  if (!STRAIN_ROLES.includes(input.role)) throw new Error(`unknown role ${String(input.role)}`);
  const spores = input.initialSpores ?? DEFAULT_INITIAL_SPORES;
  if (!Number.isSafeInteger(spores) || spores < 0) throw new Error("initial_spores must be a non-negative integer");
  return {
    methodName: "incubate_strain",
    args: { role: input.role, initial_snacc_stake: stake, initial_spores: spores },
    gas: GAS.incubate_strain,
    deposit: stake,
  };
}

/** `feed_strain(strain_id, amount)`: burns `amount` yocto-$SNACC from the strain; no deposit. */
export function buildFeed(input: { strainId: number; amountYocto: string }): ContractCall {
  if (!Number.isSafeInteger(input.strainId) || input.strainId < 0) throw new Error("strain_id must be a non-negative integer");
  const amount = requireYocto(input.amountYocto, "amount");
  if (BigInt(amount) <= 0n) throw new Error("amount must be greater than zero");
  return {
    methodName: "feed_strain",
    args: { strain_id: input.strainId, amount },
    gas: GAS.feed_strain,
    deposit: "0",
  };
}

/**
 * `storage_deposit(account_id, registration_only)` for a first registration. With
 * `registration_only: true` the contract keeps exactly `min` and refunds any excess (NEP-145).
 */
export function buildStorageDeposit(input: { accountId: string; minYocto: string }): ContractCall {
  const min = requireYocto(input.minYocto, "storage minimum");
  return {
    methodName: "storage_deposit",
    args: { account_id: input.accountId, registration_only: true },
    gas: GAS.storage_deposit,
    deposit: min,
  };
}

/** Prepends the storage registration when the account is not registered yet. */
export function withStorage(call: ContractCall, storage: { accountId: string; registered: boolean; minYocto: string }): ContractCall[] {
  return storage.registered ? [call] : [buildStorageDeposit({ accountId: storage.accountId, minYocto: storage.minYocto }), call];
}

export function toWalletActions(calls: ContractCall[]): FunctionCallAction[] {
  return calls.map((c) => ({ type: "FunctionCall", params: { methodName: c.methodName, args: c.args, gas: c.gas, deposit: c.deposit } }));
}

/** Sum of attached deposits (yocto) across the calls of one transaction. */
export function totalDeposit(calls: ContractCall[]): string {
  return calls.reduce((sum, c) => sum + BigInt(c.deposit), 0n).toString();
}

/** Upper bound of the gas fee (yocto) at the testnet minimum gas price of 10^8 yocto/gas. */
export function maxGasFeeYocto(calls: ContractCall[], gasPriceYocto = 100_000_000n): string {
  return (calls.reduce((sum, c) => sum + BigInt(c.gas), 0n) * gasPriceYocto).toString();
}

export type StakeCheck = { ok: true; yocto: string } | { ok: false; reason: string };

/** Validates the stake typed in the hatch form against the testnet bounds. */
export function checkStake(input: string): StakeCheck {
  const yocto = parseNear(input);
  if (yocto === null) return { ok: false, reason: "Enter an amount in NEAR, e.g. 0.25." };
  const min = BigInt(parseNear(MIN_STAKE_NEAR)!);
  const max = BigInt(parseNear(MAX_STAKE_NEAR)!);
  if (BigInt(yocto) < min) return { ok: false, reason: `The smallest stake here is ${MIN_STAKE_NEAR} NEAR.` };
  if (BigInt(yocto) > max) return { ok: false, reason: `Keep the stake at ${MAX_STAKE_NEAR} NEAR or less on testnet.` };
  return { ok: true, yocto };
}

// ======================================================================== UI-150: every player action
//
// Values below are copied from `contracts/snacc/src/state.rs` (`constants`) and the guards in
// `lib.rs`. The UI checks them before signing so the player sees the reason up front; the contract
// stays the authority and panics with the same `ERR_*` code when a read was stale.

/** `ROLE_EXTRACTOR` / `ROLE_FERMENTER` / `ROLE_SYNTHESIZER` bits of `role_mask`. */
export const ROLE_BITS: Record<StrainRole, number> = { Extractor: 0b001, Fermenter: 0b010, Synthesizer: 0b100 };
/** `MAX_ORGANEL_LEVEL`. */
export const MAX_ORGANEL_LEVEL = 5;
/** `MAX_COLONY_SIZE` (living strains per owner). */
export const MAX_COLONY_SIZE = 5;
/** `MAX_GENERATION`. */
export const MAX_GENERATION = 8;
/** ATP cost per action (`EN-116` / §13a in lib.rs). */
export const ATP_COST = { extract: 1, transmute: 2, synthesize: 3, divide: 3, conjugate: 2 } as const;
/** Distressed band of `effective_vitality` (Tier 2): adopt and hostile takeover open here. */
export const DISTRESSED_MIN = 1;
export const DISTRESSED_MAX = 2000;
/** `HOSTILE_PREMIUM_BPS`, `HOSTILE_SELLER_BPS`, `LIQUIDATOR_BOUNTY_BPS`, `MERGER_TAX_BPS`. */
export const HOSTILE_PREMIUM_BPS = 1500;
export const HOSTILE_SELLER_BPS = 9500;
export const LIQUIDATOR_BOUNTY_BPS = 1000;
export const MERGER_TAX_BPS = 250;
/** `MAX_DIVIDEND_CLAIM_EPOCHS`: a closed epoch can be claimed for this many epochs. */
export const MAX_DIVIDEND_CLAIM_EPOCHS = 8;
/** `DIET_FEVER_EXTRACTOR_BPS` / `DIET_FAMINE_SYNTHESIZER_BPS`: transmute fee discount. */
export const DIET_DISCOUNT_BPS = 2000;
/** `NUCLEUS_OUTPUT_BPS_PER_LEVEL`. */
const NUCLEUS_OUTPUT_BPS_PER_LEVEL = 1000n;
const BPS = 10000n;
/** 1 yoctoNEAR, the NEP-141 / NEP-171 transfer guard (`ERR_YOCTO_REQUIRED`). */
export const ONE_YOCTO = "1";
/** Default catalyst fee: 0.001 NEAR. The contract accepts any amount equal to the attached NEAR. */
export const DEFAULT_CATALYST_FEE_NEAR = "0.001";

/** `SPORE_TOKEN_IDS`, the enzymes and elixirs (`ALL_TOKEN_IDS` order). */
export const SPORE_TYPES = ["mt:spore-ignis", "mt:spore-cryo", "mt:spore-lumin"] as const;
export const ENZYME_TYPES = ["mt:enzyme-amalgam", "mt:enzyme-redactase", "mt:enzyme-synthase"] as const;
export const ELIXIR_TYPES = ["mt:elixir-homunculus", "mt:elixir-homeostasis", "mt:elixir-aether"] as const;
export const ALL_TOKEN_IDS = [...SPORE_TYPES, ...ENZYME_TYPES, ...ELIXIR_TYPES] as const;
export type SporeType = (typeof SPORE_TYPES)[number];
export type ElixirType = (typeof ELIXIR_TYPES)[number];
export type MoleculeId = (typeof ALL_TOKEN_IDS)[number];
export type Inventory = Partial<Record<MoleculeId, bigint>>;

/** NPC merchants created in `new()` (`npc_id`). */
export const NPC_IDS = ["npc-extractor", "npc-central-arb", "npc-vulture-ma"] as const;
export type NpcId = (typeof NPC_IDS)[number];

/** Synthesis recipe per batch: (enzyme a, per batch, enzyme b, per batch, enzymes per batch). */
export const ELIXIR_RECIPES: Record<ElixirType, { a: MoleculeId; perA: number; b: MoleculeId; perB: number; batch: number; needsTrait: boolean }> = {
  "mt:elixir-homunculus": { a: "mt:enzyme-amalgam", perA: 2, b: "mt:enzyme-synthase", perB: 1, batch: 3, needsTrait: false },
  "mt:elixir-homeostasis": { a: "mt:enzyme-amalgam", perA: 1, b: "mt:enzyme-redactase", perB: 1, batch: 2, needsTrait: false },
  "mt:elixir-aether": { a: "mt:enzyme-amalgam", perA: 2, b: "mt:enzyme-synthase", perB: 1, batch: 3, needsTrait: true },
};

export interface OrganelLevels {
  mitokondria: number;
  nukleus: number;
  lisosom: number;
}

const requireId = (v: number, what: string) => {
  if (!Number.isSafeInteger(v) || v < 0) throw new Error(`${what} must be a non-negative integer`);
  return v;
};

const call = (methodName: keyof typeof GAS, args: Record<string, unknown>, deposit = "0"): ContractCall => ({
  methodName,
  args,
  gas: GAS[methodName],
  deposit,
});

export const hasRole = (roleMask: number, role: StrainRole) => (roleMask & ROLE_BITS[role]) !== 0;
export const rolesOf = (roleMask: number): StrainRole[] => STRAIN_ROLES.filter((r) => hasRole(roleMask, r));

/** `allocate_atp(strain_id, mitokondria, nukleus, lisosom)`: sets the three levels; no deposit. */
export function buildAllocateAtp(input: { strainId: number } & OrganelLevels): ContractCall {
  const lv = (n: number, what: string) => {
    if (!Number.isInteger(n) || n < 0 || n > MAX_ORGANEL_LEVEL) throw new Error(`${what} must be 0..${MAX_ORGANEL_LEVEL}`);
    return n;
  };
  return call("allocate_atp", {
    strain_id: requireId(input.strainId, "strain_id"),
    mitokondria: lv(input.mitokondria, "mitokondria"),
    nukleus: lv(input.nukleus, "nukleus"),
    lisosom: lv(input.lisosom, "lisosom"),
  });
}

/** 1 ATP per level increase per slot; lowering a slot is free (lib.rs `allocate_atp`). */
export function allocationCost(current: OrganelLevels, target: OrganelLevels): number {
  const up = (a: number, b: number) => Math.max(0, b - a);
  return up(current.mitokondria, target.mitokondria) + up(current.nukleus, target.nukleus) + up(current.lisosom, target.lisosom);
}

export type Check = { ok: true } | { ok: false; reason: string };

const isDead = (status: string) => status === "Liquidated" || status === "SplicedBurned";

/** The `allocate_atp` guards: alive, once per epoch, level ≤ max, enough ATP for the increases. */
export function checkAllocation(input: {
  status: string;
  atp: bigint;
  current: OrganelLevels;
  target: OrganelLevels;
  lastAllocateEpoch: number | null;
  currentEpoch: number | null;
}): Check & { cost: number } {
  const cost = allocationCost(input.current, input.target);
  const fail = (reason: string) => ({ ok: false as const, reason, cost });
  if (isDead(input.status)) return fail("This Snacc is no longer alive.");
  if (input.currentEpoch === null || input.lastAllocateEpoch === null) return fail("Waiting for the epoch read from testnet.");
  if (input.lastAllocateEpoch === input.currentEpoch) return fail(`This Snacc already allocated ATP in epoch ${input.currentEpoch}. Once per epoch.`);
  for (const v of [input.target.mitokondria, input.target.nukleus, input.target.lisosom]) {
    if (v < 0 || v > MAX_ORGANEL_LEVEL) return fail(`Each organelle level is 0 to ${MAX_ORGANEL_LEVEL}.`);
  }
  const same =
    input.target.mitokondria === input.current.mitokondria && input.target.nukleus === input.current.nukleus && input.target.lisosom === input.current.lisosom;
  if (same) return fail("Change at least one level.");
  if (BigInt(cost) > input.atp) return fail(`Needs ${cost} ATP; this Snacc has ${input.atp}.`);
  return { ok: true, cost };
}

/** `divide_strain(strain_id)`: costs 3 ATP from the parent; no deposit. */
export function buildDivide(input: { strainId: number }): ContractCall {
  return call("divide_strain", { strain_id: requireId(input.strainId, "strain_id") });
}

/** The `divide_strain` guards. `birthBudget` = `total_mergers + total_lyses - total_divides`. */
export function checkDivide(input: {
  status: string;
  effectiveVitality: number;
  atp: bigint;
  generation: number;
  colonySize: number | null;
  birthBudget: number | null;
}): Check {
  if (isDead(input.status)) return { ok: false, reason: "This Snacc is no longer alive." };
  if (input.effectiveVitality <= 0) return { ok: false, reason: "A starving Snacc (vitality 0) cannot divide. Feed it first." };
  if (input.atp < BigInt(ATP_COST.divide)) return { ok: false, reason: `Dividing costs ${ATP_COST.divide} ATP; this Snacc has ${input.atp}.` };
  if (input.generation + 1 > MAX_GENERATION) return { ok: false, reason: `The child would be generation ${input.generation + 1}; the limit is ${MAX_GENERATION}.` };
  if (input.colonySize === null) return { ok: false, reason: "Waiting for your colony read from testnet." };
  if (input.colonySize >= MAX_COLONY_SIZE) return { ok: false, reason: `Your colony already has ${input.colonySize} living Snaccs (limit ${MAX_COLONY_SIZE}).` };
  if (input.birthBudget !== null && input.birthBudget < 1) {
    return { ok: false, reason: "The contract allows a division only after a merger or a lysis frees a slot (total divides ≤ mergers + lyses)." };
  }
  return { ok: true };
}

/** `extract_spores(strain_id, spore_type, snacc_catalyst_fee)` with attached NEAR == fee. */
export function buildExtract(input: { strainId: number; sporeType: SporeType; feeYocto: string }): ContractCall {
  if (!SPORE_TYPES.includes(input.sporeType)) throw new Error(`unknown spore ${String(input.sporeType)}`);
  const fee = requireYocto(input.feeYocto, "catalyst fee");
  return call("extract_spores", { strain_id: requireId(input.strainId, "strain_id"), spore_type: input.sporeType, snacc_catalyst_fee: fee }, fee);
}

/**
 * Diet discount on the transmute fee (`EN-110`): Fever + Extractor bit or Hypothermia + Synthesizer
 * bit gives 20%. Zones use the contract's params: Fever above `fever_threshold_mk`, Hypothermia
 * below `hypothermia_threshold_mk`.
 */
export function transmuteDietBps(input: { roleMask: number; tempMk: number; feverMk: number; hypothermiaMk: number }): number {
  if (input.tempMk > input.feverMk && hasRole(input.roleMask, "Extractor")) return DIET_DISCOUNT_BPS;
  if (input.tempMk < input.hypothermiaMk && hasRole(input.roleMask, "Synthesizer")) return DIET_DISCOUNT_BPS;
  return 0;
}

/** Attached deposit for transmute: the fee after the diet discount (`ERR_STAKE_DEPOSIT_MISMATCH` otherwise). */
export function transmuteDeposit(feeYocto: string, dietBps: number): string {
  return ((BigInt(requireYocto(feeYocto, "catalyst fee")) * (BPS - BigInt(dietBps))) / BPS).toString();
}

/** `transmute_spores_to_enzyme(strain_id, spores_to_burn, snacc_catalyst_fee)`; burns an even count. */
export function buildTransmute(input: { strainId: number; sporesToBurn: number; feeYocto: string; dietBps?: number }): ContractCall {
  const n = input.sporesToBurn;
  if (!Number.isSafeInteger(n) || n <= 0 || n % 2 !== 0) throw new Error("spores_to_burn must be a positive even number");
  const fee = requireYocto(input.feeYocto, "catalyst fee");
  return call(
    "transmute_spores_to_enzyme",
    { strain_id: requireId(input.strainId, "strain_id"), spores_to_burn: n, snacc_catalyst_fee: fee },
    transmuteDeposit(fee, input.dietBps ?? 0),
  );
}

/** Which recipe the contract picks for `spores_to_burn` (amalgam → redactase → synthase) and the output. */
export function transmutePreview(
  inv: Inventory,
  sporesToBurn: number,
  efficiencyBps: number,
  nucleusLevel: number,
): { enzyme: MoleculeId; burns: [MoleculeId, number][]; minted: bigint } | null {
  if (!Number.isSafeInteger(sporesToBurn) || sporesToBurn <= 0 || sporesToBurn % 2 !== 0) return null;
  const burn = BigInt(sporesToBurn);
  const k = burn / 2n;
  const has = (id: MoleculeId) => inv[id] ?? 0n;
  let out: { enzyme: MoleculeId; burns: [MoleculeId, number][] } | null = null;
  if (has("mt:spore-ignis") >= burn) out = { enzyme: "mt:enzyme-amalgam", burns: [["mt:spore-ignis", sporesToBurn]] };
  else if (has("mt:spore-ignis") >= k && has("mt:spore-lumin") >= k)
    out = { enzyme: "mt:enzyme-redactase", burns: [["mt:spore-ignis", Number(k)], ["mt:spore-lumin", Number(k)]] };
  else if (has("mt:spore-cryo") >= burn) out = { enzyme: "mt:enzyme-synthase", burns: [["mt:spore-cryo", sporesToBurn]] };
  if (!out) return null;
  const minted = (burn * BigInt(efficiencyBps) * (BPS + BigInt(nucleusLevel) * NUCLEUS_OUTPUT_BPS_PER_LEVEL)) / (BPS * BPS);
  return { ...out, minted };
}

/** `synthesize_elixir(strain_id, elixir_type, enzymes_to_burn, snacc_catalyst_fee)` with attached NEAR == fee. */
export function buildSynthesize(input: { strainId: number; elixirType: ElixirType; enzymesToBurn: number; feeYocto: string }): ContractCall {
  const recipe = ELIXIR_RECIPES[input.elixirType];
  if (!recipe) throw new Error(`unknown elixir ${String(input.elixirType)}`);
  const n = input.enzymesToBurn;
  if (!Number.isSafeInteger(n) || n <= 0 || n % recipe.batch !== 0) throw new Error(`enzymes_to_burn must be a positive multiple of ${recipe.batch}`);
  const fee = requireYocto(input.feeYocto, "catalyst fee");
  return call(
    "synthesize_elixir",
    { strain_id: requireId(input.strainId, "strain_id"), elixir_type: input.elixirType, enzymes_to_burn: n, snacc_catalyst_fee: fee },
    fee,
  );
}

/** Batches, enzymes needed and elixirs minted for a synthesis; null when the count is not a whole batch. */
export function synthesizePreview(elixir: ElixirType, enzymesToBurn: number, nucleusLevel: number) {
  const r = ELIXIR_RECIPES[elixir];
  if (!Number.isSafeInteger(enzymesToBurn) || enzymesToBurn <= 0 || enzymesToBurn % r.batch !== 0) return null;
  const batches = BigInt(enzymesToBurn / r.batch);
  return {
    batches,
    needA: [r.a, batches * BigInt(r.perA)] as const,
    needB: [r.b, batches * BigInt(r.perB)] as const,
    minted: (batches * (BPS + BigInt(nucleusLevel) * NUCLEUS_OUTPUT_BPS_PER_LEVEL)) / BPS,
  };
}

/** `npc_buy_spores(strain_id, npc_id, buy_amount)`: paid from the strain's $SNACC; no deposit. */
export function buildNpcBuy(input: { strainId: number; npcId: string; buyAmount: number }): ContractCall {
  if (!Number.isSafeInteger(input.buyAmount) || input.buyAmount <= 0) throw new Error("buy_amount must be a positive integer");
  if (!input.npcId) throw new Error("npc_id is required");
  return call("npc_buy_spores", { strain_id: requireId(input.strainId, "strain_id"), npc_id: input.npcId, buy_amount: input.buyAmount });
}

/** `adopt(target_id, raider_strain_id, expected_target_nonce)`: pays book value from your strain; no deposit. */
export function buildAdopt(input: { targetId: number; raiderStrainId: number; expectedTargetNonce: number }): ContractCall {
  if (input.targetId === input.raiderStrainId) throw new Error("target and paying strain must differ");
  return call("adopt", {
    target_id: requireId(input.targetId, "target_id"),
    raider_strain_id: requireId(input.raiderStrainId, "raider_strain_id"),
    expected_target_nonce: requireId(input.expectedTargetNonce, "expected_target_nonce"),
  });
}

/** `harvest_starving_strain(target_id)`: permissionless lysis of a strain at vitality 0; no deposit. */
export function buildHarvest(input: { targetId: number }): ContractCall {
  return call("harvest_starving_strain", { target_id: requireId(input.targetId, "target_id") });
}

/** `hostile_takeover_splice(raider_strain_id, distressed_target_id, expected_target_nonce)`; no deposit. */
export function buildHostileTakeover(input: { raiderStrainId: number; distressedTargetId: number; expectedTargetNonce: number }): ContractCall {
  if (input.raiderStrainId === input.distressedTargetId) throw new Error("raider and target must differ");
  return call("hostile_takeover_splice", {
    raider_strain_id: requireId(input.raiderStrainId, "raider_strain_id"),
    distressed_target_id: requireId(input.distressedTargetId, "distressed_target_id"),
    expected_target_nonce: requireId(input.expectedTargetNonce, "expected_target_nonce"),
  });
}

/** `splice_strains(dominant_id, absorbed_id)`: merges two of your own strains; no deposit. */
export function buildSplice(input: { dominantId: number; absorbedId: number }): ContractCall {
  if (input.dominantId === input.absorbedId) throw new Error("dominant and absorbed must differ");
  return call("splice_strains", { dominant_id: requireId(input.dominantId, "dominant_id"), absorbed_id: requireId(input.absorbedId, "absorbed_id") });
}

/** `claim_industrial_dividend(strain_id, epoch)`: no deposit (an attached one is refunded). */
export function buildClaimDividend(input: { strainId: number; epoch: number }): ContractCall {
  return call("claim_industrial_dividend", { strain_id: requireId(input.strainId, "strain_id"), epoch: requireId(input.epoch, "epoch") });
}

/** `synthesize_and_redeem_aether(strain_id, amount)`: burns elixir-aether units; `amount` is a U128 string. */
export function buildRedeemAether(input: { strainId: number; amount: string }): ContractCall {
  const amount = requireYocto(input.amount, "amount");
  if (BigInt(amount) < 1n) throw new Error("amount must be at least 1");
  return call("synthesize_and_redeem_aether", { strain_id: requireId(input.strainId, "strain_id"), amount });
}

/** `nft_transfer(receiver_id, token_id, approval_id, memo)` with exactly 1 yoctoNEAR. */
export function buildNftTransfer(input: { receiverId: string; strainId: number; memo?: string }): ContractCall {
  const args: Record<string, unknown> = { receiver_id: input.receiverId, token_id: String(requireId(input.strainId, "token_id")) };
  if (input.memo) args.memo = input.memo;
  return call("nft_transfer", args, ONE_YOCTO);
}

/** `ft_transfer(receiver_id, amount, memo)` with exactly 1 yoctoNEAR; the receiver must be registered. */
export function buildFtTransfer(input: { receiverId: string; amountYocto: string; memo?: string }): ContractCall {
  const amount = requireYocto(input.amountYocto, "amount");
  if (BigInt(amount) <= 0n) throw new Error("amount must be greater than zero");
  const args: Record<string, unknown> = { receiver_id: input.receiverId, amount };
  if (input.memo) args.memo = input.memo;
  return call("ft_transfer", args, ONE_YOCTO);
}

/** NEAR testnet account id: a `.testnet` named account or a 64-hex implicit account. */
export function checkTestnetAccount(raw: string, self: string | null): { ok: true; id: string } | { ok: false; reason: string } {
  const id = raw.trim().toLowerCase();
  if (!id) return { ok: false, reason: "Enter a testnet account, e.g. friend.testnet." };
  const named = /^(?:[a-z\d]+[-_])*[a-z\d]+(?:\.(?:[a-z\d]+[-_])*[a-z\d]+)*$/.test(id) && id.length >= 2 && id.length <= 64;
  const implicit = /^[0-9a-f]{64}$/.test(id);
  if (!implicit && !(named && id.endsWith(".testnet") && id !== "testnet")) {
    return { ok: false, reason: "Use a testnet account id: name.testnet, or a 64-character implicit id." };
  }
  if (self && id === self) return { ok: false, reason: "That is your own account." };
  return { ok: true, id };
}

/** Book value as the contract computes it: strain $SNACC + every molecule unit × floor price 1. */
export function bookValue(snaccYocto: bigint, inv: Inventory): bigint {
  return ALL_TOKEN_IDS.reduce((sum, id) => sum + (inv[id] ?? 0n), snaccYocto);
}

/** Hostile takeover price: book value + 15% premium; 95% to the old owner, 5% to the treasury. */
export function hostilePrice(book: bigint): { payment: bigint; seller: bigint; treasury: bigint } {
  const payment = (book * (BPS + BigInt(HOSTILE_PREMIUM_BPS))) / BPS;
  const seller = (payment * BigInt(HOSTILE_SELLER_BPS)) / BPS;
  return { payment, seller, treasury: payment - seller };
}

/** Harvest split: 10% of the strain's $SNACC to the caller, 90% to the treasury. */
export function harvestSplit(balance: bigint): { bounty: bigint; treasury: bigint } {
  const bounty = (balance * BigInt(LIQUIDATOR_BOUNTY_BPS)) / BPS;
  return { bounty, treasury: balance - bounty };
}

/** Epochs a strain can still claim: closed (`< last_closed_epoch`) and within the claim window. */
export function claimableEpochs(currentEpoch: number, lastClosedEpoch: number): number[] {
  const from = Math.max(0, currentEpoch - MAX_DIVIDEND_CLAIM_EPOCHS);
  const out: number[] = [];
  for (let e = lastClosedEpoch - 1; e >= from; e--) out.push(e);
  return out;
}

/** "3h 12m" style countdown from contract seconds. */
export function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}
