/**
 * UI-161 phase B2: the game action windows, the transaction messages, the zone descriptions and the Modal
 * close label in Indonesian, and the English left unchanged. Components are rendered with
 * `renderToStaticMarkup` under `<I18nProvider locale=...>`; `humanizeTxError` reads the global language, which
 * the tests set through `setLocale` with a fake store and put back afterwards.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOG, flatten } from "../src/i18n/catalog.ts";
import { placeholderNames } from "../src/i18n/format.ts";
import { reloadLocale, setLocale } from "../src/i18n/locale.ts";
import { I18nProvider } from "../src/i18n/react.tsx";
import type { Locale } from "../src/i18n/types.ts";
import { EMPTY_ACCOUNT_INFO } from "../src/chain/useAccountInfo.ts";
import { DISCONNECTED_WALLET } from "../src/chain/wallet.tsx";
import { humanizeTxError, readThrown } from "../src/chain/txResult.ts";
import { ZONE_DESCRIPTION_KEYS, ZONE_THEMES } from "../src/config/zones.ts";
import { ZoneBanner } from "../src/hud/ZoneBanner.tsx";
import GameActionWindow, { type GameActionKey } from "../src/hud/GameActions.tsx";
import { FeedModal, HatchModal, TxStatusView } from "../src/hud/ChainActions.tsx";
import { HistoryView, LineageView, NOT_CONFIGURED } from "../src/hud/ChainSections.tsx";
import { Modal } from "../src/ui/Modal.tsx";

const EN = flatten(CATALOG.en);
const ID = flatten(CATALOG.id);

const fakeStore = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};

const inLocale = (locale: Locale, node: React.ReactElement) => renderToStaticMarkup(<I18nProvider locale={locale}>{node}</I18nProvider>);

const windowOf = (action: "menu" | GameActionKey) => (
  <GameActionWindow action={action} wallet={DISCONNECTED_WALLET} info={EMPTY_ACCOUNT_INFO} onPick={() => {}} onClose={() => {}} onDone={() => {}} preferredStrainId={null} />
);

const panic = (code: string) => `Smart contract panicked: ${code}`;

describe("UI-161 B2 dictionaries", () => {
  it("has the same placeholders in English and Indonesian for the actions and tx namespaces", () => {
    const keys = Object.keys(EN).filter((k) => k.startsWith("actions.") || k.startsWith("tx."));
    expect(keys.length).toBeGreaterThan(400);
    for (const key of keys) expect(placeholderNames(ID[key]!), key).toEqual(placeholderNames(EN[key]!));
  });

  it("translates every contract error code the humanizer knows", () => {
    const codes = Object.keys(EN).filter((k) => k.startsWith("tx.errors."));
    expect(codes.length).toBeGreaterThanOrEqual(49);
    for (const key of codes) expect(ID[key], key).not.toBe(EN[key]);
  });

  it("says the testnet token has no money value in the footer and the live note, in both languages", () => {
    expect(EN["actions.footer.line"]).toContain("no monetary value");
    expect(ID["actions.footer.line"]).toContain("tanpa nilai uang");
    expect(EN["actions.app.liveNoteSigned"]).toContain("no monetary value");
    expect(ID["actions.app.liveNoteSigned"]).toContain("tanpa nilai uang");
    expect(ID["actions.send.sendBody"]).toContain("tanpa nilai uang");
  });

  it("keeps the official zone figures in the zone descriptions", () => {
    expect(ID["actions.zone.Hypothermia"]).toContain("+2.00%");
    expect(ID["actions.zone.Fever"]).toContain("-3.50%");
    for (const zone of ["Hypothermia", "Goldilocks", "Fever"] as const) expect(EN[ZONE_DESCRIPTION_KEYS[zone]]).toBe(ZONE_THEMES[zone].description);
  });
});

describe("UI-161 B2 action windows", () => {
  it("shows the action menu in Indonesian", () => {
    const html = inLocale("id", windowOf("menu"));
    expect(html).toContain("Aksi game");
    expect(html).toContain("Alokasikan ATP");
    expect(html).toContain("Berikan Snacc");
    expect(html).toContain("tutup actions.tx");
    expect(html).toContain("tanpa nilai uang");
    expect(html).not.toContain("Game actions");
  });

  it("keeps the action menu in English under en", () => {
    const html = inLocale("en", windowOf("menu"));
    expect(html).toContain("Game actions");
    expect(html).toContain("Allocate ATP");
    expect(html).toContain("close actions.tx");
    expect(html).not.toContain("Aksi game");
  });

  it.each(["allocate", "divide", "splice", "extract", "transmute", "synthesize", "npc", "hungry", "pool", "gift", "send"] as const)("%s window has Indonesian text and no English connect line", (key) => {
    const html = inLocale("id", windowOf(key));
    expect(html).toContain("Hubungkan dompet untuk menandatangani ini di testnet.");
    expect(html).toContain("tanda tangani dan");
    expect(html).not.toContain("Connect a wallet to sign this on testnet.");
    expect(html).not.toContain("sign and ");
  });

  it("names the role a production step needs in both languages", () => {
    expect(inLocale("id", windowOf("transmute"))).toContain("Butuh peran Fermenter");
    expect(inLocale("en", windowOf("transmute"))).toContain("Needs the Fermenter role");
  });

  it("uses the glossary words: kenyang, beri makan, menetaskan stay consistent", () => {
    const id = inLocale("id", <FeedModal wallet={DISCONNECTED_WALLET} info={EMPTY_ACCOUNT_INFO} onClose={() => {}} onDone={() => {}} preferredStrainId={null} />);
    expect(id).toContain("Beri makan Snacc");
    expect(id).toContain("Tidak ada NEAR yang dilampirkan");
    const hatch = inLocale("id", <HatchModal wallet={DISCONNECTED_WALLET} info={EMPTY_ACCOUNT_INFO} onClose={() => {}} onDone={() => {}} />);
    expect(hatch).toContain("Tetaskan Snacc");
    expect(hatch).toContain("mengekstrak spora");
    expect(hatch).toContain("tanda tangani dan tetaskan");
    expect(inLocale("en", <HatchModal wallet={DISCONNECTED_WALLET} info={EMPTY_ACCOUNT_INFO} onClose={() => {}} onDone={() => {}} />)).toContain("Hatch a Snacc");
  });

  it("translates the transaction status lines", () => {
    const pending = inLocale("id", <TxStatusView phase={{ kind: "pending" }} />);
    expect(pending).toContain("Menunggu dompet-mu.");
    const done = inLocale("id", <TxStatusView phase={{ kind: "done", result: { ok: true, txHash: "ABCDEFGHIJKLMNOP" } }} />);
    expect(done).toContain("Selesai di testnet.");
    expect(done).toContain("ABCDEFGHIJ…");
    const failed = inLocale("id", <TxStatusView phase={{ kind: "done", result: { ok: false, txHash: null, message: "m", raw: "r", rejected: false } }} />);
    expect(failed).toContain("detail");
    expect(inLocale("en", <TxStatusView phase={{ kind: "pending" }} />)).toContain("Waiting for your wallet.");
  });

  it("translates the Lineage and History sections and keeps the English constant for English", () => {
    const lineage = inLocale("id", <LineageView state={{ kind: "off" }} generation={2} />);
    expect(lineage).toContain("garis keturunan");
    expect(lineage).toContain("generasi #2");
    expect(lineage).not.toContain(NOT_CONFIGURED);
    expect(inLocale("id", <HistoryView state={{ kind: "ok", value: [] }} nowMs={0} />)).toContain("Riwayat muncul setelah indeks chain menyusul.");
    expect(inLocale("en", <LineageView state={{ kind: "off" }} generation={2} />)).toContain(NOT_CONFIGURED);
  });

  it("translates the Modal close label and the zone description", () => {
    expect(inLocale("id", <Modal title="x.tx" onClose={() => {}}>body</Modal>)).toContain('aria-label="tutup x.tx"');
    expect(inLocale("en", <Modal title="x.tx" onClose={() => {}}>body</Modal>)).toContain('aria-label="close x.tx"');
    expect(inLocale("id", <ZoneBanner zone="Fever" skin="biolab" />)).toContain("pembakaran suplai reaktif");
    expect(inLocale("en", <ZoneBanner zone="Fever" skin="biolab" />)).toContain("reactive supply burn");
  });
});

describe("UI-161 B2 transaction messages", () => {
  afterEach(() => {
    reloadLocale(fakeStore(), undefined);
  });

  it("stays English by default and under en", () => {
    expect(humanizeTxError(panic("ERR_COLONY_FULL")).message).toBe("Your colony is full.");
    setLocale("en", fakeStore());
    expect(humanizeTxError(panic("ERR_NOT_OWNED_BY_CALLEE"), "feed_strain").message).toBe("You can only feed a Snacc you own.");
    expect(humanizeTxError("user rejected the request").rejected).toBe(true);
  });

  it("speaks Indonesian under id with the same matching", () => {
    setLocale("id", fakeStore());
    expect(humanizeTxError(panic("ERR_COLONY_FULL")).message).toBe("Koloni-mu penuh.");
    expect(humanizeTxError(panic("ERR_NOT_OWNED_BY_CALLEE"), "divide_strain").message).toBe("Kamu hanya bisa membagi Snacc milikmu.");
    expect(humanizeTxError(panic("ERR_STAKE_DEPOSIT_MISMATCH"), "extract_spores").message).toContain("biaya katalis");
    expect(humanizeTxError(panic("ERR_SOMETHING_NEW")).message).toBe("Kontrak menolak panggilan itu (ERR_SOMETHING_NEW).");
    expect(humanizeTxError("LackBalanceForState").message).toContain("NEAR testnet");
    expect(humanizeTxError("Exceeded the prepaid gas").message).toBe("Transaksi kehabisan gas.");
    expect(humanizeTxError("wallet not found").message).toContain("Dompet tidak terhubung");
    expect(humanizeTxError("something odd").message).toBe("Transaksi tidak berhasil.");
    expect(humanizeTxError("user cancelled")).toMatchObject({ rejected: true });
    expect(readThrown(new Error(panic("ERR_BAD_AMOUNT"))).message).toBe("Jumlah itu tidak valid.");
  });
});
