/**
 * Notifications (UI-149): the signed-in player's `notifications_snacc` rows, kept live through a
 * Supabase Realtime subscription on that table filtered to the player. Optional browser alerts use
 * the `Notification` API only after the player clicks to turn them on, and only while this tab is
 * open (there is no service worker and no push).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useAccount } from "./session.tsx";
import { loadNotifications, markNotificationsRead } from "./api.ts";
import { notificationsReducer, unreadCount, type NotificationRow } from "./model.ts";
import { BROWSER_ALERTS_KEY, safeLocalStorage } from "./config.ts";

export type BrowserAlertState = "unsupported" | "off" | "on" | "blocked";

export interface NotificationsApi {
  enabled: boolean;
  items: NotificationRow[];
  unread: number;
  markRead: (id: NotificationRow["id"]) => void;
  markAllRead: () => void;
  browserAlerts: BrowserAlertState;
  /** Asks for permission (call from a click handler) and turns alerts on when granted. */
  enableBrowserAlerts: () => Promise<BrowserAlertState>;
  disableBrowserAlerts: () => void;
}

export const NOTIFICATIONS_OFF: NotificationsApi = {
  enabled: false,
  items: [],
  unread: 0,
  markRead: () => undefined,
  markAllRead: () => undefined,
  browserAlerts: "unsupported",
  enableBrowserAlerts: async () => "unsupported",
  disableBrowserAlerts: () => undefined,
};

const NotificationsContext = createContext<NotificationsApi>(NOTIFICATIONS_OFF);
export const useNotifications = () => useContext(NotificationsContext);

function readAlertState(): BrowserAlertState {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") return "unsupported";
  if (window.Notification.permission === "denied") return "blocked";
  const on = safeLocalStorage()?.getItem(BROWSER_ALERTS_KEY) === "1";
  return on && window.Notification.permission === "granted" ? "on" : "off";
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const { client, userId } = account;
  const [state, dispatch] = useReducer(notificationsReducer, { items: [] });
  const [browserAlerts, setBrowserAlerts] = useState<BrowserAlertState>(() => readAlertState());
  const alertsRef = useRef(browserAlerts);
  alertsRef.current = browserAlerts;

  useEffect(() => {
    if (!client || !userId) {
      dispatch({ type: "clear" });
      return;
    }
    let alive = true;
    void loadNotifications(client, userId)
      .then((items) => {
        if (alive) dispatch({ type: "load", items });
      })
      .catch(() => undefined);
    const channel = client
      .channel(`notifications_snacc:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications_snacc", filter: `user_id=eq.${userId}` },
        (payload: { new: unknown }) => {
          const row = payload.new as NotificationRow;
          if (!alive || !row || row.user_id !== userId) return;
          dispatch({ type: "upsert", item: row });
          if (alertsRef.current === "on" && typeof window.Notification !== "undefined" && window.Notification.permission === "granted") {
            try {
              new window.Notification(row.title, { body: row.body ?? undefined, tag: `snacc-${row.id}` });
            } catch {
              /* some browsers only allow notifications from a service worker */
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications_snacc", filter: `user_id=eq.${userId}` },
        (payload: { new: unknown }) => {
          const row = payload.new as NotificationRow;
          if (alive && row && row.user_id === userId) dispatch({ type: "upsert", item: row });
        },
      )
      .subscribe();
    return () => {
      alive = false;
      void client.removeChannel(channel);
    };
  }, [client, userId]);

  const markRead = useCallback(
    (id: NotificationRow["id"]) => {
      if (!client || !userId) return;
      const at = new Date().toISOString();
      dispatch({ type: "markRead", id, at });
      void markNotificationsRead(client, userId, [id], at).catch(() => undefined);
    },
    [client, userId],
  );

  const markAllRead = useCallback(() => {
    if (!client || !userId) return;
    const at = new Date().toISOString();
    dispatch({ type: "markAllRead", at });
    void markNotificationsRead(client, userId, "all", at).catch(() => undefined);
  }, [client, userId]);

  const enableBrowserAlerts = useCallback(async (): Promise<BrowserAlertState> => {
    if (typeof window.Notification === "undefined") return "unsupported";
    let perm = window.Notification.permission;
    if (perm === "default") perm = await window.Notification.requestPermission();
    const next: BrowserAlertState = perm === "granted" ? "on" : perm === "denied" ? "blocked" : "off";
    if (next === "on") safeLocalStorage()?.setItem(BROWSER_ALERTS_KEY, "1");
    setBrowserAlerts(next);
    return next;
  }, []);

  const disableBrowserAlerts = useCallback(() => {
    safeLocalStorage()?.removeItem(BROWSER_ALERTS_KEY);
    setBrowserAlerts(readAlertState());
  }, []);

  const signedIn = account.status === "signed-in" && Boolean(userId);
  const value = useMemo<NotificationsApi>(
    () =>
      signedIn
        ? {
            enabled: true,
            items: state.items,
            unread: unreadCount(state.items),
            markRead,
            markAllRead,
            browserAlerts,
            enableBrowserAlerts,
            disableBrowserAlerts,
          }
        : NOTIFICATIONS_OFF,
    [signedIn, state.items, markRead, markAllRead, browserAlerts, enableBrowserAlerts, disableBrowserAlerts],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
