import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  camAtScroll,
  camTransform,
  clamp01,
  easeInOut,
  fitAnchor,
  focusAt,
  lerpCam,
  project,
  scaleKey,
  zoomAbout,
  type Anchor,
  type Cam,
} from "./lib/camera.ts";
import { DEFAULT_ANCHORS, prefixIds, type FigureSource } from "./lib/figure.ts";
import { Icon } from "./fd.tsx";
import { LENS_PARTS, SCALE_LEVEL_ANCHORS, STAGE_CUES, frameFor } from "./story.ts";
import { World, worldBus } from "./world.ts";

const LENS_R = 112;
const LENS_ZOOM = 4;

interface Props {
  source: FigureSource | null;
  finePointer: boolean;
  /** One node per stage cue: the hero block first, then the chapter blocks. */
  blocks: ReactNode[];
  /** Rendered inside the pinned stage (loader, etc.). */
  overlay?: ReactNode;
}

/**
 * Pinned 100vh stage holding the incubator figure. Scroll position drives the camera on `#cam`
 * through the chapter anchors; chapter blocks scroll over the stage. One rAF loop runs only while
 * something changes and the theatre is on screen.
 */
export function Theatre({ source, finePointer, blocks, overlay }: Props) {
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
  const keyBarRef = useRef<HTMLSpanElement>(null);
  const keyLabelRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  const mainMarkup = useMemo(() => source?.svg ?? "", [source]);
  const lensMarkup = useMemo(() => (source && finePointer ? prefixIds(source.svg, "lz-") : ""), [source, finePointer]);

  useEffect(() => {
    const theatre = theatreRef.current;
    const stage = stageRef.current;
    const svg = hostRef.current?.querySelector("svg") ?? null;
    if (!source || !theatre || !stage || !svg) return;

    prepSvg(svg);
    const world = new World(svg, "");
    const lensSvg = lensHostRef.current?.querySelector("svg") ?? null;
    if (lensSvg) prepSvg(lensSvg);
    const lensWorld = lensSvg ? new World(lensSvg, "lz-") : null;
    const camEl = world.el("cam");
    const lensCam = lensWorld?.el("cam") ?? null;
    const anchors: Record<string, Anchor> = { ...DEFAULT_ANCHORS, ...source.cam.anchors };

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
      stops: [] as number[],
      cams: [] as Cam[],
      levels: [] as number[],
      cur: null as Cam | null,
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
      keyLabel: "",
      blocks: [] as HTMLElement[],
      door: "closed" as "closed" | "ajar",
    };

    const measure = () => {
      st.w = stage.clientWidth;
      st.h = stage.clientHeight;
      const vb = `0 0 ${st.w} ${st.h}`;
      svg.setAttribute("viewBox", vb);
      lensSvg?.setAttribute("viewBox", vb);
      overlaySvgRef.current?.setAttribute("viewBox", vb);
      if (lensHostRef.current) {
        lensHostRef.current.style.width = `${st.w}px`;
        lensHostRef.current.style.height = `${st.h}px`;
      }
      st.blocks = Array.from(theatre.querySelectorAll<HTMLElement>("[data-block]"));
      st.stops = st.blocks.map((b, i) => (i === 0 ? 0 : b.offsetTop + (b.offsetHeight - st.h) / 2));
      // Hero: keep the machine clear of the headline column and of the ticker strip.
      const heroCopy = st.blocks[0]?.querySelector<HTMLElement>(".ln-hero__copy");
      const heroFoot = st.blocks[0]?.querySelector<HTMLElement>(".ln-hero__foot");
      const heroInset = {
        left: heroCopy ? heroCopy.getBoundingClientRect().right - stage.getBoundingClientRect().left + 28 : 0,
        bottom: heroFoot ? st.h - heroFoot.offsetTop + 14 : 0,
      };
      st.cams = STAGE_CUES.map((cue) => fitAnchor(anchors[cue.anchor] ?? DEFAULT_ANCHORS[cue.anchor]!, frameFor(cue.side, st.w, st.h, heroInset), cue.margin));
      const mid = frameFor("left", st.w, st.h);
      st.levels = SCALE_LEVEL_ANCHORS.map((id) => fitAnchor(anchors[id]!, mid, 1.2).s);
      st.cur = null;
      schedule();
    };

    const schedule = () => {
      if (!st.raf && st.visible) st.raf = requestAnimationFrame(frame);
    };

    const frame = () => {
      st.raf = 0;
      const y = -theatre.getBoundingClientRect().top;
      const target = { ...camAtScroll(st.stops, st.cams, y) };
      const heroK = clamp01(1 - y / (st.h * 0.55));
      // pointer parallax, eased, strongest in the hero
      st.snx += (st.nx - st.snx) * 0.12;
      st.sny += (st.ny - st.sny) * 0.12;
      target.ox -= st.snx * 16 * (0.35 + 0.65 * heroK);
      target.oy -= st.sny * 10 * (0.35 + 0.65 * heroK);
      const prev = st.cur;
      st.cur = prev ? lerpCam(prev, target, 0.2) : target;
      const cur = st.cur;
      camEl?.setAttribute("transform", camTransform(cur));
      // depth layers drift against each other (in figure units, so the effect fades when deep)
      const front = `translate(${(-st.snx * 7).toFixed(2)}px, ${(-st.sny * 4.5).toFixed(2)}px)`;
      const back = `translate(${(st.snx * 6).toFixed(2)}px, ${(st.sny * 3.5).toFixed(2)}px)`;
      for (const w of lensWorld ? [world, lensWorld] : [world]) {
        const f = w.el<SVGGElement>("layer-front");
        if (f) f.style.transform = front;
        const b = w.el<SVGGElement>("layer-back");
        if (b) b.style.transform = back;
      }

      // active chapter + leader line
      const { index, focus } = focusAt(st.stops, y);
      const active = focus > 0.3 ? index : -1;
      if (active !== st.active) {
        st.active = active;
        st.blocks.forEach((b, i) => b.toggleAttribute("data-active", i === active));
        world.apply({ type: "stage", index: active < 0 ? null : active });
        stage.dataset.chapter = String(active);
      }
      drawLeader(index, focus, cur);

      // scale key
      const key = scaleKey(cur.s, st.levels);
      if (key.label !== st.keyLabel && keyLabelRef.current) {
        st.keyLabel = key.label;
        keyLabelRef.current.textContent = key.label;
      }
      if (keyBarRef.current) keyBarRef.current.style.transform = `scaleX(${(key.bar / 64).toFixed(3)})`;
      stage.style.setProperty("--hero", heroK.toFixed(3));

      // microscope lens (hero only): rests over the dish, follows the pointer inside the window,
      // clamped to the dish and the thermometer so it never magnifies empty glass.
      const lensWanted = finePointer && heroK > 0.6;
      if (lensWanted !== st.lensOn) {
        st.lensOn = lensWanted;
        lensRef.current?.toggleAttribute("data-on", lensWanted);
      }
      let lensMoving = false;
      if (lensWanted && lensRef.current && lensHostRef.current && lensCam) {
        const [tx, ty] = lensTarget(cur);
        if (st.lx < 0) {
          st.lx = tx;
          st.ly = ty;
        } else {
          st.lx += (tx - st.lx) * 0.22;
          st.ly += (ty - st.ly) * 0.22;
        }
        lensMoving = Math.abs(tx - st.lx) + Math.abs(ty - st.ly) > 0.3;
        const lx = st.lx - LENS_R;
        const ly = st.ly - LENS_R;
        lensRef.current.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        lensHostRef.current.style.transform = `translate3d(${(-lx).toFixed(1)}px, ${(-ly).toFixed(1)}px, 0)`;
        lensCam.setAttribute("transform", camTransform(zoomAbout(cur, LENS_ZOOM, st.lx, st.ly)));
        if (lensTagRef.current) lensTagRef.current.textContent = `×${LENS_ZOOM} · ${partAt(cur, st.lx, st.ly)}`;
      }

      const moving =
        lensMoving ||
        !prev ||
        Math.abs(prev.s - target.s) / target.s > 1e-4 ||
        Math.abs(prev.ox - target.ox) + Math.abs(prev.oy - target.oy) > 0.05 ||
        Math.abs((prev.cx - target.cx) * cur.s) + Math.abs((prev.cy - target.cy) * cur.s) > 0.05 ||
        Math.abs(st.nx - st.snx) + Math.abs(st.ny - st.sny) > 0.002;
      if (moving) schedule();
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

    const drawLeader = (index: number, focus: number, cam: Cam) => {
      const path = leaderRef.current;
      const dot = leaderDotRef.current;
      const start = leaderStartRef.current;
      const elbow = leaderElbowRef.current;
      const tag = leaderTagRef.current;
      if (!path || !dot || !start || !elbow || !tag) return;
      const cue = STAGE_CUES[index];
      const block = st.blocks[index];
      const card = block?.querySelector<HTMLElement>("[data-card]");
      if (!cue || cue.side === "hero" || !card || focus <= 0) {
        path.style.opacity = "0";
        for (const n of [dot, start, elbow]) n.style.opacity = "0";
        tag.style.opacity = "0";
        return;
      }
      const sr = stage.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      const [ex, ey] = project(cam, targets[index]![0], targets[index]![1]);
      const left = cue.side === "left";
      // Leaves the card at its title bar, runs out horizontally, then bends to the part.
      const sx = (left ? cr.right : cr.left) - sr.left;
      const sy = cr.top - sr.top + 13;
      const mx = sx + (left ? 44 : -44);
      const d = `M${sx.toFixed(1)} ${sy.toFixed(1)}H${mx.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`;
      const len = Math.abs(mx - sx) + Math.hypot(ex - mx, ey - sy);
      const k = easeInOut(focus);
      const done = k > 0.9;
      path.setAttribute("d", d);
      path.style.strokeDasharray = `${len.toFixed(1)}`;
      path.style.strokeDashoffset = `${(len * (1 - k)).toFixed(1)}`;
      path.style.opacity = "1";
      node(start, sx + (left ? 4 : -4), sy, 7, true);
      node(elbow, mx, sy, 6, k > 0.2);
      node(dot, ex, ey, 9, done);
      if (leaderTagTextRef.current && leaderTagTextRef.current.textContent !== cue.part) leaderTagTextRef.current.textContent = cue.part;
      // Caption box sits beside the part, on the side away from the card.
      const tw = tag.offsetWidth;
      const tx = left ? ex + 14 : ex - 14 - tw;
      tag.style.transform = `translate3d(${tx.toFixed(1)}px, ${(ey - 11).toFixed(1)}px, 0)`;
      tag.style.opacity = done ? "1" : "0";
    };

    const onScroll = () => schedule();
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const r = stage.getBoundingClientRect();
      st.px = e.clientX - r.left;
      st.py = e.clientY - r.top;
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
      ro.disconnect();
      io.disconnect();
      off();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      svg.removeEventListener("pointerover", onOver);
    };
  }, [source, finePointer]);

  return (
    <div className="ln-theatre" ref={theatreRef}>
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
        <div className="ln-scalekey" aria-hidden="true">
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
