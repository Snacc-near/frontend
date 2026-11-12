import { describe, expect, it } from "vitest";
import {
  aheadCam,
  camAtScroll,
  camTransform,
  fitAnchor,
  focusAt,
  lerpCam,
  project,
  relCam,
  relCovers,
  relTransform,
  scaleKey,
  zoomAbout,
  type Cam,
} from "../src/landing/lib/camera.ts";
import { cropUrl, innerSvg, prefixIds } from "../src/landing/lib/figure.ts";
import {
  OFFICIAL,
  countAlive,
  formatToken,
  gaugeToTemp,
  latestEvent,
  safeNftMediaSrc,
  shortHash,
  tempToGauge,
  zoneFromApi,
  zoneFromTemp,
} from "../src/landing/lib/live.ts";
import { EVIDENCE_TXS, TEE_TX, explorerTx, toNftCard } from "../src/landing/lib/chain.ts";

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe("camera", () => {
  const frame = { x: 0, y: 0, w: 1000, h: 500 };

  it("fits an anchor inside the frame and centres it", () => {
    const c = fitAnchor({ x: 100, y: 100, w: 200, h: 100 }, frame, 1);
    expect(c.s).toBe(5); // min(1000/200, 500/100)
    expect([c.cx, c.cy, c.ox, c.oy]).toEqual([200, 150, 500, 250]);
    const [sx, sy] = project(c, 100, 100);
    expect(close(sx, 0) && close(sy, 0)).toBe(true);
  });

  it("interpolates zoom in log space and lands exactly on both ends", () => {
    const a: Cam = { s: 1, cx: 0, cy: 0, ox: 0, oy: 0 };
    const b: Cam = { s: 16, cx: 100, cy: 50, ox: 10, oy: 20 };
    expect(lerpCam(a, b, 0)).toEqual(a);
    const end = lerpCam(a, b, 1);
    expect(close(end.s, 16) && close(end.cx, 100) && close(end.cy, 50)).toBe(true);
    expect(close(lerpCam(a, b, 0.5).s, 4)).toBe(true);
  });

  it("holds each keyframe around its stop and eases between", () => {
    const cams: Cam[] = [
      { s: 1, cx: 0, cy: 0, ox: 0, oy: 0 },
      { s: 4, cx: 10, cy: 10, ox: 0, oy: 0 },
    ];
    expect(camAtScroll([0, 1000], cams, -50)).toEqual(cams[0]);
    expect(camAtScroll([0, 1000], cams, 100)).toEqual(cams[0]); // inside the hold
    expect(camAtScroll([0, 1000], cams, 950)).toEqual(cams[1]);
    expect(camAtScroll([0, 1000], cams, 5000)).toEqual(cams[1]);
    const mid = camAtScroll([0, 1000], cams, 500);
    expect(mid.s).toBeGreaterThan(1);
    expect(mid.s).toBeLessThan(4);
  });

  it("reports focus for the nearest stop, including just past the last one", () => {
    expect(focusAt([0, 1000, 2000], 1000)).toEqual({ index: 1, focus: 1 });
    expect(focusAt([0, 1000, 2000], 2001)).toEqual({ index: 2, focus: 1 });
    expect(focusAt([0, 1000, 2000], 500).focus).toBe(0);
  });

  it("zooms about a screen point without moving it", () => {
    const c: Cam = { s: 2, cx: 50, cy: 50, ox: 400, oy: 300 };
    const z = zoomAbout(c, 4, 420, 310);
    const world: [number, number] = [c.cx + (420 - c.ox) / c.s, c.cy + (310 - c.oy) / c.s];
    const [x, y] = project(z, world[0], world[1]);
    expect(close(x, 420) && close(y, 310)).toBe(true);
    expect(z.s).toBe(8);
  });

  it("writes an SVG transform", () => {
    expect(camTransform({ s: 2, cx: 10, cy: 20, ox: 300, oy: 200 })).toBe("translate(300 200) scale(2) translate(-10 -20)");
  });

  it("maps zoom to the scale key labels", () => {
    const levels = [1, 3, 4.5, 10, 25];
    expect(scaleKey(1, levels).label).toBe("1 cm");
    expect(scaleKey(10, levels).label).toBe("10 µm");
    expect(scaleKey(30, levels).label).toBe("1 µm");
  });

  it("splits a camera into a painted base and a composited remainder", () => {
    const base: Cam = { s: 3, cx: 120, cy: 80, ox: 700, oy: 450 };
    const cur: Cam = { s: 2.4, cx: 140, cy: 70, ox: 720, oy: 430 };
    const rel = relCam(base, cur);
    // a world point painted under `base`, moved by `rel`, lands where `cur` shows it
    for (const [wx, wy] of [
      [100, 60],
      [140, 70],
      [300, 10],
    ] as const) {
      const [bx, by] = project(base, wx, wy);
      const [cx, cy] = project(cur, wx, wy);
      expect(close(rel.tx + rel.r * bx, cx) && close(rel.ty + rel.r * by, cy)).toBe(true);
    }
    expect(relCam(cur, cur)).toEqual({ r: 1, tx: 0, ty: 0 });
    expect(relTransform(relCam(cur, cur))).toBe("");
    expect(relTransform({ r: 0.8, tx: 12.3456, ty: -4 })).toBe("translate3d(12.35px, -4px, 0) scale(0.8)");
  });

  it("paints ahead of a zoom-in and knows when the painted margin runs out", () => {
    const cur: Cam = { s: 2, cx: 100, cy: 100, ox: 500, oy: 300 };
    const ahead = aheadCam(cur, 1 / 0.75);
    const rel = relCam(ahead, cur);
    expect(close(rel.r, 0.75)).toBe(true);
    // the camera's screen point stays put
    expect(close(rel.tx + rel.r * cur.ox, cur.ox) && close(rel.ty + rel.r * cur.oy, cur.oy)).toBe(true);
    expect(relCovers(rel, 1000, 600, 250, 0.75, 1)).toBe(true);
    expect(relCovers(rel, 1000, 600, 50, 0.75, 1)).toBe(false); // shrunk layer leaves the margin
    expect(relCovers({ r: 1.1, tx: 0, ty: 0 }, 1000, 600, 250, 0.75, 1)).toBe(false); // would upscale
    expect(relCovers({ r: 1, tx: 240, ty: 0 }, 1000, 600, 250, 0.75, 1)).toBe(true);
    expect(relCovers({ r: 1, tx: 260, ty: 0 }, 1000, 600, 250, 0.75, 1)).toBe(false); // panned past it
  });
});

