/**
 * Guest label: a display name kept in this browser only. It creates no NEAR account, holds no key
 * and signs nothing (the app has no wallet connection). If the player also types a valid
 * `.testnet` account id, the app uses it only to highlight that account's strains.
 */

export const GUEST_LABEL_KEY = "snacc_guest_label";
/** Key used by an earlier build that stored email addresses; removed on load. */
const LEGACY_SESSION_KEY = "snacc_auth_session";

export const MAX_LABEL_CHARS = 32;

export interface GuestLabel {
  label: string;
  /** Valid `.testnet` account to highlight, or null. */
  account: string | null;
}

/** NEAR account id rules (2–64 chars, lowercase parts joined by `.`), restricted to `.testnet`. */
const TESTNET_ACCOUNT_RE = /^(?=.{2,64}$)(?:[a-z\d]+[-_])*[a-z\d]+(?:\.(?:[a-z\d]+[-_])*[a-z\d]+)*\.testnet$/;

export function isTestnetAccount(value: string): boolean {
  return TESTNET_ACCOUNT_RE.test(value.trim());
}

/** Trims, drops control characters, collapses spaces and caps the length. */
export function sanitizeLabel(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_LABEL_CHARS);
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readGuestLabel(store: StorageLike | null = storage()): GuestLabel | null {
  if (!store) return null;
  try {
    store.removeItem(LEGACY_SESSION_KEY);
    const raw = store.getItem(GUEST_LABEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestLabel>;
    const label = sanitizeLabel(typeof parsed.label === "string" ? parsed.label : "");
    const account = typeof parsed.account === "string" && isTestnetAccount(parsed.account) ? parsed.account.trim() : null;
    return label || account ? { label, account } : null;
  } catch {
    return null;
  }
}

export function saveGuestLabel(next: GuestLabel, store: StorageLike | null = storage()): GuestLabel {
  const clean: GuestLabel = {
    label: sanitizeLabel(next.label),
    account: next.account && isTestnetAccount(next.account) ? next.account.trim() : null,
  };
  try {
    store?.setItem(GUEST_LABEL_KEY, JSON.stringify(clean));
  } catch {
    // storage full or blocked: the label still applies for this visit
  }
  return clean;
}

export function clearGuestLabel(store: StorageLike | null = storage()): void {
  try {
    store?.removeItem(GUEST_LABEL_KEY);
    store?.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // ignore
  }
}
