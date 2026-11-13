/**
 * UI-161 (phase A): the language layer and the translated landing page. Runs in node (no DOM), so
 * components are checked through server-rendered markup (`I18nProvider locale="id"` pins the language,
 * because effects do not run there) and the locale module through small fakes for storage, navigator
 * and `document`.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { t, tEn } from "../src/i18n/catalog.ts";
import { interpolate, placeholderNames, splitTemplate } from "../src/i18n/format.ts";
import {
  LOCALE_KEY,
  detectLocale,
  getLocale,
  getServerLocale,
  readSavedLocale,
  reloadLocale,
  resolveLocale,
  setLocale,
  subscribeLocale,
} from "../src/i18n/locale.ts";
import { I18nProvider, richFor } from "../src/i18n/react.tsx";
import { LanguageToggle } from "../src/i18n/LanguageToggle.tsx";
import { LanguageSettings } from "../src/help/LanguageSettings.tsx";
import { APP_LOCAL_KEYS, LOCALE_KEY as PREFS_LOCALE_KEY, resetLocalData } from "../src/prefs/prefs.ts";
import { Faq } from "../src/landing/Finale.tsx";
import { HeroBlock } from "../src/landing/Hero.tsx";
import { LiveLab } from "../src/landing/LiveLab.tsx";
import { SiteFooter, FOOTER_COLUMNS, FOOTER_DISCLAIMER } from "../src/landing/SiteFooter.tsx";
import { SiteHeader } from "../src/landing/SiteHeader.tsx";
import { StatusBar, statusText } from "../src/landing/StatusBar.tsx";
import { ChapterRail } from "../src/landing/ChapterRail.tsx";
import { AppetiteDemo, ColonyDemo, EnclaveDemo, FeedDemo, MetabolismDemo } from "../src/landing/demos.tsx";
import { liveChipText, zoneFromTemp, zoneLabel, zoneRate } from "../src/landing/lib/live.ts";
import type { LiveState } from "../src/landing/useLive.ts";
import type { ReactElement } from "react";

const BASE: LiveState = { status: "loading", macro: null, alive: null, strains: null, events: null, last: null, updatedAt: null };

function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const inId = (el: ReactElement) => renderToStaticMarkup(<I18nProvider locale="id">{el}</I18nProvider>);
const inEn = (el: ReactElement) => renderToStaticMarkup(<I18nProvider locale="en">{el}</I18nProvider>);

// ------------------------------------------------------------------ templates and lookup

describe("UI-161 templates", () => {
  it("fills {name} placeholders and leaves unknown ones as written", () => {
    expect(interpolate("one bite = {bite} $SNACC", { bite: 10 })).toBe("one bite = 10 $SNACC");
    expect(interpolate("{a} and {b}", { a: "x" })).toBe("x and {b}");
    expect(interpolate("no placeholders")).toBe("no placeholders");
  });

  it("splits a template into text and placeholders in order", () => {
    expect(splitTemplate("a {x} b {y}")).toEqual(["a ", { name: "x" }, " b ", { name: "y" }]);
    expect(placeholderNames("{b} {a} {b}")).toEqual(["a", "b"]);
  });

  it("looks a key up per language and falls back to the key itself for an unknown one", () => {
    expect(t("en", "landing.hero.cta")).toBe("Enter the lab");
    expect(t("id", "landing.hero.cta")).toBe("Masuk lab");
    expect(t("id", "demos.feed.note", { bite: 10, burn: "3.5%", sim: "x" })).toContain("10 $SNACC");
    expect(t("en", "no.such.key" as never)).toBe("no.such.key");
  });

  it("rich() puts elements into placeholders", () => {
    const html = renderToStaticMarkup(<>{richFor("id")("landing.live.zone", { zone: <strong>Pesta Makan</strong>, rate: "3.5% dibakar" })}</>);
    expect(html).toBe("Koloni sedang berada di <strong>Pesta Makan</strong> sekarang (3.5% dibakar).");
  });
});

// ------------------------------------------------------------------ locale resolution

describe("UI-161 locale resolution", () => {
  it("the saved choice wins over the browser language", () => {
    expect(resolveLocale(fakeStore({ [LOCALE_KEY]: "en" }), { language: "id-ID" })).toBe("en");
    expect(resolveLocale(fakeStore({ [LOCALE_KEY]: "id" }), { language: "en-US" })).toBe("id");
  });

  it("an Indonesian browser gets id, any other gets en", () => {
    for (const tag of ["id", "id-ID", "id_ID", "ID", "in-ID"]) expect(resolveLocale(fakeStore(), { language: tag })).toBe("id");
    for (const tag of ["en-US", "en", "ms-MY", "ind", "de", ""]) expect(resolveLocale(fakeStore(), { language: tag })).toBe("en");
    expect(detectLocale({ languages: ["id-ID", "en"] })).toBe("id");
  });

  it("ignores a saved value that is not a language", () => {
    expect(readSavedLocale(fakeStore({ [LOCALE_KEY]: "fr" }))).toBeNull();
    expect(resolveLocale(fakeStore({ [LOCALE_KEY]: "fr" }), { language: "id-ID" })).toBe("id");
  });

  it("is English without a browser: no navigator, no storage, and in tests and server rendering", () => {
    expect(resolveLocale(null, undefined)).toBe("en");
    expect(detectLocale(undefined)).toBe("en");
    expect(getServerLocale()).toBe("en");
    // Node has its own global navigator that follows the machine's language; it must not be read here.
    expect(resolveLocale()).toBe("en");
  });
});

describe("UI-161 switching the language", () => {
  const g = globalThis as unknown as { document?: unknown };
  const before = g.document;
  afterEach(() => {
    g.document = before;
    reloadLocale(fakeStore(), undefined);
  });

  it("saves the choice, updates <html lang> and tells subscribers once per change", () => {
    const doc = { documentElement: { lang: "en" } };
    g.document = doc;
    const store = fakeStore();
    reloadLocale(store, undefined);
    expect(getLocale()).toBe("en");

    let calls = 0;
    const off = subscribeLocale(() => calls++);
    setLocale("id", store);
    expect(getLocale()).toBe("id");
    expect(doc.documentElement.lang).toBe("id");
    expect(store.data.get(LOCALE_KEY)).toBe("id");
    expect(calls).toBe(1);

    setLocale("id", store);
    expect(calls).toBe(1);

    setLocale("en", store);
    expect(doc.documentElement.lang).toBe("en");
    expect(store.data.get(LOCALE_KEY)).toBe("en");
    expect(calls).toBe(2);
    off();
    setLocale("id", store);
    expect(calls).toBe(2);
  });

  it("an explicit English choice sticks even on an Indonesian browser", () => {
    const store = fakeStore();
    setLocale("en", store);
    expect(resolveLocale(store, { language: "id-ID" })).toBe("en");
  });

  it("reloadLocale picks the saved choice up again", () => {
    expect(reloadLocale(fakeStore({ [LOCALE_KEY]: "id" }), undefined)).toBe("id");
    expect(getLocale()).toBe("id");
  });
});

describe("UI-161 saved key", () => {
  it("is registered in prefs and cleared by Reset local data, wallet keys untouched", () => {
    expect(PREFS_LOCALE_KEY).toBe("snacc_locale");
    expect(LOCALE_KEY).toBe("snacc_locale");
    const store = fakeStore({ [LOCALE_KEY]: "id", "selected-wallet": "meteor-wallet", unrelated: "keep" });
    expect(resetLocalData(store)).toEqual([LOCALE_KEY]);
    expect([...store.data.keys()].sort()).toEqual(["selected-wallet", "unrelated"]);
    // Pinned by the UI-151 tests together with the privacy copy; see the note in prefs.ts.
    expect(APP_LOCAL_KEYS).not.toContain(LOCALE_KEY);
  });
});

// ------------------------------------------------------------------ the picker

describe("UI-161 language picker", () => {
  it("the header toggle has two labelled buttons and marks the current language pressed", () => {
    const en = inEn(<LanguageToggle label="Language" />);
    expect(en).toContain('role="group"');
    expect(en).toContain('aria-label="Language"');
    expect(en).toMatch(/<button[^>]*aria-pressed="true"[^>]*data-testid="lang-toggle-en"/);
    expect(en).toMatch(/<button[^>]*aria-pressed="false"[^>]*data-testid="lang-toggle-id"/);
    expect(en).toContain('aria-label="English (EN)"');
    expect(en).toContain('aria-label="Bahasa Indonesia (ID)"');
    const id = inId(<LanguageToggle label="Bahasa" />);
    expect(id).toMatch(/<button[^>]*aria-pressed="false"[^>]*data-testid="lang-toggle-en"/);
    expect(id).toMatch(/<button[^>]*aria-pressed="true"[^>]*data-testid="lang-toggle-id"/);
  });

  it("the toggle sits in the landing header", () => {
    const html = inEn(<SiteHeader live="live" />);
    expect(html).toContain('data-testid="lang-toggle"');
    expect(html).toContain("testnet live");
  });

  it("the Settings section is headed Language / Bahasa in both languages and names the saved key", () => {
    for (const html of [inEn(<LanguageSettings />), inId(<LanguageSettings />)]) {
      expect(html).toContain("Language / Bahasa");
      expect(html).toContain('data-testid="settings-language-en"');
      expect(html).toContain('data-testid="settings-language-id"');
      expect(html).toContain("<code>snacc_locale</code>");
    }
    expect(inId(<LanguageSettings />)).toMatch(/aria-pressed="true"[^>]*data-testid="settings-language-id"/);
    expect(inId(<LanguageSettings />)).toContain("Bahasa Indonesia");
  });
});

// ------------------------------------------------------------------ the landing in Indonesian

describe("UI-161 landing in Indonesian", () => {
  it("the header, hero and footer speak Indonesian when the language is id", () => {
    const header = inId(<SiteHeader live="offline" />);
    expect(header).toContain("Buka app");
    expect(header).toContain("Cerita");
    expect(header).toContain("Efek suara");
    expect(header).toContain("Snacc, kembali ke atas");
    expect(header).not.toContain("Launch app");

    const hero = inId(<HeroBlock live={BASE} finePointer={true} />);
    expect(hero).toContain("Masuk lab");
    expect(hero).toContain("Gulir");
    expect(hero).toContain("fig-01.inkubator · NEAR testnet");
    expect(hero).toContain("arahkan lensa ke cawan petri");
    expect(hero).toContain("Membaca koloni…");
    expect(hero).toContain(">memecoin<");
    expect(hero).not.toContain("Enter the lab");

    const footer = inId(<SiteFooter />);
    expect(footer).toContain("Hanya testnet. $SNACC tanpa nilai uang. Bukan saran keuangan.");
    expect(footer).toContain("Syarat");
    expect(footer).toContain("Privasi");
    expect(footer).toContain('href="/terms"');
    expect(footer).toContain("snacc-v001.testnet");
  });

  it("stays English by default and when the language is en", () => {
    expect(renderToStaticMarkup(<SiteHeader live="live" />)).toContain("Launch app");
    expect(inEn(<HeroBlock live={BASE} finePointer={false} />)).toContain("Enter the lab");
    expect(renderToStaticMarkup(<SiteFooter />)).toContain(FOOTER_DISCLAIMER);
  });

  it("the live section, status bar, rail and FAQ follow the language", () => {
    expect(inId(<LiveLab live={BASE} />)).toContain("menyambung… · NEAR testnet");
    expect(inEn(<LiveLab live={BASE} />)).toContain("connecting… · NEAR testnet");

    const bar = inId(<StatusBar active="ch-01" live={BASE} />);
    expect(bar).toContain('<a href="#ch-01" aria-current="true">Masuk</a>');
    expect(bar).toContain("Bagian");
    expect(bar).toContain("menyambung…");

    expect(inId(<ChapterRail active="ch-02" />)).toContain('aria-label="Bab 2: organisme"');
    expect(inEn(<ChapterRail active="ch-02" />)).toContain('aria-label="Chapter 2: organism"');

    const faq = inId(<Faq />);
    expect(faq).toContain('Pertanyaan dari depan <em class="fd-accent">pintu lab</em>.');
    expect(faq).toContain("Apa itu $SNACC?");
    expect(faq).toContain("tanpa nilai uang");
    expect(faq).toContain('id="faq"');
    expect(faq).toContain("snacc-v001.testnet</a>");
    expect(faq).toContain("10% untuk si pemburu");
  });

  it("the demos follow the language", () => {
    expect(inId(<FeedDemo />)).toContain("Beri makan");
    expect(inId(<FeedDemo />)).toContain("Pesta Makan");
    expect(inId(<FeedDemo />)).toContain("simulasi");
    expect(inEn(<FeedDemo />)).toContain("Feeding Frenzy");
    expect(inId(<MetabolismDemo />)).toContain("Tahap produksi");
    expect(inId(<ColonyDemo />)).toContain("Pingsan · terbuka untuk siapa saja");
    expect(inId(<ColonyDemo />)).toContain("90% ke The Pantry");
    expect(inId(<AppetiteDemo live={BASE} />)).toContain("Meter Selera (CrucibleTemp)");
    expect(inId(<EnclaveDemo />)).toContain("Tahan untuk kirim rencana");
    expect(inId(<EnclaveDemo />)).toContain("ilustrasi");
  });

  it("keeps names, contract methods and numbers as they are", () => {
    const rows = inId(<LiveLab live={BASE} />);
    for (const keep of ["CrucibleTemp", "The Pantry", "nft_tokens", "apply_tee_mutation_zero_trust", "ft_burn", "9bTCp"]) expect(rows).toContain(keep);
    expect(t("id", "landing.chapters.ch03.line")).toContain("3.5%");
    expect(t("id", "landing.chapters.ch03.line")).toContain("2%");
  });
});

// ------------------------------------------------------------------ helpers kept English for tests and callers

describe("UI-161 English helpers", () => {
  it("zone, chip and status helpers keep their English output by default and translate on request", () => {
    expect(zoneFromTemp(1037).label).toBe("Feeding Frenzy");
    expect(zoneFromTemp(1037).rate).toBe("3.5% burn");
    expect(zoneLabel((k, v) => t("id", k, v), "famine")).toBe("Bantuan Paceklik");
    expect(zoneRate((k, v) => t("id", k, v), "frenzy")).toBe("3.5% dibakar");
    expect(liveChipText("offline", "snacc-v001.testnet")).toBe("offline · NEAR testnet · snacc-v001.testnet");
    expect(liveChipText("live", "snacc-v001.testnet", (k, v) => t("id", k, v))).toBe("live · NEAR testnet · snacc-v001.testnet");
    expect(statusText({ status: "offline", macro: null })).toBe("offline");
    expect(statusText({ status: "loading", macro: null }, (k, v) => t("id", k, v))).toBe("menyambung…");
    expect(FOOTER_DISCLAIMER).toBe(tEn("landing.footer.disclaimer"));
    expect(FOOTER_COLUMNS.map((c) => c.title)).toEqual(["Product", "Build", "Proof", "NEAR"]);
  });
});
