/**
 * Notifications bell (UI-149) in the `/app` header, beside the profile chip: unread count, opens the
 * Notifications window. Renders nothing unless the player is signed in to a profile.
 */
import { useNotifications } from "../account/notifications.tsx";
import { Icon } from "../ui/fd.tsx";
import "../account/account.css";

export function NotificationsBell({ onOpen }: { onOpen: () => void }) {
  const n = useNotifications();
  if (!n.enabled) return null;
  return (
    <button
      type="button"
      className="fd-key fd-key--mono acct-bell"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={n.unread > 0 ? `notifications, ${n.unread} unread` : "notifications"}
      data-testid="notif-bell"
    >
      <Icon name="warn" />
      <span className="acct-bell__label">alerts</span>
      {n.unread > 0 ? (
        <span className="acct-bell__count" data-testid="notif-count">
          {n.unread > 99 ? "99+" : n.unread}
        </span>
      ) : null}
    </button>
  );
}
