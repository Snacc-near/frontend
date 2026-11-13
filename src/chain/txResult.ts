/**
 * Reads a wallet's transaction result and turns contract panics into plain English (UI-146).
 * Wallets differ: some resolve with a `FinalExecutionOutcome` whose `status` holds a `Failure`,
 * others reject with an Error (or a string). Both paths end in `TxFailure`.
 */

export interface TxSuccess {
  ok: true;
  txHash: string | null;
}

export interface TxFailure {
  ok: false;
  txHash: string | null;
  /** Plain-English reason shown to the player. */
  message: string;
  /** Raw error text, shown in a details line. */
  raw: string;
  /** True when the player closed or rejected the wallet prompt. */
  rejected: boolean;
}

export type TxResult = TxSuccess | TxFailure;

/** Contract panic codes (`constants::ERR_*` in the contract) mapped to player-facing text. */
const CONTRACT_ERRORS: Record<string, string> = {
  ERR_INSUFFICIENT_DEPOSIT: "The attached NEAR is below what this action needs.",
  ERR_STAKE_DEPOSIT_MISMATCH: "The stake must equal the NEAR you attach.",
  ERR_INSUFFICIENT_BALANCE: "Not enough $SNACC for this. Try a smaller amount.",
  ERR_NOT_OWNED_BY_CALLEE: "You can only feed a Snacc you own.",
  ERR_NOT_STRAIN_OWNER: "You can only do this with a Snacc you own.",
  ERR_STRAIN_NOT_FOUND: "That Snacc does not exist on this contract.",
  ERR_STRAIN_STARVING: "This Snacc has starved (vitality 0) and can no longer be fed.",
  ERR_ROLE_MASK_NOT_SINGLE: "Pick exactly one role for a new Snacc.",
  ERR_ACCOUNT_NOT_REGISTERED: "Your account is not registered with the contract yet.",
  ERR_YOCTO_REQUIRED: "This action needs exactly 1 yoctoNEAR attached.",
  ERR_ALREADY_LIQUIDATED: "This Snacc has already been liquidated.",
  ERR_COLONY_FULL: "Your colony is full.",
  ERR_BAD_AMOUNT: "That amount is not valid.",
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

/** Maps a raw error text to a short message; unknown errors get a generic line. */
export function humanizeTxError(raw: string): { message: string; rejected: boolean } {
  if (REJECT_PATTERNS.some((p) => p.test(raw))) return { message: "You closed or rejected the wallet request. Nothing was sent.", rejected: true };
  const code = /ERR_[A-Z0-9_]+/.exec(raw)?.[0];
  if (code && CONTRACT_ERRORS[code]) return { message: CONTRACT_ERRORS[code], rejected: false };
  if (code) return { message: `The contract refused the call (${code}).`, rejected: false };
  if (/NotEnoughBalance|LackBalanceForState|not enough balance/i.test(raw)) {
    return { message: "Your account does not have enough testnet NEAR for this transaction.", rejected: false };
  }
  if (/Exceeded the prepaid gas|GasExceeded/i.test(raw)) return { message: "The transaction ran out of gas.", rejected: false };
  if (/No accounts found|not signed in|wallet not found/i.test(raw)) return { message: "The wallet is not connected. Connect it again.", rejected: false };
  return { message: "The transaction did not go through.", rejected: false };
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
export function readOutcome(outcome: unknown): TxResult {
  const list = (Array.isArray(outcome) ? outcome : [outcome]) as OutcomeLike[];
  const last = list[list.length - 1] ?? null;
  for (const o of list) {
    const fail = failureOf(o?.status) ?? o?.receipts_outcome?.map((r) => failureOf(r.outcome?.status)).find((f) => f !== null) ?? null;
    if (fail !== null) {
      const raw = stringify(fail);
      const { message, rejected } = humanizeTxError(raw);
      return { ok: false, txHash: hashOf(o), message, raw, rejected };
    }
  }
  return { ok: true, txHash: hashOf(last) };
}

/** Turns a thrown wallet error into a `TxFailure`. */
export function readThrown(error: unknown): TxFailure {
  const raw = stringify(error);
  const { message, rejected } = humanizeTxError(raw);
  return { ok: false, txHash: null, message, raw, rejected };
}
