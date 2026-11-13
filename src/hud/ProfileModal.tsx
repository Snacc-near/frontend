/**
 * Profile window (UI-148): username, bio and avatar (picked from your own Snaccs, shown as their
 * on-chain SVG), achievements with how to earn each, the current feed streak, recent recorded
 * activity, a "Copy profile link" key and "Delete my profile". Data: `profiles_snacc`,
 * `achievements_snacc`, `streaks_snacc`, `activity_snacc` (row-level security applies); the avatar
 * list comes from contract views (`fetchCollection`).
 */
import { useEffect, useId, useState } from "react";
import { useWallet } from "../chain/wallet.tsx";
import { useAccount } from "../account/session.tsx";
import { achievementsOf, deleteOwnRows, recentActivity, saveProfile, streakOf } from "../account/api.ts";
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
import { fetchCollection, type CollectionItem } from "../data/collection.ts";
import { explorerTx } from "../data/nearView.ts";
import { ISSUES_URL } from "../legal/content.ts";
import { Modal } from "../ui/Modal.tsx";
import { CopyButton, Empty, ExtLink, Field, Input, KeycapButton } from "../ui/controls.tsx";
import { Tag } from "../ui/fd.tsx";
import "../account/account.css";

export interface ProfileModalProps {
  onClose: () => void;
}

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

