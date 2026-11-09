/**
 * Pure layout + look helpers for the iso colony plate.
 * Everything here is deterministic and testable: the same strain ids always
 * land in the same spots with the same sizes and status looks.
 */
import { depthOf, type Point3, type Projection } from "./iso-kit.ts";

export interface PlateCellInput {
  id: number;
  vitalityRatio: number | null;
  status: string;
  highlighted: boolean;
  index: number;
  generation?: number;
  producing?: boolean;
}

export interface PlacedCell {
  id: number;
  status: string;
  highlighted: boolean;
  generation: number;
  producing: boolean;
  x: number;
  y: number;
  z: number;
  radius: number;
  depth: number;
}

export const DISH_CX = 0;
export const DISH_CY = 0;
export const DISH_R = 46;
export const DISH_Z = 8.5;

/** Stable 32-bit hash of a strain id (splitmix-ish) — seeds jitter per id. */
export function hashId(id: number): number {
  let h = (id | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Deterministic pseudo-random in [0, 1) from the id hash and a slot salt. */
export function hashRand(id: number, salt: number): number {
  return (hashId(id + salt * 1000003) % 10000) / 10000;
}

export const MIN_RADIUS = 7;
export const MAX_RADIUS = 15;

/** Cell size from vitality: 8.5k → big, 0 → small. Null vitality = mid size. */
export function cellRadius(vitalityRatio: number | null): number {
  if (vitalityRatio === null || !Number.isFinite(vitalityRatio)) return 11;
  const clamped = Math.min(1, Math.max(0, vitalityRatio));
  return Math.round((MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * clamped) * 10) / 10;
}

/**
 * Deterministic placement: golden-spiral-ish slots sorted by strain id so the
 * colony does not shuffle when the list order changes; each slot gets a small
 * hash jitter inside the dish. Up to ~12 strains fit; extra cells stack on the
 * outer ring with a tighter jitter (never off the dish).
 */
export function placeCells(cells: PlateCellInput[], P: Projection): PlacedCell[] {
  const sorted = [...cells].sort((a, b) => a.id - b.id);
  return sorted.map((cell, i) => {
    const slot = i;
    const angle = slot * 2.39996 + hashRand(cell.id, 1) * 0.5; // golden angle
    const ring = slot + 1;
    const rr = Math.min(DISH_R - 12, 10 + Math.sqrt(ring) * 11);
    const jitter = hashRand(cell.id, 2) * 3;
    const x = Math.round((Math.cos(angle) * (rr + jitter) + DISH_CX) * 10) / 10;
    const y = Math.round((Math.sin(angle) * (rr + jitter) * 0.78 + DISH_CY) * 10) / 10;
    const at: Point3 = [x, y, DISH_Z];
    return {
      id: cell.id,
      status: cell.status,
      highlighted: cell.highlighted,
      generation: Math.max(0, Math.round(cell.generation ?? 1)),
      producing: cell.producing ?? false,
      x,
      y,
      z: DISH_Z,
      radius: cellRadius(cell.vitalityRatio),
      depth: depthOf(at, P),
    };
  });
}

export type CellLook = {
  /** tone key for <.Solid> — drives the four-tone shading of the wall. */
  tone: "hi" | "mid" | "lo" | "faint";
  /** extra class on the cell group (CSS status styling). */
  className: string;
  /** opacity multiplier on the whole cell. */
  opacity: number;
  /** draw the crack lines (liquidated). */
  cracked: boolean;
  /** ghost wash colour (spliced/burned). */
  ghost: boolean;
  /** motion class: breathing, shiver, or still. */
  motion: "breathe" | "shiver" | "still";
  /** marigold selection ring. */
  selectedRing: boolean;
};

/** Status → look mapping. Unknown/empty status reads as Active. */
export function statusLook(status: string | undefined, selected: boolean): CellLook {
  switch (status) {
    case "Distressed":
      return {
        tone: "lo",
        className: "cell--distressed",
        opacity: 0.92,
        cracked: false,
        ghost: false,
        motion: "shiver",
        selectedRing: selected,
      };
    case "Liquidated":
      return {
        tone: "lo",
        className: "cell--liquidated",
        opacity: 0.9,
        cracked: true,
        ghost: false,
        motion: "still",
        selectedRing: selected,
      };
    case "SplicedBurned":
      return {
        tone: "faint",
        className: "cell--ghost",
        opacity: 0.6,
        cracked: false,
        ghost: true,
        motion: "still",
        selectedRing: selected,
      };
    case "Active":
    default:
      return {
        tone: "hi",
        className: "",
        opacity: 1,
        cracked: false,
        ghost: false,
        motion: "breathe",
        selectedRing: selected,
      };
  }
}

/**
 * Thermometer needle ratio 0..1 (0 = parked left). Null temp (live without
 * API data) parks the needle and reads "—".
 */
export function needleRatio(crucibleTempMk: number | null): number | null {
  if (crucibleTempMk === null || !Number.isFinite(crucibleTempMk)) return null;
  const clamped = Math.min(1220, Math.max(0, crucibleTempMk));
  return Math.round((clamped / 1220) * 1000) / 1000;
}

/** Iris transition mode: full iris, or a plain fade under reduced motion. */
export function irisMode(reducedMotion: boolean): "iris" | "fade" {
  return reducedMotion ? "fade" : "iris";
}

/** Demo thesis receipt line, computed from the sim ledger counters. */
export function receiptLine(totalIn: number, totalOut: number): string {
  const stored = totalIn - totalOut;
  return `in ${totalIn} = out ${totalOut} + stored ${stored} ✓`;
}

/** Thermometer label text: "605 mK" or "— mK" when the API gave nothing. */
export function tempLabel(crucibleTempMk: number | null): string {
  if (crucibleTempMk === null || !Number.isFinite(crucibleTempMk)) return "— mK";
  return `${Math.round(crucibleTempMk)} mK`;
}
