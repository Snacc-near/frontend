/**
 * UI-161 phase B4: How to play, the first-run intro, Settings, the one-tap section, the one-tap notices
 * and the legal-page note, in Indonesian, with the English left unchanged. Components are rendered with
 * `renderToStaticMarkup` under `<I18nProvider locale=...>`; the one-tap controller text reads the global
 * language, which these tests set through `setLocale` with a fake store and put back afterwards.
 */
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOG, flatten, tEn } from "../src/i18n/catalog.ts";
import { placeholderNames } from "../src/i18n/format.ts";
import { reloadLocale, setLocale } from "../src/i18n/locale.ts";
import { I18nProvider } from "../src/i18n/react.tsx";
import type { Locale } from "../src/i18n/types.ts";
import { CONTRACT_ID } from "../src/chain/actions.ts";
import {
  FALLBACK_NOTICE,
  NOT_CONFIRMED_MESSAGE,
  ONE_TAP_ALLOWANCE_NEAR,
  ONE_TAP_METHODS,
  PAYS_OTHER_METHODS,
  WALLET_ONLY_METHODS,
  fallbackNotice,
  notConfirmedMessage,
  type FallbackReason,
} from "../src/chain/oneTap.ts";
import { NO_ONE_TAP, OneTapContext, type OneTapHandle, type OneTapSnapshot } from "../src/chain/oneTapSession.ts";
import { DISCONNECTED_WALLET, WalletContext, type WalletApi } from "../src/chain/wallet.tsx";
import { CONTRACT_FIGURES, bpsToPct, costs, glossary, introSteps, rules } from "../src/help/content.ts";
import { AppLegalLinks } from "../src/help/AppLegalLinks.tsx";
import { HelpModal } from "../src/help/HelpModal.tsx";
import { OnboardingModal } from "../src/help/OnboardingModal.tsx";
import { OneTapSettings } from "../src/help/OneTapSettings.tsx";
import { SettingsModal } from "../src/help/SettingsModal.tsx";
import StaticPage from "../src/legal/StaticPage.tsx";
import { PRIVACY } from "../src/legal/content.ts";
import { APP_LOCAL_KEYS, APP_LOCAL_KEY_INFO } from "../src/prefs/prefs.ts";

const EN = flatten(CATALOG.en);
const ID = flatten(CATALOG.id);
const NEW_NAMESPACES = /^(help|onboarding|onetap|settings)\./;

const noop = () => {};
const inLocale = (locale: Locale, node: ReactElement) => renderToStaticMarkup(<I18nProvider locale={locale}>{node}</I18nProvider>);
const inId = (node: ReactElement) => inLocale("id", node);
const inEn = (node: ReactElement) => inLocale("en", node);

const fakeStore = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};
afterEach(() => {
  setLocale("en", fakeStore());
  reloadLocale(fakeStore(), undefined);
});

const ALICE = "alice.testnet";
const connected: WalletApi = { ...DISCONNECTED_WALLET, status: "connected", accountId: ALICE, walletName: "Meteor Wallet" };
const handleWith = (snapshot: OneTapSnapshot): OneTapHandle => ({ ...NO_ONE_TAP, getSnapshot: () => snapshot });
const withProviders = (snapshot: OneTapSnapshot, node: ReactNode) => (
  <WalletContext.Provider value={connected}>
    <OneTapContext.Provider value={handleWith(snapshot)}>{node}</OneTapContext.Provider>
  </WalletContext.Provider>
);
const OFF: OneTapSnapshot = { accountId: ALICE, status: { kind: "off" }, busy: null, error: null, message: null };
const ON: OneTapSnapshot = {
  accountId: ALICE,
  status: { kind: "on", publicKey: "ed25519:11111111111111111111111111111111", storage: "indexeddb", allowanceYocto: "200000000000000000000000", chain: "ok", outdated: false, createdAt: 1 },
  busy: null,
  error: null,
  message: null,
};

// ------------------------------------------------------------------ dictionaries