export function ProfileModal({ onClose }: ProfileModalProps) {
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
      setSaveMsg({ ok: true, text: "Profile saved." });
    }
  };

  const remove = async () => {
    if (!client || !userId) return;
    const report = await deleteOwnRows(client, userId);
    const parts = [
      report.removed.length ? `Removed: ${report.removed.join(", ")}.` : "",
      report.failed.length ? `Could not remove: ${report.failed.join(", ")}.` : "",
      "Recorded activity and the sign-in record itself can only be removed by the project owner: ask through GitHub issues.",
    ].filter(Boolean);
    setDeleteMsg(parts.join(" "));
    setConfirmDelete(false);
    await account.refreshProfile();
  };

  const earned = new Map(badges.map((b) => [b.code, b.earned_at]));

  return (
    <Modal
      title="profile.md"
      heading="Your profile"
      onClose={onClose}
      size="lg"
      testId="profile-modal"
      footer={
        <>
          <span>stored in the Snacc profile database · public: username, bio, avatar, achievements, activity</span>
          <Tag>testnet</Tag>
        </>
      }
    >
      {!signedIn ? (
        <div className="fd-stack">
          <Empty icon="user">
            Sign in to keep a profile: a username, a bio, an avatar from your Snaccs, achievements and a feed streak. Signing in asks your wallet to sign a short
            message; it is not a transaction and costs nothing.
          </Empty>
          {wallet.status === "connected" ? (
            <KeycapButton variant="primary" mono icon="lock" onClick={() => void account.signIn()} disabled={account.status === "signing"} data-testid="profile-signin">
              {account.status === "signing" ? "sign the message in your wallet…" : "Save progress — sign in"}
            </KeycapButton>
          ) : (
            <KeycapButton variant="primary" mono icon="user" onClick={() => void wallet.connect()}>
              connect wallet first
            </KeycapButton>
          )}
          {account.error ? (
            <p className="fd-field__hint fd-field__hint--bad" role="alert">
              {account.error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="fd-stack">
          <section className="fd-stack" aria-labelledby={`${uid}-who`}>
            <div className="fd-row" style={{ alignItems: "flex-start", gap: 12 }}>
              {avatarItem?.mediaSrc ? (
                <img className="acct-avatar" src={avatarItem.mediaSrc} alt={`avatar: on-chain svg of strain ${avatarItem.strainId}`} data-testid="profile-avatar" />
              ) : (
                <span className="acct-avatar acct-avatar--none" role="img" aria-label="no avatar">
                  no avatar
                </span>
              )}
              <div className="fd-stack" style={{ minWidth: 0 }}>
                <h4 id={`${uid}-who`} className="fd-h">
                  {profile?.username || nearAccountId}
                </h4>
                <code>{nearAccountId}</code>
                <div className="fd-row">
                  <CopyButton label="Copy profile link" text={nearAccountId ? profileUrl(nearAccountId) : ""} />
                  {nearAccountId ? (
                    <a className="fd-a" href={profilePath(nearAccountId)} target="_blank" rel="noopener noreferrer">
                      open public page
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="fd-stack" aria-label="edit profile">
            <Field id={`${uid}-user`} label="username" hint={userErr && username ? userErr : "3 to 20 characters: a-z, 0-9 and _"} bad={Boolean(userErr && username)}>
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
            <Field id={`${uid}-bio`} label="bio" hint={bioErr ?? `${bio.length}/${BIO_MAX}`} bad={Boolean(bioErr)}>
              <textarea id={`${uid}-bio`} className="fd-input acct-textarea" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX + 40} data-testid="profile-bio" />
            </Field>
            <div className="fd-stack">
              <span className="fd-sub">avatar (one of your Snaccs)</span>
              {own === null ? (
                <Empty icon="eye">reading your Snaccs from the contract…</Empty>
              ) : own.length === 0 ? (
                <Empty icon="cell">No Snaccs yet. Hatch one to use it as your avatar.</Empty>
              ) : (
                <ul className="acct-picker" aria-label="pick an avatar">
                  <li>
                    <button type="button" aria-pressed={avatar === null} onClick={() => setAvatar(null)}>
                      <span className="acct-thumb-none acct-avatar--none">none</span>
                      none
                    </button>
                  </li>
                  {own.map((i) => (
                    <li key={i.strainId}>
                      <button type="button" aria-pressed={avatar === i.strainId} onClick={() => setAvatar(i.strainId)} aria-label={`use strain ${i.strainId} as avatar`}>
                        {i.mediaSrc ? <img src={i.mediaSrc} alt="" loading="lazy" /> : <span className="acct-thumb-none acct-avatar--none">no svg</span>}#{i.strainId}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="fd-row">
              <KeycapButton variant="primary" mono icon="check" onClick={() => void save()} disabled={saving || Boolean(userErr) || Boolean(bioErr)} data-testid="profile-save">
                {saving ? "saving…" : "save profile"}
              </KeycapButton>
              {saveMsg ? (
                <span className={saveMsg.ok ? "fd-field__hint" : "fd-field__hint fd-field__hint--bad"} role="status" data-testid="profile-save-msg">
                  {saveMsg.text}
                </span>
              ) : null}
            </div>
          </section>

          <section className="fd-stack" aria-labelledby={`${uid}-streak`}>
            <h4 id={`${uid}-streak`} className="fd-h">
              Feed streak
            </h4>
            <p data-testid="profile-streak">
              <strong>{streak?.current_streak_days ?? 0}</strong> day{(streak?.current_streak_days ?? 0) === 1 ? "" : "s"} in a row
              {streak?.last_feed_day ? <span className="fd-sub"> · last feed day {streak.last_feed_day}</span> : null}
            </p>
            <p className="fd-field__hint">A day counts when one of your recorded feeds lands on it (UTC). Miss a day and the streak starts again.</p>
          </section>

          <section className="fd-stack" aria-labelledby={`${uid}-ach`}>
            <h4 id={`${uid}-ach`} className="fd-h">
              Achievements · {earned.size} of {ACHIEVEMENTS.length}
            </h4>
            <ul className="acct-badges" data-testid="profile-achievements">
              {ACHIEVEMENTS.map((a) => (
                <li key={a.code} className="acct-badge" data-earned={earned.has(a.code) ? "" : undefined}>
                  <span className="acct-badge__name">{a.name}</span>
                  <span className="acct-badge__how">{a.how}</span>
                  <span className="acct-badge__when">{earned.has(a.code) ? `earned ${when(earned.get(a.code))}` : "not yet"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="fd-stack" aria-labelledby={`${uid}-act`}>
            <h4 id={`${uid}-act`} className="fd-h">
              Recent activity
            </h4>
            {activity === null ? (
              <Empty icon="eye">reading recorded activity…</Empty>
            ) : activity.length === 0 ? (
              <Empty icon="lines">Nothing recorded yet. Signed actions are recorded here after they succeed while you are signed in.</Empty>
            ) : (
              <ol className="fd-list" data-testid="profile-activity">
                {activity.map((a) => (
                  <li key={a.tx_hash} className="fd-row fd-row--between">
                    <span>
                      <code>{a.method}</code>
                      {a.strain_id ? <span className="fd-sub"> · strain #{a.strain_id}</span> : null}
                    </span>
                    <span className="fd-sub">
                      {when(a.block_time)} · <ExtLink href={explorerTx(a.tx_hash)}>tx</ExtLink>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="fd-stack" aria-labelledby={`${uid}-del`}>
            <h4 id={`${uid}-del`} className="fd-h">
              Delete my profile
            </h4>
            <p className="fd-field__hint">
              Removes your profile, follows, notification settings and notifications from the Snacc profile database, as far as the database lets you. On-chain
              transactions stay public forever. To remove the sign-in record and recorded activity, ask through <ExtLink href={ISSUES_URL}>GitHub issues</ExtLink>.
            </p>
            {confirmDelete ? (
              <div className="fd-row">
                <KeycapButton mono icon="warn" onClick={() => void remove()} data-testid="profile-delete-confirm">
                  yes, delete my profile rows
                </KeycapButton>
                <KeycapButton mono onClick={() => setConfirmDelete(false)}>
                  cancel
                </KeycapButton>
              </div>
            ) : (
              <KeycapButton mono icon="close" onClick={() => setConfirmDelete(true)} data-testid="profile-delete">
                Delete my profile
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
