/**
 * UI-155 (Snacc lineage + feed history in the Strain Detail window) and UI-156 (the graveyard tab of the leaderboard window).
 * Runs in node (no DOM): markup is rendered to a string; Supabase is replaced by a recording fake client. Event payloads in the
 * mapping tests are copied from real snacc-v001.testnet / snacc-market.testnet transactions (hashes in the comments).
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GRAVE_FILTERS,
  buildLineage,
  causeWords,
  countGraves,
  describeHistory,
  filterGraves,
  graveyardRows,
  historyOf,
  lineageIsEmpty,
  lineageOf,
  near,
  normalizeGraves,
  normalizeHistory,
  normalizeLineage,
  relativeTime,
  snacc,
  type GraveRow,
  type HistoryRow,
  type LineageRow,
} from "../src/account/chain.ts";
import { AccountContext, ACCOUNT_OFF, type AccountApi } from "../src/account/session.tsx";
import { HistoryView, INDEX_PENDING, LineageView, NOT_CONFIGURED, StrainLink } from "../src/hud/ChainSections.tsx";
import { GRAVE_PENDING, GraveThumbView, GraveyardList, GraveyardPanel } from "../src/hud/Graveyard.tsx";
import { SocialLeaderboardModal } from "../src/hud/SocialLeaderboardModal.tsx";
import { StrainDetailModal } from "../src/hud/StrainDetailModal.tsx";
import type { StrainDetail } from "../src/data/types.ts";

const NOW = Date.parse("2026-11-13T15:00:00Z");

/** A supabase-js stand-in: every builder call is recorded and the chain resolves to the next queued result. */
function fakeClient(...results: Array<{ data?: unknown; error?: { message: string } | null }>) {
  const log: [string, ...unknown[]][] = [];
  const queue = [...results];
  const chain: unknown = new Proxy(
    {},
    {
      get: (_t, prop: string) =>
        prop === "then"
          ? (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...(queue.shift() ?? {}) }).then(ok, bad)
          : (...args: unknown[]) => {
              log.push([prop, ...args]);
              return chain;
            },
    },
  );
  const client = { from: (t: string) => (log.push(["from", t]), chain) } as unknown as SupabaseClient;
  return { client, log };
}

const lin = (over: Partial<LineageRow>): LineageRow => ({
  child_id: 3,
  parent_id: 1,
  relation: "divided",
  generation: 1,
  actor: "alice.testnet",
  tx_hash: "GVwhXD6kYyb9qDe2nDZMB6RUgsK5FqqTN51kVuYgnYWf",
  block_time: "2026-11-09T12:28:00Z",
  ...over,
});

const hist = (event: string, data: Record<string, unknown>, role: string | null = null, over: Partial<HistoryRow> = {}): HistoryRow => ({
  strain_id: 1,
  event,
  role,
  actor: "snacc-v001.testnet",
  data,
  tx_hash: "EbYbVWzVDnTd5im3wf1TPVS5r4ff1GbZw2QFjTntoiZ3",
  block_time: "2026-11-13T08:24:11Z",
  ...over,
});

const grave = (over: Partial<GraveRow> = {}): GraveRow => ({
  strain_id: 9,
  cause: "harvested_starving",
  by_account: "snacc-v001.testnet",
  absorbed_into: null,
  owner_before: "alice.testnet",
  tx_hash: "AhEk4TNNeTj4orchvXSuPood8vAxTiQNWhZZwSdD9JH9",
  block_time: "2026-11-09T12:30:00Z",
  ...over,
});

