/**
 * Colony plate static geometry (iso kit). Pure path builders: the ColonyPlate
 * component turns these into <Solid>/<Line>/<Dots>/<FaceText> elements.
 * Parts: base plate + feet + groove, 4 corner screws, incubator dish with
 * moulded rim + glass glint + guide circle + graduation ticks + condensation,
 * lid + knob + knurling, label plate with rule lines, ruler strip with ticks,
 * thermometer post + dial + bezel + ticks + needle + hub.
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
  planOutline,
  pointsAt,
  radialTicks,
  ring,
  ringSeam,
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
import { DISH_CX, DISH_CY, DISH_R, DISH_Z } from "./layout.ts";

export const VIEW_W = 880;
export const VIEW_H = 600;

export const BASE_PLAN: Plan = { x: -86, y: -64, w: 172, d: 128, r: 14 };
export const BASE_Z = 0;
export const BASE_H = 3.5;
export const LID_CX = 40;
export const LID_CY = 26;
export const LID_R = 27;
export const THERMO: Plan = { x: -64, y: -34, w: 0, d: 0, r: 0 };
export const LABEL_PLAN: Plan = { x: 6, y: 44, w: 56, d: 16, r: 2 };
export const RULER_PLAN: Plan = { x: -80, y: 52, w: 118, d: 8, r: 1.5 };

export function plateProjection(): Projection {
  const pts: Point3[] = [
    ...boxCorners(BASE_PLAN, -2, BASE_H),
    [DISH_CX - DISH_R, DISH_CY, DISH_Z],
    [DISH_CX + DISH_R, DISH_CY, DISH_Z],
    [DISH_CX, DISH_CY - DISH_R, DISH_Z],
    [DISH_CX, DISH_CY + DISH_R, DISH_Z],
    [LID_CX - LID_R, LID_CY, BASE_H + 3.2],
    [LID_CX + LID_R, LID_CY, BASE_H + 3.2],
    [LID_CX, LID_CY - LID_R, BASE_H + 3.2],
    [LID_CX, LID_CY + LID_R, BASE_H + 3.2],
    [THERMO.x, THERMO.y, 20.5],
    [LABEL_PLAN.x, LABEL_PLAN.y + LABEL_PLAN.d, BASE_H + 1.2],
    [RULER_PLAN.x, RULER_PLAN.y + RULER_PLAN.d, BASE_H + 1],
  ];
  return fitProjection(pts, VIEW_W, VIEW_H, { pad: 28, headroom: 18, azimuth: 45, elevation: 30 });
}

export interface PlateGeometry {
  base: SolidPaths;
  feet: SolidPaths[];
  groove: string;
  screws: { rings: string[]; slots: string[]; dots: Flat[] };
  dish: SolidPaths;
  rimRing: string;
  rimSeam: string;
  guideRing: string;
  dishTicks: { minor: string; major: string };
  dishGlint: string;
  condensation: Flat[];
  lid: SolidPaths;
  lidKnob: SolidPaths;
  lidKnurl: string;
  label: SolidPaths;
  labelRules: string[];
  labelMatrix: string;
  labelMatrix2: string;
  ruler: SolidPaths;
  rulerEdge: string;
  rulerTicks: { minor: string; major: string };
  thermoPost: SolidPaths;
  thermoDial: SolidPaths;
  thermoBezel: string;
  thermoTicks: { minor: string; major: string };
  needleHub: Flat;
  needlePath: string;
}

export function plateGeometry(_zone: string, P: Projection): PlateGeometry {
  const base = slabOf(BASE_PLAN, BASE_Z, BASE_H, P, 10, 0.7);
  const feet = corners(BASE_PLAN, 6).map(([fx, fy]) => cylinder(fx, fy, 3, -2, 2, P, 20));
  const groove = planOutline(insetPlan(BASE_PLAN, 5), BASE_H, P, 10);

  const screwPts = corners(BASE_PLAN, 9);
  const rings = screwPts.map(([sx, sy]) => ring(sx, sy, 1.8, BASE_H, P, 16));
  const slots = screwPts.flatMap(([sx, sy]) => [
    lineOnTop([sx - 1.1, sy], [sx + 1.1, sy], BASE_H, P),
    lineOnTop([sx, sy - 1.1], [sx, sy + 1.1], BASE_H, P),
  ]);
  const dots = pointsAt(screwPts.map(([sx, sy]) => [sx, sy, BASE_H + 0.01] as Point3), P);

  const dish = cylinder(DISH_CX, DISH_CY, DISH_R, BASE_H, DISH_Z - BASE_H, P, 44, 0.8);
  const rimRing = ring(DISH_CX, DISH_CY, DISH_R - 0.6, DISH_Z, P, 44);
  const rimSeam = ringSeam(
    Array.from({ length: 44 }, (_, i) => {
      const a = (i / 44) * Math.PI * 2;
      return [DISH_CX + DISH_R * Math.cos(a), DISH_CY + DISH_R * Math.sin(a)] as [number, number];
    }),
    DISH_Z - 1.7,
    P,
  );
  const guideRing = ring(DISH_CX, DISH_CY, 34, DISH_Z, P, 40);
  const dishTicks = radialTicks(DISH_CX, DISH_CY, 43, 36, 4, DISH_Z, [1.8, 3.4], P);
  const dishGlint = sideArc(DISH_CX, DISH_CY, DISH_R, DISH_Z - 0.7, P, 24);
  const condensation: Flat[] = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI; // back half of the rim
    const rr = 38 + (i % 3);
    condensation.push(...pointsAt([[DISH_CX + Math.cos(a) * rr, DISH_CY + Math.sin(a) * rr * 0.92, DISH_Z + 0.15]], P));
  }

  const lid = cylinder(LID_CX, LID_CY, LID_R, BASE_H, 3.2, P, 36, 0.5);
  const lidKnob = cylinder(LID_CX, LID_CY, 6, BASE_H + 3.2, 2, P, 20);
  const lidKnurl = knurl(LID_CX, LID_CY, 6, BASE_H + 3.2, BASE_H + 5.2, 10, P);

  const label = slabOf(LABEL_PLAN, BASE_H, 1.2, P, 4, 0.4);
  const labelRules = [48, 50.5, 53].map((yy) => lineOnTop([LABEL_PLAN.x + 4, yy], [LABEL_PLAN.x + LABEL_PLAN.w - 4, yy], BASE_H + 1.2, P));
  const labelMatrix = topMatrix([LABEL_PLAN.x + 4, LABEL_PLAN.y + 2], BASE_H + 1.2, P);
  const labelMatrix2 = topMatrix([LABEL_PLAN.x + 4, LABEL_PLAN.y + 7], BASE_H + 1.2, P);

  const ruler = slabOf(RULER_PLAN, BASE_H, 1, P, 4, 0.3);
  const rulerEdge = lineOnTop([RULER_PLAN.x + 2, RULER_PLAN.y + 1], [RULER_PLAN.x + RULER_PLAN.w - 2, RULER_PLAN.y + 1], BASE_H + 1, P);
  const rulerTicks = topTicks(RULER_PLAN.x + 4, RULER_PLAN.x + RULER_PLAN.w - 4, 4, 5, RULER_PLAN.y + 1.5, BASE_H + 1, [1.8, 3], P);

  const thermoPost = cylinder(THERMO.x, THERMO.y, 2.2, BASE_H, 14, P, 16);
  const thermoDial = cylinder(THERMO.x, THERMO.y, 8.5, 17.5, 3, P, 28, 0.5);
  const thermoBezel = ring(THERMO.x, THERMO.y, 8.4, 20.5, P, 28);
  const thermoTicks = radialTicks(THERMO.x, THERMO.y, 7.5, 9, 3, 20.5, [1.4, 2.2], P, -2.1, 4.2);
  const needleHub = iso([THERMO.x, THERMO.y, 20.6], P);
  const needlePath = `M${needleHub[0]} ${needleHub[1]}L${needleHub[0]} ${needleHub[1] - 6.4}`;

  return {
    base,
    feet,
    groove,
    screws: { rings, slots, dots },
    dish,
    rimRing,
    rimSeam,
    guideRing,
    dishTicks,
    dishGlint,
    condensation,
    lid,
    lidKnob,
    lidKnurl,
    label,
    labelRules,
    labelMatrix,
    labelMatrix2,
    ruler,
    rulerEdge,
    rulerTicks,
    thermoPost,
    thermoDial,
    thermoBezel,
    thermoTicks,
    needleHub,
    needlePath,
  };
}

export function zoneLabel(zone: string): string {
  return `COLONY PLATE · zone ${zone}`;
}
