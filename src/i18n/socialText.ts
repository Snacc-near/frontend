/**
 * Countdowns, season labels, XP rule names and urgency lines in the reader's language (UI-161). The
 * helpers in `account/quests.ts` and `account/model.ts` keep their English text for tests and other
 * callers; the quest, season and notification windows read these.
 */
import { DAY_MS, seasonEndMs, seasonOptions, seasonStartMs, type SeasonScope } from "../account/quests.ts";
import type { NotificationRow } from "../account/model.ts";
import type { Translate } from "./catalog.ts";
import type { Locale } from "./types.ts";

/** Same thresholds as `formatCountdown`: "3d 4h", "5h 12m", "12m", "under a minute", "now". */
export function countdownText(t: Translate, ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return t("social.countdown.now");
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return t("social.countdown.dh", { d, h });
  if (h > 0) return t("social.countdown.hm", { h, m });
  if (m > 0) return t("social.countdown.m", { m });
  return t("social.countdown.under");
}

const FORMATS: Partial<Record<Locale, Intl.DateTimeFormat>> = {};
const dayFormat = (locale: Locale): Intl.DateTimeFormat =>
  (FORMATS[locale] ??= new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" }));

/** "Nov 9 to Nov 15 (UTC)" in English, "9 Nov sampai 15 Nov (UTC)" in Indonesian. */
export function seasonRangeText(t: Translate, locale: Locale, season: number): string {
  const f = dayFormat(locale);
  return t("social.season.range", { from: f.format(seasonStartMs(season)), to: f.format(seasonEndMs(season) - DAY_MS) });
}

/** The season selector options with their labels in the reader's language. */
export function seasonOptionsText(t: Translate, current: number, finished: readonly number[]): { value: SeasonScope; label: string }[] {
  return seasonOptions(current, finished).map((o) => ({
    value: o.value,
    label: o.value === "all" ? t("social.season.all") : o.value === current ? t("social.season.seasonNow", { n: o.value }) : t("social.season.seasonN", { n: o.value }),
  }));
}

const XP_ACTION_KEYS: Readonly<Record<string, keyof typeof XP_KEYS>> = {
  "hatch a Snacc": "hatch",
  "splice two Snaccs": "splice",
  "divide a Snacc": "divide",
  "adopt a hungry Snacc": "adopt",
  "burn elixir-aether": "burn",
  "feed a Snacc": "feed",
  "synthesize elixir": "synthesize",
  "allocate ATP": "allocate",
  "transmute spores to enzyme": "transmute",
  "extract spores": "extract",
  "give a Snacc away": "gift",
  "buy spores from a merchant": "npc",
  "any other recorded action": "other",
};
const XP_KEYS = {
  hatch: "social.xpActions.hatch",
  splice: "social.xpActions.splice",
  divide: "social.xpActions.divide",
  adopt: "social.xpActions.adopt",
  burn: "social.xpActions.burn",
  feed: "social.xpActions.feed",
  synthesize: "social.xpActions.synthesize",
  allocate: "social.xpActions.allocate",
  transmute: "social.xpActions.transmute",
  extract: "social.xpActions.extract",
  gift: "social.xpActions.gift",
  npc: "social.xpActions.npc",
  other: "social.xpActions.other",
} as const;

/** An XP rule name from `XP_PER_ACTION`; an unknown one is shown as it came. */
export function xpActionText(t: Translate, action: string): string {
  const key = XP_ACTION_KEYS[action];
  return key ? t(XP_KEYS[key]) : action;
}

/** The urgency line under a starving or distressed notification (UI-159), or null. */
export function urgencyText(t: Translate, n: Pick<NotificationRow, "kind">): string | null {
  if (n.kind === "starving") return t("social.notif.urgencyStarving");
  if (n.kind === "distressed") return t("social.notif.urgencyDistressed");
  return null;
}