describe("UI-155 chain-index row normalizers", () => {
  it("keeps well-formed rows, coerces ids, and drops anything else", () => {
    expect(
      normalizeLineage([
        { child_id: "6", parent_id: 1, relation: "divided", generation: "3", actor: "a.testnet", tx_hash: "T1", block_time: "2026-11-09T12:28:00Z" },
        { child_id: 2, parent_id: 1, relation: "spliced_into", generation: null, actor: null, tx_hash: "T2", block_time: "2026-11-09T12:29:00Z" },
        { child_id: 2, parent_id: 1, relation: "adopted", tx_hash: "T3", block_time: "x" }, // unknown relation
        { child_id: "x", parent_id: 1, relation: "divided", tx_hash: "T4", block_time: "x" }, // id is not a number
        { child_id: 2, parent_id: 1, relation: "hostile" }, // no tx / time
        "nope",
      ]),
    ).toEqual([
      { child_id: 6, parent_id: 1, relation: "divided", generation: 3, actor: "a.testnet", tx_hash: "T1", block_time: "2026-11-09T12:28:00Z" },
      { child_id: 2, parent_id: 1, relation: "spliced_into", generation: null, actor: null, tx_hash: "T2", block_time: "2026-11-09T12:29:00Z" },
    ]);
    expect(normalizeLineage(null)).toEqual([]);
    expect(normalizeHistory([{ strain_id: 1, event: "fed", role: null, actor: "a", data: { x: 1 }, tx_hash: "T", block_time: "t" }, { strain_id: 1 }, { event: "fed" }])).toHaveLength(1);
    expect(normalizeHistory([{ strain_id: 1, event: "fed", data: "bad", tx_hash: "T", block_time: "t" }])[0]?.data).toEqual({});
    expect(normalizeGraves([{ strain_id: 4, cause: "hostile_takeover", by_account: "c", absorbed_into: "1", owner_before: null, tx_hash: "T", block_time: "t" }, { strain_id: 4, cause: "liquidated", tx_hash: "T", block_time: "t" }])).toEqual([
      { strain_id: 4, cause: "hostile_takeover", by_account: "c", absorbed_into: 1, owner_before: null, tx_hash: "T", block_time: "t" },
    ]);
  });
});

describe("UI-155 lineage", () => {
  it("finds the parent, the siblings (other children of that parent), the children and the generation", () => {
    const rows = [lin({ child_id: 3, parent_id: 1, generation: 2 }), lin({ child_id: 8, parent_id: 3, generation: 3 }), lin({ child_id: 9, parent_id: 3, generation: 3 })];
    const siblingRows = [lin({ child_id: 3, parent_id: 1 }), lin({ child_id: 5, parent_id: 1 }), lin({ child_id: 6, parent_id: 1 })];
    const l = buildLineage(3, rows, siblingRows);
    expect(l).toEqual({ parent: 1, generation: 2, children: [8, 9], siblings: [5, 6], absorbed: [], mergedInto: null });
    expect(lineageIsEmpty(l)).toBe(false);
  });

  it("lists what a strain absorbed (splice, hostile takeover) and what it was absorbed into", () => {
    const rows = [
      lin({ child_id: 2, parent_id: 1, relation: "spliced_into", generation: null }),
      lin({ child_id: 3, parent_id: 1, relation: "hostile", generation: null }),
      lin({ child_id: 1, parent_id: 7, relation: "spliced_into", generation: null }),
    ];
    const l = buildLineage(1, rows, []);
    expect(l.absorbed).toEqual([
      { id: 2, relation: "spliced_into" },
      { id: 3, relation: "hostile" },
    ]);
    expect(l.mergedInto).toEqual({ id: 7, relation: "spliced_into" });
    expect(l.parent).toBeNull();
    expect(buildLineage(2, rows, []).mergedInto).toEqual({ id: 1, relation: "spliced_into" });
  });

  it("is empty for a Snacc with no recorded division or merger, and never invents a sibling without a parent", () => {
    const l = buildLineage(5, [], [lin({ child_id: 6, parent_id: 1 })]);
    expect(lineageIsEmpty(l)).toBe(true);
    expect(l.siblings).toEqual([]);
  });

  it("queries every row touching the strain, then the siblings only when it was born by division", async () => {
    const first = fakeClient({ data: [{ child_id: 3, parent_id: 1, relation: "divided", generation: 1, actor: "a", tx_hash: "T", block_time: "2026-11-09T12:28:00Z" }] }, { data: [{ child_id: 3, parent_id: 1, relation: "divided", generation: 1, actor: "a", tx_hash: "T", block_time: "2026-11-09T12:28:00Z" }, { child_id: 4, parent_id: 1, relation: "divided", generation: 1, actor: "a", tx_hash: "T5", block_time: "2026-11-09T12:29:00Z" }] });
    const got = await lineageOf(first.client, 3);
    expect(got.rows).toHaveLength(1);
    expect(got.siblingRows.map((r) => r.child_id)).toEqual([3, 4]);
    expect(first.log).toEqual(
      expect.arrayContaining([
        ["from", "strain_lineage_snacc"],
        ["or", "child_id.eq.3,parent_id.eq.3"],
        ["eq", "parent_id", 1],
        ["eq", "relation", "divided"],
      ]),
    );

    const noParent = fakeClient({ data: [] });
    expect(await lineageOf(noParent.client, 3)).toEqual({ rows: [], siblingRows: [] });
    expect(noParent.log.filter(([m]) => m === "from")).toHaveLength(1); // no second query

    expect(await lineageOf(noParent.client, -1)).toEqual({ rows: [], siblingRows: [] });
    await expect(lineageOf(fakeClient({ error: { message: "boom" } }).client, 3)).rejects.toThrow("boom");
  });
});

