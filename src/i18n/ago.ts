/**
 * "5 min ago" in the reader's language (UI-161). Same thresholds as `relativeTime` in `account/chain.ts`
 * (which keeps its English text for the code that still uses it): "just now", minutes, hours, days, then the date.
 */
import type { Translate } from "./catalog.ts";

export function agoText(t: Translate, iso: string, nowMs: number = Date.now()): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "—";
  const s = Math.floor((nowMs - at) / 1000);
  if (s < 45) return t("collection.ago.now");
  if (s < 90) return t("collection.ago.min1");
  const m = Math.round(s / 60);
  if (m < 60) return t("collection.ago.min", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t("collection.ago.hour", { n: h });
  const days = Math.round(h / 24);
  if (days < 14) return t(days === 1 ? "collection.ago.dayOne" : "collection.ago.dayMany", { n: days });
  return new Date(at).toISOString().slice(0, 10);
}
