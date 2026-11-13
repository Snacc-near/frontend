import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { notificationsReducer, opensStrain, unreadCount, NOTIFICATION_KINDS, NOTIFICATION_KIND_LABELS, type NotificationRow } from "../src/account/model.ts";
import { SessionProvider } from "../src/account/session.tsx";
import { NotificationsProvider, NOTIFICATIONS_OFF, useNotifications } from "../src/account/notifications.tsx";
import { NotificationsBell } from "../src/hud/NotificationsBell.tsx";
import { NotificationSettings } from "../src/hud/NotificationsModal.tsx";
import { WalletContext, DISCONNECTED_WALLET, type WalletApi } from "../src/chain/wallet.tsx";

const n = (id: number, created: string, read: string | null = null, kind: NotificationRow["kind"] = "starving"): NotificationRow => ({
  id,
  user_id: "u1",
  kind,
  strain_id: kind === "system" ? null : 7,
  title: `t${id}`,
  body: null,
  created_at: created,
  read_at: read,
});

describe("UI-149 notifications reducer", () => {
  it("loads newest first, counts unread, marks one and all read", () => {
    let s = notificationsReducer({ items: [] }, { type: "load", items: [n(1, "2026-11-12T00:00:00Z"), n(2, "2026-11-13T00:00:00Z"), n(3, "2026-11-11T00:00:00Z", "2026-11-11T01:00:00Z")] });
    expect(s.items.map((i) => i.id)).toEqual([2, 1, 3]);
    expect(unreadCount(s.items)).toBe(2);
    s = notificationsReducer(s, { type: "markRead", id: 1, at: "2026-11-13T05:00:00Z" });
    expect(unreadCount(s.items)).toBe(1);
    expect(s.items.find((i) => i.id === 1)?.read_at).toBe("2026-11-13T05:00:00Z");
    // A read item keeps its first read time.
    s = notificationsReducer(s, { type: "markRead", id: 3, at: "2026-11-13T06:00:00Z" });
    expect(s.items.find((i) => i.id === 3)?.read_at).toBe("2026-11-11T01:00:00Z");
    s = notificationsReducer(s, { type: "markAllRead", at: "2026-11-13T07:00:00Z" });
    expect(unreadCount(s.items)).toBe(0);
  });

  it("puts a realtime insert on top and replaces an updated row instead of duplicating it", () => {
    let s = notificationsReducer({ items: [] }, { type: "load", items: [n(1, "2026-11-12T00:00:00Z")] });
    s = notificationsReducer(s, { type: "upsert", item: n(9, "2026-11-13T09:00:00Z") });
    expect(s.items.map((i) => i.id)).toEqual([9, 1]);
    s = notificationsReducer(s, { type: "upsert", item: n(9, "2026-11-13T09:00:00Z", "2026-11-13T09:05:00Z") });
    expect(s.items).toHaveLength(2);
    expect(unreadCount(s.items)).toBe(1);
    expect(notificationsReducer(s, { type: "clear" }).items).toEqual([]);
  });

  it("opens the Snacc only for starving and distressed alerts with a strain id", () => {
    expect(opensStrain(n(1, "x", null, "starving"))).toBe(true);
    expect(opensStrain(n(1, "x", null, "distressed"))).toBe(true);
    expect(opensStrain(n(1, "x", null, "lost"))).toBe(false);
    expect(opensStrain(n(1, "x", null, "system"))).toBe(false);
    expect(opensStrain({ ...n(1, "x"), strain_id: null })).toBe(false);
  });

  it("has a plain label for every kind the backend sends", () => {
    expect([...NOTIFICATION_KINDS]).toEqual(["starving", "distressed", "lost", "dividend", "starter", "system"]);
    for (const k of NOTIFICATION_KINDS) expect(NOTIFICATION_KIND_LABELS[k].length).toBeGreaterThan(3);
  });
});

describe("UI-149 notifications are hidden without a session or env", () => {
  it("renders no bell and no settings section without the env", () => {
    const connected: WalletApi = { ...DISCONNECTED_WALLET, status: "connected", accountId: "alice.testnet" };
    let seen = NOTIFICATIONS_OFF;
    function Probe() {
      seen = useNotifications();
      return null;
    }
    const html = renderToStaticMarkup(
      <WalletContext.Provider value={connected}>
        <SessionProvider config={null}>
          <NotificationsProvider>
            <Probe />
            <NotificationsBell onOpen={() => {}} />
            <NotificationSettings />
          </NotificationsProvider>
        </SessionProvider>
      </WalletContext.Provider>,
    );
    expect(html).toBe("");
    expect(seen.enabled).toBe(false);
  });

  it("with the env but no session: no bell, and Settings asks to sign in first", () => {
    const html = renderToStaticMarkup(
      <SessionProvider config={{ url: "https://x.supabase.co", key: "sb_publishable_test" }}>
        <NotificationsProvider>
          <NotificationsBell onOpen={() => {}} />
          <NotificationSettings />
        </NotificationsProvider>
      </SessionProvider>,
    );
    expect(html).not.toContain("notif-bell");
    expect(html).toContain("Sign in to the profile");
  });
});
