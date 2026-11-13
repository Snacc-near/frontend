/**
 * Small shared pieces for quests, XP and seasons (UI-153, UI-154): a level badge for names, a labelled
 * progress bar, the XP/level bar and a clock hook for countdowns. Presentational; styles in `account.css`.
 * XP and levels are cosmetic and off-chain.
 */
import { useEffect, useState } from "react";
import { xpBar, type PlayerXpRow } from "../account/quests.ts";
import "../account/account.css";

/** "Lv 4" chip shown next to a player's name. */
export function LevelBadge({ level }: { level: number }) {
  return (
    <span className="acct-level-badge" title={`level ${level}`} data-testid="level-badge">
      Lv {level}
    </span>
  );
}

/** A filled bar with a real `progressbar` role: `value` of `max`, announced as `label`. */
export function ProgressBar({ value, max, label, percent, done = false }: { value: number; max: number; label: string; percent: number; done?: boolean }) {
  return (
    <div className="acct-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} data-done={done ? "" : undefined}>
      <span className="acct-bar__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Level, total XP and the bar to the next level. `xp` null = nothing recorded yet (level 1, 0 XP). */
export function XpBar({ xp }: { xp: PlayerXpRow | null | undefined }) {
  const b = xpBar(xp);
  return (
    <section className="fd-stack" aria-label="level and experience" data-testid="xp-bar">
      <div className="fd-row fd-row--between">
        <span className="acct-level">Level {b.level}</span>
        <span className="fd-num" data-testid="xp-total">
          {b.totalXp.toLocaleString("en-US")} XP
        </span>
      </div>
      <ProgressBar value={b.into} max={b.span} percent={b.percent} label={`level ${b.level}: ${b.into} of ${b.span} XP`} />
      <p className="fd-field__hint" data-testid="xp-to-next">
        {b.toNext.toLocaleString("en-US")} XP to level {b.level + 1}
      </p>
    </section>
  );
}

/** Current time in ms, refreshed every `everyMs` while mounted (for countdowns). */
export function useNow(everyMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}
