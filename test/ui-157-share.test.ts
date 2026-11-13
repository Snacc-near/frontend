// UI-157: share previews. Input rules, crawler matching, the meta HTML builder (escaping), the on-chain SVG
// sanitiser, the PNG renderer, the data readers and the three handlers, all without a network (fake fetch).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsePublicPath } from "../src/route.ts";
import {
  CRAWLER_UA_TOKENS,
  crawlerUserAgentPattern,
  isCrawlerUserAgent,
  originFromHost,
  parseAccountId,
  parseStrainId,
  SITE_ORIGIN,
  truncate,
} from "../server/share/validate.js";
import { buildShareHtml, escapeHtml, genericMeta, profileMeta, snaccMeta } from "../server/share/meta.js";
import { embedSvg, svgFromMedia } from "../server/share/svg.js";
import { profileCardSvg, snaccCardSvg, text, xmlEscape, messageCardSvg } from "../server/share/card.js";
import { isPng, pngSize, renderPng } from "../server/share/render.js";
import { loadProfile, loadSnacc, nearView, supabaseEnv } from "../server/share/data.js";
import { handleSharePage } from "../server/share/page.js";
import { handleProfileImage, handleSnaccImage } from "../server/share/image.js";

const FIXTURE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#ff2255"/>' +
  '<g font-family="monospace" font-size="13" fill="#7df"><text x="12" y="30">SNACC #7 R7 G2</text><text x="12" y="62">♥ 614173s | ☠ 0 \u{1F48E}</text></g></svg>';
const toMedia = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// ------------------------------------------------------------------ fake network

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response> | null;
function fakeFetch(handlers: Handler[]) {
  const calls: string[] = [];
  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    for (const h of handlers) {
      const r = await h(url, init);
      if (r) return r;
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { fn: fn as unknown as typeof fetch, calls };
}
const bytesOf = (value: unknown) => Array.from(Buffer.from(JSON.stringify(value)));
const rpcOk = (value: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id: "x", result: { result: bytesOf(value), logs: [] } }));
const rpcContractError = () => new Response(JSON.stringify({ jsonrpc: "2.0", id: "x", result: { error: "wasm execution failed: ERR_STRAIN_NOT_FOUND", logs: [] } }));
/** Answers the Snacc views from a table; unknown methods are a contract error. */
function chain(views: Record<string, (args: any) => unknown>): Handler {
  return (url, init) => {
    if (!/rpc/.test(url)) return null;
    const body = JSON.parse(String(init?.body));
    const method = body.params.method_name as string;
    const args = JSON.parse(Buffer.from(body.params.args_base64, "base64").toString());
    const view = views[method];
    if (!view) return rpcContractError();
    const v = view(args);
    return v === undefined ? rpcContractError() : rpcOk(v);
  };
}

const STRAIN_1 = { strain_id: 1, owner_id: "alice.testnet", status: "Active", vitality: 8000, effective_vitality: 6200, generation: 2 };
const snaccViews = {
  nft_token: (a: { token_id: string }) => (a.token_id === "1" ? { token_id: "1", owner_id: "alice.testnet", metadata: { media: toMedia(FIXTURE_SVG) } } : undefined),
  get_strain: (a: { strain_id: number }) => (a.strain_id === 1 ? STRAIN_1 : undefined),
  nft_supply_for_owner: () => "4",
};

function mockReq(url: string, headers: Record<string, string> = { host: "snacc-nu.vercel.app" }, method = "GET") {
  return { method, url, headers };
}
function mockRes() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    headers,
    body: undefined as string | Uint8Array | undefined,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    end(b?: string | Uint8Array) {
      res.body = b;
    },
  };
  return res;
}

// ------------------------------------------------------------------ validation

