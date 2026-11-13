/**
 * Player boards for the Great Feast window (UI-148): usernames next to account ids, "Most active
 * (7 days)" from `activity_snacc`, "Longest streaks" from `streaks_snacc`, and a "Following" filter
 * from `follows_snacc`. Names link to the public profile `/p/<account>` and show the player's level
 * (`player_xp_snacc`, UI-153) once it is read. Without the profile
 * features (no Supabase env) none of this renders.
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAccount } from "../account/session.tsx";
import { followeesOf, levelsByAccounts, profilesByAccounts, profilesByUsers, topStreaks, weekActivity } from "../account/api.ts";
import { mergeNames, rankActivity, type StreakRow } from "../account/model.ts";
import { levelMap } from "../account/quests.ts";
import { profilePath } from "../account/config.ts";
import { Empty } from "../ui/controls.tsx";
import { LevelBadge } from "./XpWidgets.tsx";
import "../account/account.css";

/** A player's name linking to their public profile; `level` (UI-153) adds the "Lv" badge when known. */
export function PlayerName({ account, username, level }: { account: string; username: string | null; level?: number | null }) {
  return (
    <span className="acct-who">
      <a className="acct-name fd-a" href={profilePath(account)} data-testid="player-name">
        {username ? <span className="acct-name__user">{username}</span> : null}
        <code className="feast-account">{account}</code>
      </a>
      {typeof level === "number" ? <LevelBadge level={level} /> : null}
    </span>
  );
}

/**
 * The client for public reads. In the game it is the session's client, which exists only once a
 * wallet is connected or a session is stored (`load` false); public pages pass `load` to fetch
 * Supabase on demand.
 */
export function usePublicClient(load: boolean): SupabaseClient | null {
  const account = useAccount();
  const [c, setC] = useState<SupabaseClient | null>(account.client);
  useEffect(() => {
    if (!account.enabled) return;
    if (account.client) {
      setC(account.client);
      return;
    }
    if (!load) return;
    let alive = true;
    void account.ensureClient().then((x) => alive && setC(x));
    return () => {
      alive = false;
    };
  }, [account.enabled, account.client, account, load]);
  return c;
}

/** username per NEAR account for the given accounts (empty map until read). */
export function useNames(client: SupabaseClient | null, accounts: readonly string[]): Map<string, string> {
  const key = [...accounts].sort().join(",");
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!client || !key) return;
    let alive = true;
    void profilesByAccounts(client, key.split(","))
      .then((rows) => {
        if (!alive) return;
        const merged = mergeNames(
          key.split(",").map((a) => ({ account_id: a })),
          rows,
        );
        setNames(new Map(merged.filter((r) => r.username).map((r) => [r.account_id, r.username as string])));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [client, key]);
  return names;
}

/** Level per NEAR account for the given accounts (UI-153; empty map until read, and for players with no recorded XP). */
export function useLevels(client: SupabaseClient | null, accounts: readonly string[]): Map<string, number> {
  const key = [...new Set(accounts)].sort().join(",");
  const [levels, setLevels] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!client || !key) return;
    let alive = true;
    void levelsByAccounts(client, key.split(","))
      .then((rows) => alive && setLevels(levelMap(rows)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [client, key]);
  return levels;
}

/** NEAR accounts the signed-in player follows; null when not signed in. */
export function useFollowing(client: SupabaseClient | null): Set<string> | null {
  const account = useAccount();
  const [set, setSet] = useState<Set<string> | null>(null);
  const userId = account.status === "signed-in" ? account.userId : null;
  useEffect(() => {
    if (!client || !userId) {
      setSet(null);
      return;
    }
    let alive = true;
    void followeesOf(client, userId)
      .then((ids) => profilesByUsers(client, ids))
      .then((rows) => alive && setSet(new Set(rows.map((r) => r.near_account_id))))
      .catch(() => alive && setSet(new Set()));
    return () => {
      alive = false;
    };
  }, [client, userId]);
  return set;
}

type Rows<T> = T[] | null | "error";

export function ActivityBoard({ client, only }: { client: SupabaseClient | null; only: Set<string> | null }) {
  const [rows, setRows] = useState<Rows<{ account_id: string; count: number }>>(null);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    void weekActivity(client)
      .then((r) => alive && setRows(rankActivity(r, 50)))
      .catch(() => alive && setRows("error"));
    return () => {
      alive = false;
    };
  }, [client]);
  const shown = Array.isArray(rows) ? rows.filter((r) => !only || only.has(r.account_id)).slice(0, 10) : [];
  const names = useNames(client, shown.map((r) => r.account_id));
  const levels = useLevels(client, shown.map((r) => r.account_id));
  if (rows === null) return <Empty icon="eye">reading activity_snacc…</Empty>;
  if (rows === "error") return <Empty icon="warn">The profile database did not answer. Nothing is shown in its place.</Empty>;
  if (shown.length === 0) return <Empty icon="podium">{only ? "Nobody you follow has recorded activity in the last 7 days." : "No recorded activity in the last 7 days."}</Empty>;
  return (
    <ol className="fd-list" aria-label="most active players, last 7 days" data-testid="board-active">
      {shown.map((r, i) => (
        <li key={r.account_id} className="fd-row" data-first={i === 0 ? "" : undefined}>
          <span className="fd-list__rank" aria-hidden="true">
            {i + 1}
          </span>
          <PlayerName account={r.account_id} username={names.get(r.account_id) ?? null} level={levels.get(r.account_id)} />
          <span className="fd-num feast-amount">
            {r.count} signed action{r.count === 1 ? "" : "s"}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function StreakBoard({ client, only }: { client: SupabaseClient | null; only: Set<string> | null }) {
  const [rows, setRows] = useState<Rows<StreakRow>>(null);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    void topStreaks(client, 50)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows("error"));
    return () => {
      alive = false;
    };
  }, [client]);
  const shown = Array.isArray(rows) ? rows.filter((r) => !only || only.has(r.near_account_id)).slice(0, 10) : [];
  const names = useNames(client, shown.map((r) => r.near_account_id));
  const levels = useLevels(client, shown.map((r) => r.near_account_id));
  if (rows === null) return <Empty icon="eye">reading streaks_snacc…</Empty>;
  if (rows === "error") return <Empty icon="warn">The profile database did not answer. Nothing is shown in its place.</Empty>;
  if (shown.length === 0) return <Empty icon="podium">{only ? "Nobody you follow has a feed streak right now." : "No feed streaks yet."}</Empty>;
  return (
    <ol className="fd-list" aria-label="longest feed streaks" data-testid="board-streaks">
      {shown.map((r, i) => (
        <li key={r.near_account_id} className="fd-row" data-first={i === 0 ? "" : undefined}>
          <span className="fd-list__rank" aria-hidden="true">
            {i + 1}
          </span>
          <PlayerName account={r.near_account_id} username={names.get(r.near_account_id) ?? null} level={levels.get(r.near_account_id)} />
          <span className="fd-num feast-amount">
            {r.current_streak_days} day{r.current_streak_days === 1 ? "" : "s"}
          </span>
        </li>
      ))}
    </ol>
  );
}
