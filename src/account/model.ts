/**
 * Pure helpers for the player-account layer (UI-148, UI-149): row types copied from the backend
 * tables (`*_snacc`), username and bio rules, the achievement catalog, the notification reducer,
 * leaderboard name merging, `record-tx` (fire and forget) and the starter-pack messages.
 */
import { AccountError, postFunction } from "./signIn.ts";
import type { SupabaseConfig } from "./config.ts";
import { track } from "../telemetry.ts";

// ------------------------------------------------------------------ rows

export interface ProfileRow {
  user_id: string;
  near_account_id: string;
  username: string | null;
  avatar_strain_id: number | null;
  bio: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityRow {
  tx_hash: string;
  user_id: string | null;
  near_account_id: string;
  method: string;
  strain_id: number | null;
  block_time: string;
}

export const NOTIFICATION_KINDS = ["starving", "distressed", "lost", "dividend", "starter", "system"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationRow {
  id: string | number;
  user_id: string;
  kind: NotificationKind;
  strain_id: number | null;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
}

export type NotificationPrefs = Record<NotificationKind, boolean>;
// The quoted "dividend" is the backend's kind identifier (`notifications_snacc.kind`), not prose;
// players see it as the industrial pool share.
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  starving: true,
  distressed: true,
  lost: true,
  "dividend": true,
  starter: true,
  system: true,
};

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  starving: "a Snacc of yours is starving",
  distressed: "a Snacc of yours is distressed",
  lost: "a Snacc of yours was snacked or lost",
  "dividend": "your industrial pool share is ready",
  starter: "starter pack updates",
  system: "game announcements",
};

/** Short tag per kind for the notification list. */
export const NOTIFICATION_KIND_TAGS: Record<NotificationKind, string> = {
  starving: "starving",
  distressed: "distressed",
  lost: "lost",
  "dividend": "pool share",
  starter: "starter pack",
  system: "system",
};

export interface AchievementRow {
  user_id: string;
  code: string;
  earned_at: string;
}

export interface StreakRow {
  user_id: string;
  near_account_id: string;
  current_streak_days: number;
  last_feed_day: string | null;
}

export interface FollowRow {
  follower: string;
  followee: string;
}

// ------------------------------------------------------------------ username and bio

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const BIO_MAX = 160;

/** Null when valid, else the plain reason. Usernames are lowercased before the check. */
export function usernameProblem(raw: string): string | null {
  const v = raw.trim();
  if (v.length === 0) return "Pick a username.";
  if (v.length < 3) return "At least 3 characters.";
  if (v.length > 20) return "At most 20 characters.";
  if (!USERNAME_RE.test(v)) return "Use only lowercase letters, digits and _.";
  return null;
}

export const normalizeUsername = (raw: string) => raw.trim().toLowerCase();

export function bioProblem(raw: string): string | null {
  return raw.length > BIO_MAX ? `At most ${BIO_MAX} characters (now ${raw.length}).` : null;
}

// ------------------------------------------------------------------ achievements

export interface AchievementDef {
  code: string;
  name: string;
  /** How to earn it, in plain words. The backend decides; this is the player-facing summary. */
  how: string;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { code: "first_hatch", name: "First hatch", how: "Hatch your first Snacc." },
  { code: "first_feed", name: "First feed", how: "Feed a Snacc for the first time." },
  { code: "feeds_10", name: "Ten feeds", how: "Feed Snaccs ten times." },
  { code: "streak_3", name: "Three-day streak", how: "Feed on three days in a row." },
  { code: "streak_7", name: "Seven-day streak", how: "Feed on seven days in a row." },
  { code: "rescuer", name: "Rescuer", how: "Feed a Snacc while it is starving or distressed." },
  { code: "gifter", name: "Gifter", how: "Gift a Snacc or $SNACC to another player." },
  { code: "colony_5", name: "Colony of five", how: "Own five living Snaccs at the same time." },
  // UI-153: awarded by the database when a daily quest is finished (cosmetic, off-chain).
  { code: "quest_first", name: "First quest", how: "Finish a daily quest." },
  { code: "quest_streak_7", name: "Seven quest days", how: "Finish at least one daily quest on seven days in a row." },
  // UI-158: awarded to the referrer when a friend who joined through their invite link hatches a first Snacc.
  { code: "recruiter", name: "Recruiter", how: "A friend you invited hatches their first Snacc." },
];

export function achievementName(code: string): string {
  return ACHIEVEMENTS.find((a) => a.code === code)?.name ?? code.replace(/_/g, " ");
}

/** Toast text for newly earned codes; null when none. */
export function achievementToast(codes: readonly string[]): string | null {
  if (codes.length === 0) return null;
  const names = codes.map(achievementName);
  return names.length === 1 ? `achievement earned: ${names[0]}` : `achievements earned: ${names.join(", ")}`;
}

// ------------------------------------------------------------------ notifications

export interface NotificationState {
  items: NotificationRow[];
}

export type NotificationAction =
  | { type: "load"; items: NotificationRow[] }
  | { type: "upsert"; item: NotificationRow }
  | { type: "markRead"; id: NotificationRow["id"]; at: string }
  | { type: "markAllRead"; at: string }
  | { type: "clear" };

const byNewest = (a: NotificationRow, b: NotificationRow) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);

export const NOTIFICATIONS_KEEP = 50;

