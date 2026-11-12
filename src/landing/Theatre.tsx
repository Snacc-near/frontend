import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  aheadCam,
  camAtScroll,
  camDelta,
  camTransform,
  clamp01,
  easeInOut,
  fitAnchor,
  focusAt,
  lerpCam,
  pathWarp,
  project,
  relCam,
  relCovers,
  relTransform,
  scaleKey,
  smoothK,
  zoomAbout,
  type Anchor,
  type Cam,
  type Warp,
} from "./lib/camera.ts";
import { DEFAULT_ANCHORS, prefixIds, type FigureSource } from "./lib/figure.ts";
import { Icon } from "../ui/fd.tsx";
import { LENS_PARTS, SCALE_LEVEL_ANCHORS, STAGE_CUES, THEATRE, cardOpacity, frameFor, type TheatreMap } from "./story.ts";
import { World, worldBus } from "./world.ts";

const LENS_R = 112;
const LENS_ZOOM = 4;
/** Share of each camera move held still at both ends. */
const HOLD = 0.08;
/** Time constant of the camera smoothing (ms): frame-rate independent, so a slow frame never lurches. */
const CAM_TAU = 90;
/** Camera changes smaller than this (screen px) are not written to the DOM. */
const EPS = 0.05;
/** The figure's idle loops pause until this long after the last scroll event (ms). */
const SCROLL_IDLE = 150;
/** Margin painted around the stage (share of its larger side), so a composited move can reveal it. */
const PAD = 0.25;
/**
 * Composited zoom band: the figure is painted at the shown zoom or up to 1/REL_LO above it and only
 * ever scaled down by the compositor (scaling up would need new, sharper tiles mid-move).
 */
const REL_LO = 0.75;

interface Props {
  source: FigureSource | null;
  finePointer: boolean;
  /** One node per stage cue: the hero block first, then the chapter blocks. */
  blocks: ReactNode[];
  /** Static scroll map the blocks were laid out with (viewport heights). */
  map: TheatreMap;
  /** Rendered inside the pinned stage (loader, etc.). */
  overlay?: ReactNode;
}

const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/**
 * Pinned 100vh stage holding the incubator figure. Scroll position drives the camera through the
 * chapter anchors; chapter cards sit in sticky layers over the stage and cross-fade.
 * The camera is split in two: `#cam` holds a base camera the figure is painted with, and the
 * composited `.ln-world` layer carries the rest as a CSS transform. While the page scrolls only
 * that transform changes, so the GPU keeps drawing tiles it already has; the base is repainted when
 * the zoom leaves a small band (lines keep their width) or the margin runs out, and once more at
 * rest so a still frame is painted exactly at its camera.
 * One rAF loop runs only while something changes and the theatre is on screen; it reads no layout
 * per frame and writes only what changed.
 */
