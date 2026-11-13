/**
 * UI-164 (Market window): price math, the market call builders, listing parsing and readers, the
 * read-back after a success, the wallet receiver guard and the markup of the pure list/confirm parts.
 * Runs in node (no DOM): markup is rendered to a string; chain reads are injected.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CONTRACT_ID,
  MARKET_GAS,
  MARKET_ID,
  MARKET_RPCS,
  MAX_PRICE_YOCTO,
  PAGE_SIZE,
  buildBuy,
  buildDelist,
  buildList,
  buildUpdatePrice,
  buyBlockReason,
  checkPrice,
  confirmExpectation,
  enrichListings,
  fetchListingCount,
  fetchListingsPage,
  fetchSellerListings,
  isValidPriceYocto,
  listingMsg,
  nearToYocto,
  notConfirmedMessage,
  pageCount,
  parseListing,
  parseListings,
  priceLabel,
  yoctoToNear,
  type ChainView,
  type Listing,
  type MarketRow,
} from "../src/chain/market.ts";
import { toWalletActions } from "../src/chain/actions.ts";
import { humanizeTxError, readOutcome } from "../src/chain/txResult.ts";
import { DISCONNECTED_WALLET, SIGNABLE_RECEIVERS, resolveReceiver } from "../src/chain/wallet.tsx";
import { viewCall } from "../src/data/nearView.ts";
import type { StrainDetail } from "../src/data/types.ts";
import { TOOLS } from "../src/hud/ToolsToolbar.tsx";
import { BuyConfirm, ListingList, ListingRow, MarketModal, MarketTxStatus, sellableItems } from "../src/hud/MarketModal.tsx";
import { EMPTY_ACCOUNT_INFO } from "../src/chain/useAccountInfo.ts";
import type { CollectionItem } from "../src/data/collection.ts";

const TGAS = 10n ** 12n;
const ONE_NEAR = "1000000000000000000000000";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320"/></svg>`;
const MEDIA = `data:image/svg+xml;base64,${Buffer.from(SVG).toString("base64")}`;

function vessel(id: number, over: Partial<StrainDetail> = {}): StrainDetail {
  return {
    strain_id: id,
    owner_id: MARKET_ID,
    vault_subaccount: `s-${id}-1.${CONTRACT_ID}`,
    vitality: 8500,
    efficiency_bps: 10000,
    bmr_per_hour: 100,
    last_fed_sec: 1794227318,
    role_mask: 1,
    state_nonce: 0,
    pending_callbacks: 0,
    atp_balance: "50",
    generation: 3,
    organel: { mitokondria: 1, nukleus: 1, lisosom: 1 },
    status: "Active",
    effective_vitality: 8000,
    ...over,
  };
}

const listing = (id: string, seller = "alice.testnet", price = ONE_NEAR): Listing => ({ tokenId: id, sellerId: seller, priceYocto: price, listedAtNs: "1763000000000000000" });
const row = (id: string, over: { seller?: string; price?: string; v?: Partial<StrainDetail> | null; media?: string | null } = {}): MarketRow => ({
  listing: listing(id, over.seller, over.price),
  vessel: over.v === null ? null : vessel(Number(id), over.v),
  mediaSrc: over.media === undefined ? MEDIA : over.media,
});

describe("price math (exact, no floats)", () => {
  it("converts NEAR text to yocto exactly", () => {
    expect(nearToYocto("1")).toBe(ONE_NEAR);
    expect(nearToYocto("1.5")).toBe("1500000000000000000000000");
    expect(nearToYocto(".5")).toBe("500000000000000000000000");
    expect(nearToYocto("0.000000000000000000000001")).toBe("1");
    expect(nearToYocto("  2.25 ")).toBe("2250000000000000000000000");
    expect(nearToYocto("0.1")).toBe("100000000000000000000000");
    expect(nearToYocto("10000")).toBe(MAX_PRICE_YOCTO.toString());
    // a whole part above 2^53 keeps every digit
    expect(nearToYocto("9007199254740993")).toBe("9007199254740993000000000000000000000000");
  });

  it("rejects text that is not a plain decimal with at most 24 decimals", () => {
    for (const bad of ["", " ", ".", "1.", "1e3", "-1", "+1", "1,5", "1.5.2", "0x10", "1 5", "NaN", "Infinity", "0.0000000000000000000000001"]) {
      expect(nearToYocto(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("formats yocto back to NEAR with every digit and trimmed zeros", () => {
    expect(yoctoToNear(ONE_NEAR)).toBe("1");
    expect(yoctoToNear("1500000000000000000000000")).toBe("1.5");
    expect(yoctoToNear("1")).toBe("0.000000000000000000000001");
    expect(yoctoToNear(0n)).toBe("0");
    expect(yoctoToNear(MAX_PRICE_YOCTO)).toBe("10000");
    expect(yoctoToNear("1000000000000000000000001")).toBe("1.000000000000000000000001");
    for (const s of ["0.5", "12.345678901234567890123456", "9999.999999999999999999999999"]) expect(yoctoToNear(nearToYocto(s)!)).toBe(s);
  });

  it("checks the price against the contract limits (> 0, <= 10,000 NEAR)", () => {
    expect(checkPrice("1.5")).toEqual({ ok: true, yocto: "1500000000000000000000000" });
    expect(checkPrice("0.000000000000000000000001")).toEqual({ ok: true, yocto: "1" });
    expect(checkPrice("10000")).toEqual({ ok: true, yocto: MAX_PRICE_YOCTO.toString() });
    expect(checkPrice("10000.000000000000000000000001")).toMatchObject({ ok: false, reason: expect.stringContaining("at most 10,000 NEAR") });
    expect(checkPrice("99999999999999999999999")).toMatchObject({ ok: false });
    expect(checkPrice("0")).toMatchObject({ ok: false, reason: expect.stringContaining("greater than zero") });
    expect(checkPrice("0.0")).toMatchObject({ ok: false, reason: expect.stringContaining("greater than zero") });
    expect(checkPrice("")).toMatchObject({ ok: false, reason: expect.stringContaining("Enter a price") });
    expect(checkPrice("abc")).toMatchObject({ ok: false, reason: expect.stringContaining("24 decimals") });
    expect(checkPrice("1.1234567890123456789012345")).toMatchObject({ ok: false });
  });

  it("validates a yocto price string the way the contract does", () => {
    expect(isValidPriceYocto("1")).toBe(true);
    expect(isValidPriceYocto(MAX_PRICE_YOCTO.toString())).toBe(true);
    expect(isValidPriceYocto((MAX_PRICE_YOCTO + 1n).toString())).toBe(false);
    expect(isValidPriceYocto("0")).toBe(false);
    expect(isValidPriceYocto("1.5")).toBe(false);
    expect(isValidPriceYocto("")).toBe(false);
    expect(isValidPriceYocto("-1")).toBe(false);
  });

  it("labels a price for lists", () => {
    expect(priceLabel("1500000000000000000000000")).toBe("1.5 NEAR");
    expect(priceLabel("1")).toMatch(/^<0\.0+1 NEAR$/);
  });
});

describe("call builders", () => {
  it("lists with nft_transfer_call on the Snacc contract: msg JSON, 100 TGas, 1 yocto", () => {
    const tx = buildList({ strainId: 7, priceYocto: "1500000000000000000000000" });
    expect(tx.receiverId).toBe(CONTRACT_ID);
    expect(tx.call.methodName).toBe("nft_transfer_call");
    expect(tx.call.gas).toBe((100n * TGAS).toString());
    expect(tx.call.deposit).toBe("1");
    expect(Object.keys(tx.call.args).sort()).toEqual(["msg", "receiver_id", "token_id"]);
    expect(tx.call.args.receiver_id).toBe(MARKET_ID);
    expect(tx.call.args.token_id).toBe("7");
    expect(tx.call.args.msg).toBe('{"price":"1500000000000000000000000"}');
    expect(JSON.parse(tx.call.args.msg as string)).toEqual({ price: "1500000000000000000000000" });
  });

  it("the listing msg is exactly {\"price\":\"<yocto>\"} and refuses prices the market would refuse", () => {
    expect(listingMsg("1")).toBe('{"price":"1"}');
    expect(listingMsg(MAX_PRICE_YOCTO.toString())).toBe('{"price":"10000000000000000000000000000"}');
    expect(() => listingMsg("0")).toThrow();
    expect(() => listingMsg((MAX_PRICE_YOCTO + 1n).toString())).toThrow();
    expect(() => listingMsg("1.5")).toThrow();
    expect(() => listingMsg("")).toThrow();
  });

  it("buys on the market with deposit = price and 150 TGas", () => {
    const tx = buildBuy({ tokenId: "7", priceYocto: ONE_NEAR });
    expect(tx).toEqual({
      receiverId: MARKET_ID,
      call: { methodName: "buy", args: { token_id: "7" }, gas: (150n * TGAS).toString(), deposit: ONE_NEAR },
    });
    expect(MARKET_GAS.buy).toBe((150n * TGAS).toString());
    expect(BigInt(MARKET_GAS.delist)).toBeGreaterThanOrEqual(150n * TGAS);
  });

  it("delists and reprices on the market with exactly 1 yocto", () => {
    expect(buildDelist({ tokenId: "12" })).toEqual({
      receiverId: MARKET_ID,
      call: { methodName: "delist", args: { token_id: "12" }, gas: (150n * TGAS).toString(), deposit: "1" },
    });
    const up = buildUpdatePrice({ tokenId: "12", priceYocto: "2500000000000000000000000" });
    expect(up.receiverId).toBe(MARKET_ID);
    expect(up.call.methodName).toBe("update_price");
    expect(up.call.args).toEqual({ token_id: "12", price: "2500000000000000000000000" });
    expect(up.call.deposit).toBe("1");
    expect(BigInt(up.call.gas)).toBeGreaterThan(0n);
  });

  it("refuses bad ids and prices before anything reaches a wallet", () => {
    expect(() => buildList({ strainId: 0, priceYocto: ONE_NEAR })).toThrow();
    expect(() => buildList({ strainId: 1.5, priceYocto: ONE_NEAR })).toThrow();
    expect(() => buildList({ strainId: 7, priceYocto: "0" })).toThrow();
    expect(() => buildBuy({ tokenId: "", priceYocto: ONE_NEAR })).toThrow();
    expect(() => buildBuy({ tokenId: "07", priceYocto: ONE_NEAR })).toThrow();
    expect(() => buildBuy({ tokenId: "7", priceYocto: "0" })).toThrow();
    expect(() => buildDelist({ tokenId: "abc" })).toThrow();
    expect(() => buildUpdatePrice({ tokenId: "7", priceYocto: (MAX_PRICE_YOCTO + 1n).toString() })).toThrow();
  });

  it("turns into wallet FunctionCall actions unchanged", () => {
    const tx = buildBuy({ tokenId: "7", priceYocto: ONE_NEAR });
    expect(toWalletActions([tx.call])).toEqual([{ type: "FunctionCall", params: { methodName: "buy", args: { token_id: "7" }, gas: tx.call.gas, deposit: ONE_NEAR } }]);
  });
});

describe("wallet receiver guard", () => {
  it("defaults to the Snacc contract and signs only for the Snacc contract and the market", () => {
    expect(resolveReceiver()).toBe(CONTRACT_ID);
    expect(resolveReceiver(CONTRACT_ID)).toBe(CONTRACT_ID);
    expect(resolveReceiver(MARKET_ID)).toBe(MARKET_ID);
    expect(resolveReceiver("evil.testnet")).toBeNull();
    expect(resolveReceiver("")).toBeNull();
    expect(resolveReceiver("snacc-v001.near")).toBeNull();
    expect([...SIGNABLE_RECEIVERS].sort()).toEqual([CONTRACT_ID, MARKET_ID].sort());
  });

  it("the disconnected wallet still refuses with and without a receiver", async () => {
    expect((await DISCONNECTED_WALLET.signAndSend([])).ok).toBe(false);
    expect((await DISCONNECTED_WALLET.signAndSend([], MARKET_ID)).ok).toBe(false);
  });
});

describe("error text for market refusals", () => {
  it("maps the market panic codes to plain English", () => {
    expect(humanizeTxError("Smart contract panicked: ERR_LISTING_NOT_FOUND", "buy").message).toMatch(/listing is gone/);
    expect(humanizeTxError("ERR_SELLER_CANNOT_BUY", "buy").message).toMatch(/own listing/);
    expect(humanizeTxError("ERR_INSUFFICIENT_DEPOSIT", "buy").message).toMatch(/below the listed price/);
    expect(humanizeTxError("ERR_NOT_SELLER", "delist").message).toMatch(/Only the seller/);
    expect(humanizeTxError("ERR_BAD_PRICE", "update_price").message).toMatch(/10,000 NEAR/);
    expect(humanizeTxError("ERR_MORE_GAS_REQUIRED", "buy").message).toMatch(/gas/);
    expect(humanizeTxError("ERR_NOT_OWNED_BY_CALLEE", "nft_transfer_call").message).toMatch(/list a Snacc you own/);
  });

  it("reads a failure inside a wallet outcome for a market call", () => {
    const r = readOutcome({ transaction: { hash: "H1" }, status: { Failure: { ActionError: { kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: ERR_LISTING_NOT_FOUND" } } } } } }, "buy");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/listing is gone/);
  });
});

describe("listing parsing", () => {
  const raw = { token_id: "7", seller_id: "alice.testnet", price: ONE_NEAR, listed_at: "1763000000000000000" };

  it("reads a Listing as the market documents it", () => {
    expect(parseListing(raw)).toEqual({ tokenId: "7", sellerId: "alice.testnet", priceYocto: ONE_NEAR, listedAtNs: "1763000000000000000" });
    // small numbers may arrive unquoted
    expect(parseListing({ ...raw, price: 5, listed_at: 100 })).toMatchObject({ priceYocto: "5", listedAtNs: "100" });
  });

  it("drops malformed entries", () => {
    expect(parseListing(null)).toBeNull();
    expect(parseListing([])).toBeNull();
    expect(parseListing({ ...raw, token_id: "abc" })).toBeNull();
    expect(parseListing({ ...raw, token_id: 7 })).toBeNull();
    expect(parseListing({ ...raw, seller_id: "" })).toBeNull();
    expect(parseListing({ ...raw, price: "0" })).toBeNull();
    expect(parseListing({ ...raw, price: "1.5" })).toBeNull();
    expect(parseListing({ ...raw, listed_at: undefined })).toBeNull();
    expect(parseListings([raw, { nope: 1 }, { ...raw, token_id: "8" }])?.map((l) => l.tokenId)).toEqual(["7", "8"]);
    expect(parseListings(null)).toBeNull();
    expect(parseListings({})).toBeNull();
    expect(parseListings([])).toEqual([]);
  });
});

describe("market readers", () => {
  const calls: Array<{ contract: string; method: string; args: unknown }> = [];
  const make = (answers: Record<string, unknown>): ChainView =>
    (async <T,>(contract: string, method: string, args: unknown) => {
      calls.push({ contract, method, args });
      const v = answers[`${contract}:${method}`];
      return (v === undefined ? null : v) as T | null;
    }) as ChainView;

  it("pages get_listings with a string from_index and a capped limit", async () => {
    calls.length = 0;
    const view = make({ [`${MARKET_ID}:get_listings`]: [{ token_id: "7", seller_id: "a.testnet", price: "5", listed_at: "9" }] });
    expect(await fetchListingsPage(16, PAGE_SIZE, view)).toHaveLength(1);
    expect(calls[0]).toEqual({ contract: MARKET_ID, method: "get_listings", args: { from_index: "16", limit: PAGE_SIZE } });
    await fetchListingsPage(-5, 5000, view);
    expect(calls[1].args).toEqual({ from_index: "0", limit: 100 });
  });

  it("reads one seller's listings and the count; null means the RPC did not answer", async () => {
    calls.length = 0;
    const view = make({ [`${MARKET_ID}:get_listings_by_seller`]: [], [`${MARKET_ID}:get_listing_count`]: 3 });
    expect(await fetchSellerListings("alice.testnet", view)).toEqual([]);
    expect(calls[0].args).toEqual({ seller_id: "alice.testnet", from_index: "0", limit: 100 });
    expect(await fetchListingCount(view)).toBe(3);
    expect(await fetchListingCount(make({}))).toBeNull();
    expect(await fetchListingsPage(0, 8, make({}))).toBeNull();
  });

  it("joins each listing with get_strain and the nft_token svg", async () => {
    calls.length = 0;
    const view = make({
      [`${CONTRACT_ID}:nft_token`]: { token_id: "7", owner_id: MARKET_ID, metadata: { media: MEDIA } },
      [`${CONTRACT_ID}:get_strain`]: {
        ...vessel(7),
        atp_balance: 50,
      },
    });
    const rows = await enrichListings([listing("7")], view);
    expect(rows).toHaveLength(1);
    expect(rows[0].vessel?.generation).toBe(3);
    expect(rows[0].mediaSrc).toBe(MEDIA);
    expect(calls.find((c) => c.method === "get_strain")?.args).toEqual({ strain_id: 7 });
    expect(calls.find((c) => c.method === "nft_token")?.args).toEqual({ token_id: "7" });
    // a failed read leaves the row, with nothing invented
    const bare = await enrichListings([listing("9")], make({}));
    expect(bare[0]).toEqual({ listing: listing("9"), vessel: null, mediaSrc: null });
  });

  it("paginates by PAGE_SIZE and always has a first page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
    expect(pageCount(1000)).toBe(Math.ceil(1000 / PAGE_SIZE));
  });

  it("asks FastNEAR first, with the market as the account, and falls back to the public RPC", async () => {
    expect(MARKET_RPCS[0]).toBe("https://test.rpc.fastnear.com");
    const urls: string[] = [];
    const bodies: Array<{ params: { account_id: string; method_name: string } }> = [];
    const bytes = Array.from(new TextEncoder().encode("[]"));
    const fetchImpl = async (url: string, init?: RequestInit) => {
      urls.push(url);
      bodies.push(JSON.parse(String(init?.body)));
      if (url.includes("fastnear")) return { ok: false } as Response;
      return { ok: true, json: async () => ({ result: { result: bytes } }) } as Response;
    };
    const out = await viewCall<unknown[]>("get_listings", { from_index: "0", limit: 8 }, undefined, fetchImpl, MARKET_ID, MARKET_RPCS);
    expect(out).toEqual([]);
    expect(urls).toEqual([MARKET_RPCS[0], MARKET_RPCS[1]]);
    expect(bodies[0].params).toMatchObject({ account_id: MARKET_ID, method_name: "get_listings" });
    // the default RPC order and contract are unchanged for existing callers
    urls.length = 0;
    await viewCall<unknown[]>("ft_metadata", {}, undefined, fetchImpl);
    expect(urls[0]).toBe("https://rpc.testnet.near.org");
    expect(bodies[bodies.length - 1].params.account_id).toBe(CONTRACT_ID);
  });
});

describe("read-back after a success", () => {
  const noSleep = async () => undefined;
  const raw = (id: string, price = ONE_NEAR) => ({ token_id: id, seller_id: "alice.testnet", price, listed_at: "1" });
  const viewOf = (fn: (method: string) => unknown): ChainView =>
    (async <T,>(_c: string, method: string) => {
      const v = fn(method);
      return (v === undefined ? null : v) as T | null;
    }) as ChainView;

  it("confirms a listing once get_listings_by_seller shows it at that price, retrying while the chain catches up", async () => {
    let reads = 0;
    const view = viewOf((m) => (m === "get_listings_by_seller" ? (++reads < 3 ? [] : [raw("7")]) : undefined));
    const out = await confirmExpectation({ kind: "listed", tokenId: "7", sellerId: "alice.testnet", priceYocto: ONE_NEAR }, view, { sleep: noSleep });
    expect(out).toBe("confirmed");
    expect(reads).toBe(3);
  });

  it("reports a refused listing (the Snacc was handed back) as not confirmed after the last attempt", async () => {
    let reads = 0;
    const view = viewOf((m) => (m === "get_listings_by_seller" ? (reads++, []) : undefined));
    const exp = { kind: "listed", tokenId: "7", sellerId: "alice.testnet", priceYocto: ONE_NEAR } as const;
    const out = await confirmExpectation(exp, view, { attempts: 3, sleep: noSleep });
    expect(out).toBe("not-confirmed");
    expect(reads).toBe(3);
    expect(notConfirmedMessage(exp, out)).toMatch(/hands the Snacc back/);
  });

  it("a listing at another price is not a confirmed reprice", async () => {
    const view = viewOf((m) => (m === "get_listings_by_seller" ? [raw("7", "5")] : undefined));
    const exp = { kind: "repriced", tokenId: "7", sellerId: "alice.testnet", priceYocto: ONE_NEAR } as const;
    expect(await confirmExpectation(exp, view, { attempts: 1, sleep: noSleep })).toBe("not-confirmed");
    expect(await confirmExpectation({ ...exp, priceYocto: "5" }, view, { attempts: 1, sleep: noSleep })).toBe("confirmed");
  });

  it("confirms a purchase only when get_strain names the buyer as owner", async () => {
    const owner = (o: string) => viewOf((m) => (m === "get_strain" ? { ...vessel(7), owner_id: o } : undefined));
    const exp = { kind: "bought", tokenId: "7", buyerId: "bob.testnet" } as const;
    expect(await confirmExpectation(exp, owner("bob.testnet"), { attempts: 1, sleep: noSleep })).toBe("confirmed");
    const refunded = await confirmExpectation(exp, owner(MARKET_ID), { attempts: 2, sleep: noSleep });
    expect(refunded).toBe("not-confirmed");
    expect(notConfirmedMessage(exp, refunded)).toMatch(/refunds the full price/);
  });

  it("confirms a delist when the listing is gone and the seller owns the Snacc again", async () => {
    const exp = { kind: "delisted", tokenId: "7", sellerId: "alice.testnet" } as const;
    const back = viewOf((m) => (m === "get_listings_by_seller" ? [] : m === "get_strain" ? { ...vessel(7), owner_id: "alice.testnet" } : undefined));
    expect(await confirmExpectation(exp, back, { attempts: 1, sleep: noSleep })).toBe("confirmed");
    const stillMarket = viewOf((m) => (m === "get_listings_by_seller" ? [] : m === "get_strain" ? vessel(7) : undefined));
    expect(await confirmExpectation(exp, stillMarket, { attempts: 1, sleep: noSleep })).toBe("not-confirmed");
    const listed = viewOf((m) => (m === "get_listings_by_seller" ? [raw("7")] : undefined));
    expect(await confirmExpectation(exp, listed, { attempts: 1, sleep: noSleep })).toBe("not-confirmed");
  });

  it("says unknown, not failed, when the RPC does not answer", async () => {
    const exp = { kind: "bought", tokenId: "7", buyerId: "bob.testnet" } as const;
    const out = await confirmExpectation(exp, viewOf(() => undefined), { attempts: 2, sleep: noSleep });
    expect(out).toBe("unknown");
    expect(notConfirmedMessage(exp, out)).toMatch(/did not answer/);
  });

  it("stops reading when aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    expect(await confirmExpectation({ kind: "bought", tokenId: "7", buyerId: "b.testnet" }, viewOf(() => ({})), { signal: ac.signal, sleep: noSleep })).toBe("unknown");
  });
});

describe("buy rules", () => {
  it("blocks a purchase without a wallet, of your own listing, and of a dead Snacc", () => {
    expect(buyBlockReason(row("7"), null)).toMatch(/connect a wallet/);
    expect(buyBlockReason(row("7", { seller: "bob.testnet" }), "bob.testnet")).toMatch(/your own listing/);
    expect(buyBlockReason(row("7", { v: { status: "Liquidated" } }), "bob.testnet")).toMatch(/died/);
    expect(buyBlockReason(row("7", { v: { status: "SplicedBurned" } }), "bob.testnet")).toMatch(/died/);
    expect(buyBlockReason(row("7"), "bob.testnet")).toBeNull();
    // an unreadable strain does not block: the market itself refunds a failed transfer
    expect(buyBlockReason(row("7", { v: null }), "bob.testnet")).toBeNull();
  });

  it("offers only living Snaccs without a pending call for sale", () => {
    const item = (id: number, status: string, pending = 0): CollectionItem => ({
      strainId: id,
      status,
      health: status === "Liquidated" ? "dead" : "healthy",
      vitality: 1,
      effectiveVitality: 1,
      generation: 1,
      mediaSrc: null,
      detail: vessel(id, { status, pending_callbacks: pending }),
    });
    expect(sellableItems([item(1, "Active"), item(2, "Liquidated"), item(3, "Active", 1), item(4, "Distressed")]).map((i) => i.strainId)).toEqual([1, 4]);
  });
});

describe("render", () => {
  it("shows one listing with its svg, id, vitality, generation, seller and price", () => {
    const html = renderToStaticMarkup(<ListingRow row={row("7", { price: "1500000000000000000000000" })} />);
    expect(html).toContain('data-testid="market-row-7"');
    expect(html).toContain(`src="${MEDIA}"`);
    expect(html).toContain("strain #7");
    expect(html).toContain("8,000 / 10,000");
    expect(html).toContain("generation 3");
    expect(html).toContain("alice.testnet");
    expect(html).toContain("1.5 NEAR");
  });

  it("falls back to text, with nothing invented, when the svg or the strain cannot be read", () => {
    const html = renderToStaticMarkup(<ListingRow row={row("9", { v: null, media: null })} />);
    expect(html).toContain("no svg");
    expect(html).toContain("could not be read");
    expect(html).toContain("generation —");
  });

  it("flags a hungry Snacc and renders the action keys it is given", () => {
    const html = renderToStaticMarkup(
      <ListingList rows={[row("1", { v: { effective_vitality: 0 } }), row("2")]} label="open listings" actions={(r) => <button>{`act-${r.listing.tokenId}`}</button>} />,
    );
    expect(html).toContain("starving");
    expect(html).toContain("act-1");
    expect(html).toContain("act-2");
    expect((html.match(/<li /g) ?? []).length).toBe(2);
  });

  it("the buy confirm shows the exact deposit, the seller, the testnet note and the whole-state line", () => {
    const html = renderToStaticMarkup(
      <BuyConfirm row={row("7", { price: "1234500000000000000000000" })} accountId="bob.testnet" info={{ ...EMPTY_ACCOUNT_INFO, nearYocto: "5000000000000000000000000" }} phase={{ kind: "idle" }} onConfirm={() => {}} onBack={() => {}} />,
    );
    expect(html).toContain('data-testid="market-buy-confirm"');
    expect(html).toContain("1.2345 NEAR");
    expect(html).toContain("1234500000000000000000000 yoctoNEAR");
    expect(html).toContain("alice.testnet");
    expect(html).toContain("market fee 0%");
    expect(html).toContain("no money value");
    expect(html).toContain("whole state");
    expect(html).toContain("sign and buy");
    expect(html).not.toMatch(/sign and buy<\/button>.*disabled/);
  });

  it("disables the buy confirm for your own listing and says why", () => {
    const html = renderToStaticMarkup(
      <BuyConfirm row={row("7", { seller: "bob.testnet" })} accountId="bob.testnet" info={EMPTY_ACCOUNT_INFO} phase={{ kind: "idle" }} onConfirm={() => {}} onBack={() => {}} />,
    );
    expect(html).toContain("your own listing");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="market-buy-sign"/);
  });

  it("only says done when the read-back agrees", () => {
    const exp = { kind: "bought", tokenId: "7", buyerId: "bob.testnet" } as const;
    const ok = renderToStaticMarkup(<MarketTxStatus phase={{ kind: "settled", txHash: "ABCDEFGHIJKLMN", outcome: "confirmed", exp }} />);
    expect(ok).toContain('data-testid="market-confirmed"');
    expect(ok).toContain("Snacc #7 is yours now");
    expect(ok).toContain("https://testnet.nearblocks.io/txns/ABCDEFGHIJKLMN");
    const no = renderToStaticMarkup(<MarketTxStatus phase={{ kind: "settled", txHash: "ABCDEFGHIJKLMN", outcome: "not-confirmed", exp }} />);
    expect(no).toContain('data-testid="market-not-confirmed"');
    expect(no).not.toContain("Done on testnet");
    expect(renderToStaticMarkup(<MarketTxStatus phase={{ kind: "checking", txHash: "X" }} />)).toContain("Checking the market");
    expect(renderToStaticMarkup(<MarketTxStatus phase={{ kind: "pending" }} />)).toContain("Waiting for your wallet");
  });

  it("the window opens on Browse with three tabs and the honest testnet note", () => {
    const html = renderToStaticMarkup(<MarketModal onClose={() => {}} />);
    expect(html).toContain('data-testid="market-modal"');
    expect((html.match(/role="tab"/g) ?? []).length).toBe(3);
    for (const label of ["Browse", "Sell", "My listings"]) expect(html).toContain(label);
    const note = /data-testid="market-note"[^>]*>(.*?)<\/p>/s.exec(html)?.[1] ?? "";
    expect(note).toContain("Testnet demo market");
    expect(note).toContain("no money value");
    expect(note).toContain("whole state");
    expect(note).toContain("stomach $SNACC");
    expect(html).toContain(MARKET_ID);
  });

  it("is a toolbar key", () => {
    expect(TOOLS.map((t) => t.id)).toContain("market");
    expect(TOOLS.find((t) => t.id === "market")?.label("biolab", null)).toBe("market");
  });
});
