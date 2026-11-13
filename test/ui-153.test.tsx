/**
 * UI-153 (daily quests, XP and level) and UI-154 (weekly seasons, season board, hall of fame).
 * Runs in node (no DOM): markup is rendered to a string; Supabase is replaced by a recording fake client.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allTimeBoard, hallOfFame, levelsByAccounts, myQuests, playerXpOf, seasonBoard } from "../src/account/api.ts";
import { ACHIEVEMENTS } from "../src/account/model.ts";
import {
  DAY_MS,
  SEASON_EPOCH_MS,
  formatCountdown,
  groupHallOfFame,
  levelForXp,
  levelMap,
  nextUtcMidnightMs,
  normalizePlayerXp,
  normalizeQuests,
  questPercent,
  questsDone,
  seasonEndMs,
  seasonOf,
  seasonOptions,
  seasonRangeLabel,
  seasonStartMs,
  xpBar,
  xpForLevel,
  type HallRow,
  type PlayerXpRow,
  type QuestRow,
} from "../src/account/quests.ts";
import { AccountContext, ACCOUNT_OFF, type AccountApi } from "../src/account/session.tsx";
import { WalletContext, DISCONNECTED_WALLET, type WalletApi } from "../src/chain/wallet.tsx";
import { QuestList, QuestsModal, ResetNote, XpRules } from "../src/hud/QuestsModal.tsx";
import { HallOfFame, SeasonBoardPanel, SeasonHeader, SeasonRows } from "../src/hud/SeasonBoard.tsx";
import { LevelBadge, XpBar } from "../src/hud/XpWidgets.tsx";
import { PlayerName } from "../src/hud/PlayerBoards.tsx";
import { SocialLeaderboardModal } from "../src/hud/SocialLeaderboardModal.tsx";
import { TOOLS, ToolsToolbar } from "../src/hud/ToolsToolbar.tsx";

const at = (iso: string) => Date.parse(iso);

function quest(over: Partial<QuestRow> = {}): QuestRow {
  return {
    quest_day: "2026-11-12",
    resets_at: "2026-11-13T00:00:00+00:00",
    slot: 1,
    code: "feed_3",
    title: "Three meals",
    blurb: "Feed your Snaccs three times.",
    target: 3,
    bonus_xp: 25,
    progress: 0,
    completed: false,
    ...over,
  };
}

/** A supabase-js stand-in: every builder call is recorded and the chain resolves to `result`. */
function fakeClient(result: { data: unknown; error?: { message: string } | null }) {
  const log: [string, ...unknown[]][] = [];
  const chain: unknown = new Proxy(
    {},
    {
      get: (_t, prop: string) =>
        prop === "then"
          ? (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ error: null, ...result }).then(ok, bad)
          : (...args: unknown[]) => {
              log.push([prop, ...args]);
              return chain;
            },
    },
  );
  const client = {
    from: (t: string) => (log.push(["from", t]), chain),
    rpc: (fn: string) => (log.push(["rpc", fn]), chain),
  } as unknown as SupabaseClient;
  return { client, log };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("UI-154 season date maths", () => {
  it("starts season 1 on Monday 2026-11-02 00:00 UTC and rolls over every Monday", () => {
    expect(SEASON_EPOCH_MS).toBe(at("2026-11-02T00:00:00Z"));
    expect(new Date(SEASON_EPOCH_MS).getUTCDay()).toBe(1);
    const cases: [string, number][] = [
      ["2026-10-25T12:00:00Z", -1],
      ["2026-11-01T23:59:59Z", 0],
      ["2026-11-02T00:00:00Z", 1],
      ["2026-11-08T23:59:59Z", 1],
      ["2026-11-09T00:00:00Z", 2],
      ["2026-11-15T23:59:59Z", 2],
      ["2026-11-16T00:00:00Z", 3],
    ];
    for (const [iso, season] of cases) expect(seasonOf(at(iso))).toBe(season);
    expect(seasonStartMs(2)).toBe(at("2026-11-09T00:00:00Z"));
    expect(seasonEndMs(2)).toBe(at("2026-11-16T00:00:00Z"));
    expect(seasonEndMs(1)).toBe(seasonStartMs(2));
  });

  it("puts every day inside the week of its own season, Monday to Monday", () => {
    for (let d = 0; d < 730; d++) {
      const ms = at("2026-01-01T05:00:00Z") + d * DAY_MS;
      const s = seasonOf(ms);
      expect(seasonStartMs(s)).toBeLessThanOrEqual(ms);
      expect(ms).toBeLessThan(seasonEndMs(s));
      expect(new Date(seasonStartMs(s)).getUTCDay()).toBe(1);
    }
  });

  it("labels a season by its first and last UTC day", () => {
    expect(seasonRangeLabel(1)).toBe("Nov 2 to Nov 8 (UTC)");
    expect(seasonRangeLabel(2)).toBe("Nov 9 to Nov 15 (UTC)");
    expect(seasonRangeLabel(3)).toBe("Nov 16 to Nov 22 (UTC)");
  });

  it("offers this week first, finished seasons newest first, then all time", () => {
    expect(seasonOptions(3, [1, 2, 2]).map((o) => o.value)).toEqual([3, 2, 1, "all"]);
    expect(seasonOptions(3, [1, 2]).map((o) => o.label)).toEqual(["Season 3 (this week)", "Season 2", "Season 1", "All time"]);
    expect(seasonOptions(2, [5, 2, 0, -1]).map((o) => o.value)).toEqual([2, "all"]);
    expect(seasonOptions(0, []).map((o) => o.value)).toEqual(["all"]);
  });

  it("counts down in days and hours, hours and minutes, or minutes", () => {
    expect(formatCountdown(3 * DAY_MS + 4 * 3_600_000 + 59_000)).toBe("3d 4h");
    expect(formatCountdown(5 * 3_600_000 + 12 * 60_000)).toBe("5h 12m");
    expect(formatCountdown(12 * 60_000 + 30_000)).toBe("12m");
    expect(formatCountdown(40_000)).toBe("under a minute");
    expect(formatCountdown(0)).toBe("now");
    expect(formatCountdown(-5)).toBe("now");
    expect(formatCountdown(Number.NaN)).toBe("now");
  });

  it("resets daily quests at the next 00:00 UTC", () => {
    expect(nextUtcMidnightMs(at("2026-11-12T10:30:00Z"))).toBe(at("2026-11-13T00:00:00Z"));
    expect(nextUtcMidnightMs(at("2026-11-12T23:59:59Z"))).toBe(at("2026-11-13T00:00:00Z"));
    expect(nextUtcMidnightMs(at("2026-11-13T00:00:00Z"))).toBe(at("2026-11-14T00:00:00Z"));
  });

  it("groups the hall of fame by season, newest first, best rank first", () => {
    const row = (season: number, rank: number, who: string): HallRow => ({
      season,
      starts_on: "x",
      ends_on: "y",
      rank,
      user_id: `u-${who}`,
      near_account_id: `${who}.testnet`,
      xp: 100 - rank,
      quests_completed: 0,
    });
    const groups = groupHallOfFame([row(1, 2, "b"), row(2, 1, "x"), row(1, 1, "a"), row(1, 3, "c"), row(2, 2, "y")]);
    expect(groups.map((g) => g.season)).toEqual([2, 1]);
    expect(groups[1]!.top.map((r) => r.near_account_id)).toEqual(["a.testnet", "b.testnet", "c.testnet"]);
    expect(groupHallOfFame([])).toEqual([]);
  });
});

