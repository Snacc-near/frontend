/**
 * OPS-127: anonymous usage funnel + client error reports, sent to Snacc's own `track` Edge Function
 * (no third-party analytics). What is sent: an allow-listed event name, the route generalised by the
 * server, a few small props, and a random device id + session id. Never an account id, wallet address,
 * key or token. Off when the player turns "Share anonymous usage stats" off in Settings, when the
 * browser sends Do Not Track / Global Privacy Control, when Supabase is not configured, and in tests.
 */
import { functionUrl, supabaseConfig, type SupabaseConfig } from "./account/config.ts";

export const TELEMETRY_KEY = "snacc_telemetry";
export const DEVICE_KEY = "snacc_device_id";
const SESSION_KEY = "snacc_session_id";

export type TelemetryEvent =
  | "page_view"
  | "onboarding_started"
  | "onboarding_done"
  | "wallet_connect_click"
  | "wallet_connected"
  | "signed_in"
  | "tx_submitted"
  | "tx_succeeded"
  | "tx_failed"
  | "quest_opened"
  | "share_clicked"
  | "starter_claimed";

type Props = Record<string, string | number | boolean>;
interface QueuedEvent {
  name: TelemetryEvent;
  route: string;
  props: Props;
  ts: number;
}
interface QueuedError {
  name: string;
  message: string;
  stack?: string;
  route: string;
  ts: number;
}

const MAX_ERRORS_PER_SESSION = 10;
const FLUSH_MS = 5000;

function storage(kind: "local" | "session"): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `d-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function stableId(store: Storage | null, key: string): string {
  const existing = store?.getItem(key);
  if (existing && /^[a-z0-9-]{8,64}$/.test(existing)) return existing;
  const id = randomId().toLowerCase();
  try {
    store?.setItem(key, id);
  } catch {
    /* private mode: a per-page id is fine */
  }
  return id;
}

/** The browser asked sites not to track (Do Not Track or Global Privacy Control). */
export function browserOptedOut(nav: Partial<Navigator> & { globalPrivacyControl?: boolean } | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!nav) return false;
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/** Player choice: "on" | "off" | null (no choice yet = on unless the browser opted out). */
export function readTelemetryChoice(store: Pick<Storage, "getItem"> | null = storage("local")): "on" | "off" | null {
  const v = store?.getItem(TELEMETRY_KEY);
  return v === "on" || v === "off" ? v : null;
}

export function telemetryEnabled(
  choice: "on" | "off" | null = readTelemetryChoice(),
  optedOut: boolean = browserOptedOut(),
  cfg: SupabaseConfig | null = supabaseConfig(),
): boolean {
  if (!cfg) return false;
  if (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test") return false;
  if (choice === "off") return false;
  if (choice === "on") return true;
  return !optedOut;
}

export function setTelemetryChoice(on: boolean): void {
  try {
    storage("local")?.setItem(TELEMETRY_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  if (!on) {
    events.length = 0;
    errors.length = 0;
  }
}

const events: QueuedEvent[] = [];
const errors: QueuedError[] = [];
let errorsThisSession = 0;
const seenErrors = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

const route = () => (typeof window === "undefined" ? "/" : window.location.pathname);

/** Builds the POST body; exported for tests. */
export function buildBatch(deviceId: string, sessionId: string, ev: readonly QueuedEvent[], er: readonly QueuedError[]): string {
  return JSON.stringify({ deviceId, sessionId, events: ev, errors: er });
}

function flush(): void {
  timer = null;
  if (events.length === 0 && errors.length === 0) return;
  const cfg = supabaseConfig();
  if (!cfg || !telemetryEnabled()) {
    events.length = 0;
    errors.length = 0;
    return;
  }
  const body = buildBatch(stableId(storage("local"), DEVICE_KEY), stableId(storage("session"), SESSION_KEY), events.splice(0, 20), errors.splice(0, 20 - Math.min(20, events.length)));
  try {
    // text/plain keeps this a simple CORS request (no preflight); keepalive lets it survive page hide.
    void fetch(functionUrl(cfg, "track"), { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => undefined);
  } catch {
    /* never let telemetry break the app */
  }
  if (events.length || errors.length) schedule();
}

function schedule(): void {
  if (timer === null && typeof window !== "undefined") timer = setTimeout(flush, FLUSH_MS);
}

/** Queues one funnel event. No-op when telemetry is off. */
export function track(name: TelemetryEvent, props: Props = {}): void {
  if (!telemetryEnabled()) return;
  events.push({ name, route: route(), props, ts: Date.now() });
  schedule();
}

/** Queues one client error (deduplicated per session, capped). */
export function reportError(err: unknown): void {
  if (!telemetryEnabled() || errorsThisSession >= MAX_ERRORS_PER_SESSION) return;
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Unknown error");
  const key = `${e.name}:${e.message}`;
  if (seenErrors.has(key)) return;
  seenErrors.add(key);
  errorsThisSession++;
  errors.push({ name: e.name || "Error", message: e.message.slice(0, 300) || "(no message)", stack: e.stack?.slice(0, 1500), route: route(), ts: Date.now() });
  schedule();
}

let started = false;
/** Called once from the app entry: page view, global error hooks, flush on page hide. */
export function startTelemetry(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  track("page_view");
  window.addEventListener("error", (ev) => reportError(ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) => reportError(ev.reason));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
