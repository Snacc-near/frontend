/**
 * Single source of truth for the Cell Lab sheet: the organelle levels shown in
 * the side panel AND posted to the figure iframe come from `resolveOrganelLevels`,
 * and the keycap busy/done state is a small pure reducer so it stays testable.
 */

import type { LabAction, OrganelleLevels } from "./simulation.ts";
import { buildStateMessage, strainToBridgeState, type SnaccStateMessage } from "./bridge.ts";

export type LabMode = "demo" | "live";

export interface OrganelleSource {
  organel?: Partial<OrganelleLevels> | null;
}

export interface ResolvedOrganel {
  levels: OrganelleLevels;
  /** false when live data has no level for that slot (panel renders "—"). */
  known: { mitokondria: boolean; nukleus: boolean; lisosom: boolean };
}

const SLOTS = ["mitokondria", "nukleus", "lisosom"] as const;

/**
 * demo → simulation state; live → the API strain organelle fields;
 * missing live value → level 0 and `known: false`.
 */
export function resolveOrganelLevels(
  mode: LabMode,
  strain: OrganelleSource | null | undefined,
  simOrganel: OrganelleLevels,
): ResolvedOrganel {
  const levels: OrganelleLevels = { mitokondria: 0, nukleus: 0, lisosom: 0 };
  const known = { mitokondria: true, nukleus: true, lisosom: true };
  for (const slot of SLOTS) {
    if (mode === "demo") {
      levels[slot] = simOrganel[slot];
      continue;
    }
    const value = strain?.organel?.[slot];
    if (typeof value === "number" && Number.isFinite(value)) {
      levels[slot] = value;
    } else {
      levels[slot] = 0;
      known[slot] = false;
    }
  }
  return { levels, known };
}

export interface LabStrainLike extends OrganelleSource {
  strain_id: number;
  status?: string;
  vitality?: number;
  effective_vitality?: number;
  atp_balance?: string;
  generation?: number;
  role_mask?: number;
}

/** The exact `snacc:state` message for the current lab view (same levels as the panel). */
export function buildLabStateMessage(
  mode: LabMode,
  strain: LabStrainLike,
  simOrganel: OrganelleLevels,
  zone: string,
): SnaccStateMessage {
  const { levels } = resolveOrganelLevels(mode, strain, simOrganel);
  return buildStateMessage(strainToBridgeState({ ...strain, organel: levels }), zone);
}

/**
 * Posts `snacc:state` only when it changed, except right after `snacc:ready`
 * (`force`): the figure may have loaded after our first post, so it must get
 * the current state again no matter what we sent before.
 */
export function createStateSender(post: (message: SnaccStateMessage) => void) {
  let last = "";
  return {
    send(message: SnaccStateMessage, force = false): boolean {
      const key = JSON.stringify(message);
      if (!force && key === last) return false;
      last = key;
      post(message);
      return true;
    },
  };
}

/* ---------------- keycaps ---------------- */

export interface LabKeycap {
  action: LabAction;
  label: string;
  /** Keys that never change numbers, even in demo (the figure only plays the mechanism). */
  previewOnly?: boolean;
  primary?: boolean;
}

export const LAB_KEYCAPS: readonly LabKeycap[] = [
  { action: "feed", label: "feed" },
  { action: "atp", label: "produce atp", primary: true },
  { action: "extract", label: "extract" },
  { action: "transmute", label: "transmute" },
  { action: "synthesize", label: "synthesize" },
  { action: "nucleus", label: "nucleus" },
  { action: "lysosome", label: "lysosome" },
  { action: "divide", label: "divide" },
  { action: "lysis", label: "lysis / harvest" },
  { action: "splice", label: "splice" },
  { action: "vacuole", label: "vacuole", previewOnly: true },
  { action: "attest", label: "attest (tee)", previewOnly: true },
] as const;

export const LIVE_PREVIEW_NOTE = "preview only — on-chain transactions need a wallet";

/**
 * Fallback so a key never stays locked if the figure never answers snacc:done.
 * The longest figure animation runs 8.0 s, so this must stay above that or the
 * keys would unlock while the figure still ignores new plays (measured 2026-11-09).
 */
export const BUSY_TIMEOUT_MS = 10000;

export interface BusyState {
  /** actions whose animation is currently running */
  busy: ReadonlySet<LabAction>;
}

export const idleBusy: BusyState = { busy: new Set() };

export type BusyEvent =
  | { type: "start"; action: LabAction }
  | { type: "done"; action: LabAction }
  | { type: "timeout"; action: LabAction };

/**
 * The figure runs one animation at a time, so while anything runs every key is
 * disabled; `busy` records which key started it. done/timeout releases it.
 */
export function busyReducer(state: BusyState, event: BusyEvent): BusyState {
  const next = new Set(state.busy);
  if (event.type === "start") next.add(event.action);
  else next.delete(event.action);
  return { busy: next };
}

export function isKeyDisabled(state: BusyState): boolean {
  return state.busy.size > 0;
}
