/**
 * Yeast cell geometry (iso kit, original drawing). Pure path builders: the
 * ColonyPlate component turns these into elements.
 *
 * A cell is a domed, slightly irregular body with real volume (a four-tone
 * ellipsoid, flat where it sits on the agar and where it is cut open on top).
 * The cut face shows a thick wall rim, an inner membrane and tinted cytoplasm
 * with a domed nucleus (nucleolus + envelope pores), bean mitochondria with
 * cristae (marigold when producing), a glass vacuole and ribosome dots. Bud
 * scars on the wall are the generation; a daughter bud shows a recent division.
 */
import {
  cameraOf,
  iso,
  slabOf,
  topMatrix,
  type Flat,
  type Projection,
  type SolidPaths,
} from "./iso-kit.ts";
import { hashRand, type PlacedCell } from "./layout.ts";
import {
  TAU,
  circlePoints,
  ellipsoidOf,
  facesViewer,
  loopAt,
  polyPath,
  surfaceRing,
  wobbleOf,
} from "./organic.ts";

export interface BeanGeometry {
  body: SolidPaths;
  /** cristae arcs with a fade (alpha) — each starts on the bean's outline. */
  cristae: Array<[string, number]>;
}

export interface CellGeometry {
  shadow: string;
  selectRing: string;
  selectHalo: string;
  bud: { body: SolidPaths; ring: string } | null;
  dome: SolidPaths;
  rimOuter: string;
  rimInner: string;
  wallBand: string;
  sheen: string;
  nucleus: SolidPaths;
  nucleusEnvelope: string;
  pores: Flat[];
  nucleolus: SolidPaths;
  mitochondria: BeanGeometry[];
  vacuole: SolidPaths;
  vacuoleShine: Flat;
  ribosomes: Flat[];
  budScars: Array<{ outer: string; inner: string; dot: Flat }>;
  cracks: string;
  sideCrack: string;
  hit: { center: Flat; radius: number };
  spark: Flat;
}

/** Dome proportions (fractions of the cell radius): height, cut height, cut radius. */
export const DOME_H = 0.86;
export const DOME_CUT = 0.5;
export const FACE_R = Math.sqrt(1 - DOME_CUT * DOME_CUT); // 0.87

const viewerAngle = (P: Projection) => {
  const { sinA, cosA } = cameraOf(P);
  return Math.atan2(sinA, cosA);
};

/** The small engraved id tag that stands in front of the picked cell. */
export function tagGeometry(cell: PlacedCell, P: Projection): { slab: SolidPaths; matrix: string; size: number } {
  const va = viewerAngle(P);
  const tx = cell.x + Math.cos(va) * (cell.radius * 1.12 + 3.2) - 5.5;
  const ty = cell.y + Math.sin(va) * (cell.radius * 1.12 + 3.2) - 2.6;
  return {
    slab: slabOf({ x: tx, y: ty, w: 11, d: 5.2, r: 0.8 }, cell.z, 2.2, P, 4, 0.25),
    matrix: topMatrix([tx + 1.4, ty + 3.9], cell.z + 2.2, P),
    size: 3.3,
  };
}