describe("UI-153 XP and level maths", () => {
  it("follows the curve 50 * (L - 1) * L and its inverse", () => {
    expect([1, 2, 3, 4, 5, 10].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000, 4500]);
    expect([0, 99, 100, 299, 300, 599, 600, 999, 1000, 4499, 4500].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 9, 10]);
    expect(levelForXp(Number.NaN)).toBe(1);
    expect(levelForXp(-3)).toBe(1);
  });

  it("builds the XP bar from the database row, and level 1 with 0 XP when nothing is recorded", () => {
    const row: PlayerXpRow = { user_id: "u", near_account_id: "a.testnet", total_xp: 450, level: 3, level_start_xp: 300, next_level_xp: 600, quests_completed: 4, actions: 30 };
    expect(xpBar(row)).toEqual({ level: 3, totalXp: 450, into: 150, span: 300, percent: 50, toNext: 150 });
    expect(xpBar(null)).toEqual({ level: 1, totalXp: 0, into: 0, span: 100, percent: 0, toNext: 100 });
    expect(xpBar({ ...row, total_xp: 300 }).percent).toBe(0);
    expect(xpBar({ ...row, total_xp: 599 })).toMatchObject({ percent: 99, toNext: 1 });
  });

  it("clamps quest progress to 0..100 percent and counts finished quests", () => {
    expect(questPercent({ progress: 0, target: 3 })).toBe(0);
    expect(questPercent({ progress: 1, target: 3 })).toBe(33);
    expect(questPercent({ progress: 3, target: 3 })).toBe(100);
    expect(questPercent({ progress: 9, target: 3 })).toBe(100);
    expect(questPercent({ progress: 1, target: 0 })).toBe(100);
    expect(questsDone([quest({ completed: true }), quest(), quest({ completed: true })])).toBe(2);
  });

  it("normalizes the database answers: numbers, order, at most three quests, empty and junk", () => {
    const rows = normalizeQuests([
      { slot: 3, code: "c", title: "C", blurb: "", target: "2", bonus_xp: 20, progress: "1", completed: false },
      { slot: 1, code: "a", title: "A", blurb: "", target: 1, bonus_xp: 10, progress: 1, completed: true },
      { slot: 2, code: "b", title: "B", blurb: "", target: 1, bonus_xp: 15, progress: 0, completed: false },
      { slot: 4, code: "d", title: "D", blurb: "", target: 1, bonus_xp: 15, progress: 0, completed: false },
      { slot: 5, code: "" },
    ]);
    expect(rows.map((r) => r.code)).toEqual(["a", "b", "c"]);
    expect(rows[2]).toMatchObject({ target: 2, progress: 1, bonus_xp: 20 });
    expect(normalizeQuests(null)).toEqual([]);
    expect(normalizeQuests({})).toEqual([]);
    expect(normalizePlayerXp(null)).toBeNull();
    expect(normalizePlayerXp([])).toBeNull();
    expect(normalizePlayerXp({ user_id: "u", near_account_id: "a.testnet", total_xp: "120", level: "2" })).toMatchObject({ total_xp: 120, level: 2, level_start_xp: 100, next_level_xp: 300 });
    expect(levelMap([{ near_account_id: "a.testnet", level: 4 }]).get("a.testnet")).toBe(4);
  });
});

