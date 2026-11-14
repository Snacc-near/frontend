/**
 * Notifications window (UI-149): the signed-in player's alerts, newest first, live through Realtime.
 * Mark one or all as read; a starving or distressed alert opens that Snacc's detail and (UI-159) shows
 * an urgency line plus a "Feed now" button that opens the signed feed window for that Snacc. The
 * Settings window holds a toggle per kind (`notification_prefs_snacc`), the optional browser alerts (tab open)
 * and "Push to this device" (UI-160: Web Push, reaches a closed tab).
 *
 * UI-161 phase B3: text comes from the `social.notif` dictionary. A notification's title and body are
 * written by the server and are shown as they arrive.
 */
import { useEffect, useState } from "react";
import { useNotifications, type BrowserAlertState } from "../account/notifications.tsx";
import { useAccount } from "../account/session.tsx";
import { loadNotificationPrefs, saveNotificationPrefs } from "../account/api.ts";
import { NOTIFICATION_KINDS, feedTargetOf, opensStrain, type NotificationPrefs, type NotificationRow } from "../account/model.ts";
import { useT } from "../i18n/react.tsx";
import { urgencyText } from "../i18n/socialText.ts";
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
  const { t } = useT();
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
      title={t("social.notif.title")}
      heading={t("social.notif.heading")}
      onClose={onClose}
      testId="notif-modal"
      footer={
        <>
          <span>{t("social.notif.footer")}</span>
          <Tag>{t("social.notif.unread", { n: n.unread })}</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <div className="fd-row fd-row--between">
          <span className="fd-sub">{n.items.length === 0 ? t("social.notif.nothing") : t("social.notif.shown", { n: n.items.length })}</span>
          <KeycapButton mono icon="check" onClick={n.markAllRead} disabled={n.unread === 0} data-testid="notif-mark-all">
            {t("social.notif.markAll")}
          </KeycapButton>
        </div>
        {n.items.length === 0 ? (
          <Empty icon="warn">{t("social.notif.empty")}</Empty>
        ) : (
          <ol className="fd-list" data-testid="notif-list">
            {n.items.map((item) => {
              const feedId = feedTargetOf(item);
              const urgency = urgencyText(t, item);
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
                    {NOTIFICATION_KINDS.includes(item.kind) ? t(`social.notif.tags.${item.kind}`) : item.kind} · {when(item.created_at)}
                    {item.read_at ? t("social.notif.readSuffix") : ""}
                  </span>
                </span>
                <span className="fd-stack" style={{ gap: 4, alignItems: "flex-end" }}>
                  {feedId !== null && onFeedStrain ? (
                    <KeycapButton mono icon="warn" onClick={() => feed(item, feedId)} data-testid={`notif-feed-${item.id}`} aria-label={t("social.notif.feedLabel", { id: feedId })}>
                      {t("social.notif.feedNow")}
                    </KeycapButton>
                  ) : null}
                  {item.read_at ? null : (
                    <KeycapButton mono onClick={() => n.markRead(item.id)} aria-label={t("social.notif.markRead", { title: item.title })}>
                      {t("social.notif.read")}
                    </KeycapButton>
                  )}
                </span>
              </li>
              );
            })}
          </ol>
        )}
        {n.items.some((i) => feedTargetOf(i) !== null) && !onFeedStrain ? (
          <span className="fd-sub" data-testid="notif-connect-hint">{t("social.notif.connectHint")}</span>
        ) : null}
        <BrowserAlertsToggle />
      </div>
    </Modal>
  );
}

const ALERT_KEYS = {
  unsupported: "social.notif.alertsUnsupported",
  off: "social.notif.alertsOffText",
  on: "social.notif.alertsOnText",
  blocked: "social.notif.alertsBlocked",
} as const satisfies Record<BrowserAlertState, string>;

export function BrowserAlertsToggle() {
  const { t } = useT();
  const n = useNotifications();
  if (!n.enabled) return null;
  return (
    <div className="fd-stack" data-testid="browser-alerts">
      <div className="fd-row">
        {n.browserAlerts === "on" ? (
          <KeycapButton mono icon="close" onClick={n.disableBrowserAlerts}>
            {t("social.notif.turnOff")}
          </KeycapButton>
        ) : n.browserAlerts === "off" ? (
          <KeycapButton mono icon="warn" onClick={() => void n.enableBrowserAlerts()} data-testid="browser-alerts-on">
            {t("social.notif.turnOn")}
          </KeycapButton>
        ) : null}
      </div>
      <p className="fd-field__hint">{t(ALERT_KEYS[n.browserAlerts])}</p>
      <PushToggle />
    </div>
  );
}

/** Settings section: which kinds of notifications to receive (`notification_prefs_snacc`). */
export function NotificationSettings() {
  const { t } = useT();
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
          {t("social.notif.settingsTitle")}
        </h4>
        <p className="fd-field__hint">{t("social.notif.settingsSignIn")}</p>
      </section>
    );
  }

  const toggle = async (kind: (typeof NOTIFICATION_KINDS)[number]) => {
    if (!prefs || !client || !userId) return;
    const next = { ...prefs, [kind]: !prefs[kind] };
    setPrefs(next);
    const err = await saveNotificationPrefs(client, userId, next);
    setMsg(err ? t("social.notif.notSaved", { err }) : t("social.notif.saved"));
  };

  return (
    <section className="guide-section" aria-labelledby="settings-notif-h" data-testid="settings-notif">
      <h4 id="settings-notif-h" className="fd-h">
        {t("social.notif.settingsTitle")}
      </h4>
      <p className="fd-field__hint">{t("social.notif.settingsSaved")}</p>
      {prefs === null ? (
        <p className="fd-field__hint">{t("social.notif.settingsReading")}</p>
      ) : (
        <div className="fd-stack">
          {NOTIFICATION_KINDS.map((k) => (
            <KeycapButton key={k} mono icon={prefs[k] ? "check" : "close"} role="switch" aria-checked={prefs[k]} onClick={() => void toggle(k)} data-testid={`notif-pref-${k}`}>
              {t(`social.notif.kinds.${k}`)}
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
