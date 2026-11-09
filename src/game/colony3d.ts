/**
 * Simple 3D colony plate rendered with three.js.
 * Anatomy "plain" style: cream petri dish on a rounded base plate with corner
 * screws and a dark offset shadow; each strain is an ink-outlined toon cell
 * (membrane + nucleus + nucleolus + mitochondria + ribosome dots) with gentle
 * breathing. No external models or textures; toon cel-ramp shading only.
 */

import { BackSide, BoxGeometry, CapsuleGeometry, CylinderGeometry, DataTexture, DirectionalLight, ExtrudeGeometry, Group, HemisphereLight, Material, MathUtils, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, Object3D, OrthographicCamera, PlaneGeometry, Raycaster, RedFormat, Scene, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector2, Vector3, WebGLRenderer } from "three";
import type { MacroZone } from "../config/zones.ts";
import { ZONE_THEMES } from "../config/zones.ts";

export interface PlateCellInput {
  id: number;
  vitalityRatio: number | null;
  status: string;
  highlighted?: boolean;
  index: number;
}

export interface ColonyPlateCallbacks {
  onCellSelect: (cellId: number) => void;
}

const INK = 0x16181a;
const CREAM = 0xfffdf5;
const CREAM_SHADOW = 0xe9dcb8;
const MARIGOLD = 0xf8aa06;
const FROST = 0xdceef2;
const WARM_MEDIUM = 0xf2d9a8;

function zoneMediumColor(zone: MacroZone): number {
  switch (zone) {
    case "Fever":
      return WARM_MEDIUM;
    case "Hypothermia":
      return FROST;
    default:
      return 0xe9d9ac;
  }
}

function cellBodyColor(status: string): number {
  switch (status) {
    case "Distressed":
      return 0xd9d5c8;
    case "Liquidated":
      return 0xe8d9c8;
    case "SplicedBurned":
      return 0xd3d5d6;
    default:
      return CREAM;
  }
}

