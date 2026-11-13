import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseConfig } from "../src/account/config.ts";
import { claimStarterPack, claimStarterPackWithCaptcha, STARTER_MESSAGES } from "../src/account/model.ts";
import {
  CaptchaError,
  TURNSTILE_SCRIPT_URL,
  createCaptchaGate,
  loadTurnstile,
  resetTurnstileLoader,
  turnstileSiteKeyFrom,
  type ScriptDocument,
  type TurnstileApi,
  type TurnstileParams,
  type TurnstileWindow,
} from "../src/account/turnstile.ts";
import { SessionProvider } from "../src/account/session.tsx";
import { StarterPackButton } from "../src/hud/AccountChip.tsx";
import { WalletContext, DISCONNECTED_WALLET, type WalletApi } from "../src/chain/wallet.tsx";

const ROOT = path.resolve(__dirname, "..");
const CFG: SupabaseConfig = { url: "https://vldhsabgpfxccsljdtye.supabase.co", key: "sb_publishable_test" };
const CONTAINER = { nodeName: "SPAN" } as unknown as HTMLElement;

type Call = { url: string; body: Record<string, unknown> | null };

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { fn, calls };
}

/** A fake `window.turnstile` that records renders and lets a test fire the widget callbacks. */
function fakeTurnstile() {
  const renders: { container: unknown; params: TurnstileParams }[] = [];
  const api = {
    render: vi.fn((container: HTMLElement | string, params: TurnstileParams) => {
      renders.push({ container, params });
      return `widget-${renders.length}`;
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  } satisfies TurnstileApi;
  return { api, renders };
}

beforeEach(() => resetTurnstileLoader());

describe("SEC-119 site key gate", () => {
  it("is off for a missing, empty or blank VITE_TURNSTILE_SITE_KEY and on for a real one", () => {
    expect(turnstileSiteKeyFrom({})).toBeNull();
    expect(turnstileSiteKeyFrom({ VITE_TURNSTILE_SITE_KEY: "" })).toBeNull();
    expect(turnstileSiteKeyFrom({ VITE_TURNSTILE_SITE_KEY: "   " })).toBeNull();
    expect(turnstileSiteKeyFrom({ VITE_TURNSTILE_SITE_KEY: true })).toBeNull();
    expect(turnstileSiteKeyFrom({ VITE_TURNSTILE_SITE_KEY: " 0x4AAAAAAA-site " })).toBe("0x4AAAAAAA-site");
  });
});

describe("SEC-119 claim without a site key (unchanged)", () => {
  it("claimStarterPack sends no body and no token, and claimStarterPackWithCaptcha(null gate) is the same call", async () => {
    const plain = fakeFetch(200, { txHash: "TX1", amountYocto: "300000000000000000000000" });
    expect(await claimStarterPack(CFG, "jwt", plain.fn)).toEqual({ kind: "sent", txHash: "TX1", amountYocto: "300000000000000000000000" });
    expect(plain.calls[0].body).toBeNull();

    const viaGate = fakeFetch(200, { txHash: "TX2", amountYocto: "1" });
    expect(await claimStarterPackWithCaptcha(CFG, "jwt", null, null, viaGate.fn)).toEqual({ kind: "sent", txHash: "TX2", amountYocto: "1" });
    expect(viaGate.calls[0].body).toBeNull();
  });

  it("a captcha_failed answer without a token keeps the backend's own message (no dedicated outcome)", async () => {
    const f = fakeFetch(403, { error: "captcha_failed", message: "The captcha check failed. Reload the page and try again." });
    expect(await claimStarterPack(CFG, "jwt", f.fn)).toEqual({ kind: "error", message: "The captcha check failed. Reload the page and try again." });
  });

  it("never touches the script loader, the document or window.turnstile", async () => {
    const doc: ScriptDocument = { createElement: vi.fn() as never, head: { appendChild: vi.fn() } };
    const f = fakeFetch(200, { txHash: "TX3", amountYocto: "1" });
    await claimStarterPackWithCaptcha(CFG, "jwt", null, null, f.fn);
    expect(doc.createElement).not.toHaveBeenCalled();
    expect(doc.head.appendChild).not.toHaveBeenCalled();
  });

  it("renders the starter key with no captcha container when the site key is unset", () => {
    const html = renderStarterButton(undefined);
    expect(html).toContain('data-testid="starter-pack-claim"');
    expect(html).not.toContain("starter-pack-captcha");
    expect(renderStarterButton(null)).not.toContain("starter-pack-captcha");
    expect(renderStarterButton("")).not.toContain("starter-pack-captcha");
  });
});

describe("SEC-119 claim with a site key", () => {
  it("renders the widget container only when a site key is given", () => {
    expect(renderStarterButton("0x4AAAAAAA-site")).toContain('data-testid="starter-pack-captcha"');
  });

  it("loads the script lazily, renders explicitly with the site key and sends the token as turnstileToken", async () => {
    const { api, renders } = fakeTurnstile();
    const gate = createCaptchaGate("0x4AAAAAAA-site", async () => api);
    expect(api.render).not.toHaveBeenCalled();

    const f = fakeFetch(200, { txHash: "TX9", amountYocto: "300000000000000000000000" });
    const pending = claimStarterPackWithCaptcha(CFG, "jwt", gate, CONTAINER, f.fn);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    expect(renders[0].container).toBe(CONTAINER);
    expect(renders[0].params.sitekey).toBe("0x4AAAAAAA-site");
    expect(f.calls).toHaveLength(0); // nothing is sent before the widget has produced a token

    renders[0].params.callback("tok-abc");
    expect(await pending).toEqual({ kind: "sent", txHash: "TX9", amountYocto: "300000000000000000000000" });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(`${CFG.url}/functions/v1/starter-pack`);
    expect(f.calls[0].body).toEqual({ turnstileToken: "tok-abc" });
    expect(api.reset).not.toHaveBeenCalled(); // a successful claim does not restart the widget
  });

  it("resets the widget after captcha_failed and shows the clear message; the next attempt sends the fresh token", async () => {
    const { api, renders } = fakeTurnstile();
    const gate = createCaptchaGate("site", async () => api);
    const denied = fakeFetch(403, { error: "captcha_failed", message: "The captcha check failed. Reload the page and try again." });

    const first = claimStarterPackWithCaptcha(CFG, "jwt", gate, CONTAINER, denied.fn);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    renders[0].params.callback("tok-old");
    expect(await first).toEqual({ kind: "captcha_failed", message: STARTER_MESSAGES.captcha_failed });
    expect(denied.calls[0].body).toEqual({ turnstileToken: "tok-old" });
    expect(api.reset).toHaveBeenCalledTimes(1);
    expect(api.reset).toHaveBeenCalledWith("widget-1");
    expect(STARTER_MESSAGES.captcha_failed).toMatch(/captcha/i);

    // The old token is gone; the second attempt waits for the fresh one from the same widget (no second render).
    const ok = fakeFetch(200, { txHash: "TX10", amountYocto: "1" });
    const second = claimStarterPackWithCaptcha(CFG, "jwt", gate, CONTAINER, ok.fn);
    await Promise.resolve();
    expect(ok.calls).toHaveLength(0);
    renders[0].params.callback("tok-new");
    expect(await second).toMatchObject({ kind: "sent", txHash: "TX10" });
    expect(ok.calls[0].body).toEqual({ turnstileToken: "tok-new" });
    expect(api.render).toHaveBeenCalledTimes(1);
  });

  it("also resets after any other refusal, because a token is single use", async () => {
    const { api, renders } = fakeTurnstile();
    const gate = createCaptchaGate("site", async () => api);
    const taken = fakeFetch(409, { error: "already_claimed", message: "x" });
    const pending = claimStarterPackWithCaptcha(CFG, "jwt", gate, CONTAINER, taken.fn);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    renders[0].params.callback("tok");
    expect(await pending).toEqual({ kind: "already_claimed", message: STARTER_MESSAGES.already_claimed });
    expect(api.reset).toHaveBeenCalledTimes(1);
  });

  it("reports a widget error or a missing container without sending the claim", async () => {
    const { api, renders } = fakeTurnstile();
    const gate = createCaptchaGate("site", async () => api);
    const f = fakeFetch(200, { txHash: "never", amountYocto: "1" });

    const broken = claimStarterPackWithCaptcha(CFG, "jwt", gate, CONTAINER, f.fn);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    renders[0].params["error-callback"]?.("110200");
    expect(await broken).toMatchObject({ kind: "captcha_unavailable" });
    expect(f.calls).toHaveLength(0);
    expect(api.reset).toHaveBeenCalledTimes(1);

    expect(await claimStarterPackWithCaptcha(CFG, "jwt", gate, null, f.fn)).toMatchObject({ kind: "captcha_unavailable" });
    expect(f.calls).toHaveLength(0);
  });

  it("a script that fails to load is a captcha_unavailable outcome, and a later claim can retry", async () => {
    const load = vi.fn<() => Promise<TurnstileApi>>().mockRejectedValueOnce(new CaptchaError("captcha_unavailable", "The captcha script could not be loaded."));
    const gate = createCaptchaGate("site", load);
    const f = fakeFetch(200, { txHash: "never", amountYocto: "1" });
    expect(await claimStarterPackWithCaptcha(CFG, "jwt", gate, CONTAINER, f.fn)).toEqual({
      kind: "captcha_unavailable",
      message: "The captcha script could not be loaded.",
    });
    expect(f.calls).toHaveLength(0);

    const { api, renders } = fakeTurnstile();
    load.mockResolvedValueOnce(api);
    const retry = claimStarterPackWithCaptcha(CFG, "jwt", gate, CONTAINER, f.fn);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    renders[0].params.callback("tok");
    expect(await retry).toMatchObject({ kind: "sent" });
  });

  it("dispose removes the widget", async () => {
    const { api, renders } = fakeTurnstile();
    const gate = createCaptchaGate("site", async () => api);
    const p = gate.getToken(CONTAINER);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    gate.dispose();
    await expect(p).rejects.toBeInstanceOf(CaptchaError);
    expect(api.remove).toHaveBeenCalledWith("widget-1");
    expect(renders).toHaveLength(1);
  });
});

describe("SEC-119 script loader", () => {
  function fakeDoc() {
    const appended: { src: string; async: boolean; defer: boolean; onload: (() => void) | null; onerror: (() => void) | null }[] = [];
    const doc: ScriptDocument = {
      createElement: () => ({ src: "", async: false, defer: false, onload: null, onerror: null }),
      head: { appendChild: (el) => appended.push(el as never) },
    };
    return { doc, appended };
  }

  it("uses an already-present window.turnstile without adding a script", async () => {
    const { api } = fakeTurnstile();
    const { doc, appended } = fakeDoc();
    const win: TurnstileWindow = { turnstile: api };
    expect(await loadTurnstile(doc, win)).toBe(api);
    expect(appended).toHaveLength(0);
  });

  it("appends one explicit-render script from challenges.cloudflare.com, once, and resolves with the global", async () => {
    const { api } = fakeTurnstile();
    const { doc, appended } = fakeDoc();
    const win: TurnstileWindow = {};
    const a = loadTurnstile(doc, win);
    const b = loadTurnstile(doc, win);
    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe(`${TURNSTILE_SCRIPT_URL}?render=explicit`);
    expect(appended[0].src.startsWith("https://challenges.cloudflare.com/turnstile/v0/api.js")).toBe(true);
    expect(appended[0].async).toBe(true);
    win.turnstile = api;
    appended[0].onload?.();
    expect(await a).toBe(api);
    expect(await b).toBe(api);
  });

  it("rejects when the script errors and allows a retry", async () => {
    const { doc, appended } = fakeDoc();
    const win: TurnstileWindow = {};
    const first = loadTurnstile(doc, win);
    appended[0].onerror?.();
    await expect(first).rejects.toMatchObject({ code: "captcha_unavailable" });
    const second = loadTurnstile(doc, win);
    expect(appended).toHaveLength(2);
    win.turnstile = fakeTurnstile().api;
    appended[1].onload?.();
    await expect(second).resolves.toBeDefined();
  });
});

describe("SEC-119 CSP and docs", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const csp = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? "";
  const directive = (name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

  it("allows https://challenges.cloudflare.com in script-src only", () => {
    expect(directive("script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive("script-src")).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
    for (const d of ["default-src", "style-src", "img-src", "connect-src", "frame-src", "worker-src", "object-src"]) {
      expect(directive(d)).not.toContain("challenges.cloudflare.com");
    }
  });

  it(".env.example has an empty VITE_TURNSTILE_SITE_KEY and the README env table lists it", () => {
    const env = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
    expect(env).toMatch(/^VITE_TURNSTILE_SITE_KEY=$/m);
    expect(fs.readFileSync(path.join(ROOT, "README.md"), "utf8")).toContain("| `VITE_TURNSTILE_SITE_KEY` |");
  });

  it("nothing loads the Turnstile script outside src/account/turnstile.ts", () => {
    expect(html).not.toContain("turnstile");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && fs.readFileSync(p, "utf8").includes("challenges.cloudflare.com")) hits.push(path.relative(ROOT, p));
      }
    };
    walk(path.join(ROOT, "src"));
    expect(hits).toEqual(["src/account/turnstile.ts"]);
  });
});

function renderStarterButton(siteKey: string | null | undefined): string {
  const connected: WalletApi = { ...DISCONNECTED_WALLET, status: "connected", accountId: "alice.testnet" };
  return renderToStaticMarkup(
    <WalletContext.Provider value={connected}>
      <SessionProvider config={CFG}>
        <StarterPackButton siteKey={siteKey} />
      </SessionProvider>
    </WalletContext.Provider>,
  );
}
