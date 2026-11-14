/**
 * "Invite friends" block of the profile window (UI-158): the player's invite link with a copy button, the
 * Web Share button when the browser has one, and how many friends joined through it. The only reward is the
 * cosmetic Recruiter badge; the text says so.
 *
 * UI-161 phase B3: text comes from the `social.invite` dictionary.
 */
import { useId } from "react";
import { inviteUrl, type RecruitCounts } from "../account/referral.ts";
import { tEn, type Translate } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";
import { CopyButton, KeycapButton } from "../ui/controls.tsx";

export interface InviteFriendsProps {
  /** The signed-in player's NEAR account. */
  account: string;
  /** Recruit counts; null when they could not be read. */
  counts: RecruitCounts | null;
  /** Web Share entry, or null when the browser has none. */
  onShare: (() => void) | null;
}

/** The recruit line; English unless a translator is passed. */
export function countsLine(counts: RecruitCounts | null, tr: Translate = tEn): string {
  if (!counts) return tr("social.invite.unavailable");
  const { recruits, recruitsHatched } = counts;
  if (recruits === 0) return tr("social.invite.none");
  return tr(recruits === 1 ? "social.invite.countsOne" : "social.invite.countsMany", { n: recruits, hatched: recruitsHatched });
}

export function InviteFriends({ account, counts, onShare }: InviteFriendsProps) {
  const { t } = useT();
  const uid = useId();
  const url = inviteUrl(account);
  return (
    <section className="fd-stack" aria-labelledby={`${uid}-invite`} data-testid="invite-friends">
      <h4 id={`${uid}-invite`} className="fd-h">
        {t("social.invite.title")}
      </h4>
      <p className="fd-field__hint">{t("social.invite.body")}</p>
      <code className="acct-invite__link" data-testid="invite-link">
        {url}
      </code>
      <div className="fd-row">
        <CopyButton label={t("social.invite.copy")} text={url} />
        {onShare ? (
          <KeycapButton mono icon="ext" onClick={onShare} data-testid="invite-share">
            {t("social.invite.share")}
          </KeycapButton>
        ) : null}
      </div>
      <p data-testid="invite-counts">{countsLine(counts, t)}</p>
    </section>
  );
}

export default InviteFriends;
