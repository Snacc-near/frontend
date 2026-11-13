/**
 * Table reads and writes for the player-account layer (UI-148, UI-149). Names are the backend's
 * (`profiles_snacc`, `activity_snacc`, `notifications_snacc`, `notification_prefs_snacc`,
 * `achievements_snacc`, `streaks_snacc`, `follows_snacc`; UI-153/154: `snacc_my_quests()`,
 * `player_xp_snacc`, `season_leaderboard_snacc`, `hall_of_fame_snacc`); row-level security decides what each
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
import {
  normalizePlayerXp,
  normalizeQuests,
  normalizeSeasonRows,
  normalizeXpRows,
  type HallRow,
  type PlayerXpRow,
  type QuestRow,
  type SeasonRow,
} from "./quests.ts";

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

/** UI-162: plain text for the database's profile errors (taken name, moderation trigger). */
export function profileSaveError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "That username is taken. Pick another.";
  if (error.message === "username_not_allowed") return "That username is reserved or contains a blocked word. Pick another.";
  if (error.message === "bio_not_allowed") return "Your bio contains a blocked word. Change it and save again.";
  return error.message;
}

/** Saves the player's own profile; returns a plain error message or null. */
export async function saveProfile(c: SupabaseClient, userId: string, patch: ProfilePatch): Promise<{ row: ProfileRow | null; error: string | null }> {
  const { data, error } = await c.from("profiles_snacc").update(patch).eq("user_id", userId).select(PROFILE_COLS);
  if (error) return { row: null, error: profileSaveError(error) };
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

// ------------------------------------------------------------------ quests, XP and seasons (UI-153, UI-154)

/**
 * Today's three quests of the signed-in player (`snacc_my_quests()`; progress is computed by the database from
 * recorded activity, so there is nothing to write). Throws with the database's message on failure, so the
 * window can tell "could not read" from "no quests".
 */
export async function myQuests(c: SupabaseClient): Promise<QuestRow[]> {
  const { data, error } = await c.rpc("snacc_my_quests");
  if (error) throw new Error(error.message);
  return normalizeQuests(data);
}

const XP_COLS = "user_id,near_account_id,total_xp,level,level_start_xp,next_level_xp,quests_completed,actions";

/** Total XP and level of one player (`player_xp_snacc`); null when nothing has been recorded yet. */
export async function playerXpOf(c: SupabaseClient, by: { userId?: string; accountId?: string }): Promise<PlayerXpRow | null> {
  let q = c.from("player_xp_snacc").select(XP_COLS);
  q = by.userId ? q.eq("user_id", by.userId) : q.eq("near_account_id", by.accountId ?? "");
  const { data } = await q.maybeSingle();
  return normalizePlayerXp(data);
}

/** Level per NEAR account, for the badge in leaderboard rows. */
export async function levelsByAccounts(c: SupabaseClient, accounts: readonly string[]): Promise<Pick<PlayerXpRow, "near_account_id" | "level">[]> {
  if (accounts.length === 0) return [];
  const { data } = await c.from("player_xp_snacc").select("near_account_id,level").in("near_account_id", [...new Set(accounts)]);
  return ((data as Pick<PlayerXpRow, "near_account_id" | "level">[] | null) ?? []).map((r) => ({ near_account_id: r.near_account_id, level: Number(r.level) || 1 }));
}

const SEASON_COLS = "season,starts_on,ends_on,rank,user_id,near_account_id,xp,actions,quests_completed";

/** One season's board, best first (`season_leaderboard_snacc`). */
export async function seasonBoard(c: SupabaseClient, season: number, limit = 50): Promise<SeasonRow[]> {
  const { data } = await c.from("season_leaderboard_snacc").select(SEASON_COLS).eq("season", season).order("rank", { ascending: true }).limit(limit);
  return normalizeSeasonRows<SeasonRow>(data);
}

/** All-time board by total XP (`player_xp_snacc`). */
export async function allTimeBoard(c: SupabaseClient, limit = 50): Promise<PlayerXpRow[]> {
  const { data } = await c.from("player_xp_snacc").select(XP_COLS).order("total_xp", { ascending: false }).limit(limit);
  return normalizeXpRows(data);
}

/** Top three of every finished season, newest season first (`hall_of_fame_snacc`). */
export async function hallOfFame(c: SupabaseClient, limit = 60): Promise<HallRow[]> {
  const { data } = await c
    .from("hall_of_fame_snacc")
    .select("season,starts_on,ends_on,rank,user_id,near_account_id,xp,quests_completed")
    .order("season", { ascending: false })
    .order("rank", { ascending: true })
    .limit(limit);
  return normalizeSeasonRows<HallRow>(data);
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

// ------------------------------------------------------------------ export (UI-163)

/** The caller's own off-chain data (`snacc_export_my_data()`, format `snacc-export-v1`). */
export async function exportMyData(c: SupabaseClient): Promise<{ data: unknown; error: string | null }> {
  try {
    const { data, error } = await c.rpc("snacc_export_my_data");
    return error ? { data: null, error: `The database refused: ${error.message}` } : { data, error: null };
  } catch (e) {
    return { data: null, error: `The request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ------------------------------------------------------------------ moderation + admin (UI-162, OPS-127)

export interface AnnouncementRow {
  id: number;
  title: string;
  body: string;
  created_at: string;
  expires_at: string | null;
}

/** Unexpired announcements, newest first (public read; RLS hides expired ones). */
export async function loadAnnouncements(c: SupabaseClient, limit = 3): Promise<AnnouncementRow[]> {
  const { data, error } = await c.from("announcements_snacc").select("id,title,body,created_at,expires_at").order("created_at", { ascending: false }).limit(limit);
  return error ? [] : ((data as AnnouncementRow[] | null) ?? []);
}

export async function amIAdmin(c: SupabaseClient): Promise<boolean> {
  const { data, error } = await c.rpc("snacc_is_admin");
  return !error && data === true;
}

async function adminRpc<T>(c: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await c.rpc(fn, args);
    if (error) return { data: null, error: error.message === "admin_only" ? "Only admins can do this." : error.message };
    return { data: data as T, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sends an announcement + a system notification to every profile; returns how many were notified. */
export const adminBroadcast = (c: SupabaseClient, title: string, body: string, days: number) =>
  adminRpc<number>(c, "snacc_admin_broadcast", { p_title: title, p_body: body, p_days: days });
export const adminResetProfileText = (c: SupabaseClient, account: string) =>
  adminRpc<boolean>(c, "snacc_admin_reset_profile_text", { p_account: account });
export const adminBlockTerm = (c: SupabaseClient, term: string, kind: "abusive" | "reserved") =>
  adminRpc<null>(c, "snacc_admin_block_term", { p_term: term, p_kind: kind });

export interface FunnelDay {
  day: string;
  landing: number;
  app: number;
  onboarding_done: number;
  wallet_connected: number;
  signed_in: number;
  tx_succeeded: number;
  errors: number;
}
export interface RetentionRow {
  cohort: string;
  devices: number;
  d1: number;
  d7: number;
}
export interface TopError {
  name: string;
  message: string | null;
  route: string;
  n: number;
  last_seen: string;
}
export interface AdminMetrics {
  since: string;
  funnel: FunnelDay[];
  retention: RetentionRow[];
  top_errors: TopError[];
}
/** OPS-127 aggregates (admins only). */
export const adminMetrics = (c: SupabaseClient, days = 14) => adminRpc<AdminMetrics>(c, "snacc_admin_metrics", { p_days: days });
