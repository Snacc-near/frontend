/**
 * UI-151 (basic game shell): the intro seen-flag, settings persistence, "reset local data" touching
 * only the listed keys, route matching for the new pages, the manifest, the sourced help copy and the
 * legal pages. Runs in node (no DOM): storage is a small in-memory fake.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { selectRoute } from "../src/route.ts";
import {
  APP_LOCAL_KEYS,
  APP_LOCAL_KEY_INFO,
  DEFAULT_SOUND,
  MOTION_KEY,
  ONBOARDING_KEY,
  SKIN_KEY,
  SOUND_KEY,
  clampVolume,
  hasSeenOnboarding,
  markOnboardingSeen,
  readMotionPref,
  readSkinPref,
  readSoundPrefs,
  resetLocalData,
  resetOnboardingMemory,
  resolveReducedMotion,
  saveMotionPref,
  saveSkinPref,
  saveSoundPrefs,
  type StorageLike,
} from "../src/prefs/prefs.ts";
import { GUEST_LABEL_KEY, LEGACY_SESSION_KEY } from "../src/auth/guestLabel.ts";
import { COSTS, CONTRACT_FIGURES, GLOSSARY, INTRO_STEPS, RULES, bpsToPct } from "../src/help/content.ts";
import { BASE_BURST_BPS, INITIAL_ATP, MAX_BURST_BPS, VITALITY_MAX } from "../src/config/constants.ts";
import { OFFICIAL } from "../src/landing/lib/live.ts";
import { DISTRESS_MAX_EFFECTIVE_VITALITY } from "../src/data/collection.ts";
import { DEFAULT_FEED_SNACC, DEFAULT_STAKE_NEAR } from "../src/chain/actions.ts";
import { bioSound } from "../src/sound.ts";
import { tEn } from "../src/i18n/catalog.ts";
import { TOOLS, ToolsToolbar } from "../src/hud/ToolsToolbar.tsx";
import { OnboardingModal } from "../src/help/OnboardingModal.tsx";
import { HelpModal } from "../src/help/HelpModal.tsx";
import { SettingsModal } from "../src/help/SettingsModal.tsx";
import { AppLegalLinks } from "../src/help/AppLegalLinks.tsx";
import StaticPage from "../src/legal/StaticPage.tsx";
import { DISCLAIMER, ISSUES_URL, NOT_FOUND, PRIVACY, TERMS } from "../src/legal/content.ts";

/** Minimal in-memory localStorage. */
function fakeStore(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

const ROOT = join(__dirname, "..");
const noop = () => {};

// ------------------------------------------------------------------ onboarding flag

describe("UI-151 onboarding seen-flag", () => {
  beforeEach(() => resetOnboardingMemory());

  it("is unseen on a fresh browser and seen after it is marked", () => {
    const store = fakeStore();
    expect(hasSeenOnboarding(store)).toBe(false);
    markOnboardingSeen(store);
    expect(store.data.get(ONBOARDING_KEY)).toBe("1");
    resetOnboardingMemory();
    expect(hasSeenOnboarding(store)).toBe(true);
  });

  it("ignores a stored value that is not the flag", () => {
    expect(hasSeenOnboarding(fakeStore({ [ONBOARDING_KEY]: "yes" }))).toBe(false);
  });

  it("shows once per page load when storage is unavailable", () => {
    expect(hasSeenOnboarding(null)).toBe(false);
    markOnboardingSeen(null);
    expect(hasSeenOnboarding(null)).toBe(true);
  });

  it("survives a store that throws", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(hasSeenOnboarding(broken)).toBe(false);
    markOnboardingSeen(broken);
    expect(hasSeenOnboarding(broken)).toBe(true);
  });
});

// ------------------------------------------------------------------ settings persistence

