/**
 * Colony plate static geometry (iso kit, original drawing). Pure path builders:
 * the ColonyPlate component turns these into <Solid>/<Line>/<Dots>/<FaceText>.
 *
 * World: x, y on the plate, z up. The plate is a cream incubator tray with a tan
 * base edge: a culture dish in a seat ring with hold-down clips, a controller box
 * with vents and cable runs, a glass thermometer (marigold liquid) and a dial gauge,
 * a sample-vial rack, a pipette on cradles, a glass lid set aside, an engraved label
 * plate, a ruler strip, corner screws, and (dynamic) a magnifier on an articulated arm.
 */
import {
  boxCorners,
  corners,
  cylinder,
  fitProjection,
  insetPlan,
  iso,
  knurl,
  lineOnTop,
  onTop,
  planOutline,
  pointsAt,
  radialTicks,
  ring,
  ringOf,
  ringSeam,
  segment,
  sideArc,
  slabOf,
  topMatrix,
  topTicks,
  type Flat,
  type Plan,
  type Point3,
  type Projection,
  type SolidPaths,
} from "./iso-kit.ts";
import { DISH_CX, DISH_CY, DISH_R, DISH_Z, hashRand } from "./layout.ts";
import { TAU, arcAt, ellipsoidOf, loopAt, polyPath } from "./organic.ts";

export type PlateView = "wide" | "tall";
export const VIEWS: Record<PlateView, { w: number; h: number }> = {
  wide: { w: 880, h: 600 },
  tall: { w: 390, h: 470 },
};
export const VIEW_W = VIEWS.wide.w;
export const VIEW_H = VIEWS.wide.h;

export const BASE_PLAN: Plan = { x: -98, y: -72, w: 196, d: 144, r: 12 };
export const BASE_Z = 0;
export const BASE_H = 4;
export const SEAT_R = DISH_R + 4.5;
export const SEAT_H = 2.2;
export const WALL_Z0 = BASE_H + SEAT_H;
export const RIM_Z = DISH_Z + 1.8;
export const RIM_W = 3.4;
export const LID = { x: 68, y: -40, r: 22, z0: BASE_H + 1.6 };
export const DIAL = { x: -82, y: -44 };
export const TUBE = { x: -62, y: -58 };
export const BOX: Plan = { x: -40, y: -66, w: 28, d: 10, r: 1.5 };
export const BOX_H = 9;
export const LABEL_PLAN: Plan = { x: -4, y: 60, w: 56, d: 8, r: 1.2 };
export const RULER_PLAN: Plan = { x: -92, y: 60, w: 58, d: 6, r: 1 };
export const RACK_PLAN: Plan = { x: 74, y: -6, w: 14, d: 44, r: 1.5 };
export const SPARE = { x: -74, y: 30 };
export const BEAKER = { x: -78, y: -8 };
export const ARM_POST = { x: 30, y: -60 };
export const ARM_SHOULDER_Z = BASE_H + 26;
export const ARM_LINK = 58;
export const ARM_PARK = { x: 40, y: -30, z: BASE_H + 11, rho: 8 };

export function plateProjection(view: PlateView = "wide"): Projection {
  if (view === "tall") {
    const pts: Point3[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      pts.push([DISH_CX + Math.cos(a) * (DISH_R + 3), DISH_CY + Math.sin(a) * (DISH_R + 3), DISH_Z]);
    }
    return fitProjection(pts, VIEWS.tall.w, VIEWS.tall.h, { pad: 12, headroom: 8, azimuth: 45, elevation: 50 });
  }
  const pts: Point3[] = [
    ...boxCorners(BASE_PLAN, -2, BASE_H),
    [ARM_POST.x, ARM_POST.y, ARM_SHOULDER_Z + 30],
    [TUBE.x, TUBE.y, BASE_H + 34],
    [DIAL.x, DIAL.y, 24],
  ];
  return fitProjection(pts, VIEWS.wide.w, VIEWS.wide.h, { pad: 22, headroom: 6, azimuth: 45, elevation: 30 });
}

