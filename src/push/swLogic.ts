/**
 * Service worker logic for Web Push (UI-160). The worker does exactly three things: show a notification when a
 * push arrives, focus or open Snacc when the notification is clicked, and take control of open tabs right away so
 * a click can navigate them. There is no fetch handler and no cache: this is not an offline app.
 *
 * `public/sw.js` is a hand-kept classic-script copy of this file (a service worker must be served from a stable,
 * un-hashed URL and this project has no worker build step). `test/ui-160-push.test.ts` runs both against the same
 * events and fails when they drift.
 *
 * The structural types below are deliberately minimal: the app is compiled with the DOM lib, not WebWorker.
 */

export const DEFAULT_URL = "/app";
export const NOTIFICATION_ICON = "/brand/snacc-app-icon-192.png";
export const GENERIC_TITLE = "Snacc";
export const GENERIC_BODY = "Open Snacc to see what changed.";
const MAX_TITLE = 120;
const MAX_BODY = 300;
const MAX_URL = 300;

/** What `push-dispatch` sends: `{ title, body, url, tag }` (url is a same-origin path). */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Same-origin path (plus query and hash) for `raw`, or `/app` when it is missing, malformed or points elsewhere. */
export function safeUrl(raw: unknown, origin: string): string {
  if (typeof raw !== "string" || raw === "" || raw.length > MAX_URL) return DEFAULT_URL;
  try {
    const u = new URL(raw, origin);
    if (u.origin !== origin) return DEFAULT_URL;
    return u.pathname + u.search + u.hash;
  } catch {
    return DEFAULT_URL;
  }
}

/**
 * Tolerant payload parser. A push that carries no readable data still has to show something (browsers require every
 * push to be visible), so it falls back to a generic "Snacc" notification that opens the app.
 */
export function parsePushPayload(text: string | null | undefined, origin: string): PushPayload {
  let o: Record<string, unknown> = {};
  try {
    const v: unknown = text ? JSON.parse(text) : null;
    if (v && typeof v === "object" && !Array.isArray(v)) o = v as Record<string, unknown>;
  } catch {
    o = {};
  }
  const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return {
    title: str(o["title"], MAX_TITLE) || GENERIC_TITLE,
    body: str(o["body"], MAX_BODY) || (str(o["title"], MAX_TITLE) ? "" : GENERIC_BODY),
    url: safeUrl(o["url"], origin),
    tag: str(o["tag"], 80) || "snacc",
  };
}

export function notificationOptions(p: PushPayload): { body: string; icon: string; tag: string; data: { url: string } } {
  return { body: p.body, icon: NOTIFICATION_ICON, tag: p.tag, data: { url: p.url } };
}

export interface ClientLike {
  url: string;
  focused?: boolean;
  visibilityState?: string;
  focus?: () => Promise<unknown>;
  navigate?: (url: string) => Promise<unknown>;
}

export interface ExtendableEventLike {
  waitUntil(p: Promise<unknown>): void;
}
export interface PushEventLike extends ExtendableEventLike {
  data: { text(): string } | null;
}
export interface NotificationClickEventLike extends ExtendableEventLike {
  notification: { data?: unknown; close(): void };
}

export interface SwScope {
  location: { origin: string };
  registration: { showNotification(title: string, options?: unknown): Promise<unknown> };
  clients: {
    matchAll(o: { type: "window"; includeUncontrolled: boolean }): Promise<ClientLike[]>;
    openWindow(url: string): Promise<unknown>;
    claim(): Promise<unknown>;
  };
  skipWaiting(): Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: string, listener: (event: any) => void): void;
}

/** `push`: always show one notification built from the payload. */
export function onPush(event: PushEventLike, scope: SwScope): void {
  let text: string | null = null;
  try {
    text = event.data ? event.data.text() : null;
  } catch {
    text = null;
  }
  const p = parsePushPayload(text, scope.location.origin);
  event.waitUntil(Promise.resolve(scope.registration.showNotification(p.title, notificationOptions(p))));
}

function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/** Prefer the tab the player is looking at, then any visible one, then the first Snacc tab. */
export function pickClient(clients: readonly ClientLike[], origin: string): ClientLike | null {
  const ours = clients.filter((c) => sameOrigin(c.url, origin));
  return ours.find((c) => c.focused) ?? ours.find((c) => c.visibilityState === "visible") ?? ours[0] ?? null;
}

/** Focus a Snacc tab and send it to `target`; open a new window when there is none (or it cannot be navigated). */
export async function focusOrOpen(scope: SwScope, target: string): Promise<"focused" | "opened"> {
  const origin = scope.location.origin;
  const href = new URL(target, origin).href;
  const clients = await scope.clients.matchAll({ type: "window", includeUncontrolled: true });
  const client = pickClient(clients, origin);
  if (client) {
    try {
      if (client.focus) await client.focus();
      if (client.navigate && client.url !== href) await client.navigate(href);
      return "focused";
    } catch {
      /* an uncontrolled or closed tab cannot be navigated: open a new window below */
    }
  }
  await scope.clients.openWindow(href);
  return "opened";
}

/** `notificationclick`: close it, then focus or open the target (same-origin, `/app` by default). */
export function onNotificationClick(event: NotificationClickEventLike, scope: SwScope): void {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | null | undefined;
  const target = safeUrl(data?.url, scope.location.origin);
  event.waitUntil(focusOrOpen(scope, target).catch(() => undefined));
}

/** Attach every handler. `public/sw.js` does the same with plain JavaScript. */
export function registerPushHandlers(scope: SwScope): void {
  scope.addEventListener("install", () => {
    void scope.skipWaiting();
  });
  scope.addEventListener("activate", (event: ExtendableEventLike) => {
    event.waitUntil(Promise.resolve(scope.clients.claim()));
  });
  scope.addEventListener("push", (event: PushEventLike) => onPush(event, scope));
  scope.addEventListener("notificationclick", (event: NotificationClickEventLike) => onNotificationClick(event, scope));
}