describe("input validation", () => {
  it("accepts only 1..9 digit strain ids of at least 1", () => {
    expect(parseStrainId("1")).toBe(1);
    expect(parseStrainId("123456789")).toBe(123456789);
    for (const bad of ["0", "00", "-1", "1.5", "abc", "1e3", "1234567890", "", " 1", "1 ", undefined, null, 7]) expect(parseStrainId(bad)).toBeNull();
  });

  it("accepts NEAR account ids and nothing else", () => {
    for (const ok of ["alice.testnet", "a-b_c.d.testnet", "ab", "0123456789abcdef".repeat(4)]) expect(parseAccountId(ok)).toBe(ok);
    for (const bad of ["", "a", "Alice.testnet", "-a.testnet", "a..testnet", "a.testnet.", "a b.testnet", "a/b", "<script>", "a%20b", "x".repeat(65), undefined, null, 5]) {
      expect(parseAccountId(bad)).toBeNull();
    }
  });

  it("agrees with the router (src/route.ts) on the same fixtures", () => {
    const accounts = ["alice.testnet", "a-b_c.d.testnet", "ab", "a", "Alice.testnet", "a..b", "-x.testnet", "x".repeat(64), "x".repeat(65), "a.b.c.d"];
    for (const a of accounts) {
      const viaRoute = parsePublicPath(`/p/${a}`);
      expect(parseAccountId(a)).toBe(viaRoute?.kind === "profile" ? viaRoute.accountId : null);
    }
    for (const n of ["1", "42", "0", "007", "1234567890", "abc"]) {
      const viaRoute = parsePublicPath(`/snacc/${n}`);
      expect(parseStrainId(n)).toBe(viaRoute?.kind === "snacc" ? viaRoute.strainId : null);
    }
  });

  it("shortens text with an ellipsis, counting characters not code units", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello world", 6)).toBe("hello…");
    expect(Array.from(truncate("\u{1F600}".repeat(5), 3))).toEqual(["\u{1F600}", "\u{1F600}", "…"]);
  });
});

describe("crawler user agents", () => {
  const crawlers = [
    "Twitterbot/1.0",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "TelegramBot (like TwitterBot)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Slackbot 1.0 (+https://api.slack.com/robots)",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    "WhatsApp/2.23.20.0 A",
    "Mozilla/5.0 (compatible; TWITTERBOT)",
  ];
  const humans = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "curl/8.7.1",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "",
  ];
  it("recognises the unfurlers (any letter case)", () => {
    for (const ua of crawlers) expect(isCrawlerUserAgent(ua), ua).toBe(true);
  });
  it("leaves browsers, curl and an empty agent on the SPA", () => {
    for (const ua of humans) expect(isCrawlerUserAgent(ua), ua).toBe(false);
    expect(isCrawlerUserAgent(undefined)).toBe(false);
  });
  it("covers at least the seven named crawlers", () => {
    for (const t of ["twitterbot", "facebookexternalhit", "discordbot", "telegrambot", "slackbot", "linkedinbot", "whatsapp"]) expect(CRAWLER_UA_TOKENS).toContain(t);
  });
});

describe("vercel.json", () => {
  const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    rewrites: { source: string; destination: string; has?: { type: string; key: string; value: string }[] }[];
    functions?: Record<string, { includeFiles?: string }>;
  };

  it("routes crawlers on /snacc/:id and /p/:account to the meta page, with the same pattern the code tests", () => {
    const snacc = cfg.rewrites.find((r) => r.source.startsWith("/snacc/"));
    const profile = cfg.rewrites.find((r) => r.source.startsWith("/p/"));
    expect(snacc?.destination).toBe("/api/share?kind=snacc&id=:id");
    expect(profile?.destination).toBe("/api/share?kind=p&account=:account");
    for (const r of [snacc!, profile!]) {
      expect(r.has).toEqual([{ type: "header", key: "user-agent", value: crawlerUserAgentPattern() }]);
    }
  });

  it("keeps the SPA catch-all last, so humans and every other route still get index.html", () => {
    const last = cfg.rewrites[cfg.rewrites.length - 1];
    expect(last).toEqual({ source: "/(.*)", destination: "/index.html" });
    expect(last.has).toBeUndefined();
    expect(cfg.rewrites.filter((r) => !r.has)).toHaveLength(1);
  });

  it("ships the fonts and the wasm file with the image functions", () => {
    const files = Object.values(cfg.functions ?? {})
      .map((f) => f.includeFiles)
      .join(",");
    expect(files).toContain("server/assets/fonts");
    expect(files).toContain("@resvg/resvg-wasm/index_bg.wasm");
  });

  it("uses the same RE2 pattern as the matcher: each token appears in the alternation", () => {
    const pattern = crawlerUserAgentPattern();
    expect(pattern.startsWith("(?i).*(")).toBe(true);
    for (const t of CRAWLER_UA_TOKENS) expect(pattern).toContain(t);
  });
});

