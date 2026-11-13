/**
 * Pure helpers for daily quests, XP and levels (UI-153) and weekly seasons (UI-154): row types copied from
 * the backend views (`quest_days_snacc` through `snacc_my_quests()`, `player_xp_snacc`,
 * `season_leaderboard_snacc`, `hall_of_fame_snacc`), the XP bar maths, countdown text and the season date
 * maths. The season epoch and the level curve mirror the SQL (`snacc_season_epoch()`, `snacc_xp_for_level()`).
 *
 * XP, levels, quests, seasons and badges are cosmetic and off-chain: no token, no NEAR, no money value.
 */

// ------------------------------------------------------------------ rows

export interface QuestRow {
  quest_day: string;
  resets_at: string;
  slot: number;
  code: string;
  title: string;
  blurb: string;
  target: number;
  bonus_xp: number;
  progress: number;
  completed: boolean;
}

export interface PlayerXpRow {
  user_id: string;
  near_account_id: string;
  total_xp: number;
  level: number;
  level_start_xp: number;
  next_level_xp: number;
  quests_completed: number;
  actions: number;
}

export interface SeasonRow {
  season: number;
  starts_on: string;
  ends_on: string;
  rank: number;
  user_id: string;
  near_account_id: string;
  xp: number;
  actions: number;
  quests_completed: number;
}

export interface HallRow {
  season: number;
  starts_on: string;
  ends_on: string;
  rank: number;
  user_id: string;
  near_account_id: string;
  xp: number;
  quests_completed: number;
}

const toNum = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
};

/** Today's quests from `snacc_my_quests()`: numbers coerced, ordered by slot, at most three. */
export function normalizeQuests(data: unknown): QuestRow[] {
  if (!Array.isArray(data)) return [];
  return (data as Partial<Record<keyof QuestRow, unknown>>[])
    .map((r) => ({
      quest_day: String(r.quest_day ?? ""),
      resets_at: String(r.resets_at ?? ""),
      slot: toNum(r.slot),
      code: String(r.code ?? ""),
      title: String(r.title ?? ""),
      blurb: String(r.blurb ?? ""),
      target: Math.max(1, toNum(r.target, 1)),
      bonus_xp: toNum(r.bonus_xp),
      progress: Math.max(0, toNum(r.progress)),
      completed: r.completed === true,
    }))
    .filter((q) => q.code !== "")
    .sort((a, b) => a.slot - b.slot)
    .slice(0, QUESTS_PER_DAY);
}

export function normalizePlayerXp(data: unknown): PlayerXpRow | null {
  const r = (Array.isArray(data) ? data[0] : data) as Partial<Record<keyof PlayerXpRow, unknown>> | null | undefined;
  if (!r || typeof r !== "object") return null;
  const level = Math.max(1, toNum(r.level, 1));
  return {
    user_id: String(r.user_id ?? ""),
    near_account_id: String(r.near_account_id ?? ""),
    total_xp: toNum(r.total_xp),
    level,
    level_start_xp: toNum(r.level_start_xp, xpForLevel(level)),
    next_level_xp: toNum(r.next_level_xp, xpForLevel(level + 1)),
    quests_completed: toNum(r.quests_completed),
    actions: toNum(r.actions),
  };
}

export const QUESTS_PER_DAY = 3;

// ------------------------------------------------------------------ level curve

/** XP needed to reach `level` (level 1 = 0): 50 * (L - 1) * L, as in the database. */
export function xpForLevel(level: number): number {
  const l = Math.max(Math.trunc(level), 1);
  return 50 * (l - 1) * l;
}

export function levelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  let l = Math.max(1, Math.floor((1 + Math.sqrt(1 + (2 * xp) / 25)) / 2));
  while (xpForLevel(l + 1) <= xp) l++;
  while (l > 1 && xpForLevel(l) > xp) l--;
  return l;
}

export interface XpBarModel {
  level: number;
  totalXp: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level spans. */
  span: number;
  /** 0..100, whole percent filled. */
  percent: number;
  /** XP still missing for the next level. */
  toNext: number;
}

/** Bar maths for a player's XP row; null (no recorded action yet) is level 1 with 0 XP. */
export function xpBar(row: PlayerXpRow | null | undefined): XpBarModel {
  const level = Math.max(1, row?.level ?? 1);
  const totalXp = Math.max(0, row?.total_xp ?? 0);
  const start = row?.level_start_xp ?? xpForLevel(level);
  const next = row?.next_level_xp ?? xpForLevel(level + 1);
  const span = Math.max(1, next - start);
  const into = Math.min(span, Math.max(0, totalXp - start));
  return { level, totalXp, into, span, percent: Math.min(100, Math.floor((into / span) * 100)), toNext: Math.max(0, next - totalXp) };
}

/** Whole percent of a quest's target reached, clamped to 0..100. */
export function questPercent(q: Pick<QuestRow, "progress" | "target">): number {
  return Math.min(100, Math.max(0, Math.floor((q.progress / Math.max(1, q.target)) * 100)));
}