describe("UI-155 history in plain words (real event payloads)", () => {
  it("describes feeds, hatching and the production events with exact amounts", () => {
    // fed: tx EbYbVWzV..., strain_created: tx zx8ASZjo... (both 2026-11-13)
    expect(describeHistory(hist("fed", { strain_id: 10, effective_fee: "42416000000000000000000", dormant: false }))).toBe("fed (fee 0.0424 $SNACC)");
    expect(describeHistory(hist("fed", { effective_fee: "390550000000000000000", dormant: true }))).toBe("fed (fee 0.0003 $SNACC), woke up from dormancy");
    expect(describeHistory(hist("strain_created", { owner_id: "snacc-v001.testnet", initial_snacc_stake: "250000000000000000000000" }))).toBe("hatched by snacc-v001.testnet with 0.25 $SNACC");
    expect(describeHistory(hist("extracted", { amount: 1, token: "mt:spore-ignis" }))).toBe("produced 1 mt:spore-ignis");
    expect(describeHistory(hist("transmuted", { burned_spores: 2, minted: 3, token_out: "mt:enzyme-x" }))).toBe("transmuted 2 spores into 3 mt:enzyme-x");
    expect(describeHistory(hist("atp_allocated", { mitokondria: 2, nukleus: 1, lisosom: 0 }))).toBe("allocated ATP: mitochondria 2, nucleus 1, lysosome 0");
    expect(describeHistory(hist("dividend_claimed", { payout: "5000000000000000000000", epoch: 2 }))).toBe("claimed 0.005 $SNACC from the industrial pool (epoch 2)");
    expect(describeHistory(hist("genome_mutated", { efficiency_shift_bps: -150 }))).toBe("genome mutated (efficiency -1.50%)");
    expect(describeHistory(hist("npc_spores_bought", { amount: 4, npc_id: "npc-vulture-ma" }))).toBe("bought 4 spores from npc-vulture-ma");
  });

  it("describes divide, splice, hostile takeover, adopt, harvest and transfers from the strain's own point of view", () => {
    const divided = { parent_id: 1, child_id: 6, child_generation: 3 }; // tx GVwhXD6k...
    expect(describeHistory(hist("strain_divided", divided, "parent"))).toBe("divided: child #6 born (generation 3)");
    expect(describeHistory(hist("strain_divided", divided, "child"))).toBe("born by division of #1 (generation 3)");
    const spliced = { dominant_id: 5, absorbed_id: 1 }; // tx 8M41CAwA...
    expect(describeHistory(hist("strains_spliced", spliced, "dominant"))).toBe("spliced: absorbed #1");
    expect(describeHistory(hist("strains_spliced", spliced, "absorbed"))).toBe("spliced into #5 and burned");
    const hostile = { raider_id: 4, target_id: 7, payment: "46000000000000000000000" }; // tx 4o4qwoGZ...
    expect(describeHistory(hist("hostile_takeover_spliced", hostile, "raider"))).toBe("hostile takeover: absorbed #7 (paid 0.046 $SNACC)");
    expect(describeHistory(hist("hostile_takeover_spliced", hostile, "target"))).toBe("taken over by #4 in a hostile takeover");
    const adopted = { target_id: 9, adopter: "x207-demo-buyer.testnet", raider_strain_id: 8, book_value: "40000000000000000000000" }; // tx 7w3tBNjL...
    expect(describeHistory(hist("strain_adopted", adopted, "target"))).toBe("adopted by x207-demo-buyer.testnet");
    expect(describeHistory(hist("strain_adopted", adopted, "payer"))).toBe("paid 0.04 $SNACC to adopt #9");
    expect(describeHistory(hist("strain_liquidated", { target_id: 9, liquidator: "snacc-v001.testnet" }))).toBe("starved and was harvested by snacc-v001.testnet"); // tx AhEk4TNN...
    expect(describeHistory(hist("nft_transfer", { old_owner_id: "snacc-v001.testnet", new_owner_id: "x207-demo-buyer.testnet", token_ids: ["4"] }))).toBe(
      "transferred from snacc-v001.testnet to x207-demo-buyer.testnet",
    ); // tx HfhZG6sA...
    expect(describeHistory(hist("trait_conjugated", { from_strain_id: 2, to_strain_id: 3, phenotype_trait: "glow" }, "source"))).toBe("shared trait “glow” with #3");
    expect(describeHistory(hist("trait_conjugated", { from_strain_id: 2, to_strain_id: 3, phenotype_trait: "glow" }, "target"))).toBe("received trait “glow” from #2");
  });

  it("describes the market events (testnet NEAR), and falls back to the event name", () => {
    // snacc-market.testnet txs 6JF7XvVD... (listed), 86HXrAAQ... (sold), 8Q3p33jw... (delisted), 2026-11-13
    expect(describeHistory(hist("listed", { token_id: "11", seller_id: "snacc-v001.testnet", price: "100000000000000000000000" }))).toBe("listed on the market for 0.1 testnet NEAR");
    expect(describeHistory(hist("sold", { token_id: "11", buyer_id: "snacc-starter.testnet", price: "100000000000000000000000" }))).toBe("sold to snacc-starter.testnet for 0.1 testnet NEAR");
    expect(describeHistory(hist("delisted", { token_id: "11", reason: "seller" }))).toBe("taken off the market (by the seller)");
    expect(describeHistory(hist("delisted", { token_id: "11", reason: "token_left_market" }))).toBe("taken off the market (the token left the market)");
    expect(describeHistory(hist("price_updated", { old_price: "100000000000000000000000", new_price: "250000000000000000000000" }))).toBe("market price changed to 0.25 testnet NEAR (was 0.1)");
    expect(describeHistory(hist("some_future_event", {}))).toBe("some future event");
    expect(snacc(undefined)).toBe("?");
    expect(near("1")).toBe("<0.0001");
  });

  it("reads history newest first, 20 at most, for one strain", async () => {
    const fake = fakeClient({ data: [{ strain_id: 1, event: "fed", role: null, actor: "a", data: { effective_fee: "1" }, tx_hash: "T", block_time: "2026-11-13T08:24:11Z" }] });
    expect(await historyOf(fake.client, 1)).toHaveLength(1);
    expect(fake.log).toEqual(
      expect.arrayContaining([["from", "strain_history_snacc"], ["eq", "strain_id", 1], ["order", "block_time", { ascending: false }], ["order", "block_height", { ascending: false }], ["limit", 20]]),
    );
    await expect(historyOf(fakeClient({ error: { message: "nope" } }).client, 1)).rejects.toThrow("nope");
    expect(await historyOf(fake.client, Number.NaN)).toEqual([]);
  });

  it("says how long ago, and falls back to the date after two weeks", () => {
    const ago = (s: number) => new Date(NOW - s * 1000).toISOString();
    expect(relativeTime(ago(10), NOW)).toBe("just now");
    expect(relativeTime(ago(60), NOW)).toBe("1 min ago");
    expect(relativeTime(ago(5 * 60), NOW)).toBe("5 min ago");
    expect(relativeTime(ago(3 * 3600), NOW)).toBe("3 h ago");
    expect(relativeTime(ago(26 * 3600), NOW)).toBe("1 day ago");
    expect(relativeTime(ago(5 * 86400), NOW)).toBe("5 days ago");
    expect(relativeTime(ago(30 * 86400), NOW)).toBe("2026-10-14");
    expect(relativeTime("not a date", NOW)).toBe("—");
  });
});

