/**
 * UI-161 phase B5: the account sections of Settings, the push toggle, the email-login popup, the public pages
 * (`/p/<account>`, `/snacc/<id>`), the static-page frame and the 404 page, the strain history lines and the
 * countdown, in Indonesian, with the English left unchanged. Components are rendered with
 * `renderToStaticMarkup` under `<I18nProvider locale=...>`. The signed payload of the email-login popup is
 * checked to be the same object, read-only, in both languages.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOG, flatten, tEn, translator } from "../src/i18n/catalog.ts";
import { reloadLocale, setLocale } from "../src/i18n/locale.ts";
import { I18nProvider } from "../src/i18n/react.tsx";
import type { Locale } from "../src/i18n/types.ts";
import { accountMessageText } from "../src/i18n/accountText.ts";
import { AccountContext, ACCOUNT_OFF, type AccountApi } from "../src/account/session.tsx";
import { MyDataSettings, UsageStatsSettings } from "../src/account/AccountSettings.tsx";
import { AnnouncementBanner } from "../src/account/AnnouncementBanner.tsx";
import { friendlyError } from "../src/account/signIn.ts";
import { profileSaveError } from "../src/account/api.ts";
import { RELATION_WORDS, describeHistory, relativeTime, type HistoryRow } from "../src/account/chain.ts";
import { PUSH_PRIVACY, PUSH_TEXT, PushToggleView } from "../src/push/PushToggle.tsx";
import { describePayload, type PayloadLike } from "../src/sign/payload.ts";
import SignPage from "../src/sign/SignPage.tsx";
import { PublicBody } from "../src/public/PublicPage.tsx";
import StaticPage from "../src/legal/StaticPage.tsx";
import { DISCLAIMER, NOT_FOUND } from "../src/legal/content.ts";
import { HistoryView, LineageView } from "../src/hud/ChainSections.tsx";
import { formatCountdown } from "../src/chain/actions.ts";

const EN = flatten(CATALOG.en);
const ID = flatten(CATALOG.id);
const en = translator("en");
const id = translator("id");

const fakeStore = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};

const inLocale = (locale: Locale, node: ReactElement) => renderToStaticMarkup(<I18nProvider locale={locale}>{node}</I18nProvider>);

afterEach(() => {
  reloadLocale(fakeStore(), undefined);
});

const signedOut: AccountApi = { ...ACCOUNT_OFF, enabled: true, status: "idle" };
const signedIn: AccountApi = { ...ACCOUNT_OFF, enabled: true, status: "signed-in", client: {} as SupabaseClient, userId: "u-1", nearAccountId: "alice.testnet" };
const withAccount = (value: AccountApi, node: ReactElement) => <AccountContext.Provider value={value}>{node}</AccountContext.Provider>;

// ------------------------------------------------------------------ the new dictionaries

describe("UI-161 B5 dictionaries", () => {
  const NAMESPACES = /^(account|push|sign|public)\./;
  // Values that are the same in both languages on purpose: names, standards, code-like labels.
  const SAME = new Set([
    "account.admin.title", // "Admin"
    "account.metrics.landing", // funnel step names, as the backend calls them
    "account.metrics.app",
    "sign.email", // "email"
    "sign.request.network", // " ({network})"
    "public.nav.game", // "Game", the loanword
    "public.snacc.title", // "Snacc #{id}"
    "public.snacc.metaTitle", // "Snacc #{id} · Snacc"
    "public.snacc.status", // "status"
  ]);

  it("has the four new namespaces in both languages", () => {
    for (const ns of ["account", "push", "sign", "public"]) {
      expect(Object.keys(EN).some((k) => k.startsWith(`${ns}.`)), ns).toBe(true);
      expect(Object.keys(ID).some((k) => k.startsWith(`${ns}.`)), ns).toBe(true);
    }
  });

  it("does not leave English in the Indonesian copy of the new namespaces", () => {
    const same = Object.keys(EN)
      .filter((k) => NAMESPACES.test(k) && EN[k] === ID[k])
      .filter((k) => !SAME.has(k));
    expect(same).toEqual([]);
  });

  it("keeps the honesty wording in Indonesian", () => {
    expect(ID["public.disclaimer"]).toContain("tanpa nilai uang");
    expect(ID["public.snacc.readOnly"]).toContain("tanpa nilai uang");
    expect(EN["public.disclaimer"]).toBe(DISCLAIMER);
  });

  it("matches the English data constants that tests and old callers still read", () => {
    expect(EN["public.notFound.heading"]).toBe(NOT_FOUND.heading);
    expect(EN["public.notFound.body"]).toBe(NOT_FOUND.body);
    expect(PUSH_TEXT.off).toBe(EN["push.state.off"]);
    expect(PUSH_PRIVACY).toBe(EN["push.privacy"]);
    expect(RELATION_WORDS).toEqual({ spliced_into: "splice", hostile: "hostile takeover" });
  });
});

// ------------------------------------------------------------------ account sections of Settings

describe("UI-161 B5 account sections", () => {
  it("renders the usage-stats section in Indonesian, and unchanged in English", () => {
    const idHtml = inLocale("id", withAccount(signedOut, <UsageStatsSettings />));
    expect(idHtml).toContain("Statistik pemakaian anonim");
    expect(idHtml).toContain("bagikan statistik pemakaian anonim");
    expect(idHtml).toContain("halaman privasi");
    expect(idHtml).toContain('href="/privacy#usage-stats"');
    expect(idHtml).toContain('data-testid="settings-stats-toggle"');
    expect(idHtml).not.toContain("Anonymous usage stats");

    const enHtml = inLocale("en", withAccount(signedOut, <UsageStatsSettings />));
    expect(enHtml).toContain("Anonymous usage stats");
    expect(enHtml).toContain("share anonymous usage stats");
    expect(enHtml).toContain('<a class="fd-a" href="/privacy#usage-stats">privacy page</a>');
    expect(enHtml).toContain("Never your account id, wallet, keys or IP address.");
  });

  it("renders the data-download section signed out and signed in", () => {
    const out = inLocale("id", withAccount(signedOut, <MyDataSettings />));
    expect(out).toContain("Data profilmu");
    expect(out).toContain("Masuk ke profil (kunci di samping dompetmu) untuk mengunduh datamu.");
    const inn = inLocale("id", withAccount(signedIn, <MyDataSettings />));
    expect(inn).toContain("unduh dataku");
    expect(inn).toContain("Unduh semua yang disimpan basis data profil Snacc tentangmu");
    expect(inn).toContain('data-testid="settings-export"');

    expect(inLocale("en", withAccount(signedOut, <MyDataSettings />))).toContain("Sign in to the profile (the key next to your wallet) to download your data.");
    expect(inLocale("en", withAccount(signedIn, <MyDataSettings />))).toContain("download my data");
  });

  it("stays inert without the profile database, in both languages", () => {
    for (const locale of ["en", "id"] as const) {
      expect(inLocale(locale, <UsageStatsSettings />)).toBe("");
      expect(inLocale(locale, <MyDataSettings />)).toBe("");
    }
  });

  it("translates the announcement close button label only", () => {
    // No announcement rows without a client: the banner renders nothing, in either language.
    expect(inLocale("id", withAccount(signedOut, <AnnouncementBanner />))).toBe("");
    expect(ID["account.announce.dismiss"]).toBe("tutup pengumuman");
    expect(EN["account.announce.dismiss"]).toBe("dismiss announcement");
  });
});

// ------------------------------------------------------------------ service messages

describe("UI-161 B5 service messages", () => {
  it("translates every sentence the code produces, and passes unknown text through", () => {
    const known = [
      friendlyError("not_full_access_key"),
      friendlyError("challenge_expired"),
      friendlyError("invalid_signature"),
      friendlyError("something_else", ""),
      profileSaveError({ code: "23505", message: "" }),
      profileSaveError({ message: "username_not_allowed" }),
      profileSaveError({ message: "bio_not_allowed" }),
      "Connect a wallet first.",
      "Could not reach the profile service. Check the connection and try again.",
      "Sign-in cancelled in the wallet.",
      "The database refused: boom",
      "The wallet signed as bob.testnet, not alice.testnet. Switch accounts and try again.",
      "Only admins can do this.",
      "The captcha check timed out. Please try again.",
      tEn("push.messages.generic"),
      "Sign in to the profile to use push notifications.",
    ];
    for (const message of known) {
      const out = accountMessageText(id, message);
      expect(out, message).not.toBe(message);
      expect(accountMessageText(en, message), message).toBe(message);
    }
    expect(accountMessageText(id, "The wallet signed as bob.testnet, not alice.testnet. Switch accounts and try again.")).toBe(
      "Dompet menandatangani sebagai bob.testnet, bukan alice.testnet. Ganti akun lalu coba lagi.",
    );
    expect(accountMessageText(id, "The database refused: duplicate key")).toBe("Basis data menolak: duplicate key");
    // A message from the database or a wallet is shown as it came.
    expect(accountMessageText(id, "rpc exploded 500")).toBe("rpc exploded 500");
  });
});

// ------------------------------------------------------------------ push

describe("UI-161 B5 push toggle", () => {
  const noop = () => undefined;

  it("renders the toggle in Indonesian", () => {
    const out = inLocale("id", <PushToggleView state="off" onEnable={noop} onDisable={noop} message="Notifications were not allowed, so push stays off." />);
    expect(out).toContain("Push ke perangkat ini");
    expect(out).toContain("nyalakan push ke perangkat ini");
    expect(out).toContain("Mati. Nyalakan untuk menerima notifikasi di perangkat ini");
    expect(out).toContain("Notifikasi tidak diizinkan, jadi push tetap mati.");
    expect(out).toContain("bukan kunci dompet");
    expect(out).toContain('data-testid="push-on"');
    expect(out).not.toContain("turn on push");
    const on = inLocale("id", <PushToggleView state="on" onEnable={noop} onDisable={noop} />);
    expect(on).toContain("matikan push ke perangkat ini");
    expect(on).toContain('data-testid="push-off"');
  });

  it("renders the English text unchanged", () => {
    const out = inLocale("en", <PushToggleView state="off" onEnable={noop} onDisable={noop} />);
    expect(out).toContain("turn on push to this device");
    expect(out).toContain(PUSH_TEXT.off);
    expect(out).toContain("never a wallet key");
    for (const state of Object.keys(PUSH_TEXT) as Array<keyof typeof PUSH_TEXT>) {
      expect(inLocale("en", <PushToggleView state={state} onEnable={noop} onDisable={noop} />)).toContain(PUSH_TEXT[state]);
    }
  });
});

// ------------------------------------------------------------------ sign popup

describe("UI-161 B5 sign popup", () => {
  it("renders the off notice in both languages", () => {
    const idHtml = inLocale("id", <SignPage />);
    expect(idHtml).toContain('data-testid="sign-off"');
    expect(idHtml).toContain("Masuk dengan email belum diatur di deployment ini.");
    expect(idHtml).toContain("Kunci tetap di Privy; game tidak pernah melihatnya.");
    const enHtml = inLocale("en", <SignPage />);
    expect(enHtml).toContain("Email login is not configured on this deployment.");
    expect(enHtml).toContain("Keys stay with Privy; the game never sees them.");
  });

  const SAMPLES: PayloadLike[] = [
    { kind: "signIn", network: "testnet" },
    { kind: "signInAndSignMessage", network: "testnet", recipient: "snacc-nu.vercel.app" },
    { kind: "signMessage", message: "Sign in to Snacc: nonce 42", recipient: "snacc-nu.vercel.app" },
    {
      kind: "signAndSendTransaction",
      receiverId: "snacc-v001.testnet",
      actions: [
        { type: "FunctionCall", params: { methodName: "feed_strain", deposit: "1", gas: "1" } },
        { type: "FunctionCall", params: { methodName: "incubate_strain", deposit: "1500000000000000000000000" } },
        { type: "AddKey", params: { publicKey: "ed25519:abc", accessKey: { permission: { receiverId: "snacc-v001.testnet", allowance: "250000000000000000000000", methodNames: ["feed_strain"] } } } },
        { type: "AddKey", params: { accessKey: { permission: "FullAccess" } } },
        { type: "DeleteKey", params: { publicKey: "ed25519:abc" } },
        { type: "Transfer", params: { deposit: "2000000000000000000000000" } },
      ],
    },
    { kind: "signAndSendTransactions", transactions: [{ receiverId: "a.testnet", actions: [{ type: "Transfer", params: { deposit: "1000000000000000000000000" } }] }] },
    { kind: "signDelegateActions" },
    { kind: "somethingNew" },
  ];

  it("builds the same payload description in English under both languages, and never touches the payload", () => {
    const before = JSON.stringify(SAMPLES);
    // The default is English, whatever language is saved: nothing that reads the payload depends on the UI language.
    const plain = SAMPLES.map((p) => describePayload(p));
    setLocale("id", fakeStore());
    const plainInId = SAMPLES.map((p) => describePayload(p));
    expect(plainInId).toEqual(plain);
    expect(JSON.stringify(SAMPLES)).toBe(before);

    expect(plain[0]).toEqual(["sign in and share your NEAR account id (testnet)"]);
    expect(plain[3]).toContain("call incubate_strain, attaches 1.5 NEAR on snacc-v001.testnet");
    expect(describePayload(null)).toEqual(["unknown request"]);
  });

  it("describes the same requests in Indonesian with the data kept as it is", () => {
    const before = JSON.stringify(SAMPLES);
    for (const p of SAMPLES) {
      const english = describePayload(p, en);
      const indonesian = describePayload(p, id);
      expect(indonesian).toHaveLength(english.length);
      expect(indonesian).not.toEqual(english);
      // Method names, account ids, amounts and keys are data, not words.
      for (const datum of ["feed_strain", "incubate_strain", "snacc-v001.testnet", "a.testnet", "ed25519:abc", "1.5", "0.25", "Sign in to Snacc: nonce 42"]) {
        const inEnglish = english.some((l) => l.includes(datum));
        const inIndonesian = indonesian.some((l) => l.includes(datum));
        expect(inIndonesian, datum).toBe(inEnglish);
      }
    }
    expect(JSON.stringify(SAMPLES)).toBe(before);
    expect(describePayload(SAMPLES[0]!, id)).toEqual(["masuk dan bagikan id akun NEAR-mu (testnet)"]);
    expect(describePayload(SAMPLES[3]!, id)).toContain("panggil incubate_strain, menyertakan 1.5 NEAR di snacc-v001.testnet");
    expect(describePayload(SAMPLES[3]!, id)).toContain("tambah kunci AKSES PENUH di snacc-v001.testnet");
  });
});

// ------------------------------------------------------------------ public pages

describe("UI-161 B5 public pages", () => {
  it("renders the profile page in Indonesian and in English", () => {
    const target = { kind: "profile", accountId: "alice.testnet" } as const;
    const idHtml = inLocale("id", <PublicBody target={target} />);
    expect(idHtml).toContain('data-testid="public-profile"');
    expect(idHtml).toContain("Profil pemain belum dinyalakan untuk situs ini.");
    expect(idHtml).toContain("Salin tautan profil");
    expect(idHtml).toContain("membaca nft_tokens_for_owner dan get_colony di");
    expect(idHtml).toContain("Hanya baca, dari view kontrak di");
    expect(idHtml).toContain("tanpa avatar");
    expect(idHtml).not.toContain("Player profiles are not switched on");
    const enHtml = inLocale("en", <PublicBody target={target} />);
    expect(enHtml).toContain("Player profiles are not switched on for this site.");
    expect(enHtml).toContain("Copy profile link");
    expect(enHtml).toContain("reading nft_tokens_for_owner and get_colony on");
    expect(enHtml).toContain("Read-only, from contract views on");
  });

  it("renders the Snacc page in Indonesian and in English", () => {
    const target = { kind: "snacc", strainId: 7 } as const;
    const idHtml = inLocale("id", <PublicBody target={target} />);
    expect(idHtml).toContain('data-testid="public-snacc"');
    expect(idHtml).toContain("Snacc #7");
    expect(idHtml).toContain("membaca nft_token dan get_strain di");
    expect(idHtml).toContain("Buka di game");
    expect(idHtml).toContain("Salin tautan");
    expect(idHtml).toContain("$SNACC di testnet tanpa nilai uang.");
    expect(idHtml).toContain('href="/app?strain=7"');
    const enHtml = inLocale("en", <PublicBody target={target} />);
    expect(enHtml).toContain("Open in game");
    expect(enHtml).toContain("Copy link");
    expect(enHtml).toContain("$SNACC on testnet has no monetary value.");
  });
});

// ------------------------------------------------------------------ static pages and the 404 page

describe("UI-161 B5 static pages and the 404 page", () => {
  it("renders the 404 page and the frame in Indonesian", () => {
    const html = inLocale("id", <StaticPage page="notfound" />);
    expect(html).toContain("404");
    expect(html).toContain("Halaman itu tidak ada di lab.");
    expect(html).toContain("Kembali ke beranda");
    expect(html).toContain("Buka game");
    expect(html).toContain("Lompat ke konten");
    expect(html).toContain("Beranda");
    expect(html).toContain("Ketentuan");
    expect(html).toContain("Privasi");
    expect(html).toContain("Kontak (isu GitHub)");
    expect(html).toContain("tanpa nilai uang");
    expect(html).not.toContain(NOT_FOUND.heading);
    expect(html).not.toContain("Skip to content");
  });

  it("keeps the English 404 page and frame unchanged", () => {
    const html = inLocale("en", <StaticPage page="notfound" />);
    expect(html).toContain(NOT_FOUND.heading);
    expect(html).toContain(NOT_FOUND.body);
    expect(html).toContain("Back to the home page");
    expect(html).toContain("Open the game");
    expect(html).toContain("Skip to content");
    expect(html).toContain("Contact (GitHub issues)");
    expect(html).toContain(DISCLAIMER);
  });

  it("keeps the legal text English under Indonesian, marked lang=en, inside a translated frame", () => {
    for (const page of ["terms", "privacy"] as const) {
      const html = inLocale("id", <StaticPage page={page} />);
      expect(html).toContain("Halaman ini hanya tersedia dalam bahasa Inggris.");
      expect(html).toContain('lang="en"');
      expect(html).toContain("Last updated");
      expect(html).toContain("no monetary value");
      expect(html).toContain("Lompat ke konten");
      expect(html).toContain("Ketentuan");
    }
  });
});

// ------------------------------------------------------------------ history lines and countdown

describe("UI-161 B5 strain history and countdown", () => {
  const row = (event: string, data: Record<string, unknown>, role: string | null = null): HistoryRow => ({
    strain_id: 10,
    event,
    role,
    actor: "snacc-v001.testnet",
    data,
    tx_hash: "EbYbVWzVtxhash",
    block_time: "2026-11-13T10:00:00Z",
  });

  it("keeps the English default of describeHistory and relativeTime, whatever the saved language", () => {
    setLocale("id", fakeStore());
    expect(describeHistory(row("fed", { effective_fee: "42416000000000000000000", dormant: false }))).toBe("fed (fee 0.0424 $SNACC)");
    expect(describeHistory(row("delisted", { reason: "seller" }))).toBe("taken off the market (by the seller)");
    expect(relativeTime("2026-11-13T10:00:00Z", Date.parse("2026-11-13T13:00:00Z"))).toBe("3 h ago");
  });

  it("translates the sentences when given a translator, keeping ids, amounts and names", () => {
    expect(describeHistory(row("fed", { effective_fee: "42416000000000000000000", dormant: false }), id)).toBe("diberi makan (biaya 0.0424 $SNACC)");
    expect(describeHistory(row("fed", { effective_fee: "390550000000000000000", dormant: true }), id)).toBe("diberi makan (biaya 0.0003 $SNACC), bangun dari dormansi");
    expect(describeHistory(row("strains_spliced", { dominant_id: 5, absorbed_id: 1 }, "dominant"), id)).toBe("penggabungan: menyerap #1");
    expect(describeHistory(row("extracted", { amount: 1, token: "mt:spore-ignis" }), id)).toBe("menghasilkan 1 mt:spore-ignis");
    expect(describeHistory(row("extracted", { amount: 1 }), id)).toBe("menghasilkan 1 molekul");
    expect(describeHistory(row("genome_mutated", { efficiency_shift_bps: -150 }), id)).toBe("genom bermutasi (efisiensi -1.50%)");
    expect(describeHistory(row("delisted", { reason: "token_left_market" }), id)).toBe("ditarik dari pasar (token keluar dari pasar)");
    expect(describeHistory(row("something_new_happened", {}), id)).toBe("something new happened");
  });

  it("renders the history list and the lineage relation words in the reader's language", () => {
    const fed = row("fed", { effective_fee: "42416000000000000000000", dormant: false });
    const now = Date.parse("2026-11-13T13:00:00Z");
    const idHtml = inLocale("id", <HistoryView state={{ kind: "ok", value: [fed] }} nowMs={now} />);
    expect(idHtml).toContain("diberi makan (biaya 0.0424 $SNACC)");
    expect(idHtml).toContain("3 jam lalu");
    const enHtml = inLocale("en", <HistoryView state={{ kind: "ok", value: [fed] }} nowMs={now} />);
    expect(enHtml).toContain("fed (fee 0.0424 $SNACC)");
    expect(enHtml).toContain("3 h ago");

    const lineage = { parent: null, generation: 1, children: [], siblings: [], absorbed: [{ id: 3, relation: "hostile" as const }], mergedInto: { id: 9, relation: "spliced_into" as const } };
    const idLineage = inLocale("id", <LineageView state={{ kind: "ok", value: lineage }} generation={1} />);
    expect(idLineage).toContain("(pengambilalihan paksa)");
    expect(idLineage).toContain("(penggabungan)");
    const enLineage = inLocale("en", <LineageView state={{ kind: "ok", value: lineage }} generation={1} />);
    expect(enLineage).toContain("(hostile takeover)");
    expect(enLineage).toContain("(splice)");
  });

  it("formats the countdown in the reader's language, with the English default for old callers", () => {
    expect(formatCountdown(3 * 86400 + 4 * 3600 + 59)).toBe("3d 4h");
    expect(formatCountdown(5 * 3600 + 12 * 60)).toBe("5h 12m");
    expect(formatCountdown(12 * 60 + 30)).toBe("12m");
    expect(formatCountdown(10)).toBe("1m");
    expect(formatCountdown(0)).toBe("now");
    expect(formatCountdown(Number.NaN)).toBe("now");
    expect(formatCountdown(3 * 86400 + 4 * 3600 + 59, id)).toBe("3 hr 4 j");
    expect(formatCountdown(5 * 3600 + 12 * 60, id)).toBe("5 j 12 mnt");
    expect(formatCountdown(12 * 60 + 30, id)).toBe("12 mnt");
    expect(formatCountdown(0, id)).toBe("sekarang");
  });
});