export const questsDone = (quests: readonly QuestRow[]): number => quests.filter((q) => q.completed).length;

// ------------------------------------------------------------------ time

export const DAY_MS = 86_400_000;

/** The next 00:00 UTC strictly after `nowMs` (when daily quests reset). */
export const nextUtcMidnightMs = (nowMs: number): number => (Math.floor(nowMs / DAY_MS) + 1) * DAY_MS;

/** "3d 4h", "5h 12m", "12m" or "under a minute"; "now" at or below zero. */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "now";
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "under a minute";
}

// ------------------------------------------------------------------ seasons

/** Season 1 starts on this Monday, 00:00 UTC (`snacc_season_epoch()` in the database). */
export const SEASON_EPOCH_MS = Date.UTC(2026, 10, 2);
export const SEASON_MS = 7 * DAY_MS;

/** Season number of the UTC day containing `ms` (0 and below = before season 1). */
export function seasonOf(ms: number): number {
  const midnight = Math.floor(ms / DAY_MS) * DAY_MS;
  return Math.floor((midnight - SEASON_EPOCH_MS) / SEASON_MS) + 1;
}

/** Monday 00:00 UTC that opens a season. */
export const seasonStartMs = (season: number): number => SEASON_EPOCH_MS + (season - 1) * SEASON_MS;

/** First instant after a season: the next Monday 00:00 UTC. */
export const seasonEndMs = (season: number): number => seasonStartMs(season) + SEASON_MS;

const SHORT_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Nov 9 to Nov 15 (UTC)": the season's first and last day. */
export function seasonRangeLabel(season: number): string {
  return `${SHORT_DAY.format(seasonStartMs(season))} to ${SHORT_DAY.format(seasonEndMs(season) - DAY_MS)} (UTC)`;
}

export type SeasonScope = number | "all";

/** Selector options: the running season first, then finished seasons that have a hall of fame, newest first, then all time. */
export function seasonOptions(currentSeason: number, finished: readonly number[]): { value: SeasonScope; label: string }[] {
  const past = [...new Set(finished)].filter((s) => s >= 1 && s < currentSeason).sort((a, b) => b - a);
  return [
    ...(currentSeason >= 1 ? [{ value: currentSeason as SeasonScope, label: `Season ${currentSeason} (this week)` }] : []),
    ...past.map((s) => ({ value: s as SeasonScope, label: `Season ${s}` })),
    { value: "all" as SeasonScope, label: "All time" },
  ];
}

/** One finished season of the hall of fame with its top three, best first. */
export interface HallSeason {
  season: number;
  starts_on: string;
  ends_on: string;
  top: HallRow[];
}

export function groupHallOfFame(rows: readonly HallRow[]): HallSeason[] {
  const by = new Map<number, HallSeason>();
  for (const r of rows) {
    const s = by.get(r.season) ?? { season: r.season, starts_on: r.starts_on, ends_on: r.ends_on, top: [] };
    s.top.push(r);
    by.set(r.season, s);
  }
  return [...by.values()].map((s) => ({ ...s, top: s.top.sort((a, b) => a.rank - b.rank).slice(0, 3) })).sort((a, b) => b.season - a.season);
}

export function normalizeSeasonRows<T extends { season?: unknown; rank?: unknown; xp?: unknown }>(data: unknown): T[] {
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((r) => ({ ...r, season: toNum(r.season), rank: toNum(r.rank), xp: toNum(r.xp), actions: toNum(r.actions), quests_completed: toNum(r.quests_completed) }) as unknown as T);
}

export function normalizeXpRows(data: unknown): PlayerXpRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((r) => normalizePlayerXp(r)).filter((r): r is PlayerXpRow => r !== null);
}

/** NEAR account to level, for the "Lv" badge next to a name. */
export function levelMap(rows: readonly Pick<PlayerXpRow, "near_account_id" | "level">[]): Map<string, number> {
  return new Map(rows.map((r) => [r.near_account_id, Math.max(1, toNum(r.level, 1))]));
}

// ------------------------------------------------------------------ how XP works (player-facing, mirrors the database)

export const XP_PER_ACTION: readonly { action: string; xp: number }[] = [
  { action: "hatch a Snacc", xp: 25 },
  { action: "splice two Snaccs", xp: 20 },
  { action: "divide a Snacc", xp: 15 },
  { action: "adopt a hungry Snacc", xp: 15 },
  { action: "burn elixir-aether", xp: 12 },
  { action: "feed a Snacc", xp: 10 },
  { action: "synthesize elixir", xp: 10 },
  { action: "allocate ATP", xp: 8 },
  { action: "transmute spores to enzyme", xp: 8 },
  { action: "extract spores", xp: 6 },
  { action: "give a Snacc away", xp: 5 },
  { action: "buy spores from a merchant", xp: 4 },
  { action: "any other recorded action", xp: 2 },
];
export const DAILY_XP_ACTION_CAP = 40;
