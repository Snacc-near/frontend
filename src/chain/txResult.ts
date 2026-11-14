/**
 * Reads a wallet's transaction result and turns contract panics into plain English (UI-146).
 * Wallets differ: some resolve with a `FinalExecutionOutcome` whose `status` holds a `Failure`,
 * others reject with an Error (or a string). Both paths end in `TxFailure`.
 *
 * UI-161 phase B2: the plain-language text lives in the `tx` dictionary (English and Indonesian) and is
 * read in the language chosen right now (`getLocale()`), so this file stays free of React. Which error a
 * raw text maps to (the regexes, the `ERR_*` codes, the method names) is unchanged.
 */
import { t } from "../i18n/catalog.ts";
import type { MessageKey } from "../i18n/catalog.ts";
import { getLocale } from "../i18n/locale.ts";

/** RES-111: set on results of a one-tap (signless) send, and on a wallet send that replaced one. */
interface TxExtras {
  /** True when this browser's one-tap key signed the transaction (no wallet popup). */
  signless?: boolean;
  /** One line explaining why a deposit-free action fell back to the wallet. */
  notice?: string;
}

export interface TxSuccess extends TxExtras {
  ok: true;
  txHash: string | null;
}

export interface TxFailure extends TxExtras {
  ok: false;
  txHash: string | null;
  /** Plain-language reason shown to the player (English or Indonesian). */
  message: string;
  /** Raw error text, shown in a details line. */
  raw: string;
  /** True when the player closed or rejected the wallet prompt. */
  rejected: boolean;
}

export type TxResult = TxSuccess | TxFailure;

/** Contract panic codes (`constants::ERR_*` in the contract) mapped to the dictionary key of the player-facing text. */
const CONTRACT_ERRORS: Record<string, MessageKey> = {
  ERR_INSUFFICIENT_DEPOSIT: "tx.errors.ERR_INSUFFICIENT_DEPOSIT",
  ERR_STAKE_DEPOSIT_MISMATCH: "tx.errors.ERR_STAKE_DEPOSIT_MISMATCH",
  ERR_INSUFFICIENT_BALANCE: "tx.errors.ERR_INSUFFICIENT_BALANCE",
  ERR_NOT_OWNED_BY_CALLEE: "tx.errors.ERR_NOT_OWNED_BY_CALLEE",
  ERR_NOT_STRAIN_OWNER: "tx.errors.ERR_NOT_STRAIN_OWNER",
  ERR_STRAIN_NOT_FOUND: "tx.errors.ERR_STRAIN_NOT_FOUND",
  ERR_STRAIN_STARVING: "tx.errors.ERR_STRAIN_STARVING",
  ERR_ROLE_MASK_NOT_SINGLE: "tx.errors.ERR_ROLE_MASK_NOT_SINGLE",
  ERR_ACCOUNT_NOT_REGISTERED: "tx.errors.ERR_ACCOUNT_NOT_REGISTERED",
  ERR_YOCTO_REQUIRED: "tx.errors.ERR_YOCTO_REQUIRED",
  ERR_ALREADY_LIQUIDATED: "tx.errors.ERR_ALREADY_LIQUIDATED",
  ERR_COLONY_FULL: "tx.errors.ERR_COLONY_FULL",
  ERR_BAD_AMOUNT: "tx.errors.ERR_BAD_AMOUNT",
  // UI-150 (codes from `contracts/snacc/src/state.rs` `constants`).
  ERR_NOT_ENOUGH_ATP: "tx.errors.ERR_NOT_ENOUGH_ATP",
  ERR_ALREADY_ALLOCATED: "tx.errors.ERR_ALREADY_ALLOCATED",
  ERR_ORGANEL_LEVEL_MAX: "tx.errors.ERR_ORGANEL_LEVEL_MAX",
  ERR_STRAIN_ALREADY_SPLICED: "tx.errors.ERR_STRAIN_ALREADY_SPLICED",
  ERR_MAX_GENERATION: "tx.errors.ERR_MAX_GENERATION",
  ERR_BIRTHS_EXCEEDED: "tx.errors.ERR_BIRTHS_EXCEEDED",
  ERR_ROLE_NOT_ALLOWED: "tx.errors.ERR_ROLE_NOT_ALLOWED",
  ERR_UNKNOWN_TOKEN: "tx.errors.ERR_UNKNOWN_TOKEN",
  ERR_RECIPE_NOT_MET: "tx.errors.ERR_RECIPE_NOT_MET",
  ERR_REQUIRES_TEE_ATTESTATION: "tx.errors.ERR_REQUIRES_TEE_ATTESTATION",
  ERR_NPC_UNKNOWN: "tx.errors.ERR_NPC_UNKNOWN",
  ERR_NPC_OUT_OF_STOCK: "tx.errors.ERR_NPC_OUT_OF_STOCK",
  ERR_SAME_STRAIN: "tx.errors.ERR_SAME_STRAIN",
  ERR_NOT_SAME_OWNER: "tx.errors.ERR_NOT_SAME_OWNER",
  ERR_NOT_DISTRESSED: "tx.errors.ERR_NOT_DISTRESSED",
  ERR_STRAIN_NOT_INSOLVENT: "tx.errors.ERR_STRAIN_NOT_INSOLVENT",
  ERR_STATE_NONCE_CHANGED_SELLER_DRAIN_BLOCKED: "tx.errors.ERR_STATE_NONCE_CHANGED_SELLER_DRAIN_BLOCKED",
  ERR_PENDING_ASYNC_CALLBACK_LOCKED: "tx.errors.ERR_PENDING_ASYNC_CALLBACK_LOCKED",
  ERR_ROLE_LOCKED_NEEDS_SYNTHESIZER_GENE: "tx.errors.ERR_ROLE_LOCKED_NEEDS_SYNTHESIZER_GENE",
  ERR_INSUFFICIENT_AETHER: "tx.errors.ERR_INSUFFICIENT_AETHER",
  ERR_EPOCH_NOT_CLOSED: "tx.errors.ERR_EPOCH_NOT_CLOSED",
  ERR_DIVIDEND_ALREADY_CLAIMED: "tx.errors.ERR_DIVIDEND_ALREADY_CLAIMED",
  ERR_DIVIDEND_CLAIM_EXPIRED: "tx.errors.ERR_DIVIDEND_CLAIM_EXPIRED",
  ERR_DIVIDEND_POOL_EMPTY: "tx.errors.ERR_DIVIDEND_POOL_EMPTY",
  // UI-164 (codes from `contracts/market/src/lib.rs`).
  ERR_LISTING_NOT_FOUND: "tx.errors.ERR_LISTING_NOT_FOUND",
  ERR_SELLER_CANNOT_BUY: "tx.errors.ERR_SELLER_CANNOT_BUY",
  ERR_NOT_SELLER: "tx.errors.ERR_NOT_SELLER",
  ERR_BAD_PRICE: "tx.errors.ERR_BAD_PRICE",
  ERR_MORE_GAS_REQUIRED: "tx.errors.ERR_MORE_GAS_REQUIRED",
  ERR_LISTINGS_PAUSED: "tx.errors.ERR_LISTINGS_PAUSED",
  ERR_ALREADY_LISTED: "tx.errors.ERR_ALREADY_LISTED",
  ERR_SELLER_LISTING_CAP: "tx.errors.ERR_SELLER_LISTING_CAP",
  ERR_MARKET_FULL: "tx.errors.ERR_MARKET_FULL",
  ERR_BAD_MSG: "tx.errors.ERR_BAD_MSG",
  ERR_NOT_NFT_CONTRACT: "tx.errors.ERR_NOT_NFT_CONTRACT",
  ERR_NOT_OWNER: "tx.errors.ERR_NOT_OWNER",
};

