/**
 * UI-147 "My collection": the pure data layer. Everything here comes from contract views on
 * `snacc-v001.testnet` (`nft_tokens_for_owner`, `get_colony`, `get_strain`), nothing is invented:
 * a strain whose vessel cannot be read is reported as unresolved instead of being filled in.
 *
 * Status names are the contract's `StrainStatus` (`Active`, `Distressed`, `Liquidated`,
 * `SplicedBurned`). The contract keeps a strain at `Active` while its effective vitality has decayed
 * to 0 (Tier 3, `Tier3Chapter7Insolvent`, where `harvest_starving_strain` opens), so "starving" is
 * derived with the contract's own tier rule, not made up.
 */

import { tEn, type Translate } from "../i18n/catalog.ts";
import { safeNftMediaSrc } from "../landing/lib/live.ts";
import { viewCall } from "./nearView.ts";
import type { StrainDetail } from "./types.ts";

/**
 * Upper bound of the contract's Distressed band: `view_status` / `solvency_tier` use
 * `1 <= effective_vitality <= 2000` (Tier 2, 20% of the 10,000 vitality scale).
 */
export const DISTRESS_MAX_EFFECTIVE_VITALITY = 2000;

/** `nft_tokens_for_owner` page size and the most tokens one collection read walks. */
export const PAGE_SIZE = 50;
export const MAX_TOKENS = 250;
/** Parallel `get_strain` reads for strains that `get_colony` no longer lists. */
const LOOKUP_CONCURRENCY = 6;

export type Health = "healthy" | "distressed" | "starving" | "dead";
export type CollectionFilter = "all" | "alive" | "hungry" | "dead";
export type CollectionSort = "vitality-asc" | "vitality-desc" | "id-asc" | "generation-desc";

export const FILTERS: readonly CollectionFilter[] = ["all", "alive", "hungry", "dead"];

export const SORTS: readonly { id: CollectionSort; label: string }[] = [
  { id: "vitality-asc", label: "hungriest first" },
  { id: "vitality-desc", label: "strongest first" },
  { id: "id-asc", label: "strain id" },
  { id: "generation-desc", label: "newest generation" },
];

export interface CollectionItem {
  strainId: number;
  /** The contract's `status`, verbatim (`Active`, `Distressed`, `Liquidated`, `SplicedBurned`). */
  status: string;
  health: Health;
  vitality: number;
  effectiveVitality: number;
  generation: number;
  /** On-chain SVG as a safe `data:` URI (rendered through `<img>`), or null when it did not validate. */
  mediaSrc: string | null;
  /** The full vessel, as the Strain Detail modal takes it. */
  detail: StrainDetail;
}

export interface OwnedToken {
  strainId: number;
  mediaSrc: string | null;
}

export interface CollectionData {
  items: CollectionItem[];
  /** Owned strain ids whose vessel could not be read this time. */
  unresolved: number[];
  /** True when the account owns more tokens than `MAX_TOKENS`. */
  truncated: boolean;
}

export type CollectionResult = { kind: "ok"; data: CollectionData } | { kind: "error"; message: string };

type ViewFn = <T>(method: string, args: unknown, signal?: AbortSignal) => Promise<T | null>;

// ---------------------------------------------------------------- account ids

/** NEAR account id: 2 to 64 chars, lowercase alphanumerics joined by single `-`, `_` or `.`. */
const ACCOUNT_RE = /^(?:[a-z\d]+[-_.])*[a-z\d]+$/;

export function isValidAccountId(id: string): boolean {
  return id.length >= 2 && id.length <= 64 && ACCOUNT_RE.test(id);
}

/** Trimmed, lowercased account, or null when empty. */
export function normalizeAccount(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  return v ? v : null;
}

// ---------------------------------------------------------------- parsing

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Health of a strain from the contract's status and effective vitality. */
export function healthOf(status: string, effectiveVitality: number): Health {
  if (status === "Liquidated" || status === "SplicedBurned") return "dead";
  if (effectiveVitality <= 0) return "starving";
  if (status === "Distressed" || effectiveVitality <= DISTRESS_MAX_EFFECTIVE_VITALITY) return "distressed";
  return "healthy";
}

