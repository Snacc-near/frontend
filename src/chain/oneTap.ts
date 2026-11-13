/**
 * RES-111 "one-tap play": deposit-free game actions signed in this browser with a NEAR
 * function-call access key (a session key), so they go through without a wallet popup.
 *
 * Pure pieces only (no React, no storage): the method list, the wallet transaction allowlist, the
 * `AddKey` / `DeleteKey` wallet actions, a minimal Borsh encoder for a one-`FunctionCall`
 * transaction, the JSON-RPC calls and the signless send with its fallback rules.
 *
 * Protocol constraint: NEAR rejects a transaction signed by a function-call key when it attaches a
 * deposit (`DepositWithFunctionCall`). Anything that attaches NEAR (hatching, the production chain,
 * transfers, the market, the first storage registration) therefore always goes through the wallet.
 * No relayer or gas station is involved: the player's own account pays the gas, capped by the
 * key's allowance.
 *
 * The rule that keeps a send from happening twice: the wallet fallback is used only when the
 * transaction was never broadcast, or when an RPC answered that it is invalid (so it cannot land).
 * Once a broadcast may have reached the network (a timeout, a dropped connection), the result is
 * reported as "not confirmed" with the locally computed hash, and the wallet is not asked again.
 */
import { CONTRACT_ID, GAS, parseNear, type ContractCall, type FunctionCallAction } from "./actions.ts";
import { parseJsonBig } from "../data/nearView.ts";
import { humanizeTxError, readOutcome, type TxResult } from "./txResult.ts";

// ---------------------------------------------------------------------------- the method list

/**
 * How a Snacc-contract method the app sends handles NEAR attached to the call, and whether it may
 * go out with the one-tap key. Only `none` may.
 */
export type DepositRule = "none" | "pays_other" | "stake" | "fee" | "storage" | "one_yocto";

/**
 * Every Snacc-contract method the app sends (the `GAS` table plus the market listing call), with its
 * deposit rule read from `contracts/snacc/src/lib.rs` (origin/main, 2026-11-13):
 * - `none`: the method is not `#[payable]` (the runtime refuses any attached NEAR), or it is
 *   `#[payable]` only to refund a stray deposit (`feed_strain`, `claim_industrial_dividend`,
 *   "Pipeline #7 defensive payable"). The app always sends 0.
 * - `stake` / `fee` / `storage`: `#[payable]` and the attached NEAR is the stake, the catalyst fee or
 *   the NEP-145 storage deposit.
 * - `one_yocto`: `assert_one_yocto()` (NEP-141 / NEP-171 transfers).
 * - `pays_other`: no deposit, but the call pays `$SNACC` from your strain to a counterparty the
 *   caller picks, or moves a Snacc's ownership (`adopt`: book value to the target's owner;
 *   `hostile_takeover_splice`: book value + 15% to the target's owner). A script running on the
 *   site could use a popup-free key to drain a strain into its own distressed one, so these keep
 *   the wallet popup.
 */
export const CONTRACT_METHOD_DEPOSIT = {
  incubate_strain: "stake",
  storage_deposit: "storage",
  extract_spores: "fee",
  transmute_spores_to_enzyme: "fee",
  synthesize_elixir: "fee",
  nft_transfer: "one_yocto",
  nft_transfer_call: "one_yocto",
  ft_transfer: "one_yocto",
  feed_strain: "none",
  allocate_atp: "none",
  divide_strain: "none",
  splice_strains: "none",
  hostile_takeover_splice: "pays_other",
  adopt: "pays_other",
  harvest_starving_strain: "none",
  npc_buy_spores: "none",
  synthesize_and_redeem_aether: "none",
  claim_industrial_dividend: "none",
} as const satisfies Record<string, DepositRule>;

/** The methods a one-tap key may call: the deposit-free ones from a table like `CONTRACT_METHOD_DEPOSIT`, sorted. */
export function deriveOneTapMethods(table: Readonly<Record<string, DepositRule>>): string[] {
  return Object.entries(table)
    .filter(([, rule]) => rule === "none")
    .map(([m]) => m)
    .sort();
}

/**
 * The exact `method_names` of the one-tap key. A subset of the SDK's `SIGNLESS_METHODS`: the SDK
 * also lists methods the app never sends (`commit_genome_experiment`, `apply_tee_mutation_zero_trust`,
 * `conjugate_traits`, `advance_epoch`, `ft_burn`), which are left out so the key can do no more
 * than the app needs, and `adopt` / `hostile_takeover_splice` stay wallet-only (`pays_other`).
 */
