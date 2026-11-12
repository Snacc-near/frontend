/**
 * The three on-chain NPC spore merchants (ADR-30). Live mode reads them with the contract views
 * `get_npc` and `npc_quote_spores`; demo mode reproduces the contract's quote rule locally and is
 * labelled as a simulation. Every NPC sells `mt:spore-ignis` (`npc_buy_spores`).
 *
 * Quote rule (I-15, `npc_quote_internal`): unit = max(1, floor(P_base × S_target / max(S_after, 1))),
 * total = unit × buy_amount. Prices are raw contract integers (P_BASE = 100).
 */
import type { SkinMode } from "../config/constants.ts";
import { viewCall } from "./nearView.ts";

export type NpcId = "npc-extractor" | "npc-central-arb" | "npc-vulture-ma";
export const NPC_IDS: readonly NpcId[] = ["npc-extractor", "npc-central-arb", "npc-vulture-ma"];

/** `NpcMerchantAgent` as returned by `get_npc` (u128 fields may arrive as strings). */
export interface NpcAgent {
  npc_id: string;
  wallet_account?: string;
  role_archetype: string;
  snacc_reserve: number | string;
  spores_stock: number;
  target_spores_stock: number;
  base_spore_price: number | string;
  trades_executed: number;
}

/** `NpcQuoteView` as returned by `npc_quote_spores`. */
export interface NpcQuote {
  npc_id: string;
  unit_price_vita: number | string;
  total_cost_snacc: number | string;
  npc_spores_stock_after: number;
  crucible_temp_mk: number;
  reasoning_tooltip: string;
}

/** Display names per skin (ADR-31). `role_archetype` itself comes from the contract. */
export const NPC_SKIN: Record<NpcId, { archetype: string; biolab: { name: string; role: string }; fintech: { name: string; role: string } }> = {
  "npc-extractor": {
    archetype: "Pyre-X",
    biolab: { name: "Pyre-X", role: "extractor alchemist" },
    fintech: { name: "Pyre-X Capital", role: "asset originator" },
  },
  "npc-central-arb": {
    archetype: "Myco-7",
    biolab: { name: "Myco-7", role: "central spore arb" },
    fintech: { name: "Myco-7 Arbitrage", role: "liquidity provision" },
  },
  "npc-vulture-ma": {
    archetype: "Void-0",
    biolab: { name: "Void-0", role: "scavenger guild" },
    fintech: { name: "Void-0 Distressed M&A", role: "distressed buyouts" },
  },
};

export function npcName(id: NpcId, skin: SkinMode): string {
  return NPC_SKIN[id][skin].name;
}

/** Genesis state from the contract's `spawn_npcs`: stock = target, reserve 0, base price P_BASE. */
export const NPC_GENESIS: Record<NpcId, NpcAgent> = {
  "npc-extractor": { npc_id: "npc-extractor", role_archetype: "Pyre-X", snacc_reserve: 0, spores_stock: 500, target_spores_stock: 500, base_spore_price: 100, trades_executed: 0 },
  "npc-central-arb": { npc_id: "npc-central-arb", role_archetype: "Myco-7", snacc_reserve: 0, spores_stock: 1000, target_spores_stock: 1000, base_spore_price: 100, trades_executed: 0 },
  "npc-vulture-ma": { npc_id: "npc-vulture-ma", role_archetype: "Void-0", snacc_reserve: 0, spores_stock: 300, target_spores_stock: 300, base_spore_price: 100, trades_executed: 0 },
};

export function createGenesisNpcs(): Record<NpcId, NpcAgent> {
  return {
    "npc-extractor": { ...NPC_GENESIS["npc-extractor"] },
    "npc-central-arb": { ...NPC_GENESIS["npc-central-arb"] },
    "npc-vulture-ma": { ...NPC_GENESIS["npc-vulture-ma"] },
  };
}

/** The contract's quote, computed locally for the demo simulation (same formula and tooltip text). */
export function simulateNpcQuote(npc: NpcAgent, buyAmount: number, crucibleTempMk: number): NpcQuote {
  const amount = Math.max(1, Math.floor(buyAmount));
  const sAfter = Math.max(0, npc.spores_stock - amount);
  const pBase = BigInt(npc.base_spore_price);
  const raw = (pBase * BigInt(npc.target_spores_stock)) / BigInt(Math.max(sAfter, 1));
  const unit = raw > 1n ? raw : 1n;
  return {
    npc_id: npc.npc_id,
    unit_price_vita: unit.toString(),
    total_cost_snacc: (unit * BigInt(amount)).toString(),
    npc_spores_stock_after: sAfter,
    crucible_temp_mk: crucibleTempMk,
    reasoning_tooltip: `I hold ${npc.spores_stock} Spore-Ignis (target ${npc.target_spores_stock}). Selling ${amount} drops my stock to ${sAfter} — unit price rises to ${unit} (P_base ${npc.base_spore_price}). Scarcity is my leverage.`,
  };
}

export function fetchNpc(id: NpcId, signal?: AbortSignal): Promise<NpcAgent | null> {
  return viewCall<NpcAgent>("get_npc", { npc_id: id }, signal);
}

export function fetchNpcQuote(id: NpcId, buyAmount: number, signal?: AbortSignal): Promise<NpcQuote | null> {
  return viewCall<NpcQuote>("npc_quote_spores", { npc_id: id, buy_amount: Math.max(1, Math.floor(buyAmount)) }, signal);
}

export async function fetchAllNpcs(signal?: AbortSignal): Promise<Partial<Record<NpcId, NpcAgent>>> {
  const rows = await Promise.all(NPC_IDS.map((id) => fetchNpc(id, signal)));
  const out: Partial<Record<NpcId, NpcAgent>> = {};
  NPC_IDS.forEach((id, i) => {
    const row = rows[i];
    if (row) out[id] = row;
  });
  return out;
}