/** Reads one `StrainVesselView` (`get_strain` / `get_colony`); null when a field the UI needs is missing. */
export function parseVessel(raw: unknown): StrainDetail | null {
  if (!isObj(raw)) return null;
  const o = raw.organel;
  if (!isObj(o)) return null;
  const atp = raw.atp_balance;
  if (
    !isNum(raw.strain_id) ||
    typeof raw.owner_id !== "string" ||
    typeof raw.vault_subaccount !== "string" ||
    typeof raw.status !== "string" ||
    !isNum(raw.vitality) ||
    !isNum(raw.effective_vitality) ||
    !isNum(raw.generation) ||
    !isNum(raw.efficiency_bps) ||
    !isNum(raw.bmr_per_hour) ||
    !isNum(raw.last_fed_sec) ||
    !isNum(raw.role_mask) ||
    !isNum(raw.state_nonce) ||
    !isNum(raw.pending_callbacks) ||
    !(typeof atp === "number" || typeof atp === "string") ||
    !isNum(o.mitokondria) ||
    !isNum(o.nukleus) ||
    !isNum(o.lisosom)
  ) {
    return null;
  }
  return {
    strain_id: raw.strain_id,
    owner_id: raw.owner_id,
    vault_subaccount: raw.vault_subaccount,
    vitality: raw.vitality,
    efficiency_bps: raw.efficiency_bps,
    bmr_per_hour: raw.bmr_per_hour,
    last_fed_sec: raw.last_fed_sec,
    role_mask: raw.role_mask,
    state_nonce: raw.state_nonce,
    pending_callbacks: raw.pending_callbacks,
    atp_balance: String(atp),
    generation: raw.generation,
    organel: { mitokondria: o.mitokondria, nukleus: o.nukleus, lisosom: o.lisosom },
    status: raw.status,
    effective_vitality: raw.effective_vitality,
    // A never-allocated strain holds `u64::MAX`, which arrives quoted (16+ digits); any epoch differs from it.
    ...(isNum(raw.last_allocate_epoch) || (typeof raw.last_allocate_epoch === "string" && /^\d+$/.test(raw.last_allocate_epoch))
      ? { last_allocate_epoch: Number(raw.last_allocate_epoch) }
      : {}),
    ...(typeof raw.phenotype_trait === "string" || raw.phenotype_trait === null ? { phenotype_trait: raw.phenotype_trait } : {}),
  };
}

/** Reads one `NftTokenView` from `nft_tokens_for_owner`; null when the token id is not a strain id. */
export function parseOwnedToken(raw: unknown): OwnedToken | null {
  if (!isObj(raw) || typeof raw.token_id !== "string" || !/^\d+$/.test(raw.token_id)) return null;
  const strainId = Number(raw.token_id);
  if (!Number.isSafeInteger(strainId) || strainId < 1) return null;
  const media = isObj(raw.metadata) && typeof raw.metadata.media === "string" ? raw.metadata.media : null;
  return { strainId, mediaSrc: safeNftMediaSrc(media) };
}

/** Joins the owned tokens with their vessels; tokens without a vessel are returned as unresolved. */
export function buildItems(
  tokens: readonly OwnedToken[],
  vessels: ReadonlyMap<number, StrainDetail>,
): { items: CollectionItem[]; unresolved: number[] } {
  const items: CollectionItem[] = [];
  const unresolved: number[] = [];
  for (const t of tokens) {
    const v = vessels.get(t.strainId);
    if (!v) {
      unresolved.push(t.strainId);
      continue;
    }
    items.push({
      strainId: t.strainId,
      status: v.status,
      health: healthOf(v.status, v.effective_vitality),
      vitality: v.vitality,
      effectiveVitality: v.effective_vitality,
      generation: v.generation,
      mediaSrc: t.mediaSrc,
      detail: v,
    });
  }
  return { items, unresolved };
}

// ---------------------------------------------------------------- filter, sort, hunger

export const isAlive = (i: CollectionItem) => i.health !== "dead";
export const isHungry = (i: CollectionItem) => i.health === "starving" || i.health === "distressed";

export function filterItems(items: readonly CollectionItem[], filter: CollectionFilter): CollectionItem[] {
  switch (filter) {
    case "alive":
      return items.filter(isAlive);
    case "hungry":
      return items.filter(isHungry);
    case "dead":
      return items.filter((i) => !isAlive(i));
    default:
      return [...items];
  }
}

export function countByFilter(items: readonly CollectionItem[]): Record<CollectionFilter, number> {
  return {
    all: items.length,
    alive: items.filter(isAlive).length,
    hungry: items.filter(isHungry).length,
    dead: items.filter((i) => !isAlive(i)).length,
  };
}

/**
 * Sorted copy. The vitality sorts keep living strains ahead of dead ones (a dead strain's
 * effective vitality is 0 too, which would otherwise bury the hungriest living strain), then order by
 * effective vitality and finally by strain id.
 */
