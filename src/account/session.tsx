/**
 * Player session (UI-148): `SessionProvider` + `useAccount()`.
 *
 * - Off (no `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`): `enabled` is false and every
 *   account feature hides itself.
 * - `@supabase/supabase-js` loads in its own chunk, only once a wallet is connected, a stored session
 *   exists, or a public page asks for a read (`ensureClient`).
 * - Sign-in is the NEAR flow in `signIn.ts`; sign-out clears only the Supabase session, never the
 *   wallet. When the connected wallet is a different account than the session's, the session is
 *   dropped.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useWallet } from "../chain/wallet.tsx";
import { hasStoredSession, supabaseConfig, type SupabaseConfig } from "./config.ts";
import { AccountError, signInWithNear } from "./signIn.ts";
import { recordTx as postRecordTx, type ProfileRow } from "./model.ts";
import { profileByUser } from "./api.ts";
import { track } from "../telemetry.ts";
import { claimStoredReferral } from "./referral.ts";
import { detachThisDevice } from "../push/client.ts";

export type AccountStatus = "off" | "idle" | "loading" | "signing" | "signed-in";

export interface AccountApi {
  enabled: boolean;
  status: AccountStatus;
  cfg: SupabaseConfig | null;
  client: SupabaseClient | null;
  userId: string | null;
  accessToken: string | null;
  /** NEAR account the session belongs to (from the profile row or the sign-in answer). */
  nearAccountId: string | null;
  profile: ProfileRow | null;
  error: string | null;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (row: ProfileRow | null) => void;
  /** Loads the client for public reads (no session needed); null when the features are off. */
  ensureClient: () => Promise<SupabaseClient | null>;
  /** Fire and forget `record-tx`; resolves with newly earned achievement codes (never rejects). */
  recordTx: (txHash: string | null | undefined) => Promise<string[]>;
}

const noop = async () => undefined;

export const ACCOUNT_OFF: AccountApi = {
  enabled: false,
  status: "off",
  cfg: null,
  client: null,
  userId: null,
  accessToken: null,
  nearAccountId: null,
  profile: null,
  error: null,
  signIn: async () => false,
  signOut: noop,
  refreshProfile: noop,
  setProfile: () => undefined,
  ensureClient: async () => null,
  recordTx: async () => [],
};

export const AccountContext = createContext<AccountApi>(ACCOUNT_OFF);

export function useAccount(): AccountApi {
  return useContext(AccountContext);
}

let clientPromise: Promise<SupabaseClient> | null = null;
/** Loads `client.ts` (and with it `@supabase/supabase-js`) on first use. */
export function loadClient(cfg: SupabaseConfig): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import("./client.ts")
      .then((m) => m.getClient(cfg))
      .catch((e) => {
        clientPromise = null;
        throw e;
      });
  }
  return clientPromise;
}

interface SessionLike {
  access_token: string;
  user: { id: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> };
}

function accountFromSession(s: SessionLike | null): string | null {
  const m = { ...(s?.user.app_metadata ?? {}), ...(s?.user.user_metadata ?? {}) };
  const v = m.near_account_id ?? m.nearAccountId;
  return typeof v === "string" ? v : null;
}

