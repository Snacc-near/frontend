/**
 * Quests window (UI-153): today's three daily quests with progress bars, the countdown to the 00:00 UTC
 * reset, and the player's level and XP. Everything is read from the database (`snacc_my_quests()` and
 * `player_xp_snacc`); progress is computed there from the actions recorded for the signed-in profile, so
 * nothing in this window can change it. XP, levels and badges are cosmetic and off-chain: no token, no NEAR.
 * Signed out (or the profile features off), the window explains that quests need a sign-in.
 *
 * UI-161 phase B3: text comes from the `social.quests` dictionary. Quest titles and blurbs come from the
 * database and are shown as they arrive.
 */
import { useEffect, useState } from "react";
import { useAccount } from "../account/session.tsx";
import { track } from "../telemetry.ts";
import { myQuests, playerXpOf } from "../account/api.ts";
import {
  DAILY_XP_ACTION_CAP,
  DAY_MS,
  QUESTS_PER_DAY,
  XP_PER_ACTION,
  nextUtcMidnightMs,
  questPercent,
  questsDone,
  type PlayerXpRow,
  type QuestRow,
} from "../account/quests.ts";
import { useT } from "../i18n/react.tsx";
import { countdownText, xpActionText } from "../i18n/socialText.ts";
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
  const { t } = useT();
  return (
    <ol className="fd-list acct-quests" aria-label={t("social.quests.listLabel")} data-testid="quest-list">
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
            <ProgressBar value={q.progress} max={q.target} percent={questPercent(q)} done={q.completed} label={t("social.quests.progress", { title: q.title, shown, target: q.target })} />
            <span className="fd-sub" data-testid="quest-reward">
              {q.completed ? t("social.quests.done", { xp: q.bonus_xp }) : t("social.quests.bonus", { xp: q.bonus_xp })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Resets in 5h 12m" with the fixed reset time; `resetsAtMs` is the next 00:00 UTC. */
export function ResetNote({ resetsAtMs, nowMs }: { resetsAtMs: number; nowMs: number }) {
  const { t } = useT();
  return (
    <span className="fd-sub" data-testid="quest-reset">
      {t("social.quests.resets", { time: countdownText(t, resetsAtMs - nowMs) })}
    </span>
  );
}

/** Player-facing summary of the XP rules (the database is the source of truth). */
export function XpRules() {
  const { t } = useT();
  return (
    <details className="acct-details" data-testid="xp-rules">
      <summary>{t("social.quests.rulesTitle")}</summary>
      <div className="fd-stack">
        <ul className="acct-rules">
          {XP_PER_ACTION.map((r) => (
            <li key={r.action}>
              <span>{xpActionText(t, r.action)}</span>
              <span className="fd-num">{t("social.xpPlus", { n: r.xp })}</span>
            </li>
          ))}
        </ul>
        <p className="fd-field__hint">{t("social.quests.rulesBody", { cap: DAILY_XP_ACTION_CAP })}</p>
      </div>
    </details>
  );
}

export function QuestsModal({ onClose }: QuestsModalProps) {
  const { t } = useT();
  useEffect(() => track("quest_opened"), []);
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
      title={t("social.quests.title")}
      heading={t("social.quests.heading")}
      onClose={onClose}
      size="lg"
      testId="quests-modal"
      footer={
        <>
          <span>{t("social.quests.footer")}</span>
          <Tag>testnet</Tag>
        </>
      }
    >
      {!signedIn ? (
        <SignInPrompt icon="check" testId="quests-signin">
          {t("social.quests.signInBody")}
        </SignInPrompt>
      ) : (
        <div className="fd-stack">
          <XpBar xp={xp} />

          <section className="fd-stack" aria-labelledby="quests-today">
            <div className="fd-row fd-row--between">
              <h4 id="quests-today" className="fd-h" data-testid="quests-today">
                {t("social.quests.today", { done: questsDone(list), total: list.length || QUESTS_PER_DAY })}
              </h4>
              <ResetNote resetsAtMs={resetsAtMs} nowMs={now} />
            </div>
            {quests === null ? (
              <Empty icon="eye">{t("social.quests.reading")}</Empty>
            ) : quests === "error" ? (
              <Empty icon="warn">{t("social.quests.dbDown")}</Empty>
            ) : list.length === 0 ? (
              <Empty icon="lines">{t("social.quests.none")}</Empty>
            ) : (
              <QuestList quests={list} />
            )}
            <div className="fd-row">
              <KeycapButton mono icon="swap" onClick={() => setReload((n) => n + 1)} data-testid="quests-refresh">
                {t("social.quests.refresh")}
              </KeycapButton>
              <span className="fd-field__hint">{t("social.quests.refreshHint")}</span>
            </div>
          </section>

          <XpRules />
        </div>
      )}
    </Modal>
  );
}

export default QuestsModal;