export function sortItems(items: readonly CollectionItem[], sort: CollectionSort): CollectionItem[] {
  const byId = (a: CollectionItem, b: CollectionItem) => a.strainId - b.strainId;
  const aliveFirst = (a: CollectionItem, b: CollectionItem) => Number(!isAlive(a)) - Number(!isAlive(b));
  const cmp: Record<CollectionSort, (a: CollectionItem, b: CollectionItem) => number> = {
    "vitality-asc": (a, b) => aliveFirst(a, b) || a.effectiveVitality - b.effectiveVitality || byId(a, b),
    "vitality-desc": (a, b) => aliveFirst(a, b) || b.effectiveVitality - a.effectiveVitality || byId(a, b),
    "id-asc": byId,
    "generation-desc": (a, b) => b.generation - a.generation || byId(a, b),
  };
  return [...items].sort(cmp[sort]);
}

export interface HungerSummary {
  starving: number;
  distressed: number;
}

export function hungerSummary(items: readonly CollectionItem[]): HungerSummary {
  return {
    starving: items.filter((i) => i.health === "starving").length,
    distressed: items.filter((i) => i.health === "distressed").length,
  };
}

/** One-line warning computed from view data only; null when nothing owned is hungry. */
export function hungerMessage(s: HungerSummary, tr: Translate = tEn): string | null {
  const n = s.starving + s.distressed;
  if (n === 0) return null;
  const one = n === 1;
  const tail = tr(one ? "collection.hunger.tailOne" : "collection.hunger.tailMany");
  if (s.distressed === 0) return tr(one ? "collection.hunger.starvingOne" : "collection.hunger.starvingMany", { n, tail });
  if (s.starving === 0) return tr(one ? "collection.hunger.distressedOne" : "collection.hunger.distressedMany", { n, tail });
  return tr("collection.hunger.mixed", { n, starving: s.starving, distressed: s.distressed, tail });
}

// ---------------------------------------------------------------- reading from the chain

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

const RPC_DOWN = "The testnet RPC did not answer (rpc.testnet.near.org and test.rpc.fastnear.com). Nothing is shown in its place.";

/**
 * Reads every strain `accountId` owns: pages `nft_tokens_for_owner`, takes the living vessels from one
 * `get_colony` call and asks `get_strain` for the owned strains it does not list (liquidated or
 * spliced). `view` is injectable for tests.
 */
export async function fetchCollection(
  accountId: string,
  signal?: AbortSignal,
  view: ViewFn = viewCall,
): Promise<CollectionResult> {
  const tokens: OwnedToken[] = [];
  let truncated = false;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await view<unknown[]>("nft_tokens_for_owner", { account_id: accountId, from_index: String(offset), limit: PAGE_SIZE }, signal);
    if (!Array.isArray(page)) return { kind: "error", message: RPC_DOWN };
    for (const raw of page) {
      const t = parseOwnedToken(raw);
      if (t) tokens.push(t);
    }
    if (page.length < PAGE_SIZE) break;
    if (tokens.length >= MAX_TOKENS) {
      truncated = true;
      break;
    }
  }
  if (tokens.length === 0) return { kind: "ok", data: { items: [], unresolved: [], truncated: false } };

  const colony = await view<unknown[]>("get_colony", { owner_id: accountId }, signal);
  if (!Array.isArray(colony)) return { kind: "error", message: RPC_DOWN };
  const vessels = new Map<number, StrainDetail>();
  for (const raw of colony) {
    const v = parseVessel(raw);
    if (v) vessels.set(v.strain_id, v);
  }

  const missing = tokens.filter((t) => !vessels.has(t.strainId));
  const looked = await mapPool(missing, LOOKUP_CONCURRENCY, async (t) => parseVessel(await view<unknown>("get_strain", { strain_id: t.strainId }, signal)));
  looked.forEach((v, i) => {
    if (v) vessels.set(missing[i].strainId, v);
  });

  if (signal?.aborted) return { kind: "error", message: "cancelled" };
  const { items, unresolved } = buildItems(tokens, vessels);
  return { kind: "ok", data: { items, unresolved, truncated } };
}

/** A fresh `get_strain` read for the detail window; null when the view does not answer. */
export async function fetchVessel(strainId: number, signal?: AbortSignal, view: ViewFn = viewCall): Promise<StrainDetail | null> {
  return parseVessel(await view<unknown>("get_strain", { strain_id: strainId }, signal));
}
