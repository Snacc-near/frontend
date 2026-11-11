/**
 * Loads the incubator world figure (`/figures/incubator.svg` + `incubator.cam.json`) once and
 * hands out id-prefixed copies so several inline instances can coexist in one document.
 * Every lookup is tolerant: a missing id simply disables the effect that needs it.
 */
import type { Anchor } from "./camera.ts";

export interface CamFile {
  viewBox: [number, number, number, number];
  root?: string;
  anchors: Record<string, Anchor>;
}

export interface FigureSource {
  svg: string;
  cam: CamFile;
}

export const FIGURE_SVG_URL = "/figures/incubator.svg";
export const FIGURE_CAM_URL = "/figures/incubator.cam.json";

/** Anchors used by the story, in camera order. */
export const STORY_ANCHORS = ["ch-incubator", "ch-cell", "ch-mito", "ch-colony", "ch-thermo", "ch-enclave"] as const;

/** Fallback anchors (viewBox units) if the cam file is missing an entry. */
export const DEFAULT_ANCHORS: Record<string, Anchor> = {
  "ch-incubator": { x: 158, y: 15, w: 1283, h: 893 },
  "ch-dish": { x: 531, y: 376, w: 287, h: 184 },
  "ch-colony": { x: 557, y: 388, w: 236, h: 139 },
  "ch-cell": { x: 652, y: 413, w: 64, h: 57 },
  "ch-mito": { x: 685, y: 448, w: 30, h: 28 },
  "ch-thermo": { x: 836, y: 258, w: 86, h: 265 },
  "ch-enclave": { x: 880, y: 229, w: 391, h: 478 },
  "ch-door": { x: 371, y: 254, w: 613, h: 646 },
};

let pending: Promise<FigureSource | null> | null = null;

export function loadFigure(): Promise<FigureSource | null> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const [svgRes, camRes] = await Promise.all([fetch(FIGURE_SVG_URL), fetch(FIGURE_CAM_URL)]);
      if (!svgRes.ok) return null;
      const svg = await svgRes.text();
      if (!/<svg[\s>]/.test(svg)) return null;
      let cam: CamFile = { viewBox: [0, 0, 1600, 1000], anchors: {} };
      if (camRes.ok) {
        try {
          cam = (await camRes.json()) as CamFile;
        } catch {
          /* keep defaults */
        }
      }
      return { svg, cam: { ...cam, anchors: { ...DEFAULT_ANCHORS, ...(cam.anchors ?? {}) } } };
    } catch {
      return null;
    }
  })();
  return pending;
}

/**
 * Prefix every id and every local reference (`url(#id)`, `href="#id"`, `xlink:href="#id"`) so a
 * second inline copy of the figure does not collide with the first.
 */
export function prefixIds(svg: string, prefix: string): string {
  if (!prefix) return svg;
  const ids = new Set(Array.from(svg.matchAll(/\bid="([^"]+)"/g), (m) => m[1]!));
  return svg
    // id selectors in the figure's own stylesheet (`.inc #door{...}`); hex colours are not ids
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/g, (_m, attrs: string, css: string) =>
      `<style${attrs}>${css.replace(/#([A-Za-z][\w-]*)/g, (s, id: string) => (ids.has(id) ? `#${prefix}${id}` : s))}</style>`,
    )
    .replace(/\bid="([^"]+)"/g, (_m, id: string) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)\s"']+)\)/g, (_m, id: string) => `url(#${prefix}${id})`)
    .replace(/((?:xlink:)?href)="#([^"]+)"/g, (_m, attr: string, id: string) => `${attr}="#${prefix}${id}"`);
}

/** Strip the outer `<svg ...>` wrapper attributes we manage ourselves (viewBox, size, role). */
export function innerSvg(svg: string): { attrs: string; body: string } {
  const open = svg.match(/<svg\b([^>]*)>/);
  const close = svg.lastIndexOf("</svg>");
  if (!open || open.index === undefined || close < 0) return { attrs: "", body: svg };
  return { attrs: open[1] ?? "", body: svg.slice(open.index + open[0].length, close) };
}

/** First element found among candidate ids (already prefixed by the caller's prefix). */
export function pick<T extends Element = SVGGElement>(root: ParentNode | null, prefix: string, ...ids: string[]): T | null {
  if (!root) return null;
  for (const id of ids) {
    const el = root.querySelector(`#${CSS.escape(prefix + id)}`);
    if (el) return el as T;
  }
  return null;
}

/** `img` URL that shows a crop of the figure (SVG view fragment), used by mobile/reduced-motion. */
export function cropUrl(a: Anchor, pad = 0.2): string {
  const px = a.w * pad;
  const py = a.h * pad;
  const r = (v: number) => Math.round(v * 10) / 10;
  return `${FIGURE_SVG_URL}#svgView(viewBox(${r(a.x - px)},${r(a.y - py)},${r(a.w + 2 * px)},${r(a.h + 2 * py)}))`;
}
