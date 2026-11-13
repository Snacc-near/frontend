import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_URL,
  GENERIC_BODY,
  GENERIC_TITLE,
  NOTIFICATION_ICON,
  notificationOptions,
  parsePushPayload,
  pickClient,
  registerPushHandlers,
  safeUrl,
  type ClientLike,
  type SwScope,
} from "../src/push/swLogic.ts";
import {
  browserPushDeps,
  detachDeviceOnSignOut,
  disableDevicePush,
  enableDevicePush,
  isIosDevice,
  pushSupport,
  readDeviceState,
  urlBase64ToUint8Array,
  type PushDeps,
  type PushEnv,
  type RegistrationLike,
  type SubscriptionLike,
} from "../src/push/client.ts";
import { PUSH_PRIVACY, PUSH_TEXT, PushToggleView } from "../src/push/PushToggle.tsx";
import { ACCOUNT_OFF, AccountContext, type AccountApi } from "../src/account/session.tsx";
import { NotificationsProvider } from "../src/account/notifications.tsx";
import { BrowserAlertsToggle, NotificationSettings } from "../src/hud/NotificationsModal.tsx";
import { AccountError } from "../src/account/signIn.ts";

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "https://snacc-nu.vercel.app";

// ---------------------------------------------------------------------------------------------
// service worker: one fake scope, two implementations (src/push/swLogic.ts and public/sw.js)
// ---------------------------------------------------------------------------------------------

interface Trace {
  shown: Array<[string, unknown]>;
  opened: string[];
  focused: string[];
  navigated: Array<[string, string]>;
  closed: number;
  skipWaiting: number;
  claimed: number;
  listeners: string[];
}

function fakeScope(clients: Array<ClientLike & { throwOnNavigate?: boolean }> = []) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const trace: Trace = { shown: [], opened: [], focused: [], navigated: [], closed: 0, skipWaiting: 0, claimed: 0, listeners: [] };
  const wrapped = clients.map((c) => ({
    url: c.url,
    focused: c.focused,
    visibilityState: c.visibilityState,
    focus: async () => {
      trace.focused.push(c.url);
    },
    navigate: async (u: string) => {
      if (c.throwOnNavigate) throw new TypeError("cannot navigate an uncontrolled client");
      trace.navigated.push([c.url, u]);
    },
  }));
  const scope: SwScope = {
    location: { origin: ORIGIN },
    registration: {
      showNotification: async (title, options) => {
        trace.shown.push([title, options]);
      },
    },
    clients: {
      matchAll: async () => wrapped,
      openWindow: async (u) => {
        trace.opened.push(u);
      },
      claim: async () => {
        trace.claimed++;
      },
    },
    skipWaiting: async () => {
      trace.skipWaiting++;
    },
    addEventListener: (type, listener) => {
      handlers[type] = listener;
      trace.listeners.push(type);
    },
  };
  return { scope, handlers, trace };
}

type Step =
  | { push: string | null | "throw" }
  | { click: unknown; clients?: Array<ClientLike & { throwOnNavigate?: boolean }> }
  | { lifecycle: true };

async function play(register: (scope: SwScope) => void, step: Step): Promise<Trace> {
  const clients = "click" in step ? step.clients : undefined;
  const { scope, handlers, trace } = fakeScope(clients);
  register(scope);
  const waits: Promise<unknown>[] = [];
  const event = (extra: object) => ({ waitUntil: (p: Promise<unknown>) => void waits.push(Promise.resolve(p)), ...extra });
  if ("push" in step) {
    const text = step.push;
    const data =
      text === null
        ? null
        : {
            text: () => {
              if (text === "throw") throw new Error("no data");
              return text;
            },
          };
    handlers["push"]?.(event({ data }));
  } else if ("click" in step) {
    handlers["notificationclick"]?.(event({ notification: { data: step.click, close: () => void trace.closed++ } }));
  } else {
    handlers["install"]?.(event({}));
    handlers["activate"]?.(event({}));
  }
  await Promise.all(waits);
  return trace;
}

