/**
 * Facts from the testnet rehearsal of 2026-11-09 (contract `snacc-v001.testnet`), copied from
 * `evidence/gladi-manifest.json` and `docs/evidence-pack.md` in the Snacc umbrella repo. Amounts are
 * raw integers exactly as the contract returned them (`$SNACC` has 24 decimals).
 */

export const REHEARSAL_DATE = "2026-11-09";

export interface EvidenceTx {
  hash: string;
  action: string;
  detail: string;
}

/** Real testnet transactions shown on the landing (rehearsal run 2026-11-09). */
export const EVIDENCE_TXS: readonly EvidenceTx[] = [
  { hash: "5JCAmSL7pLTV8mShrNuEtG5WLPkCqKkYCZBf5WGtQ2wY", action: "incubate", detail: "Extractor, strain 1" },
  { hash: "4hnA4pEUqghdtN8WycJJXCnSYQSEZ9F5DQamAuEub3GF", action: "feed", detail: "strain 1" },
  { hash: "4ABtdBdjYkynQXXMsYD8ZKUwMtNAWX1wgEpREsX3i4nH", action: "merge (splice)", detail: "strain 1 absorbs 2" },
  { hash: "8dh9iuu1HaiFRFMSKiimnHj14saC3nqNRHz4yCiurYSf", action: "extract spores", detail: "ignis" },
  { hash: "9bTCpP7FJfgTLmHw4vXJHPjpEiQEAdcosnS9iRoLuvY5", action: "transmute", detail: "ignis + lumin to redactase" },
  { hash: "8Zi3VxSmGrmWEZPM346XPQGt4DS1fAw1HnB3MicKtxCA", action: "synthesize elixir", detail: "homeostasis" },
  { hash: "B8xdaukdnf3Fh9ZkMNfXxXW7TrHVLZLeXQNdYyBtD2AG", action: "apply_tee_mutation_zero_trust", detail: "strain 5, TEE-signed" },
  { hash: "ERBRL4rTS6JHEKVsSumLYtru1hXsSYWdkGJH8d1krJaL", action: "ft_burn", detail: "$SNACC burn" },
  { hash: "AhEk4TNNeTj4orchvXSuPood8vAxTiQNWhZZwSdD9JH9", action: "harvest_starving_strain", detail: "snack it" },
  { hash: "4o4qwoGZtR7HE5E3VnjQZpXwDicpa9QVBzXHS1YP2v4f", action: "hostile_takeover_splice", detail: "steal a plate" },
  { hash: "HfhZG6sAdqpKRSJsYRagD9mapCq7JrJvPthkUxFUZQQn", action: "nft_transfer", detail: "strain 4 to a second account" },
  { hash: "9F4KGd9bZXwtQEpvJGQYcx2Vz7fsa9LbyyTySxYhfLjW", action: "advance_epoch", detail: "close epoch 0" },
];

/** The TEE-verified mutation, linked from the enclave chapter. */
export const TEE_TX = EVIDENCE_TXS.find((t) => t.action === "apply_tee_mutation_zero_trust")!;

/** Rehearsal transactions the game screens link to. */
export const REHEARSAL_TX = {
  ftBurn: "ERBRL4rTS6JHEKVsSumLYtru1hXsSYWdkGJH8d1krJaL",
  /** extract_spores whose catalyst fee moved the zone HYPO → FEVER (916 mK) and burned part of the fee. */
  feverBurn: "CfBR8pFNCGAjCAX21pSMQY9rdjQ2cVKonkzacFjmZpM8",
  teeCommit: "EnXBEETdyG4TcjmrzGgJxzczGcxMshXZuEBorG8yHwDC",
  teeApply: "B8xdaukdnf3Fh9ZkMNfXxXW7TrHVLZLeXQNdYyBtD2AG",
  /** feed_strain(5) in epoch 1 (the epoch-1 Great Feast entry). */
  feedEpoch1: "6ZXqq4uL9YkTyTU2djSzUk5pxodBVdNdvWBMJFgXCegZ",
  npcBuy: "2VCzPuL5imnFThJC479mzpF6mcQDcz8nhUvpmkvV1RFg",
  advanceEpoch: "9F4KGd9bZXwtQEpvJGQYcx2Vz7fsa9LbyyTySxYhfLjW",
} as const;

/** Values read by view calls during the rehearsal (2026-11-09), raw contract integers. */
export const REHEARSAL_VIEWS = {
  totalMinted: "2250000000000000000000000",
  totalBurned: "35827892655461041439342",
  totalSupply: "2214172107344538958560658",
  solvencyDrift: 0,
  crucibleTempMk: 1037,
  feverTxTempMk: 916,
  feverThresholdMk: 610,
  /** Decoded on-chain SVG sizes of tokens 1, 4 and 5. */
  svgBytes: [448, 476, 480],
  svgBudgetBytes: 1734,
  /** Mainnet `storage_amount_per_byte` (yocto-NEAR). */
  storagePerByteYocto: "10000000000000000000",
  /** `get_top_feeder({"epoch":1})` after the rehearsal. */
  topFeederEpoch1: { account_id: "snacc-v001.testnet", amount: "196514539503915099101877" },
  teeEfficiencyShiftBps: 450,
} as const;