describe("UI-155 lineage and history sections", () => {
  const lineage = buildLineage(
    3,
    [lin({ child_id: 3, parent_id: 1, generation: 2 }), lin({ child_id: 8, parent_id: 3 }), lin({ child_id: 2, parent_id: 3, relation: "hostile", generation: null }), lin({ child_id: 3, parent_id: 11, relation: "spliced_into", generation: null })],
    [lin({ child_id: 3, parent_id: 1 }), lin({ child_id: 5, parent_id: 1 })],
  );

  it("shows parent, children, siblings, absorbed and absorbed-into, each id a button that opens that Snacc", () => {
    const opened: number[] = [];
    const html = renderToStaticMarkup(<LineageView state={{ kind: "ok", value: lineage }} generation={2} onOpen={(id) => opened.push(id)} />);
    expect(html).toContain('data-testid="strain-lineage"');
    expect(html).toContain("generation #2");
    for (const id of [1, 8, 5, 2, 11]) expect(html).toContain(`data-testid="chain-link-${id}"`);
    expect(html).toContain("(hostile takeover)");
    expect(html).toContain("(splice)");
    expect(html).toContain("absorbed into");
    expect(html).toMatch(/<button[^>]*chain-link-1"[^>]*aria-label="open strain 1"/);
    expect(opened).toEqual([]);
  });

  it("renders ids as plain text without a handler, and a plain StrainLink is a span", () => {
    const html = renderToStaticMarkup(<LineageView state={{ kind: "ok", value: lineage }} generation={2} />);
    expect(html).not.toContain("<button");
    expect(html).toContain("#8");
    expect(renderToStaticMarkup(<StrainLink id={4} />)).toBe('<span class="fd-num">#4</span>');
  });

  it("says so when the profile database is off, still loading, failed, or has nothing for this Snacc", () => {
    expect(renderToStaticMarkup(<LineageView state={{ kind: "off" }} generation={1} />)).toContain(NOT_CONFIGURED);
    expect(renderToStaticMarkup(<LineageView state={{ kind: "loading" }} generation={1} />)).toContain("reading the chain index");
    expect(renderToStaticMarkup(<LineageView state={{ kind: "error" }} generation={1} />)).toContain('data-testid="lineage-error"');
    const empty = renderToStaticMarkup(<LineageView state={{ kind: "ok", value: buildLineage(5, [], []) }} generation={0} />);
    expect(empty).toContain('data-testid="lineage-empty"');
    expect(empty).toContain("History appears once the chain index has caught up.");
    expect(INDEX_PENDING).toBe("History appears once the chain index has caught up.");
  });

  it("lists the latest events with a relative time and the explorer link of each transaction", () => {
    const rows = [
      hist("fed", { effective_fee: "42416000000000000000000", dormant: false }, null, { block_time: "2026-11-13T14:00:00Z" }),
      hist("strain_divided", { parent_id: 1, child_id: 6, child_generation: 3 }, "parent", { tx_hash: "GVwhXD6kYyb9qDe2nDZMB6RUgsK5FqqTN51kVuYgnYWf", block_time: "2026-11-09T12:28:00Z" }),
    ];
    const html = renderToStaticMarkup(<HistoryView state={{ kind: "ok", value: rows }} nowMs={NOW} />);
    expect(html).toContain('data-testid="history-list"');
    expect((html.match(/class="chain-event"/g) ?? []).length).toBe(2);
    expect(html).toContain("fed (fee 0.0424 $SNACC)");
    expect(html).toContain("1 h ago");
    expect(html).toContain("4 days ago");
    expect(html).toContain('dateTime="2026-11-13T14:00:00Z"');
    expect(html).toContain('href="https://testnet.nearblocks.io/txns/EbYbVWzVDnTd5im3wf1TPVS5r4ff1GbZw2QFjTntoiZ3"');
    expect(html).toContain('href="https://testnet.nearblocks.io/txns/GVwhXD6kYyb9qDe2nDZMB6RUgsK5FqqTN51kVuYgnYWf"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("falls back to the catch-up text when the index is empty or the database is off", () => {
    expect(renderToStaticMarkup(<HistoryView state={{ kind: "ok", value: [] }} nowMs={NOW} />)).toContain(INDEX_PENDING);
    expect(renderToStaticMarkup(<HistoryView state={{ kind: "off" }} nowMs={NOW} />)).toContain(NOT_CONFIGURED);
    expect(renderToStaticMarkup(<HistoryView state={{ kind: "error" }} nowMs={NOW} />)).toContain('data-testid="history-error"');
  });
});

describe("UI-155 inside the Strain Detail window", () => {
  const strain: StrainDetail = {
    strain_id: 7,
    owner_id: "alice.testnet",
    vault_subaccount: "v7.alice.testnet",
    vitality: 7200,
    efficiency_bps: 10000,
    bmr_per_hour: 100,
    last_fed_sec: 0,
    role_mask: 0,
    state_nonce: 1,
    pending_callbacks: 0,
    atp_balance: "5",
    generation: 3,
    organel: { mitokondria: 1, nukleus: 2, lisosom: 0 },
    status: "Active",
    effective_vitality: 7100,
  };
  const detail = (mode: "demo" | "live", account?: AccountApi) =>
    renderToStaticMarkup(
      <AccountContext.Provider value={account ?? ACCOUNT_OFF}>
        <StrainDetailModal strain={strain} skin="biolab" mode={mode} onClose={() => {}} />
      </AccountContext.Provider>,
    );

  it("adds a Lineage and a History section in live mode, with the contract's generation", () => {
    const html = detail("live");
    expect(html).toContain('data-testid="strain-lineage"');
    expect(html).toContain('data-testid="strain-history"');
    expect(html).toContain("generation #3");
    expect(html).toContain(NOT_CONFIGURED); // no Supabase in this build: plain text, nothing invented
  });

  it("shows the loading state while the profile database is configured and the client is being read", () => {
    const account: AccountApi = { ...ACCOUNT_OFF, enabled: true, status: "idle" };
    const html = detail("live", account);
    expect(html).toContain("reading the chain index");
    expect(html).not.toContain(NOT_CONFIGURED);
  });

  it("leaves the demo window alone: demo strains have no chain history", () => {
    const html = detail("demo");
    expect(html).not.toContain("strain-lineage");
    expect(html).not.toContain("strain-history");
  });
});

describe("UI-156 graveyard", () => {
  const rows: GraveRow[] = [
    grave({ strain_id: 9, cause: "harvested_starving", by_account: "hal.testnet", owner_before: "alice.testnet" }),
    grave({ strain_id: 1, cause: "spliced_burned", by_account: "alice.testnet", absorbed_into: 5, owner_before: "alice.testnet", tx_hash: "8M41CAwAE2HY9twCsgz5fHWrt5j8UPV2i9vZmH6nQ2Nb" }),
    grave({ strain_id: 7, cause: "hostile_takeover", by_account: "x207-demo-buyer.testnet", absorbed_into: 4, owner_before: "bob.testnet", tx_hash: "4o4qwoGZtR7HE5E3VnjQZpXwDicpa9QVBzXHS1YP2v4f" }),
    grave({ strain_id: 12, cause: "harvested_starving", by_account: "erin.testnet", owner_before: null }),
  ];

  it("says what happened and who did it in plain words", () => {
    expect(causeWords(rows[0] as GraveRow)).toBe("starved to zero vitality and was harvested by hal.testnet");
    expect(causeWords(rows[1] as GraveRow)).toBe("spliced into #5 by alice.testnet");
    expect(causeWords(rows[2] as GraveRow)).toBe("absorbed by #4 in a hostile takeover by x207-demo-buyer.testnet");
    expect(causeWords(grave({ cause: "spliced_burned", absorbed_into: null, by_account: null }))).toBe("spliced away by someone");
  });

  it("filters: all, harvested (starved), spliced (splice + hostile takeover) and mine (owned when it died)", () => {
    const ids = (f: (typeof GRAVE_FILTERS)[number]["id"], me: string | null) => filterGraves(rows, f, me).map((r) => r.strain_id);
    expect(ids("all", null)).toEqual([9, 1, 7, 12]);
    expect(ids("harvested", null)).toEqual([9, 12]);
    expect(ids("spliced", null)).toEqual([1, 7]);
    expect(ids("mine", "alice.testnet")).toEqual([9, 1]);
    expect(ids("mine", "bob.testnet")).toEqual([7]);
    expect(ids("mine", null)).toEqual([]);
    expect(countGraves(rows, "alice.testnet")).toEqual({ all: 4, harvested: 2, spliced: 2, mine: 2 });
    expect(GRAVE_FILTERS.map((f) => f.id)).toEqual(["all", "harvested", "spliced", "mine"]);
  });

  it("reads the newest deaths first", async () => {
    const fake = fakeClient({ data: [{ strain_id: 9, cause: "harvested_starving", by_account: "hal.testnet", absorbed_into: null, owner_before: "alice.testnet", tx_hash: "T", block_time: "2026-11-09T12:30:00Z" }] });
    expect(await graveyardRows(fake.client)).toHaveLength(1);
    expect(fake.log).toEqual(expect.arrayContaining([["from", "graveyard_snacc"], ["order", "block_time", { ascending: false }], ["limit", 200]]));
    await expect(graveyardRows(fakeClient({ error: { message: "down" } }).client)).rejects.toThrow("down");
  });

  it("renders each row with its id, cause, owner, time and explorer link, and a plain tile when there is no SVG", () => {
    const html = renderToStaticMarkup(<GraveyardList rows={rows.slice(0, 3)} nowMs={NOW} />);
    expect((html.match(/class="grave-row"/g) ?? []).length).toBe(3);
    for (const id of [9, 1, 7]) expect(html).toContain(`strain #${id}`);
    expect(html).toContain("starved to zero vitality and was harvested by hal.testnet");
    expect(html).toContain("owned by bob.testnet");
    expect(html).toContain("4 days ago");
    expect(html).toContain('href="https://testnet.nearblocks.io/txns/4o4qwoGZtR7HE5E3VnjQZpXwDicpa9QVBzXHS1YP2v4f"');
    expect(html).toContain('aria-label="no on-chain svg for strain 9"');
    expect(renderToStaticMarkup(<GraveyardList rows={[grave({ owner_before: null })]} nowMs={NOW} />)).toContain("owner not recorded");
  });

  it("falls back to the plain tile when there is no SVG or the image fails to load, so a row never shows a broken image", () => {
    const tile = renderToStaticMarkup(<GraveThumbView strainId={9} src={null} />);
    expect(tile).toContain('aria-label="no on-chain svg for strain 9"');
    expect(tile).toContain("no svg");
    expect(tile).not.toContain("<img");

    const src = "data:image/svg+xml;base64,PHN2Zy8+";
    const shown = renderToStaticMarkup(<GraveThumbView strainId={9} src={src} />);
    expect(shown).toContain("<img");
    expect(shown).toContain(`src="${src}"`);
    expect(shown).not.toContain("no svg");

    // `onError` is wired: when the browser cannot decode the image the parent drops `src` and the tile above is shown instead.
    let failed = 0;
    const img = GraveThumbView({ strainId: 9, src, onImageError: () => (failed += 1) }) as ReactElement<{ onError?: () => void }>;
    expect(img.type).toBe("img");
    expect(typeof img.props.onError).toBe("function");
    img.props.onError?.();
    expect(failed).toBe(1);
    // The rows in the list use the same thumbnail component.
    expect(renderToStaticMarkup(<GraveyardList rows={[rows[0] as GraveRow]} nowMs={NOW} />)).toContain('class="grave-thumb"');
  });

  it("starts in the reading state with all four filters, and says it is real history in demo mode", () => {
    const html = renderToStaticMarkup(<GraveyardPanel client={null} account="alice.testnet" live={false} />);
    for (const f of ["all", "harvested", "spliced", "mine"]) expect(html).toContain(`data-testid="graveyard-filter-${f}"`);
    expect(html).toContain("reading graveyard_snacc");
    expect(html).toContain('data-testid="graveyard-demo-note"');
    expect(html).toContain("not a simulation");
    expect(GRAVE_PENDING).toContain("chain index");
    expect(renderToStaticMarkup(<GraveyardPanel client={null} account={null} />)).not.toContain("graveyard-demo-note");
  });

  it("adds a graveyard tab to the leaderboard window: five tabs with the player boards, two without a client", () => {
    const withClient: AccountApi = { ...ACCOUNT_OFF, enabled: true, status: "idle", client: {} as SupabaseClient };
    const full = renderToStaticMarkup(
      <AccountContext.Provider value={withClient}>
        <SocialLeaderboardModal onClose={() => {}} appetite={null} mode="demo" />
      </AccountContext.Provider>,
    );
    for (const label of ["top feeders", "most active (7 days)", "longest streaks", "season xp", "graveyard"]) expect(full).toContain(label);
    expect((full.match(/role="tab"/g) ?? []).length).toBe(5);

    const noClient: AccountApi = { ...ACCOUNT_OFF, enabled: true, status: "idle" };
    const publicOnly = renderToStaticMarkup(
      <AccountContext.Provider value={noClient}>
        <SocialLeaderboardModal onClose={() => {}} appetite={null} mode="live" />
      </AccountContext.Provider>,
    );
    expect((publicOnly.match(/role="tab"/g) ?? []).length).toBe(2);
    expect(publicOnly).toContain("graveyard");

    const off = renderToStaticMarkup(<SocialLeaderboardModal onClose={() => {}} appetite={null} mode="demo" />);
    expect(off).not.toContain("graveyard");
    expect(off).not.toContain('role="tab"');
  });
});