const viaModule = (scope: SwScope) => registerPushHandlers(scope);
const swSource = fs.readFileSync(path.join(ROOT, "public/sw.js"), "utf8");
const viaScript = (scope: SwScope) => {
  vm.runInNewContext(swSource, { self: scope, URL, JSON, Promise, Array, Object, String });
};

const tab = (url: string, over: Partial<ClientLike> = {}): ClientLike & { throwOnNavigate?: boolean } => ({ url, ...over });
const FULL = JSON.stringify({ title: "Snacc #7 is starving", body: "Vitality is 0. Feed it now.", url: "/app?feed=7", tag: "snacc-41" });

const SCENARIOS: Array<{ name: string; step: Step; expect: Partial<Trace> }> = [
  {
    name: "push shows the title, body, icon, tag and click target",
    step: { push: FULL },
    expect: {
      shown: [["Snacc #7 is starving", { body: "Vitality is 0. Feed it now.", icon: NOTIFICATION_ICON, tag: "snacc-41", data: { url: "/app?feed=7" } }]],
    },
  },
  {
    name: "push without data still shows a generic notification",
    step: { push: null },
    expect: { shown: [[GENERIC_TITLE, { body: GENERIC_BODY, icon: NOTIFICATION_ICON, tag: "snacc", data: { url: DEFAULT_URL } }]] },
  },
  {
    name: "push with unreadable text still shows a generic notification",
    step: { push: "not json {" },
    expect: { shown: [[GENERIC_TITLE, { body: GENERIC_BODY, icon: NOTIFICATION_ICON, tag: "snacc", data: { url: DEFAULT_URL } }]] },
  },
  {
    name: "push whose data cannot be read still shows a generic notification",
    step: { push: "throw" },
    expect: { shown: [[GENERIC_TITLE, { body: GENERIC_BODY, icon: NOTIFICATION_ICON, tag: "snacc", data: { url: DEFAULT_URL } }]] },
  },
  {
    name: "push with a foreign url opens /app instead, long text is cut",
    step: { push: JSON.stringify({ title: "t".repeat(400), body: "b".repeat(900), url: "https://evil.example/phish", tag: "x" }) },
    expect: { shown: [["t".repeat(120), { body: "b".repeat(300), icon: NOTIFICATION_ICON, tag: "x", data: { url: DEFAULT_URL } }]] },
  },
  {
    name: "click focuses the open Snacc tab and navigates it",
    step: { click: { url: "/app?feed=7" }, clients: [tab(`${ORIGIN}/app`, { visibilityState: "visible" })] },
    expect: { closed: 1, focused: [`${ORIGIN}/app`], navigated: [[`${ORIGIN}/app`, `${ORIGIN}/app?feed=7`]], opened: [] },
  },
  {
    name: "click prefers the focused tab over a hidden one and ignores other sites",
    step: {
      click: { url: "/app?feed=3" },
      clients: [tab("https://other.example/app", { focused: true }), tab(`${ORIGIN}/`, { visibilityState: "hidden" }), tab(`${ORIGIN}/app`, { focused: true })],
    },
    expect: { focused: [`${ORIGIN}/app`], navigated: [[`${ORIGIN}/app`, `${ORIGIN}/app?feed=3`]], opened: [] },
  },
  {
    name: "click on a tab that is already there only focuses it",
    step: { click: { url: "/app?feed=7" }, clients: [tab(`${ORIGIN}/app?feed=7`, { focused: true })] },
    expect: { focused: [`${ORIGIN}/app?feed=7`], navigated: [], opened: [] },
  },
  {
    name: "click with no Snacc tab opens a new window",
    step: { click: { url: "/app?feed=9" }, clients: [] },
    expect: { closed: 1, focused: [], navigated: [], opened: [`${ORIGIN}/app?feed=9`] },
  },
  {
    name: "click with only another site's tab opens a new window",
    step: { click: { url: "/app" }, clients: [tab("https://other.example/")] },
    expect: { opened: [`${ORIGIN}/app`], focused: [] },
  },
  {
    name: "click on a tab that cannot be navigated falls back to a new window",
    step: { click: { url: "/app?feed=5" }, clients: [{ ...tab(`${ORIGIN}/app`), throwOnNavigate: true }] },
    expect: { focused: [`${ORIGIN}/app`], navigated: [], opened: [`${ORIGIN}/app?feed=5`] },
  },
  {
    name: "click without data, or with a foreign url, goes to /app",
    step: { click: { url: "https://evil.example/x" }, clients: [] },
    expect: { opened: [`${ORIGIN}/app`] },
  },
  {
    name: "click with no notification data goes to /app",
    step: { click: null, clients: [] },
    expect: { opened: [`${ORIGIN}/app`], closed: 1 },
  },
  {
    name: "install takes over immediately (skipWaiting) and activate claims open tabs",
    step: { lifecycle: true },
    expect: { skipWaiting: 1, claimed: 1, shown: [] },
  },
];