describe("UI-161 B4 dictionaries", () => {
  it("has the same keys and the same {placeholders} in English and Indonesian", () => {
    const keys = Object.keys(EN).filter((k) => NEW_NAMESPACES.test(k));
    expect(keys.length).toBeGreaterThan(200);
    expect(Object.keys(ID).filter((k) => NEW_NAMESPACES.test(k)).sort()).toEqual([...keys].sort());
    for (const key of keys) expect(placeholderNames(ID[key]!), key).toEqual(placeholderNames(EN[key]!));
  });

  it("translates the help copy: no Indonesian line is a copy of the English one (names and units aside)", () => {
    const SAME = /^(\{[a-zA-Z]+\}|[\p{N}\s·+×>‑<:./,%$()↗✓-]|mK|NEAR|ATP|Snacc|The Pantry|Epoch|testnet|local|CrucibleTemp|\$SNACC|Gas|Aether|NFT)+$/u;
    const same = Object.keys(EN)
      .filter((k) => /^(help|onboarding|onetap)\./.test(k) && EN[k] === ID[k])
      .filter((k) => !SAME.test(EN[k]!));
    expect(same).toEqual([]);
  });

  it("says the testnet token has no money value, in both languages", () => {
    for (const key of ["help.legal.line", "help.costs.note", "help.rules.modes.body", "onboarding.steps.what.p2"]) {
      expect(EN[key], key).toMatch(/no (monetary|money) value/);
      expect(ID[key], key).toContain("tanpa nilai uang");
    }
  });

  it("keeps the Indonesian description of every local key in step with the English one", () => {
    for (const k of APP_LOCAL_KEY_INFO) expect(EN[k.label], k.key).toBe(k.what);
    expect(APP_LOCAL_KEY_INFO.map((k) => k.label).sort()).toEqual(Object.keys(EN).filter((k) => k.startsWith("settings.keys.")).sort());
  });
});

// ------------------------------------------------------------------ how to play