export const ONE_TAP_METHODS: readonly string[] = deriveOneTapMethods(CONTRACT_METHOD_DEPOSIT);

/** The methods that keep the wallet popup: they attach NEAR, or pay another player (`pays_other`). */
export const WALLET_ONLY_METHODS: readonly string[] = Object.entries(CONTRACT_METHOD_DEPOSIT)
  .filter(([, rule]) => rule !== "none")
  .map(([m]) => m);

/** The zero-deposit methods kept in the wallet because they pay a counterparty the caller picks. */
export const PAYS_OTHER_METHODS: readonly string[] = Object.entries(CONTRACT_METHOD_DEPOSIT)
  .filter(([, rule]) => rule === "pays_other")
  .map(([m]) => m);

/** The wallet-only methods that attach NEAR (everything wallet-only except `pays_other`). */
export const ATTACHES_NEAR_METHODS: readonly string[] = WALLET_ONLY_METHODS.filter((m) => !PAYS_OTHER_METHODS.includes(m));

/** Gas allowance of the one-tap key (ADR-08 default). Change here to change what the wallet is asked for. */
export const ONE_TAP_ALLOWANCE_NEAR = "0.25";
export const ONE_TAP_ALLOWANCE_YOCTO: string = parseNear(ONE_TAP_ALLOWANCE_NEAR)!;
/** The wallet allowlist refuses an `AddKey` asking for more than this. */
export const MAX_ONE_TAP_ALLOWANCE_YOCTO: string = parseNear("1")!;
/** Testnet minimum gas price (yocto per gas); used only for the early allowance check. */
export const GAS_PRICE_FLOOR_YOCTO = 100_000_000n;

/** FastNEAR first (the `rpc.testnet.near.org` endpoint is rate limited), then the NEAR one. */
export const ONE_TAP_RPCS: readonly string[] = ["https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"];

// ---------------------------------------------------------------------------- wallet actions

/** NEAR Connect `AddKeyAction` (`@hot-labs/near-connect` 0.12 `build/actions/types.d.ts`). */
export interface AddKeyWalletAction {
  type: "AddKey";
  params: {
    publicKey: string;
    accessKey: {
      nonce?: number;
      permission: "FullAccess" | { receiverId: string; allowance?: string; methodNames?: string[] };
    };
    gasKeyInfo?: unknown;
  };
}

/** NEAR Connect `DeleteKeyAction`. */
export interface DeleteKeyWalletAction {
  type: "DeleteKey";
  params: { publicKey: string };
}

export type WalletAction = FunctionCallAction | AddKeyWalletAction | DeleteKeyWalletAction;

/** One transaction handed to the wallet. */
export interface WalletTx {
  signerId: string;
  receiverId: string;
  actions: WalletAction[];
}

/** The one `AddKey` the app ever asks a wallet for: a function-call key for the Snacc contract. */
export function buildAddKeyAction(publicKey: string, allowanceYocto: string = ONE_TAP_ALLOWANCE_YOCTO): AddKeyWalletAction {
  return {
    type: "AddKey",
    params: {
      publicKey,
      accessKey: { nonce: 0, permission: { receiverId: CONTRACT_ID, allowance: allowanceYocto, methodNames: [...ONE_TAP_METHODS] } },
    },
  };
}

