/**
 * Web Push on this device (UI-160). The service worker (`/sw.js`) is registered only when the player turns
 * "Push to this device" on, and unregistered when they turn it off. Everything browser- and network-specific is
 * passed in (`PushDeps`), so the flows are unit tested with fakes: no browser, no network, no Supabase import.
 *
 * Turn on : permission -> register /sw.js -> GET the VAPID public key from the backend -> pushManager.subscribe
 *           ({ userVisibleOnly: true, applicationServerKey }) -> POST /push/subscribe.
 * Turn off: pushManager unsubscribe (this device stops at once) -> POST /push/unsubscribe -> unregister the worker.
 */
import { AccountError, postFunction } from "../account/signIn.ts";
import type { SupabaseConfig } from "../account/config.ts";

export const SW_URL = "/sw.js";
export const SW_SCOPE = "/";

export type PushState = "unsupported" | "needs-install" | "blocked" | "off" | "on";

/** The browser facts the flows depend on, read once (see `readPushEnv`). */
export interface PushEnv {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  /** `Notification.permission` ("default" when the API is missing). */
  permission: NotificationPermission;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** Running as an installed app (home-screen icon / standalone window). */
  standalone: boolean;
}

export function isIosDevice(env: Pick<PushEnv, "userAgent" | "platform" | "maxTouchPoints">): boolean {
  if (/iPhone|iPad|iPod/.test(env.userAgent)) return true;
  // iPadOS 13+ reports itself as a Mac with a touch screen.
  return env.platform === "MacIntel" && env.maxTouchPoints > 1;
}

/**
 * "ok" when the browser can receive push. iPhone and iPad only deliver web push to an installed app (iOS 16.4+);
 * in a normal Safari tab the push API is absent, so that case gets its own state with install instructions.
 */
export function pushSupport(env: PushEnv): "ok" | "needs-install" | "unsupported" {
  if (isIosDevice(env) && !env.standalone) return "needs-install";
  return env.hasServiceWorker && env.hasPushManager && env.hasNotification ? "ok" : "unsupported";
}

export function readPushEnv(w: Window | undefined = typeof window === "undefined" ? undefined : window): PushEnv {
  const nav = w?.navigator as (Navigator & { standalone?: boolean }) | undefined;
  let standalone = false;
  try {
    standalone = Boolean(nav?.standalone) || Boolean(w?.matchMedia?.("(display-mode: standalone)").matches);
  } catch {
    standalone = false;
  }
  return {
    hasServiceWorker: Boolean(nav && "serviceWorker" in nav),
    hasPushManager: Boolean(w && "PushManager" in w),
    hasNotification: Boolean(w && "Notification" in w),
    permission: w && "Notification" in w ? (w as Window & typeof globalThis).Notification.permission : "default",
    userAgent: nav?.userAgent ?? "",
    platform: nav?.platform ?? "",
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    standalone,
  };
}

