/**
 * Notifications window (UI-149): the signed-in player's alerts, newest first, live through Realtime.
 * Mark one or all as read; a starving or distressed alert opens that Snacc's detail and (UI-159) shows
 * an urgency line plus a "Feed now" button that opens the signed feed window for that Snacc. The
 * Settings window holds a toggle per kind (`notification_prefs_snacc`), the optional browser alerts (tab open)
 * and "Push to this device" (UI-160: Web Push, reaches a closed tab).
 */
import { useEffect, useState } from "react";
import { useNotifications, type BrowserAlertState } from "../account/notifications.tsx";
import { useAccount } from "../account/session.tsx";
import { loadNotificationPrefs, saveNotificationPrefs } from "../account/api.ts";
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_KIND_TAGS,
  feedTargetOf,
  opensStrain,
  urgencyOf,
  type NotificationPrefs,
  type NotificationRow,
} from "../account/model.ts";
import { PushToggle } from "../push/PushToggle.tsx";
import { Modal } from "../ui/Modal.tsx";
import { Empty, KeycapButton } from "../ui/controls.tsx";
import { Tag } from "../ui/fd.tsx";
import "../account/account.css";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function NotificationsModal({
  onClose,
  onOpenStrain,
  onFeedStrain,
}: {
  onClose: () => void;
  onOpenStrain: (strainId: number) => void;
  /** Present only while a wallet is connected (the feed is a signed transaction). */
  onFeedStrain?: (strainId: number) => void;
}) {
  const n = useNotifications();
  const open = (item: NotificationRow) => {
    n.markRead(item.id);
    if (opensStrain(item) && item.strain_id !== null) onOpenStrain(item.strain_id);
  };
  const feed = (item: NotificationRow, strainId: number) => {
    n.markRead(item.id);
    onFeedStrain?.(strainId);
  };
  return (
    <Modal
      title="notifications.log"
      heading="Notifications"
      onClose={onClose}
      testId="notif-modal"
      footer={
        <>
          <span>live from the Snacc profile database · choose kinds in settings</span>
          <Tag>{n.unread} unread</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <div className="fd-row fd-row--between">
          <span className="fd-sub">{n.items.length === 0 ? "nothing yet" : `${n.items.length} shown, newest first`}</span>
          <KeycapButton mono icon="check" onClick={n.markAllRead} disabled={n.unread === 0} data-testid="notif-mark-all">
            mark all read
          </KeycapButton>
        </div>
        {n.items.length === 0 ? (
          <Empty icon="warn">No notifications. Alerts about hungry Snaccs, the industrial pool and the starter pack appear here while you are signed in.</Empty>
        ) : (
          <ol className="fd-list" data-testid="notif-list">
            {n.items.map((item) => {
              const feedId = feedTargetOf(item);
              const urgency = urgencyOf(item);
              return (
              <li key={item.id} className="acct-notif" data-unread={item.read_at ? undefined : ""} data-urgent={urgency ? "" : undefined}>
                <span className="acct-notif__dot" aria-hidden="true" />
                <span className="fd-stack" style={{ gap: 2, minWidth: 0 }}>
                  {opensStrain(item) ? (
                    <button type="button" className="fd-a acct-notif__title" onClick={() => open(item)} style={{ textAlign: "left" }}>
                      {item.title}
                    </button>
                  ) : (
                    <span className="acct-notif__title">{item.title}</span>
                  )}
                  {item.body ? <span className="acct-notif__body">{item.body}</span> : null}
                  {urgency ? (
                    <span className="acct-notif__urgent" data-testid={`notif-urgent-${item.id}`}>
                      {urgency}
                    </span>
                  ) : null}
                  <span className="acct-notif__when">
                    {NOTIFICATION_KIND_TAGS[item.kind] ?? item.kind} · {when(item.created_at)}
                    {item.read_at ? " · read" : ""}
                  </span>
                </span>
                <span className="fd-stack" style={{ gap: 4, alignItems: "flex-end" }}>
                  {feedId !== null && onFeedStrain ? (
                    <KeycapButton mono icon="warn" onClick={() => feed(item, feedId)} data-testid={`notif-feed-${item.id}`} aria-label={`feed Snacc #${feedId} now`}>
                      feed now
                    </KeycapButton>
                  ) : null}
                  {item.read_at ? null : (
                    <KeycapButton mono onClick={() => n.markRead(item.id)} aria-label={`mark "${item.title}" as read`}>
                      read
                    </KeycapButton>
                  )}
                </span>
              </li>
              );
            })}
          </ol>
        )}
        {n.items.some((i) => feedTargetOf(i) !== null) && !onFeedStrain ? (
          <span className="fd-sub" data-testid="notif-connect-hint">Connect a wallet to feed a hungry Snacc straight from here.</span>
        ) : null}
        <BrowserAlertsToggle />
      </div>
    </Modal>
  );
}

const ALERT_TEXT: Record<BrowserAlertState, string> = {
  unsupported: "This browser has no notification support.",
  off: "Browser alerts are off. Turning them on asks the browser for permission; alerts show only while this tab is open. To be notified when Snacc is closed, use push to this device below.",
  on: "Browser alerts are on while this tab is open. To be notified when Snacc is closed, use push to this device below.",
  blocked: "The browser blocks notifications for this site. Allow them in the site settings to use browser alerts.",
};

export function BrowserAlertsToggle() {
  const n = useNotifications();
  if (!n.enabled) return null;
  return (
    <div className="fd-stack" data-testid="browser-alerts">
      <div className="fd-row">
        {n.browserAlerts === "on" ? (
          <KeycapButton mono icon="close" onClick={n.disableBrowserAlerts}>
            turn off browser alerts
          </KeycapButton>
        ) : n.browserAlerts === "off" ? (
          <KeycapButton mono icon="warn" onClick={() => void n.enableBrowserAlerts()} data-testid="browser-alerts-on">
            turn on browser alerts
          </KeycapButton>
        ) : null}
      </div>
      <p className="fd-field__hint">{ALERT_TEXT[n.browserAlerts]}</p>
      <PushToggle />
    </div>
  );
}

/** Settings section: which kinds of notifications to receive (`notification_prefs_snacc`). */
export function NotificationSettings() {
  const account = useAccount();
  const { client, userId } = account;
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const signedIn = account.status === "signed-in" && client !== null && userId !== null;

  useEffect(() => {
    if (!signedIn || !client || !userId) return;
    let alive = true;
    void loadNotificationPrefs(client, userId).then((p) => alive && setPrefs(p));
    return () => {
      alive = false;
    };
  }, [signedIn, client, userId]);

  if (!account.enabled) return null;
  if (!signedIn) {
    return (
      <section className="guide-section" aria-labelledby="settings-notif-h" data-testid="settings-notif">
        <h4 id="settings-notif-h" className="fd-h">
          Notifications
        </h4>
        <p className="fd-field__hint">Sign in to the profile (the key next to your wallet) to choose which notifications you receive.</p>
      </section>
    );
  }

  const toggle = async (kind: (typeof NOTIFICATION_KINDS)[number]) => {
    if (!prefs || !client || !userId) return;
    const next = { ...prefs, [kind]: !prefs[kind] };
    setPrefs(next);
    const err = await saveNotificationPrefs(client, userId, next);
    setMsg(err ? `Not saved: ${err}` : "Saved.");
  };

  return (
    <section className="guide-section" aria-labelledby="settings-notif-h" data-testid="settings-notif">
      <h4 id="settings-notif-h" className="fd-h">
        Notifications
      </h4>
      <p className="fd-field__hint">These choices are saved to your profile in the Snacc profile database, not in this browser.</p>
      {prefs === null ? (
        <p className="fd-field__hint">reading your notification settings…</p>
      ) : (
        <div className="fd-stack">
          {NOTIFICATION_KINDS.map((k) => (
            <KeycapButton key={k} mono icon={prefs[k] ? "check" : "close"} role="switch" aria-checked={prefs[k]} onClick={() => void toggle(k)} data-testid={`notif-pref-${k}`}>
              {NOTIFICATION_KIND_LABELS[k]}
            </KeycapButton>
          ))}
          {msg ? (
            <p className="fd-field__hint" role="status">
              {msg}
            </p>
          ) : null}
        </div>
      )}
      <BrowserAlertsToggle />
    </section>
  );
}

export default NotificationsModal;
