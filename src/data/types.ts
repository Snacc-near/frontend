/**
 * Local data types for the SNACC contract and the backend indexer-api.
 *
 * Architecture note:
 * These local types mirror the canonical definitions of `sdk/src/events.ts` and
 * `backend/src/macro.ts` exactly. They are defined locally in the frontend so the package is
 * self-contained without modifying the `sdk` repo, while keeping on-chain u128 values safe
 * from float64 precision loss (stored as strings or bigints, not plain Numbers).
 */

import type { MacroZone } from "../config/zones.ts";

export type EventKind =
  | "strain_created"
  | "extracted"
  | "transmuted"
  | "synthesized"
  | "subaccount_materialized"
  | "fed"
  | "atp_spent"
  | "atp_allocated"
  | "genome_committed"
  | "genome_mutated"
  | "strains_spliced"
  | "hostile_takeover_spliced"
  | "strain_liquidated"
  | "strain_divided"
  | "strain_adopted"
  | "trait_conjugated"
  | "feast_result"
  | "zone_changed"
  | "nutrient_burst_released"
  | "npc_spores_bought"
  | "dividend_claimed";

export interface FedEventData {
  strain_id: number;
  base_fee: string; // u128 string
  effective_fee: string; // u128 string
  burst_bps: number;
  rescue_bps: number;
  dormant: boolean;
  atp_minted: number;
}

export interface ZoneChangedEventData {
  from_zone: string;
  to_zone: string;
  crucible_temp: number;
}

export interface NutrientBurstReleasedEventData {
  strain_id: number;
  epoch: number;
  released_vita: string; // u128 string
  burst_bps: number;
  until_epoch: number;
}

export interface StrainLiquidatedEventData {
  target_id: number;
  liquidator: string;
  bounty: string; // u128 string
  treasury_recovery: string; // u128 string
}

export interface CrucibleEvent {
  kind: EventKind | string;
  block_height?: number;
  receipt_id?: string;
  raw: Record<string, unknown>;
  received_at_ms?: number;
}

export interface MacroTelemetry {
  crucibleTemp: number;
  zone: MacroZone;
  totalSnaccSupply: string;
  totalSnaccBurned: string;
  ruleBoundTreasury: string;
  epochVolume: string;
  contractId: string;
  blockHeight: number;
}

export interface StrainSummary {
  strain_id: number;
  owner_id: string;
  // The full StrainVesselView fields (present on /api/strains responses):
  vault_subaccount?: string;
  vitality?: number;
  effective_vitality?: number;
  atp_balance?: string;
  status?: string;
  generation?: number;
  efficiency_bps?: number;
  bmr_per_hour?: number;
  last_fed_sec?: number;
  role_mask?: number;
  state_nonce?: number;
  pending_callbacks?: number;
  organel?: {
    mitokondria: number;
    nukleus: number;
    lisosom: number;
  };
}

export interface StrainDetail {
  strain_id: number;
  owner_id: string;
  vault_subaccount: string;
  vitality: number;
  efficiency_bps: number;
  bmr_per_hour: number;
  last_fed_sec: number;
  role_mask: number;
  state_nonce: number;
  pending_callbacks: number;
  atp_balance: string;
  generation: number;
  organel: {
    mitokondria: number;
    nukleus: number;
    lisosom: number;
  };
  status: string;
  effective_vitality: number;
  /** `last_allocate_epoch` (UI-150: `allocate_atp` is once per epoch); absent on older reads. */
  last_allocate_epoch?: number;
  /** `phenotype_trait` (UI-150: elixir-aether needs a past TEE mutation); null when none. */
  phenotype_trait?: string | null;
}

export interface BreachLogItem {
  id: string;
  kind: string;
  actor: string;
  summary: string;
  crucibleTemp: number;
  tempDeltaMk?: number;
  timestampMs: number;
  renderedAtMs: number;
  latencyMs: number;
  meetsSla: boolean;
}

export interface NutrientBurstState {
  isActive: boolean;
  activeBurstBps: number;
  untilEpoch: number;
  releasedVita: string;
  triggeringStrainId?: number | null;
}

export interface AppetiteTopFeeder {
  account_id: string;
  amount: string;
}

export interface AppetiteTelemetry {
  zone?: string;
  crucible_temp?: number;
  current_epoch?: number;
  burst_bps?: number;
  burst_until?: number;
  burst_epochs_left?: number;
  dormant?: boolean;
  feast_volume?: string;
  feast_target?: string;
  risk_heat?: number;
  top_feeders?: AppetiteTopFeeder[];
  contractId?: string;
  blockHeight?: number;
}

export interface AppetiteViewModel {
  zone: string;
  crucibleTempMk: number | null;
  currentEpoch: number | null;
  burstBps: number | null;
  burstUntil: number | null;
  burstEpochsLeft: number | null;
  dormant: boolean | null;
  feastVolume: string | null;
  feastTarget: string | null;
  riskHeat: number | null;
  feastProgressPct: number | null;
  riskHeatPct: number | null;
  topFeeders: AppetiteTopFeeder[];
  contractId: string | null;
  blockHeight: number | null;
}

export type SvgLoadStatus = "idle" | "loading" | "ready" | "error" | "no-data";
