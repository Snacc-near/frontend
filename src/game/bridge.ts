/**
 * Typed postMessage bridge between the app and the Cell Lab figure iframe.
 * The figure lives at `/figures/cell-lab.html` and is embedded with an iframe.
 * Every inbound message is validated for origin and exact shape before use;
 * untrusted messages are ignored, never executed.
 */

import type { LabAction } from "./simulation.ts";

export const CELL_LAB_SRC = "/figures/cell-lab.html?embed=1";

export const LAB_ACTIONS: readonly LabAction[] = [
  "feed",
  "atp",
  "extract",
  "transmute",
  "synthesize",
  "nucleus",
  "lysosome",
  "divide",
  "lysis",
  "splice",
] as const;

export interface BridgeStrainState {
  strain_id: number;
  status: string;
  vitality: number;
  effective_vitality: number;
  atp_balance: string;
  organel: {
    mitokondria: number;
    nukleus: number;
    lisosom: number;
  };
  generation: number;
  role_mask: number;
}

export type BridgeZone = string;

export interface SnaccStateMessage {
  type: "snacc:state";
  strain: BridgeStrainState;
  zone: BridgeZone;
}

export interface SnaccPlayMessage {
  type: "snacc:play";
  action: LabAction;
}

export type AppToFigureMessage = SnaccStateMessage | SnaccPlayMessage;

export interface SnaccReadyMessage {
  type: "snacc:ready";
}

export interface SnaccActionMessage {
  type: "snacc:action";
  action: LabAction;
}

export interface SnaccDoneMessage {
  type: "snacc:done";
  action: LabAction;
}

export type FigureToAppMessage = SnaccReadyMessage | SnaccActionMessage | SnaccDoneMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isLabAction(value: unknown): value is LabAction {
  return typeof value === "string" && (LAB_ACTIONS as readonly string[]).includes(value);
}

export function isValidStrainState(value: unknown): value is BridgeStrainState {
  if (!isRecord(value)) return false;
  if (typeof value.strain_id !== "number" || !Number.isFinite(value.strain_id)) return false;
  if (typeof value.status !== "string") return false;
  if (typeof value.vitality !== "number" || !Number.isFinite(value.vitality)) return false;
  if (typeof value.effective_vitality !== "number" || !Number.isFinite(value.effective_vitality)) return false;
  if (typeof value.atp_balance !== "string") return false;
  if (!isRecord(value.organel)) return false;
  for (const slot of ["mitokondria", "nukleus", "lisosom"] as const) {
    const level = value.organel[slot];
    if (typeof level !== "number" || !Number.isFinite(level) || level < 0 || level > 5) return false;
  }
  if (typeof value.generation !== "number" || !Number.isFinite(value.generation)) return false;
  if (typeof value.role_mask !== "number" || !Number.isFinite(value.role_mask)) return false;
  return true;
}

/**
 * Validate an untrusted inbound event. Returns the typed message when every
 * check passes, otherwise null. Origin must match exactly.
 */
export function validateFigureMessage(
  event: { origin: string; data: unknown },
  expectedOrigin: string,
): FigureToAppMessage | null {
  if (typeof event?.origin !== "string" || event.origin !== expectedOrigin) return null;
  const data = event.data;
  if (!isRecord(data) || typeof data.type !== "string") return null;

  if (data.type === "snacc:ready") {
    return { type: "snacc:ready" };
  }
  if (data.type === "snacc:action" && isLabAction(data.action)) {
    return { type: "snacc:action", action: data.action };
  }
  if (data.type === "snacc:done" && isLabAction(data.action)) {
    return { type: "snacc:done", action: data.action };
  }
  return null;
}

export function buildStateMessage(
  strain: BridgeStrainState,
  zone: BridgeZone,
): SnaccStateMessage {
  return { type: "snacc:state", strain, zone };
}

export function buildPlayMessage(action: LabAction): SnaccPlayMessage {
  return { type: "snacc:play", action };
}

export function postToFigure(
  iframe: HTMLIFrameElement | null,
  message: AppToFigureMessage,
  targetOrigin: string,
): boolean {
  const win = iframe?.contentWindow;
  if (!win) return false;
  win.postMessage(message, targetOrigin);
  return true;
}

export function currentOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

/** Normalize a StrainDetail or summary into the bridge state shape. */
export function strainToBridgeState(input: {
  strain_id: number;
  status?: string;
  vitality?: number;
  effective_vitality?: number;
  atp_balance?: string;
  organel?: { mitokondria: number; nukleus: number; lisosom: number };
  generation?: number;
  role_mask?: number;
}): BridgeStrainState {
  return {
    strain_id: input.strain_id,
    status: input.status ?? "Active",
    vitality: input.vitality ?? 0,
    effective_vitality: input.effective_vitality ?? input.vitality ?? 0,
    atp_balance: input.atp_balance ?? "0",
    organel: input.organel ?? { mitokondria: 0, nukleus: 0, lisosom: 0 },
    generation: input.generation ?? 0,
    role_mask: input.role_mask ?? 0,
  };
}
