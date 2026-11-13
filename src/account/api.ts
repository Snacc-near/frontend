/**
 * Table reads and writes for the player-account layer (UI-148, UI-149). Names are the backend's
 * (`profiles_snacc`, `activity_snacc`, `notifications_snacc`, `notification_prefs_snacc`,
 * `achievements_snacc`, `streaks_snacc`, `follows_snacc`); row-level security decides what each
 * call may touch. Every function takes the client, so this file never imports Supabase itself.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_KINDS,
  sevenDaysAgoIso,
  type AchievementRow,
  type ActivityRow,
  type FollowRow,
  type NotificationPrefs,
  type NotificationRow,
  type ProfileRow,
  type StreakRow,
} from "./model.ts";

const PROFILE_COLS = "user_id,near_account_id,username,avatar_strain_id,bio,created_at,updated_at";

export async function profileByAccount(c: SupabaseClient, accountId: string): Promise<ProfileRow | null> {
  const { data } = await c.from("profiles_snacc").select(PROFILE_COLS).eq("near_account_id", accountId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function profileByUser(c: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data } = await c.from("profiles_snacc").select(PROFILE_COLS).eq("user_id", userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function profilesByAccounts(c: SupabaseClient, accounts: readonly string[]): Promise<Pick<ProfileRow, "user_id" | "near_account_id" | "username">[]> {
  if (accounts.length === 0) return [];
  const { data } = await c.from("profiles_snacc").select("user_id,near_account_id,username").in("near_account_id", [...new Set(accounts)]);
  return (data as Pick<ProfileRow, "user_id" | "near_account_id" | "username">[] | null) ?? [];
}

export async function profilesByUsers(c: SupabaseClient, userIds: readonly string[]): Promise<Pick<ProfileRow, "user_id" | "near_account_id" | "username">[]> {
  if (userIds.length === 0) return [];
  const { data } = await c.from("profiles_snacc").select("user_id,near_account_id,username").in("user_id", [...new Set(userIds)]);
  return (data as Pick<ProfileRow, "user_id" | "near_account_id" | "username">[] | null) ?? [];
}

export interface ProfilePatch {
  username: string;
  bio: string;
  avatar_strain_id: number | null;
}

/** Saves the player's own profile; returns a plain error message or null. */
export async function saveProfile(c: SupabaseClient, userId: string, patch: ProfilePatch): Promise<{ row: ProfileRow | null; error: string | null }> {
  const { data, error } = await c.from("profiles_snacc").update(patch).eq("user_id", userId).select(PROFILE_COLS);
  if (error) return { row: null, error: error.code === "23505" ? "That username is taken. Pick another." : error.message };
  const row = (data as ProfileRow[] | null)?.[0] ?? null;
  if (!row) return { row: null, error: "No profile row was found for this sign-in. Sign out, sign in again and retry." };
  return { row, error: null };
}

export async function achievementsOf(c: SupabaseClient, userId: string): Promise<AchievementRow[]> {
  const { data } = await c.from("achievements_snacc").select("user_id,code,earned_at").eq("user_id", userId);
  return (data as AchievementRow[] | null) ?? [];
}

export async function streakOf(c: SupabaseClient, by: { userId?: string; accountId?: string }): Promise<StreakRow | null> {
  let q = c.from("streaks_snacc").select("user_id,near_account_id,current_streak_days,last_feed_day");
  q = by.userId ? q.eq("user_id", by.userId) : q.eq("near_account_id", by.accountId ?? "");
  const { data } = await q.maybeSingle();
  return (data as StreakRow | null) ?? null;
}

export async function recentActivity(c: SupabaseClient, by: { userId?: string; accountId?: string }, limit = 10): Promise<ActivityRow[]> {
  let q = c.from("activity_snacc").select("tx_hash,user_id,near_account_id,method,strain_id,block_time");
  q = by.userId ? q.eq("user_id", by.userId) : q.eq("near_account_id", by.accountId ?? "");
  const { data } = await q.order("block_time", { ascending: false }).limit(limit);
  return (data as ActivityRow[] | null) ?? [];
}

/** Activity of the last 7 days (account ids only), for the "Most active" board. */
export async function weekActivity(c: SupabaseClient, limit = 2000): Promise<Pick<ActivityRow, "near_account_id">[]> {
  const { data } = await c.from("activity_snacc").select("near_account_id").gte("block_time", sevenDaysAgoIso()).limit(limit);
  return (data as Pick<ActivityRow, "near_account_id">[] | null) ?? [];
}

export async function topStreaks(c: SupabaseClient, limit = 10): Promise<StreakRow[]> {
  const { data } = await c
    .from("streaks_snacc")
    .select("user_id,near_account_id,current_streak_days,last_feed_day")
    .gt("current_streak_days", 0)
    .order("current_streak_days", { ascending: false })
    .limit(limit);
  return (data as StreakRow[] | null) ?? [];
}

// ------------------------------------------------------------------ follows

export async function followeesOf(c: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await c.from("follows_snacc").select("follower,followee").eq("follower", userId);
  return ((data as FollowRow[] | null) ?? []).map((r) => r.followee);
}

export async function setFollow(c: SupabaseClient, follower: string, followee: string, on: boolean): Promise<string | null> {
  const { error } = on
    ? await c.from("follows_snacc").insert({ follower, followee })
    : await c.from("follows_snacc").delete().eq("follower", follower).eq("followee", followee);
  return error ? error.message : null;
}

// ------------------------------------------------------------------ notifications

export async function loadNotifications(c: SupabaseClient, userId: string, limit = 50): Promise<NotificationRow[]> {
  const { data } = await c
    .from("notifications_snacc")
    .select("id,user_id,kind,strain_id,title,body,created_at,read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as NotificationRow[] | null) ?? [];
}

export async function markNotificationsRead(c: SupabaseClient, userId: string, ids: readonly NotificationRow["id"][] | "all", at: string): Promise<void> {
  let q = c.from("notifications_snacc").update({ read_at: at }).eq("user_id", userId).is("read_at", null);
  if (ids !== "all") q = q.in("id", [...ids]);
  await q;
}

export async function loadNotificationPrefs(c: SupabaseClient, userId: string): Promise<NotificationPrefs> {
  const { data } = await c.from("notification_prefs_snacc").select(NOTIFICATION_KINDS.join(",")).eq("user_id", userId).maybeSingle();
  const row = (data ?? {}) as Partial<Record<string, unknown>>;
  const out = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const k of NOTIFICATION_KINDS) if (typeof row[k] === "boolean") out[k] = row[k] as boolean;
  return out;
}

export async function saveNotificationPrefs(c: SupabaseClient, userId: string, prefs: NotificationPrefs): Promise<string | null> {
  const { error } = await c.from("notification_prefs_snacc").upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
  return error ? error.message : null;
}

// ------------------------------------------------------------------ delete

/**
 * "Delete my account": calls the `snacc_delete_my_account()` database function, which deletes the
 * caller's sign-in user; every `*_snacc` row that belongs to it (profile, activity, notifications,
 * settings, achievements, follows) goes with it. Returns null on success, or a plain message.
 */
export async function deleteMyAccount(c: SupabaseClient): Promise<string | null> {
  try {
    const { error } = await c.rpc("snacc_delete_my_account");
    return error ? `The database refused: ${error.message}` : null;
  } catch (e) {
    return `The request failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}