describe("UI-160 service worker logic", () => {
  it("registers exactly install, activate, push and notificationclick: no fetch handler, no cache", async () => {
    const { scope, trace } = fakeScope();
    registerPushHandlers(scope);
    expect(trace.listeners.sort()).toEqual(["activate", "install", "notificationclick", "push"]);
    expect(swSource).not.toMatch(/addEventListener\(\s*["']fetch["']/);
    expect(swSource).not.toMatch(/\bcaches\b/);
    expect(swSource).not.toMatch(/\bimportScripts\b/);
  });

  for (const s of SCENARIOS) {
    it(`src/push/swLogic.ts: ${s.name}`, async () => {
      const t = await play(viaModule, s.step);
      expect(t).toMatchObject(s.expect);
    });
    it(`public/sw.js behaves the same: ${s.name}`, async () => {
      const fromModule = await play(viaModule, s.step);
      const fromScript = await play(viaScript, s.step);
      // JSON round trip: the script runs in its own realm, only the observable behaviour must match.
      expect(JSON.parse(JSON.stringify(fromScript))).toEqual(JSON.parse(JSON.stringify(fromModule)));
    });
  }

  it("safeUrl keeps same-origin paths only", () => {
    expect(safeUrl("/app?feed=7", ORIGIN)).toBe("/app?feed=7");
    expect(safeUrl(`${ORIGIN}/app?feed=7#x`, ORIGIN)).toBe("/app?feed=7#x");
    for (const bad of ["//evil.example/x", "https://evil.example/", "javascript:alert(1)", "/\\evil.example", "", null, undefined, 7, `/${"a".repeat(400)}`]) {
      expect(safeUrl(bad, ORIGIN)).toBe(DEFAULT_URL);
    }
  });

  it("parsePushPayload takes what the backend sends and defaults the rest", () => {
    expect(parsePushPayload(FULL, ORIGIN)).toEqual({ title: "Snacc #7 is starving", body: "Vitality is 0. Feed it now.", url: "/app?feed=7", tag: "snacc-41" });
    expect(parsePushPayload(JSON.stringify({ title: "Only a title" }), ORIGIN)).toEqual({ title: "Only a title", body: "", url: "/app", tag: "snacc" });
    expect(parsePushPayload("[1,2]", ORIGIN).title).toBe(GENERIC_TITLE);
    expect(parsePushPayload(JSON.stringify({ title: 5, body: {}, url: 7 }), ORIGIN)).toEqual({ title: GENERIC_TITLE, body: GENERIC_BODY, url: "/app", tag: "snacc" });
    expect(notificationOptions(parsePushPayload(FULL, ORIGIN)).data).toEqual({ url: "/app?feed=7" });
  });

  it("the notification icon is a shipped file, and the tag format matches the in-page alert (snacc-<id>)", () => {
    expect(fs.existsSync(path.join(ROOT, "public", NOTIFICATION_ICON))).toBe(true);
    expect(parsePushPayload(FULL, ORIGIN).tag).toBe("snacc-41");
  });

  it("pickClient: focused, then visible, then first; other origins never", () => {
    const a = tab(`${ORIGIN}/a`);
    const b = tab(`${ORIGIN}/b`, { visibilityState: "visible" });
    const c = tab(`${ORIGIN}/c`, { focused: true });
    expect(pickClient([a, b, c], ORIGIN)).toBe(c);
    expect(pickClient([a, b], ORIGIN)).toBe(b);
    expect(pickClient([a], ORIGIN)).toBe(a);
    expect(pickClient([tab("https://x.example/")], ORIGIN)).toBeNull();
    expect(pickClient([tab("not a url")], ORIGIN)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// page side: support detection and the turn on / turn off flows with fakes
// ---------------------------------------------------------------------------------------------

const ENV: PushEnv = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/130",
  platform: "Linux x86_64",
  maxTouchPoints: 0,
  standalone: false,
};
const SERVER_KEY = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const KEY_BYTES = urlBase64ToUint8Array(SERVER_KEY);
const OTHER_KEY = new Uint8Array(65).fill(9);

interface World {
  log: string[];
  calls: Array<{ path: string; body: unknown }>;
  subscribeOptions: Array<{ userVisibleOnly: boolean; applicationServerKey: Uint8Array }>;
  sub: SubscriptionLike | null;
  unregistered: number;
  deps: PushDeps;
}

function world(init: {
  permission?: NotificationPermission;
  ask?: NotificationPermission;
  existing?: { endpoint: string; key: Uint8Array | null } | null;
  failPath?: string;
  failWith?: Error;
  keyAnswer?: unknown;
  subscribeThrows?: boolean;
  serverRow?: boolean | "throws";
  unsubscribeThrows?: boolean;
}): World {
  const w: World = { log: [], calls: [], subscribeOptions: [], sub: null, unregistered: 0, deps: null as unknown as PushDeps };
  let permission = init.permission ?? "default";
  const mkSub = (endpoint: string, key: Uint8Array | null): SubscriptionLike => ({
    endpoint,
    options: { applicationServerKey: key ? (key.slice().buffer as ArrayBuffer) : null },
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "P".repeat(87), auth: "A".repeat(22) } }),
    unsubscribe: async () => {
      w.log.push(`browser-unsubscribe:${endpoint}`);
      if (init.unsubscribeThrows) throw new Error("boom");
      if (w.sub?.endpoint === endpoint) w.sub = null;
      return true;
    },
  });
  if (init.existing) w.sub = mkSub(init.existing.endpoint, init.existing.key);
  const reg: RegistrationLike = {
    pushManager: {
      getSubscription: async () => w.sub,
      subscribe: async (o) => {
        w.log.push("subscribe");
        w.subscribeOptions.push(o);
        if (init.subscribeThrows) throw new DOMException("push service error", "AbortError");
        w.sub = mkSub("https://fcm.googleapis.com/fcm/send/new-device", o.applicationServerKey);
        return w.sub;
      },
    },
    unregister: async () => {
      w.log.push("unregister");
      w.unregistered++;
      return true;
    },
  };
  w.deps = {
    permission: () => permission,
    requestPermission: async () => {
      w.log.push("requestPermission");
      permission = init.ask ?? "granted";
      return permission;
    },
    register: async () => {
      w.log.push("register");
      return reg;
    },
    getRegistration: async () => reg,
    call: async <T,>(p: string, body?: unknown): Promise<T> => {
      w.log.push(`call:${p}`);
      w.calls.push({ path: p, body });
      if (init.failPath === p) throw init.failWith ?? new AccountError("http_500", "The profile service returned an error. Try again later.");
      if (p === "push/key") return { publicKey: init.keyAnswer === undefined ? SERVER_KEY : init.keyAnswer } as T;
      return { ok: true } as T;
    },
    serverHasEndpoint: async () => {
      if (init.serverRow === "throws") throw new Error("offline");
      return init.serverRow ?? true;
    },
  };
  return w;
}

describe("UI-160 support detection", () => {
  it("recognises iPhone, iPad and iPadOS-as-Mac; not desktop Macs", () => {
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", platform: "iPad", maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
    expect(isIosDevice(ENV)).toBe(false);
  });

  it("iOS outside an installed app needs install; installed iOS and normal browsers are ok when the APIs exist", () => {
    const ios = { ...ENV, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 };
    expect(pushSupport({ ...ios, hasPushManager: false, hasNotification: false })).toBe("needs-install");
    expect(pushSupport(ios)).toBe("needs-install");
    expect(pushSupport({ ...ios, standalone: true })).toBe("ok");
    expect(pushSupport(ENV)).toBe("ok");
    expect(pushSupport({ ...ENV, hasPushManager: false })).toBe("unsupported");
    expect(pushSupport({ ...ENV, hasServiceWorker: false })).toBe("unsupported");
    expect(pushSupport({ ...ENV, hasNotification: false })).toBe("unsupported");
  });

  it("urlBase64ToUint8Array decodes the 65-byte VAPID key", () => {
    expect(KEY_BYTES.length).toBe(65);
    expect(KEY_BYTES[0]).toBe(4);
    expect([...urlBase64ToUint8Array("-__-")]).toEqual([251, 255, 254]);
  });
});

describe("UI-160 readDeviceState", () => {
  it("unsupported, needs-install and blocked never touch the service worker", async () => {
    const w = world({ permission: "denied" });
    expect(await readDeviceState({ ...ENV, hasPushManager: false }, w.deps)).toBe("unsupported");
    expect(await readDeviceState(ENV, w.deps)).toBe("blocked");
    expect(w.log).toEqual([]);
  });

  it("off without a subscription, on with one the backend still holds, off when the backend no longer has it", async () => {
    expect(await readDeviceState(ENV, world({}).deps)).toBe("off");
    expect(await readDeviceState(ENV, world({ existing: { endpoint: "https://fcm.googleapis.com/fcm/send/x", key: KEY_BYTES } }).deps)).toBe("on");
    expect(await readDeviceState(ENV, world({ existing: { endpoint: "https://fcm.googleapis.com/fcm/send/x", key: KEY_BYTES }, serverRow: false }).deps)).toBe("off");
    // a failed lookup does not flip an existing subscription to off
    expect(await readDeviceState(ENV, world({ existing: { endpoint: "https://fcm.googleapis.com/fcm/send/x", key: KEY_BYTES }, serverRow: "throws" }).deps)).toBe("on");
  });
});

describe("UI-160 turning push on", () => {
  it("asks permission first, registers the worker, subscribes userVisibleOnly with the server key, then tells the backend", async () => {
    const w = world({});
    const r = await enableDevicePush(ENV, w.deps);
    expect(r).toEqual({ state: "on" });
    expect(w.log).toEqual(["requestPermission", "register", "call:push/key", "subscribe", "call:push/subscribe"]);
    expect(w.subscribeOptions).toHaveLength(1);
    expect(w.subscribeOptions[0]?.userVisibleOnly).toBe(true);
    expect([...(w.subscribeOptions[0]?.applicationServerKey ?? [])]).toEqual([...KEY_BYTES]);
    // exactly the fields the backend takes: no expirationTime
    expect(w.calls[1]).toEqual({
      path: "push/subscribe",
      body: { endpoint: "https://fcm.googleapis.com/fcm/send/new-device", keys: { p256dh: "P".repeat(87), auth: "A".repeat(22) } },
    });
  });

  it("does not ask again when permission is already granted", async () => {
    const w = world({ permission: "granted" });
    expect((await enableDevicePush(ENV, w.deps)).state).toBe("on");
    expect(w.log).not.toContain("requestPermission");
  });

  it("a blocked or refused prompt registers nothing", async () => {
    const denied = world({ permission: "denied" });
    expect(await enableDevicePush(ENV, denied.deps)).toEqual({ state: "blocked" });
    expect(denied.log).toEqual([]);

    const refused = world({ ask: "denied" });
    expect(await enableDevicePush(ENV, refused.deps)).toEqual({ state: "blocked" });
    expect(refused.log).toEqual(["requestPermission"]);

    const dismissed = world({ ask: "default" });
    const r = await enableDevicePush(ENV, dismissed.deps);
    expect(r.state).toBe("off");
    expect(r.message).toMatch(/not allowed/);
    expect(dismissed.log).toEqual(["requestPermission"]);
  });

  it("unsupported browsers and iPhone Safari tabs are stopped before any prompt", async () => {
    const w = world({});
    expect((await enableDevicePush({ ...ENV, hasNotification: false }, w.deps)).state).toBe("unsupported");
    expect((await enableDevicePush({ ...ENV, userAgent: "iPhone", platform: "iPhone" }, w.deps)).state).toBe("needs-install");
    expect(w.log).toEqual([]);
  });

  it("replaces a subscription made for another server key, on both sides", async () => {
    const w = world({ permission: "granted", existing: { endpoint: "https://fcm.googleapis.com/fcm/send/old", key: OTHER_KEY } });
    expect((await enableDevicePush(ENV, w.deps)).state).toBe("on");
    expect(w.log).toEqual(["register", "call:push/key", "browser-unsubscribe:https://fcm.googleapis.com/fcm/send/old", "call:push/unsubscribe", "subscribe", "call:push/subscribe"]);
    expect(w.calls[1]).toEqual({ path: "push/unsubscribe", body: { endpoint: "https://fcm.googleapis.com/fcm/send/old" } });
  });

  it("keeps a subscription that already uses the current server key", async () => {
    const w = world({ permission: "granted", existing: { endpoint: "https://fcm.googleapis.com/fcm/send/same", key: KEY_BYTES } });
    expect((await enableDevicePush(ENV, w.deps)).state).toBe("on");
    expect(w.log).not.toContain("browser-unsubscribe:https://fcm.googleapis.com/fcm/send/same");
  });

  it("rolls the browser subscription back when the backend refuses it, and shows the backend's message", async () => {
    const w = world({ failPath: "push/subscribe", failWith: new AccountError("too_many_subscriptions", "At most 10 devices can receive push notifications. Turn it off on one of them first.") });
    const r = await enableDevicePush(ENV, w.deps);
    expect(r.state).toBe("off");
    expect(r.message).toMatch(/At most 10 devices/);
    expect(w.sub).toBeNull();
    expect(w.log).toContain("browser-unsubscribe:https://fcm.googleapis.com/fcm/send/new-device");
  });

  it("explains a push service failure in plain words and leaves nothing behind", async () => {
    const w = world({ subscribeThrows: true });
    const r = await enableDevicePush(ENV, w.deps);
    expect(r.state).toBe("off");
    expect(r.message).toMatch(/push service/);
    expect(w.sub).toBeNull();
  });

  it("refuses a missing or malformed server key", async () => {
    for (const keyAnswer of [null, "short", 42]) {
      const w = world({ keyAnswer });
      const r = await enableDevicePush(ENV, w.deps);
      expect(r.state).toBe("off");
      expect(w.log).not.toContain("subscribe");
    }
  });

  it("a backend that cannot be reached with a signed-out token reports it", async () => {
    const w = world({ failPath: "push/key", failWith: new AccountError("unauthorized", "Sign in to the profile to use push notifications.") });
    const r = await enableDevicePush(ENV, w.deps);
    expect(r).toEqual({ state: "off", message: "Sign in to the profile to use push notifications." });
  });
});

describe("UI-160 turning push off", () => {
  const existing = { endpoint: "https://fcm.googleapis.com/fcm/send/mine", key: KEY_BYTES };

  it("unsubscribes the browser first, then the backend, then removes the worker", async () => {
    const w = world({ permission: "granted", existing });
    expect(await disableDevicePush(w.deps)).toEqual({ state: "off" });
    expect(w.log).toEqual(["browser-unsubscribe:https://fcm.googleapis.com/fcm/send/mine", "call:push/unsubscribe", "unregister"]);
    expect(w.calls[0]).toEqual({ path: "push/unsubscribe", body: { endpoint: "https://fcm.googleapis.com/fcm/send/mine" } });
    expect(w.sub).toBeNull();
  });

  it("still ends off on this device when the backend cannot be reached, and says so", async () => {
    const w = world({ permission: "granted", existing, failPath: "push/unsubscribe", failWith: new AccountError("network", "Could not reach the profile service.") });
    const r = await disableDevicePush(w.deps);
    expect(r.state).toBe("off");
    expect(r.message).toMatch(/drop this device on its own/);
    expect(w.unregistered).toBe(1);
  });

  it("stays on, with a message, when the browser itself refuses to unsubscribe", async () => {
    const w = world({ permission: "granted", existing, unsubscribeThrows: true });
    const r = await disableDevicePush(w.deps);
    expect(r.state).toBe("on");
    expect(r.message).toMatch(/Try again/);
    expect(w.calls).toEqual([]);
  });

  it("with nothing subscribed it just clears the worker", async () => {
    const w = world({ permission: "granted" });
    expect(await disableDevicePush(w.deps)).toEqual({ state: "off" });
    expect(w.calls).toEqual([]);
    expect(w.unregistered).toBe(1);
  });

  it("sign-out detaches a subscribed device and does nothing (no network) otherwise", async () => {
    const subscribed = world({ permission: "granted", existing });
    await detachDeviceOnSignOut(ENV, subscribed.deps);
    expect(subscribed.log).toEqual(["browser-unsubscribe:https://fcm.googleapis.com/fcm/send/mine", "call:push/unsubscribe", "unregister"]);

    const none = world({ permission: "granted" });
    await detachDeviceOnSignOut(ENV, none.deps);
    expect(none.log).toEqual([]);

    const unsupported = world({ existing });
    await detachDeviceOnSignOut({ ...ENV, hasPushManager: false }, unsupported.deps);
    expect(unsupported.log).toEqual([]);
  });
});

describe("UI-160 backend calls", () => {
  const cfg = { url: "https://proj.supabase.co", key: "pk_test" };

  it("POSTs push routes with the player's token and the project key, and refuses to call signed out", async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = async (url: string, init?: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ publicKey: SERVER_KEY }), { status: 200 });
    };
    const deps = browserPushDeps({ cfg, getAccessToken: async () => "user-jwt", serverHasEndpoint: async () => true, fetchFn });
    expect(await deps.call<{ publicKey: string }>("push/key")).toEqual({ publicKey: SERVER_KEY });
    await deps.call("push/subscribe", { endpoint: "e" });
    expect(seen.map((s) => s.url)).toEqual(["https://proj.supabase.co/functions/v1/push/key", "https://proj.supabase.co/functions/v1/push/subscribe"]);
    const h = seen[1]?.init?.headers as Record<string, string>;
    expect(h["Authorization"]).toBe("Bearer user-jwt");
    expect(h["apikey"]).toBe("pk_test");
    expect(seen[1]?.init?.method).toBe("POST");
    expect(seen[1]?.init?.body).toBe(JSON.stringify({ endpoint: "e" }));

    const signedOut = browserPushDeps({ cfg, getAccessToken: async () => null, serverHasEndpoint: async () => true, fetchFn });
    await expect(signedOut.call("push/key")).rejects.toMatchObject({ code: "unauthorized" });
    expect(seen).toHaveLength(2);
  });

  it("turns a backend refusal into the backend's plain message", async () => {
    const fetchFn = async () => new Response(JSON.stringify({ error: "too_many_subscriptions", message: "At most 10 devices can receive push notifications." }), { status: 409 });
    const deps = browserPushDeps({ cfg, getAccessToken: async () => "t", serverHasEndpoint: async () => true, fetchFn });
    await expect(deps.call("push/subscribe", {})).rejects.toMatchObject({ code: "too_many_subscriptions", message: "At most 10 devices can receive push notifications." });
  });
});

