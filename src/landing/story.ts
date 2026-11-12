/**
 * Scroll-theatre staging per chapter: which figure anchor the camera frames, on which side the
 * text card sits, and which part the leader line points at (first id found wins).
 */
import type { Box } from "./lib/camera.ts";

export type Side = "hero" | "left" | "right";

export interface StageCue {
  /** cam.json anchor the camera frames. */
  anchor: string;
  /** Side of the TEXT card; the figure takes the other side. */
  side: Side;
  /** Air around the anchor (1 = tight). */
  margin: number;
  /** Leader-line target candidates (figure ids). */
  targets: string[];
  /** Name of the part the leader line points at. */
  part: string;
}

export const STAGE_CUES: readonly StageCue[] = [
  { anchor: "ch-incubator", side: "hero", margin: 1.02, targets: [], part: "incubator" },
  { anchor: "ch-cell", side: "left", margin: 1.3, targets: ["ch-cell-stomach", "ch-cell"], part: "stomach" },
  { anchor: "ch-mito", side: "right", margin: 1.45, targets: ["ch-mito-atp", "ch-mito"], part: "mitochondrion" },
  { anchor: "ch-colony", side: "left", margin: 1.12, targets: ["cell-hungry", "ch-colony"], part: "hungry cell" },
  { anchor: "ch-thermo", side: "right", margin: 1.18, targets: ["thermo-fill", "thermo-level", "ch-thermo"], part: "appetite meter" },
  { anchor: "ch-enclave", side: "left", margin: 0.86, targets: ["enclave-stamp", "capsule", "ch-enclave"], part: "enclave" },
];

/** Space the hero copy takes from the stage: its right edge and the strip kept free at the bottom (px). */
export interface HeroInset {
  left: number;
  bottom: number;
}

/**
 * Screen frame the figure is fitted into for a card side. In the hero the machine takes everything
 * right of the measured headline column and above the ticker strip, so the two never overlap.
 */
export function frameFor(side: Side, w: number, h: number, hero?: HeroInset): Box {
  const top = Math.min(84, h * 0.1);
  if (side === "hero") {
    const x = Math.max(w * 0.2, hero?.left ?? 0);
    const y = top * 0.7;
    const bottom = Math.max(Math.min(96, h * 0.11), hero?.bottom ?? 0);
    return { x, y, w: Math.max(1, w - x - w * 0.015), h: Math.max(1, h - y - bottom) };
  }
  const figW = w * 0.56;
  const x = side === "left" ? w - figW - w * 0.03 : w * 0.05;
  return { x, y: top, w: figW, h: h - top * 2 };
}

/**
 * Scroll map of the theatre, in viewport heights. The hero UI fades out first while the camera
 * holds the whole machine; each camera move then gets a scroll length that grows with its
 * on-screen travel (`pathWarp` at 16:10: 1.34, 0.78, 1.04, 1.22, 0.28 viewport heights), so a deep
 * zoom is not squeezed into the same distance as a short pan. Cards cross-fade at the midpoint of
 * each move and are pinned (sticky) for their whole visible window.
 */
export interface TheatreSpec {
  heroFade: readonly [number, number];
  camStart: number;
  segments: readonly number[];
  xfade: number;
  slack: number;
  tail: number;
}

export const THEATRE: TheatreSpec = {
  /** Hero copy, hints and ticker fade over [heroFade[0], heroFade[1]]; card 02 fades in over the same range. */
  heroFade: [0.03, 0.33],
  /** Camera holds the hero frame until here (hero UI already gone). */
  camStart: 0.34,
  /** Scroll length of each camera move, hero -> organism first. */
  segments: [2.6, 1.4, 1.9, 2.4, 1.1],
  /** Width of a card cross-fade (wide, so text changes little per scroll step). */
  xfade: 0.5,
  /** Extra sticky range kept on both sides of a card's visible window. */
  slack: 0.1,
  /** Hold on the last chapter before the theatre scrolls away. */
  tail: 0.8,
};

export interface TheatreBlock {
  /** Block top and length (viewport heights); the block's sticky layer is pinned for len - 1. */
  top: number;
  len: number;
  /** Camera stop of this block, relative to its top. */
  toStop: number;
  /** Where the scrollspy should see this block's top, relative to its real top. */
  spy: number;
}

export interface TheatreMap {
  /** Camera stops (hero first), absolute. */
  stops: number[];
  /** Cross-fade centres: fades[0] = first card in, fades[i] = card i -> card i + 1. */
  fades: number[];
  /** Width of each cross-fade. */
  fadeW: number[];
  /** Hero block first, then one per chapter card. */
  blocks: TheatreBlock[];
  /** Theatre height. */
  total: number;
}

export function theatreMap(m: TheatreSpec = THEATRE, probe = 0.45): TheatreMap {
  const stops: number[] = [m.camStart];
  for (const s of m.segments) stops.push(stops[stops.length - 1]! + s);
  const n = m.segments.length;
  // the first card comes in exactly as the hero UI goes out; later cards swap mid-move
  const fades: number[] = [(m.heroFade[0] + m.heroFade[1]) / 2];
  const fadeW: number[] = [m.heroFade[1] - m.heroFade[0]];
  for (let i = 1; i < n; i++) {
    fades.push((stops[i]! + stops[i + 1]!) / 2);
    fadeW.push(m.xfade);
  }
  const total = stops[n]! + m.tail + 1;
  const hero: TheatreBlock = { top: 0, len: 1 + m.heroFade[1] + m.slack, toStop: 0, spy: 0 };
  const blocks = [hero];
  for (let i = 1; i <= n; i++) {
    const top = Math.max(0, fades[i - 1]! - fadeW[i - 1]! / 2 - m.slack);
    const end = i < n ? fades[i]! + fadeW[i]! / 2 + m.slack : total - 1;
    blocks.push({ top, len: end - top + 1, toStop: stops[i]! - top, spy: fades[i - 1]! - top + probe });
  }
  return { stops, fades, fadeW, blocks, total };
}

/** Opacity of card `i` (0-based chapter card) at scroll `y` (viewport heights). */
export function cardOpacity(map: TheatreMap, i: number, y: number): number {
  const ramp = (c: number, w: number) => (w > 0 ? Math.min(1, Math.max(0, (y - (c - w / 2)) / w)) : y >= c ? 1 : 0);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const into = smooth(ramp(map.fades[i]!, map.fadeW[i]!));
  const next = map.fades[i + 1];
  const out = next === undefined ? 1 : 1 - smooth(ramp(next, map.fadeW[i + 1]!));
  return Math.min(into, out);
}

/** The five story zoom levels used by the scale key (incubator, dish, colony, cell, mitochondrion). */
export const SCALE_LEVEL_ANCHORS = ["ch-incubator", "ch-dish", "ch-colony", "ch-cell", "ch-mito"] as const;

/** Parts the microscope lens can name, smallest first. */
export const LENS_PARTS: ReadonlyArray<[string, string]> = [
  ["ch-mito", "mitochondrion"],
  ["ch-cell", "cell"],
  ["ch-colony", "colony"],
  ["ch-dish", "petri dish"],
  ["ch-thermo", "appetite meter"],
  ["ch-enclave", "enclave"],
  ["ch-door", "window"],
];