export function buildDeleteKeyAction(publicKey: string): DeleteKeyWalletAction {
  return { type: "DeleteKey", params: { publicKey } };
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

/** True when a key's method list is exactly this version's `ONE_TAP_METHODS` (any order). */
export const isCurrentMethodList = (methods: readonly string[]) => sameList(methods, ONE_TAP_METHODS);

/** `ed25519:` + base58 of exactly 32 bytes. */
export function isEd25519PublicKey(key: unknown): key is string {
  if (typeof key !== "string" || !key.startsWith("ed25519:")) return false;
  try {
    return base58Decode(key.slice(8)).length === 32;
  } catch {
    return false;
  }
}

/**
 * The wallet allowlist: returns null when the wallet may be asked to sign `tx`, otherwise the reason
 * it is refused. Allowed, and nothing else:
 * 1. only `FunctionCall` actions, to one of `receivers` (the Snacc contract or the market);
 * 2. receiver == signer and the single action is the one-tap `AddKey` exactly as
 *    `buildAddKeyAction` makes it (function-call permission for the Snacc contract, the exact
 *    `ONE_TAP_METHODS`, an allowance of 1 yocto to `MAX_ONE_TAP_ALLOWANCE_YOCTO`, no gas key);
 * 3. receiver == signer and the single action deletes `deletableKey`, the one-tap key this browser holds.
 */
export function checkWalletTx(
  tx: WalletTx,
  ctx: { signerId: string | null; receivers: readonly string[]; deletableKey: string | null },
): string | null {
  if (!ctx.signerId || tx.signerId !== ctx.signerId) return "the signer is not the connected account";
  if (!Array.isArray(tx.actions) || tx.actions.length === 0) return "a transaction needs at least one action";
  if (tx.actions.every((a) => a.type === "FunctionCall")) {
    return ctx.receivers.includes(tx.receiverId) ? null : `receiver ${tx.receiverId} is not a contract this game signs for`;
  }
  if (tx.actions.length !== 1) return "key actions must be the only action in their transaction";
  if (tx.receiverId !== tx.signerId) return "key actions must be sent to your own account";
  const action = tx.actions[0]!;
  if (action.type === "AddKey") {
    const { publicKey, accessKey, gasKeyInfo } = action.params;
    const perm = accessKey.permission;
    if (!isEd25519PublicKey(publicKey)) return "the new key is not an ed25519 public key";
    if (gasKeyInfo !== undefined) return "gas keys are not used by this game";
    if (perm === "FullAccess" || typeof perm !== "object" || perm === null) return "the game never asks for a full-access key";
    if (perm.receiverId !== CONTRACT_ID) return `the one-tap key may only call ${CONTRACT_ID}`;
    if (!Array.isArray(perm.methodNames) || !sameList(perm.methodNames, ONE_TAP_METHODS)) return "the one-tap key must list exactly the deposit-free game methods";
    const allowance = perm.allowance;
    if (typeof allowance !== "string" || !/^\d+$/.test(allowance)) return "the one-tap key needs a fixed allowance";
    if (BigInt(allowance) <= 0n || BigInt(allowance) > BigInt(MAX_ONE_TAP_ALLOWANCE_YOCTO)) return "the one-tap allowance is out of range";
    return null;
  }
  if (action.type === "DeleteKey") {
    if (!ctx.deletableKey || action.params.publicKey !== ctx.deletableKey) return "only the one-tap key this browser holds can be deleted from here";
    return null;
  }
  return "that action is not one this game signs";
}

// ---------------------------------------------------------------------------- eligibility

export type SignlessCheck = { ok: true; call: ContractCall } | { ok: false; reason: "receiver" | "batch" | "deposit" | "method" };

/**
 * Whether `calls` can go out through the one-tap key: one call, to the Snacc contract, no deposit,
 * a method in `methods`. A storage registration in front of the call (a deposit) makes it a wallet one.
 */
export function signlessCall(calls: ContractCall[], receiverId: string, methods: readonly string[]): SignlessCheck {
  if (receiverId !== CONTRACT_ID) return { ok: false, reason: "receiver" };
  if (calls.length !== 1) return { ok: false, reason: "batch" };
  const call = calls[0]!;
  if (!/^\d+$/.test(call.deposit) || BigInt(call.deposit) !== 0n) return { ok: false, reason: "deposit" };
  if (!methods.includes(call.methodName) || !ONE_TAP_METHODS.includes(call.methodName)) return { ok: false, reason: "method" };
  return { ok: true, call };
}

/** Prepaid gas of a one-tap method (the same as the wallet path). */
export const gasFor = (method: string): string => (GAS as Record<string, string>)[method] ?? (100n * 10n ** 12n).toString();

// ---------------------------------------------------------------------------- base58 / base64

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]!];
  return out;
}

