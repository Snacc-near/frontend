/**
 * Thin controller over one inline copy of the incubator figure, plus a tiny event bus so the
 * chapter demos can poke the world without knowing whether a figure is mounted.
 * Hooks follow `incubator.cam.json` ("hooks"); every id is optional and a missing one is a no-op.
 * The figure runs its own idle CSS animations; a controlled part gets `animation: none` while
 * driven and is handed back to its idle loop on reset.
 */
import { pick } from "./lib/figure.ts";
import type { ZoneKey } from "./lib/live.ts";

export type WorldEvent =
  | { type: "feed" }
  | { type: "full"; v: number }
  | { type: "capsule"; k: number }
  | { type: "atp"; stage?: number }
  | { type: "snack" }
  | { type: "merge" }
  | { type: "seal"; on: boolean }
  | { type: "stage"; index: number | null }
  | { type: "thermo"; g: number; zone: ZoneKey }
  | { type: "door"; state: DoorState }
  | { type: "reset" };

export type DoorState = "closed" | "ajar" | "open";

type Listener = (e: WorldEvent) => void;
const listeners = new Set<Listener>();
/** Sticky state replayed to late subscribers (a figure that mounts after the demo set it). */
const sticky = new Map<WorldEvent["type"], WorldEvent>();

export const worldBus = {
  emit(e: WorldEvent) {
    if (e.type === "thermo" || e.type === "seal" || e.type === "full") sticky.set(e.type, e);
    for (const l of listeners) l(e);
  },
  on(l: Listener) {
    listeners.add(l);
    for (const e of sticky.values()) l(e);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Gauge position (0..1) of the zone boundaries; must match `tempToGauge` in lib/live.ts. */
const G_FAMINE_TOP = 0.45;
const G_FRENZY_BOTTOM = 0.55;

type Css = SVGElement & ElementCSSInlineStyle;

export class World {
  readonly root: SVGSVGElement;
  readonly prefix: string;
  private timers = new Map<string, number>();
  private bands: { top: number; normalTop: number; normalBottom: number; bottom: number; pointerY: number } | null = null;
  private tint: SVGRectElement | null = null;

  constructor(root: SVGSVGElement, prefix: string) {
    this.root = root;
    this.prefix = prefix;
    this.installTint();
    // Class hooks so the landing CSS also reaches id-prefixed copies of the figure.
    for (const [id, cls] of [
      ["ch-cell-stomach", "w-stomach"],
      ["cell-hungry", "w-hungry"],
      ["stamp", "w-stamp"],
      ["ch-mito-atp", "w-atp-coins"],
      ["ch-mito-atp-0", "w-coin-0"],
      ["ch-mito-atp-1", "w-coin-1"],
      ["ch-mito-atp-2", "w-coin-2"],
    ] as const) {
      this.el(id)?.classList.add(cls);
    }
  }

  el<T extends Element = SVGGElement>(...ids: string[]): T | null {
    return pick<T>(this.root, this.prefix, ...ids);
  }

  /** Colour wash inside the window (clipped by the interior group): medium tint per appetite zone. */
  private installTint() {
    const interior = this.el("ch-interior");
    if (!interior || interior.querySelector(".ln-tint")) return;
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", "0");
    r.setAttribute("y", "0");
    r.setAttribute("width", "1600");
    r.setAttribute("height", "1000");
    r.setAttribute("class", "ln-tint");
    interior.appendChild(r);
    this.tint = r;
  }

  private later(key: string, ms: number, fn: () => void) {
    const old = this.timers.get(key);
    if (old) window.clearTimeout(old);
    this.timers.set(
      key,
      window.setTimeout(() => {
        this.timers.delete(key);
        fn();
      }, ms),
    );
  }

  flag(cls: string, ms = 0) {
    this.root.classList.add(cls);
    if (ms > 0) this.later(cls, ms, () => this.root.classList.remove(cls));
  }

  setDoor(state: DoorState) {
    if (state === "open") this.root.dataset.door = "open";
    else delete this.root.dataset.door;
    const door = this.el<Css>("door");
    if (door) door.style.setProperty("--door", state === "open" ? "100deg" : state === "ajar" ? "18deg" : "0deg");
    const spill = this.el<Css>("door-spill");
    if (spill) spill.style.opacity = state === "open" ? "1" : state === "ajar" ? "0.4" : "";
  }

  private measureBands() {
    if (this.bands) return this.bands;
    const f = this.el<SVGGraphicsElement>("zone-frenzy");
    const n = this.el<SVGGraphicsElement>("zone-normal");
    const m = this.el<SVGGraphicsElement>("zone-famine");
    const p = this.el<SVGGraphicsElement>("thermo-pointer");
    if (!f || !n || !m || !p) return null;
    try {
      const fb = f.getBBox();
      const nb = n.getBBox();
      const mb = m.getBBox();
      const pb = p.getBBox();
      if (fb.height <= 0 || mb.height <= 0) return null; // not laid out yet: measure next time
      this.bands = {
        top: fb.y,
        normalTop: nb.y,
        normalBottom: nb.y + nb.height,
        bottom: mb.y + mb.height,
        pointerY: pb.y + pb.height / 2,
      };
    } catch {
      return null;
    }
    return this.bands;
  }

  /** Thermometer level 0..1 (gauge scale), dial needle, zone pointer and the medium wash. */
  setThermo(g: number, zone: ZoneKey) {
    const fill = this.el<Css>("thermo-fill");
    if (fill) {
      fill.style.animation = "none";
      fill.style.transform = `scaleY(${Math.max(0.04, g).toFixed(3)})`;
    }
    const needle = this.el<Css>("needle");
    if (needle) {
      needle.style.animation = "none";
      needle.style.transform = `rotate(${(-50 + 100 * g).toFixed(1)}deg)`;
    }
    const pointer = this.el<Css>("thermo-pointer");
    const b = this.measureBands();
    if (pointer && b) {
      let y: number;
      if (g <= G_FAMINE_TOP) y = b.bottom + (b.normalBottom - b.bottom) * (g / G_FAMINE_TOP);
      else if (g <= G_FRENZY_BOTTOM) y = b.normalBottom + (b.normalTop - b.normalBottom) * ((g - G_FAMINE_TOP) / (G_FRENZY_BOTTOM - G_FAMINE_TOP));
      else y = b.normalTop + (b.top - b.normalTop) * ((g - G_FRENZY_BOTTOM) / (1 - G_FRENZY_BOTTOM));
      pointer.style.animation = "none";
      pointer.style.transform = `translateY(${(y - b.pointerY).toFixed(2)}px)`;
    }
    this.root.dataset.zone = zone;
    for (const z of ["frenzy", "normal", "famine"] as const) {
      const band = this.el<Css>(`zone-${z}`);
      if (band) band.style.opacity = z === zone ? "1" : "0.4";
    }
    if (this.tint) this.tint.dataset.zone = zone;
  }

  private snack() {
    this.flag("w-snacked", 2600);
  }

  private merge() {
    const a = this.el<SVGGraphicsElement & ElementCSSInlineStyle>("cell-merge-a");
    const b = this.el<SVGGraphicsElement & ElementCSSInlineStyle>("cell-merge-b");
    this.flag("w-merged", 2800);
    if (!a || !b) return;
    try {
      const ab = a.getBBox();
      const bb = b.getBBox();
      const dx = (bb.x + bb.width / 2 - (ab.x + ab.width / 2)) * 0.42;
      const dy = (bb.y + bb.height / 2 - (ab.y + ab.height / 2)) * 0.42;
      for (const [el, k] of [
        [a, 1],
        [b, -1],
      ] as const) {
        el.style.animation = "none";
        el.style.transition = "transform 900ms cubic-bezier(.34,1.4,.64,1)";
        el.style.transform = `translate(${(dx * k).toFixed(2)}px, ${(dy * k).toFixed(2)}px) scale(1.08)`;
      }
      this.later("merge-back", 2800, () => {
        for (const el of [a, b]) {
          el.style.transform = "";
          this.later("merge-anim", 900, () => {
            a.style.animation = "";
            b.style.animation = "";
            a.style.transition = "";
            b.style.transition = "";
          });
        }
      });
    } catch {
      /* not rendered */
    }
  }

  /** Stomach level 0..1: the marigold contents of the cell scale from the bottom of the stomach. */
  setFullness(v: number) {
    const s = this.el<Css>("ch-cell-stomach");
    if (s) s.style.scale = `1 ${(0.3 + 0.7 * Math.max(0, Math.min(1, v))).toFixed(3)}`;
  }

  /** Plan capsule sliding into the enclave while the button is held (k 0..1; 0 = idle loop). */
  setCapsule(k: number) {
    const cap = this.el<Css>("capsule");
    if (!cap || this.root.classList.contains("w-sealed")) return;
    if (k <= 0) {
      cap.style.animation = "";
      cap.style.opacity = "";
      cap.style.transform = "";
      return;
    }
    const t = 1 - k;
    cap.style.animation = "none";
    cap.style.opacity = Math.min(1, k * 1.6).toFixed(3);
    cap.style.transform = `translate(${(109.5 * t).toFixed(2)}px, ${(-22.1 * t).toFixed(2)}px)`;
  }

  /**
   * Finale: instead of swinging the door to a paper-thin angle, the glass fades away and the light
   * inside spills out (door-spill + an outward light cone added to this copy only).
   */
  setGlow(on: boolean) {
    const door = this.el<Css>("door");
    if (door) {
      door.style.setProperty("--door", "0deg");
      door.style.transition = "opacity 1.4s ease, translate 1.4s cubic-bezier(.16,1,.3,1)";
      door.style.opacity = on ? "0.08" : "";
      door.style.translate = on ? "-14px 6px" : "";
    }
    const spill = this.el<Css>("door-spill");
    if (spill) spill.style.opacity = on ? "1" : "";
    this.root.classList.toggle("w-glow", on);
    if (on) this.installCone();
  }

  private installCone() {
    const host = this.el("ch-door");
    if (!host || host.parentNode?.querySelector(".ln-cone")) return;
    const ns = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(ns, "defs");
    const grad = document.createElementNS(ns, "linearGradient");
    const gid = `${this.prefix}ln-cone-g`;
    grad.setAttribute("id", gid);
    grad.setAttribute("x1", "0.55");
    grad.setAttribute("y1", "0");
    grad.setAttribute("x2", "0.45");
    grad.setAttribute("y2", "1");
    for (const [off, op] of [
      ["0", "0"],
      ["0.18", "0.34"],
      ["0.7", "0.2"],
      ["1", "0.04"],
    ] as const) {
      const st = document.createElementNS(ns, "stop");
      st.setAttribute("offset", off);
      st.setAttribute("stop-color", "#f8aa06");
      st.setAttribute("stop-opacity", op);
      grad.appendChild(st);
    }
    defs.appendChild(grad);
    // From the window opening (front face) out over the base plate, toward the viewer.
    const cone = document.createElementNS(ns, "path");
    cone.setAttribute("class", "ln-cone");
    // Window bottom edge (≈467,612 → 947,516) down to the spill patch on the base plate.
    cone.setAttribute("d", "M467 560L947 462L992 772L976 800L540 892L462 870Z");
    cone.setAttribute("fill", `url(#${gid})`);
    host.parentNode?.insertBefore(defs, host);
    host.parentNode?.insertBefore(cone, host.nextSibling);
  }

  private seal(on: boolean) {
    const cap = this.el<Css>("capsule");
    const stamp = this.el<Css>("stamp");
    if (on) {
      this.root.classList.add("w-sealed");
      if (cap) {
        cap.style.animation = "none";
        cap.style.opacity = "1";
        cap.style.transform = "translate(0px, 0px)";
      }
      if (stamp) {
        stamp.style.animation = "none";
        stamp.style.opacity = "1";
      }
    } else {
      this.root.classList.remove("w-sealed");
      for (const el of [cap, stamp]) {
        if (!el) continue;
        el.style.animation = "";
        el.style.opacity = "";
        el.style.transform = "";
      }
    }
  }

  apply(e: WorldEvent) {
    switch (e.type) {
      case "feed":
        this.flag("w-fed", 1400);
        break;
      case "full":
        this.setFullness(e.v);
        break;
      case "capsule":
        this.setCapsule(e.k);
        break;
      case "atp": {
        // A production stage spends one ATP coin (coin 0..2 lifts off, pops and grows back).
        const spend = e.stage == null ? null : `w-spend-${Math.max(0, Math.min(2, e.stage))}`;
        this.root.classList.remove("w-atp", "w-spend-0", "w-spend-1", "w-spend-2");
        void this.root.getBoundingClientRect(); // restart the pulse on repeated clicks
        this.flag("w-atp", 1300);
        if (spend) this.flag(spend, 1300);
        break;
      }
      case "snack":
        this.snack();
        break;
      case "merge":
        this.merge();
        break;
      case "seal":
        this.seal(e.on);
        break;
      case "stage":
        this.root.dataset.stage = e.index === null ? "" : String(e.index);
        break;
      case "thermo":
        this.setThermo(e.g, e.zone);
        break;
      case "door":
        this.setDoor(e.state);
        break;
      case "reset":
        this.root.classList.remove("w-fed", "w-snacked", "w-merged");
        break;
    }
  }

  /** Centre of an element in figure (viewBox) units, relative to `#cam`. */
  worldPoint(id: string): [number, number] | null {
    const el = this.el<SVGGraphicsElement>(id);
    if (!el || typeof el.getBBox !== "function") return null;
    try {
      const b = el.getBBox();
      const m = el.getCTM();
      const cam = this.el<SVGGraphicsElement>("cam")?.getCTM();
      if (!m || !cam) return [b.x + b.width / 2, b.y + b.height / 2];
      const pt = this.root.createSVGPoint();
      pt.x = b.x + b.width / 2;
      pt.y = b.y + b.height / 2;
      const p = pt.matrixTransform(cam.inverse().multiply(m));
      return [p.x, p.y];
    } catch {
      return null;
    }
  }
}
