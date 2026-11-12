/**
 * Autonomous AI Alchemist NPCs and on-chain spore pricing models (ADR-30).
 *
 * Implements the exact pricing formula and reasoning tooltips specified in:
 * - contracts/snacc/src/lib.rs (npc_quote_spores / I-15)
 * - snacc-vault/04 Arsitektur/Snacc - Model Data.md
 * - snacc-vault/04 Arsitektur/Snacc - Keputusan Desain.md (ADR-30)
 *
 * Pricing rule (I-15):
 * unit_price = max(1, floor(P_base * S_target / max(S_after, 1)))
 * total_cost = unit_price * buy_amount
 */

import type { SkinMode } from "../config/constants.ts";

export type NpcId = "npc-extractor" | "npc-central-arb" | "npc-vulture-ma";

export interface NpcProfile {
  id: NpcId;
  archetype: string;
  walletAccount: string;
  targetSporesStock: number;
  baseSporePrice: number;
  biolab: {
    name: string;
    roleTitle: string;
    description: string;
    sporeType: string;
    motto: string;
  };
  fintech: {
    name: string;
    roleTitle: string;
    description: string;
    sporeType: string;
    motto: string;
  };
}

export interface NpcMerchantState {
  id: NpcId;
  sporesStock: number;
  targetSporesStock: number;
  baseSporePrice: number;
  snaccReserve: number;
  tradesExecuted: number;
}

export interface NpcQuoteView {
  npcId: NpcId;
  buyAmount: number;
  sporesStockBefore: number;
  npcSporesStockAfter: number;
  unitPriceVita: number;
  totalCostSnacc: number;
  crucibleTempMk: number;
  reasoningTooltip: string;
}

/** Official baseline archetypes and profiles (ADR-30). */
export const NPC_PROFILES: Record<NpcId, NpcProfile> = {
  "npc-extractor": {
    id: "npc-extractor",
    archetype: "Pyre-X",
    walletAccount: "npc-extractor.snacc-v001.near",
    targetSporesStock: 500,
    baseSporePrice: 100,
    biolab: {
      name: "Pyre-X",
      roleTitle: "Extractor Alchemist",
      description: "Extracts volatile Spore-Ignis from raw thermal vents in the deep crucible.",
      sporeType: "Spore-Ignis",
      motto: "Scarcity is my leverage.",
    },
    fintech: {
      name: "Pyre-X Capital",
      roleTitle: "Asset Originator",
      description: "Originates primary catalyst coupons to backstop initial protocol liquidity.",
      sporeType: "Primary Catalyst",
      motto: "Dynamic bonding curve liquidity.",
    },
  },
  "npc-central-arb": {
    id: "npc-central-arb",
    archetype: "Myco-7",
    walletAccount: "npc-central-arb.snacc-v001.near",
    targetSporesStock: 1000,
    baseSporePrice: 100,
    biolab: {
      name: "Myco-7",
      roleTitle: "Central Spore Arb",
      description: "Maintains balanced spore circulation across interconnected microbial strains.",
      sporeType: "Spore-Amalgam",
      motto: "Equilibrium is stability.",
    },
    fintech: {
      name: "Myco-7 Arbitrage",
      roleTitle: "Liquidity Provision",
      description: "Automated market maker balancing secondary liquidity depths and order flows.",
      sporeType: "Secondary Clearing Unit",
      motto: "Equilibrium stabilizes market depth.",
    },
  },
  "npc-vulture-ma": {
    id: "npc-vulture-ma",
    archetype: "Void-0",
    walletAccount: "npc-vulture-ma.snacc-v001.near",
    targetSporesStock: 300,
    baseSporePrice: 100,
    biolab: {
      name: "Void-0",
      roleTitle: "Scavenger Guild",
      description: "Hoards rare spores and targets dying colonies for predatory biomass absorption.",
      sporeType: "Spore-Necro",
      motto: "Survival belongs to the solvent.",
    },
    fintech: {
      name: "Void-0 Distressed M&A",
      roleTitle: "Chapter 11 Liquidator",
      description: "Specialized vulture fund executing distressed corporate buyouts and asset salvage.",
      sporeType: "Distressed Debt Voucher",
      motto: "Capital reallocates to solvent balance sheets.",
    },
  },
};

/** Default initial state matching contracts/snacc/src/lib.rs:302-320 */
export function createDefaultNpcStates(): Record<NpcId, NpcMerchantState> {
  return {
    "npc-extractor": {
      id: "npc-extractor",
      sporesStock: 500,
      targetSporesStock: 500,
      baseSporePrice: 100,
      snaccReserve: 0,
      tradesExecuted: 0,
    },
    "npc-central-arb": {
      id: "npc-central-arb",
      sporesStock: 1000,
      targetSporesStock: 1000,
      baseSporePrice: 100,
      snaccReserve: 0,
      tradesExecuted: 0,
    },
    "npc-vulture-ma": {
      id: "npc-vulture-ma",
      sporesStock: 300,
      targetSporesStock: 300,
      baseSporePrice: 100,
      snaccReserve: 0,
      tradesExecuted: 0,
    },
  };
}

/**
 * Calculates a spore quote from an NPC using rule I-15:
 * unit = max(1, floor(P_base * S_target / max(S_after, 1)))
 * total = unit * buy_amount
 */
export function calculateNpcQuote(
  npc: NpcMerchantState,
  buyAmount: number,
  crucibleTempMk: number,
  skin: SkinMode = "biolab"
): NpcQuoteView {
  const safeAmount = Math.max(1, Math.floor(buyAmount));
  const sAfter = Math.max(0, npc.sporesStock - safeAmount);
  const denominator = Math.max(sAfter, 1);
  const unitPrice = Math.max(
    1,
    Math.floor((npc.baseSporePrice * npc.targetSporesStock) / denominator)
  );
  const totalCost = unitPrice * safeAmount;

  const profile = NPC_PROFILES[npc.id];
  const sporeType = skin === "biolab" ? profile.biolab.sporeType : profile.fintech.sporeType;
  const motto = skin === "biolab" ? profile.biolab.motto : profile.fintech.motto;

  const reasoningTooltip =
    skin === "biolab"
      ? `I hold ${npc.sporesStock} ${sporeType} (target ${npc.targetSporesStock}). Selling ${safeAmount} drops my stock to ${sAfter} — unit price rises to ${unitPrice} (P_base ${npc.baseSporePrice}). ${motto}`
      : `Market inventory: ${npc.sporesStock} ${sporeType} units (target ${npc.targetSporesStock}). Execution of ${safeAmount} reduces reserves to ${sAfter} — unit quote adjusts to ${unitPrice} (P_base ${npc.baseSporePrice}). ${motto}`;

  return {
    npcId: npc.id,
    buyAmount: safeAmount,
    sporesStockBefore: npc.sporesStock,
    npcSporesStockAfter: sAfter,
    unitPriceVita: unitPrice,
    totalCostSnacc: totalCost,
    crucibleTempMk,
    reasoningTooltip,
  };
}
