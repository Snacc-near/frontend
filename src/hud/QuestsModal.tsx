/**
 * Quests window (UI-153): today's three daily quests with progress bars, the countdown to the 00:00 UTC
 * reset, and the player's level and XP. Everything is read from the database (`snacc_my_quests()` and
 * `player_xp_snacc`); progress is computed there from the actions recorded for the signed-in profile, so
 * nothing in this window can change it. XP, levels and badges are cosmetic and off-chain: no token, no NEAR.
 * Signed out (or the profile features off), the window explains that quests need a sign-in.
 */
import { useEffect, useState } from "react";
import { useAccount } from "../account/session.tsx";
import { myQuests, playerXpOf } from "../account/api.ts";
import {
  DAILY_XP_ACTION_CAP,
  DAY_MS,
  QUESTS_PER_DAY,
  XP_PER_ACTION,
  formatCountdown,
  nextUtcMidnightMs,
  questPercent,
  questsDone,
  type PlayerXpRow,
  type QuestRow,
} from "../account/quests.ts";
import { Modal } from "../ui/Modal.tsx";
import { Empty, KeycapButton } from "../ui/controls.tsx";
import { Icon, Tag } from "../ui/fd.tsx";
import { ProgressBar, XpBar, useNow } from "./XpWidgets.tsx";
import { SignInPrompt } from "./SignInPrompt.tsx";
import "../account/account.css";

export interface QuestsModalProps {
  onClose: () => void;
}

/** The quest rows: title, progress bar, bonus XP; a finished quest says so. */
export function QuestList({ quests }: { quests: readonly QuestRow[] }) {
  return (
    <ol className="fd-list acct-quests" aria-label="today's quests" data-testid="quest-list">
      {quests.map((q) => {
        const shown = Math.min(q.progress, q.target);
        return (
          <li key={q.code} className="acct-quest" data-done={q.completed ? "" : undefined} data-testid="quest-row">
            <div className="fd-row fd-row--between">
              <span className="acct-quest__title">
                {q.completed ? <Icon name="check" /> : null}
                {q.title}
              </span>
              <span className="fd-num" data-testid="quest-count">
                {shown} / {q.target}
              </span>
            </div>
            <p className="acct-quest__blurb">{q.blurb}</p>
            <ProgressBar value={q.progress} max={q.target} percent={questPercent(q)} done={q.completed} label={`${q.title}: ${shown} of ${q.target}`} />
            <span className="fd-sub" data-testid="quest-reward">
              {q.completed ? `done · +${q.bonus_xp} XP added` : `+${q.bonus_xp} XP bonus when done`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Resets in 5h 12m" with the fixed reset time; `resetsAtMs` is the next 00:00 UTC. */
export function ResetNote({ resetsAtMs, nowMs }: { resetsAtMs: number; nowMs: number }) {
  return (
    <span className="fd-sub" data-testid="quest-reset">
      resets in {formatCountdown(resetsAtMs - nowMs)} · 00:00 UTC
    </span>
  );
}

/** Player-facing summary of the XP rules (the database is the source of truth). */
export function XpRules() {
  return (
    <details className="acct-details" data-testid="xp-rules">
      <summary>How XP works</summary>
      <div className="fd-stack">
        <ul className="acct-rules">
          {XP_PER_ACTION.map((r) => (
            <li key={r.action}>
              <span>{r.action}</span>
              <span className="fd-num">+{r.xp} XP</span>
            </li>
          ))}
        </ul>
        <p className="fd-field__hint">
          Only the first {DAILY_XP_ACTION_CAP} recorded actions of a UTC day earn XP. Each finished quest adds its bonus once. Level L needs 50 × (L − 1) × L XP in total
          (level 2 at 100, level 3 at 300, level 4 at 600).
        </p>
      </div>
    </details>
  );
}

export function QuestsModal({ onClose }: QuestsModalProps) {
  const account = useAccount();
  const { client, userId } = account;
  const signedIn = account.status === "signed-in" && client !== null && userId !== null;
  const now = useNow(15_000);
  const day = Math.floor(now / DAY_MS);

  const [quests, setQuests] = useState<QuestRow[] | null | "error">(null);
  const [xp, setXp] = useState<PlayerXpRow | null | undefined>(undefined);
  const [reload, setReload] = useState(0);

  // Read on open, when the UTC day turns over, on "refresh" and once a minute (recorded actions land a few seconds after a signed action).
  useEffect(() => {
    if (!signedIn || !client || !userId) return;
    let alive = true;
    void myQuests(client)
      .then((r) => alive && setQuests(r))
      .catch(() => alive && setQuests("error"));
    void playerXpOf(client, { userId })
      .then((r) => alive && setXp(r))
      .catch(() => alive && setXp(null));
    return () => {
      alive = false;
    };
  }, [signedIn, client, userId, reload, day]);
  useEffect(() => {
    if (!signedIn) return;
    const id = window.setInterval(() => setReload((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [signedIn]);

  const list = Array.isArray(quests) ? quests : [];
  const resetsAt = Date.parse(list[0]?.resets_at ?? "");
  const resetsAtMs = Number.isFinite(resetsAt) && resetsAt > now ? resetsAt : nextUtcMidnightMs(now);

  return (
    <Modal
      title="quests.md"
      heading="Daily quests"
      onClose={onClose}
      size="lg"
      testId="quests-modal"
      footer={
        <>
          <span>from your recorded actions (snacc_my_quests, player_xp_snacc) · XP and levels are cosmetic, off-chain, no token</span>
          <Tag>testnet</Tag>
        </>
      }
    >
      {!signedIn ? (
        <SignInPrompt icon="check" testId="quests-signin">
          Quests need a sign-in. Every day you get three quests, such as feeding a Snacc or running a production stage, and Snacc counts them from the signed actions
          recorded for your profile, so it has to know which profile is yours. Finishing quests earns XP and levels, which are cosmetic: no tokens, no NEAR. Signing in
          asks your wallet to sign a short message; it is not a transaction and costs nothing.
        </SignInPrompt>
      ) : (
        <div className="fd-stack">
          <XpBar xp={xp} />

          <section className="fd-stack" aria-labelledby="quests-today">
            <div className="fd-row fd-row--between">
              <h4 id="quests-today" className="fd-h" data-testid="quests-today">
                Today · {questsDone(list)} of {list.length || QUESTS_PER_DAY} done
              </h4>
              <ResetNote resetsAtMs={resetsAtMs} nowMs={now} />
            </div>
            {quests === null ? (
              <Empty icon="eye">reading today's quests…</Empty>
            ) : quests === "error" ? (
              <Empty icon="warn">The profile database did not answer, or quests are not switched on there yet. Nothing is shown in its place.</Empty>
            ) : list.length === 0 ? (
              <Empty icon="lines">No quests were returned for today. Try refresh in a moment.</Empty>
            ) : (
              <QuestList quests={list} />
            )}
            <div className="fd-row">
              <KeycapButton mono icon="swap" onClick={() => setReload((n) => n + 1)} data-testid="quests-refresh">
                refresh
              </KeycapButton>
              <span className="fd-field__hint">A signed action shows up here a few seconds after it succeeds, once it has been recorded for your profile.</span>
            </div>
          </section>

          <XpRules />
        </div>
      )}
    </Modal>
  );
}

export default QuestsModal;
