/**
 * Profile window (UI-148): username, bio and avatar (picked from your own Snaccs, shown as their
 * on-chain SVG), level and XP (UI-153), achievements with how to earn each, the current feed streak, recent recorded
 * activity, a "Copy profile link" key and "Delete my profile". Data: `profiles_snacc`,
 * `achievements_snacc`, `streaks_snacc`, `activity_snacc` (row-level security applies); the avatar
 * list comes from contract views (`fetchCollection`).
 *
 * UI-161 phase B3: text comes from the `social.profile` dictionary; achievement names read `social.achievements`.
 */
import { useEffect, useId, useState } from "react";
import { useWallet } from "../chain/wallet.tsx";
import { useAccount } from "../account/session.tsx";
import { achievementsOf, deleteMyAccount, playerXpOf, recentActivity, saveProfile, streakOf } from "../account/api.ts";
import type { PlayerXpRow } from "../account/quests.ts";
import {
  ACHIEVEMENTS,
  BIO_MAX,
  bioProblem,
  normalizeUsername,
  usernameProblem,
  type AchievementRow,
  type ActivityRow,
  type StreakRow,
} from "../account/model.ts";
import { profilePath, profileUrl } from "../account/config.ts";
import { inviteShare, referralCountsOf, type RecruitCounts } from "../account/referral.ts";
import { fetchCollection, type CollectionItem } from "../data/collection.ts";
import { explorerTx } from "../data/nearView.ts";
import { accountMessageText } from "../i18n/accountText.ts";
import { achievementText, usernameProblemText } from "../i18n/achievements.ts";
import { useT } from "../i18n/react.tsx";
import { ISSUES_URL } from "../legal/content.ts";
import { Modal } from "../ui/Modal.tsx";
import { CopyButton, Empty, ExtLink, Field, Input, KeycapButton } from "../ui/controls.tsx";
import { Tag } from "../ui/fd.tsx";
import { InviteFriends } from "./InviteFriends.tsx";
import { LevelBadge, XpBar } from "./XpWidgets.tsx";
import "../account/account.css";