export function base58Decode(s: string): Uint8Array {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < s.length; i++) {
    const v = B58.indexOf(s[i]!);
    if (v < 0) throw new Error("invalid base58");
    let carry = v;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[zeros + i] = bytes[bytes.length - 1 - i]!;
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------- Borsh

/**
 * Transaction (V0) = signer_id: String, public_key: { key_type: u8 = 0, data: [u8; 32] }, nonce: u64,
 *   receiver_id: String, block_hash: [u8; 32], actions: Vec<Action>;
 * Action::FunctionCall = variant 2 { method_name: String, args: Vec<u8>, gas: u64, deposit: u128 }.
 * SignedTransaction = Transaction ‖ Signature { key_type: u8 = 0, data: [u8; 64] }; tx hash = sha256(Transaction).
 * Strings and Vec<u8> are a u32 little-endian length then the bytes. Pinned by test vectors made with
 * near-api-js 7.4.0 (see `test/res-111.test.tsx`).
 */
export interface FunctionCallTx {
  signerId: string;
  publicKey: Uint8Array;
  nonce: bigint;
  receiverId: string;
  blockHash: Uint8Array;
  methodName: string;
  args: Uint8Array;
  gas: bigint;
  deposit: bigint;
}

class BorshWriter {
  private out: number[] = [];
  u8(v: number) {
    this.out.push(v & 0xff);
    return this;
  }
  u32(v: number) {
    for (let i = 0; i < 4; i++) this.out.push((v >>> (8 * i)) & 0xff);
    return this;
  }
  uint(v: bigint, size: number) {
    if (v < 0n || v >= 1n << BigInt(8 * size)) throw new RangeError(`value does not fit in ${size} bytes`);
    for (let i = 0; i < size; i++) this.out.push(Number((v >> BigInt(8 * i)) & 0xffn));
    return this;
  }
  raw(b: Uint8Array) {
    for (const x of b) this.out.push(x);
    return this;
  }
  bytes(b: Uint8Array) {
    return this.u32(b.length).raw(b);
  }
  str(s: string) {
    return this.bytes(new TextEncoder().encode(s));
  }
  done() {
    return Uint8Array.from(this.out);
  }
}

const exact = (b: Uint8Array, n: number, what: string) => {
  if (b.length !== n) throw new RangeError(`${what} must be ${n} bytes`);
  return b;
};

export function encodeFunctionCallTx(t: FunctionCallTx): Uint8Array {
  return new BorshWriter()
    .str(t.signerId)
    .u8(0)
    .raw(exact(t.publicKey, 32, "public key"))
    .uint(t.nonce, 8)
    .str(t.receiverId)
    .raw(exact(t.blockHash, 32, "block hash"))
    .u32(1)
    .u8(2)
    .str(t.methodName)
    .bytes(t.args)
    .uint(t.gas, 8)
    .uint(t.deposit, 16)
    .done();
}

export function encodeSignedTx(txBytes: Uint8Array, signature: Uint8Array): Uint8Array {
  return new BorshWriter().raw(txBytes).u8(0).raw(exact(signature, 64, "signature")).done();
}

// ---------------------------------------------------------------------------- JSON-RPC

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface OneTapRpc {
  urls: readonly string[];
  fetch: FetchLike;
  /** Per-request timeout, ms (queries 7 s, sends 20 s by default). */
  timeoutMs?: number;
}

export type RpcAnswer = { kind: "result"; result: unknown } | { kind: "error"; error: unknown } | { kind: "transport"; reason: string };

async function rpcOnce(url: string, rpc: OneTapRpc, method: string, params: unknown, timeoutMs: number): Promise<RpcAnswer> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await rpc.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({ jsonrpc: "2.0", id: "snacc-one-tap", method, params }),
    });
    const text = await res.text();
    let body: { result?: unknown; error?: unknown } | null = null;
    try {
      body = parseJsonBig(text);
    } catch {
      body = null;
    }
    if (body && body.error !== undefined && body.error !== null) return { kind: "error", error: body.error };
    if (body && body.result !== undefined) return { kind: "result", result: body.result };
    return { kind: "transport", reason: `HTTP ${res.status}` };
  } catch (e) {
    return { kind: "transport", reason: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Tries each RPC in order and returns the first real answer; `transportFailures` counts the endpoints that gave none. */
export async function rpcCall(rpc: OneTapRpc, method: string, params: unknown, timeoutMs = rpc.timeoutMs ?? 7000): Promise<RpcAnswer & { transportFailures: number }> {
  let failures = 0;
  let last: RpcAnswer = { kind: "transport", reason: "no RPC endpoint" };
  for (const url of rpc.urls) {
    last = await rpcOnce(url, rpc, method, params, timeoutMs);
    if (last.kind !== "transport") return { ...last, transportFailures: failures };
    failures++;
  }
  return { ...last, transportFailures: failures };
}

const textOf = (v: unknown) => {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export type AccessKeyPermission = { kind: "FullAccess" } | { kind: "FunctionCall"; receiverId: string; methodNames: string[]; allowance: bigint | null };

export type AccessKeyRead =
  | { kind: "found"; nonce: bigint; blockHash: string; permission: AccessKeyPermission }
  | { kind: "missing" }
  | { kind: "unreachable"; raw: string };

const MISSING_KEY = /UNKNOWN_ACCESS_KEY|AccessKeyDoesNotExist|does not exist while viewing/;

/** `view_access_key` at final finality: the nonce, a recent final block hash and the permission. */
export async function readAccessKey(rpc: OneTapRpc, accountId: string, publicKey: string): Promise<AccessKeyRead> {
  const a = await rpcCall(rpc, "query", { request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey });
  if (a.kind === "transport") return { kind: "unreachable", raw: a.reason };
  if (a.kind === "error") return MISSING_KEY.test(textOf(a.error)) ? { kind: "missing" } : { kind: "unreachable", raw: textOf(a.error) };
  const r = a.result as { nonce?: unknown; block_hash?: unknown; permission?: unknown; error?: unknown } | null;
  if (r && r.error !== undefined) return MISSING_KEY.test(textOf(r.error)) ? { kind: "missing" } : { kind: "unreachable", raw: textOf(r.error) };
  if (!r || typeof r.block_hash !== "string" || (typeof r.nonce !== "number" && typeof r.nonce !== "string")) return { kind: "unreachable", raw: textOf(r) };
  let permission: AccessKeyPermission;
  if (r.permission === "FullAccess") permission = { kind: "FullAccess" };
  else {
    const fc = (r.permission as { FunctionCall?: { allowance?: unknown; receiver_id?: unknown; method_names?: unknown } } | null)?.FunctionCall;
    if (!fc || typeof fc.receiver_id !== "string") return { kind: "unreachable", raw: textOf(r.permission) };
    permission = {
      kind: "FunctionCall",
      receiverId: fc.receiver_id,
      methodNames: Array.isArray(fc.method_names) ? fc.method_names.filter((m): m is string => typeof m === "string") : [],
      allowance: fc.allowance === null || fc.allowance === undefined ? null : BigInt(fc.allowance as string),
    };
  }
  return { kind: "found", nonce: BigInt(r.nonce as string | number), blockHash: r.block_hash, permission };
}

export type SendErrorClass =
  | { included: "no"; reason: "allowance" | "key-missing" | "method" | "receiver" | "deposit" | "balance" | "nonce" | "invalid" }
  | { included: "yes" }
  | { included: "maybe" };

/** True when `name` is a key anywhere inside `v` (nearcore puts error variants in nested object keys). */
function hasKey(v: unknown, name: string, depth = 0): boolean {
  if (depth > 12 || v === null || typeof v !== "object") return false;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (k === name || hasKey(val, name, depth + 1)) return true;
  }
  return false;
}

/** The object stored under the key `name` anywhere inside `v`, or undefined. */
function findKey(v: unknown, name: string, depth = 0): unknown {
  if (depth > 12 || v === null || typeof v !== "object") return undefined;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (k === name) return val;
    const inner = findKey(val, name, depth + 1);
    if (inner !== undefined) return inner;
  }
  return undefined;
}

/**
 * Reads a `send_tx` error. `no`: an invalid transaction (it cannot land). `yes`: it ran and failed.
 * `maybe`: anything else (a timeout, an unknown error); the transaction may still land.
 * Matches the RPC's structured fields (`name`, `cause.name`, variant keys under `data`), not free
 * text, so an account id or a message that happens to contain "timeout" changes nothing. Old nodes
 * that send `data` as a string are matched on whole CamelCase variant names only.
 */
export function classifySendError(error: unknown): SendErrorClass {
  const e = error !== null && typeof error === "object" ? (error as { name?: unknown; cause?: { name?: unknown } | null; data?: unknown }) : null;
  const names = [e?.cause?.name, e?.name].filter((n): n is string => typeof n === "string");
  if (names.includes("TIMEOUT_ERROR")) return { included: "maybe" };
  const textual = typeof error === "string" ? error : typeof e?.data === "string" ? e.data : "";
  const has = (variant: string) => hasKey(error, variant) || new RegExp(`\\b${variant}\\b`).test(textual);
  if (has("ActionError")) return { included: "yes" };
  if (has("InvalidNonce")) return { included: "no", reason: "nonce" };
  if (has("NotEnoughAllowance")) return { included: "no", reason: "allowance" };
  if (has("AccessKeyNotFound")) return { included: "no", reason: "key-missing" };
  if (has("MethodNameMismatch")) return { included: "no", reason: "method" };
  if (has("ReceiverMismatch")) return { included: "no", reason: "receiver" };
  if (has("DepositWithFunctionCall")) return { included: "no", reason: "deposit" };
  if (has("NotEnoughBalance") || has("LackBalanceForState")) return { included: "no", reason: "balance" };
  if (names.includes("INVALID_TRANSACTION") || has("InvalidTxError")) return { included: "no", reason: "invalid" };
  return { included: "maybe" };
}

/** The access key's nonce reported by an `InvalidNonce` error (`ak_nonce`), when present. */
export function invalidNonceAk(error: unknown): bigint | null {
  const v = findKey(error, "InvalidNonce") as { ak_nonce?: unknown } | undefined;
  const ak = v && typeof v === "object" ? v.ak_nonce : undefined;
  if (typeof ak === "number" && Number.isSafeInteger(ak) && ak >= 0) return BigInt(ak);
  if (typeof ak === "string" && /^\d+$/.test(ak)) return BigInt(ak);
  return null;
}

// ---------------------------------------------------------------------------- signless send

export interface OneTapSigner {
  /** `ed25519:<base58>` */
  publicKey: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
}

export type FallbackReason =
  | "key-missing"
  | "allowance"
  | "method"
  | "receiver"
  | "deposit"
  | "balance"
  | "nonce"
  | "invalid"
  | "rpc-unreachable"
  | "load-failed"
  | "outdated";

/** One-line notices shown when a deposit-free action falls back to the wallet. */
export const FALLBACK_NOTICE: Record<FallbackReason, string> = {
  "key-missing": "One-tap key not found on your account, so your wallet signs this one.",
  allowance: "The one-tap allowance is used up, so your wallet signs this one. Turn one-tap play off and on in Settings for a fresh allowance.",
  method: "The one-tap key cannot call this action, so your wallet signs it.",
  receiver: "The one-tap key is not for this contract, so your wallet signs this one.",
  deposit: "This action attaches NEAR, so your wallet signs it.",
  balance: "Your account could not cover the gas for one-tap play, so your wallet signs this one.",
  nonce: "One-tap play could not get a fresh nonce, so your wallet signs this one.",
  invalid: "Testnet refused the one-tap transaction, so your wallet signs this one.",
  "rpc-unreachable": "Could not reach NEAR testnet for one-tap play, so your wallet signs this one.",
  "load-failed": "Could not load the one-tap key in this browser, so your wallet signs this one.",
  outdated: "Your one-tap key is from an older version of the game, so your wallet signs this one. Replace it in Settings → One-tap play.",
};

export type SignlessOutcome =
  | { kind: "sent"; result: TxResult; nonce: bigint }
  | { kind: "fallback"; reason: FallbackReason; notice: string; broadcast: boolean };

export const NOT_CONFIRMED_MESSAGE =
  "One-tap play sent this transaction, but testnet did not confirm it in time. Check the explorer link before trying again.";

async function sha256(bytes: Uint8Array, subtle: SubtleCrypto): Promise<Uint8Array> {
  return new Uint8Array(await subtle.digest("SHA-256", bytes as BufferSource));
}

export interface SignlessInput {
  rpc: OneTapRpc;
  subtle: SubtleCrypto;
  signer: OneTapSigner;
  accountId: string;
  call: ContractCall;
  /** Highest nonce this browser already used for the key (the next one is above both it and the chain's). */
  lastNonce?: bigint;
  /** Called once, right before the first broadcast (telemetry `tx_submitted`). */
  onBroadcast?: () => void;
  gasPriceYocto?: bigint;
  /**
   * When set, the on-chain key must allow exactly these methods; any other list (e.g. a key made by
   * an older version that still allows `adopt`) is not used (`outdated`).
   */
  requireMethods?: readonly string[];
}

/**
 * Signs and sends one deposit-free call with the one-tap key: `view_access_key` (nonce, final block
 * hash, permission and allowance), Borsh, Ed25519 over sha256, then `send_tx` (wait until
 * `EXECUTED_OPTIMISTIC`, the near-api-js default). The same signed bytes go to the next RPC when one
 * gives no answer, which is safe: a transaction lands at most once.
 */
export async function sendSignless(input: SignlessInput): Promise<SignlessOutcome> {
  const { rpc, subtle, signer, accountId, call } = input;
  const method = call.methodName;
  const fallback = (reason: FallbackReason, broadcast = false): SignlessOutcome => ({ kind: "fallback", reason, notice: FALLBACK_NOTICE[reason], broadcast });
  if (BigInt(call.deposit) !== 0n) return fallback("deposit");

  let key = await readAccessKey(rpc, accountId, signer.publicKey);
  let maybeSent = false;
  let broadcast = false;
  let hash = "";
  // The nonce goes above everything known: the chain's (final, may lag a block or two), the highest
  // this browser used, and, after an InvalidNonce refusal, the `ak_nonce` the node reported.
  let knownFloor = input.lastNonce ?? 0n;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (key.kind === "missing") return fallback("key-missing", broadcast);
    // A retry only happens after a clean refusal, so nothing can have landed yet at this point.
    if (key.kind === "unreachable") return fallback("rpc-unreachable", broadcast);
    const perm = key.permission;
    if (perm.kind !== "FunctionCall" || perm.receiverId !== CONTRACT_ID) return fallback("receiver", broadcast);
    if (input.requireMethods && !sameList(perm.methodNames, input.requireMethods)) return fallback("outdated", broadcast);
    if (perm.methodNames.length > 0 && !perm.methodNames.includes(method)) return fallback("method", broadcast);
    const cost = BigInt(call.gas) * (input.gasPriceYocto ?? GAS_PRICE_FLOOR_YOCTO);
    if (perm.allowance !== null && perm.allowance < cost) return fallback("allowance", broadcast);

    const nonce = (key.nonce > knownFloor ? key.nonce : knownFloor) + 1n;
    const txBytes = encodeFunctionCallTx({
      signerId: accountId,
      publicKey: base58Decode(signer.publicKey.slice("ed25519:".length)),
      nonce,
      receiverId: CONTRACT_ID,
      blockHash: base58Decode(key.blockHash),
      methodName: method,
      args: new TextEncoder().encode(JSON.stringify(call.args)),
      gas: BigInt(call.gas),
      deposit: 0n,
    });
    const digest = await sha256(txBytes, subtle);
    hash = base58Encode(digest);
    const signature = await signer.sign(digest);
    const signed = toBase64(encodeSignedTx(txBytes, signature));

    if (!broadcast) input.onBroadcast?.();
    broadcast = true;
    const a = await rpcCall(rpc, "send_tx", { signed_tx_base64: signed, wait_until: "EXECUTED_OPTIMISTIC" }, rpc.timeoutMs ?? 20000);
    if (a.transportFailures > 0) maybeSent = true;
    if (a.kind === "result") {
      const r = readOutcome(a.result, method);
      return { kind: "sent", result: { ...r, txHash: r.txHash ?? hash, signless: true }, nonce };
    }
    if (a.kind === "transport") return notConfirmed(hash, a.reason, nonce);
    const c = classifySendError(a.error);
    const raw = textOf(a.error);
    if (c.included === "yes") {
      const { message, rejected } = humanizeTxError(raw, method);
      return { kind: "sent", result: { ok: false, txHash: hash, message, raw, rejected, signless: true }, nonce };
    }
    if (c.included === "maybe" || maybeSent) return notConfirmed(hash, raw, nonce);
    if (c.reason === "nonce" && attempt === 0) {
      // The tx was refused before it could land: sign again once, above the node's `ak_nonce`,
      // the nonce just tried, and a fresh read.
      const ak = invalidNonceAk(a.error);
      if (ak !== null && ak > knownFloor) knownFloor = ak;
      if (nonce > knownFloor) knownFloor = nonce;
      key = await readAccessKey(rpc, accountId, signer.publicKey);
      continue;
    }
    return fallback(c.reason, broadcast);
  }
  return fallback("nonce", broadcast);
}

function notConfirmed(hash: string, raw: string, nonce: bigint): SignlessOutcome {
  return {
    kind: "sent",
    result: { ok: false, txHash: hash || null, message: NOT_CONFIRMED_MESSAGE, raw, rejected: false, signless: true },
    nonce,
  };
}
