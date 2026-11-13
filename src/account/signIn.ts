/**
 * Sign in with NEAR (UI-148): the backend's `near-auth` function issues a NEP-413 challenge, the
 * wallet signs it, the backend checks the signature against the account's full-access keys and
 * returns a one-time token that `supabase.auth.verifyOtp` turns into a session.
 *
 * Pure: `fetch`, the wallet's `signMessage` and `verifyOtp` are passed in, so the flow is unit tested
 * without a network, a wallet or `@supabase/supabase-js`.
 */
import { functionUrl, type SupabaseConfig } from "./config.ts";

export interface SignMessageInput {
  message: string;
  recipient: string;
  /** 32 random bytes (NEP-413). */
  nonce: Uint8Array;
}
export interface SignedMessageOut {
  accountId: string;
  publicKey: string;
  signature: string;
}

export interface Challenge {
  nonce: string;
  message: string;
  recipient: string;
  expiresAt?: string;
}

export interface VerifyResult {
  tokenHash: string;
  type: "magiclink";
  nearAccountId: string;
}

/** A sign-in or account-service error with the plain message to show. */
export class AccountError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AccountError";
  }
}

/** Plain-language text for the backend error codes the player can act on. */
const FRIENDLY: Record<string, string> = {
  not_full_access_key:
    "Your wallet signed with a limited key (a function-call key), which cannot prove you own this account. Sign in from a wallet that holds the account's full-access key, then try again.",
  challenge_expired: "The sign-in request expired. Try again.",
  invalid_signature: "The wallet's signature did not check out. Try again, or try another wallet.",
};

export function friendlyError(code: string, message?: string | null): string {
  return FRIENDLY[code] ?? (message && message.trim() ? message.trim() : "The profile service returned an error. Try again later.");
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** POSTs JSON to a Supabase function; throws `AccountError` with the backend's `message` on failure. */
export async function postFunction<T>(
  cfg: SupabaseConfig,
  path: string,
  body: unknown,
  opts: { fetchFn?: FetchFn; accessToken?: string | null } = {},
): Promise<T> {
  const fetchFn = opts.fetchFn ?? ((i, init) => fetch(i, init));
  let res: Response;
  try {
    res = await fetchFn(functionUrl(cfg, path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.key,
        Authorization: `Bearer ${opts.accessToken ?? cfg.key}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AccountError("network", "Could not reach the profile service. Check the connection and try again.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const o = (data && typeof data === "object" ? data : {}) as { error?: unknown; message?: unknown };
    const code = typeof o.error === "string" ? o.error : `http_${res.status}`;
    throw new AccountError(code, friendlyError(code, typeof o.message === "string" ? o.message : null));
  }
  return data as T;
}

/** Decodes the challenge's base64 nonce; it must be exactly 32 bytes (NEP-413). */
export function decodeNonce(b64: string): Uint8Array {
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new AccountError("bad_challenge", "The sign-in request was malformed. Try again later.");
  }
  if (bin.length !== 32) throw new AccountError("bad_challenge", "The sign-in request was malformed. Try again later.");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** NEAR public keys travel as `ed25519:<base58>`; some wallets drop the prefix. */
export function normalizePublicKey(key: string): string {
  const k = key.trim();
  return k.includes(":") ? k : `ed25519:${k}`;
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface SignInDeps {
  cfg: SupabaseConfig;
  accountId: string;
  signMessage: (input: SignMessageInput) => Promise<SignedMessageOut>;
  verifyOtp: (input: { token_hash: string; type: "magiclink" }) => Promise<{ error: { message: string } | null }>;
  fetchFn?: FetchFn;
}

/** Runs challenge → wallet signature → verify → `verifyOtp`. Resolves with the verified account. */
export async function signInWithNear({ cfg, accountId, signMessage, verifyOtp, fetchFn }: SignInDeps): Promise<{ nearAccountId: string }> {
  const challenge = await postFunction<Challenge>(cfg, "near-auth/challenge", { accountId }, { fetchFn });
  if (!challenge || typeof challenge.message !== "string" || typeof challenge.recipient !== "string" || typeof challenge.nonce !== "string") {
    throw new AccountError("bad_challenge", "The sign-in request was malformed. Try again later.");
  }
  const nonce = decodeNonce(challenge.nonce);

  let signed: SignedMessageOut;
  try {
    signed = await signMessage({ message: challenge.message, recipient: challenge.recipient, nonce });
  } catch (e) {
    const msg = messageOf(e);
    if (/reject|cancel|denied|closed/i.test(msg)) throw new AccountError("rejected", "Sign-in cancelled in the wallet.");
    if (/not supported|unsupported|not implemented|signMessage/i.test(msg)) {
      throw new AccountError("unsupported", "This wallet cannot sign messages, so it cannot sign in. Try another NEAR wallet.");
    }
    throw new AccountError("wallet", `The wallet could not sign: ${msg}`);
  }
  if (!signed || typeof signed.signature !== "string" || typeof signed.publicKey !== "string") {
    throw new AccountError("wallet", "The wallet returned no signature.");
  }
  if (signed.accountId && signed.accountId !== accountId) {
    throw new AccountError("account_mismatch", `The wallet signed as ${signed.accountId}, not ${accountId}. Switch accounts and try again.`);
  }

  const verified = await postFunction<VerifyResult>(
    cfg,
    "near-auth/verify",
    {
      accountId,
      publicKey: normalizePublicKey(signed.publicKey),
      signature: signed.signature,
      nonce: challenge.nonce,
      message: challenge.message,
      recipient: challenge.recipient,
    },
    { fetchFn },
  );
  if (!verified || typeof verified.tokenHash !== "string") {
    throw new AccountError("bad_verify", "The profile service did not return a sign-in token.");
  }
  const { error } = await verifyOtp({ token_hash: verified.tokenHash, type: "magiclink" });
  if (error) throw new AccountError("otp", friendlyError("otp", error.message));
  return { nearAccountId: verified.nearAccountId ?? accountId };
}