export interface ProfileModalProps {
  onClose: () => void;
}

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { t, rich } = useT();
  const account = useAccount();
  const wallet = useWallet();
  const uid = useId();
  const { client, userId, profile, nearAccountId } = account;
  const signedIn = account.status === "signed-in" && client !== null && userId !== null;

  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatar, setAvatar] = useState<number | null>(profile?.avatar_strain_id ?? null);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [own, setOwn] = useState<CollectionItem[] | null>(null);
  const [badges, setBadges] = useState<AchievementRow[]>([]);
  const [streak, setStreak] = useState<StreakRow | null>(null);
  const [xp, setXp] = useState<PlayerXpRow | null>(null);
  const [recruits, setRecruits] = useState<RecruitCounts | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  useEffect(() => {
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? "");
    setAvatar(profile?.avatar_strain_id ?? null);
  }, [profile]);

  useEffect(() => {
    if (!signedIn || !client || !userId) return;
    let alive = true;
    void achievementsOf(client, userId).then((r) => alive && setBadges(r)).catch(() => undefined);
    void streakOf(client, { userId }).then((r) => alive && setStreak(r)).catch(() => undefined);
    void playerXpOf(client, { userId }).then((r) => alive && setXp(r)).catch(() => undefined);
    void referralCountsOf(client, userId).then((r) => alive && setRecruits(r));
    void recentActivity(client, { userId }).then((r) => alive && setActivity(r)).catch(() => alive && setActivity([]));
    return () => {
      alive = false;
    };
  }, [signedIn, client, userId]);

  useEffect(() => {
    if (!nearAccountId) return;
    const ac = new AbortController();
    void fetchCollection(nearAccountId, ac.signal).then((r) => {
      if (!ac.signal.aborted) setOwn(r.kind === "ok" ? r.data.items : []);
    });
    return () => ac.abort();
  }, [nearAccountId]);

  const normalized = normalizeUsername(username);
  const userErr = usernameProblem(normalized);
  const bioErr = bioProblem(bio);
  const avatarItem = own?.find((i) => i.strainId === avatar) ?? null;

  const save = async () => {
    if (!client || !userId || userErr || bioErr) return;
    setSaving(true);
    setSaveMsg(null);
    const { row, error } = await saveProfile(client, userId, { username: normalized, bio: bio.trim(), avatar_strain_id: avatar });
    setSaving(false);
    if (error) setSaveMsg({ ok: false, text: error });
    else {
      account.setProfile(row);
      setSaveMsg({ ok: true, text: t("social.profile.saved") });
    }
  };

  const remove = async () => {
    if (!client || !userId) return;
    const problem = await deleteMyAccount(client);
    setConfirmDelete(false);
    if (problem) {
      setDeleteMsg(t("social.profile.deleteProblem", { problem: accountMessageText(t, problem) }));
      return;
    }
    setDeleteMsg(t("social.profile.deleted"));
    await account.signOut();
  };

  const earned = new Map(badges.map((b) => [b.code, b.earned_at]));
  const share = nearAccountId ? inviteShare(nearAccountId) : null;
  const streakDays = streak?.current_streak_days ?? 0;

  return (
    <Modal
      title={t("social.profile.title")}
      heading={t("social.profile.heading")}
      onClose={onClose}
      size="lg"
      testId="profile-modal"
      footer={
        <>
          <span>{t("social.profile.footer")}</span>
          <Tag>testnet</Tag>
        </>
      }
    >
      {!signedIn ? (
        <div className="fd-stack">
          <Empty icon="user">{t("social.profile.signInPrompt")}</Empty>
          {wallet.status === "connected" ? (
            <KeycapButton variant="primary" mono icon="lock" onClick={() => void account.signIn()} disabled={account.status === "signing"} data-testid="profile-signin">
              {account.status === "signing" ? t("social.profile.signing") : t("social.profile.signIn")}
            </KeycapButton>
          ) : (
            <KeycapButton variant="primary" mono icon="user" onClick={() => void wallet.connect()}>
              {t("social.profile.connectFirst")}
            </KeycapButton>
          )}
          {account.error ? (
            <p className="fd-field__hint fd-field__hint--bad" role="alert">
              {accountMessageText(t, account.error)}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="fd-stack">
          <section className="fd-stack" aria-labelledby={`${uid}-who`}>
            <div className="fd-row" style={{ alignItems: "flex-start", gap: 12 }}>
              {avatarItem?.mediaSrc ? (
                <img className="acct-avatar" src={avatarItem.mediaSrc} alt={t("social.profile.avatarAlt", { id: avatarItem.strainId })} data-testid="profile-avatar" />
              ) : (
                <span className="acct-avatar acct-avatar--none" role="img" aria-label={t("social.profile.noAvatar")}>
                  {t("social.profile.noAvatar")}
                </span>
              )}
              <div className="fd-stack" style={{ minWidth: 0 }}>
                <h4 id={`${uid}-who`} className="fd-h">
                  {profile?.username || nearAccountId} <LevelBadge level={xp?.level ?? 1} />
                </h4>
                <code>{nearAccountId}</code>
                <div className="fd-row">
                  <CopyButton label={t("social.profile.copyLink")} text={nearAccountId ? profileUrl(nearAccountId) : ""} />
                  {nearAccountId ? (
                    <a className="fd-a" href={profilePath(nearAccountId)} target="_blank" rel="noopener noreferrer">
                      {t("social.profile.openPublic")}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="fd-stack" aria-labelledby={`${uid}-xp`}>
            <h4 id={`${uid}-xp`} className="fd-h">
              {t("social.profile.xpTitle")}
            </h4>
            <XpBar xp={xp} />
            <p className="fd-field__hint">{t("social.profile.xpNote")}</p>
          </section>

          {nearAccountId ? (
            <InviteFriends account={nearAccountId} counts={recruits} onShare={share ? () => void share() : null} />
          ) : null}

          <section className="fd-stack" aria-label={t("social.profile.editLabel")}>
            <Field
              id={`${uid}-user`}
              label={t("social.profile.username")}
              hint={userErr && username ? usernameProblemText(t, userErr) : t("social.profile.usernameHint")}
              bad={Boolean(userErr && username)}
            >
              <Input
                id={`${uid}-user`}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
                data-testid="profile-username"
              />
            </Field>
            <Field
              id={`${uid}-bio`}
              label={t("social.profile.bio")}
              hint={bioErr ? t("social.profile.bioTooLong", { max: BIO_MAX, n: bio.length }) : `${bio.length}/${BIO_MAX}`}
              bad={Boolean(bioErr)}
            >
              <textarea id={`${uid}-bio`} className="fd-input acct-textarea" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX + 40} data-testid="profile-bio" />
            </Field>
            <div className="fd-stack">
              <span className="fd-sub">{t("social.profile.avatarField")}</span>
              {own === null ? (
                <Empty icon="eye">{t("social.profile.readingSnaccs")}</Empty>
              ) : own.length === 0 ? (
                <Empty icon="cell">{t("social.profile.noSnaccs")}</Empty>
              ) : (
                <ul className="acct-picker" aria-label={t("social.profile.pickAvatar")}>
                  <li>
                    <button type="button" aria-pressed={avatar === null} onClick={() => setAvatar(null)}>
                      <span className="acct-thumb-none acct-avatar--none">{t("social.profile.none")}</span>
                      {t("social.profile.none")}
                    </button>
                  </li>
                  {own.map((i) => (
                    <li key={i.strainId}>
                      <button type="button" aria-pressed={avatar === i.strainId} onClick={() => setAvatar(i.strainId)} aria-label={t("social.profile.useAs", { id: i.strainId })}>
                        {i.mediaSrc ? <img src={i.mediaSrc} alt="" loading="lazy" /> : <span className="acct-thumb-none acct-avatar--none">{t("market.row.noSvg")}</span>}#{i.strainId}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="fd-row">
              <KeycapButton variant="primary" mono icon="check" onClick={() => void save()} disabled={saving || Boolean(userErr) || Boolean(bioErr)} data-testid="profile-save">
                {saving ? t("social.profile.saving") : t("social.profile.save")}
              </KeycapButton>
              {saveMsg ? (
                <span className={saveMsg.ok ? "fd-field__hint" : "fd-field__hint fd-field__hint--bad"} role="status" data-testid="profile-save-msg">
                  {accountMessageText(t, saveMsg.text)}
                </span>
              ) : null}
            </div>
          </section>

          <section className="fd-stack" aria-labelledby={`${uid}-streak`}>
            <h4 id={`${uid}-streak`} className="fd-h">
              {t("social.profile.streakTitle")}
            </h4>
            <p data-testid="profile-streak">
              {rich(streakDays === 1 ? "social.profile.streakOne" : "social.profile.streakMany", { n: <strong>{streakDays}</strong> })}
              {streak?.last_feed_day ? <span className="fd-sub">{t("social.profile.lastFeed", { day: streak.last_feed_day })}</span> : null}
            </p>
            <p className="fd-field__hint">{t("social.profile.streakHint")}</p>
          </section>

          <section className="fd-stack" aria-labelledby={`${uid}-ach`}>
            <h4 id={`${uid}-ach`} className="fd-h">
              {t("social.profile.achievements", { earned: earned.size, total: ACHIEVEMENTS.length })}
            </h4>
            <ul className="acct-badges" data-testid="profile-achievements">
              {ACHIEVEMENTS.map((a) => (
                <li key={a.code} className="acct-badge" data-earned={earned.has(a.code) ? "" : undefined}>
                  <span className="acct-badge__name">{achievementText(t, a.code, "name", a.name)}</span>
                  <span className="acct-badge__how">{achievementText(t, a.code, "how", a.how)}</span>
                  <span className="acct-badge__when">{earned.has(a.code) ? t("social.profile.earned", { when: when(earned.get(a.code)) }) : t("social.profile.notYet")}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="fd-stack" aria-labelledby={`${uid}-act`}>
            <h4 id={`${uid}-act`} className="fd-h">
              {t("social.profile.activityTitle")}
            </h4>
            {activity === null ? (
              <Empty icon="eye">{t("social.profile.readingActivity")}</Empty>
            ) : activity.length === 0 ? (
              <Empty icon="lines">{t("social.profile.noActivity")}</Empty>
            ) : (
              <ol className="fd-list" data-testid="profile-activity">
                {activity.map((a) => (
                  <li key={a.tx_hash} className="fd-row fd-row--between">
                    <span>
                      <code>{a.method}</code>
                      {a.strain_id ? <span className="fd-sub">{t("social.profile.activityStrain", { id: a.strain_id })}</span> : null}
                    </span>
                    <span className="fd-sub">
                      {when(a.block_time)} · <ExtLink href={explorerTx(a.tx_hash)}>{t("market.tx.prefix")}</ExtLink>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="fd-stack" aria-labelledby={`${uid}-del`}>
            <h4 id={`${uid}-del`} className="fd-h">
              {t("social.profile.deleteTitle")}
            </h4>
            <p className="fd-field__hint">{rich("social.profile.deleteBody", { link: <ExtLink href={ISSUES_URL}>{t("social.profile.githubIssues")}</ExtLink> })}</p>
            {confirmDelete ? (
              <div className="fd-row">
                <KeycapButton mono icon="warn" onClick={() => void remove()} data-testid="profile-delete-confirm">
                  {t("social.profile.deleteConfirm")}
                </KeycapButton>
                <KeycapButton mono onClick={() => setConfirmDelete(false)}>
                  {t("social.profile.cancel")}
                </KeycapButton>
              </div>
            ) : (
              <KeycapButton mono icon="close" onClick={() => setConfirmDelete(true)} data-testid="profile-delete">
                {t("social.profile.deleteTitle")}
              </KeycapButton>
            )}
            {deleteMsg ? (
              <p className="fd-field__hint" role="status" data-testid="profile-delete-msg">
                {deleteMsg}
              </p>
            ) : null}
          </section>
        </div>
      )}
    </Modal>
  );
}

export default ProfileModal;