describe("UI-161 B4 How to play", () => {
  it("builds every record in both languages with the figures filled in and no key or placeholder left over", () => {
    for (const locale of ["en", "id"] as const) {
      const texts = [
        ...introSteps(locale).flatMap((s) => [s.topic, s.title, s.body, ...s.points]),
        ...rules(locale).flatMap((r) => [r.title, r.body]),
        ...glossary(locale).flatMap((g) => [g.term, g.body]),
        ...costs(locale).flatMap((c) => [c.item, c.value, c.note]),
      ];
      expect(texts.length).toBe(4 * 6 + 7 * 2 + 17 * 2 + 14 * 3);
      for (const text of texts) {
        expect(text, locale).not.toMatch(/\{\w+\}/);
        expect(text, locale).not.toMatch(/^(help|onboarding)\./);
        expect(text.trim().length, locale).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the ids and the source column the same in both languages", () => {
    expect(costs("id").map((c) => [c.id, c.source])).toEqual(costs("en").map((c) => [c.id, c.source]));
    expect(rules("id").map((r) => r.id)).toEqual(rules("en").map((r) => r.id));
    expect(glossary("id").map((g) => g.id)).toEqual(glossary("en").map((g) => g.id));
    expect(introSteps("id").map((s) => [s.id, s.icon])).toEqual(introSteps("en").map((s) => [s.id, s.icon]));
  });

  it("computes the figures from the constants in Indonesian too", () => {
    const byId = Object.fromEntries(costs("id").map((c) => [c.id, c]));
    expect(byId.snack.value).toContain(bpsToPct(CONTRACT_FIGURES.LIQUIDATOR_BOUNTY_BPS));
    expect(byId.snack.value).toContain("90%");
    expect(byId.adopt.value).toContain("15%");
    expect(byId["stake-split"].value).toContain("20%");
    expect(byId.gas.value).toContain("100 TGas");
    expect(byId.hunger.note).toContain(`${CONTRACT_FIGURES.INITIAL_VITALITY / CONTRACT_FIGURES.BMR_EXTRACTOR_PER_HOUR} jam`);
    expect(rules("id").find((r) => r.id === "hatch")!.body).toContain("vitalitas 85%");
    expect(introSteps("id")[3]!.points[0]).toContain("20%");
    expect(introSteps("id")[3]!.points[1]).toContain("10%");
  });

  it("renders the Help window in Indonesian, and in English as before", () => {
    const id = inId(<HelpModal onClose={noop} onReplay={noop} />);
    expect(id).toContain("Cara main");
    expect(id).toContain("putar ulang pengantar");
    for (const label of ["aturan", "glosarium", "biaya"]) expect(id).toContain(label);
    expect(id).toContain("Putarannya");
    expect(id).not.toContain("How to play");
    expect(id).not.toContain("replay intro");
    const en = inEn(<HelpModal onClose={noop} onReplay={noop} />);
    expect(en).toContain("How to play");
    expect(en).toContain("replay intro");
    expect(en).toContain("The loop");
    expect(en).toContain("what things cost");
    expect(en).not.toContain("Cara main");
  });

  it("renders the first intro step in Indonesian, and in English as before", () => {
    const id = inId(<OnboardingModal onDone={noop} />);
    expect(id).toContain("Kenalan dengan Snacc-mu");
    expect(id).toContain("langkah 1 dari 4");
    expect(id).toContain("lewati pengantar");
    expect(id).toContain(">lanjut<");
    expect(id).toContain("tanpa nilai uang");
    expect(id).not.toContain("Meet your Snacc");
    const en = inEn(<OnboardingModal onDone={noop} />);
    expect(en).toContain("Meet your Snacc");
    expect(en).toContain("step 1 of 4");
    expect(en).toContain("skip intro");
    expect(en).toContain(">next<");
    expect(en).not.toContain("langkah");
  });

  it("renders the legal line at the foot of the game in both languages", () => {
    const id = inId(<AppLegalLinks />);
    expect(id).toContain("hanya testnet · $snacc tanpa nilai uang");
    expect(id).toContain("ketentuan");
    expect(id).toContain("privasi");
    expect(id).toContain('href="/terms"');
    const en = inEn(<AppLegalLinks />);
    expect(en).toContain("testnet only · $snacc has no monetary value");
    expect(en).toContain(">terms<");
  });
});

// ------------------------------------------------------------------ settings

describe("UI-161 B4 Settings", () => {
  const settings = <SettingsModal onClose={noop} skin="biolab" onSkin={noop} />;

  it("renders the sections in Indonesian", () => {
    const id = inId(settings);
    expect(id).toContain("Pengaturan");
    expect(id).toContain("Suara");
    expect(id).toContain("efek suara nyala");
    expect(id).toContain("volume 100%");
    expect(id).toContain("Kurangi gerak");
    for (const label of ["ikuti sistem", "kurangi", "gerak penuh"]) expect(id).toContain(label);
    expect(id).toContain("Istilah");
    expect(id).toContain("Data lokal");
    expect(id).toContain("<strong>Reset data lokal</strong>");
    expect(id).toContain("reset data lokal");
    expect(id).toContain("hanya tersimpan di browser ini");
    expect(id).toContain("<code>selected-wallet</code>");
    expect(id).toContain("Main satu ketuk");
    expect(id).not.toContain("sound effects");
    expect(id).not.toContain("Reset local data");
  });

  it("lists every local key, snacc_locale included, with the description in the current language", () => {
    const id = inId(settings);
    for (const key of APP_LOCAL_KEYS) expect(id).toContain(`<code>${key}</code>`);
    expect(APP_LOCAL_KEYS).toContain("snacc_locale");
    expect(id).toContain("<code>snacc_locale</code> · pilihan bahasamu (English atau Bahasa Indonesia)");
    expect(id).toContain("pengantar sudah ditampilkan");
    const en = inEn(settings);
    expect(en).toContain("<code>snacc_locale</code> · your language choice (English or Bahasa Indonesia)");
    expect(en).toContain("the intro has been shown");
  });

  it("leaves the English Settings window as it was", () => {
    const en = inEn(settings);
    for (const text of ["Settings", "Sound", "sound effects on", "volume 100%", "Reduce motion", "follow system", "full motion", "Wording", "Local data", "reset local data", "saved in this browser only"]) {
      expect(en).toContain(text);
    }
    expect(en).toContain("<strong>Reset local data</strong> clears exactly these keys in this browser");
    expect(en).not.toContain("Pengaturan");
  });

  it("names snacc_locale on the privacy page, which stays English", () => {
    const privacy = JSON.stringify(PRIVACY);
    expect(privacy).toContain("snacc_locale");
    expect(privacy).toContain("your language choice");
  });
});

// ------------------------------------------------------------------ one-tap

describe("UI-161 B4 one-tap play", () => {
  it("renders the section in Indonesian with the same precise claims: one key, the allowance, the contract, deposit-free only", () => {
    const html = inId(withProviders(OFF, <OneTapSettings />));
    expect(html).toContain("Main satu ketuk");
    expect(html).toContain("tanpa deposit");
    expect(html).toContain(`Aksi satu ketuk (${ONE_TAP_METHODS.length})`);
    for (const m of ONE_TAP_METHODS) expect(html).toContain(`<code>${m}</code>`);
    for (const m of WALLET_ONLY_METHODS) expect(html).toContain(`<code>${m}</code>`);
    for (const m of PAYS_OTHER_METHODS) expect(html).toContain(`<code>${m}</code>`);
    expect(html).toContain(`paling banyak ${ONE_TAP_ALLOWANCE_NEAR} NEAR untuk gas`);
    expect(html).toContain(`<code>${CONTRACT_ID}</code>`);
    expect(html).toContain("tidak bisa melampirkan NEAR");
    expect(html).toContain("kunci terbatas");
    expect(html).toContain("tidak pernah dikirim ke mana pun");
    expect(html).toContain("Memutus dompet tidak menghapus kuncinya");
    expect(html).toContain("belum dicoba di semua dompet");
    expect(html).toContain("Tetap lewat dompet");
    expect(html).toContain("setiap panggilan pasar");
    expect(html).toContain('data-testid="one-tap-enable"');
    expect(html).toContain("nyalakan main satu ketuk (1 popup dompet)");
    expect(html).toContain("Main satu ketuk mati untuk alice.testnet");
    expect(html).not.toContain("One-tap play");
  });

  it("renders the on state in Indonesian", () => {
    const html = inId(withProviders(ON, <OneTapSettings />));
    expect(html).toContain("<strong>Aktif untuk alice.testnet.</strong>");
    expect(html).toContain("jatah tersisa 0.2 NEAR");
    expect(html).toContain("tidak bisa diekspor");
    expect(html).toContain("matikan (hapus kunci, 1 popup dompet)");
    expect(html).toContain("lupakan di perangkat ini");
    const outdated = inId(withProviders({ ...ON, status: { ...ON.status, outdated: true } as OneTapSnapshot["status"] }, <OneTapSettings />));
    expect(outdated).toContain("ganti kuncinya (2 popup dompet)");
    expect(outdated).toContain('data-testid="one-tap-outdated"');
    const unsupported = inId(withProviders({ ...OFF, status: { kind: "unsupported", reason: "tanpa Ed25519." } }, <OneTapSettings />));
    expect(unsupported).toContain("Main satu ketuk tidak tersedia di browser ini: tanpa Ed25519.");
  });

  it("leaves the English section as it was", () => {
    const html = inEn(withProviders(ON, <OneTapSettings />));
    expect(html).toContain("One-tap play");
    expect(html).toContain("One-tap actions (");
    expect(html).toContain("at most 0.25 NEAR of gas");
    expect(html).toContain("allowance left 0.2 NEAR");
    expect(html).toContain("turn off (delete the key, 1 wallet popup)");
    expect(html).not.toContain("Main satu ketuk");
  });

  it("keeps the English fallback notices as data and follows the language for the one the player sees", () => {
    const reasons = Object.keys(FALLBACK_NOTICE) as FallbackReason[];
    expect(reasons).toHaveLength(11);
    expect(FALLBACK_NOTICE["key-missing"]).toBe("One-tap key not found on your account, so your wallet signs this one.");
    expect(FALLBACK_NOTICE.deposit).toBe("This action attaches NEAR, so your wallet signs it.");
    expect(NOT_CONFIRMED_MESSAGE).toBe("One-tap play sent this transaction, but testnet did not confirm it in time. Check the explorer link before trying again.");
    for (const r of reasons) expect(fallbackNotice(r)).toBe(FALLBACK_NOTICE[r]);
    expect(notConfirmedMessage()).toBe(NOT_CONFIRMED_MESSAGE);
    setLocale("id", fakeStore());
    for (const r of reasons) {
      expect(fallbackNotice(r)).not.toBe(FALLBACK_NOTICE[r]);
      expect(fallbackNotice(r)).toMatch(/dompetmu/);
    }
    expect(fallbackNotice("allowance")).toContain("Jatah satu ketuk sudah habis");
    expect(notConfirmedMessage()).toContain("testnet tidak mengonfirmasinya tepat waktu");
    // The English record does not move with the language.
    expect(FALLBACK_NOTICE.allowance).toBe(tEn("onetap.fallback.allowance"));
  });

  it("says no wallet is connected in the language of the moment, with the English text as the raw text", async () => {
    const en = await NO_ONE_TAP.enable();
    expect(!en.ok && en.message).toBe("Connect a wallet first.");
    setLocale("id", fakeStore());
    const id = await NO_ONE_TAP.enable();
    expect(!id.ok && id.message).toBe("Hubungkan dompet dulu.");
    expect(!id.ok && id.raw).toBe("Connect a wallet first.");
  });
});

// ------------------------------------------------------------------ legal pages

describe("UI-161 B4 legal pages", () => {
  const NOTE = "Halaman ini hanya tersedia dalam bahasa Inggris.";

  it("shows the Indonesian note on Terms and Privacy when the language is id, and leaves the text English", () => {
    for (const page of ["terms", "privacy"] as const) {
      const html = inId(<StaticPage page={page} />);
      expect(html).toContain(NOTE);
      expect(html).toContain('data-testid="legal-language-note"');
      expect(html).toContain('lang="id"');
      expect(html).toContain("no monetary value");
      expect(html).toContain(page === "terms" ? "Terms of use" : "Privacy");
    }
  });

  it("does not show the note in English, and not on the 404 page", () => {
    for (const page of ["terms", "privacy"] as const) {
      const html = inEn(<StaticPage page={page} />);
      expect(html).not.toContain(NOTE);
      expect(html).not.toContain("legal-language-note");
      expect(html).not.toContain("This page is only available in English.");
    }
    expect(inId(<StaticPage page="notfound" />)).not.toContain(NOTE);
  });
});
