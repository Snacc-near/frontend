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