export function notificationsReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case "load":
      return { items: [...action.items].sort(byNewest).slice(0, NOTIFICATIONS_KEEP) };
    case "upsert": {
      const rest = state.items.filter((n) => n.id !== action.item.id);
      return { items: [action.item, ...rest].sort(byNewest).slice(0, NOTIFICATIONS_KEEP) };
    }
    case "markRead":
      return { items: state.items.map((n) => (n.id === action.id && !n.read_at ? { ...n, read_at: action.at } : n)) };
    case "markAllRead":
      return { items: state.items.map((n) => (n.read_at ? n : { ...n, read_at: action.at })) };
    case "clear":
      return { items: [] };
  }
}

export const unreadCount = (items: readonly NotificationRow[]) => items.filter((n) => !n.read_at).length;

/** Kinds whose click opens that Snacc's detail. */
export const opensStrain = (n: NotificationRow) => (n.kind === "starving" || n.kind === "distressed") && typeof n.strain_id === "number";

/** UI-159: the Snacc a notification asks you to feed right now (starving/distressed), else null. */
export const feedTargetOf = (n: NotificationRow): number | null => (opensStrain(n) ? (n.strain_id as number) : null);

/** UI-159: window event that asks the app to open the feed window for `detail.strainId`. */
export const FEED_REQUEST_EVENT = "snacc:feed-request";

/** UI-159: `/app?feed=<id>` deep link (browser alerts, web push, shared links) → strain id, else null. */
export function feedParamOf(search: string): number | null {
  const raw = new URLSearchParams(search).get("feed");
  if (raw === null || !/^\d{1,9}$/.test(raw)) return null;
  return Number(raw);
}

/** UI-159: urgency line under a starving/distressed notification. */
export function urgencyOf(n: NotificationRow): string | null {
  if (n.kind === "starving") return "At risk now: anyone can harvest a starving Snacc. Feed it to keep it.";
  if (n.kind === "distressed") return "Vitality is low: feed it before it starves and can be harvested or adopted.";
  return null;
}

// ------------------------------------------------------------------ leaderboard

export interface NamedRow {
  account_id: string;
  username: string | null;
}

/** Adds `username` from `profiles_snacc` to each row, matched on the NEAR account id. */
export function mergeNames<T extends { account_id: string }>(rows: readonly T[], profiles: readonly Pick<ProfileRow, "near_account_id" | "username">[]): (T & NamedRow)[] {
  const names = new Map<string, string>();
  for (const p of profiles) if (p.username) names.set(p.near_account_id, p.username);
  return rows.map((r) => ({ ...r, username: names.get(r.account_id) ?? null }));
}

/** Counts activity rows per account and ranks them, most active first (ties by account id). */
export function rankActivity(rows: readonly Pick<ActivityRow, "near_account_id">[], top = 10): { account_id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.near_account_id, (counts.get(r.near_account_id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([account_id, count]) => ({ account_id, count }))
    .sort((a, b) => b.count - a.count || a.account_id.localeCompare(b.account_id))
    .slice(0, top);
}

/** Start of the "last 7 days" window as an ISO timestamp. */
export const sevenDaysAgoIso = (now = Date.now()) => new Date(now - 7 * 24 * 3600 * 1000).toISOString();

// ------------------------------------------------------------------ record-tx

export interface RecordTxResult {
  recorded: boolean;
  method: string | null;
  achievements: string[];
}

/**
 * Tells the backend about a signed transaction so it can record the activity and award achievements.
 * Fire and forget: every failure (no session, network, backend error, bad JSON) resolves to an empty
 * result and never throws, so the transaction's success UI is never affected.
 */
export async function recordTx(
  cfg: SupabaseConfig | null,
  accessToken: string | null,
  txHash: string | null | undefined,
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<RecordTxResult> {
  const none: RecordTxResult = { recorded: false, method: null, achievements: [] };
  if (!cfg || !accessToken || !txHash) return none;
  try {
    const out = await postFunction<Partial<RecordTxResult>>(cfg, "record-tx", { txHash }, { fetchFn, accessToken });
    return {
      recorded: out?.recorded === true,
      method: typeof out?.method === "string" ? out.method : null,
      achievements: Array.isArray(out?.achievements) ? out.achievements.filter((c): c is string => typeof c === "string") : [],
    };
  } catch {
    return none;
  }
}

// ------------------------------------------------------------------ starter pack

export type StarterOutcome =
  | { kind: "sent"; txHash: string; amountYocto: string }
  | { kind: "not_configured" | "already_claimed" | "balance_ok" | "error"; message: string };

export const STARTER_MESSAGES = {
  not_configured: "The starter pack is not switched on for this site yet. Use the NEAR testnet faucet instead.",
  already_claimed: "This account already received its starter pack. Use the NEAR testnet faucet for more.",
  balance_ok: "This account already has enough testnet NEAR to start, so no starter pack was sent.",
} as const;

/** Calls `starter-pack` and maps every answer to a plain outcome (never throws). */
export async function claimStarterPack(
  cfg: SupabaseConfig,
  accessToken: string,
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<StarterOutcome> {
  try {
    const out = await postFunction<{ txHash?: unknown; amountYocto?: unknown }>(cfg, "starter-pack", undefined, { fetchFn, accessToken });
    if (typeof out?.txHash === "string") {
      track("starter_claimed");
      return { kind: "sent", txHash: out.txHash, amountYocto: String(out.amountYocto ?? "0") };
    }
    return { kind: "error", message: "The starter pack service answered without a transaction." };
  } catch (e) {
    const code = e instanceof AccountError ? e.code : "error";
    if (code === "not_configured" || code === "already_claimed" || code === "balance_ok") return { kind: code, message: STARTER_MESSAGES[code] };
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
