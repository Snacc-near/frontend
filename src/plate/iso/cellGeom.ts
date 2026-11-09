/**
 * Yeast cell geometry (iso kit). Pure path builders: the ColonyPlate component
 * turns these into <Solid>/<Line>/<Dots> elements. A cell is a low wall puck
 * with a membrane ring, a nucleus + nucleolus, 2–3 bean mitochondria (marigold
 * when producing), ribosome dots, bud-scar rings (== generation), and crack
 * lines for the liquidated look.
 */
import {
  cylinder,
  extrude,
  lineOnTop,
  pointsAt,
  ring,
  sideArc,
  type Flat,
  type LineTone,
  type Plane,
  type Projection,
  type SolidPaths,
} from "./iso-kit.ts";
import { hashRand, type PlacedCell } from "./layout.ts";

export interface CellGeometry {
  wall: SolidPaths;
  membrane: string;
  innerMembrane: string;
  wallGlint: string;
  nucleus: SolidPaths;
  nucleolus: Flat[];
  mitochondria: SolidPaths[];
  cristae: string[];
  ribosomes: Flat[];
  budScars: string[];
  cracks: string;
  selectRing: string;
}

export function cellGeometry(cell: PlacedCell, P: Projection): CellGeometry {
  const { x, y, z, radius: r } = cell;
  const top = z + 3.2;

  const wall = cylinder(x, y, r, z, 3.2, P, 28, 0.6);
  const membrane = ring(x, y, r - 0.8, top, P, 28);
  const innerMembrane = ring(x, y, r * 0.62, top + 0.1, P, 24);
  const wallGlint = sideArc(x, y, r, z + 2.5, P, 20);

  const nucleus = cylinder(x, y, r * 0.5, top, 2.0, P, 24, 0.4);
  const nucleolus = pointsAt(
    [
      [x + r * 0.1, y + r * 0.06, top + 2.0],
    ],
    P,
  );

  const mitCount = 2 + Math.floor(hashRand(cell.id, 7) * 2); // 2 or 3
  const mitochondria: SolidPaths[] = [];
  const cristae: string[] = [];
  for (let i = 0; i < mitCount; i++) {
    const a = (i / mitCount) * Math.PI * 2 + hashRand(cell.id, 8 + i) * 0.9;
    const dist = r * 0.62;
    const mx = x + Math.cos(a) * dist;
    const my = y + Math.sin(a) * dist;
    const beanRx = r * 0.24;
    const beanRy = r * 0.14;
    const rot = a + Math.PI / 2;
    const beanRing: Plane[] = [];
    const steps = 14;
    for (let s = 0; s < steps; s++) {
      const t = (s / steps) * Math.PI * 2;
      const lx = beanRx * Math.cos(t);
      const ly = beanRy * Math.sin(t);
      beanRing.push([
        mx + lx * Math.cos(rot) - ly * Math.sin(rot),
        my + lx * Math.sin(rot) + ly * Math.cos(rot),
      ]);
    }
    mitochondria.push(extrude(beanRing, top + 0.1, 1.1, P, { bevel: 0.3 }));
    for (let c = -1; c <= 1; c++) {
      const off = c * beanRy * 0.45;
      const p1: Plane = [
        mx - beanRx * 0.55 * Math.cos(rot) + off * Math.cos(rot + Math.PI / 2),
        my - beanRx * 0.55 * Math.sin(rot) + off * Math.sin(rot + Math.PI / 2),
      ];
      const p2: Plane = [
        mx + beanRx * 0.55 * Math.cos(rot) + off * Math.cos(rot + Math.PI / 2),
        my + beanRx * 0.55 * Math.sin(rot) + off * Math.sin(rot + Math.PI / 2),
      ];
      cristae.push(lineOnTop(p1, p2, top + 1.2, P));
    }
  }

  const ribosomes: Flat[] = [];
  for (let i = 0; i < 7; i++) {
    const a = hashRand(cell.id, 20 + i) * Math.PI * 2;
    const dist = r * (0.2 + hashRand(cell.id, 30 + i) * 0.45);
    ribosomes.push(...pointsAt([[x + Math.cos(a) * dist, y + Math.sin(a) * dist, top + 0.4]], P));
  }

  const scarAngle = hashRand(cell.id, 41) * Math.PI * 2;
  const scarX = x + Math.cos(scarAngle) * r * 0.86;
  const scarY = y + Math.sin(scarAngle) * r * 0.86;
  const scarCount = Math.min(4, Math.max(1, cell.generation));
  const budScars: string[] = [];
  for (let i = 0; i < scarCount; i++) {
    budScars.push(ring(scarX, scarY, 3.4 - i * 0.8, top + 0.2, P, 18));
  }

  const crackLine = (from: Plane, to: Plane, mid: Plane) => {
    const pts = pointsAt([[from[0], from[1], top + 1.4], [mid[0], mid[1], top + 1.4], [to[0], to[1], top + 1.4]], P);
    return `M${pts.map(([px, py]) => `${px} ${py}`).join("L")}`;
  };
  const cracks =
    crackLine([x - r * 0.1, y - r * 0.6], [x + r * 0.5, y + r * 0.55], [x + r * 0.15, y - r * 0.05]) +
    crackLine([x + r * 0.2, y - r * 0.5], [x - r * 0.55, y + r * 0.3], [x - r * 0.15, y - r * 0.05]);

  const selectRing = ring(x, y, r * 1.45, top + 0.15, P, 28);

  return {
    wall,
    membrane,
    innerMembrane,
    wallGlint,
    nucleus,
    nucleolus,
    mitochondria,
    cristae,
    ribosomes,
    budScars,
    cracks,
    selectRing,
  };
}

export const crackTone: LineTone = "red";