/**
 * The same code can mean something different per method (e.g. `ERR_STAKE_DEPOSIT_MISMATCH` is the
 * catalyst fee on the production chain). Looked up before the generic table.
 */
const METHOD_ERRORS: Record<string, Record<string, MessageKey>> = {
  extract_spores: { ERR_STAKE_DEPOSIT_MISMATCH: "tx.methods.extract_spores.ERR_STAKE_DEPOSIT_MISMATCH" },
  synthesize_elixir: {
    ERR_STAKE_DEPOSIT_MISMATCH: "tx.methods.synthesize_elixir.ERR_STAKE_DEPOSIT_MISMATCH",
    ERR_INSUFFICIENT_BALANCE: "tx.methods.synthesize_elixir.ERR_INSUFFICIENT_BALANCE",
  },
  transmute_spores_to_enzyme: {
    ERR_STAKE_DEPOSIT_MISMATCH: "tx.methods.transmute_spores_to_enzyme.ERR_STAKE_DEPOSIT_MISMATCH",
    ERR_INSUFFICIENT_BALANCE: "tx.methods.transmute_spores_to_enzyme.ERR_INSUFFICIENT_BALANCE",
  },
  npc_buy_spores: {
    ERR_INSUFFICIENT_BALANCE: "tx.methods.npc_buy_spores.ERR_INSUFFICIENT_BALANCE",
    ERR_NOT_OWNED_BY_CALLEE: "tx.methods.npc_buy_spores.ERR_NOT_OWNED_BY_CALLEE",
  },
  adopt: {
    ERR_INSUFFICIENT_BALANCE: "tx.methods.adopt.ERR_INSUFFICIENT_BALANCE",
    ERR_NOT_OWNED_BY_CALLEE: "tx.methods.adopt.ERR_NOT_OWNED_BY_CALLEE",
    ERR_COLONY_FULL: "tx.methods.adopt.ERR_COLONY_FULL",
  },
  hostile_takeover_splice: {
    ERR_INSUFFICIENT_BALANCE: "tx.methods.hostile_takeover_splice.ERR_INSUFFICIENT_BALANCE",
    ERR_NOT_OWNED_BY_CALLEE: "tx.methods.hostile_takeover_splice.ERR_NOT_OWNED_BY_CALLEE",
  },
  splice_strains: { ERR_NOT_OWNED_BY_CALLEE: "tx.methods.splice_strains.ERR_NOT_OWNED_BY_CALLEE" },
  divide_strain: { ERR_NOT_OWNED_BY_CALLEE: "tx.methods.divide_strain.ERR_NOT_OWNED_BY_CALLEE" },
  allocate_atp: { ERR_NOT_OWNED_BY_CALLEE: "tx.methods.allocate_atp.ERR_NOT_OWNED_BY_CALLEE" },
  ft_transfer: {
    ERR_ACCOUNT_NOT_REGISTERED: "tx.methods.ft_transfer.ERR_ACCOUNT_NOT_REGISTERED",
    ERR_INSUFFICIENT_BALANCE: "tx.methods.ft_transfer.ERR_INSUFFICIENT_BALANCE",
  },
  nft_transfer: {
    ERR_SAME_STRAIN: "tx.methods.nft_transfer.ERR_SAME_STRAIN",
    ERR_NOT_OWNED_BY_CALLEE: "tx.methods.nft_transfer.ERR_NOT_OWNED_BY_CALLEE",
    ERR_ALREADY_LIQUIDATED: "tx.methods.nft_transfer.ERR_ALREADY_LIQUIDATED",
  },
  // UI-164: the market calls.
  nft_transfer_call: {
    ERR_NOT_OWNED_BY_CALLEE: "tx.methods.nft_transfer_call.ERR_NOT_OWNED_BY_CALLEE",
    ERR_ALREADY_LIQUIDATED: "tx.methods.nft_transfer_call.ERR_ALREADY_LIQUIDATED",
    ERR_SAME_STRAIN: "tx.methods.nft_transfer_call.ERR_SAME_STRAIN",
  },
  buy: { ERR_INSUFFICIENT_DEPOSIT: "tx.methods.buy.ERR_INSUFFICIENT_DEPOSIT" },
};

