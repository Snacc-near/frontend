import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { selectRoute, parsePublicPath } from "../src/route.ts";
import { supabaseConfigFrom, profilePath, profileUrl, SIGN_IN_RECIPIENT, type SupabaseConfig } from "../src/account/config.ts";
import { AccountError, decodeNonce, normalizePublicKey, signInWithNear, type SignMessageInput } from "../src/account/signIn.ts";
import {
  achievementToast,
  claimStarterPack,
  mergeNames,
  rankActivity,
  recordTx,
  usernameProblem,
  bioProblem,
  STARTER_MESSAGES,
} from "../src/account/model.ts";
import { ACCOUNT_OFF, SessionProvider, useAccount } from "../src/account/session.tsx";
import { AccountChip, StarterPackButton } from "../src/hud/AccountChip.tsx";
import { ToolsToolbar } from "../src/hud/ToolsToolbar.tsx";
import { WalletContext, DISCONNECTED_WALLET, type WalletApi } from "../src/chain/wallet.tsx";
import { strainFromSearch } from "../src/App.tsx";

const CFG: SupabaseConfig = { url: "https://vldhsabgpfxccsljdtye.supabase.co", key: "sb_publishable_test" };
const NONCE = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const NONCE_B64 = Buffer.from(NONCE).toString("base64");

type Call = { url: string; init: RequestInit | undefined; body: Record<string, unknown> | null };

function fakeFetch(routes: Record<string, { status: number; body: unknown } | (() => never)>) {
  const calls: Call[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null });
    const path = url.replace(`${CFG.url}/functions/v1/`, "");
    const r = routes[path];
    if (!r) return new Response(JSON.stringify({ error: "not_found", message: "no route" }), { status: 404 });
    if (typeof r === "function") return r();
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  };
  return { fn, calls };
}

const challengeOk = {
  status: 200,
  body: { nonce: NONCE_B64, message: "Sign in to Snacc as alice.testnet", recipient: SIGN_IN_RECIPIENT, expiresAt: "2026-11-13T15:00:00Z" },
};

