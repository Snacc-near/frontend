import { describe, expect, it } from "vitest";
import { camAtScroll, camDelta, easeSine, lerpCam, pathWarp, screenShift, smoothK, warpAt, type Cam } from "../src/landing/lib/camera.ts";
import { THEATRE, cardOpacity, theatreMap } from "../src/landing/story.ts";

const a: Cam = { s: 0.7, cx: 800, cy: 460, ox: 980, oy: 420 };
const b: Cam = { s: 8.4, cx: 684, cy: 442, ox: 994, oy: 450 };

describe("UI-141 camera pacing", () => {
  it("sine ease is symmetric and peaks at pi/2 times the mean speed", () => {
    expect(easeSine(0)).toBe(0);
    expect(easeSine(1)).toBe(1);
    expect(easeSine(0.5)).toBeCloseTo(0.5, 10);
    const d = 1e-4;
    expect((easeSine(0.5 + d) - easeSine(0.5 - d)) / (2 * d)).toBeCloseTo(Math.PI / 2, 4);
  });

  it("smoothing factor is frame-rate independent", () => {
    // two 8 ms steps cover the same ground as one 16 ms step
    const k16 = smoothK(16, 90);
    const k8 = smoothK(8, 90);
    expect(1 - (1 - k8) * (1 - k8)).toBeCloseTo(k16, 10);
    expect(smoothK(0, 90)).toBe(0);
    expect(smoothK(16, 0)).toBe(1);
  });

  it("arc-length warp runs from 0 to 1 and evens out the on-screen speed", () => {
    const wp = pathWarp(a, b, 1440, 900);
    expect(wp.len).toBeGreaterThan(0);
    expect(warpAt(wp, 0)).toBe(0);
    expect(warpAt(wp, 1)).toBe(1);
    for (let i = 1; i < wp.t.length; i++) expect(wp.t[i]!).toBeGreaterThanOrEqual(wp.t[i - 1]!);
    const steps = 20;
    const shifts: number[] = [];
    for (let i = 0; i < steps; i++) {
      const c0 = lerpCam(a, b, warpAt(wp, i / steps));
      const c1 = lerpCam(a, b, warpAt(wp, (i + 1) / steps));
      shifts.push(screenShift(c0, c1, 1440, 900));
    }
    const mean = shifts.reduce((s, v) => s + v, 0) / steps;
    for (const v of shifts) expect(Math.abs(v - mean) / mean).toBeLessThan(0.1);
  });

  it("camAtScroll with warps still holds both keyframes", () => {
    const cams = [a, b];
    const warps = [pathWarp(a, b, 1440, 900)];
    expect(camAtScroll([0, 1000], cams, 50, 0.08, warps)).toEqual(a);
    const end = camAtScroll([0, 1000], cams, 950, 0.08, warps);
    expect(end.s).toBeCloseTo(b.s, 6);
    expect(camDelta(end, b, 1440, 900)).toBeLessThan(1e-6);
  });

  it("camDelta is zero for the same camera and grows with a pan", () => {
    expect(camDelta(a, a, 1440, 900)).toBeLessThan(1e-9);
    expect(camDelta(a, { ...a, ox: a.ox + 10 }, 1440, 900)).toBeCloseTo(10, 6);
  });
});

describe("UI-141 scroll map", () => {
  const map = theatreMap();
  const n = THEATRE.segments.length;

  it("holds the hero frame until the hero UI has faded", () => {
    expect(map.stops[0]).toBeGreaterThanOrEqual(THEATRE.heroFade[1]);
    expect(map.stops.length).toBe(n + 1);
  });

  it("gives deep zooms more scroll than short pans", () => {
    const seg = THEATRE.segments;
    expect(seg[0]!).toBeGreaterThan(seg[4]!);
    expect(seg[3]!).toBeGreaterThan(seg[1]!);
  });

  it("always shows a card or a cross-fade once the hero UI is gone", () => {
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const heroUi = (y: number) => 1 - smooth(Math.min(1, Math.max(0, (y - THEATRE.heroFade[0]) / (THEATRE.heroFade[1] - THEATRE.heroFade[0]))));
    for (let y = 0; y <= map.total - 1; y += 0.01) {
      const ks = Array.from({ length: n }, (_, i) => cardOpacity(map, i, y));
      expect(ks.reduce((s, k) => s + k, 0) + heroUi(y)).toBeGreaterThan(0.98);
    }
  });

  it("keeps every card inside its block's sticky range while it is visible", () => {
    for (let i = 0; i < n; i++) {
      const blk = map.blocks[i + 1]!;
      const pinnedFrom = blk.top;
      const pinnedTo = blk.top + blk.len - 1;
      for (let y = 0; y <= map.total - 1; y += 0.01) {
        if (cardOpacity(map, i, y) > 0) {
          expect(y).toBeGreaterThanOrEqual(pinnedFrom - 1e-9);
          expect(y).toBeLessThanOrEqual(pinnedTo + 1e-9);
        }
      }
    }
  });

  it("puts each chapter's camera stop inside its block", () => {
    for (let i = 1; i <= n; i++) {
      const blk = map.blocks[i]!;
      expect(blk.toStop).toBeGreaterThan(0);
      expect(blk.toStop).toBeLessThan(blk.len);
    }
    expect(map.total).toBeCloseTo(map.stops[n]! + THEATRE.tail + 1, 10);
  });
});