// ---------------------------------------------------------------------------------------------
// the toggle in the notification settings
// ---------------------------------------------------------------------------------------------

const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);
const noop = () => undefined;

describe("UI-160 push toggle", () => {
  it("off: offers to turn it on and explains what is sent", () => {
    const out = html(<PushToggleView state="off" onEnable={noop} onDisable={noop} />);
    expect(out).toContain('data-testid="push-on"');
    expect(out).not.toContain('data-testid="push-off"');
    expect(out).toContain("turn on push to this device");
    expect(out).toContain(PUSH_TEXT.off);
    expect(PUSH_PRIVACY).toMatch(/only the notification text/);
    expect(PUSH_PRIVACY).toMatch(/encrypted/);
    expect(PUSH_PRIVACY).toMatch(/never a wallet key/);
    expect(out).toContain('data-testid="push-privacy"');
  });

  it("on: offers to turn it off", () => {
    const out = html(<PushToggleView state="on" onEnable={noop} onDisable={noop} />);
    expect(out).toContain('data-testid="push-off"');
    expect(out).not.toContain('data-testid="push-on"');
  });

  it("blocked, unsupported, checking: no button, plain explanation", () => {
    for (const state of ["blocked", "unsupported", "checking"] as const) {
      const out = html(<PushToggleView state={state} onEnable={noop} onDisable={noop} />);
      expect(out).not.toContain("push-on");
      expect(out).not.toContain("push-off");
      expect(out).toContain(`data-state="${state}"`);
    }
    expect(PUSH_TEXT.blocked).toMatch(/site settings/);
  });

  it("iPhone and iPad: says it only works for the installed app (iOS 16.4+)", () => {
    const out = html(<PushToggleView state="needs-install" onEnable={noop} onDisable={noop} />);
    expect(out).toContain("Add to Home Screen");
    expect(out).toContain("iOS 16.4");
    expect(out).not.toContain("push-on");
  });

  it("shows a message and disables the button while busy", () => {
    const out = html(<PushToggleView state="off" busy message="Notifications were not allowed." onEnable={noop} onDisable={noop} />);
    expect(out).toContain('data-testid="push-message"');
    expect(out).toContain("Notifications were not allowed.");
    expect(out).toMatch(/<button[^>]*disabled[^>]*data-testid="push-on"|<button[^>]*data-testid="push-on"[^>]*disabled/);
  });

  const signedIn: AccountApi = {
    ...ACCOUNT_OFF,
    enabled: true,
    status: "signed-in",
    cfg: { url: "https://proj.supabase.co", key: "pk" },
    // only touched inside effects and handlers, which a static render never runs
    client: {} as AccountApi["client"],
    userId: "u1",
  };

  it("sits inside the browser alerts block and the notification settings for a signed-in player", () => {
    const tree = (child: ReactNode) => (
      <AccountContext.Provider value={signedIn}>
        <NotificationsProvider>{child}</NotificationsProvider>
      </AccountContext.Provider>
    );
    const alerts = html(tree(<BrowserAlertsToggle />));
    expect(alerts).toContain('data-testid="browser-alerts"');
    expect(alerts).toContain('data-testid="push-device"');
    expect(html(tree(<NotificationSettings />))).toContain('data-testid="push-device"');
  });

  it("is absent when signed out", () => {
    const out = html(
      <AccountContext.Provider value={ACCOUNT_OFF}>
        <NotificationsProvider>
          <BrowserAlertsToggle />
        </NotificationsProvider>
      </AccountContext.Provider>,
    );
    expect(out).not.toContain("push-device");
  });
});