type Cyl = SolidPaths;
const cyl = (x: number, y: number, r: number, z: number, h: number, P: Projection, steps = 24, bevel = 0.3): Cyl =>
  cylinder(x, y, r, z, h, P, steps, bevel);

export interface ClipGeometry {
  body: Cyl;
  screw: Cyl;
  knurl: string;
  slot: string;
}
export interface VialGeometry {
  depth: number;
  glass: Cyl;
  liquid: Cyl;
  cap: Cyl;
  capKnurl: string;
  tint: "mari" | "cyto" | "ice";
}
export interface CableGeometry {
  d: string;
  tone: "ink" | "mari";
  plugs: SolidPaths[];
}

export interface PlateGeometry {
  shadow: string;
  shadowShift: Flat;
  base: SolidPaths;
  feet: SolidPaths[];
  groove: string;
  screws: { rings: string[]; slots: string[]; dots: Flat[] };
  seat: Cyl;
  seatRim: string;
  clips: ClipGeometry[];
  dish: Cyl;
  rimRing: string;
  rimWell: string;
  rimSeam: string;
  rimTicks: { minor: string; major: string };
  dishGlint: string;
  agar: string;
  agarFar: string;
  agarDots: Array<[number, number, number]>;
  agarRipples: Array<[string, number]>;
  guideRing: string;
  condensation: Flat[];
  lid: { pads: Cyl[]; body: Cyl; knob: Cyl; knobKnurl: string; edge: string; streaks: string[]; spark: Flat };
  label: SolidPaths;
  labelStripe: string;
  labelRules: string[];
  labelMatrix: string;
  labelMatrix2: string;
  ruler: SolidPaths;
  rulerEdge: string;
  rulerTicks: { minor: string; major: string };
  box: SolidPaths;
  boxVents: string[];
  boxLed: Cyl;
  boxMatrix: string;
  cables: CableGeometry[];
  jack: { body: SolidPaths; ring: string };
  dialPost: Cyl;
  dialFoot: Cyl;
  dialBody: Cyl;
  dialBezel: string;
  dialBezelInner: string;
  dialTicks: { minor: string; major: string };
  dialBands: Array<{ d: string; tone: "cool" | "mari" | "warm" }>;
  needleMatrix: string;
  needleHub: Flat;
  needlePath: string;
  tube: {
    block: SolidPaths;
    plate: SolidPaths;
    ticks: { minor: string; major: string };
    clamps: Cyl[];
    bulb: SolidPaths;
    glass: Cyl;
    liquid: Cyl;
    glassTop: string;
    shine: string;
  };
  rack: SolidPaths;
  rackHoles: string[];
  vials: VialGeometry[];
  pipette: { cradles: SolidPaths[]; body: SolidPaths; bulb: SolidPaths; tip: SolidPaths; ticks: string };
  stack: { layers: Cyl[]; sticker: Cyl; seams: string[] };
  beaker: { glass: Cyl; liquid: Cyl; ticks: string; rim: string };
}

