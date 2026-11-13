/**
 * "Invite friends" block of the profile window (UI-158): the player's invite link with a copy button, the
 * Web Share button when the browser has one, and how many friends joined through it. The only reward is the
 * cosmetic Recruiter badge; the text says so.
 */
import { useId } from "react";
import { inviteUrl, type RecruitCounts } from "../account/referral.ts";
import { CopyButton, KeycapButton } from "../ui/controls.tsx";

export interface InviteFriendsProps {
  /** The signed-in player's NEAR account. */
  account: string;
  /** Recruit counts; null when they could not be read. */
  counts: RecruitCounts | null;
  /** Web Share entry, or null when the browser has none. */
  onShare: (() => void) | null;
}

export function countsLine(counts: RecruitCounts | null): string {
  if (!counts) return "Recruit count unavailable right now.";
  const { recruits, recruitsHatched } = counts;
  if (recruits === 0) return "No friends have joined through your link yet.";
  return `${recruits} friend${recruits === 1 ? "" : "s"} joined through your link, ${recruitsHatched} hatched a first Snacc.`;
}

export function InviteFriends({ account, counts, onShare }: InviteFriendsProps) {
  const uid = useId();
  const url = inviteUrl(account);
  return (
    <section className="fd-stack" aria-labelledby={`${uid}-invite`} data-testid="invite-friends">
      <h4 id={`${uid}-invite`} className="fd-h">
        Invite friends
      </h4>
      <p className="fd-field__hint">
        Share your link. When a friend signs in through it and hatches a first Snacc, you earn the Recruiter badge. The badge is cosmetic: Snacc runs on NEAR
        testnet and has no money value.
      </p>
      <code className="acct-invite__link" data-testid="invite-link">
        {url}
      </code>
      <div className="fd-row">
        <CopyButton label="Copy invite link" text={url} />
        {onShare ? (
          <KeycapButton mono icon="ext" onClick={onShare} data-testid="invite-share">
            Share
          </KeycapButton>
        ) : null}
      </div>
      <p data-testid="invite-counts">{countsLine(counts)}</p>
    </section>
  );
}

export default InviteFriends;