describe("UI-153 Quests window", () => {
  it("renders each quest with a labelled progress bar, its bonus XP and a finished mark", () => {
    const html = renderToStaticMarkup(
      <QuestList
        quests={[
          quest({ code: "feed_3", title: "Three meals", progress: 1 }),
          quest({ code: "hatch_1", title: "New arrival", target: 1, progress: 1, completed: true, bonus_xp: 30, slot: 2 }),
          quest({ code: "extract_2", title: "Spore picker", target: 2, progress: 5, completed: true, bonus_xp: 20, slot: 3 }),
        ]}
      />,
    );
    expect((html.match(/data-testid="quest-row"/g) ?? []).length).toBe(3);
    expect(html).toContain('aria-label="Three meals: 1 of 3"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('style="width:33%"');
    expect(html).toContain("+25 XP bonus when done");
    expect(html).toContain("done · +30 XP added");
    // progress past the target is shown as the target, and the bar is full
    expect(html).toContain('aria-label="Spore picker: 2 of 2"');
    expect(html).toContain('aria-valuenow="2"');
    expect((html.match(/data-done=""/g) ?? []).length).toBe(4); // two rows and two bars
  });

  it("shows the reset countdown to 00:00 UTC", () => {
    const html = renderToStaticMarkup(<ResetNote resetsAtMs={at("2026-11-13T00:00:00Z")} nowMs={at("2026-11-12T18:48:00Z")} />);
    expect(html).toContain("resets in 5h 12m");
    expect(html).toContain("00:00 UTC");
  });

  it("shows level, total XP and the XP still missing for the next level", () => {
    const row: PlayerXpRow = { user_id: "u", near_account_id: "a.testnet", total_xp: 1234, level: 5, level_start_xp: 1000, next_level_xp: 1500, quests_completed: 9, actions: 80 };
    const html = renderToStaticMarkup(<XpBar xp={row} />);
    expect(html).toContain("Level 5");
    expect(html).toContain("1,234 XP");
    expect(html).toContain("266 XP to level 6");
    expect(html).toContain('aria-label="level 5: 234 of 500 XP"');
    const none = renderToStaticMarkup(<XpBar xp={null} />);
    expect(none).toContain("Level 1");
    expect(none).toContain("100 XP to level 2");
  });

  it("lists how XP works, with the daily cap and the level curve", () => {
    const html = renderToStaticMarkup(<XpRules />);
    expect(html).toContain("feed a Snacc");
    expect(html).toContain("+10 XP");
    expect(html).toContain("first 40 recorded actions");
    expect(html).toContain("50 × (L − 1) × L");
  });

  const signedOut: AccountApi = { ...ACCOUNT_OFF, enabled: true, status: "idle" };
  const signedIn: AccountApi = { ...ACCOUNT_OFF, enabled: true, status: "signed-in", client: {} as SupabaseClient, userId: "u-1", nearAccountId: "alice.testnet" };
  const connected: WalletApi = { ...DISCONNECTED_WALLET, status: "connected", accountId: "alice.testnet" };

  it("explains that quests need a sign-in when signed out, with the wallet key", () => {
    const html = renderToStaticMarkup(
      <WalletContext.Provider value={DISCONNECTED_WALLET}>
        <AccountContext.Provider value={signedOut}>
          <QuestsModal onClose={() => {}} />
        </AccountContext.Provider>
      </WalletContext.Provider>,
    );
    expect(html).toContain('data-testid="quests-modal"');
    expect(html).toContain("Quests need a sign-in");
    expect(html).toContain("not a transaction and costs nothing");
    expect(html).toContain("connect wallet first");
    expect(html).not.toContain('data-testid="quest-list"');
    const withWallet = renderToStaticMarkup(
      <WalletContext.Provider value={connected}>
        <AccountContext.Provider value={signedOut}>
          <QuestsModal onClose={() => {}} />
        </AccountContext.Provider>
      </WalletContext.Provider>,
    );
    expect(withWallet).toContain("Save progress — sign in");
  });

  it("shows the signed-in shell: XP bar, today's counter, reset note, refresh key and the rules", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T18:48:00Z"));
    const html = renderToStaticMarkup(
      <WalletContext.Provider value={connected}>
        <AccountContext.Provider value={signedIn}>
          <QuestsModal onClose={() => {}} />
        </AccountContext.Provider>
      </WalletContext.Provider>,
    );
    expect(html).toContain('data-testid="xp-bar"');
    expect(html).toContain("Today · 0 of 3 done");
    expect(html).toContain("resets in 5h 12m");
    expect(html).toContain('data-testid="quests-refresh"');
    expect(html).toContain('data-testid="xp-rules"');
    expect(html).toContain("cosmetic");
    expect(html).not.toContain("Quests need a sign-in");
  });

  it("reads quests through snacc_my_quests() and XP from player_xp_snacc, and throws the database message on failure", async () => {
    const ok = fakeClient({ data: [{ slot: 2, code: "b", title: "B", blurb: "", target: 1, bonus_xp: 10, progress: 0, completed: false }, { slot: 1, code: "a", title: "A", blurb: "", target: 2, bonus_xp: 20, progress: 1, completed: false }] });
    expect((await myQuests(ok.client)).map((q) => q.code)).toEqual(["a", "b"]);
    expect(ok.log).toEqual([["rpc", "snacc_my_quests"]]);
    const bad = fakeClient({ data: null, error: { message: "permission denied for function snacc_my_quests" } });
    await expect(myQuests(bad.client)).rejects.toThrow("permission denied");

    const xp = fakeClient({ data: { user_id: "u-1", near_account_id: "a.testnet", total_xp: 150, level: 2, level_start_xp: 100, next_level_xp: 300, quests_completed: 1, actions: 9 } });
    expect(await playerXpOf(xp.client, { userId: "u-1" })).toMatchObject({ total_xp: 150, level: 2 });
    expect(xp.log.slice(0, 3)).toEqual([["from", "player_xp_snacc"], ["select", expect.stringContaining("total_xp")], ["eq", "user_id", "u-1"]]);
    const none = fakeClient({ data: null });
    expect(await playerXpOf(none.client, { accountId: "x.testnet" })).toBeNull();
    expect(none.log).toContainEqual(["eq", "near_account_id", "x.testnet"]);
  });
});