describe("appetite zones", () => {
  it("maps CrucibleTemp to the official zones", () => {
    expect(zoneFromTemp(1037).label).toBe("Feeding Frenzy");
    expect(zoneFromTemp(611).key).toBe("frenzy");
    expect(zoneFromTemp(605).key).toBe("normal");
    expect(zoneFromTemp(599).label).toBe("Famine Relief");
    expect(zoneFromTemp(1037).rate).toContain(OFFICIAL.frenzyBurnPct);
    expect(zoneFromTemp(10).rate).toContain(OFFICIAL.famineReliefPct);
  });

  it("reads the API zone strings", () => {
    expect(zoneFromApi("Fever")?.key).toBe("frenzy");
    expect(zoneFromApi("FEVER")?.key).toBe("frenzy");
    expect(zoneFromApi("HYPO")?.key).toBe("famine");
    expect(zoneFromApi("Goldilocks")?.key).toBe("normal");
    expect(zoneFromApi("NORMAL")?.key).toBe("normal");
    expect(zoneFromApi("???")).toBeNull();
  });

  it("gauge scale is monotonic and round-trips", () => {
    let prev = -1;
    for (let t = 0; t <= 1400; t += 50) {
      const g = tempToGauge(t);
      expect(g).toBeGreaterThan(prev);
      prev = g;
      expect(Math.abs(gaugeToTemp(g) - t)).toBeLessThan(1e-6);
    }
    expect(tempToGauge(600)).toBeCloseTo(0.45);
    expect(tempToGauge(610)).toBeCloseTo(0.55);
  });
});

