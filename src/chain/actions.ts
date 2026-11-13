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
