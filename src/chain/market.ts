/**
 * Testnet marketplace (UI-164): call builders, exact price math and the view readers for the
 * `snacc-market.testnet` contract (`contracts/market`, EN-126). Method and field names are copied
 * from `market/README.md` and `market/src/lib.rs`.
 *
 * A Snacc is listed with the Snacc contract's NEP-171 `nft_transfer_call` (receiver = the market,
 * `msg` = `{"price":"<yoctoNEAR>"}`, 1 yoctoNEAR, more than 50 TGas); every other market call goes to
 * the market contract itself. So a transaction here has a receiver (`MarketTx.receiverId`), which the
 * wallet layer takes as an optional argument of `signAndSend`.
 *
 * A market refusal is not a failed transaction: when the market rejects a listing it hands the Snacc
 * back, and when a purchase cannot be settled it refunds the buyer, both inside a transaction that
 * the wallet reports as successful. That is why `confirmExpectation` reads the chain again after a
 * success and the UI only says "listed" / "bought" once the views agree.
 *
 * Testnet only. Testnet NEAR and Snaccs have no money value. No keys, no signing here.
 */
import { CONTRACT_ID, ONE_YOCTO, YOCTO_PER_NEAR, formatYocto, type ContractCall } from "./actions.ts";
import { parseOwnedToken, parseVessel } from "../data/collection.ts";
import type { StrainDetail } from "../data/types.ts";
import { MARKET_ID, viewCall } from "../data/nearView.ts";
import { t as translate, type MessageKey } from "../i18n/catalog.ts";
import { getLocale } from "../i18n/locale.ts";
import type { Vars } from "../i18n/types.ts";

/** A reason string in the saved language (UI-161): only the returned text is translated, never the rule behind it. */
const msg = (key: MessageKey, vars?: Vars): string => translate(getLocale(), key, vars);

export { CONTRACT_ID, MARKET_ID, YOCTO_PER_NEAR };

/** FastNEAR first, then the public NEAR RPC. */
export const MARKET_RPCS = ["https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"] as const;

/** Contract limits (`market/src/lib.rs`): 20 listings per seller, 1,000 in total, price at most 10,000 NEAR. */
export const MAX_LISTINGS_PER_SELLER = 20;
export const MAX_LISTINGS_TOTAL = 1000;
export const MAX_PRICE_NEAR = "10000";
export const MAX_PRICE_YOCTO = 10_000n * YOCTO_PER_NEAR;
/** `get_listings` page limits (`DEFAULT_PAGE_LIMIT` 50, `MAX_PAGE_LIMIT` 100). */
export const MAX_PAGE_LIMIT = 100;
/** Listings shown per page in the Browse tab. */
export const PAGE_SIZE = 8;

const TGAS = 10n ** 12n;
/** Prepaid gas per call. `nft_transfer_call` needs more than 50 TGas; `buy` and `delist` need 150 TGas or more. */
export const MARKET_GAS = {
  nft_transfer_call: (100n * TGAS).toString(),
  buy: (150n * TGAS).toString(),
  delist: (150n * TGAS).toString(),
  update_price: (30n * TGAS).toString(),
} as const;

// ---------------------------------------------------------------- price math (exact BigInt, no floats)

export type PriceCheck = { ok: true; yocto: string } | { ok: false; reason: string };

/** Plain decimal only: digits with an optional fraction of 1 to 24 digits (`.5` is fine, `1.`, `1e3`, `-1` and `1,5` are not). */
const PRICE_RE = /^(?:\d+(?:\.\d{1,24})?|\.\d{1,24})$/;

/** `"1.5"` to `"1500000000000000000000000"`; null when the text is not a plain decimal with at most 24 decimals. */
export function nearToYocto(input: string): string | null {
  const s = input.trim();
  if (!PRICE_RE.test(s)) return null;
  const [whole = "", frac = ""] = s.split(".");
  return (BigInt(whole || "0") * YOCTO_PER_NEAR + BigInt(frac.padEnd(24, "0") || "0")).toString();
}

