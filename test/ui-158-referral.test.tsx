// UI-158: invite links. Capturing `?ref=`, the seven-day expiry, validation, the quiet claim flow against a
// fake Supabase client, the recruit counts, the share helpers and the "Invite friends" block.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isNearAccountId, parsePublicPath } from "../src/route.ts";
import {
  captureReferral,
  claimReferral,
  claimStoredReferral,
  clearReferral,
  INVITE_TEXT,
  inviteShare,
  inviteUrl,
  REFERRAL_STATUSES,
  REFERRAL_STORAGE_KEY,
  REFERRAL_TTL_MS,
  referralCountsOf,
  refFromSearch,
  storedReferral,
} from "../src/account/referral.ts";
import { ACHIEVEMENTS } from "../src/account/model.ts";
import { InviteFriends, countsLine } from "../src/hud/InviteFriends.tsx";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function memStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const stored = (account: string, at: number) => ({ [REFERRAL_STORAGE_KEY]: JSON.stringify({ account, at }) });

/** A fake client whose `snacc_claim_referral` answers with the given status (or error / exception). */
function rpcClient(answer: { data?: unknown; error?: { message: string } | null } | Error) {
  const rpc = vi.fn(async (_fn: string, _args?: Record<string, unknown>) => {
    if (answer instanceof Error) throw answer;
    return { data: answer.data ?? null, error: answer.error ?? null };
  });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("UI-158 capturing ?ref=", () => {
  it("accepts a valid NEAR account and lower-cases it", () => {
    expect(refFromSearch("?ref=alice.testnet")).toBe("alice.testnet");
    expect(refFromSearch("ref=alice.testnet&utm=x")).toBe("alice.testnet");
    expect(refFromSearch("?utm=x&ref=%20Bob_1.TESTNET%20")).toBe("bob_1.testnet");
    expect(refFromSearch("?ref=a-b.c.testnet")).toBe("a-b.c.testnet");
    expect(refFromSearch(`?ref=${"a".repeat(64)}`)).toBe("a".repeat(64));
  });

  it("rejects anything that is not a NEAR account id", () => {
    for (const bad of ["", "?", "?ref=", "?ref=a", "?ref=-a.testnet", "?ref=a..b", "?ref=a b", "?ref=%3Cscript%3E", "?ref=a/b", `?ref=${"a".repeat(65)}`, "?reff=alice.testnet", "?ref=alice.testnet.", "?ref=\u0000"]) {
      expect(refFromSearch(bad), bad).toBeNull();
    }
  });

  it("uses the same account rule as the router", () => {
    for (const id of ["alice.testnet", "ab", "a", "A.testnet", "a..b", "x".repeat(64), "x".repeat(65), "a-b_c.d"]) {
      expect(isNearAccountId(id), id).toBe(parsePublicPath(`/p/${id}`)?.kind === "profile");
    }
  });

  it("stores the account with a timestamp, ignores bad links and lets the newest link win", () => {
    const store = memStore();
    expect(captureReferral("?ref=nope!", store, NOW)).toBeNull();
    expect(store.m.size).toBe(0);
    expect(captureReferral("?ref=alice.testnet", store, NOW)).toBe("alice.testnet");
    expect(JSON.parse(store.getItem(REFERRAL_STORAGE_KEY)!)).toEqual({ account: "alice.testnet", at: NOW });
    expect(captureReferral("?ref=bob.testnet", store, NOW + 1000)).toBe("bob.testnet");
    expect(storedReferral(store, NOW + 2000)).toBe("bob.testnet");
    // a visit without ?ref= leaves the stored link alone
    expect(captureReferral("?strain=3", store, NOW + 3000)).toBeNull();
    expect(storedReferral(store, NOW + 3000)).toBe("bob.testnet");
  });

  it("never throws when storage is missing or full", () => {
    expect(captureReferral("?ref=alice.testnet", null, NOW)).toBeNull();
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(captureReferral("?ref=alice.testnet", full, NOW)).toBeNull();
    expect(storedReferral(full, NOW)).toBeNull();
    expect(() => clearReferral(full)).not.toThrow();
    expect(storedReferral(null, NOW)).toBeNull();
  });
});

describe("UI-158 seven-day expiry", () => {
  it("returns the account while the link is younger than seven days", () => {
    const store = memStore(stored("alice.testnet", NOW));
    expect(storedReferral(store, NOW)).toBe("alice.testnet");
    expect(storedReferral(store, NOW + REFERRAL_TTL_MS - 1)).toBe("alice.testnet");
    expect(REFERRAL_TTL_MS).toBe(7 * DAY);
  });

  it("drops the link at seven days and later, and removes it from storage", () => {
    const store = memStore(stored("alice.testnet", NOW));
    expect(storedReferral(store, NOW + REFERRAL_TTL_MS)).toBeNull();
    expect(store.m.has(REFERRAL_STORAGE_KEY)).toBe(false);
    const old = memStore(stored("alice.testnet", NOW - 30 * DAY));
    expect(storedReferral(old, NOW)).toBeNull();
    expect(old.m.size).toBe(0);
  });

  it("drops garbage: bad JSON, a bad account, a bad or future timestamp", () => {
    for (const raw of ["not json", "{}", "null", '{"account":"Bad Account","at":1}', '{"account":"alice.testnet"}', '{"account":"alice.testnet","at":"x"}', JSON.stringify({ account: "alice.testnet", at: NOW + DAY })]) {
      const store = memStore({ [REFERRAL_STORAGE_KEY]: raw });
      expect(storedReferral(store, NOW), raw).toBeNull();
      expect(store.m.size, raw).toBe(0);
    }
  });
});

describe("UI-158 claim flow", () => {
  it("asks once with the stored account and forgets the link on `claimed`", async () => {
    const store = memStore(stored("alice.testnet", NOW));
    const { client, rpc } = rpcClient({ data: "claimed" });
    expect(await claimStoredReferral(client, "bob.testnet", store, NOW + 1000)).toBe("claimed");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("snacc_claim_referral", { p_referrer_account: "alice.testnet" });
    expect(store.m.size).toBe(0);
    // nothing stored any more: no second call
    expect(await claimStoredReferral(client, "bob.testnet", store, NOW + 2000)).toBe("skipped");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("forgets the link on every definitive refusal", async () => {
    for (const status of ["already_referred", "invalid_account", "unknown_referrer", "self_referral", "not_new_player"] as const) {
      const store = memStore(stored("alice.testnet", NOW));
      const { client } = rpcClient({ data: status });
      expect(await claimStoredReferral(client, "bob.testnet", store, NOW), status).toBe(status);
      expect(store.m.size, status).toBe(0);
    }
  });

  it("keeps the link when the profile is not there yet or the call fails, so a later visit can retry", async () => {
    const cases: [ReturnType<typeof rpcClient>, string][] = [
      [rpcClient({ data: "no_profile" }), "no_profile"],
      [rpcClient({ error: { message: "network" } }), "error"],
      [rpcClient(new Error("fetch failed")), "error"],
      [rpcClient({ data: "something_new" }), "error"],
      [rpcClient({ data: null }), "error"],
    ];
    for (const [{ client }, outcome] of cases) {
      const store = memStore(stored("alice.testnet", NOW));
      expect(await claimStoredReferral(client, "bob.testnet", store, NOW), outcome).toBe(outcome);
      expect(storedReferral(store, NOW), outcome).toBe("alice.testnet");
    }
  });

  it("does not call the database when nothing is stored, when the link expired, or for your own account", async () => {
    const { client, rpc } = rpcClient({ data: "claimed" });
    expect(await claimStoredReferral(client, "bob.testnet", memStore(), NOW)).toBe("skipped");
    expect(await claimStoredReferral(client, "bob.testnet", memStore(stored("alice.testnet", NOW - 8 * DAY)), NOW)).toBe("skipped");
    expect(await claimStoredReferral(client, "bob.testnet", null, NOW)).toBe("skipped");
    const own = memStore(stored("bob.testnet", NOW));
    expect(await claimStoredReferral(client, "Bob.testnet", own, NOW)).toBe("self_referral");
    expect(own.m.size).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("knows exactly the seven statuses the database returns", () => {
    expect([...REFERRAL_STATUSES]).toEqual(["claimed", "no_profile", "already_referred", "invalid_account", "unknown_referrer", "self_referral", "not_new_player"]);
  });

  it("claimReferral maps odd answers to error and never rejects", async () => {
    expect(await claimReferral(rpcClient({ data: "claimed" }).client, "a.testnet")).toBe("claimed");
    expect(await claimReferral(rpcClient({ data: 7 }).client, "a.testnet")).toBe("error");
    expect(await claimReferral(rpcClient(new Error("boom")).client, "a.testnet")).toBe("error");
  });
});

describe("UI-158 recruit counts", () => {
  function fromClient(result: { data: unknown; error: { message: string } | null } | Error) {
    const eq = vi.fn(() => ({
      maybeSingle: async () => {
        if (result instanceof Error) throw result;
        return result;
      },
    }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { client: { from } as unknown as SupabaseClient, from, select, eq };
  }

  it("reads referral_counts_snacc for the player", async () => {
    const { client, from, select, eq } = fromClient({ data: { recruits: 3, recruits_hatched: 2 }, error: null });
    expect(await referralCountsOf(client, "user-1")).toEqual({ recruits: 3, recruitsHatched: 2 });
    expect(from).toHaveBeenCalledWith("referral_counts_snacc");
    expect(select).toHaveBeenCalledWith("recruits,recruits_hatched");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("says zero when nobody joined and null when the read failed", async () => {
    expect(await referralCountsOf(fromClient({ data: null, error: null }).client, "u")).toEqual({ recruits: 0, recruitsHatched: 0 });
    expect(await referralCountsOf(fromClient({ data: null, error: { message: "relation does not exist" } }).client, "u")).toBeNull();
    expect(await referralCountsOf(fromClient(new Error("network")).client, "u")).toBeNull();
  });
});

describe("UI-158 invite link and sharing", () => {
  it("builds the production link and encodes the account", () => {
    expect(inviteUrl("alice.testnet")).toBe("https://snacc-nu.vercel.app/app?ref=alice.testnet");
    expect(inviteUrl("a b&c")).toBe("https://snacc-nu.vercel.app/app?ref=a%20b%26c");
    expect(refFromSearch(new URL(inviteUrl("alice.testnet")).search)).toBe("alice.testnet");
  });

  it("offers Web Share only when the browser has it, and reports a cancelled share", async () => {
    expect(inviteShare("alice.testnet", undefined)).toBeNull();
    expect(inviteShare("alice.testnet", {} as Pick<Navigator, "share">)).toBeNull();
    const share = vi.fn(async () => undefined);
    const run = inviteShare("alice.testnet", { share })!;
    expect(await run()).toBe(true);
    expect(share).toHaveBeenCalledWith({ title: "Snacc", text: INVITE_TEXT, url: "https://snacc-nu.vercel.app/app?ref=alice.testnet" });
    const cancelled = inviteShare("alice.testnet", { share: async () => Promise.reject(new DOMException("cancelled", "AbortError")) })!;
    expect(await cancelled()).toBe(false);
  });

  it("keeps the invite text honest about testnet", () => {
    expect(INVITE_TEXT).toMatch(/testnet/);
    expect(INVITE_TEXT).toMatch(/no money value/);
  });
});

describe("UI-158 Invite friends block and badge", () => {
  it("shows the link, the copy button and the counts; the Share button only with Web Share", () => {
    const html = renderToStaticMarkup(<InviteFriends account="alice.testnet" counts={{ recruits: 2, recruitsHatched: 1 }} onShare={null} />);
    expect(html).toContain("Invite friends");
    expect(html).toContain("https://snacc-nu.vercel.app/app?ref=alice.testnet");
    expect(html).toContain("Copy invite link");
    expect(html).not.toContain('data-testid="invite-share"');
    expect(html).toContain("2 friends joined through your link, 1 hatched a first Snacc.");
    expect(html).toMatch(/Recruiter badge/);
    expect(html).toMatch(/cosmetic/);
    expect(html).toMatch(/no money value/);
    const withShare = renderToStaticMarkup(<InviteFriends account="alice.testnet" counts={null} onShare={() => undefined} />);
    expect(withShare).toContain('data-testid="invite-share"');
    expect(withShare).toContain("Recruit count unavailable");
  });

  it("words the counts for none, one and unknown", () => {
    expect(countsLine({ recruits: 0, recruitsHatched: 0 })).toBe("No friends have joined through your link yet.");
    expect(countsLine({ recruits: 1, recruitsHatched: 0 })).toBe("1 friend joined through your link, 0 hatched a first Snacc.");
    expect(countsLine(null)).toBe("Recruit count unavailable right now.");
  });

  it("lists the recruiter badge next to every existing one", () => {
    const codes = ACHIEVEMENTS.map((a) => a.code);
    expect(codes).toEqual(
      expect.arrayContaining(["first_hatch", "first_feed", "feeds_10", "streak_3", "streak_7", "rescuer", "gifter", "colony_5", "quest_first", "quest_streak_7", "recruiter"]),
    );
    expect(ACHIEVEMENTS.find((a) => a.code === "recruiter")?.how).toMatch(/invited/);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