/** base64url (as the backend returns the VAPID public key) to the bytes `applicationServerKey` wants. */
export function urlBase64ToUint8Array(b64u: string): Uint8Array {
  const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
  const bin = atob((b64u + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sameBytes(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

export interface SubscriptionLike {
  endpoint: string;
  options?: { applicationServerKey?: ArrayBuffer | null };
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
}

export interface RegistrationLike {
  pushManager: {
    getSubscription(): Promise<SubscriptionLike | null>;
    subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<SubscriptionLike>;
  };
  unregister(): Promise<boolean>;
}

export interface PushDeps {
  permission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  /** Register `/sw.js` and resolve once a worker is active. */
  register(): Promise<RegistrationLike>;
  /** The existing registration for this site, without registering anything. */
  getRegistration(): Promise<RegistrationLike | undefined>;
  /** POST a `push/...` backend route with the player's access token; throws `AccountError` on failure. */
  call<T>(path: string, body?: unknown): Promise<T>;
  /** Does the backend still hold this endpoint for the signed-in player? */
  serverHasEndpoint(endpoint: string): Promise<boolean>;
}

/** Where this device stands now, for the toggle. Never throws. */
export async function readDeviceState(env: PushEnv, deps: PushDeps): Promise<PushState> {
  const support = pushSupport(env);
  if (support !== "ok") return support;
  if (deps.permission() === "denied") return "blocked";
  try {
    const reg = await deps.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return "off";
    // The browser holds a subscription; it counts as on only while the backend still has it for this player
    // (it may belong to another player who used this browser, or have been dropped after repeated failures).
    return (await deps.serverHasEndpoint(sub.endpoint).catch(() => true)) ? "on" : "off";
  } catch {
    return "off";
  }
}

export interface PushResult {
  state: PushState;
  /** Plain-language note to show under the toggle (errors, or what happened). */
  message?: string;
}

const PUSH_SERVICE_DOWN = "The browser could not reach its push service. Check the connection and try again.";

/** Only the fields the backend takes (drops `expirationTime`). */
function subscriptionBody(sub: SubscriptionLike): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const j = (sub.toJSON() ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  return {
    endpoint: typeof j.endpoint === "string" ? j.endpoint : sub.endpoint,
    keys: { p256dh: String(j.keys?.p256dh ?? ""), auth: String(j.keys?.auth ?? "") },
  };
}

/**
 * Turn push on. Call it straight from the click handler: the permission prompt must come from a user gesture
 * (Safari insists), so `requestPermission` is the first thing that runs.
 */
export async function enableDevicePush(env: PushEnv, deps: PushDeps): Promise<PushResult> {
  const support = pushSupport(env);
  if (support !== "ok") return { state: support };
  if (deps.permission() === "denied") return { state: "blocked" };
  if (deps.permission() !== "granted") {
    const asked = await deps.requestPermission();
    if (asked === "denied") return { state: "blocked" };
    if (asked !== "granted") return { state: "off", message: "Notifications were not allowed, so push stays off." };
  }

  let sub: SubscriptionLike | null = null;
  try {
    const reg = await deps.register();
    const { publicKey } = await deps.call<{ publicKey?: unknown }>("push/key");
    if (typeof publicKey !== "string" || publicKey.length < 80) throw new AccountError("bad_key", "The server did not return a push key. Try again later.");
    const key = urlBase64ToUint8Array(publicKey);

    const existing = await reg.pushManager.getSubscription();
    if (existing && !sameBytes(existing.options?.applicationServerKey, key)) {
      // Created for another server key (or an unknown one): it can never be delivered, so start over.
      const stale = existing.endpoint;
      await existing.unsubscribe().catch(() => false);
      await deps.call("push/unsubscribe", { endpoint: stale }).catch(() => undefined);
    }
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await deps.call("push/subscribe", subscriptionBody(sub));
    return { state: "on" };
  } catch (e) {
    // Do not leave a browser subscription the backend does not know about.
    if (sub) await sub.unsubscribe().catch(() => false);
    if (e instanceof AccountError) return { state: "off", message: e.message };
    return { state: "off", message: PUSH_SERVICE_DOWN };
  }
}

/** Turn push off on this device: the browser stops first, then the backend row is removed (best effort). */
export async function disableDevicePush(deps: PushDeps): Promise<PushResult> {
  let reg: RegistrationLike | undefined;
  let message: string | undefined;
  try {
    reg = await deps.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      try {
        await deps.call("push/unsubscribe", { endpoint });
      } catch {
        message = "Turned off on this device. The server could not be reached, so it will drop this device on its own.";
      }
    }
  } catch {
    message = "The browser could not turn push off. Try again.";
    return { state: "on", message };
  }
  if (reg) await reg.unregister().catch(() => false);
  return message ? { state: "off", message } : { state: "off" };
}

// ---------------------------------------------------------------------------------------------
// Real browser wiring
// ---------------------------------------------------------------------------------------------

export interface BrowserDepsOptions {
  cfg: SupabaseConfig;
  /** Fresh access token of the signed-in player (null when signed out). */
  getAccessToken: () => Promise<string | null>;
  serverHasEndpoint: (endpoint: string) => Promise<boolean>;
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
}

export function browserPushDeps(o: BrowserDepsOptions): PushDeps {
  return {
    permission: () => window.Notification.permission,
    requestPermission: () => window.Notification.requestPermission(),
    register: async () => {
      await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE, updateViaCache: "none" });
      return (await navigator.serviceWorker.ready) as unknown as RegistrationLike;
    },
    getRegistration: async () => (await navigator.serviceWorker.getRegistration(SW_SCOPE)) as unknown as RegistrationLike | undefined,
    call: async <T>(path: string, body?: unknown) => {
      const accessToken = await o.getAccessToken();
      if (!accessToken) throw new AccountError("unauthorized", "Sign in to the profile to use push notifications.");
      return postFunction<T>(o.cfg, path, body, { accessToken, fetchFn: o.fetchFn });
    },
    serverHasEndpoint: o.serverHasEndpoint,
  };
}

/** `detachDeviceOnSignOut` wired to the real browser (see `SessionProvider.signOut`). Never throws. */
export async function detachThisDevice(cfg: SupabaseConfig, getAccessToken: () => Promise<string | null>): Promise<void> {
  try {
    const env = readPushEnv();
    if (pushSupport(env) !== "ok") return;
    await detachDeviceOnSignOut(env, browserPushDeps({ cfg, getAccessToken, serverHasEndpoint: async () => true }));
  } catch {
    /* signing out must never fail because of push */
  }
}

/**
 * Sign-out hook: stop pushing this device to the player who is leaving (a shared browser must not keep receiving their
 * alerts). Does nothing, with no network, when this browser has no push subscription. Never throws.
 */
export async function detachDeviceOnSignOut(env: PushEnv, deps: PushDeps): Promise<void> {
  try {
    if (pushSupport(env) !== "ok") return;
    const reg = await deps.getRegistration();
    if (!reg || !(await reg.pushManager.getSubscription())) return;
    await disableDevicePush(deps);
  } catch {
    /* signing out must never fail because of push */
  }
}
