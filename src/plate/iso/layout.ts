/**
 * Pure layout + look helpers for the iso colony plate.
 * Everything here is deterministic and testable: the same strain ids always
 * land in the same spots with the same sizes and status looks.
 */
import { t as translate } from "../../i18n/catalog.ts";
import { getLocale } from "../../i18n/locale.ts";
import { depthOf, type Point3, type Projection } from "./iso-kit.ts";

export interface PlateCellInput {
  id: number;
  vitalityRatio: number | null;
  status: string;
  highlighted: boolean;
  index: number;
  generation?: number;
  producing?: boolean;
  /** a recent division (demo sim only; the API has no such field) → a small daughter bud. */
  budding?: boolean;
}

export interface PlacedCell {
  id: number;
  status: string;
  highlighted: boolean;
  generation: number;
  producing: boolean;
  budding: boolean;
  x: number;
  y: number;
  z: number;
  radius: number;
  depth: number;
}

export const DISH_CX = -14;
export const DISH_CY = 4;
export const DISH_R = 50;
export const DISH_Z = 8.2;
/** Cells keep this clearance to the dish rim (world units). */
export const DISH_MARGIN = 6;

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

export const MIN_RADIUS = 10;
export const MAX_RADIUS = 18;

/** Cell size from vitality: 8.5k → big, 0 → small. Null vitality = mid size. */
export function cellRadius(vitalityRatio: number | null): number {
  if (vitalityRatio === null || !Number.isFinite(vitalityRatio)) return 13.5;
  const clamped = Math.min(1, Math.max(0, vitalityRatio));
  return Math.round((MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * clamped) * 10) / 10;
}

/** Colonies with many strains shrink every cell a little so they still fit the dish. */
export function crowdScale(count: number): number {
  if (count <= 3) return 1;
  return Math.max(0.6, Math.sqrt(3 / count) * 1.04);
}

/**
 * Deterministic placement: a sunflower spiral over the dish, sorted by strain id so
 * the colony does not shuffle when the list order changes, then a fixed number of
 * relaxation passes that push overlapping cells apart (and back inside the rim).
 */
export function placeCells(cells: PlateCellInput[], P: Projection): PlacedCell[] {
  const sorted = [...cells].sort((a, b) => a.id - b.id);
  const n = sorted.length;
  const scale = crowdScale(n);
  const radii = sorted.map((c) => Math.round(cellRadius(c.vitalityRatio) * scale * 10) / 10);
  const reach = DISH_R - DISH_MARGIN;
  const pos = sorted.map((cell, i) => {
    const angle = i * 2.39996 + hashRand(cell.id, 1) * 0.35 + 0.6;
    const rr = n === 1 ? 0 : (reach - radii[i]!) * Math.sqrt((i + 0.5) / n);
    return [Math.cos(angle) * rr, Math.sin(angle) * rr] as [number, number];
  });
  for (let pass = 0; pass < 40; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[j]![0] - pos[i]![0];
        const dy = pos[j]![1] - pos[i]![1];
        const dist = Math.hypot(dx, dy) || 0.001;
        const want = radii[i]! + radii[j]! + 1.2;
        if (dist < want) {
          const push = (want - dist) / 2;
          pos[i]![0] -= (dx / dist) * push;
          pos[i]![1] -= (dy / dist) * push;
          pos[j]![0] += (dx / dist) * push;
          pos[j]![1] += (dy / dist) * push;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const limit = reach - radii[i]!;
      const d = Math.hypot(pos[i]![0], pos[i]![1]);
      if (d > limit) {
        pos[i]![0] *= limit / d;
        pos[i]![1] *= limit / d;
      }
    }
  }
  return sorted.map((cell, i) => {
    const x = Math.round((pos[i]![0] + DISH_CX) * 10) / 10;
    const y = Math.round((pos[i]![1] + DISH_CY) * 10) / 10;
    const at: Point3 = [x, y, DISH_Z];
    return {
      id: cell.id,
      status: cell.status,
      highlighted: cell.highlighted,
      generation: Math.max(0, Math.round(cell.generation ?? 1)),
      producing: cell.producing ?? false,
      budding: cell.budding ?? false,
      x,
      y,
      z: DISH_Z,
      radius: radii[i]!,
      depth: depthOf(at, P),
    };
  });
}

export type CellLook = {
  /** tone key for the outline of the cell body. */
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
      return { tone: "lo", className: "cell--distressed", opacity: 0.94, cracked: false, ghost: false, motion: "shiver", selectedRing: selected };
    case "Liquidated":
      return { tone: "lo", className: "cell--liquidated", opacity: 0.94, cracked: true, ghost: false, motion: "still", selectedRing: selected };
    case "SplicedBurned":
      return { tone: "faint", className: "cell--ghost", opacity: 0.6, cracked: false, ghost: true, motion: "still", selectedRing: selected };
    case "Active":
    default:
      return { tone: "hi", className: "", opacity: 1, cracked: false, ghost: false, motion: "breathe", selectedRing: selected };
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
  return translate(getLocale(), "demo.receipt", { inflow: totalIn, outflow: totalOut, stored });
}

/** Thermometer label text: "605 mK" or "— mK" when the API gave nothing. */
export function tempLabel(crucibleTempMk: number | null): string {
  if (crucibleTempMk === null || !Number.isFinite(crucibleTempMk)) return "— mK";
  return `${Math.round(crucibleTempMk)} mK`;
}
