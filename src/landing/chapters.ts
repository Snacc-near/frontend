import type { Translate } from "../i18n/catalog.ts";
import { en } from "../i18n/messages/en/index.ts";

/**
 * Landing story structure (ids, numbers, order). The words live in the dictionaries
 * (`i18n/messages/<lang>/landing.ts`, `chapters.chNN`): `fig`, `headline`, `accent` and `line` below
 * are the English source text, kept for tests and non-React callers. To show a chapter in the reader's
 * language use `chapterText(t, chapter)`.
 *
 * Numbers come only from the official figures (3.5% Feeding Frenzy burn, 2% Famine Relief); everything
 * else is qualitative.
 */
export type ChapterKey = keyof typeof en.landing.chapters;

export interface Chapter {
  /** DOM id of the section, also the rail anchor. */
  id: string;
  /** Key of the chapter in the dictionaries. */
  key: ChapterKey;
  /** Two-digit chapter number shown in pills and the rail. */
  num: string;
  /** Short figure name used in the "FIG 0N · name" pill and the rail (English). */
  fig: string;
  /** English headline. */
  headline: string;
  /** Phrase of the headline shown in the accent colour (must occur in `headline`). */
  accent: string;
  /** English one-liner. */
  line: string;
}

const E = en.landing.chapters;

export const CHAPTERS: readonly Chapter[] = [
  { id: "ch-01", key: "ch01", num: "01", ...E.ch01 },
  { id: "ch-02", key: "ch02", num: "02", ...E.ch02 },
  { id: "ch-03", key: "ch03", num: "03", ...E.ch03 },
  { id: "ch-04", key: "ch04", num: "04", ...E.ch04 },
  { id: "ch-05", key: "ch05", num: "05", ...E.ch05 },
  { id: "ch-06", key: "ch06", num: "06", ...E.ch06 },
  { id: "ch-07", key: "ch07", num: "07", ...E.ch07 },
] as const;

/** A chapter's words in the language of `tr` (`t` from `useT()`). */
export function chapterText(tr: Translate, chapter: Pick<Chapter, "key">): { fig: string; headline: string; accent: string; line: string } {
  const k = chapter.key;
  return {
    fig: tr(`landing.chapters.${k}.fig`),
    headline: tr(`landing.chapters.${k}.headline`),
    accent: tr(`landing.chapters.${k}.accent`),
    line: tr(`landing.chapters.${k}.line`),
  };
}

export const CHAPTER_IDS: readonly string[] = CHAPTERS.map((c) => c.id);

export const LINKS = {
  github: "https://github.com/Snacc-near",
  docs: "https://github.com/Snacc-near/frontend/tree/main/docs",
  app: "/app",
} as const;