describe("UI-151 settings persistence", () => {
  it("defaults sound to on at full volume", () => {
    expect(readSoundPrefs(fakeStore())).toEqual({ on: true, volume: 1 });
    expect(DEFAULT_SOUND).toEqual({ on: true, volume: 1 });
  });

  it("saves and reads back sound on/off and volume", () => {
    const store = fakeStore();
    expect(saveSoundPrefs({ on: false, volume: 0.35 }, store)).toEqual({ on: false, volume: 0.35 });
    expect(readSoundPrefs(store)).toEqual({ on: false, volume: 0.35 });
    expect(store.data.has(SOUND_KEY)).toBe(true);
  });

  it("clamps and sanitises volume", () => {
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(0.333)).toBe(0.33);
    expect(clampVolume("loud")).toBe(1);
    expect(clampVolume(Number.NaN)).toBe(1);
    expect(readSoundPrefs(fakeStore({ [SOUND_KEY]: "not json" }))).toEqual(DEFAULT_SOUND);
    expect(readSoundPrefs(fakeStore({ [SOUND_KEY]: JSON.stringify({ on: "x", volume: 9 }) }))).toEqual({ on: true, volume: 1 });
  });

  it("follows the OS for motion until the user overrides it, and persists the override", () => {
    const store = fakeStore();
    expect(readMotionPref(store)).toBe("system");
    expect(resolveReducedMotion("system", true)).toBe(true);
    expect(resolveReducedMotion("system", false)).toBe(false);

    saveMotionPref("reduce", store);
    expect(readMotionPref(store)).toBe("reduce");
    expect(resolveReducedMotion("reduce", false)).toBe(true);

    saveMotionPref("full", store);
    expect(readMotionPref(store)).toBe("full");
    expect(resolveReducedMotion("full", true)).toBe(false);

    saveMotionPref("system", store);
    expect(store.data.has(MOTION_KEY)).toBe(false);
    expect(readMotionPref(fakeStore({ [MOTION_KEY]: "bogus" }))).toBe("system");
  });

  it("persists the skin and falls back to bio-lab", () => {
    const store = fakeStore();
    expect(readSkinPref(store)).toBe("biolab");
    saveSkinPref("fintech", store);
    expect(readSkinPref(store)).toBe("fintech");
    saveSkinPref("biolab", store);
    expect(store.data.has(SKIN_KEY)).toBe(false);
    expect(readSkinPref(fakeStore({ [SKIN_KEY]: "weird" }))).toBe("biolab");
  });
});

// ------------------------------------------------------------------ reset local data

describe("UI-151 reset local data", () => {
  it("lists exactly the keys the app owns", () => {
    expect([...APP_LOCAL_KEYS].sort()).toEqual(
      // UI-148 added the profile session and the browser-alerts flag; OPS-127 the usage-stats choice and device id;
      // RES-111 the one-tap key fallback (only used when IndexedDB is blocked).
      [
        GUEST_LABEL_KEY,
        LEGACY_SESSION_KEY,
        MOTION_KEY,
        ONBOARDING_KEY,
        SKIN_KEY,
        SOUND_KEY,
        "snacc_profile_session",
        "snacc_browser_alerts",
        "snacc_telemetry",
        "snacc_device_id",
        "snacc_one_tap",
        // UI-161: the language choice is listed too, so Settings, the privacy page and the reset all name it.
        "snacc_locale",
      ].sort(),
    );
    expect(APP_LOCAL_KEY_INFO.map((k) => k.key)).toEqual([...APP_LOCAL_KEYS]);
    for (const k of APP_LOCAL_KEYS) expect(k).toMatch(/^snacc_/);
  });

  it("removes only the listed keys and leaves the wallet's keys alone", () => {
    const store = fakeStore({
      [ONBOARDING_KEY]: "1",
      [SOUND_KEY]: "{}",
      [MOTION_KEY]: "reduce",
      [SKIN_KEY]: "fintech",
      [GUEST_LABEL_KEY]: "{}",
      "selected-wallet": "meteor-wallet",
      "privy:token": "secret",
      "near-wallet-selector:selectedWalletId": "x",
      unrelated: "keep",
    });
    const removed = resetLocalData(store);
    expect(removed.sort()).toEqual([GUEST_LABEL_KEY, MOTION_KEY, ONBOARDING_KEY, SKIN_KEY, SOUND_KEY].sort());
    expect([...store.data.keys()].sort()).toEqual(["near-wallet-selector:selectedWalletId", "privy:token", "selected-wallet", "unrelated"]);
  });

  it("does nothing without storage and clears the in-memory intro flag", () => {
    expect(resetLocalData(null)).toEqual([]);
    markOnboardingSeen(null);
    resetLocalData(null);
    expect(hasSeenOnboarding(null)).toBe(false);
  });
});