/** Exact yocto to NEAR text with every digit kept and trailing zeros trimmed: `"1500000000000000000000000"` to `"1.5"`. */
export function yoctoToNear(yocto: string | bigint): string {
  const v = BigInt(yocto);
  const whole = v / YOCTO_PER_NEAR;
  const frac = (v % YOCTO_PER_NEAR).toString().padStart(24, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** True for an integer yocto string the market accepts as a price (`> 0` and `<= 10,000 NEAR`). */
export function isValidPriceYocto(yocto: string): boolean {
  if (!/^\d+$/.test(yocto)) return false;
  const v = BigInt(yocto);
  return v > 0n && v <= MAX_PRICE_YOCTO;
}

/** Validates the price typed in the Sell form (NEAR, decimal). */
export function checkPrice(input: string): PriceCheck {
  const s = input.trim();
  if (s === "") return { ok: false, reason: msg("checks.price.empty") };
  const yocto = nearToYocto(s);
  if (yocto === null) return { ok: false, reason: msg("checks.price.format") };
  const v = BigInt(yocto);
  if (v === 0n) return { ok: false, reason: msg("checks.price.zero") };
  if (v > MAX_PRICE_YOCTO) return { ok: false, reason: msg("checks.price.max", { max: Number(MAX_PRICE_NEAR).toLocaleString("en-US") }) };
  return { ok: true, yocto };
}

// ---------------------------------------------------------------- call builders

/** One transaction: its receiver contract and the call it carries. */
export interface MarketTx {
  receiverId: string;
  call: ContractCall;
}

function requireTokenId(tokenId: string): string {
  if (!/^[1-9]\d{0,19}$/.test(tokenId)) throw new Error("token_id must be a Snacc id (a positive integer)");
  return tokenId;
}

function requirePrice(priceYocto: string): string {
  if (!isValidPriceYocto(priceYocto)) throw new Error(`price must be greater than zero and at most ${MAX_PRICE_NEAR} NEAR`);
  return BigInt(priceYocto).toString();
}

/** The `nft_on_transfer` `msg`: exactly `{"price":"<yoctoNEAR>"}`; the market rejects unknown fields. */
export function listingMsg(priceYocto: string): string {
  return JSON.stringify({ price: requirePrice(priceYocto) });
}

/** List a Snacc: `nft_transfer_call` on the Snacc contract to the market, 1 yoctoNEAR, 100 TGas. */
export function buildList(input: { strainId: number; priceYocto: string }): MarketTx {
  if (!Number.isSafeInteger(input.strainId) || input.strainId < 1) throw new Error("strain_id must be a positive integer");
  return {
    receiverId: CONTRACT_ID,
    call: {
      methodName: "nft_transfer_call",
      args: { receiver_id: MARKET_ID, token_id: String(input.strainId), msg: listingMsg(input.priceYocto) },
      gas: MARKET_GAS.nft_transfer_call,
      deposit: ONE_YOCTO,
    },
  };
}

/** Buy a listing: `buy { token_id }` on the market, deposit = the listed price, 150 TGas. */
export function buildBuy(input: { tokenId: string; priceYocto: string }): MarketTx {
  return {
    receiverId: MARKET_ID,
    call: { methodName: "buy", args: { token_id: requireTokenId(input.tokenId) }, gas: MARKET_GAS.buy, deposit: requirePrice(input.priceYocto) },
  };
}

/** Take a listing back: `delist { token_id }`, 1 yoctoNEAR, 150 TGas. */
export function buildDelist(input: { tokenId: string }): MarketTx {
  return {
    receiverId: MARKET_ID,
    call: { methodName: "delist", args: { token_id: requireTokenId(input.tokenId) }, gas: MARKET_GAS.delist, deposit: ONE_YOCTO },
  };
}

/** Change a price: `update_price { token_id, price }`, 1 yoctoNEAR. */
export function buildUpdatePrice(input: { tokenId: string; priceYocto: string }): MarketTx {
  return {
    receiverId: MARKET_ID,
    call: {
      methodName: "update_price",
      args: { token_id: requireTokenId(input.tokenId), price: requirePrice(input.priceYocto) },
      gas: MARKET_GAS.update_price,
      deposit: ONE_YOCTO,
    },
  };
}

// ---------------------------------------------------------------- listings

/** `Listing` from the market views: `price` in yoctoNEAR, `listed_at` in block-timestamp nanoseconds. */
export interface Listing {
  tokenId: string;
  sellerId: string;
  priceYocto: string;
  listedAtNs: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const asDigits = (v: unknown): string | null => (typeof v === "string" && /^\d+$/.test(v) ? v : typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? String(v) : null);

/** Reads one `Listing`; null when a field is missing or not what the contract documents. */
export function parseListing(raw: unknown): Listing | null {
  if (!isObj(raw)) return null;
  const tokenId = typeof raw.token_id === "string" && /^[1-9]\d{0,19}$/.test(raw.token_id) ? raw.token_id : null;
  const price = asDigits(raw.price);
  const listedAt = asDigits(raw.listed_at);
  if (tokenId === null || typeof raw.seller_id !== "string" || raw.seller_id === "" || price === null || listedAt === null) return null;
  if (BigInt(price) === 0n) return null;
  return { tokenId, sellerId: raw.seller_id, priceYocto: price, listedAtNs: listedAt };
}

/** A page of listings; null when the view did not return an array. Malformed entries are dropped. */
export function parseListings(raw: unknown): Listing[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map(parseListing).filter((l): l is Listing => l !== null);
}

/** Reads a view on `contractId`; null when no endpoint answers (`viewCall` semantics). Injectable for tests. */
export type ChainView = <T>(contractId: string, method: string, args: unknown, signal?: AbortSignal) => Promise<T | null>;

export const chainView: ChainView = (contractId, method, args, signal) => viewCall(method, args, signal, undefined, contractId, MARKET_RPCS);

/** Open listings in the market; null when the view does not answer. */
export async function fetchListingCount(view: ChainView = chainView, signal?: AbortSignal): Promise<number | null> {
  const n = await view<unknown>(MARKET_ID, "get_listing_count", {}, signal);
  const d = asDigits(n);
  return d === null ? null : Number(d);
}

/** One page of `get_listings(from_index, limit)`. */
export async function fetchListingsPage(from: number, limit: number, view: ChainView = chainView, signal?: AbortSignal): Promise<Listing[] | null> {
  const lim = Math.min(Math.max(1, Math.trunc(limit)), MAX_PAGE_LIMIT);
  return parseListings(await view<unknown>(MARKET_ID, "get_listings", { from_index: String(Math.max(0, Math.trunc(from))), limit: lim }, signal));
}

/** Every open listing of one seller (at most 20, so one page). */
export async function fetchSellerListings(sellerId: string, view: ChainView = chainView, signal?: AbortSignal): Promise<Listing[] | null> {
  return parseListings(await view<unknown>(MARKET_ID, "get_listings_by_seller", { seller_id: sellerId, from_index: "0", limit: MAX_PAGE_LIMIT }, signal));
}

/** A listing joined with what the Snacc contract says about the strain; both parts are null when that read failed. */
export interface MarketRow {
  listing: Listing;
  vessel: StrainDetail | null;
  /** On-chain SVG as a safe `data:` URI, or null. */
  mediaSrc: string | null;
}

async function mapPool<T, R>(list: readonly T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, worker));
  return out;
}

/** Adds `get_strain` (vitality, generation, status) and the `nft_token` SVG of each listing; six reads at a time. */
export async function enrichListings(listings: readonly Listing[], view: ChainView = chainView, signal?: AbortSignal): Promise<MarketRow[]> {
  return mapPool(listings, 6, async (listing) => {
    const [token, strain] = await Promise.all([
      view<unknown>(CONTRACT_ID, "nft_token", { token_id: listing.tokenId }, signal),
      view<unknown>(CONTRACT_ID, "get_strain", { strain_id: Number(listing.tokenId) }, signal),
    ]);
    return { listing, vessel: parseVessel(strain), mediaSrc: parseOwnedToken(token)?.mediaSrc ?? null };
  });
}

/** The strain is dead (`Liquidated` or `SplicedBurned`): the Snacc contract cannot transfer it, so it cannot be bought or delisted. */
export const isDeadStatus = (status: string): boolean => status === "Liquidated" || status === "SplicedBurned";

/** Why a listing cannot be bought right now (shown on the disabled key), or null when it can. */
export function buyBlockReason(row: MarketRow, accountId: string | null): string | null {
  if (!accountId) return msg("checks.buy.connect");
  if (row.listing.sellerId === accountId) return msg("checks.buy.own");
  if (row.vessel && isDeadStatus(row.vessel.status)) return msg("checks.buy.dead");
  return null;
}

/** Number of pages for `total` listings (at least 1, so an empty market still has a page 1). */
export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// ---------------------------------------------------------------- confirm what the chain did

export type Expectation =
  | { kind: "listed"; tokenId: string; sellerId: string; priceYocto: string }
  | { kind: "repriced"; tokenId: string; sellerId: string; priceYocto: string }
  | { kind: "delisted"; tokenId: string; sellerId: string }
  | { kind: "bought"; tokenId: string; buyerId: string };

/** `confirmed`: the views show the expected state. `not-confirmed`: they answered and it is different. `unknown`: they did not answer. */
export type Confirmation = "confirmed" | "not-confirmed" | "unknown";

async function readOnce(exp: Expectation, view: ChainView, signal?: AbortSignal): Promise<Confirmation> {
  if (exp.kind === "bought") {
    const owner = parseVessel(await view<unknown>(CONTRACT_ID, "get_strain", { strain_id: Number(exp.tokenId) }, signal))?.owner_id;
    if (owner === undefined) return "unknown";
    return owner === exp.buyerId ? "confirmed" : "not-confirmed";
  }
  const mine = await fetchSellerListings(exp.sellerId, view, signal);
  if (mine === null) return "unknown";
  const listing = mine.find((l) => l.tokenId === exp.tokenId);
  if (exp.kind === "listed" || exp.kind === "repriced") {
    return listing !== undefined && listing.priceYocto === BigInt(exp.priceYocto).toString() ? "confirmed" : "not-confirmed";
  }
  if (listing !== undefined) return "not-confirmed";
  const owner = parseVessel(await view<unknown>(CONTRACT_ID, "get_strain", { strain_id: Number(exp.tokenId) }, signal))?.owner_id;
  if (owner === undefined) return "unknown";
  return owner === exp.sellerId ? "confirmed" : "not-confirmed";
}

/**
 * Reads the chain until it shows what a successful transaction should have done (the cross-contract
 * steps settle a few blocks after the wallet answers). Gives up after `attempts` reads, `delayMs` apart.
 */
export async function confirmExpectation(
  exp: Expectation,
  view: ChainView = chainView,
  opts: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void>; signal?: AbortSignal } = {},
): Promise<Confirmation> {
  const attempts = Math.max(1, opts.attempts ?? 6);
  const delay = opts.delayMs ?? 2000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: Confirmation = "unknown";
  for (let i = 0; i < attempts; i++) {
    if (opts.signal?.aborted) return "unknown";
    last = await readOnce(exp, view, opts.signal);
    if (last === "confirmed") return last;
    if (i < attempts - 1) await sleep(delay);
  }
  return last;
}

/** Plain-English line for a transaction the wallet reported as successful but the views do not show. */
export function notConfirmedMessage(exp: Expectation, outcome: Confirmation): string {
  const lag = outcome === "unknown" ? msg("checks.notConfirmed.lag") : "";
  const id = exp.tokenId;
  switch (exp.kind) {
    case "listed":
      return `${msg("checks.notConfirmed.listed", { id })}${lag}`;
    case "repriced":
      return `${msg("checks.notConfirmed.repriced", { id })}${lag}`;
    case "delisted":
      return `${msg("checks.notConfirmed.delisted", { id })}${lag}`;
    case "bought":
      return `${msg("checks.notConfirmed.bought", { id })}${lag}`;
  }
}

/** Short price text for lists, e.g. `1.5 NEAR`. */
export const priceLabel = (yocto: string): string => `${formatYocto(yocto, 4)} NEAR`;