export function cellGeometry(cell: PlacedCell, P: Projection, minHit = 24): CellGeometry {
  const { x, y, z, radius: r } = cell;
  const h = r * DOME_H;
  const zc = h * DOME_CUT;
  const zf = z + zc;
  const rf = r * FACE_R;
  const wob = wobbleOf(cell.id);
  const rnd = (salt: number) => hashRand(cell.id, salt);
  const va = viewerAngle(P);
  const k = cameraOf(P).k;

  // --- body: dome clamped flat at the bottom and at the cut -------------------
  const dome = ellipsoidOf([x, y, z], [r, r, h], 0, P, {
    steps: 56,
    warp: ([lx, ly, lz]) => {
      const m = wob(Math.atan2(ly, lx));
      return [lx * m, ly * m, Math.min(zc, Math.max(0, lz))];
    },
  });
  const rimOuter = loopAt(x, y, zf, (a) => rf * wob(a), P, 48);
  const innerFrac = 0.82;
  const rimInner = loopAt(x, y, zf + 0.04, (a) => rf * innerFrac * wob(a), P, 40);
  const wallBand = rimOuter + rimInner;
  const sheen = loopAt(x - rf * 0.16, y - rf * 0.16, zf + 0.06, (a) => rf * innerFrac * 0.5 * wob(a + 1), P, 24);

  const shadow = loopAt(x + r * 0.2, y + r * 0.26, z - 0.02, (a) => r * 1.08 * wob(a), P, 36);
  const selectRing = loopAt(x, y, z + 0.15, () => r * 1.34, P, 48);
  const selectHalo = loopAt(x, y, z + 0.1, () => r * 1.5, P, 48);

  // --- organelles on the cut face (plan units) ---------------------------------
  const nAng = rnd(3) * TAU;
  const nx = x + Math.cos(nAng) * rf * 0.12;
  const ny = y + Math.sin(nAng) * rf * 0.12;
  const nR = rf * 0.3;
  const nH = rf * 0.22;
  const clampUp = ([lx, ly, lz]: [number, number, number]): [number, number, number] => [lx, ly, Math.max(0, lz)];
  const nucleus = ellipsoidOf([nx, ny, zf], [nR, nR * 0.95, nH], 0, P, { steps: 40, warp: clampUp });
  const nucleusEnvelope = loopAt(nx, ny, zf + 0.03, () => nR * 1.06, P, 32);
  const poreCount = 12;
  const pores = circlePoints(nx, ny, zf + 0.12, nR * 1.03, poreCount, P, va - Math.PI * 0.62, Math.PI * 1.24).slice(0, poreCount);
  const nucTopZ = zf + nH * 0.97;
  const nucleolus = ellipsoidOf(
    [nx - nR * 0.22, ny + nR * 0.12, nucTopZ - nH * 0.12],
    [nR * 0.3, nR * 0.28, nR * 0.22],
    0,
    P,
    { steps: 24, warp: clampUp },
  );

  const beanCount = 2 + Math.floor(rnd(7) * 2);
  const beanBase = rnd(5) * TAU;
  const mitochondria: BeanGeometry[] = [];
  const spots: Array<{ x: number; y: number; r: number }> = [{ x: nx, y: ny, r: nR * 1.15 }];
  for (let i = 0; i < beanCount; i++) {
    const ang = beanBase + (i / (beanCount + 1)) * TAU;
    const dist = rf * 0.6;
    const mx = x + Math.cos(ang) * dist;
    const my = y + Math.sin(ang) * dist;
    const a = rf * 0.19;
    const b = rf * 0.085;
    const bh = rf * 0.075;
    const yaw = ang + Math.PI / 2 + (rnd(9 + i) - 0.5) * 0.5;
    const bend = (lx: number) => (lx * lx) / a;
    const body = ellipsoidOf([mx, my, zf], [a, b, bh], yaw, P, {
      steps: 36,
      warp: ([lx, ly, lz]) => [lx, ly + bend(lx) * 0.55 - a * 0.18, Math.max(0, lz)],
    });
    // cristae: cross-section arcs on the side of the bean that faces the viewer
    const side = -Math.sin(yaw) * Math.cos(va) + Math.cos(yaw) * Math.sin(va) >= 0 ? 1 : -1;
    const cristae: Array<[string, number]> = [];
    for (const t of [-0.55, -0.18, 0.18, 0.55]) {
      const lx = a * t;
      const arc = (from: number, to: number) => {
        const pts: Flat[] = [];
        for (let s = 0; s <= 5; s++) {
          const phi = from + ((to - from) * s) / 5;
          const ly = side * b * 0.96 * Math.cos(phi) + bend(lx) * 0.55 - a * 0.18;
          const lz = bh * 0.96 * Math.sin(phi);
          const wx = mx + lx * Math.cos(yaw) - ly * Math.sin(yaw);
          const wy = my + lx * Math.sin(yaw) + ly * Math.cos(yaw);
          pts.push(iso([wx, wy, zf + lz], P));
        }
        return polyPath(pts);
      };
      cristae.push([arc(0, 0.7), 0.85], [arc(0.7, 1.15), 0.5], [arc(1.15, 1.5), 0.2]);
    }
    mitochondria.push({ body, cristae });
    spots.push({ x: mx, y: my, r: a * 1.15 });
  }

  const vAng = beanBase + Math.PI * 0.95;
  const vx = x + Math.cos(vAng) * rf * 0.5;
  const vy = y + Math.sin(vAng) * rf * 0.5;
  const vR = rf * 0.19;
  const vacuole = ellipsoidOf([vx, vy, zf], [vR, vR, vR * 0.78], 0, P, { steps: 32, warp: clampUp });
  const vacuoleShine = iso([vx - vR * 0.35, vy - vR * 0.35, zf + vR * 0.62], P);
  spots.push({ x: vx, y: vy, r: vR * 1.2 });

  const ribosomes: Flat[] = [];
  for (let i = 0; i < 40 && ribosomes.length < 10; i++) {
    const a = rnd(20 + i) * TAU;
    const d = rf * (0.12 + rnd(60 + i) * 0.62);
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    if (spots.some((s) => Math.hypot(px - s.x, py - s.y) < s.r + rf * 0.04)) continue;
    ribosomes.push(iso([px, py, zf + 0.1], P));
  }

  // --- bud scars (generation): rings on the wall facing the viewer -------------
  const scarCount = Math.min(5, Math.max(1, cell.generation));
  const psi = 0.4;
  const budScars: CellGeometry["budScars"] = [];
  for (let i = 0; i < scarCount; i++) {
    const phi = va + (i - (scarCount - 1) / 2) * 0.6 + (rnd(41 + i) - 0.5) * 0.12;
    const m = wob(phi);
    const px = x + Math.cos(phi) * r * Math.cos(psi) * m;
    const py = y + Math.sin(phi) * r * Math.cos(psi) * m;
    const pz = z + h * Math.sin(psi);
    const normal: [number, number, number] = [Math.cos(psi) * Math.cos(phi) / r, Math.cos(psi) * Math.sin(phi) / r, Math.sin(psi) / h];
    if (!facesViewer(normal, P, 0.1)) continue;
    const rho = Math.max(0.9, r * 0.12);
    budScars.push({
      outer: surfaceRing([px, py, pz], normal, rho, P, 22),
      inner: surfaceRing([px, py, pz], normal, rho * 0.5, P, 16),
      dot: iso([px, py, pz], P),
    });
  }

  // --- daughter bud (recent division) -------------------------------------------
  let bud: CellGeometry["bud"] = null;
  if (cell.budding) {
    const side = rnd(77) < 0.5 ? -1 : 1;
    const phi = va + side * 1.3;
    const rb = r * 0.46;
    const dist = r * 0.9 + rb * 0.4;
    const bc: [number, number, number] = [x + Math.cos(phi) * dist, y + Math.sin(phi) * dist, z];
    bud = {
      body: ellipsoidOf(bc, [rb, rb, rb * 0.82], 0, P, { steps: 36, warp: ([lx, ly, lz]) => [lx, ly, Math.max(0, lz)] }),
      ring: loopAt(bc[0], bc[1], z + 0.2, () => rb * 1.1, P, 28),
    };
  }

  // --- cracks (liquidated) -------------------------------------------------------
  const crackPts = (a0: number): Flat[] => {
    const pts: Flat[] = [];
    for (let s = 0; s <= 5; s++) {
      const t = s / 5;
      const ang = a0 + (rnd(90 + s) - 0.5) * 0.55;
      const d = rf * (1 - t * 0.86);
      pts.push(iso([x + Math.cos(ang) * d, y + Math.sin(ang) * d, zf + 0.15], P));
    }
    return pts;
  };
  const cracks = polyPath(crackPts(va + 0.5)) + polyPath(crackPts(va + 2.7)) + polyPath(crackPts(va - 1.9));
  const crackA = va - 0.25;
  const sidePts: Flat[] = [];
  for (let s = 0; s <= 6; s++) {
    const t = s / 6;
    const ps = Math.asin(DOME_CUT * DOME_H / DOME_H) * (1 - t); // from the rim down to the equator
    const ang = crackA + Math.sin(t * 9) * 0.07;
    const rr = r * Math.cos(ps) * wob(ang);
    sidePts.push(iso([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, z + h * Math.sin(ps) + 0.05], P));
  }
  const sideCrack = polyPath(sidePts);

  const center = iso([x, y, z + zc * 0.55], P);
  return {
    shadow,
    selectRing,
    selectHalo,
    bud,
    dome,
    rimOuter,
    rimInner,
    wallBand,
    sheen,
    nucleus,
    nucleusEnvelope,
    pores,
    nucleolus,
    mitochondria,
    vacuole,
    vacuoleShine,
    ribosomes,
    budScars,
    cracks,
    sideCrack,
    hit: { center, radius: Math.max(r * k * 1.15, minHit) },
    spark: iso([x, y, z + zc + 5], P),
  };
}