export function plateGeometry(_zone: string, P: Projection, tempRatio: number | null = null): PlateGeometry {
  const base = slabOf(BASE_PLAN, BASE_Z, BASE_H, P, 10, 0.7);
  const k = P.scale * Math.sqrt(1.6);
  const shadowShift: Flat = [-3.1 * k, 5.2 * k];
  const feet = corners(BASE_PLAN, 7).map(([fx, fy]) => cyl(fx, fy, 3.2, -2.4, 2.4, P, 20, 0.2));
  const groove = planOutline(insetPlan(BASE_PLAN, 3.5), BASE_H, P, 10);

  const screwPts = [...corners(BASE_PLAN, 8.5), [0, BASE_PLAN.y + 6] as [number, number], [0, BASE_PLAN.y + BASE_PLAN.d - 6] as [number, number]];
  const rings = screwPts.map(([sx, sy]) => ring(sx, sy, 1.8, BASE_H, P, 16));
  const slots = screwPts.flatMap(([sx, sy]) => [
    lineOnTop([sx - 1.1, sy - 0.2], [sx + 1.1, sy + 0.2], BASE_H, P),
    lineOnTop([sx + 0.2, sy - 1.1], [sx - 0.2, sy + 1.1], BASE_H, P),
  ]);
  const dots = pointsAt(screwPts.map(([sx, sy]) => [sx, sy, BASE_H + 0.01] as Point3), P);

  // --- dish: seat ring, clips, wall, rim, well, agar --------------------------------
  const seat = cyl(DISH_CX, DISH_CY, SEAT_R, BASE_H, SEAT_H, P, 56, 0.4);
  const seatRim = ring(DISH_CX, DISH_CY, SEAT_R - 0.9, WALL_Z0, P, 56);
  const clips: ClipGeometry[] = [160, 300, 20].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const cx = DISH_CX + Math.cos(a) * (SEAT_R + 1.6);
    const cy = DISH_CY + Math.sin(a) * (SEAT_R + 1.6);
    return {
      body: cyl(cx, cy, 3, BASE_H, 3.4, P, 20, 0.35),
      screw: cyl(cx, cy, 1.5, BASE_H + 3.4, 1.8, P, 16, 0.25),
      knurl: knurl(cx, cy, 1.5, BASE_H + 3.4, BASE_H + 5.2, 8, P),
      slot: lineOnTop([cx - 1.1, cy], [cx + 1.1, cy], BASE_H + 5.2, P),
    };
  });
  const dish = cyl(DISH_CX, DISH_CY, DISH_R, WALL_Z0, RIM_Z - WALL_Z0, P, 56, 0.6);
  const rimRing = ring(DISH_CX, DISH_CY, DISH_R - 0.5, RIM_Z, P, 56);
  const rimWell = ring(DISH_CX, DISH_CY, DISH_R - RIM_W, RIM_Z, P, 56);
  const rimSeam = ringSeam(
    Array.from({ length: 56 }, (_, i) => {
      const a = (i / 56) * TAU;
      return [DISH_CX + DISH_R * Math.cos(a), DISH_CY + DISH_R * Math.sin(a)] as [number, number];
    }),
    RIM_Z - 1.5,
    P,
  );
  const rimTicks = radialTicks(DISH_CX, DISH_CY, DISH_R - 0.6, 72, 6, RIM_Z, [1.3, 2.3], P);
  const dishGlint = sideArc(DISH_CX, DISH_CY, DISH_R, RIM_Z - 0.8, P, 24);

  const wellR = DISH_R - RIM_W;
  const agar = loopAt(DISH_CX, DISH_CY, DISH_Z, () => wellR, P, 56);
  const agarFar = loopAt(DISH_CX, DISH_CY, DISH_Z, () => wellR * 0.93, P, 56);
  const agarDots: Array<[number, number, number]> = [];
  for (let i = 0; i < 90; i++) {
    const a = hashRand(i, 301) * TAU;
    const d = Math.sqrt(hashRand(i, 302)) * (wellR - 4);
    const fade = Math.max(0, 1 - (d / wellR) ** 3);
    const [sx, sy] = iso([DISH_CX + Math.cos(a) * d, DISH_CY + Math.sin(a) * d, DISH_Z + 0.02], P);
    if (fade > 0.12) agarDots.push([sx, sy, Math.min(1, fade * 0.9)]);
  }
  const agarRipples: Array<[string, number]> = [];
  for (const [rr, alpha] of [[wellR * 0.58, 0.5], [wellR * 0.8, 0.28]] as const) {
    const segs = 14;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * TAU + 0.12;
      const a1 = ((s + 0.62) / segs) * TAU + 0.12;
      agarRipples.push([arcAt(DISH_CX, DISH_CY, DISH_Z + 0.02, rr, a0, a1, P, 5), alpha * (0.6 + 0.4 * Math.sin(s * 1.7))]);
    }
  }
  const guideRing = ring(DISH_CX, DISH_CY, wellR * 0.9, DISH_Z + 0.03, P, 48);
  const condensation: Flat[] = [];
  for (let i = 0; i < 11; i++) {
    const a = Math.PI + 0.25 + (i / 10) * (Math.PI - 0.5); // back half of the well wall
    const rr = wellR - 0.5 - (i % 3) * 0.6;
    condensation.push(...pointsAt([[DISH_CX + Math.cos(a) * rr, DISH_CY + Math.sin(a) * rr, DISH_Z + 0.5 + (i % 2) * 0.5]], P));
  }

  // --- glass lid set aside on three pads ------------------------------------------------
  const lidPads = [0, 1, 2].map((i) => {
    const a = (i / 3) * TAU + 0.5;
    return cyl(LID.x + Math.cos(a) * 14, LID.y + Math.sin(a) * 14, 2.1, BASE_H, 1.6, P, 14, 0.2);
  });
  const lidBody = cylinder(LID.x, LID.y, LID.r, LID.z0, 2, P, 44, 0);
  const lidEdge = ring(LID.x, LID.y, LID.r - 1.6, LID.z0 + 2, P, 44);
  const lidStreaks = [
    arcAt(LID.x, LID.y, LID.z0 + 2.02, LID.r * 0.72, Math.PI * 1.05, Math.PI * 1.45, P, 8),
    arcAt(LID.x, LID.y, LID.z0 + 2.02, LID.r * 0.58, Math.PI * 1.1, Math.PI * 1.34, P, 6),
    arcAt(LID.x, LID.y, LID.z0 + 2.02, LID.r * 0.86, Math.PI * 0.12, Math.PI * 0.3, P, 6),
  ];
  const knob = cyl(LID.x, LID.y, 4.4, LID.z0 + 2, 2.4, P, 24, 0.4);
  const knobKnurl = knurl(LID.x, LID.y, 4.4, LID.z0 + 2, LID.z0 + 4.4, 14, P);
  const lidSpark = iso([LID.x - 9, LID.y - 9, LID.z0 + 2.02], P);

  // --- label plate with marigold stripe, rule lines, ruler strip ------------------------------
  const label = slabOf(LABEL_PLAN, BASE_H, 1.2, P, 4, 0.4);
  const labelTop = BASE_H + 1.2;
  const labelStripe = onTop(
    ringOf({ x: LABEL_PLAN.x + 1.2, y: LABEL_PLAN.y + 1, w: 3.2, d: LABEL_PLAN.d - 2, r: 0 }, 2),
    labelTop + 0.01,
    P,
    true,
  );
  const labelRules = [LABEL_PLAN.y + 6.9].map((yy) => lineOnTop([LABEL_PLAN.x + 6, yy], [LABEL_PLAN.x + LABEL_PLAN.w - 3, yy], labelTop, P));
  const labelMatrix = topMatrix([LABEL_PLAN.x + 6, LABEL_PLAN.y + 3], labelTop, P);
  const labelMatrix2 = topMatrix([LABEL_PLAN.x + 6, LABEL_PLAN.y + 6.2], labelTop, P);

  const ruler = slabOf(RULER_PLAN, BASE_H, 1, P, 4, 0.3);
  const rulerEdge = lineOnTop([RULER_PLAN.x + 1.5, RULER_PLAN.y + 1], [RULER_PLAN.x + RULER_PLAN.w - 1.5, RULER_PLAN.y + 1], BASE_H + 1, P);
  const rulerTicks = topTicks(RULER_PLAN.x + 3, RULER_PLAN.x + RULER_PLAN.w - 3, 3, 5, RULER_PLAN.y + 1, BASE_H + 1, [1.8, 3], P);

  // --- controller box, cables, power jack --------------------------------------------------------
  const box = slabOf(BOX, BASE_H, BOX_H, P, 6, 0.6);
  const boxTop = BASE_H + BOX_H;
  const boxVents = [0, 1, 2, 3, 4].map((i) =>
    onTop(ringOf({ x: BOX.x + 4 + i * 2.1, y: BOX.y + 2.2, w: 1.1, d: 5.6, r: 0.5 }, 3), boxTop, P, true),
  );
  const boxLed = cyl(BOX.x + BOX.w - 4.5, BOX.y + BOX.d / 2, 1.3, boxTop, 0.8, P, 14, 0.2);
  const boxMatrix = topMatrix([BOX.x + 15.4, BOX.y + 8.6], boxTop, P);

  const zc = BASE_H + 0.45;
  const route = (pts: Array<[number, number]>) => pathThrough(pts.map(([x, y]) => iso([x, y, zc], P)));
  const plug = (x: number, y: number, w: number, d: number, h = 2.6): SolidPaths => slabOf({ x, y, w, d, r: 0.5 }, BASE_H, h, P, 3, 0.2);
  const cables: CableGeometry[] = [
    {
      d: route([[DIAL.x + 3.4, DIAL.y + 1], [-86, -40], [-86, -50], [-30, -50], [-30, BOX.y + BOX.d + 2.4]]),
      tone: "ink",
      plugs: [plug(DIAL.x + 3.2, DIAL.y - 1.4, 3.4, 4.8), plug(-32.4, BOX.y + BOX.d, 4.8, 3)],
    },
    {
      d: route([[-55 + 0.4, -61], [BOX.x - 2.4, -61]]),
      tone: "mari",
      plugs: [plug(-55, -63.4, 3, 4.8), plug(BOX.x - 3.4, -63.4, 3.4, 4.8)],
    },
    {
      d: route([[BOX.x + BOX.w + 2.4, -61], [-2, -61], [-2, -68]]),
      tone: "ink",
      plugs: [plug(BOX.x + BOX.w, -63.4, 3, 4.8)],
    },
  ];
  const jackBody = slabOf({ x: -5.4, y: -70, w: 6.8, d: 4.2, r: 0.8 }, BASE_H, 3.2, P, 4, 0.3);
  const jack = { body: jackBody, ring: ring(-2, -68, 1.3, BASE_H + 3.2, P, 14) };

  // --- dial gauge on a post ----------------------------------------------------------------------
  const dialFoot = cyl(DIAL.x, DIAL.y, 4.4, BASE_H, 1.4, P, 24, 0.3);
  const dialPost = cyl(DIAL.x, DIAL.y, 2.2, BASE_H + 1.4, 12, P, 16, 0.2);
  const dialZ0 = BASE_H + 13.4;
  const dialBody = cyl(DIAL.x, DIAL.y, 8.5, dialZ0, 3, P, 32, 0.5);
  const faceZ = dialZ0 + 3;
  const dialBezel = ring(DIAL.x, DIAL.y, 8.4, faceZ, P, 32);
  const dialBezelInner = ring(DIAL.x, DIAL.y, 7.9, faceZ, P, 32);
  const span = (210 * Math.PI) / 180;
  const dialTicks = radialTicks(DIAL.x, DIAL.y, 7.4, 28, 4, faceZ, [1.2, 2.1], P, -span / 2, span);
  const zoneAngle = (mk: number) => -span / 2 + (mk / 1220) * span;
  const band = (a0: number, a1: number) => arcAt(DIAL.x, DIAL.y, faceZ, 5.2, a0 - Math.PI / 2, a1 - Math.PI / 2, P, 12);
  // arcAt uses plan angle with 0 = +x; radial angle 0 is "up" (-y), so shift by -90deg.
  const dialBands: PlateGeometry["dialBands"] = [
    { d: band(zoneAngle(0), zoneAngle(600)), tone: "cool" },
    { d: band(zoneAngle(600), zoneAngle(610)), tone: "mari" },
    { d: band(zoneAngle(610), zoneAngle(1220)), tone: "warm" },
  ];
  const needleMatrix = topMatrix([DIAL.x, DIAL.y], faceZ + 0.05, P);
  const needleHub = iso([DIAL.x, DIAL.y, faceZ + 0.05], P);
  const needlePath = "M0 1.4L0 -6.6";

  // --- glass thermometer with a marigold liquid column --------------------------------------------
  const tubeBlockPlan: Plan = { x: TUBE.x - 7, y: -66, w: 14, d: 10, r: 1.2 };
  const tubeBlock = slabOf(tubeBlockPlan, BASE_H, 2.2, P, 4, 0.3);
  const tz0 = BASE_H + 2.2;
  const tubePlate = slabOf({ x: TUBE.x - 6, y: TUBE.y - 5.4, w: 12, d: 1.4, r: 0.3 }, tz0, 33, P, 2, 0.2);
  const tickFace = TUBE.y - 4;
  const minor: string[] = [];
  const major: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const zz = tz0 + 6 + i * 3.1;
    const long = i % 4 === 0;
    const len = long ? 3.2 : 2;
    (long ? major : minor).push(segment([TUBE.x - 6, tickFace, zz], [TUBE.x - 6 + len, tickFace, zz], P));
    (long ? major : minor).push(segment([TUBE.x + 6, tickFace, zz], [TUBE.x + 6 - len, tickFace, zz], P));
  }
  const tubeClamps = [tz0 + 9, tz0 + 24].map((zz) => cyl(TUBE.x, TUBE.y, 2.9, zz, 1.3, P, 18, 0.2));
  const bulb = ellipsoidOf([TUBE.x, TUBE.y, tz0 + 3], [3.2, 3.2, 3.2], 0, P, { steps: 32 });
  const tubeGlass = cyl(TUBE.x, TUBE.y, 2.1, tz0 + 3, 29, P, 20, 0.1);
  const level = 5 + (tempRatio ?? 0.04) * 21;
  const liquid = cyl(TUBE.x, TUBE.y, 1.05, tz0 + 3, level, P, 14, 0.1);
  const glassTop = ring(TUBE.x, TUBE.y, 1.7, tz0 + 32, P, 16);
  const shine = segment([TUBE.x - 1.2, TUBE.y + 0.2, tz0 + 8], [TUBE.x - 1.2, TUBE.y + 0.2, tz0 + 29], P);
  const tube = { block: tubeBlock, plate: tubePlate, ticks: { minor: minor.join(""), major: major.join("") }, clamps: tubeClamps, bulb, glass: tubeGlass, liquid, glassTop, shine };

  // --- sample-vial rack ---------------------------------------------------------------------------------
  const rack = slabOf(RACK_PLAN, BASE_H, 5, P, 4, 0.5);
  const rackTop = BASE_H + 5;
  const holeY = [1, 12, 23, 34];
  const rackHoles = holeY.map((hy) => ring(RACK_PLAN.x + 7, hy, 3.4, rackTop, P, 20));
  const tints: Array<VialGeometry["tint"]> = ["cyto", "mari", "ice"];
  const vials: VialGeometry[] = [1, 12, 23].map((vy, i) => {
    const vx = RACK_PLAN.x + 7;
    const fill = [9.5, 6.5, 8][i]!;
    return {
      depth: vy,
      glass: cyl(vx, vy, 3, rackTop - 2, 16, P, 20, 0.2),
      liquid: cyl(vx, vy, 2.3, rackTop - 1.2, fill, P, 16, 0.15),
      cap: cyl(vx, vy, 3.2, rackTop + 14, 2.6, P, 20, 0.4),
      capKnurl: knurl(vx, vy, 3.2, rackTop + 14, rackTop + 16.6, 10, P),
      tint: tints[i]!,
    };
  });

  // --- left side: spare dish stack and a beaker of marigold medium ------------------------------------------------
  const stackLayers = [0, 1, 2].map((i) => cyl(SPARE.x, SPARE.y, 12.5 - i * 0.3, BASE_H + i * 2.5, 2.3, P, 36, 0.35));
  const stackSticker = cyl(SPARE.x - 3, SPARE.y + 3, 2.2, BASE_H + 7.5, 0.35, P, 14, 0);
  const stackSeam = [0, 1].map((i) => ring(SPARE.x, SPARE.y, 12.2 - i * 0.3, BASE_H + (i + 1) * 2.5 + 0.02, P, 36));
  const beakerGlass = cyl(BEAKER.x, BEAKER.y, 6.6, BASE_H, 16, P, 28, 0.2);
  const beakerLiquid = cyl(BEAKER.x, BEAKER.y, 5.9, BASE_H + 0.7, 9.5, P, 24, 0.15);
  const beakerTicks: string[] = [];
  const bAng = Math.atan2(Math.sin((45 * Math.PI) / 180), Math.cos((45 * Math.PI) / 180));
  for (let i = 0; i < 5; i++) {
    const zz = BASE_H + 3.2 + i * 2.6;
    const a0 = bAng - 0.5;
    const a1 = bAng - (i % 2 === 0 ? 0.05 : 0.22);
    beakerTicks.push(arcAt(BEAKER.x, BEAKER.y, zz, 6.6, a0, a1, P, 3));
  }
  const beakerRim = ring(BEAKER.x, BEAKER.y, 6.1, BASE_H + 16, P, 28);

  // --- pipette on two cradles -------------------------------------------------------------------------------
  const pz = BASE_H + 3 + 2.3;
  const px = 56;
  const cradles = [13, 38].map((cy) => slabOf({ x: px - 3.5, y: cy - 1.8, w: 7, d: 3.6, r: 0.6 }, BASE_H, 3, P, 3, 0.3));
  const body = ellipsoidOf([px, 26, pz], [18.5, 2.3, 2.3], Math.PI / 2, P, { steps: 44 });
  const pipBulb = ellipsoidOf([px, 4.4, pz], [6.4, 3.6, 3.6], Math.PI / 2, P, { steps: 36 });
  const tip = ellipsoidOf([px, 49, pz], [6.2, 0.95, 0.95], Math.PI / 2, P, { steps: 20 });
  const tickLines: string[] = [];
  for (let i = 0; i < 7; i++) {
    const yy = 12 + i * 3.4;
    tickLines.push(segment([px - 1.9, yy, pz + 1.3], [px - 0.5, yy, pz + 2.2], P));
  }

  return {
    shadow: base.fill,
    shadowShift,
    base,
    feet,
    groove,
    screws: { rings, slots, dots },
    seat,
    seatRim,
    clips,
    dish,
    rimRing,
    rimWell,
    rimSeam,
    rimTicks,
    dishGlint,
    agar,
    agarFar,
    agarDots,
    agarRipples,
    guideRing,
    condensation,
    lid: { pads: lidPads, body: lidBody, knob, knobKnurl, edge: lidEdge, streaks: lidStreaks, spark: lidSpark },
    label,
    labelStripe,
    labelRules,
    labelMatrix,
    labelMatrix2,
    ruler,
    rulerEdge,
    rulerTicks,
    box,
    boxVents,
    boxLed,
    boxMatrix,
    cables,
    jack,
    dialPost,
    dialFoot,
    dialBody,
    dialBezel,
    dialBezelInner,
    dialTicks,
    dialBands,
    needleMatrix,
    needleHub,
    needlePath,
    tube,
    rack,
    rackHoles,
    vials,
    pipette: { cradles, body, bulb: pipBulb, tip, ticks: tickLines.join("") },
    stack: { layers: stackLayers, sticker: stackSticker, seams: stackSeam },
    beaker: { glass: beakerGlass, liquid: beakerLiquid, ticks: beakerTicks.join(""), rim: beakerRim },
  };
}

