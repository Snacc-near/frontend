/**
 * Invite links (UI-158). A link `https://snacc-nu.vercel.app/app?ref=<account>` is remembered in localStorage for
 * seven days; once the visitor is signed in and has a profile, `snacc_claim_referral` attaches the referrer
 * (only possible before the new player's first recorded hatch). The referrer earns the cosmetic `recruiter`
 * badge when the friend hatches a first Snacc. No token, no XP, no money value: Snacc runs on NEAR testnet.
 *
 * Everything here is quiet by design: a bad link, a full storage or a failing call never throws and never
 * blocks sign-in. The module takes the storage and the clock as arguments so tests need no browser.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isNearAccountId } from "../route.ts";
import { safeLocalStorage, SIGN_IN_RECIPIENT } from "./config.ts";

export const REFERRAL_STORAGE_KEY = "snacc_referral";
export const REFERRAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** What `snacc_claim_referral()` answers (migration 0007). */
export const REFERRAL_STATUSES = ["claimed", "no_profile", "already_referred", "invalid_account", "unknown_referrer", "self_referral", "not_new_player"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
/** `skipped`: nothing stored, nothing asked. `error`: the call failed and the link stays stored for a retry. */
export type ClaimOutcome = ReferralStatus | "skipped" | "error";

/** The valid, lower-cased `ref` account in a query string such as `?ref=alice.testnet`; null otherwise. */
export function refFromSearch(search: string): string | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get("ref");
  } catch {
    return null;
  }
  const id = raw?.trim().toLowerCase() ?? "";
  return isNearAccountId(id) ? id : null;
}

/** Stores a valid `ref` from the query string (the newest link wins). Returns the stored account or null. */
export function captureReferral(search: string, store: Store | null = safeLocalStorage(), now: number = Date.now()): string | null {
  const account = refFromSearch(search);
  if (!account || !store) return null;
  try {
    store.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ account, at: now }));
    return account;
  } catch {
    return null;
  }
}

/** The stored referrer while it is younger than seven days; garbage and expired entries are removed. */
export function storedReferral(store: Store | null = safeLocalStorage(), now: number = Date.now()): string | null {
  if (!store) return null;
  try {
    const raw = store.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { account?: unknown; at?: unknown };
    const ok =
      typeof v.account === "string" &&
      isNearAccountId(v.account) &&
      typeof v.at === "number" &&
      Number.isFinite(v.at) &&
      now - v.at >= 0 &&
      now - v.at < REFERRAL_TTL_MS;
    if (ok) return v.account as string;
    store.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    try {
      store.removeItem(REFERRAL_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
  return null;
}

export function clearReferral(store: Store | null = safeLocalStorage()): void {
  try {
    store?.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Calls `snacc_claim_referral`; any transport or database error becomes `"error"`. */
export async function claimReferral(client: SupabaseClient, referrerAccount: string): Promise<ReferralStatus | "error"> {
  try {
    const { data, error } = await client.rpc("snacc_claim_referral", { p_referrer_account: referrerAccount });
    if (error) return "error";
    return (REFERRAL_STATUSES as readonly string[]).includes(String(data)) ? (data as ReferralStatus) : "error";
  } catch {
    return "error";
  }
}

/**
 * The sign-in follow-up: if a referrer is stored, ask the database once and forget the link on any definitive
 * answer. A failed call (`error`) and `no_profile` keep the link so a later visit can try again. Referring
 * yourself is dropped without a call. Never throws.
 */
export async function claimStoredReferral(
  client: SupabaseClient,
  ownAccount: string | null,
  store: Store | null = safeLocalStorage(),
  now: number = Date.now(),
): Promise<ClaimOutcome> {
  const account = storedReferral(store, now);
  if (!account) return "skipped";
  if (ownAccount && account === ownAccount.toLowerCase()) {
    clearReferral(store);
    return "self_referral";
  }
  const status = await claimReferral(client, account);
  if (status !== "error" && status !== "no_profile") clearReferral(store);
  return status;
}

// ------------------------------------------------------------------ the invite block

/** The link a player shares. The production origin on purpose, so a link copied on a preview still works. */
export function inviteUrl(account: string): string {
  return `https://${SIGN_IN_RECIPIENT}/app?ref=${encodeURIComponent(account)}`;
}

export const INVITE_TEXT = "Join me on Snacc, an on-chain game on NEAR testnet (no money value).";

/** The Web Share API entry for the invite, or null when the browser has none. Resolves false when the player cancels. */
export function inviteShare(account: string, nav: Pick<Navigator, "share"> | undefined = globalThis.navigator): (() => Promise<boolean>) | null {
  if (!nav || typeof nav.share !== "function") return null;
  return async () => {
    try {
      await nav.share({ title: "Snacc", text: INVITE_TEXT, url: inviteUrl(account) });
      return true;
    } catch {
      return false;
    }
  };
}

export interface RecruitCounts {
  recruits: number;
  recruitsHatched: number;
}

/** The player's recruit counts (`referral_counts_snacc`); zeros when nobody joined yet, null when the read failed. */
export async function referralCountsOf(client: SupabaseClient, userId: string): Promise<RecruitCounts | null> {
  try {
    const { data, error } = await client.from("referral_counts_snacc").select("recruits,recruits_hatched").eq("user_id", userId).maybeSingle();
    if (error) return null;
    if (!data) return { recruits: 0, recruitsHatched: 0 };
    const row = data as { recruits?: unknown; recruits_hatched?: unknown };
    return { recruits: Number(row.recruits) || 0, recruitsHatched: Number(row.recruits_hatched) || 0 };
  } catch {
    return null;
  }
}
