/**
 * Every section the bottom status bar links to, in document order. The scrollspy marks the last
 * section whose top has passed the probe line, so there is never a gap between sections.
 */
import { en } from "../i18n/messages/en/index.ts";

/** DOM id of a section; also its key in the `landing.sections` dictionary. */
export type SectionId = keyof typeof en.landing.sections;

export interface SectionTab {
  /** DOM id of the section. */
  id: SectionId;
  /** English tab label. The status bar shows `t(`landing.sections.${id}`)` in the reader's language. */
  label: string;
}

const S = en.landing.sections;

export const SECTIONS: readonly SectionTab[] = [
  { id: "ch-01", label: S["ch-01"] },
  { id: "ch-02", label: S["ch-02"] },
  { id: "ch-03", label: S["ch-03"] },
  { id: "ch-04", label: S["ch-04"] },
  { id: "ch-05", label: S["ch-05"] },
  { id: "ch-06", label: S["ch-06"] },
  { id: "live", label: S.live },
  { id: "hood", label: S.hood },
  { id: "ch-07", label: S["ch-07"] },
  { id: "faq", label: S.faq },
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