function pathThrough(points: Flat[]): string {
  return polyPath(points);
}

// ---------------------------------------------------------------------------------------------
// Magnifier on an articulated arm (dynamic: follows the selected cell)
// ---------------------------------------------------------------------------------------------

export interface MagnifierGeometry {
  base: SolidPaths;
  post: Cyl;
  links: string[];
  joints: Flat[];
  yoke: string;
  rim: string;
  glass: string;
  streaks: string[];
  shoulderBall: SolidPaths;
}

export function magnifierGeometry(target: { x: number; y: number; z: number; rho: number } | null, P: Projection): MagnifierGeometry {
  const t = target ?? ARM_PARK;
  const S: Point3 = [ARM_POST.x, ARM_POST.y, ARM_SHOULDER_Z];
  const rho = t.rho;
  const W: Point3 = [t.x, t.y, t.z + 11]; // wrist, a short yoke above the lens
  const dx = W[0] - S[0];
  const dy = W[1] - S[1];
  const dz = W[2] - S[2];
  const d = Math.hypot(dx, dy) || 0.001;
  // link length follows the reach so the elbow rises a calm 35–40° above the line
  const link = Math.max(ARM_LINK * 0.6, Math.hypot(d, dz) * 0.64);
  const D = Math.min(Math.hypot(d, dz), link * 2 - 1);
  const lift = Math.atan2(dz, d) + Math.acos(Math.min(1, D / (2 * link)));
  const ux = dx / d;
  const uy = dy / d;
  const E: Point3 = [S[0] + ux * Math.cos(lift) * link, S[1] + uy * Math.cos(lift) * link, S[2] + Math.sin(lift) * link];
  // second link ends at the wrist (rescaled when the target is out of reach)
  const Wc: Point3 = D < Math.hypot(d, dz) - 1e-6 ? [S[0] + (dx * D) / Math.hypot(d, dz), S[1] + (dy * D) / Math.hypot(d, dz), S[2] + (dz * D) / Math.hypot(d, dz)] : W;
  const fS = iso(S, P);
  const fE = iso(E, P);
  const fW = iso(Wc, P);
  // yoke: two short struts from the wrist to the lens rim, either side of the arm
  const px = -uy;
  const py = ux;
  const lensC: Point3 = [Wc[0], Wc[1], Wc[2] - 11];
  const yokeA = iso([lensC[0] + px * rho, lensC[1] + py * rho, lensC[2]], P);
  const yokeB = iso([lensC[0] - px * rho, lensC[1] - py * rho, lensC[2]], P);
  const rimPath = loopAt(lensC[0], lensC[1], lensC[2], () => rho, P, 40);
  return {
    base: slabOf({ x: ARM_POST.x - 6, y: ARM_POST.y - 6, w: 12, d: 12, r: 2 }, BASE_H, 2.2, P, 4, 0.4),
    post: cyl(ARM_POST.x, ARM_POST.y, 1.9, BASE_H + 2.2, ARM_SHOULDER_Z - BASE_H - 2.2, P, 16, 0.2),
    links: [polyPath([fS, fE]), polyPath([fE, fW])],
    joints: [fS, fE, fW],
    yoke: polyPath([yokeA, fW, yokeB]),
    rim: rimPath,
    glass: loopAt(lensC[0], lensC[1], lensC[2], () => rho * 0.9, P, 40),
    streaks: [
      arcAt(lensC[0], lensC[1], lensC[2], rho * 0.66, Math.PI * 1.04, Math.PI * 1.42, P, 7),
      arcAt(lensC[0], lensC[1], lensC[2], rho * 0.5, Math.PI * 1.08, Math.PI * 1.3, P, 5),
    ],
    shoulderBall: ellipsoidOf(S, [3.3, 3.3, 3.3], 0, P, { steps: 28 }),
  };
}

export function zoneLabel(zone: string): string {
  return `COLONY PLATE · zone ${zone}`;
}