function makeCelRamp(): DataTexture {
  const colors = new Uint8Array([120, 170, 220, 255]);
  const tex = new DataTexture(colors, 4, 1, RedFormat);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export class ColonyPlate3D {
  private canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: OrthographicCamera;
  private plateGroup: Group;
  private mediumMesh: Mesh;
  private cellGroups = new Map<number, Group>();
  private cellData = new Map<number, PlateCellInput>();
  private callbacks: ColonyPlateCallbacks;
  private zone: MacroZone = "Goldilocks";
  private selectedId: number | null = null;
  private running = false;
  private rafId = 0;
  private timeSec = 0;
  private lastTime = 0;
  private reducedMotion: boolean;
  private raycaster = new Raycaster();
  private pointerDownAt = 0;
  private dragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private cameraTarget = new Vector3(0, 0, 0);
  private resizeObserver: ResizeObserver | null = null;
  private width = 800;
  private height = 600;
  private ramp: DataTexture;

  constructor(canvas: HTMLCanvasElement, callbacks: ColonyPlateCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.ramp = makeCelRamp();

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(0xefefec, 1);

    this.scene = new Scene();

    const aspect = 4 / 3;
    this.camera = new OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.1, 100);
    this.camera.position.set(14, 14, 14);
    this.camera.lookAt(0, 0, 0);

    const ambient = new HemisphereLight(0xffffff, 0xe9dcb8, 1.35);
    this.scene.add(ambient);
    const key = new DirectionalLight(0xfff6e0, 1.1);
    key.position.set(6, 12, 4);
    this.scene.add(key);

    this.plateGroup = new Group();
    this.scene.add(this.plateGroup);
    this.buildPlate();

    this.mediumMesh = new Mesh(
      new CylinderGeometry(5.4, 5.4, 0.3, 48),
      new MeshToonMaterial({ color: 0xf3ead3, gradientMap: this.ramp }),
    );
    this.mediumMesh.position.y = 0.83;
    this.plateGroup.add(this.mediumMesh);

    this.bindEvents();
    this.handleResize();
    this.applyZone();
  }

  private toon(color: number, opts: { opacity?: number; transparent?: boolean } = {}): MeshToonMaterial {
    return new MeshToonMaterial({
      color,
      gradientMap: this.ramp,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
  }

  private outline(mesh: Mesh, scale: number): Mesh {
    const hull = new Mesh(
      mesh.geometry,
      new MeshBasicMaterial({ color: INK, side: BackSide }),
    );
    hull.scale.setScalar(scale);
    mesh.add(hull);
    return mesh;
  }

  private buildPlate(): void {
    const baseMat = this.toon(0xfbf6e3);
    const sideMat = this.toon(CREAM_SHADOW);
    const inkMat = new MeshBasicMaterial({ color: INK });

    // dark flat offset shadow (anatomy base-plate halo)
    const shadow = new Mesh(
      new PlaneGeometry(14.6, 14.6),
      new MeshBasicMaterial({ color: 0x2a2218, transparent: true, opacity: 0.4 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.5, 0.01, 0.6);
    this.plateGroup.add(shadow);

    // rounded rectangular base plate
    const half = 7.3;
    const r = 1.1;
    const shape = new Shape();
    shape.moveTo(-half + r, -half);
    shape.lineTo(half - r, -half);
    shape.quadraticCurveTo(half, -half, half, -half + r);
    shape.lineTo(half, half - r);
    shape.quadraticCurveTo(half, half, half - r, half);
    shape.lineTo(-half + r, half);
    shape.quadraticCurveTo(-half, half, -half, half - r);
    shape.lineTo(-half, -half + r);
    shape.quadraticCurveTo(-half, -half, -half + r, -half);
    const plateGeo = new ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 6 });
    const plate = new Mesh(plateGeo, baseMat);
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.32;
    this.plateGroup.add(plate);

    void sideMat;

    // corner screws
    const screwGeo = new CylinderGeometry(0.22, 0.22, 0.12, 16);
    for (const [sx, sz] of [[-6.4, -6.4], [6.4, -6.4], [-6.4, 6.4], [6.4, 6.4]] as const) {
      const screw = new Mesh(screwGeo, this.toon(0xd9d5c8));
      screw.position.set(sx, 0.78, sz);
      this.plateGroup.add(screw);
      const slot = new Mesh(new BoxGeometry(0.3, 0.02, 0.06), inkMat);
      slot.position.set(sx, 0.845, sz);
      this.plateGroup.add(slot);
    }

    // cream petri dish body (pale grey-beige so it separates from the medium)
    const dish = new Mesh(
      new CylinderGeometry(6.0, 5.7, 0.6, 48),
      this.toon(0xefe9da),
    );
    dish.position.y = 1.05;
    this.plateGroup.add(dish);

    // ink grounding ring at the dish foot
    const footRing = new Mesh(
      new TorusGeometry(5.78, 0.05, 8, 64),
      new MeshBasicMaterial({ color: INK }),
    );
    footRing.rotation.x = Math.PI / 2;
    footRing.position.y = 0.78;
    this.plateGroup.add(footRing);

    // moulded rim
    const rim = new Mesh(new TorusGeometry(5.95, 0.22, 10, 64), this.toon(0xffffff));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.36;
    this.plateGroup.add(rim);

    // glass wall + highlight arc
    const glass = new Mesh(
      new CylinderGeometry(5.72, 5.72, 0.34, 48, 1, true),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 }),
    );
    glass.position.y = 1.2;
    this.plateGroup.add(glass);
    const highlightShape = new Shape();
    highlightShape.absarc(0, 0, 5.55, Math.PI * 0.75, Math.PI * 0.95, false);
    const highlight = new Mesh(
      new ShapeGeometry(highlightShape),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: BackSide }),
    );
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.y = 1.39;
    this.plateGroup.add(highlight);

    // graduation ticks around the rim
    const tickGeo = new BoxGeometry(0.06, 0.03, 0.42);
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const major = i % 6 === 0;
      const tick = new Mesh(tickGeo, new MeshBasicMaterial({ color: INK }));
      tick.scale.set(1, 1, major ? 1.6 : 0.8);
      tick.position.set(Math.cos(angle) * 5.6, 1.04, Math.sin(angle) * 5.6);
      tick.rotation.y = -angle;
      this.plateGroup.add(tick);
    }
  }

  private applyZone(): void {
    const theme = ZONE_THEMES[this.zone];
    const mat = this.mediumMesh.material as MeshToonMaterial;
    mat.color.setHex(zoneMediumColor(this.zone));
    void theme;
  }

  public setZone(zone: MacroZone): void {
    this.zone = zone;
    this.applyZone();
  }

  public setSelected(id: number | null): void {
    this.selectedId = id;
    for (const [cellId, group] of this.cellGroups) {
      const ring = group.getObjectByName("select-ring") as Mesh | undefined;
      if (ring) ring.visible = cellId === id;
    }
  }

  public setCells(cells: PlateCellInput[]): void {
    const incoming = new Map(cells.map((cell) => [cell.id, cell]));
    for (const id of [...this.cellGroups.keys()]) {
      if (!incoming.has(id)) {
        const group = this.cellGroups.get(id);
        if (group) {
          this.plateGroup.remove(group);
          this.disposeGroup(group);
        }
        this.cellGroups.delete(id);
        this.cellData.delete(id);
      }
    }
    for (const cell of cells) {
      const existing = this.cellGroups.get(cell.id);
      if (!existing) {
        this.cellData.set(cell.id, cell);
        this.cellGroups.set(cell.id, this.buildCell(cell, cells.length));
      } else {
        this.cellData.set(cell.id, cell);
        const ratio = cell.vitalityRatio ?? 0.5;
        const radius = 0.72 + ratio * 0.95;
        existing.position.set(this.cellX(cell.index, cells.length), 1.62 + radius * 0.42, this.cellZ(cell.index, cells.length));
        const body = existing.getObjectByName("membrane") as Mesh | undefined;
        if (body) {
          body.scale.setScalar(radius);
          (body.material as MeshToonMaterial).color.setHex(cellBodyColor(cell.status));
          const dead = cell.status === "Liquidated" || cell.status === "SplicedBurned";
          (body.material as MeshToonMaterial).transparent = dead;
          (body.material as MeshToonMaterial).opacity = cell.status === "SplicedBurned" ? 0.45 : dead ? 0.85 : 1;
        }
        const nucleus = existing.getObjectByName("nucleus") as Mesh | undefined;
        if (nucleus) {
          nucleus.visible = !(cell.status === "Liquidated" || cell.status === "SplicedBurned");
          nucleus.scale.setScalar(0.46 + ratio * 0.4);
          nucleus.position.y = radius * 0.5;
        }
        const rimRing = existing.getObjectByName("status-rim") as Mesh | undefined;
        if (rimRing) {
          rimRing.visible = cell.status === "Liquidated";
          rimRing.scale.setScalar(radius * 1.28);
        }
      }
    }
    this.setSelected(this.selectedId);
  }

  private cellX(index: number, total: number): number {
    if (total <= 1) return 0;
    const angle = (index / total) * Math.PI * 2 + 0.5;
    return Math.cos(angle) * 2.6;
  }

  private cellZ(index: number, total: number): number {
    if (total <= 1) return 0;
    const angle = (index / total) * Math.PI * 2 + 0.5;
    return Math.sin(angle) * 2.6;
  }

  private buildCell(cell: PlateCellInput, total: number): Group {
    const group = new Group();
    const ratio = cell.vitalityRatio ?? 0.5;
    const radius = 0.72 + ratio * 0.95;
    const dead = cell.status === "Liquidated" || cell.status === "SplicedBurned";
    const ghosted = cell.status === "SplicedBurned";

    const membrane = new Mesh(
      new SphereGeometry(1, 28, 20),
      this.toon(cellBodyColor(cell.status), {
        transparent: ghosted || dead,
        opacity: ghosted ? 0.45 : 1,
      }),
    );
    membrane.name = "membrane";
    membrane.scale.setScalar(radius);
    this.outline(membrane, 1.04);
    group.add(membrane);

    // nucleus + nucleolus (sat on the visible dome, camera-side)
    const nucleus = new Mesh(
      new SphereGeometry(0.42, 20, 14),
      this.toon(0xa8adb0),
    );
    nucleus.name = "nucleus";
    nucleus.position.set(0.1, radius * 0.5, radius * 0.78);
    nucleus.scale.setScalar(0.46 + ratio * 0.4);
    nucleus.visible = !dead;
    this.outline(nucleus, 1.07);
    group.add(nucleus);
    const nucleolus = new Mesh(
      new SphereGeometry(0.16, 10, 8),
      this.toon(MARIGOLD),
    );
    nucleolus.name = "nucleolus";
    nucleolus.position.set(0.1, radius * 0.5, radius * 0.78 + 0.34);
    nucleolus.visible = !dead;
    group.add(nucleolus);

    // mitochondria: marigold when producing (Active), pale otherwise — capsules lying on the dome
    const producing = cell.status === "Active";
    const mitoMat = this.toon(producing ? MARIGOLD : 0xc4c6c8);
    const mitoGeo = new CapsuleGeometry(0.16, 0.6, 4, 10);
    for (let i = 0; i < 3; i++) {
      const mito = new Mesh(mitoGeo, mitoMat);
      mito.name = "organelle";
      const angle = (i / 3) * Math.PI * 2 + 0.4;
      const ox = Math.cos(angle) * radius * 0.45;
      const oz = Math.sin(angle) * radius * 0.45 + radius * 0.1;
      const surf = Math.sqrt(Math.max(0.02, radius * radius - ox * ox - oz * oz));
      const holder = new Group();
      holder.rotation.y = angle;
      mito.position.set(0, surf * 1.02, oz + radius * 0.1);
      mito.rotation.x = Math.PI / 2;
      mito.rotation.z = 0;
      mito.visible = !dead;
      this.outline(mito, 1.06);
      holder.add(mito);
      group.add(holder);
    }

    // ribosome dots
    const riboGeo = new SphereGeometry(0.09, 8, 6);
    const riboMat = new MeshBasicMaterial({ color: INK });
    for (let i = 0; i < 5; i++) {
      const dot = new Mesh(riboGeo, riboMat);
      const angle = (i / 5) * Math.PI * 2 + 1.1;
      dot.position.set(Math.cos(angle) * radius * 0.55, -radius * 0.15 + (i % 2) * 0.18, Math.sin(angle) * radius * 0.55);
      dot.visible = !dead;
      group.add(dot);
    }

    // red status rim for liquidated cells
    const statusRim = new Mesh(
      new TorusGeometry(1, 0.07, 8, 40),
      new MeshBasicMaterial({ color: 0xde3b2e }),
    );
    statusRim.name = "status-rim";
    statusRim.rotation.x = Math.PI / 2;
    statusRim.position.y = -radius * 0.55;
    statusRim.scale.setScalar(radius * 1.28);
    statusRim.visible = cell.status === "Liquidated";
    group.add(statusRim);

    // marigold selection ring at the cell base
    const ring = new Mesh(
      new TorusGeometry(radius * 1.5, 0.055, 8, 40),
      new MeshBasicMaterial({ color: MARIGOLD }),
    );
    ring.name = "select-ring";
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -radius * 0.52;
    ring.visible = this.selectedId === cell.id;
    group.add(ring);

    group.position.set(this.cellX(cell.index, total), 1.62 + radius * 0.42, this.cellZ(cell.index, total));
    group.userData.cellId = cell.id;
    this.plateGroup.add(group);
    return group;
  }

  private disposeGroup(group: Group): void {
    group.traverse((child) => {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        const mat = child.material as Material | Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      if (!this.reducedMotion) this.timeSec += dt;
      this.animate();
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private animate(): void {
    const t = this.timeSec;
    let i = 0;
    for (const [cellId, group] of this.cellGroups) {
      const data = this.cellData.get(cellId);
      const status = data?.status ?? "Active";
      const ratio = data?.vitalityRatio ?? 0.5;
      const dead = status === "Liquidated" || status === "SplicedBurned";
      const distressed = status === "Distressed";
      const membrane = group.getObjectByName("membrane") as Mesh | undefined;
      if (membrane && !this.reducedMotion && !dead) {
        const base = 0.72 + ratio * 0.95;
        const speed = distressed ? 0.7 : 1.6;
        const amp = distressed ? 0.03 : 0.05;
        const target = base * (1 + Math.sin(t * speed + i) * amp);
        const current = membrane.scale.x;
        membrane.scale.setScalar(MathUtils.lerp(current, target, 0.08));
        group.rotation.y = t * (distressed ? 0.05 : 0.12) + i;
      }
      i++;
    }
    this.camera.lookAt(this.cameraTarget);
  }

  private handlePointerTap(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes: Object3D[] = [];
    for (const [, group] of this.cellGroups) {
      group.traverse((child) => {
        if (child instanceof Mesh && child.name === "membrane") meshes.push(group);
      });
    }
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      let obj: Object3D | null = hits[0].object;
      while (obj && obj.userData.cellId === undefined) obj = obj.parent;
      if (obj && typeof obj.userData.cellId === "number") {
        this.callbacks.onCellSelect(obj.userData.cellId);
      }
    }
  }

  private handleResize = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width) || window.innerWidth);
    this.height = Math.max(1, Math.round(rect.height) || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.width < 640 ? 1.5 : 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / Math.max(1, this.height);
    const size = this.width < 640 ? 11 : 9;
    this.camera.left = -size * aspect;
    this.camera.right = size * aspect;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.updateProjectionMatrix();
  };

  private bindEvents(): void {
    window.addEventListener("resize", this.handleResize);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvas);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
      else this.start();
    });

    let downX = 0;
    let downY = 0;
    this.canvas.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.pointerDownAt = performance.now();
      downX = e.clientX;
      downY = e.clientY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) {
        this.cameraTarget.x = MathUtils.clamp(this.cameraTarget.x - dx * 0.02, -3, 3);
        this.cameraTarget.z = MathUtils.clamp(this.cameraTarget.z - dy * 0.02, -3, 3);
      }
    });
    this.canvas.addEventListener("pointerup", (e) => {
      this.dragging = false;
      const duration = performance.now() - this.pointerDownAt;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (duration < 350 && dist < 8) this.handlePointerTap(e.clientX, e.clientY);
    });
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoom = MathUtils.clamp(this.camera.zoom + (e.deltaY < 0 ? 0.08 : -0.08), 0.55, 2.2);
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }, { passive: false });
  }

  public dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const [, group] of this.cellGroups) this.disposeGroup(group);
    this.cellGroups.clear();
    this.ramp.dispose();
    this.renderer.dispose();
  }
}
