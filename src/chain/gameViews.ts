/**
 * Read-only views the UI-150 action windows need: epoch and zone (`get_macro_state`), the
 * contract clock (`get_sandbox_clock`), molecule inventory (`get_inventory`), the
 * `get_dividend_pool` / `get_dividend_contribution` views, NPC quotes and the list of other owners' hungry strains. Every reader returns `null` when
 * the RPC cannot answer, so the windows show "—" and keep the sign button disabled.
 */
import { ALL_TOKEN_IDS, type Inventory } from "./actions.ts";
import { parseVessel } from "../data/collection.ts";
import { viewCall } from "../data/nearView.ts";
import type { StrainDetail } from "../data/types.ts";

type ViewFn = <T>(method: string, args: unknown, signal?: AbortSignal) => Promise<T | null>;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const big = (v: unknown): bigint | null => (typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v)) ? BigInt(v) : null);

export interface MacroInfo {
  currentEpoch: number;
  epochEndsSec: number;
  lastClosedEpoch: number;
  crucibleTempMk: number;
  feverMk: number;
  hypothermiaMk: number;
  /** `total_mergers + total_lyses - total_divides`: divisions the contract still allows. */
  birthBudget: number;
  dividendPool: bigint;
  epochDividendInflow: bigint;
  epochAetherBurnedTotal: bigint;
}

/** `get_macro_state` → the fields the action windows use. */
export function parseMacro(raw: unknown): MacroInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const p = (o.params ?? {}) as Record<string, unknown>;
  const fields = {
    currentEpoch: num(o.current_epoch),
    epochEndsSec: num(o.epoch_ends_sec),
    lastClosedEpoch: num(o.last_closed_epoch),
    crucibleTempMk: num(o.crucible_temp),
    feverMk: num(p.fever_threshold_mk),
    hypothermiaMk: num(p.hypothermia_threshold_mk),
  };
  const mergers = big(o.total_mergers);
  const lyses = big(o.total_lyses);
  const divides = big(o.total_divides);
  const pool = big(o.industrial_dividend_pool);
  const inflow = big(o.epoch_dividend_inflow);
  const burned = big(o.epoch_aether_burned_total);
  if (Object.values(fields).some((v) => v === null) || mergers === null || lyses === null || divides === null || pool === null || inflow === null || burned === null) {
    return null;
  }
  return {
    ...(fields as { [K in keyof typeof fields]: number }),
    birthBudget: Number(mergers + lyses - divides),
    dividendPool: pool,
    epochDividendInflow: inflow,
    epochAetherBurnedTotal: burned,
  };
}

export async function fetchMacroInfo(signal?: AbortSignal, view: ViewFn = viewCall): Promise<MacroInfo | null> {
  return parseMacro(await view<unknown>("get_macro_state", {}, signal));
}

/** `get_sandbox_clock` → the contract's own `now_sec` (block time plus the testnet sandbox offset). */
export async function fetchContractNowSec(signal?: AbortSignal, view: ViewFn = viewCall): Promise<number | null> {
  const raw = await view<unknown[]>("get_sandbox_clock", {}, signal);
  return Array.isArray(raw) ? num(raw[2]) : null;
}

/** All nine molecule balances of a strain (`get_inventory`); null when any read fails. */
export async function fetchInventory(strainId: number, signal?: AbortSignal, view: ViewFn = viewCall): Promise<Inventory | null> {
  const values = await Promise.all(ALL_TOKEN_IDS.map((token_id) => view<unknown>("get_inventory", { strain_id: strainId, token_id }, signal)));
  const inv: Inventory = {};
  for (let i = 0; i < ALL_TOKEN_IDS.length; i++) {
    const v = big(values[i]);
    if (v === null) return null;
    inv[ALL_TOKEN_IDS[i]] = v;
  }
  return inv;
}

export interface DividendPool {
  pool: bigint;
  inflow: bigint;
  lastClosedEpoch: number;
}

/** `get_dividend_pool` → `(industrial_dividend_pool, epoch_dividend_inflow, last_closed_epoch)`. */
export async function fetchDividendPool(signal?: AbortSignal, view: ViewFn = viewCall): Promise<DividendPool | null> {
  const raw = await view<unknown[]>("get_dividend_pool", {}, signal);
  if (!Array.isArray(raw)) return null;
  const pool = big(raw[0]);
  const inflow = big(raw[1]);
  const last = num(raw[2]);
  return pool === null || inflow === null || last === null ? null : { pool, inflow, lastClosedEpoch: last };
}

export interface Contribution {
  epoch: number;
  /** Elixir-aether units the strain burnt in that epoch. */
  contribution: bigint;
  claimed: boolean;
  /** `get_epoch_dividend_rate` (scale 10^18); 0 while the epoch is open. */
  rate: bigint;
}

/** `get_dividend_contribution` + `get_epoch_dividend_rate` for one `(epoch, strain)`. */
export async function fetchContribution(epoch: number, strainId: number, signal?: AbortSignal, view: ViewFn = viewCall): Promise<Contribution | null> {
  const [c, r] = await Promise.all([
    view<unknown[]>("get_dividend_contribution", { epoch, strain_id: strainId }, signal),
    view<unknown>("get_epoch_dividend_rate", { epoch }, signal),
  ]);
  if (!Array.isArray(c)) return null;
  const contribution = big(c[0]);
  const rate = big(r);
  if (contribution === null || rate === null) return null;
  return { epoch, contribution, claimed: c[1] === true, rate };
}

