/**
 * Cloudflare Turnstile for the starter-pack claim (SEC-119). The backend's `starter-pack` function checks
 * a Turnstile token when its `SNACC_TURNSTILE_SECRET` is set (`{ "turnstileToken": "..." }` in the body,
 * error `captcha_failed` otherwise). This file is the browser half, and it is optional: with
 * `VITE_TURNSTILE_SITE_KEY` empty nothing here ever runs, no script is fetched and no widget is drawn.
 *
 * With the key set, `https://challenges.cloudflare.com/turnstile/v0/api.js` is loaded lazily, the first
 * time a claim starts, and the widget is rendered explicitly. Pure enough to unit test: the script
 * loader takes the document and window, the gate takes the loader, so no browser is needed.
 */

export const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** The subset of the Turnstile `render` parameters this app uses. */
export interface TurnstileParams {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  "error-callback"?: (code?: string) => unknown;
  "unsupported-callback"?: () => void;
  /** `interaction-only` keeps the widget hidden unless Cloudflare needs the player to click. */
  appearance?: "always" | "execute" | "interaction-only";
  theme?: "light" | "dark" | "auto";
}

/** The subset of the global `turnstile` object this app uses. */
export interface TurnstileApi {
  render: (container: HTMLElement | string, params: TurnstileParams) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

/** What the loader needs from `window`. */
export interface TurnstileWindow {
  turnstile?: TurnstileApi;
}

/** What the loader needs from `document`. */
export interface ScriptDocument {
  createElement: (tag: "script") => {
    src: string;
    async: boolean;
    defer: boolean;
    onload: (() => void) | null;
    onerror: (() => void) | null;
  };
  head: { appendChild: (el: never) => unknown };
}

type Env = Record<string, string | boolean | undefined>;

/** The site key from the env, or null (feature off) when it is missing or blank. */
export function turnstileSiteKeyFrom(env: Env): string | null {
  const key = typeof env.VITE_TURNSTILE_SITE_KEY === "string" ? env.VITE_TURNSTILE_SITE_KEY.trim() : "";
  return key ? key : null;
}

/** The build's site key (`import.meta.env`), or null when the captcha is off. */
export function turnstileSiteKey(): string | null {
  return turnstileSiteKeyFrom(import.meta.env as unknown as Env);
}

/** A captcha problem with the plain message to show (`code` is the `StarterOutcome` kind it maps to). */
export class CaptchaError extends Error {
  readonly code: "captcha_unavailable" | "captcha_failed";
  constructor(code: "captcha_unavailable" | "captcha_failed", message: string) {
    super(message);
    this.code = code;
    this.name = "CaptchaError";
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

/**
 * Loads the Turnstile script once and resolves with its global. A second call reuses the first load
 * (or the global, when the page already has it); a failed load is forgotten so a later call can retry.
 */
export function loadTurnstile(
  doc: ScriptDocument | undefined = typeof document === "undefined" ? undefined : (document as unknown as ScriptDocument),
  win: TurnstileWindow | undefined = typeof window === "undefined" ? undefined : (window as unknown as TurnstileWindow),
): Promise<TurnstileApi> {
  if (win?.turnstile) return Promise.resolve(win.turnstile);
  if (scriptPromise) return scriptPromise;
  if (!doc || !win) return Promise.reject(new CaptchaError("captcha_unavailable", "The captcha needs a browser."));
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const el = doc.createElement("script");
    el.src = `${TURNSTILE_SCRIPT_URL}?render=explicit`;
    el.async = true;
    el.defer = true;
    el.onload = () => {
      if (win.turnstile) resolve(win.turnstile);
      else reject(new CaptchaError("captcha_unavailable", "The captcha script loaded but did not start."));
    };
    el.onerror = () => reject(new CaptchaError("captcha_unavailable", "The captcha script could not be loaded."));
    doc.head.appendChild(el as never);
  }).catch((e: unknown) => {
    scriptPromise = null;
    throw e;
  });
  return scriptPromise;
}

/** Test hook: forgets the cached script load. */
export function resetTurnstileLoader(): void {
  scriptPromise = null;
}

export interface CaptchaGate {
  /** Resolves with a token, drawing the widget into `container` first (and loading the script) when needed. */
  getToken: (container: HTMLElement) => Promise<string>;
  /** A token is single use: call this after every attempt so the next one gets a fresh challenge. */
  reset: () => void;
  /** Removes the widget (component unmount). */
  dispose: () => void;
}

/**
 * One explicit-render Turnstile widget behind a small promise API. The token arrives through the
 * widget's callback; `getToken` hands out the current one or waits for the next. Never throws
 * synchronously; every failure is a `CaptchaError`.
 */
export function createCaptchaGate(siteKey: string, load: () => Promise<TurnstileApi> = loadTurnstile): CaptchaGate {
  let api: TurnstileApi | null = null;
  let widgetId: string | null = null;
  let token: string | null = null;
  /** True when the widget reported a failure that nobody was waiting for: the next `getToken` restarts it. */
  let needsRun = false;
  let waiters: { resolve: (t: string) => void; reject: (e: CaptchaError) => void }[] = [];

  const settle = (fn: (w: (typeof waiters)[number]) => void) => {
    const pending = waiters;
    waiters = [];
    pending.forEach(fn);
  };
  const fail = (message: string) => {
    token = null;
    needsRun = waiters.length === 0;
    settle((w) => w.reject(new CaptchaError("captcha_unavailable", message)));
  };

  const ensure = async (container: HTMLElement): Promise<void> => {
    if (widgetId !== null) return;
    api = await load();
    if (widgetId !== null) return;
    widgetId = api.render(container, {
      sitekey: siteKey,
      appearance: "interaction-only",
      theme: "light",
      callback: (t) => {
        token = t;
        settle((w) => w.resolve(t));
      },
      "expired-callback": () => {
        token = null;
      },
      "timeout-callback": () => fail("The captcha check timed out. Please try again."),
      "error-callback": () => {
        fail("The captcha check could not run. Please try again.");
        return true;
      },
      "unsupported-callback": () => fail("This browser cannot run the captcha check."),
    });
  };

  const reset = () => {
    token = null;
    needsRun = false;
    if (api && widgetId !== null) {
      try {
        api.reset(widgetId);
      } catch {
        // The widget may already be gone; the next attempt renders a new one.
        widgetId = null;
      }
    }
  };

  return {
    async getToken(container) {
      try {
        await ensure(container);
      } catch (e) {
        throw e instanceof CaptchaError ? e : new CaptchaError("captcha_unavailable", "The captcha could not be started.");
      }
      if (token) return token;
      if (needsRun) reset();
      return new Promise<string>((resolve, reject) => waiters.push({ resolve, reject }));
    },
    reset,
    dispose() {
      token = null;
      settle((w) => w.reject(new CaptchaError("captcha_unavailable", "The captcha was closed.")));
      if (api && widgetId !== null) {
        try {
          api.remove(widgetId);
        } catch {
          // Nothing to clean up.
        }
      }
      widgetId = null;
    },
  };
}