describe("UI-148 sign in with NEAR", () => {
  it("signs the challenge (message, recipient, 32-byte nonce) and posts the verify payload, then verifyOtp", async () => {
    const { fn, calls } = fakeFetch({
      "near-auth/challenge": challengeOk,
      "near-auth/verify": { status: 200, body: { tokenHash: "th_123", type: "magiclink", nearAccountId: "alice.testnet" } },
    });
    const signed: SignMessageInput[] = [];
    const signMessage = vi.fn(async (input: SignMessageInput) => {
      signed.push(input);
      return { accountId: "alice.testnet", publicKey: "ed25519:8hSHprDq2StXwMtNd43wDTXQYsjXcD4MJTXQYsjXcD4M", signature: "c2lnbmF0dXJl" };
    });
    const verifyOtp = vi.fn(async () => ({ error: null }));
    const out = await signInWithNear({ cfg: CFG, accountId: "alice.testnet", signMessage, verifyOtp, fetchFn: fn });

    expect(out).toEqual({ nearAccountId: "alice.testnet" });
    expect(calls.map((c) => c.url)).toEqual([`${CFG.url}/functions/v1/near-auth/challenge`, `${CFG.url}/functions/v1/near-auth/verify`]);
    expect(calls[0].body).toEqual({ accountId: "alice.testnet" });
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.apikey).toBe(CFG.key);
    expect(calls[0].init?.method).toBe("POST");

    expect(signed).toHaveLength(1);
    expect(signed[0].message).toBe("Sign in to Snacc as alice.testnet");
    expect(signed[0].recipient).toBe("snacc-nu.vercel.app");
    expect(signed[0].nonce).toBeInstanceOf(Uint8Array);
    expect(Array.from(signed[0].nonce)).toEqual(Array.from(NONCE));

    expect(calls[1].body).toEqual({
      accountId: "alice.testnet",
      publicKey: "ed25519:8hSHprDq2StXwMtNd43wDTXQYsjXcD4MJTXQYsjXcD4M",
      signature: "c2lnbmF0dXJl",
      nonce: NONCE_B64,
      message: "Sign in to Snacc as alice.testnet",
      recipient: "snacc-nu.vercel.app",
    });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "th_123", type: "magiclink" });
  });

  it("explains a limited-key signature plainly (not_full_access_key)", async () => {
    const { fn } = fakeFetch({
      "near-auth/challenge": challengeOk,
      "near-auth/verify": { status: 401, body: { error: "not_full_access_key", message: "key is a function call key" } },
    });
    const err = await signInWithNear({
      cfg: CFG,
      accountId: "alice.testnet",
      signMessage: async () => ({ accountId: "alice.testnet", publicKey: "ed25519:abc", signature: "c2ln" }),
      verifyOtp: async () => ({ error: null }),
      fetchFn: fn,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AccountError);
    expect(err.code).toBe("not_full_access_key");
    expect(err.message).toMatch(/limited key/);
    expect(err.message).toMatch(/full-access key/);
  });

  it("shows the backend message for other errors, and maps rejection, network and account mismatch", async () => {
    const other = fakeFetch({ "near-auth/challenge": { status: 429, body: { error: "rate_limited", message: "Too many sign-in attempts." } } });
    const base = { cfg: CFG, accountId: "alice.testnet", verifyOtp: async () => ({ error: null }) };
    const sig = async () => ({ accountId: "alice.testnet", publicKey: "abc", signature: "c2ln" });
    await expect(signInWithNear({ ...base, signMessage: sig, fetchFn: other.fn })).rejects.toThrow("Too many sign-in attempts.");

    const ok = fakeFetch({ "near-auth/challenge": challengeOk });
    await expect(
      signInWithNear({
        ...base,
        signMessage: async () => {
          throw new Error("User rejected the request");
        },
        fetchFn: ok.fn,
      }),
    ).rejects.toThrow("Sign-in cancelled in the wallet.");
    await expect(signInWithNear({ ...base, signMessage: async () => ({ accountId: "bob.testnet", publicKey: "k", signature: "s" }), fetchFn: ok.fn })).rejects.toThrow(/bob\.testnet/);

    const down = fakeFetch({
      "near-auth/challenge": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await expect(signInWithNear({ ...base, signMessage: sig, fetchFn: down.fn })).rejects.toThrow(/Could not reach the profile service/);
  });

  it("refuses a nonce that is not 32 bytes and adds the ed25519 prefix when a wallet drops it", () => {
    expect(Array.from(decodeNonce(NONCE_B64))).toEqual(Array.from(NONCE));
    expect(() => decodeNonce(Buffer.from([1, 2, 3]).toString("base64"))).toThrow(AccountError);
    expect(normalizePublicKey("abc")).toBe("ed25519:abc");
    expect(normalizePublicKey("ed25519:abc")).toBe("ed25519:abc");
  });

  it("passes a verifyOtp error through as a plain message", async () => {
    const { fn } = fakeFetch({ "near-auth/challenge": challengeOk, "near-auth/verify": { status: 200, body: { tokenHash: "t", type: "magiclink", nearAccountId: "alice.testnet" } } });
    await expect(
      signInWithNear({
        cfg: CFG,
        accountId: "alice.testnet",
        signMessage: async () => ({ accountId: "alice.testnet", publicKey: "k", signature: "s" }),
        verifyOtp: async () => ({ error: { message: "Token has expired or is invalid" } }),
        fetchFn: fn,
      }),
    ).rejects.toThrow("Token has expired or is invalid");
  });
});

describe("UI-148 username and bio", () => {
  it("accepts ^[a-z0-9_]{3,20}$ only", () => {
    expect(usernameProblem("alice_01")).toBeNull();
    expect(usernameProblem("abc")).toBeNull();
    expect(usernameProblem("a".repeat(20))).toBeNull();
    expect(usernameProblem("")).toMatch(/Pick/);
    expect(usernameProblem("ab")).toMatch(/At least 3/);
    expect(usernameProblem("a".repeat(21))).toMatch(/At most 20/);
    expect(usernameProblem("Alice")).toMatch(/lowercase/);
    expect(usernameProblem("al ice")).toMatch(/lowercase/);
    expect(usernameProblem("al-ice")).toMatch(/lowercase/);
    expect(usernameProblem("álice")).toMatch(/lowercase/);
  });
  it("caps the bio at 160 characters", () => {
    expect(bioProblem("x".repeat(160))).toBeNull();
    expect(bioProblem("x".repeat(161))).toMatch(/160/);
  });
});

describe("UI-148 env gating", () => {
  it("turns the features on only with both env vars and an https URL", () => {
    expect(supabaseConfigFrom({})).toBeNull();
    expect(supabaseConfigFrom({ VITE_SUPABASE_URL: CFG.url })).toBeNull();
    expect(supabaseConfigFrom({ VITE_SUPABASE_PUBLISHABLE_KEY: CFG.key })).toBeNull();
    expect(supabaseConfigFrom({ VITE_SUPABASE_URL: " ", VITE_SUPABASE_PUBLISHABLE_KEY: CFG.key })).toBeNull();
    expect(supabaseConfigFrom({ VITE_SUPABASE_URL: "http://x.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: CFG.key })).toBeNull();
    expect(supabaseConfigFrom({ VITE_SUPABASE_URL: `${CFG.url}/`, VITE_SUPABASE_PUBLISHABLE_KEY: CFG.key })).toEqual(CFG);
  });

  it("renders no profile chip or starter key without the env, even with a wallet connected", () => {
    const connected: WalletApi = { ...DISCONNECTED_WALLET, status: "connected", accountId: "alice.testnet" };
    let seen = ACCOUNT_OFF;
    function Probe() {
      seen = useAccount();
      return null;
    }
    const html = renderToStaticMarkup(
      <WalletContext.Provider value={connected}>
        <SessionProvider config={null}>
          <Probe />
          <AccountChip onOpenProfile={() => {}} />
          <StarterPackButton />
        </SessionProvider>
      </WalletContext.Provider>,
    );
    expect(html).toBe("");
    expect(seen.enabled).toBe(false);
    expect(seen.status).toBe("off");
  });

  it("shows the sign-in chip when the env is set and a wallet is connected (no session yet)", () => {
    const connected: WalletApi = { ...DISCONNECTED_WALLET, status: "connected", accountId: "alice.testnet" };
    const html = renderToStaticMarkup(
      <WalletContext.Provider value={connected}>
        <SessionProvider config={CFG}>
          <AccountChip onOpenProfile={() => {}} />
        </SessionProvider>
      </WalletContext.Provider>,
    );
    expect(html).toContain("Save progress — sign in");
    expect(html).toContain('data-testid="account-signin"');
  });

  it("hides the profile tool from the toolbar when asked", () => {
    const props = { skin: "biolab" as const, panelsOpen: false, onTogglePanels: () => {}, onOpen: () => {}, guestLabel: null };
    expect(renderToStaticMarkup(<ToolsToolbar {...props} />)).toContain(">profile<");
    expect(renderToStaticMarkup(<ToolsToolbar {...props} hidden={["profile"]} />)).not.toContain(">profile<");
  });
});

describe("UI-148 leaderboard names", () => {
  it("adds usernames by NEAR account and leaves unknown accounts unnamed", () => {
    const rows = mergeNames(
      [
        { account_id: "alice.testnet", amount: "5" },
        { account_id: "bob.testnet", amount: "3" },
      ],
      [
        { near_account_id: "alice.testnet", username: "alice" },
        { near_account_id: "carol.testnet", username: "carol" },
        { near_account_id: "bob.testnet", username: null },
      ],
    );
    expect(rows).toEqual([
      { account_id: "alice.testnet", amount: "5", username: "alice" },
      { account_id: "bob.testnet", amount: "3", username: null },
    ]);
  });

  it("ranks the 7-day activity by count, ties by account id", () => {
    const rows = ["b.testnet", "a.testnet", "b.testnet", "c.testnet", "a.testnet", "b.testnet"].map((near_account_id) => ({ near_account_id }));
    expect(rankActivity(rows)).toEqual([
      { account_id: "b.testnet", count: 3 },
      { account_id: "a.testnet", count: 2 },
      { account_id: "c.testnet", count: 1 },
    ]);
    expect(rankActivity(rows, 1)).toHaveLength(1);
  });
});

describe("UI-148 record-tx is fire and forget", () => {
  const none = { recorded: false, method: null, achievements: [] };

  it("posts the hash with the user's token and returns new achievements", async () => {
    const { fn, calls } = fakeFetch({ "record-tx": { status: 200, body: { recorded: true, method: "feed_strain", achievements: ["first_feed"] } } });
    const out = await recordTx(CFG, "jwt-abc", "HASH1", fn);
    expect(out).toEqual({ recorded: true, method: "feed_strain", achievements: ["first_feed"] });
    expect(calls[0].body).toEqual({ txHash: "HASH1" });
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt-abc");
    expect(achievementToast(out.achievements)).toBe("achievement earned: First feed");
  });

  it("swallows every failure: no session, no hash, network error, backend error, bad JSON", async () => {
    const boom = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await recordTx(null, "jwt", "H")).toEqual(none);
    expect(await recordTx(CFG, null, "H", boom)).toEqual(none);
    expect(await recordTx(CFG, "jwt", null, boom)).toEqual(none);
    expect(boom).not.toHaveBeenCalled();
    expect(await recordTx(CFG, "jwt", "H", boom)).toEqual(none);
    const err = fakeFetch({ "record-tx": { status: 500, body: { error: "internal", message: "db down" } } });
    expect(await recordTx(CFG, "jwt", "H", err.fn)).toEqual(none);
    const bad = async () => new Response("<html>", { status: 200 });
    expect(await recordTx(CFG, "jwt", "H", bad)).toEqual(none);
  });
});

describe("UI-148 starter pack", () => {
  it("maps sent, not_configured, already_claimed and balance_ok to honest outcomes", async () => {
    const sent = fakeFetch({ "starter-pack": { status: 200, body: { txHash: "TX9", amountYocto: "500000000000000000000000" } } });
    expect(await claimStarterPack(CFG, "jwt", sent.fn)).toEqual({ kind: "sent", txHash: "TX9", amountYocto: "500000000000000000000000" });
    expect(sent.calls[0].body).toBeNull();
    const cases: [number, "not_configured" | "already_claimed" | "balance_ok"][] = [
      [503, "not_configured"],
      [409, "already_claimed"],
      [400, "balance_ok"],
    ];
    for (const [status, code] of cases) {
      const f = fakeFetch({ "starter-pack": { status, body: { error: code } } });
      expect(await claimStarterPack(CFG, "jwt", f.fn)).toEqual({ kind: code, message: STARTER_MESSAGES[code] });
    }
    const other = fakeFetch({ "starter-pack": { status: 500, body: { error: "boom", message: "relayer is out of NEAR" } } });
    expect(await claimStarterPack(CFG, "jwt", other.fn)).toEqual({ kind: "error", message: "relayer is out of NEAR" });
  });
});

describe("UI-148 routes", () => {
  it("matches /p/:account and /snacc/:id", () => {
    expect(selectRoute("/p/snacc-v001.testnet")).toBe("profile");
    expect(selectRoute("/p/alice.testnet/")).toBe("profile");
    expect(parsePublicPath("/p/alice.testnet")).toEqual({ kind: "profile", accountId: "alice.testnet" });
    expect(parsePublicPath(`/p/${"a".repeat(64)}`)).toEqual({ kind: "profile", accountId: "a".repeat(64) });
    expect(selectRoute("/snacc/5")).toBe("snacc");
    expect(parsePublicPath("/snacc/5/")).toEqual({ kind: "snacc", strainId: 5 });
  });

  it("sends malformed ids to the 404 page", () => {
    for (const bad of ["/p", "/p/", "/p/Alice.testnet", "/p/a", "/p/a..b", "/p/a/b", "/p/%E0%A4%A", "/snacc/0", "/snacc/-1", "/snacc/abc", "/snacc/1/2", "/snacc", "/players/alice"]) {
      expect(selectRoute(bad)).toBe("notfound");
    }
  });

  it("builds profile links and reads the Open in game strain", () => {
    expect(profilePath("alice.testnet")).toBe("/p/alice.testnet");
    expect(profileUrl("alice.testnet", "https://snacc-nu.vercel.app")).toBe("https://snacc-nu.vercel.app/p/alice.testnet");
    expect(strainFromSearch("?strain=5")).toBe(5);
    expect(strainFromSearch("?strain=0")).toBeNull();
    expect(strainFromSearch("?strain=x")).toBeNull();
    expect(strainFromSearch("")).toBeNull();
  });
});