const REJECT_PATTERNS = [/user rejected/i, /rejected by user/i, /user cancel/i, /cancelled/i, /canceled/i, /closed the (window|popup)/i, /user denied/i];

function stringify(value: unknown): string {
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Maps a raw error text to a short message in the current language; unknown errors get a generic line. */
export function humanizeTxError(raw: string, method?: string): { message: string; rejected: boolean } {
  const say = (key: MessageKey, vars?: Record<string, string>) => t(getLocale(), key, vars);
  if (REJECT_PATTERNS.some((p) => p.test(raw))) return { message: say("tx.rejected"), rejected: true };
  const code = /ERR_[A-Z0-9_]+/.exec(raw)?.[0];
  const specific = code && method ? METHOD_ERRORS[method]?.[code] : undefined;
  if (specific) return { message: say(specific), rejected: false };
  if (code && CONTRACT_ERRORS[code]) return { message: say(CONTRACT_ERRORS[code]), rejected: false };
  if (code) return { message: say("tx.refused", { code }), rejected: false };
  if (/NotEnoughBalance|LackBalanceForState|not enough balance/i.test(raw)) {
    return { message: say("tx.notEnoughNear"), rejected: false };
  }
  if (/Exceeded the prepaid gas|GasExceeded/i.test(raw)) return { message: say("tx.outOfGas"), rejected: false };
  if (/No accounts found|not signed in|wallet not found/i.test(raw)) return { message: say("tx.notConnected"), rejected: false };
  return { message: say("tx.failed"), rejected: false };
}

interface OutcomeLike {
  transaction?: { hash?: string };
  transaction_outcome?: { id?: string };
  status?: unknown;
  receipts_outcome?: Array<{ outcome?: { status?: unknown } }>;
}

function hashOf(o: OutcomeLike | null | undefined): string | null {
  return o?.transaction?.hash ?? o?.transaction_outcome?.id ?? null;
}

function failureOf(status: unknown): unknown | null {
  if (status && typeof status === "object" && "Failure" in (status as Record<string, unknown>)) return (status as { Failure: unknown }).Failure;
  return null;
}

/** Reads a `FinalExecutionOutcome` (or an array of them) returned by the wallet. */
export function readOutcome(outcome: unknown, method?: string): TxResult {
  const list = (Array.isArray(outcome) ? outcome : [outcome]) as OutcomeLike[];
  const last = list[list.length - 1] ?? null;
  for (const o of list) {
    const fail = failureOf(o?.status) ?? o?.receipts_outcome?.map((r) => failureOf(r.outcome?.status)).find((f) => f !== null) ?? null;
    if (fail !== null) {
      const raw = stringify(fail);
      const { message, rejected } = humanizeTxError(raw, method);
      return { ok: false, txHash: hashOf(o), message, raw, rejected };
    }
  }
  return { ok: true, txHash: hashOf(last) };
}

/** Turns a thrown wallet error into a `TxFailure`. */
export function readThrown(error: unknown, method?: string): TxFailure {
  const raw = stringify(error);
  const { message, rejected } = humanizeTxError(raw, method);
  return { ok: false, txHash: null, message, raw, rejected };
}