export function Theatre({ source, finePointer, blocks, map, overlay }: Props) {
  const theatreRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const lensHostRef = useRef<HTMLDivElement>(null);
  const lensTagRef = useRef<HTMLSpanElement>(null);
  const leaderRef = useRef<SVGPathElement>(null);
  const leaderStartRef = useRef<SVGRectElement>(null);
  const leaderElbowRef = useRef<SVGRectElement>(null);
  const leaderDotRef = useRef<SVGRectElement>(null);
  const leaderTagRef = useRef<HTMLSpanElement>(null);
  const leaderTagTextRef = useRef<HTMLSpanElement>(null);
  const overlaySvgRef = useRef<SVGSVGElement>(null);
  const keyRef = useRef<HTMLDivElement>(null);
  const keyBarRef = useRef<HTMLSpanElement>(null);
  const keyLabelRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  const mainMarkup = useMemo(() => source?.svg ?? "", [source]);
  const lensMarkup = useMemo(() => (source && finePointer ? prefixIds(source.svg, "lz-") : ""), [source, finePointer]);

  useEffect(() => {
    const theatre = theatreRef.current;
    const stage = stageRef.current;
    const host = hostRef.current;
    const svg = host?.querySelector("svg") ?? null;
    if (!source || !theatre || !stage || !host || !svg) return;

    prepSvg(svg);
    host.style.transform = "";
    const world = new World(svg, "");
    const lensSvg = lensHostRef.current?.querySelector("svg") ?? null;
    if (lensSvg) prepSvg(lensSvg);
    const lensWorld = lensSvg ? new World(lensSvg, "lz-") : null;
    const camEl = world.el("cam");
    const lensCam = lensWorld?.el("cam") ?? null;
    const layersOf = (w: World | null) => (w ? [w.el<SVGGElement>("layer-front"), w.el<SVGGElement>("layer-back")] : []);
    const mainLayers = layersOf(world);
    const lensLayers = layersOf(lensWorld);
    const anchors: Record<string, Anchor> = { ...DEFAULT_ANCHORS, ...source.cam.anchors };
    const blockEls = Array.from(theatre.querySelectorAll<HTMLElement>("[data-block]"));
    const cardEls = blockEls.slice(1).map((b) => b.querySelector<HTMLElement>("[data-card]"));
    const heroCopy = blockEls[0]?.querySelector<HTMLElement>(".ln-hero__copy") ?? null;
    const heroFoot = blockEls[0]?.querySelector<HTMLElement>(".ln-hero__foot") ?? null;

    // Part positions, measured once with an identity camera.
    camEl?.removeAttribute("transform");
    const targets: Array<[number, number]> = STAGE_CUES.map((cue) => {
      for (const id of cue.targets) {
        const p = world.worldPoint(id);
        if (p) return p;
      }
      const a = anchors[cue.anchor]!;
      return [a.x + a.w / 2, a.y + a.h / 2];
    });

    const st = {
      w: 0,
      h: 0,
      top0: 0,
      stops: [] as number[],
      cams: [] as Cam[],
      warps: [] as Warp[],
      levels: [] as number[],
      cards: [] as Array<{ l: number; r: number; t: number } | null>,
      cur: null as Cam | null,
      /** camera the figure is painted with (`#cam`) */
      base: null as Cam | null,
      /** composited transform last written on `.ln-world` */
      rel: "",
      pad: 0,
      lensCamT: "",
      lastT: 0,
      raf: 0,
      visible: true,
      px: -1,
      py: -1,
      lx: -1,
      ly: -1,
      nx: 0,
      ny: 0,
      snx: 0,
      sny: 0,
      lensOn: false,
      active: -1,
      door: "closed" as "closed" | "ajar",
      // last written values, so unchanged frames touch nothing
      layerFront: "",
      layerBack: "",
      hero: -1,
      cardK: [] as number[],
      cardOn: [] as boolean[],
      keyLabel: "",
      keyBar: "",
      keyOp: "",
      keySide: "",
      deep: false,
      tagText: "",
      tagW: 0,
      leaderOn: true,
      scrolling: false,
      scrollTimer: 0,
    };

    const measure = () => {
      // a card that changes height only needs a new pin; the camera keeps easing from where it is
      const resized = st.w !== stage.clientWidth || st.h !== stage.clientHeight;
      st.w = stage.clientWidth;
      st.h = stage.clientHeight;
      const vb = `0 0 ${st.w} ${st.h}`;
      // the figure is painted with a margin so a composited move does not run off its edge
      st.pad = Math.round(Math.max(st.w, st.h) * PAD);
      svg.setAttribute("viewBox", `${-st.pad} ${-st.pad} ${st.w + 2 * st.pad} ${st.h + 2 * st.pad}`);
      host.style.setProperty("--pad", `${st.pad}px`);
      lensSvg?.setAttribute("viewBox", vb);
      overlaySvgRef.current?.setAttribute("viewBox", vb);
      if (lensHostRef.current) {
        lensHostRef.current.style.width = `${st.w}px`;
        lensHostRef.current.style.height = `${st.h}px`;
      }
      st.top0 = theatre.getBoundingClientRect().top + window.scrollY;
      st.stops = map.stops.map((v) => v * st.h);
      // Hero: keep the machine clear of the headline column and of the ticker strip.
      const heroInset = {
        left: heroCopy ? heroCopy.getBoundingClientRect().right - stage.getBoundingClientRect().left + 28 : 0,
        bottom: heroFoot ? st.h - heroFoot.offsetTop + 14 : 0,
      };
      st.cams = STAGE_CUES.map((cue) => fitAnchor(anchors[cue.anchor] ?? DEFAULT_ANCHORS[cue.anchor]!, frameFor(cue.side, st.w, st.h, heroInset), cue.margin));
      st.warps = st.cams.slice(1).map((b, i) => pathWarp(st.cams[i]!, b, st.w, st.h));
      // Chapter cards: pin each one centred between the header and the status bar.
      const headB = document.querySelector(".ln-header")?.getBoundingClientRect().bottom ?? 0;
      const barT = st.h - (document.querySelector<HTMLElement>(".fd-status")?.offsetHeight ?? 0);
      st.cards = cardEls.map((card) => {
        if (!card) return null;
        const pin = Math.round(Math.max(headB + 10, headB + (barT - headB - card.offsetHeight) / 2));
        card.style.setProperty("--pin", `${pin}px`);
        return { l: card.offsetLeft, r: card.offsetLeft + card.offsetWidth, t: pin };
      });
      const mid = frameFor("left", st.w, st.h);
      st.levels = SCALE_LEVEL_ANCHORS.map((id) => fitAnchor(anchors[id]!, mid, 1.2).s);
      if (resized) {
        st.cur = null;
        st.base = null;
      }
      st.hero = -1;
      st.cardK = [];
      st.tagText = "";
      schedule();
    };

    const schedule = () => {
      if (!st.raf && st.visible) st.raf = requestAnimationFrame(frame);
    };

    const frame = (now: number) => {
      st.raf = 0;
      const dt = st.lastT ? Math.min(250, now - st.lastT) : 1000 / 60;
      st.lastT = now;
      const y = window.scrollY - st.top0;
      const yh = st.h > 0 ? y / st.h : 0;
      const target = { ...camAtScroll(st.stops, st.cams, y, HOLD, st.warps) };
      const heroK = clamp01(1 - y / (st.h * 0.55));
      // pointer parallax, eased, strongest in the hero
      const kp = smoothK(dt, 110);
      st.snx += (st.nx - st.snx) * kp;
      st.sny += (st.ny - st.sny) * kp;
      target.ox -= st.snx * 16 * (0.35 + 0.65 * heroK);
      target.oy -= st.sny * 10 * (0.35 + 0.65 * heroK);
      const prev = st.cur;
      let cur = prev ? lerpCam(prev, target, smoothK(dt, CAM_TAU)) : target;
      if (camDelta(cur, target, st.w, st.h) < EPS) cur = target;
      st.cur = cur;
      const pointerEasing = Math.abs(st.nx - st.snx) + Math.abs(st.ny - st.sny) > 0.002;
      // Repaint the figure at the current camera only when the composited move would run out of
      // band, or once the page is still (so a resting frame is painted exactly, never resampled).
      const still = !st.scrolling && cur === target && !pointerEasing;
      const base = paintCam(st.base, cur, still);
      if (base !== st.base) {
        camEl?.setAttribute("transform", camTransform(base));
        st.base = base;
      }
      const rel = base === cur ? "" : relTransform(relCam(base, cur));
      if (rel !== st.rel) {
        st.rel = rel;
        host.style.transform = rel;
      }
      // Depth layers drift against each other with the pointer, in the hero only and never while the
      // page scrolls: each write repaints the figure.
      if (heroK > 0 && !st.scrolling) {
        const front = `translate(${(-st.snx * 7).toFixed(2)}px, ${(-st.sny * 4.5).toFixed(2)}px)`;
        const back = `translate(${(st.snx * 6).toFixed(2)}px, ${(st.sny * 3.5).toFixed(2)}px)`;
        if (front !== st.layerFront || back !== st.layerBack) {
          st.layerFront = front;
          st.layerBack = back;
          writeLayers(mainLayers);
          if (st.lensOn) writeLayers(lensLayers);
        }
      }

      // hero UI fades out in place (its layer is sticky) before the camera leaves the hero frame
      const hp = Math.round(smoothstep((yh - THEATRE.heroFade[0]) / (THEATRE.heroFade[1] - THEATRE.heroFade[0])) * 200) / 200;
      if (hp !== st.hero) {
        st.hero = hp;
        for (const [el, dy] of [
          [heroCopy, -24],
          [heroFoot, 14],
        ] as const) {
          if (!el) continue;
          el.style.opacity = hp > 0 ? String(1 - hp) : "";
          el.style.transform = hp > 0 ? `translate3d(0, ${(hp * dy).toFixed(1)}px, 0)` : "";
          el.style.visibility = hp >= 1 ? "hidden" : "";
        }
      }

      // chapter cards: opacity follows the scroll map, so one card always shows or two cross-fade
      let bestK = 0;
      let best = -1;
      cardEls.forEach((card, i) => {
        if (!card) return;
        const k = Math.round(cardOpacity(map, i, yh) * 100) / 100;
        if (k > bestK) {
          bestK = k;
          best = i;
        }
        if (k === st.cardK[i]) return;
        st.cardK[i] = k;
        // opacity only: a moving card would shift its text on every scroll step
        card.style.opacity = String(k);
        const on = k > 0.5;
        if (on !== st.cardOn[i]) {
          st.cardOn[i] = on;
          blockEls[i + 1]?.toggleAttribute("data-active", on);
        }
      });

      // active chapter (figure state) + leader line
      const { index, focus } = focusAt(st.stops, y, HOLD);
      const active = focus > 0.3 ? index : -1;
      if (active !== st.active) {
        st.active = active;
        world.apply({ type: "stage", index: active < 0 ? null : active });
        stage.dataset.chapter = String(active);
      }
      const leaderIdx = best >= 0 ? best + 1 : index;
      drawLeader(leaderIdx, leaderIdx === index ? focus : 0, best >= 0 ? (st.cardK[best] ?? 0) : 0, cur);

      // scale key
      const key = scaleKey(cur.s, st.levels);
      if (key.label !== st.keyLabel && keyLabelRef.current) {
        st.keyLabel = key.label;
        keyLabelRef.current.textContent = key.label;
      }
      const bar = `scaleX(${(key.bar / 64).toFixed(3)})`;
      if (bar !== st.keyBar && keyBarRef.current) {
        st.keyBar = bar;
        keyBarRef.current.style.transform = bar;
      }
      // the key sits on the figure side; it fades out through a card cross-fade and swaps sides
      // while invisible
      const keySide = best >= 0 && STAGE_CUES[best + 1]?.side === "right" ? "left" : "right";
      if (keySide !== st.keySide) {
        st.keySide = keySide;
        stage.dataset.keySide = keySide;
      }
      const keyOp = ((1 - heroK) * clamp01(2 * bestK - 1)).toFixed(2);
      if (keyOp !== st.keyOp && keyRef.current) {
        st.keyOp = keyOp;
        keyRef.current.style.opacity = keyOp;
      }
      // specks and droplets shrink while the camera is deeper than half-way between colony and cell
      // (read from the painted camera, so the swap lands on a frame that repaints anyway)
      const deep = st.levels.length > 3 && base.s > Math.sqrt(st.levels[2]! * st.levels[3]!);
      if (deep !== st.deep) {
        st.deep = deep;
        stage.toggleAttribute("data-deep", deep);
      }

      // microscope lens (hero only): rests over the dish, follows the pointer inside the window,
      // clamped to the dish and the thermometer so it never magnifies empty glass.
      const lensWanted = finePointer && heroK > 0.6;
      if (lensWanted !== st.lensOn) {
        st.lensOn = lensWanted;
        // off, the lens copy is not rendered at all (display: none) and gets no writes
        lensRef.current?.toggleAttribute("data-on", lensWanted);
        if (lensWanted) writeLayers(lensLayers);
      }
      let lensMoving = false;
      if (lensWanted && lensRef.current && lensHostRef.current && lensCam) {
        const [tx, ty] = lensTarget(cur);
        if (st.lx < 0) {
          st.lx = tx;
          st.ly = ty;
        } else {
          const kl = smoothK(dt, 55);
          st.lx += (tx - st.lx) * kl;
          st.ly += (ty - st.ly) * kl;
        }
        lensMoving = Math.abs(tx - st.lx) + Math.abs(ty - st.ly) > 0.3;
        const lx = st.lx - LENS_R;
        const ly = st.ly - LENS_R;
        lensRef.current.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        lensHostRef.current.style.transform = `translate3d(${(-lx).toFixed(1)}px, ${(-ly).toFixed(1)}px, 0)`;
        const lt = camTransform(zoomAbout(cur, LENS_ZOOM, st.lx, st.ly));
        if (lt !== st.lensCamT) {
          st.lensCamT = lt;
          lensCam.setAttribute("transform", lt);
        }
        const tag = `×${LENS_ZOOM} · ${partAt(cur, st.lx, st.ly)}`;
        if (lensTagRef.current && lensTagRef.current.textContent !== tag) lensTagRef.current.textContent = tag;
      }

      const moving = lensMoving || cur !== target || pointerEasing;
      if (moving) schedule();
      else st.lastT = 0;
    };

    /** Camera to paint the figure with: the current one unless the composited move still fits. */
    const paintCam = (base: Cam | null, cur: Cam, still: boolean): Cam => {
      if (!base) return cur;
      // still: below this the composited remainder rounds to the identity (see relTransform)
      if (still) return camDelta(base, cur, st.w, st.h) >= 0.005 ? cur : base;
      const rel = relCam(base, cur);
      if (relCovers(rel, st.w, st.h, st.pad, REL_LO, 1)) return base;
      // zooming in: paint ahead (the layer then shrinks back towards 1:1); zooming out or panning:
      // paint at the shown zoom, or keep the current ratio when that still fits
      const ahead = aheadCam(cur, rel.r > 1 ? 1 / REL_LO : rel.r < REL_LO ? 1 : 1 / rel.r);
      return relCovers(relCam(ahead, cur), st.w, st.h, st.pad, REL_LO, 1) ? ahead : cur;
    };

    const writeLayers = (gs: Array<SVGGElement | null>) => {
      gs.forEach((g, i) => {
        if (g) g.style.transform = i % 2 === 0 ? st.layerFront : st.layerBack;
      });
    };

    const screenBox = (cam: Cam, id: string, inset = 0): [number, number, number, number] | null => {
      const a = anchors[id];
      if (!a) return null;
      const [x0, y0] = project(cam, a.x + a.w * inset, a.y + a.h * inset);
      const [x1, y1] = project(cam, a.x + a.w * (1 - inset), a.y + a.h * (1 - inset));
      return [x0, y0, x1, y1];
    };

    /** Lens centre: the dish centre at rest; inside the window, the nearest point of dish or thermometer. */
    const lensTarget = (cam: Cam): [number, number] => {
      const dish = screenBox(cam, "ch-dish", 0.14);
      if (!dish) return [st.w / 2, st.h / 2];
      const rest: [number, number] = [(dish[0] + dish[2]) / 2, (dish[1] + dish[3]) / 2];
      const win = screenBox(cam, "ch-door");
      if (st.px < 0 || !win || st.px < win[0] || st.px > win[2] || st.py < win[1] || st.py > win[3]) return rest;
      let best = rest;
      let bestD = Infinity;
      for (const b of [dish, screenBox(cam, "ch-thermo", 0.08)]) {
        if (!b) continue;
        const x = Math.max(b[0], Math.min(b[2], st.px));
        const y = Math.max(b[1], Math.min(b[3], st.py));
        const d = Math.hypot(x - st.px, y - st.py);
        if (d < bestD) {
          bestD = d;
          best = [x, y];
        }
      }
      return best;
    };

    const partAt = (cam: Cam, px: number, py: number) => {
      for (const [id, name] of LENS_PARTS) {
        const a = anchors[id];
        if (!a) continue;
        const [x0, y0] = project(cam, a.x, a.y);
        const [x1, y1] = project(cam, a.x + a.w, a.y + a.h);
        if (px >= x0 && px <= x1 && py >= y0 && py <= y1) return name;
      }
      return "glass";
    };

    /** Square handle node centred on (x, y). */
    const node = (el: SVGRectElement, x: number, y: number, size: number, on: boolean) => {
      el.setAttribute("x", (x - size / 2).toFixed(1));
      el.setAttribute("y", (y - size / 2).toFixed(1));
      el.setAttribute("width", String(size));
      el.setAttribute("height", String(size));
      el.style.opacity = on ? "1" : "0";
    };

    /** Leader from the visible card's title bar to its part; `k` is the card's opacity. */
    const drawLeader = (index: number, focus: number, k: number, cam: Cam) => {
      const path = leaderRef.current;
      const dot = leaderDotRef.current;
      const start = leaderStartRef.current;
      const elbow = leaderElbowRef.current;
      const tag = leaderTagRef.current;
      if (!path || !dot || !start || !elbow || !tag) return;
      const cue = STAGE_CUES[index];
      const box = st.cards[index - 1];
      if (!cue || cue.side === "hero" || !box || focus <= 0 || k <= 0) {
        if (st.leaderOn) {
          st.leaderOn = false;
          path.style.opacity = "0";
          for (const n of [dot, start, elbow]) n.style.opacity = "0";
          tag.style.opacity = "0";
        }
        return;
      }
      st.leaderOn = true;
      const [ex, ey] = project(cam, targets[index]![0], targets[index]![1]);
      const left = cue.side === "left";
      // Leaves the card at its title bar, runs out horizontally, then bends to the part.
      const sx = left ? box.r : box.l;
      const sy = box.t + 13;
      const mx = sx + (left ? 44 : -44);
      const d = `M${sx.toFixed(1)} ${sy.toFixed(1)}H${mx.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`;
      const len = Math.abs(mx - sx) + Math.hypot(ex - mx, ey - sy);
      const e = easeInOut(focus);
      const done = e > 0.9;
      path.setAttribute("d", d);
      path.style.strokeDasharray = `${len.toFixed(1)}`;
      path.style.strokeDashoffset = `${(len * (1 - e)).toFixed(1)}`;
      path.style.opacity = k.toFixed(2);
      node(start, sx + (left ? 4 : -4), sy, 7, k > 0.5);
      node(elbow, mx, sy, 6, k > 0.5 && e > 0.2);
      node(dot, ex, ey, 9, k > 0.5 && done);
      if (st.tagText !== cue.part && leaderTagTextRef.current) {
        st.tagText = cue.part;
        leaderTagTextRef.current.textContent = cue.part;
        st.tagW = tag.offsetWidth;
      }
      // Caption box sits beside the part, on the side away from the card.
      const tx = left ? ex + 14 : ex - 14 - st.tagW;
      tag.style.transform = `translate3d(${tx.toFixed(1)}px, ${(ey - 11).toFixed(1)}px, 0)`;
      tag.style.opacity = k > 0.5 && done ? "1" : "0";
    };

    const onScroll = () => {
      schedule();
      // idle CSS loops pause while the page moves (see landing.css), so frames go to the camera
      if (!st.scrolling) {
        st.scrolling = true;
        stage.setAttribute("data-scrolling", "");
      }
      window.clearTimeout(st.scrollTimer);
      st.scrollTimer = window.setTimeout(() => {
        st.scrolling = false;
        stage.removeAttribute("data-scrolling");
        // the page is still: repaint the figure at its exact camera
        schedule();
      }, SCROLL_IDLE);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      st.px = e.clientX;
      st.py = e.clientY;
      st.nx = (st.px / Math.max(1, st.w)) * 2 - 1;
      st.ny = (st.py / Math.max(1, st.h)) * 2 - 1;
      schedule();
    };
    const onLeave = () => {
      st.px = -1;
      st.nx = 0;
      st.ny = 0;
      schedule();
    };
    // Door cracks open on hover (hero only).
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const onDoor = !!t?.closest?.("#door, #door-closed, #ch-door");
      const want = onDoor && st.active === 0 ? "ajar" : "closed";
      if (want !== st.door) {
        st.door = want;
        world.setDoor(want);
      }
    };

    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(theatre);
    // a card whose content changes height gets a new pin offset
    for (const card of cardEls) if (card) ro.observe(card);
    const io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      st.visible = !!entry?.isIntersecting;
      // Off screen: stop painting the figure (its idle CSS loops included) and the rAF loop.
      stage.toggleAttribute("data-off", !st.visible);
      if (st.visible) schedule();
    });
    io.observe(theatre);
    const off = worldBus.on((ev) => {
      world.apply(ev);
      lensWorld?.apply(ev);
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    svg.addEventListener("pointerover", onOver);
    measure();
    setMounted(true);

    return () => {
      cancelAnimationFrame(st.raf);
      window.clearTimeout(st.scrollTimer);
      stage.removeAttribute("data-scrolling");
      host.style.transform = "";
      ro.disconnect();
      io.disconnect();
      off();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      svg.removeEventListener("pointerover", onOver);
    };
  }, [source, finePointer, map]);

  return (
    <div className="ln-theatre" ref={theatreRef} style={{ "--total": String(Math.round(map.total * 10000) / 10000) } as CSSProperties}>
      <div className="ln-stage" ref={stageRef} data-ready={mounted ? "" : undefined}>
        <div className="ln-world" ref={hostRef} aria-hidden="true" dangerouslySetInnerHTML={{ __html: mainMarkup }} />
        <svg className="ln-overlay" ref={overlaySvgRef} aria-hidden="true">
          <path ref={leaderRef} className="ln-leader" d="M0 0" />
          <rect ref={leaderStartRef} className="ln-leader-node" x="-20" y="-20" width="7" height="7" />
          <rect ref={leaderElbowRef} className="ln-leader-node" x="-20" y="-20" width="6" height="6" />
          <rect ref={leaderDotRef} className="ln-leader-node ln-leader-node--hot" x="-20" y="-20" width="9" height="9" />
        </svg>
        <span className="fd-cap ln-leader-cap" ref={leaderTagRef} aria-hidden="true">
          <Icon name="ring" />
          <span ref={leaderTagTextRef} />
        </span>
        {finePointer ? (
          <>
            <div className="ln-lens" ref={lensRef} aria-hidden="true">
              <div className="ln-lens__glass">
                <div className="ln-lens__host" ref={lensHostRef} dangerouslySetInnerHTML={{ __html: lensMarkup }} />
              </div>
              <span className="fd-cap ln-lens__tag">
                <Icon name="eye" />
                <span ref={lensTagRef}>×{LENS_ZOOM}</span>
              </span>
            </div>
          </>
        ) : null}
        <div className="ln-scalekey" ref={keyRef} aria-hidden="true">
          <span className="ln-scalekey__bar" ref={keyBarRef} />
          <span className="ln-scalekey__label" ref={keyLabelRef}>
            1 cm
          </span>
        </div>
        {overlay}
      </div>
      <div className="ln-blocks">{blocks}</div>
    </div>
  );
}

function prepSvg(svg: SVGSVGElement) {
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  svg.setAttribute("aria-hidden", "true");
  svg.removeAttribute("role");
  svg.classList.add("ln-world__svg");
}