describe("originFromHost", () => {
  it("keeps production and Vercel preview hosts and falls back to production for anything else", () => {
    expect(originFromHost("snacc-nu.vercel.app")).toBe("https://snacc-nu.vercel.app");
    expect(originFromHost("Snacc-Git-item-ui-157-158-team.vercel.app")).toBe("https://snacc-git-item-ui-157-158-team.vercel.app");
    for (const bad of ["evil.example.com", "snacc-nu.vercel.app.evil.com", "vercel.app", "", undefined, "a b.vercel.app", "evil.com/x.vercel.app"]) {
      expect(originFromHost(bad)).toBe(SITE_ORIGIN);
    }
  });
});

// ------------------------------------------------------------------ meta HTML

describe("meta HTML builder", () => {
  const base = { title: "T", description: "D", url: "https://snacc-nu.vercel.app/snacc/1", image: "https://snacc-nu.vercel.app/api/og/snacc/1", imageAlt: "alt", linkText: "Open" };

  it("escapes every dynamic value, including quotes that would break out of an attribute", () => {
    const evil = `"><script>alert(1)</script>&'`;
    const html = buildShareHtml({ title: evil, description: evil, url: `https://x/?a="b"&c=<d>`, image: evil, imageAlt: evil, linkText: evil });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"><');
    expect(html).toContain("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;&#39;");
    expect(html).toContain("a=&quot;b&quot;&amp;c=&lt;d&gt;");
    expect(escapeHtml("a\u0000b\u0007c")).toBe("abc");
  });

  it("carries the Open Graph and Twitter tags plus a normal link for humans", () => {
    const html = buildShareHtml(base);
    for (const frag of [
      '<meta property="og:title" content="T">',
      '<meta property="og:description" content="D">',
      '<meta property="og:url" content="https://snacc-nu.vercel.app/snacc/1">',
      '<meta property="og:image" content="https://snacc-nu.vercel.app/api/og/snacc/1">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:image" content="https://snacc-nu.vercel.app/api/og/snacc/1">',
      '<a href="https://snacc-nu.vercel.app/snacc/1">Open</a>',
      '<link rel="canonical" href="https://snacc-nu.vercel.app/snacc/1">',
    ]) {
      expect(html).toContain(frag);
    }
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  it("builds Snacc meta from chain data and degrades without it", () => {
    const m = snaccMeta({ state: "ok", id: 1, owner: "alice.testnet", status: "Active", effectiveVitality: 6200, vitality: 8000, generation: 2, svg: null }, "https://snacc-nu.vercel.app");
    expect(m.title).toBe("Snacc #1 · Snacc");
    expect(m.description).toContain("Active, 62% vitality, generation 2, owned by alice.testnet");
    expect(m.description).toContain("no money value");
    expect(m.url).toBe("https://snacc-nu.vercel.app/snacc/1");
    expect(m.image).toBe("https://snacc-nu.vercel.app/api/og/snacc/1");
    expect(snaccMeta({ state: "missing", id: 9 }, "https://x.vercel.app").description).toContain("was not found");
    expect(snaccMeta({ state: "unavailable", id: 9 }, "https://x.vercel.app").description).toContain("Snacc #9 on NEAR testnet");
  });

  it("builds profile meta with username, level and Snacc count when known", () => {
    const m = profileMeta({ account: "alice.testnet", username: "alice", level: 3, totalXp: 450, snaccCount: 1 }, "https://snacc-nu.vercel.app");
    expect(m.title).toBe("alice · Snacc player profile");
    expect(m.description).toContain("level 3, 1 Snacc on chain");
    expect(m.url).toBe("https://snacc-nu.vercel.app/p/alice.testnet");
    expect(m.image).toBe("https://snacc-nu.vercel.app/api/og/p/alice.testnet");
    const bare = profileMeta({ account: "bob.testnet", username: null, level: null, totalXp: null, snaccCount: null }, "https://snacc-nu.vercel.app");
    expect(bare.title).toBe("bob.testnet · Snacc player profile");
    expect(bare.description).not.toContain("level");
  });

  it("falls back to the site's own words", () => {
    const g = genericMeta("https://snacc-nu.vercel.app");
    expect(g.title).toBe("Snacc — NFTs that eat a memecoin");
    expect(g.image).toBe("https://snacc-nu.vercel.app/brand/og-image.png");
  });
});

// ------------------------------------------------------------------ SVG handling and rendering

describe("on-chain SVG handling", () => {
  it("reads only plain SVG data URIs", () => {
    expect(svgFromMedia(toMedia(FIXTURE_SVG))).toBe(FIXTURE_SVG);
    expect(svgFromMedia("https://example.com/a.svg")).toBeNull();
    expect(svgFromMedia("data:image/svg+xml;base64,@@@")).toBeNull();
    expect(svgFromMedia(toMedia("<html></html>"))).toBeNull();
    expect(svgFromMedia(`data:image/svg+xml;base64,${"A".repeat(200_001)}`)).toBeNull();
    expect(svgFromMedia(undefined)).toBeNull();
  });

  it("nests the SVG in a fixed box and strips scripts, styles, handlers, external references and emoji", () => {
    const hostile =
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" width="9999" height="9999" onload="x()" id="root" fill="red">' +
      "<script>alert(1)</script><style>text{display:none}</style><foreignObject><div>hi</div></foreignObject>" +
      '<image href="https://evil.example/a.png" width="10" height="10"/><use xlink:href="#a"/><a onclick="y()" href="javascript:alert(1)">x</a>' +
      '<text onmouseover="z()">hello ♥ \u{1F48E}</text></svg>';
    const out = embedSvg(hostile, { x: 10, y: 20, width: 300, height: 300 })!;
    expect(out.startsWith('<svg x="10" y="20" width="300" height="300" viewBox="0 0 100 100"')).toBe(true);
    expect(out).toContain('fill="red"');
    for (const bad of ["<script", "<style", "foreignObject", "onload", "onclick", "onmouseover", "evil.example", "javascript:", 'id="root"', "9999", "♥", "\u{1F48E}"]) {
      expect(out, bad).not.toContain(bad);
    }
    expect(out).toContain('xlink:href="#a"');
    expect(out).toContain("hello");
  });

  it("falls back to width/height for the viewBox and refuses DOCTYPE, entities and non-SVG input", () => {
    expect(embedSvg('<svg width="50" height="40"><rect/></svg>', { x: 0, y: 0, width: 10, height: 10 })).toContain('viewBox="0 0 50 40"');
    expect(embedSvg("<svg><rect/></svg>", { x: 0, y: 0, width: 10, height: 10 })).toContain('viewBox="0 0 320 320"');
    expect(embedSvg('<!DOCTYPE svg [<!ENTITY a "b">]><svg><rect/></svg>', { x: 0, y: 0, width: 10, height: 10 })).toBeNull();
    expect(embedSvg("<div>no</div>", { x: 0, y: 0, width: 10, height: 10 })).toBeNull();
    expect(embedSvg("", { x: 0, y: 0, width: 10, height: 10 })).toBeNull();
  });
});

describe("card text helpers", () => {
  it("escapes XML and shrinks, then truncates, long text to its box", () => {
    expect(xmlEscape(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
    const fit = text({ x: 0, y: 0, size: 100, weight: 700, content: "Snacc #123456789", maxWidth: 500, min: 40 });
    expect(Number(/font-size="(\d+)"/.exec(fit)![1])).toBeLessThan(100);
    const cut = text({ x: 0, y: 0, size: 40, content: "x".repeat(200), maxWidth: 300, min: 20 });
    expect(cut).toContain("…");
    expect(cut.length).toBeLessThan(260);
    expect(text({ x: 0, y: 0, size: 20, content: "<b>" })).toContain("&lt;b&gt;");
  });
});

describe("PNG renderer", () => {
  it("returns a 1200x630 PNG for a fixture SVG", async () => {
    const png = await renderPng('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#efefec"/><text x="40" y="100" font-family="DM Sans" font-size="60">Snacc</text></svg>');
    expect(isPng(png)).toBe(true);
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(pngSize(png)).toEqual({ width: 1200, height: 630 });
  });

  it("rejects an SVG it cannot parse", async () => {
    await expect(renderPng("<svg")).rejects.toThrow();
  });

  it("renders the Snacc card with the on-chain art, and the same card without it", async () => {
    const data = { state: "ok" as const, id: 7, owner: "alice.testnet", status: "Active", effectiveVitality: 6200, vitality: 8000, generation: 2, svg: FIXTURE_SVG };
    const withArt = await renderPng(snaccCardSvg(data));
    const without = await renderPng(snaccCardSvg(data, { withArt: false }));
    expect(pngSize(withArt)).toEqual({ width: 1200, height: 630 });
    expect(pngSize(without)).toEqual({ width: 1200, height: 630 });
    expect(Buffer.compare(Buffer.from(withArt), Buffer.from(without))).not.toBe(0);
  });

  it("renders every card state", async () => {
    const cards = [
      snaccCardSvg({ state: "missing", id: 99999 }),
      snaccCardSvg({ state: "unavailable", id: 5 }),
      snaccCardSvg({ state: "ok", id: 123456789, owner: null, status: null, effectiveVitality: null, vitality: null, generation: null, svg: null }),
      snaccCardSvg({ state: "ok", id: 3, owner: "x".repeat(64), status: "SplicedBurned", effectiveVitality: 0, vitality: 0, generation: 0, svg: "<svg" }),
      profileCardSvg({ account: "alice.testnet", username: "alice", level: 12, totalXp: 6400, snaccCount: 4 }),
      profileCardSvg({ account: "a".repeat(64), username: null, level: null, totalXp: null, snaccCount: null }),
      profileCardSvg({ account: "bob.testnet", username: "bob", level: 1, totalXp: null, snaccCount: 1 }),
      messageCardSvg("Snacc", "NFTs that eat a memecoin."),
    ];
    for (const svg of cards) expect(pngSize(await renderPng(svg))).toEqual({ width: 1200, height: 630 });
  });
});

// ------------------------------------------------------------------ data readers

describe("NEAR views and Supabase reads", () => {
  it("tries the second RPC when the first fails and reports contract refusals apart from outages", async () => {
    const { fn, calls } = fakeFetch([
      (url) => (url === "https://test.rpc.fastnear.com" ? new Response("nope", { status: 502 }) : null),
      chain({ nft_supply_for_owner: () => "7" }),
    ]);
    expect(await nearView("nft_supply_for_owner", { account_id: "a.testnet" }, { fetch: fn })).toEqual({ ok: true, value: "7" });
    expect(calls).toEqual(["https://test.rpc.fastnear.com", "https://rpc.testnet.fastnear.com"]);

    const refused = fakeFetch([chain({})]);
    expect(await nearView("get_strain", { strain_id: 9 }, { fetch: refused.fn })).toEqual({ ok: false, kind: "contract" });

    const down = fakeFetch([() => new Response("{}", { status: 503 })]);
    expect(await nearView("get_strain", { strain_id: 1 }, { fetch: down.fn })).toEqual({ ok: false, kind: "rpc" });

    const hang = (async (_u: string, init?: RequestInit) => new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    expect(await nearView("get_strain", { strain_id: 1 }, { fetch: hang, timeoutMs: 20 })).toEqual({ ok: false, kind: "rpc" });
  });

  it("loads one Snacc: ok, missing and unavailable", async () => {
    const ok = await loadSnacc(1, { fetch: fakeFetch([chain(snaccViews)]).fn });
    expect(ok).toMatchObject({ state: "ok", id: 1, owner: "alice.testnet", status: "Active", effectiveVitality: 6200, generation: 2 });
    expect(ok.state === "ok" && ok.svg).toBe(FIXTURE_SVG);
    expect(await loadSnacc(2, { fetch: fakeFetch([chain(snaccViews)]).fn })).toEqual({ state: "missing", id: 2 });
    expect(await loadSnacc(1, { fetch: fakeFetch([() => new Response("x", { status: 500 })]).fn })).toEqual({ state: "unavailable", id: 1 });
  });

  it("reads the Supabase env and refuses odd URLs", () => {
    expect(supabaseEnv({ VITE_SUPABASE_URL: "https://abc.supabase.co/", VITE_SUPABASE_PUBLISHABLE_KEY: " k " })).toEqual({ url: "https://abc.supabase.co", key: "k" });
    expect(supabaseEnv({ VITE_SUPABASE_URL: "http://abc.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "k" })).toBeNull();
    expect(supabaseEnv({ VITE_SUPABASE_URL: "https://abc.supabase.co/path", VITE_SUPABASE_PUBLISHABLE_KEY: "k" })).toBeNull();
    expect(supabaseEnv({ VITE_SUPABASE_URL: "https://abc.supabase.co" })).toBeNull();
    expect(supabaseEnv({})).toBeNull();
  });

  it("loads a profile from the public views plus the chain count, sending only the apikey header", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const rest: Handler = (url, init) => {
      if (!url.startsWith("https://abc.supabase.co/rest/v1/")) return null;
      seen.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      if (url.includes("/profiles_snacc?")) return new Response(JSON.stringify([{ username: "alice" }]));
      if (url.includes("/player_xp_snacc?")) return new Response(JSON.stringify([{ level: 3, total_xp: 450 }]));
      return new Response("[]");
    };
    const env = { VITE_SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "pub-key" };
    const p = await loadProfile("alice.testnet", { fetch: fakeFetch([rest, chain(snaccViews)]).fn, env });
    expect(p).toEqual({ account: "alice.testnet", username: "alice", level: 3, totalXp: 450, snaccCount: 4 });
    expect(seen).toHaveLength(2);
    for (const s of seen) {
      expect(s.url).toContain("near_account_id=eq.alice.testnet");
      expect(s.headers).toEqual({ apikey: "pub-key", accept: "application/json" });
    }
  });

  it("still answers when the profile database is off or failing", async () => {
    const off = await loadProfile("alice.testnet", { fetch: fakeFetch([chain(snaccViews)]).fn, env: {} });
    expect(off).toEqual({ account: "alice.testnet", username: null, level: null, totalXp: null, snaccCount: 4 });
    const failing: Handler = (url) => (url.includes("supabase") ? new Response("boom", { status: 500 }) : null);
    const env = { VITE_SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "k" };
    const bad = await loadProfile("alice.testnet", { fetch: fakeFetch([failing, () => new Response("x", { status: 500 })]).fn, env });
    expect(bad).toEqual({ account: "alice.testnet", username: null, level: null, totalXp: null, snaccCount: null });
    // a username that breaks the profile rules is ignored
    const odd: Handler = (url) => (url.includes("/profiles_snacc?") ? new Response(JSON.stringify([{ username: "<b>x</b>" }])) : url.includes("supabase") ? new Response("[]") : null);
    expect((await loadProfile("alice.testnet", { fetch: fakeFetch([odd, chain(snaccViews)]).fn, env })).username).toBeNull();
  });
});

// ------------------------------------------------------------------ handlers

const OG_PNG = new Uint8Array(readFileSync(new URL("../public/brand/og-image.png", import.meta.url)));
const staticOg: Handler = (url) => (url.endsWith("/brand/og-image.png") ? new Response(OG_PNG) : null);

describe("share page handler", () => {
  it("answers a crawler with the meta page for a Snacc, from chain data", async () => {
    const res = mockRes();
    await handleSharePage(mockReq("/api/share?kind=snacc&id=1", { host: "snacc-nu.vercel.app", "user-agent": "Twitterbot/1.0" }), res, { fetch: fakeFetch([chain(snaccViews)]).fn });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(res.headers["cache-control"]).toContain("s-maxage");
    const html = String(res.body);
    expect(html).toContain('<meta property="og:title" content="Snacc #1 · Snacc">');
    expect(html).toContain('<meta property="og:image" content="https://snacc-nu.vercel.app/api/og/snacc/1">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain("owned by alice.testnet");
  });

  it("builds the profile page on a preview host and never trusts a foreign Host header", async () => {
    const env = {};
    const prev = mockRes();
    await handleSharePage(mockReq("/api/share?kind=p&account=alice.testnet", { host: "snacc-git-x.vercel.app" }), prev, { fetch: fakeFetch([chain(snaccViews)]).fn, env });
    expect(String(prev.body)).toContain('content="https://snacc-git-x.vercel.app/api/og/p/alice.testnet"');
    const foreign = mockRes();
    await handleSharePage(mockReq("/api/share?kind=p&account=alice.testnet", { host: "evil.example.com" }), foreign, { fetch: fakeFetch([chain(snaccViews)]).fn, env });
    expect(String(foreign.body)).toContain('content="https://snacc-nu.vercel.app/api/og/p/alice.testnet"');
    expect(String(foreign.body)).not.toContain("evil.example.com");
  });

  it("answers 404 with the generic meta for bad ids and unknown kinds, never a 5xx", async () => {
    for (const url of ["/api/share?kind=snacc&id=abc", "/api/share?kind=snacc", "/api/share?kind=p&account=%3Cscript%3E", "/api/share?kind=other", "/api/share"]) {
      const res = mockRes();
      await handleSharePage(mockReq(url), res, { fetch: fakeFetch([]).fn });
      expect(res.statusCode, url).toBe(404);
      expect(String(res.body)).toContain('<meta property="og:title" content="Snacc — NFTs that eat a memecoin">');
    }
  });

  it("falls back to the generic meta with 200 when the lookups explode", async () => {
    const res = mockRes();
    const boom = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await handleSharePage(mockReq("/api/share?kind=snacc&id=1"), res, { fetch: boom });
    expect(res.statusCode).toBe(200);
    expect(String(res.body)).toContain('content="Snacc #1 · Snacc"');
    expect(String(res.body)).toContain("Snacc #1 on NEAR testnet.");
  });

  it("handles HEAD without a body and refuses other methods", async () => {
    const head = mockRes();
    await handleSharePage(mockReq("/api/share?kind=snacc&id=1", { host: "snacc-nu.vercel.app" }, "HEAD"), head, { fetch: fakeFetch([chain(snaccViews)]).fn });
    expect(head.statusCode).toBe(200);
    expect(head.body).toBeUndefined();
    const post = mockRes();
    await handleSharePage(mockReq("/api/share?kind=snacc&id=1", { host: "snacc-nu.vercel.app" }, "POST"), post, {});
    expect(post.statusCode).toBe(405);
    expect(post.headers.allow).toBe("GET, HEAD");
  });
});

describe("image handlers", () => {
  it("renders the Snacc card as a cached 1200x630 PNG", async () => {
    const res = mockRes();
    await handleSnaccImage(mockReq("/api/og/snacc/1"), res, { fetch: fakeFetch([chain(snaccViews)]).fn });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toContain("s-maxage=600");
    expect(res.headers["x-snacc-share"]).toBe("png");
    expect(pngSize(res.body as Uint8Array)).toEqual({ width: 1200, height: 630 });
  });

  it("takes the id from req.query when Vercel fills it", async () => {
    const res = mockRes();
    await handleSnaccImage({ method: "GET", url: "/api/og/snacc/[id]", headers: { host: "snacc-nu.vercel.app" }, query: { id: "1" } }, res, { fetch: fakeFetch([chain(snaccViews)]).fn });
    expect(res.headers["x-snacc-share"]).toBe("png");
  });

  it("renders a short-lived 'not found' card for a missing Snacc", async () => {
    const res = mockRes();
    await handleSnaccImage(mockReq("/api/og/snacc/2"), res, { fetch: fakeFetch([chain(snaccViews)]).fn });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("s-maxage=60");
    expect(pngSize(res.body as Uint8Array)).toEqual({ width: 1200, height: 630 });
  });

  it("serves the static card when the RPC is down, the id is bad or the renderer throws", async () => {
    const rpcDown: Handler = (url) => (/rpc/.test(url) ? new Response("x", { status: 500 }) : null);
    for (const [name, url, deps] of [
      ["rpc down", "/api/og/snacc/1", { fetch: fakeFetch([rpcDown, staticOg]).fn }],
      ["bad id", "/api/og/snacc/abc", { fetch: fakeFetch([staticOg]).fn }],
      ["renderer throws", "/api/og/snacc/1", { fetch: fakeFetch([chain(snaccViews), staticOg]).fn, render: async () => Promise.reject(new Error("wasm")) }],
    ] as const) {
      const res = mockRes();
      await handleSnaccImage(mockReq(url), res, deps);
      expect(res.statusCode, name).toBe(200);
      expect(res.headers["x-snacc-share"], name).toBe("fallback");
      expect(res.headers["cache-control"], name).toContain("s-maxage=60");
      expect(isPng(res.body as Uint8Array), name).toBe(true);
    }
  });

  it("retries the card without the art when the on-chain SVG is what breaks the render", async () => {
    let calls = 0;
    const res = mockRes();
    await handleSnaccImage(mockReq("/api/og/snacc/1"), res, {
      fetch: fakeFetch([chain(snaccViews)]).fn,
      render: async (svg) => {
        calls++;
        if (svg.includes("SNACC #7")) throw new Error("bad svg");
        return renderPng(svg);
      },
    });
    expect(calls).toBe(2);
    expect(res.headers["x-snacc-share"]).toBe("png");
  });

  it("redirects to the static card as a last resort instead of answering 5xx", async () => {
    const res = mockRes();
    await handleSnaccImage(mockReq("/api/og/snacc/1"), res, { fetch: fakeFetch([() => new Response("x", { status: 500 })]).fn });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://snacc-nu.vercel.app/brand/og-image.png");
  });

  it("renders the profile card with level and Snacc count, and falls back on a bad account", async () => {
    const rest: Handler = (url) =>
      url.includes("/player_xp_snacc?") ? new Response(JSON.stringify([{ level: 5, total_xp: 1100 }])) : url.includes("supabase") ? new Response("[]") : null;
    const env = { VITE_SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "k" };
    const ok = mockRes();
    await handleProfileImage(mockReq("/api/og/p/alice.testnet"), ok, { fetch: fakeFetch([rest, chain(snaccViews)]).fn, env });
    expect(ok.headers["x-snacc-share"]).toBe("png");
    expect(pngSize(ok.body as Uint8Array)).toEqual({ width: 1200, height: 630 });
    const bad = mockRes();
    await handleProfileImage(mockReq("/api/og/p/Not%20An%20Account"), bad, { fetch: fakeFetch([staticOg]).fn });
    expect(bad.headers["x-snacc-share"]).toBe("fallback");
  });
});