export function SessionProvider({ children, config }: { children: ReactNode; config?: SupabaseConfig | null }) {
  const cfg = useMemo(() => (config === undefined ? supabaseConfig() : config), [config]);
  const wallet = useWallet();
  const walletConnected = wallet.status === "connected" && wallet.accountId !== null;
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<SessionLike | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [signedAs, setSignedAs] = useState<string | null>(null);
  const [status, setStatus] = useState<AccountStatus>(cfg ? "idle" : "off");
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SessionLike | null>(null);
  sessionRef.current = session;

  const ensureClient = useCallback(async () => {
    if (!cfg) return null;
    try {
      const c = await loadClient(cfg);
      setClient((prev) => prev ?? c);
      return c;
    } catch {
      return null;
    }
  }, [cfg]);

  // Load the client once a wallet is connected or a stored session exists; never on the landing page.
  const wantClient = Boolean(cfg) && (walletConnected || hasStoredSession());
  useEffect(() => {
    if (!wantClient || client) return;
    void ensureClient();
  }, [wantClient, client, ensureClient]);

  // Follow the auth state of the loaded client.
  useEffect(() => {
    if (!client) return;
    let alive = true;
    setStatus((s) => (s === "signing" ? s : "loading"));
    void client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const s = (data.session as SessionLike | null) ?? null;
      setSession(s);
      setStatus((prev) => (prev === "signing" ? prev : s ? "signed-in" : "idle"));
    });
    const { data } = client.auth.onAuthStateChange((_event, s) => {
      if (!alive) return;
      setSession((s as SessionLike | null) ?? null);
      setStatus((prev) => (prev === "signing" ? prev : s ? "signed-in" : "idle"));
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const userId = session?.user.id ?? null;

  const refreshProfile = useCallback(async () => {
    if (!client || !userId) {
      setProfile(null);
      return;
    }
    const row = await profileByUser(client, userId).catch(() => null);
    setProfile(row);
  }, [client, userId]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  // UI-158: once per signed-in user and page load, attach the invite link stored from `?ref=` (if any). Quiet by
  // design: every answer is ignored and a failure never touches the sign-in state.
  const claimedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!client || !userId || !profile || claimedFor.current === userId) return;
    claimedFor.current = userId;
    void claimStoredReferral(client, profile.near_account_id).catch(() => undefined);
  }, [client, userId, profile]);

  const nearAccountId = profile?.near_account_id ?? signedAs ?? accountFromSession(session);

  const signOut = useCallback(async () => {
    setError(null);
    // UI-160: this device stops receiving the leaving player's push notifications (no-op without a push subscription).
    if (cfg && client) await detachThisDevice(cfg, async () => (await client.auth.getSession()).data.session?.access_token ?? null);
    try {
      await client?.auth.signOut({ scope: "local" });
    } catch {
      /* the local session is cleared below either way */
    }
    setSession(null);
    setProfile(null);
    setSignedAs(null);
    setStatus(cfg ? "idle" : "off");
  }, [client, cfg]);

  // A session that belongs to another NEAR account than the connected wallet is dropped.
  useEffect(() => {
    if (!session || !walletConnected || !nearAccountId) return;
    if (nearAccountId !== wallet.accountId) void signOut();
  }, [session, walletConnected, nearAccountId, wallet.accountId, signOut]);

  const signIn = useCallback(async () => {
    setError(null);
    if (!cfg) return false;
    if (!wallet.accountId || wallet.status !== "connected") {
      setError("Connect a wallet first.");
      return false;
    }
    setStatus("signing");
    try {
      const c = (await ensureClient()) ?? null;
      if (!c) throw new AccountError("load", "Could not load the profile service. Try again later.");
      const { nearAccountId: who } = await signInWithNear({
        cfg,
        accountId: wallet.accountId,
        signMessage: wallet.signMessage,
        verifyOtp: (p) => c.auth.verifyOtp(p),
      });
      const { data } = await c.auth.getSession();
      setSignedAs(who);
      setSession((data.session as SessionLike | null) ?? null);
      setStatus(data.session ? "signed-in" : "idle");
      if (data.session) track("signed_in");
      return Boolean(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(sessionRef.current ? "signed-in" : "idle");
      return false;
    }
  }, [cfg, wallet.accountId, wallet.status, wallet.signMessage, ensureClient]);

  const accessToken = session?.access_token ?? null;
  const recordTx = useCallback(
    async (txHash: string | null | undefined) => (await postRecordTx(cfg, accessToken, txHash)).achievements,
    [cfg, accessToken],
  );

  const value = useMemo<AccountApi>(
    () =>
      cfg
        ? {
            enabled: true,
            status,
            cfg,
            client,
            userId,
            accessToken,
            nearAccountId,
            profile,
            error,
            signIn,
            signOut,
            refreshProfile,
            setProfile,
            ensureClient,
            recordTx,
          }
        : ACCOUNT_OFF,
    [cfg, status, client, userId, accessToken, nearAccountId, profile, error, signIn, signOut, refreshProfile, ensureClient, recordTx],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** Display name for the account chip: the username when set, else the NEAR account. */
export function accountLabel(a: Pick<AccountApi, "profile" | "nearAccountId">): string {
  return a.profile?.username || a.nearAccountId || "signed in";
}