// ------------------------------------------------------------------ sound engine

describe("UI-151 sound engine", () => {
  it("scales every voice through one master gain and stays silent when muted", () => {
    const connects: { from: string; to: string }[] = [];
    const made: Record<string, number> = {};
    const node = (kind: string) => {
      made[kind] = (made[kind] ?? 0) + 1;
      const id = `${kind}${made[kind]}`;
      return {
        id,
        gain: { value: 1, setValueAtTime: noop, exponentialRampToValueAtTime: noop },
        frequency: { setValueAtTime: noop, exponentialRampToValueAtTime: noop },
        type: "sine",
        connect(to: { id?: string }) {
          connects.push({ from: id, to: to.id ?? "destination" });
        },
        start: noop,
        stop: noop,
      };
    };
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = { id: "destination" };
      createGain = () => node("gain");
      createOscillator = () => node("osc");
      resume = () => Promise.resolve();
    }
    const g = globalThis as unknown as { window?: unknown };
    const before = g.window;
    g.window = { AudioContext: FakeAudioContext };
    try {
      bioSound.enabled = true;
      bioSound.muted = true;
      bioSound.playClick();
      expect(connects).toHaveLength(0);

      bioSound.muted = false;
      bioSound.setVolume(0.4);
      bioSound.playClick();
      // gain1 is the master (created first) and goes to the destination; the click's gain goes to the master.
      expect(connects).toContainEqual({ from: "gain1", to: "destination" });
      expect(connects).toContainEqual({ from: "gain2", to: "gain1" });
      expect(connects.some((c) => c.to === "destination" && c.from !== "gain1")).toBe(false);

      bioSound.setVolume(7);
      expect(bioSound.volume).toBe(1);
      bioSound.setVolume(Number.NaN);
      expect(bioSound.volume).toBe(1);
    } finally {
      g.window = before;
      bioSound.enabled = false;
      bioSound.muted = false;
      bioSound.setVolume(1);
    }
  });
});

// ------------------------------------------------------------------ routes

describe("UI-151 routes", () => {
  it("matches /terms, /privacy and the 404 page", () => {
    expect(selectRoute("/terms")).toBe("terms");
    expect(selectRoute("/privacy/")).toBe("privacy");
    expect(selectRoute("/nothing-here")).toBe("notfound");
    expect(selectRoute("/")).toBe("landing");
    expect(selectRoute("/app/anything")).toBe("app");
  });
});

// ------------------------------------------------------------------ manifest and index.html

describe("UI-151 PWA manifest", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, "public/manifest.webmanifest"), "utf8")) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };
  const html = readFileSync(join(ROOT, "index.html"), "utf8");

  it("parses and has the fields an installable app needs", () => {
    expect(manifest.short_name).toBe("Snacc");
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.start_url).toBe("/app");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("points only at icon files that exist, with 192 and 512 sizes", () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.src.startsWith("/brand/")).toBe(true);
      expect(existsSync(join(ROOT, "public", icon.src))).toBe(true);
    }
  });

  it("is linked from index.html together with the apple touch icon, and the CSP allows it", () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toMatch(/<link rel="apple-touch-icon"[^>]*href="\/brand\/apple-touch-icon\.png"/);
    expect(html).toContain("manifest-src 'self'");
    // The rest of the CSP stays as it was.
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("nonce-c25hY2MtbmVhci1jb25uZWN0");
    expect(html).not.toMatch(/serviceWorker|service-worker/i);
  });
});

// ------------------------------------------------------------------ help content