// ---------------------------------------------------------------------------------------------
// delivery plumbing
// ---------------------------------------------------------------------------------------------

describe("UI-160 page and worker plumbing", () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const csp = /Content-Security-Policy"\s+content="([^"]+)"/.exec(indexHtml)?.[1] ?? "";

  it("CSP lets the page register /sw.js (worker-src 'self') without loosening script-src", () => {
    expect(csp).toContain("worker-src 'self'");
    expect(/script-src[^;]*'unsafe-inline'/.test(csp)).toBe(false);
    expect(/script-src[^;]*'unsafe-eval'/.test(csp)).toBe(false);
    expect(csp).toContain("default-src 'self'");
  });

  it("index.html does not register the worker; the app does, only after the player turns push on", () => {
    expect(indexHtml).not.toMatch(/serviceWorker|service-worker|sw\.js/i);
    const registrations = ["src/push/client.ts"].filter((f) => fs.readFileSync(path.join(ROOT, f), "utf8").includes("serviceWorker.register("));
    expect(registrations).toEqual(["src/push/client.ts"]);
    for (const f of ["src/main.tsx", "src/app-entry.tsx", "src/App.tsx"]) {
      expect(fs.readFileSync(path.join(ROOT, f), "utf8")).not.toMatch(/serviceWorker\.register/);
    }
  });

  it("the worker is a static file at the site root and its text names the same icon the logic uses", () => {
    expect(fs.existsSync(path.join(ROOT, "public/sw.js"))).toBe(true);
    expect(swSource).toContain(NOTIFICATION_ICON);
  });
});
