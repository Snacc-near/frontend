/**
 * Player accounts (UI-148): profile, sign-in with NEAR, notifications, achievements and activity live
 * in a Supabase project. Everything here is optional: without both `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_PUBLISHABLE_KEY` the features stay hidden and the game works as before.
 *
 * This file is pure (no Supabase import) so the entry and game chunks can check the gate without
 * pulling in `@supabase/supabase-js`, which only loads in its own lazy chunk (see `client.ts`).
 */

export interface SupabaseConfig {
  /** Project URL, e.g. `https://<ref>.supabase.co`, without a trailing slash. */
  url: string;
  /** Publishable (anon) key. Public by design; access is enforced by row-level security. */
  key: string;
}

/** localStorage key the Supabase client keeps the profile session under. */
export const SESSION_STORAGE_KEY = "snacc_profile_session";
/** localStorage flag: the player turned on browser alerts for notifications (after a click). */
export const BROWSER_ALERTS_KEY = "snacc_browser_alerts";

/** The `recipient` the sign-in message is bound to (NEP-413), as the backend issues it. */
export const SIGN_IN_RECIPIENT = "snacc-nu.vercel.app";

type Env = Record<string, string | boolean | undefined>;

/** Reads the two env vars; null (features off) unless both are non-empty and the URL is https. */
export function supabaseConfigFrom(env: Env): SupabaseConfig | null {
  const url = typeof env.VITE_SUPABASE_URL === "string" ? env.VITE_SUPABASE_URL.trim().replace(/\/+$/, "") : "";
  const key = typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === "string" ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : "";
  if (!url || !key) return null;
  if (!/^https:\/\/[^/\s]+$/.test(url)) return null;
  return { url, key };
}

/** The build's config (`import.meta.env`), or null when the profile features are off. */
export function supabaseConfig(): SupabaseConfig | null {
  return supabaseConfigFrom(import.meta.env as unknown as Env);
}

export const functionUrl = (cfg: SupabaseConfig, path: string) => `${cfg.url}/functions/v1/${path.replace(/^\/+/, "")}`;

/** True when this browser holds a stored profile session (checked without loading Supabase). */
export function hasStoredSession(store: Pick<Storage, "getItem"> | null = safeLocalStorage()): boolean {
  try {
    return Boolean(store?.getItem(SESSION_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Public profile address for a NEAR account, e.g. `https://snacc-nu.vercel.app/p/alice.testnet`. */
export function profileUrl(accountId: string, origin = typeof window !== "undefined" ? window.location.origin : "https://snacc-nu.vercel.app"): string {
  return `${origin}/p/${encodeURIComponent(accountId)}`;
}
export const profilePath = (accountId: string) => `/p/${encodeURIComponent(accountId)}`;
export const snaccPath = (strainId: number) => `/snacc/${strainId}`;