describe("UI-153 level on names and profile", () => {
  it("adds a Lv badge next to a name only when the level is known", () => {
    const withLevel = renderToStaticMarkup(<PlayerName account="alice.testnet" username="alice" level={4} />);
    expect(withLevel).toContain("Lv 4");
    expect(withLevel).toContain('data-testid="player-name"');
    expect(renderToStaticMarkup(<PlayerName account="alice.testnet" username={null} />)).not.toContain("Lv ");
    expect(renderToStaticMarkup(<LevelBadge level={12} />)).toContain("Lv 12");
  });

  it("reads levels for the given accounts only", async () => {
    const f = fakeClient({ data: [{ near_account_id: "a.testnet", level: 3 }, { near_account_id: "b.testnet", level: "7" }] });
    expect(await levelsByAccounts(f.client, ["a.testnet", "b.testnet", "a.testnet"])).toEqual([
      { near_account_id: "a.testnet", level: 3 },
      { near_account_id: "b.testnet", level: 7 },
    ]);
    expect(f.log).toContainEqual(["in", "near_account_id", ["a.testnet", "b.testnet"]]);
    const empty = fakeClient({ data: [] });
    expect(await levelsByAccounts(empty.client, [])).toEqual([]);
    expect(empty.log).toEqual([]);
  });

  it("adds the quests tool to the toolbar and hides it with the profile features", () => {
    expect(TOOLS.map((t) => t.id)).toContain("quests");
    const props = { skin: "biolab" as const, panelsOpen: false, onTogglePanels: () => {}, onOpen: () => {}, guestLabel: null };
    expect(renderToStaticMarkup(<ToolsToolbar {...props} />)).toContain(">quests<");
    expect(renderToStaticMarkup(<ToolsToolbar {...props} hidden={["profile", "quests"]} />)).not.toContain(">quests<");
  });

  it("lists the two quest badges with how to earn them", () => {
    const codes = ACHIEVEMENTS.map((a) => a.code);
    expect(codes).toEqual(expect.arrayContaining(["quest_first", "quest_streak_7"]));
    expect(ACHIEVEMENTS.find((a) => a.code === "quest_first")?.how).toMatch(/daily quest/);
  });
});