describe("ticker formatting", () => {
  it("formats 24-decimal token amounts without float loss", () => {
    expect(formatToken("35827892655461041439342")).toBe("0.03582");
    expect(formatToken("2214172107344538958560658")).toBe("2.2141");
    expect(formatToken("1000000000000000000000000000")).toBe("1,000");
    expect(formatToken("0")).toBe("0");
    expect(formatToken("abc")).toBe("—");
    expect(formatToken(null)).toBe("—");
  });

  it("shortens hashes", () => {
    expect(shortHash("FfekmomnSEUQ664v3Ew3auTJYv47FyK2Hyi3Q3guWNmx")).toBe("Ffek…WNmx");
    expect(shortHash(undefined)).toBe("—");
  });

  it("counts living strains and finds the newest event", () => {
    expect(countAlive([{ status: "Alive" }, { status: "SplicedBurned" }, { status: "alive" }])).toBe(2);
    expect(countAlive(null)).toBeNull();
    expect(latestEvent([{ kind: "a", block_height: 5 }, { kind: "b", block_height: 9 }, { kind: "c", block_height: 7 }])?.kind).toBe("b");
    expect(latestEvent([])).toBeNull();
  });
});

describe("on-chain NFT media", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320"/></svg>';
  const uri = `data:image/svg+xml;base64,${btoa(svg)}`;

  it("accepts base64 SVG data URIs that decode to an svg document", () => {
    expect(safeNftMediaSrc(uri)).toBe(uri);
  });

  it("rejects anything else", () => {
    expect(safeNftMediaSrc(null)).toBeNull();
    expect(safeNftMediaSrc("https://example.com/x.svg")).toBeNull();
    expect(safeNftMediaSrc(`data:image/svg+xml;base64,${btoa("<html></html>")}`)).toBeNull();
    expect(safeNftMediaSrc("data:image/svg+xml;base64,@@@")).toBeNull();
    expect(safeNftMediaSrc(`data:text/html;base64,${btoa(svg)}`)).toBeNull();
  });

  it("maps a raw token to a card", () => {
    const card = toNftCard({ token_id: "1", owner_id: "snacc-v001.testnet", metadata: { title: "Snacc Strain #1", media: uri } });
    expect(card).toMatchObject({ tokenId: "1", owner: "snacc-v001.testnet", title: "Snacc Strain #1", src: uri });
    expect(toNftCard({ token_id: "2", owner_id: "a.testnet", metadata: null }).title).toBe("Snacc #2");
  });
});

describe("figure helpers", () => {
  it("prefixes ids and local references", () => {
    const src = '<svg><defs><clipPath id="c"><rect/></clipPath></defs><g id="cam" clip-path="url(#c)"><use href="#cam"/><use xlink:href="#c"/></g></svg>';
    const out = prefixIds(src, "lz-");
    expect(out).toContain('id="lz-c"');
    expect(out).toContain('id="lz-cam"');
    expect(out).toContain("url(#lz-c)");
    expect(out).toContain('href="#lz-cam"');
    expect(out).toContain('xlink:href="#lz-c"');
    expect(out).not.toMatch(/id="c"/);
  });

  it("rewrites id selectors in the embedded stylesheet but leaves hex colours alone", () => {
    const src = '<svg><style>.inc #door{fill:#fff}.inc #needle{stroke:#f8aa06}</style><g id="door"/><g id="needle"/></svg>';
    const out = prefixIds(src, "fz-");
    expect(out).toContain(".inc #fz-door{fill:#fff}");
    expect(out).toContain(".inc #fz-needle{stroke:#f8aa06}");
  });

  it("splits the svg wrapper from its body", () => {
    expect(innerSvg('<svg viewBox="0 0 1 1"><g/></svg>')).toEqual({ attrs: ' viewBox="0 0 1 1"', body: "<g/>" });
  });

  it("builds a view-fragment crop url", () => {
    expect(cropUrl({ x: 100, y: 50, w: 200, h: 100 }, 0.1)).toBe("/figures/incubator.svg#svgView(viewBox(80,40,240,120))");
  });
});

describe("evidence transactions", () => {
  it("lists real testnet tx hashes with explorer links", () => {
    expect(EVIDENCE_TXS.length).toBeGreaterThanOrEqual(8);
    for (const t of EVIDENCE_TXS) expect(t.hash).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
    expect(new Set(EVIDENCE_TXS.map((t) => t.hash)).size).toBe(EVIDENCE_TXS.length);
    expect(explorerTx(TEE_TX.hash)).toBe(`https://testnet.nearblocks.io/txns/${TEE_TX.hash}`);
  });
});
