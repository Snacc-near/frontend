/**
 * Thesis numbers, all from the testnet rehearsal of 2026-11-09 (`snacc-v001.testnet`), each with
 * its transaction or view source. Live mode adds a fresh view read next to them. The SQL is a set of
 * query templates only: Snacc is testnet-only and the templates were not run on any indexer.
 */
import { REHEARSAL_DATE, REHEARSAL_TX, REHEARSAL_VIEWS } from "./evidence.ts";
import { CONTRACT_ID, formatUnits, viewCall } from "./nearView.ts";

export interface ThesisMetric {
  id: string;
  title: string;
  value: string;
  unit: string;
  detail: string;
  /** Transaction hash when there is one; otherwise the view method that was read. */
  tx?: string;
  view?: string;
  /** Caveat shown under the number. */
  caveat?: string;
}

const svgMin = Math.min(...REHEARSAL_VIEWS.svgBytes);
const svgMax = Math.max(...REHEARSAL_VIEWS.svgBytes);
const budgetNear = formatUnits(BigInt(REHEARSAL_VIEWS.svgBudgetBytes) * BigInt(REHEARSAL_VIEWS.storagePerByteYocto), 24, 5);

export const THESIS_METRICS: readonly ThesisMetric[] = [
  {
    id: "storage",
    title: "On-chain SVG size",
    value: `${svgMin}–${svgMax}`,
    unit: "bytes",
    detail: `Decoded nft_token media of tokens 1, 4 and 5, inside a ${REHEARSAL_VIEWS.svgBudgetBytes.toLocaleString("en-US")}-byte budget (${budgetNear} NEAR per NFT at the mainnet storage price of 1e19 yocto per byte).`,
    view: "nft_token",
    caveat: "An 84.42% saving is arithmetic against an assumed 11,129-byte static baseline, not a measurement.",
  },
  {
    id: "burn",
    title: "$SNACC burned",
    value: formatUnits(REHEARSAL_VIEWS.totalBurned, 24, 4),
    unit: "$SNACC",
    detail: `get_macro_state.total_snacc_burned = ${REHEARSAL_VIEWS.totalBurned} yocto (24 decimals). The thermostat fired when a catalyst fee moved the zone from Hypothermia to Fever (${REHEARSAL_VIEWS.feverTxTempMk} mK, threshold ${REHEARSAL_VIEWS.feverThresholdMk} mK).`,
    tx: REHEARSAL_TX.feverBurn,
    caveat: "Testnet micro-scale; the fee was paid by the contract account to itself, so no value moved between parties.",
  },
  {
    id: "tee",
    title: "TEE-signed mutation",
    value: `+${REHEARSAL_VIEWS.teeEfficiencyShiftBps}`,
    unit: "bps efficiency",
    detail: "apply_tee_mutation_zero_trust checked the enclave's ed25519 signature on chain and applied the genome_mutated event to strain 5.",
    tx: REHEARSAL_TX.teeApply,
  },
  {
    id: "solvency",
    title: "Solvency drift",
    value: String(REHEARSAL_VIEWS.solvencyDrift),
    unit: "yocto",
    detail: `get_global_solvency reported drift 0 and solvent true (total_minted ${formatUnits(REHEARSAL_VIEWS.totalMinted, 24, 4)}, total_burned ${formatUnits(REHEARSAL_VIEWS.totalBurned, 24, 4)} $SNACC).`,
    view: "get_global_solvency",
  },
];

export const THESIS_SOURCE_LINE = `Testnet rehearsal ${REHEARSAL_DATE} · ${CONTRACT_ID}`;

export interface QueryTemplate {
  title: string;
  sql: string;
}

export const QUERY_TEMPLATES: readonly QueryTemplate[] = [
  {
    title: "Storage budget arithmetic",
    sql: `-- template, not executed\nSELECT\n  ${REHEARSAL_VIEWS.svgBudgetBytes} AS svg_budget_bytes,\n  ${REHEARSAL_VIEWS.svgBudgetBytes} * 1e19 / 1e24 AS near_per_nft_budget;`,
  },
  {
    title: "ft_burn calls",
    sql: `-- template, not executed (Snacc is testnet-only)\nSELECT block_timestamp, tx_hash,\n  (args->>'amount')::numeric / 1e24 AS burned_snacc\nFROM receipt_actions\nWHERE receiver_id = '${CONTRACT_ID}'\n  AND method_name = 'ft_burn'\nORDER BY block_timestamp DESC;`,
  },
  {
    title: "feed_strain calls (Great Feast)",
    sql: `-- template, not executed (Snacc is testnet-only)\nSELECT block_timestamp, tx_hash,\n  (args->>'strain_id')::integer AS strain_id,\n  (args->>'amount')::numeric / 1e24 AS fed_snacc\nFROM receipt_actions\nWHERE receiver_id = '${CONTRACT_ID}'\n  AND method_name = 'feed_strain'\nORDER BY block_timestamp DESC;`,
  },
];

export interface ThesisLive {
  totalBurned: string | null;
  crucibleTempMk: number | null;
  drift: string | null;
  solvent: boolean | null;
  readAtMs: number;
}

interface MacroView {
  total_snacc_burned?: string | number;
}

interface SolvencyView {
  drift?: string | number;
  solvent?: boolean;
}

/** Fresh view reads for live mode; `null` when the RPC could not be reached. */
export async function fetchThesisLive(signal?: AbortSignal): Promise<ThesisLive | null> {
  const [macro, solvency, temp] = await Promise.all([
    viewCall<MacroView>("get_macro_state", {}, signal),
    viewCall<SolvencyView>("get_global_solvency", {}, signal),
    viewCall<number>("get_crucible_temp", {}, signal),
  ]);
  if (!macro && !solvency && temp === null) return null;
  return {
    totalBurned: macro?.total_snacc_burned !== undefined ? String(macro.total_snacc_burned) : null,
    crucibleTempMk: typeof temp === "number" ? temp : null,
    drift: solvency?.drift !== undefined ? String(solvency.drift) : null,
    solvent: typeof solvency?.solvent === "boolean" ? solvency.solvent : null,
    readAtMs: Date.now(),
  };
}
