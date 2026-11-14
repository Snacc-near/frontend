/**
 * UI-161 phase B3: the market, collection, profile, social, NPC and demo-mode text in Indonesian, and the
 * English left unchanged. Components are rendered with `renderToStaticMarkup` under
 * `<I18nProvider locale=...>`; the pure helpers that read the saved language (`check*` reasons, the
 * simulation log, the receipt line) are tested through `setLocale` with a fake store, put back afterwards.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOG, flatten } from "../src/i18n/catalog.ts";
import { placeholderNames } from "../src/i18n/format.ts";
import { reloadLocale, setLocale } from "../src/i18n/locale.ts";
import { I18nProvider } from "../src/i18n/react.tsx";
import type { Locale } from "../src/i18n/types.ts";
import { agoText } from "../src/i18n/ago.ts";
import { translator } from "../src/i18n/catalog.ts";
import { countdownText, seasonOptionsText, urgencyText } from "../src/i18n/socialText.ts";
import { achievementText, usernameProblemText } from "../src/i18n/achievements.ts";
import { checkAllocation, checkDivide, checkStake, checkTestnetAccount } from "../src/chain/actions.ts";
import { checkPrice, notConfirmedMessage } from "../src/chain/market.ts";
import { createInitialSimulation, divideStrain, feedStrain } from "../src/game/simulation.ts";
import { receiptLine } from "../src/plate/iso/layout.ts";
import { hungerMessage } from "../src/data/collection.ts";
import { MarketModal, MarketTxStatus } from "../src/hud/MarketModal.tsx";
import { GuestLabelModal } from "../src/hud/GuestLabelModal.tsx";
import { InviteFriends, countsLine } from "../src/hud/InviteFriends.tsx";
import { GraveyardList, GraveyardPanel, causeText } from "../src/hud/Graveyard.tsx";
import { NpcPanel } from "../src/hud/NpcPanel.tsx";
import { SwapPanel } from "../src/hud/SwapPanel.tsx";
import { RecipeSearchModal } from "../src/hud/RecipeSearchModal.tsx";
import { QuestList, ResetNote, XpRules } from "../src/hud/QuestsModal.tsx";
import { SeasonHeader, rowDetail } from "../src/hud/SeasonBoard.tsx";
import { StrainDetailModal } from "../src/hud/StrainDetailModal.tsx";
import type { StrainDetail } from "../src/data/types.ts";
import type { GraveRow } from "../src/account/chain.ts";
import type { QuestRow } from "../src/account/quests.ts";

const EN = flatten(CATALOG.en);
const ID = flatten(CATALOG.id);

const fakeStore = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};

const inLocale = (locale: Locale, node: React.ReactElement) => renderToStaticMarkup(<I18nProvider locale={locale}>{node}</I18nProvider>);

afterEach(() => {
  reloadLocale(fakeStore(), undefined);
});

const NEW_NAMESPACES = ["market.", "collection.", "social.", "npc.", "demo.", "checks."];

describe("UI-161 B3 dictionaries", () => {
  it("has the same placeholders in English and Indonesian for the new namespaces", () => {
    const keys = Object.keys(EN).filter((k) => NEW_NAMESPACES.some((p) => k.startsWith(p)));
    expect(keys.length).toBeGreaterThan(450);
    for (const key of keys) expect(placeholderNames(ID[key]!), key).toEqual(placeholderNames(EN[key]!));
  });

  it("translates every sentence of the new namespaces, except names, code and numbers", () => {
    // Keys whose text is the same in both languages on purpose: window file names, the contract's own words,
    // terms of art (atp, bmr, XP, view, epoch) and number or placeholder formats. Any other equal pair is a
    // sentence that was left in English.
    const SAME_ON_PURPOSE = new Set([
      "collection.title", "collection.lab.title", "collection.lab.keycaps.attest", "collection.lab.organelle.mitokondria.note",
      "collection.lab.organelle.nukleus.note", "collection.detail.title", "collection.detail.heading", "collection.detail.headingLoading",
      "collection.detail.status", "demo.noteNucleus", "demo.kinds.atp", "demo.seedLogs.actor", "market.title", "market.tx.prefix",
      "market.row.strain", "market.buy.attachValue", "market.buy.yoctoPrice", "npc.titleBiolab", "npc.titleFintech", "npc.stockTarget",
      "npc.why.title", "npc.why.formula", "npc.why.unitTotal", "npc.swap.title", "npc.swap.tagLive", "npc.recipe.title", "npc.recipe.method",
      "npc.thesis.title", "npc.thesis.viewTag", "npc.thesis.burnedValue", "npc.thesis.readAtValue", "social.profile.title", "social.profile.bio",
      "social.profile.activityStrain", "social.xpAmount", "social.xpPlus", "social.quests.title", "social.leaderboard.title",
      "social.leaderboard.srcBackend", "social.leaderboard.srcStreaks", "social.leaderboard.srcSeason", "social.leaderboard.epoch",
      "social.notif.title", "social.guest.title", "social.guest.auth0",
    ]);
    const same = Object.keys(EN)
      .filter((k) => NEW_NAMESPACES.some((p) => k.startsWith(p)) && EN[k] === ID[k])
      .filter((k) => !SAME_ON_PURPOSE.has(k));
    expect(same).toEqual([]);
  });

  it("says the testnet token and NEAR have no money value in the market and swap copy", () => {
    expect(EN["market.modal.note"]).toContain("no money value");
    expect(ID["market.modal.note"]).toContain("tanpa nilai uang");
    expect(ID["market.buy.note"]).toContain("tanpa nilai uang");
    expect(ID["market.modal.footer"]).toContain("tanpa nilai uang");
    expect(EN["npc.swap.noteTitle"]).toContain("no monetary value");
    expect(ID["npc.swap.noteTitle"]).toContain("tanpa nilai uang");
    expect(ID["social.invite.body"]).toContain("tanpa nilai uang");
  });
});

describe("UI-161 B3 market window", () => {
  it("renders the market in Indonesian", () => {
    const html = inLocale("id", <MarketModal onClose={() => {}} />);
    expect(html).toContain("Pasar");
    expect(html).toContain("Pasar demo testnet.");
    expect(html).toContain("tanpa nilai uang");
    expect(html).toContain("Jelajah");
    expect(html).toContain("Daftar jualku");
    expect(html).not.toContain("Testnet demo market");
  });

  it("keeps the English market text unchanged", () => {
    const html = inLocale("en", <MarketModal onClose={() => {}} />);
    expect(html).toContain("Testnet demo market.");
    expect(html).toContain("Browse");
    expect(html).toContain("My listings");
    expect(html).not.toContain("Jelajah");
  });

  it("translates the transaction status lines", () => {
    const phase = { kind: "checking", txHash: "X" } as const;
    expect(inLocale("id", <MarketTxStatus phase={phase} />)).toContain("Transaksi terkirim.");
    expect(inLocale("en", <MarketTxStatus phase={phase} />)).toContain("Transaction sent.");
    const settled = { kind: "settled", txHash: "ABCDEFGHIJKLMN", outcome: "confirmed", exp: { kind: "bought", tokenId: "5", buyerId: "a.testnet" } } as const;
    expect(inLocale("id", <MarketTxStatus phase={settled} />)).toContain("Snacc #5 sekarang milikmu.");
    expect(inLocale("en", <MarketTxStatus phase={settled} />)).toContain("Snacc #5 is yours now.");
  });
});

describe("UI-161 B3 profile, invite and guest windows", () => {
  it("renders the guest label window in both languages", () => {
    const id = inLocale("id", <GuestLabelModal current={null} onSave={() => {}} onClear={() => {}} onClose={() => {}} />);
    expect(id).toContain("Label tamu");
    expect(id).toContain("simpan label");
    const en = inLocale("en", <GuestLabelModal current={null} onSave={() => {}} onClear={() => {}} onClose={() => {}} />);
    expect(en).toContain("Guest label");
    expect(en).toContain("save label");
  });

  it("renders the invite block and the recruit line in both languages", () => {
    const id = inLocale("id", <InviteFriends account="a.testnet" counts={{ recruits: 2, recruitsHatched: 1 }} onShare={null} />);
    expect(id).toContain("Undang teman");
    expect(id).toContain("2 teman bergabung lewat tautanmu, 1 sudah menetaskan Snacc pertama.");
    const en = inLocale("en", <InviteFriends account="a.testnet" counts={{ recruits: 1, recruitsHatched: 0 }} onShare={null} />);
    expect(en).toContain("1 friend joined through your link, 0 hatched a first Snacc.");
    expect(countsLine(null)).toBe("Recruit count unavailable right now.");
  });

  it("translates achievements and username problems, and leaves unknown ones as they came", () => {
    const id = translator("id");
    expect(achievementText(id, "first_hatch", "name", "First hatch")).toBe("Tetas pertama");
    expect(achievementText(id, "mystery", "name", "Mystery")).toBe("Mystery");
    expect(usernameProblemText(id, "Pick a username.")).toBe("Pilih nama pengguna.");
    expect(usernameProblemText(id, "Something else")).toBe("Something else");
    expect(usernameProblemText(id, null)).toBeNull();
  });
});

describe("UI-161 B3 quests, seasons and notifications text", () => {
  const quest: QuestRow = { code: "feed_1", title: "Feed once", blurb: "Feed a Snacc.", target: 3, progress: 1, bonus_xp: 20, completed: false, resets_at: "2026-11-10T00:00:00Z" } as QuestRow;

  it("renders the quest list, the reset note and the XP rules in both languages", () => {
    const id = inLocale("id", <QuestList quests={[quest]} />);
    expect(id).toContain("misi hari ini");
    expect(id).toContain("bonus +20 XP bila selesai");
    expect(inLocale("en", <QuestList quests={[quest]} />)).toContain("+20 XP bonus when done");
    expect(inLocale("id", <ResetNote resetsAtMs={3_600_000 * 5} nowMs={0} />)).toContain("diatur ulang dalam 5 j 0 mnt");
    expect(inLocale("en", <ResetNote resetsAtMs={3_600_000 * 5} nowMs={0} />)).toContain("resets in 5h 0m");
    expect(inLocale("id", <XpRules />)).toContain("Cara kerja XP");
  });

  it("renders the season header and row details", () => {
    const id = inLocale("id", <SeasonHeader scope="all" nowMs={0} />);
    expect(id).toContain("Sepanjang waktu");
    expect(inLocale("en", <SeasonHeader scope="all" nowMs={0} />)).toContain("All time");
    expect(rowDetail(1, 3)).toBe("1 action · 3 quests");
    expect(rowDetail(2, 1, translator("id"))).toBe("2 aksi · 1 misi");
  });

  it("formats countdowns, season options, relative times and urgency lines", () => {
    const id = translator("id");
    const en = translator("en");
    expect(countdownText(en, 90 * 60_000)).toBe("1h 30m");
    expect(countdownText(id, 90 * 60_000)).toBe("1 j 30 mnt");
    expect(countdownText(id, 0)).toBe("sekarang");
    expect(seasonOptionsText(en, 3, [1, 2]).map((o) => o.label)).toEqual(["Season 3 (this week)", "Season 2", "Season 1", "All time"]);
    expect(seasonOptionsText(id, 3, [2]).map((o) => o.label)).toEqual(["Musim 3 (pekan ini)", "Musim 2", "Sepanjang waktu"]);
    const now = Date.parse("2026-11-10T12:00:00Z");
    expect(agoText(en, "2026-11-10T11:55:00Z", now)).toBe("5 min ago");
    expect(agoText(id, "2026-11-10T11:55:00Z", now)).toBe("5 menit lalu");
    expect(urgencyText(en, { kind: "starving" })).toContain("At risk now");
    expect(urgencyText(id, { kind: "starving" })).toContain("Terancam sekarang");
    expect(urgencyText(id, { kind: "system" })).toBeNull();
  });
});

describe("UI-161 B3 graveyard and collection text", () => {
  const row: GraveRow = { strain_id: 7, cause: "harvested_starving", by_account: "hunter.testnet", absorbed_into: null, owner_before: "owner.testnet", tx_hash: "TXHASH1234", block_time: "2026-11-10T11:00:00Z" };

  it("renders a grave row in both languages", () => {
    const now = Date.parse("2026-11-10T12:00:00Z");
    const id = inLocale("id", <GraveyardList rows={[row]} nowMs={now} />);
    expect(id).toContain("strain yang mati");
    expect(id).toContain("kelaparan sampai vitalitas nol lalu dipanen oleh hunter.testnet");
    expect(id).toContain("dimiliki owner.testnet");
    expect(id).toContain("1 jam lalu");
    const en = inLocale("en", <GraveyardList rows={[row]} nowMs={now} />);
    expect(en).toContain("starved to zero vitality and was harvested by hunter.testnet");
    expect(en).toContain("owned by owner.testnet");
    expect(en).toContain("1 h ago");
  });

  it("describes every grave cause in both languages", () => {
    for (const locale of ["en", "id"] as const) {
      const t = translator(locale);
      expect(causeText(t, { ...row, cause: "spliced_burned", absorbed_into: 9 })).toContain("#9");
      expect(causeText(t, { ...row, cause: "hostile_takeover", absorbed_into: null, by_account: null })).not.toContain("null");
    }
  });

  it("renders the graveyard panel without a client in Indonesian", () => {
    const html = inLocale("id", <GraveyardPanel client={null} account={null} live={false} />);
    expect(html).toContain("Mode demo aktif");
    expect(html).toContain("dipanen (0)");
  });

  it("builds the hunger warning in both languages", () => {
    expect(hungerMessage({ starving: 1, distressed: 0 })).toBe("1 of your Snaccs is starving — feed it or it can be snacked");
    expect(hungerMessage({ starving: 1, distressed: 1 }, translator("id"))).toBe("2 Snacc-mu terancam (1 kelaparan, 1 terdesak) — beri makan mereka atau bisa disantap");
    expect(hungerMessage({ starving: 0, distressed: 0 }, translator("id"))).toBeNull();
  });

  it("renders the strain detail window with the skin words in Indonesian", () => {
    const strain = {
      strain_id: 12,
      owner_id: "a.testnet",
      vault_subaccount: null,
      vitality: 5000,
      effective_vitality: 0,
      status: "Active",
      bmr_per_hour: 10,
      organel: { mitokondria: 1, nukleus: 2, lisosom: 3 },
      atp_balance: 4,
      generation: 2,
    } as unknown as StrainDetail;
    const render = (locale: Locale) =>
      inLocale(locale, <StrainDetailModal strain={strain} skin="biolab" mode="demo" svgDataUri={null} svgStatus="idle" onClose={() => {}} />);
    const id = render("id");
    expect(id).toContain("pemilik");
    expect(id).toContain("kelaparan (vitalitas efektif 0)");
    expect(id).toContain("mitokondria");
    const en = render("en");
    expect(en).toContain("starving (effective vitality 0)");
    expect(en).toContain("hunger rate (bmr)");
  });
});

describe("UI-161 B3 NPC, swap and recipe windows", () => {
  it("renders the NPC merchants in both languages", () => {
    const render = (locale: Locale) => inLocale(locale, <NpcPanel onClose={() => {}} skin="biolab" crucibleTempMk={605} mode="demo" userSnaccBalance={100} />);
    const id = render("id");
    expect(id).toContain("Pedagang spora NPC");
    expect(id).toContain("beli dalam simulasi");
    expect(id).toContain("saldo 100");
    const en = render("en");
    expect(en).toContain("NPC spore merchants");
    expect(en).toContain("buy in simulation");
  });

  it("renders the swap panel with the no-money-value note in Indonesian", () => {
    const html = inLocale("id", <SwapPanel mode="demo" onClose={() => {}} />);
    expect(html).toContain("tanpa nilai uang");
    expect(html).toContain("Harga Rhea");
    expect(html).toContain("mode demo: data live yang sama");
    expect(inLocale("en", <SwapPanel mode="demo" onClose={() => {}} />)).toContain("demo mode: same live data");
  });

  it("renders the recipe search in Indonesian and English", () => {
    expect(inLocale("id", <RecipeSearchModal onClose={() => {}} />)).toContain("Pencarian resep lokal");
    expect(inLocale("id", <RecipeSearchModal onClose={() => {}} />)).toContain("tanpa jaringan");
    expect(inLocale("en", <RecipeSearchModal onClose={() => {}} />)).toContain("Local recipe search (keyword)");
  });
});

describe("UI-161 B3 check reasons and demo text follow the saved language", () => {
  const dead = { status: "Liquidated", atp: 5n, current: { mitokondria: 1, nukleus: 1, lisosom: 1 }, target: { mitokondria: 2, nukleus: 1, lisosom: 1 }, lastAllocateEpoch: 1, currentEpoch: 2 };

  it("keeps the English reasons and the same decisions", () => {
    setLocale("en", fakeStore());
    expect(checkStake("abc")).toEqual({ ok: false, reason: "Enter an amount in NEAR, e.g. 0.25." });
    expect(checkTestnetAccount("bob", null)).toEqual({ ok: false, reason: "Use a testnet account id: name.testnet, or a 64-character implicit id." });
    expect(checkAllocation(dead)).toMatchObject({ ok: false, reason: "This Snacc is no longer alive." });
    expect(checkPrice("")).toEqual({ ok: false, reason: "Enter a price in NEAR, e.g. 1.5." });
  });

  it("returns Indonesian reasons with the same ok flags and numbers", () => {
    setLocale("id", fakeStore());
    expect(checkStake("abc")).toEqual({ ok: false, reason: "Masukkan jumlah dalam NEAR, mis. 0.25." });
    expect(checkTestnetAccount("friend.testnet", "friend.testnet")).toEqual({ ok: false, reason: "Itu akunmu sendiri." });
    expect(checkTestnetAccount("friend.testnet", null)).toEqual({ ok: true, id: "friend.testnet" });
    const alloc = checkAllocation(dead);
    expect(alloc.ok).toBe(false);
    expect(alloc.cost).toBe(1);
    expect(checkDivide({ status: "Active", effectiveVitality: 100, atp: 1n, generation: 1, colonySize: 1, birthBudget: 1 })).toEqual({
      ok: false,
      reason: "Membagi butuh 3 ATP; Snacc ini punya 1.",
    });
    expect(checkPrice("0")).toEqual({ ok: false, reason: "Harga harus lebih dari nol." });
    expect(notConfirmedMessage({ kind: "bought", tokenId: "4", buyerId: "a.testnet" }, "unknown")).toContain("Snacc #4 bukan milikmu.");
  });

  it("writes the simulation log and the receipt line in the saved language, with the same numbers", () => {
    setLocale("en", fakeStore());
    const en = feedStrain(createInitialSimulation());
    setLocale("id", fakeStore());
    const id = feedStrain(createInitialSimulation());
    expect({ ...id.state, log: [] }).toEqual({ ...en.state, log: [] });
    expect(en.state.log[0]).toBe("fed strain: +12 atp, +220 vitality (demo · simulated)");
    expect(id.state.log[0]).toBe("strain diberi makan: +12 atp, +220 vitalitas (demo · simulasi)");
    expect(createInitialSimulation().log[0]).toContain("koloni diisi");
    const poor = { ...createInitialSimulation(), atp: 0 };
    expect(divideStrain(poor).error).toBe("butuh 30 atp untuk membagi");
    expect(receiptLine(10, 4)).toBe("masuk 10 = keluar 4 + tersimpan 6 ✓");
    setLocale("en", fakeStore());
    expect(receiptLine(10, 4)).toBe("in 10 = out 4 + stored 6 ✓");
  });
});