describe("UI-151 intro and help copy", () => {
  it("has 3 to 4 intro steps that cover the required topics", () => {
    expect(INTRO_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(INTRO_STEPS.length).toBeLessThanOrEqual(4);
    const text = INTRO_STEPS.map((s) => `${s.title} ${s.body} ${s.points.join(" ")}`).join(" ").toLowerCase();
    for (const topic of ["nft", "demo", "live", "wallet", "email", "privy", "hatch", "feed", "daily", "snacked"]) {
      expect(text).toContain(topic);
    }
  });

  it("defines every glossary term the owner asked for", () => {
    const terms = GLOSSARY.map((g) => g.term.toLowerCase()).join(" | ");
    for (const t of ["vitality", "effective vitality", "hunger rate (bmr)", "atp", "organelles", "hypothermia", "goldilocks", "fever", "distressed", "starving", "adopt", "snack", "dividends"]) {
      expect(terms).toContain(t);
    }
    expect(RULES.length).toBeGreaterThan(3);
  });

  it("gives every cost row a source that names a file", () => {
    expect(COSTS.length).toBeGreaterThan(8);
    for (const c of COSTS) {
      expect(c.value.length).toBeGreaterThan(0);
      expect(c.source).toMatch(/\.(rs|ts)\b/);
    }
  });

  it("keeps the repeated contract figures in line with the frontend constants and the landing's official numbers", () => {
    expect(CONTRACT_FIGURES.VITALITY_CAP).toBe(VITALITY_MAX);
    expect(INITIAL_ATP).toBe(50);
    expect(bpsToPct(BASE_BURST_BPS)).toBe("2%");
    expect(bpsToPct(MAX_BURST_BPS)).toBe("20%");
    expect(bpsToPct(CONTRACT_FIGURES.FEVER_BURN_BPS)).toBe(OFFICIAL.frenzyBurnPct);
    expect(bpsToPct(CONTRACT_FIGURES.REBATE_BPS)).toBe(OFFICIAL.famineReliefPct);
    expect(bpsToPct(CONTRACT_FIGURES.LIQUIDATOR_BOUNTY_BPS)).toBe(OFFICIAL.lysisBountyPct);
    expect(bpsToPct(10000 - CONTRACT_FIGURES.LIQUIDATOR_BOUNTY_BPS)).toBe(OFFICIAL.lysisPantryPct);
    expect(bpsToPct(CONTRACT_FIGURES.MERGER_TAX_BPS)).toBe(OFFICIAL.mergeTaxPct);
    expect(CONTRACT_FIGURES.HOSTILE_SELLER_BPS + CONTRACT_FIGURES.HOSTILE_TREASURY_BPS).toBe(10000);
    expect(DISTRESS_MAX_EFFECTIVE_VITALITY).toBe(2000);
  });

  it("shows the code-held values in the cost rows", () => {
    const byId = Object.fromEntries(COSTS.map((c) => [c.id, c]));
    expect(byId.stake.value).toContain(DEFAULT_STAKE_NEAR);
    expect(byId.feed.value).toContain(DEFAULT_FEED_SNACC);
    expect(byId["stake-split"].value).toContain("20%");
    expect(byId.snack.value).toContain("10%");
    expect(byId.snack.value).toContain("90%");
    expect(byId.adopt.value).toContain("15%");
    expect(byId.gas.value).toContain("100 TGas");
  });
});

// ------------------------------------------------------------------ rendering

describe("UI-151 windows render", () => {
  it("renders the intro with progress, Skip and Next on the first step", () => {
    const html = renderToStaticMarkup(<OnboardingModal onDone={noop} />);
    expect(html).toContain('data-testid="onboarding-modal"');
    expect(html).toContain(`step 1 of ${INTRO_STEPS.length}`);
    expect(html).toContain("skip intro");
    expect(html).toContain(">next<");
    expect(html).not.toContain("onboarding-back");
    expect(html).toContain(INTRO_STEPS[0].title);
    expect(html).toContain('data-autofocus=""');
  });

  it("renders the Help window with the replay button and three sections", () => {
    const html = renderToStaticMarkup(<HelpModal onClose={noop} onReplay={noop} />);
    expect(html).toContain("replay intro");
    expect(html).toContain('role="tablist"');
    for (const label of ["rules", "glossary", "what things cost"]) expect(html).toContain(label);
  });

  it("renders Settings with sound, motion, skin and the exact key list", () => {
    const html = renderToStaticMarkup(<SettingsModal onClose={noop} skin="biolab" onSkin={noop} />);
    expect(html).toContain("sound effects on");
    expect(html).toContain("settings-volume");
    for (const id of ["system", "reduce", "full"]) expect(html).toContain(`settings-motion-${id}`);
    expect(html).toContain("bio-lab");
    expect(html).toContain("fintech");
    for (const key of APP_LOCAL_KEYS) expect(html).toContain(key);
    expect(html).toContain("reset local data");
    expect(html).toContain("selected-wallet");
  });

  it("adds help and settings to the toolbar and the tools sheet", () => {
    expect(TOOLS.map((t) => t.id)).toEqual(expect.arrayContaining(["help", "settings"]));
    const html = renderToStaticMarkup(
      <ToolsToolbar skin="biolab" panelsOpen={false} onTogglePanels={noop} onOpen={noop} guestLabel={null} />,
    );
    expect(html).toContain(">help<");
    expect(html).toContain(">settings<");
  });

  it("links terms and privacy from the app footer", () => {
    const html = renderToStaticMarkup(<AppLegalLinks />);
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("no monetary value");
  });
});

// ------------------------------------------------------------------ legal pages and 404

describe("UI-151 legal pages", () => {
  const terms = JSON.stringify(TERMS).toLowerCase();
  const privacy = JSON.stringify(PRIVACY).toLowerCase();

  it("states the testnet-only, no-value, no-profit, experimental disclaimer", () => {
    expect(DISCLAIMER).toBe("Testnet only. $SNACC has no monetary value. No promise of profit. Snacc is an experimental game.");
    for (const phrase of ["testnet only", "no monetary value", "no promise of profit", "experimental game"]) {
      expect(terms).toContain(phrase);
    }
  });

  it("says what data is touched, and that the Supabase profile database is live (UI-148)", () => {
    expect(privacy).toContain("public");
    expect(privacy).toContain("privy");
    expect(privacy).toContain("supabase");
    expect(privacy).not.toMatch(/planned/);
    expect(privacy).toMatch(/is live/);
    for (const stored of ["near account id", "username", "bio", "avatar", "transaction hashes", "notifications", "delete my profile", "github issues"]) {
      expect(privacy).toContain(stored);
    }
    for (const key of APP_LOCAL_KEYS) expect(privacy).toContain(key);
  });

  it("points to GitHub issues for contact", () => {
    expect(ISSUES_URL).toMatch(/^https:\/\/github\.com\/Snacc-near\/.+\/issues$/);
    for (const page of ["terms", "privacy"] as const) {
      const html = renderToStaticMarkup(<StaticPage page={page} />);
      expect(html).toContain(ISSUES_URL);
      expect(html).toContain("no monetary value");
    }
  });

  it("renders the terms and privacy pages with navigation", () => {
    const t = renderToStaticMarkup(<StaticPage page="terms" />);
    const p = renderToStaticMarkup(<StaticPage page="privacy" />);
    expect(t).toContain("Terms of use");
    expect(p).toContain("Privacy");
    for (const html of [t, p]) {
      expect(html).toContain('href="/"');
      expect(html).toContain('href="/app"');
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/privacy"');
    }
  });

  it("renders the 404 page with links to / and /app", () => {
    const html = renderToStaticMarkup(<StaticPage page="notfound" />);
    expect(html).toContain(NOT_FOUND.heading);
    expect(html).toContain("404");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/app"');
  });
});

describe("UI-151 landing edits", () => {
  it("links terms and privacy from the landing footer", async () => {
    const { SiteFooter } = await import("../src/landing/SiteFooter.tsx");
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
  });

  it("no longer says that nothing asks you to sign", () => {
    const src = readFileSync(join(ROOT, "src/landing/Finale.tsx"), "utf8");
    expect(src).not.toContain("nothing here asks you to sign");
    // UI-161: the FAQ copy lives in the dictionary now, so the pinned sentence is checked there (English).
    expect(tEn("landing.faq.wallet.a")).toContain("In live testnet mode you sign testnet transactions yourself");
    expect(tEn("landing.faq.wallet.a")).not.toContain("nothing here asks you to sign");
  });
});

// ------------------------------------------------------------------ wording rules

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

describe("UI-151 wording", () => {
  const files = [...listFiles(join(ROOT, "src/help")), ...listFiles(join(ROOT, "src/legal")), ...listFiles(join(ROOT, "src/prefs"))].filter((f) =>
    /\.(ts|tsx|css)$/.test(f),
  );

  it("avoids the words the project does not use", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8").toLowerCase();
      for (const word of ["gamefi", "investment", "yield"]) {
        expect(text, `${file} contains "${word}"`).not.toContain(word);
      }
    }
  });
});