describe("UI-154 season board and hall of fame", () => {
  const names = new Map([["a.testnet", "alice"]]);
  const levels = new Map([["a.testnet", 6], ["b.testnet", 2]]);

  it("shows the running season with its range and a countdown to Monday 00:00 UTC", () => {
    const html = renderToStaticMarkup(<SeasonHeader scope={2} nowMs={at("2026-11-12T10:00:00Z")} />);
    expect(html).toContain("Season 2");
    expect(html).toContain("Nov 9 to Nov 15 (UTC)");
    expect(html).toContain("ends in 3d 14h");
  });

  it("marks a past season as finished and all time as the total", () => {
    expect(renderToStaticMarkup(<SeasonHeader scope={1} nowMs={at("2026-11-12T10:00:00Z")} />)).toContain("finished");
    expect(renderToStaticMarkup(<SeasonHeader scope="all" nowMs={at("2026-11-12T10:00:00Z")} />)).toContain("All time");
  });

  it("ranks players with their names, levels and XP", () => {
    const html = renderToStaticMarkup(
      <SeasonRows
        label="season 2 XP"
        names={names}
        levels={levels}
        rows={[
          { account: "a.testnet", xp: 1234, detail: "12 actions · 3 quests" },
          { account: "b.testnet", xp: 80, detail: "1 action · 0 quests" },
        ]}
      />,
    );
    expect((html.match(/<li /g) ?? []).length).toBe(2);
    expect(html).toContain("alice");
    expect(html).toContain("Lv 6");
    expect(html).toContain("Lv 2");
    expect(html).toContain("1,234 XP");
    expect(html).toContain("12 actions · 3 quests");
    expect(html).toContain("1 action · 0 quests");
    expect(html).toContain('aria-label="season 2 XP"');
  });

  it("lists the top three of every finished season, and says so when there is none", () => {
    const row = (season: number, rank: number, who: string, xp: number): HallRow => ({ season, starts_on: "", ends_on: "", rank, user_id: `u-${season}-${rank}`, near_account_id: `${who}.testnet`, xp, quests_completed: 0 });
    const html = renderToStaticMarkup(
      <HallOfFame seasons={groupHallOfFame([row(1, 1, "a", 500), row(1, 2, "b", 300), row(1, 3, "c", 100)])} names={names} levels={levels} />,
    );
    expect(html).toContain('data-testid="hall-of-fame"');
    expect(html).toContain("Season 1");
    expect(html).toContain("Nov 2 to Nov 8 (UTC)");
    expect(html).toContain("alice");
    expect(html).toContain("500 XP");
    expect((html.match(/<li /g) ?? []).length).toBe(3);
    const empty = renderToStaticMarkup(<HallOfFame seasons={[]} names={names} levels={levels} />);
    expect(empty).toContain("No season has finished with recorded players yet");
  });

  it("opens on this season, offers all time, and shows the hall of fame heading while loading", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T10:00:00Z"));
    const html = renderToStaticMarkup(<SeasonBoardPanel client={null} only={null} />);
    expect(html).toContain('data-testid="season-select"');
    expect(html).toContain('value="2" selected');
    expect(html).toContain("Season 2 (this week)");
    expect(html).toContain("All time");
    expect(html).toContain("ends in 3d 14h");
    expect(html).toContain("Hall of fame");
    expect(html).toContain("no tokens, no NEAR");
  });

  it("puts a season xp tab in the leaderboard window next to the existing three", () => {
    const account: AccountApi = { ...ACCOUNT_OFF, enabled: true, status: "idle", client: {} as SupabaseClient };
    const html = renderToStaticMarkup(
      <AccountContext.Provider value={account}>
        <SocialLeaderboardModal onClose={() => {}} appetite={null} mode="demo" />
      </AccountContext.Provider>,
    );
    for (const label of ["top feeders", "most active (7 days)", "longest streaks", "season xp"]) expect(html).toContain(label);
    expect((html.match(/role="tab"/g) ?? []).length).toBe(4);
  });

  it("queries one season by rank, all time by total XP, and the hall of fame newest first", async () => {
    const season = fakeClient({ data: [{ season: "2", starts_on: "2026-11-09", ends_on: "2026-11-16", rank: "1", user_id: "u", near_account_id: "a.testnet", xp: "300", actions: "10", quests_completed: "2" }] });
    expect(await seasonBoard(season.client, 2, 10)).toEqual([expect.objectContaining({ season: 2, rank: 1, xp: 300, actions: 10, quests_completed: 2 })]);
    expect(season.log).toEqual(
      expect.arrayContaining([["from", "season_leaderboard_snacc"], ["eq", "season", 2], ["order", "rank", { ascending: true }], ["limit", 10]]),
    );

    const all = fakeClient({ data: [{ user_id: "u", near_account_id: "a.testnet", total_xp: "900", level: "4", level_start_xp: "600", next_level_xp: "1000", quests_completed: "5", actions: "50" }] });
    expect((await allTimeBoard(all.client))[0]).toMatchObject({ total_xp: 900, level: 4 });
    expect(all.log).toEqual(expect.arrayContaining([["from", "player_xp_snacc"], ["order", "total_xp", { ascending: false }]]));

    const hall = fakeClient({ data: [] });
    expect(await hallOfFame(hall.client)).toEqual([]);
    expect(hall.log).toEqual(expect.arrayContaining([["from", "hall_of_fame_snacc"], ["order", "season", { ascending: false }], ["order", "rank", { ascending: true }]]));
  });
});