/** `DIVIDEND_RATE_SCALE`. */
export const DIVIDEND_RATE_SCALE = 10n ** 18n;

/** Estimated payout from the stored rate, capped by the pool (the contract uses exact totals). */
export function estimatePayout(c: Contribution, pool: bigint): bigint {
  const p = (c.contribution * c.rate) / DIVIDEND_RATE_SCALE;
  return p > pool ? pool : p;
}

export interface NpcQuote {
  npcId: string;
  unitPrice: bigint;
  totalCost: bigint;
  stockAfter: number;
  reasoning: string;
}

/** `npc_quote_spores(npc_id, buy_amount)` → the price the buy will charge at the current stock. */
export async function fetchNpcQuote(npcId: string, buyAmount: number, signal?: AbortSignal, view: ViewFn = viewCall): Promise<NpcQuote | null> {
  const raw = await view<Record<string, unknown>>("npc_quote_spores", { npc_id: npcId, buy_amount: buyAmount }, signal);
  if (!raw || typeof raw !== "object") return null;
  const unit = big(raw.unit_price_vita);
  const total = big(raw.total_cost_snacc);
  const after = num(raw.npc_spores_stock_after);
  if (unit === null || total === null || after === null) return null;
  return { npcId, unitPrice: unit, totalCost: total, stockAfter: after, reasoning: typeof raw.reasoning_tooltip === "string" ? raw.reasoning_tooltip : "" };
}

/** `get_npc(npc_id).spores_stock`. */
export async function fetchNpcStock(npcId: string, signal?: AbortSignal, view: ViewFn = viewCall): Promise<number | null> {
  const raw = await view<Record<string, unknown>>("get_npc", { npc_id: npcId }, signal);
  return raw && typeof raw === "object" ? num(raw.spores_stock) : null;
}

/** NEP-145 registration of any account (`storage_balance_of` total > 0). */
export async function fetchRegistered(accountId: string, signal?: AbortSignal, view: ViewFn = viewCall): Promise<boolean | null> {
  // `storage_balance_of` returns JSON null for an unregistered account, which `viewCall` also
  // returns when the RPC fails; `ft_balance_of` tells the two apart (it always answers).
  const [bal, alive] = await Promise.all([
    view<{ total?: unknown } | null>("storage_balance_of", { account_id: accountId }, signal),
    view<unknown>("ft_balance_of", { account_id: accountId }, signal),
  ]);
  if (bal && typeof bal === "object") {
    const t = big(bal.total);
    return t !== null && t > 0n;
  }
  return alive === null ? null : false;
}

/** The most strains the hungry list scans (ids 1..N, newest first). */
export const HUNGRY_SCAN_MAX = 120;
const SCAN_CONCURRENCY = 6;

export interface HungryStrain {
  vessel: StrainDetail;
  kind: "distressed" | "starving";
}

/** Distressed = effective vitality 1..2000; starving = 0 while not Liquidated/SplicedBurned. */
export function hungerKind(v: StrainDetail): HungryStrain["kind"] | null {
  if (v.status === "Liquidated" || v.status === "SplicedBurned") return null;
  if (v.effective_vitality <= 0) return "starving";
  if (v.effective_vitality <= 2000) return "distressed";
  return null;
}

/**
 * Other owners' strains that can be adopted, taken over or harvested: reads `nft_total_supply`
 * and `get_strain` for the newest `HUNGRY_SCAN_MAX` ids, then keeps the hungry ones not owned by
 * `selfId`. Hungriest first.
 */
export async function fetchHungryStrains(
  selfId: string | null,
  signal?: AbortSignal,
  view: ViewFn = viewCall,
): Promise<{ items: HungryStrain[]; scanned: number; total: number } | null> {
  const total = num(await view<unknown>("nft_total_supply", {}, signal));
  if (total === null) return null;
  const ids: number[] = [];
  for (let id = total; id >= 1 && ids.length < HUNGRY_SCAN_MAX; id--) ids.push(id);
  const out: (StrainDetail | null)[] = new Array(ids.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const i = next++;
      out[i] = parseVessel(await view<unknown>("get_strain", { strain_id: ids[i] }, signal));
    }
  };
  await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, ids.length) }, worker));
  if (signal?.aborted) return null;
  const items: HungryStrain[] = [];
  for (const v of out) {
    if (!v || (selfId && v.owner_id === selfId)) continue;
    const kind = hungerKind(v);
    if (kind) items.push({ vessel: v, kind });
  }
  items.sort((a, b) => a.vessel.effective_vitality - b.vessel.effective_vitality || a.vessel.strain_id - b.vessel.strain_id);
  return { items, scanned: ids.length, total };
}

/** Sum of the $SNACC held inside `owner`'s strains: `get_total_wealth - ft_balance_of`, plus the living count. */
export async function fetchOwnerStrainSnacc(owner: string, signal?: AbortSignal, view: ViewFn = viewCall): Promise<{ inStrains: bigint; living: number } | null> {
  const [w, b, colony] = await Promise.all([
    view<unknown>("get_total_wealth", { account_id: owner }, signal),
    view<unknown>("ft_balance_of", { account_id: owner }, signal),
    view<unknown[]>("get_colony", { owner_id: owner }, signal),
  ]);
  const wealth = big(w);
  const bal = big(b);
  if (wealth === null || bal === null || !Array.isArray(colony)) return null;
  return { inStrains: wealth > bal ? wealth - bal : 0n, living: colony.length };
}
