/**
 * Every section the bottom status bar links to, in document order. The scrollspy marks the last
 * section whose top has passed the probe line, so there is never a gap between sections.
 */
export interface SectionTab {
  /** DOM id of the section. */
  id: string;
  /** Tab label. */
  label: string;
}

export const SECTIONS: readonly SectionTab[] = [
  { id: "ch-01", label: "Enter" },
  { id: "ch-02", label: "Organism" },
  { id: "ch-03", label: "Metabolism" },
  { id: "ch-04", label: "Colony" },
  { id: "ch-05", label: "Appetite" },
  { id: "ch-06", label: "Enclave" },
  { id: "live", label: "Live" },
  { id: "hood", label: "Hood" },
  { id: "ch-07", label: "Open" },
  { id: "faq", label: "FAQ" },
] as const;

export const SECTION_IDS: readonly string[] = SECTIONS.map((s) => s.id);

/** Fraction of the viewport height where the probe line sits. */
export const PROBE = 0.45;

/**
 * Index of the active section: the last one (document order) whose top is at or above `probe`
 * (viewport px). Missing sections (`null`) are skipped; before the first section, 0.
 */
export function activeIndex(tops: ReadonlyArray<number | null>, probe: number): number {
  let active = 0;
  for (let i = 0; i < tops.length; i++) {
    const t = tops[i];
    if (t != null && t <= probe) active = i;
  }
  return active;
}
