/**
 * Simple 3D colony plate rendered with three.js.
 * Isometric petri dish with a bioluminescent medium; each strain is a small
 * toon cell (membrane + nucleus + organelle hints) with gentle breathing.
 * No external models or textures; all geometry is primitive.
 */

import { CapsuleGeometry, Color, CylinderGeometry, DirectionalLight, Fog, Group, HemisphereLight, Material, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, OrthographicCamera, PointLight, Raycaster, Scene, SphereGeometry, TorusGeometry, Vector2, Vector3, WebGLRenderer } from "three";
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

const STATUS_COLORS: Record<string, number> = {
  Active: 0x2dd4bf,
  Distressed: 0xfbbf24,
  Liquidated: 0xef4444,
  SplicedBurned: 0x64748b,
};

function statusColor(status: string, highlight: boolean): number {
  if (highlight) return 0x38bdf8;
  return STATUS_COLORS[status] ?? 0x2dd4bf;
}

function zoneMediumColor(zone: MacroZone): number {
  switch (zone) {
    case "Fever":
      return 0x7c2d12;
    case "Hypothermia":
      return 0x083344;
    default:
      return 0x052e2b;
  }
}

function zoneGlowColor(zone: MacroZone): number {
  switch (zone) {
    case "Fever":
      return 0xf97316;
    case "Hypothermia":
      return 0x06b6d4;
    default:
      return 0x10b981;
  }
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

  constructor(canvas: HTMLCanvasElement, callbacks: ColonyPlateCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(0x030712, 1);

    this.scene = new Scene();
    this.scene.fog = new Fog(0x030712, 24, 46);

    const aspect = 4 / 3;
    this.camera = new OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.1, 100);
    this.camera.position.set(14, 14, 14);
    this.camera.lookAt(0, 0, 0);

    const ambient = new HemisphereLight(0xbae6fd, 0x052e16, 1.1);
    this.scene.add(ambient);
    const key = new DirectionalLight(0xfff7d6, 1.4);
    key.position.set(6, 12, 4);
    this.scene.add(key);
    const rim = new PointLight(0x67e8f9, 30, 30);
    rim.position.set(-5, 4, -6);
    this.scene.add(rim);

    this.plateGroup = new Group();
    this.scene.add(this.plateGroup);
    this.buildPlate();

    this.mediumMesh = new Mesh(
      new CylinderGeometry(5.4, 5.4, 0.35, 48),
      new MeshStandardMaterial({ color: 0x052e2b, roughness: 0.35, emissive: 0x10b981, emissiveIntensity: 0.25 }),
    );
    this.mediumMesh.position.y = 0.55;
    this.plateGroup.add(this.mediumMesh);

    this.bindEvents();
    this.handleResize();
    this.applyZone();
  }

  private buildPlate(): void {
    const baseMat = new MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 });
    const rimMat = new MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.35 });
    const base = new Mesh(new CylinderGeometry(6.2, 5.8, 0.9, 48), baseMat);
    base.position.y = 0.45;
    this.plateGroup.add(base);
    const rim = new Mesh(new TorusGeometry(6.0, 0.28, 12, 64), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.95;
    this.plateGroup.add(rim);
    const glass = new Mesh(
      new CylinderGeometry(5.7, 5.7, 0.5, 48, 1, true),
      new MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.16, roughness: 0.1 }),
    );
    glass.position.y = 0.85;
    this.plateGroup.add(glass);
  }

  private applyZone(): void {
    const theme = ZONE_THEMES[this.zone];
    const mat = this.mediumMesh.material as MeshStandardMaterial;
    mat.color.setHex(zoneMediumColor(this.zone));
    mat.emissive.setHex(zoneGlowColor(this.zone));
    const glow = new Color(theme.color);
    (this.plateGroup.children[1] as Mesh).material = new MeshStandardMaterial({
      color: glow.getHex(),
      roughness: 0.3,
      emissive: glow.getHex(),
      emissiveIntensity: 0.35,
    });
  }

  public setZone(zone: MacroZone): void {
    this.zone = zone;
    this.applyZone();
  }

  public setSelected(id: number | null): void {
    this.selectedId = id;
    for (const [cellId, group] of this.cellGroups) {
      const data = this.cellData.get(cellId);
      const ring = group.getObjectByName("select-ring") as Mesh | undefined;
      if (ring) {
        ring.visible = cellId === id;
        const mat = ring.material as MeshBasicMaterial;
        mat.color.setHex(statusColor(data?.status ?? "Active", Boolean(data?.highlighted)));
      }
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
        this.cellGroups.set(cell.id, this.buildCell(cell));
      } else {
        const membrane = existing.getObjectByName("membrane") as Mesh | undefined;
        const ratio = cell.vitalityRatio ?? 0.5;
        const radius = 0.55 + ratio * 0.85;
        existing.position.set(this.cellX(cell.index, cells.length), 1.05 + ratio * 0.15, this.cellZ(cell.index, cells.length));
        if (membrane) {
          membrane.scale.setScalar(radius);
          const mat = membrane.material as MeshStandardMaterial;
          mat.color.setHex(statusColor(cell.status, Boolean(cell.highlighted)));
          const dead = cell.status === "Liquidated" || cell.status === "SplicedBurned";
          mat.transparent = dead;
          mat.opacity = dead ? 0.55 : 0.92;
          mat.emissiveIntensity = dead ? 0.08 : 0.45;
          mat.emissive.setHex(statusColor(cell.status, Boolean(cell.highlighted)));
        }
        const nucleus = existing.getObjectByName("nucleus") as Mesh | undefined;
        if (nucleus) {
          nucleus.visible = cell.status !== "Liquidated" && cell.status !== "SplicedBurned";
          nucleus.scale.setScalar(0.5 + ratio * 0.4);
          nucleus.position.y = radius * 0.72;
        }
      }
      this.cellData.set(cell.id, cell);
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

  private buildCell(cell: PlateCellInput): Group {
    const group = new Group();
    const ratio = cell.vitalityRatio ?? 0.5;
    const radius = 0.55 + ratio * 0.85;
    const color = statusColor(cell.status, Boolean(cell.highlighted));
    const dead = cell.status === "Liquidated" || cell.status === "SplicedBurned";

    const membrane = new Mesh(
      new SphereGeometry(1, 24, 18),
      new MeshStandardMaterial({
        color,
        roughness: 0.35,
        transparent: true,
        opacity: dead ? 0.5 : 0.8,
        emissive: color,
        emissiveIntensity: dead ? 0.08 : 0.4,
      }),
    );
    membrane.name = "membrane";
    membrane.scale.setScalar(radius);
    group.add(membrane);

    const nucleus = new Mesh(
      new SphereGeometry(0.5, 18, 14),
      new MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.25, emissive: 0xe879f9, emissiveIntensity: 0.5 }),
    );
    nucleus.name = "nucleus";
    nucleus.position.set(0.1, radius * 0.72, 0.08);
    nucleus.scale.setScalar(0.5 + ratio * 0.4);
    nucleus.visible = !dead;
    group.add(nucleus);

    const mitoGeo = new CapsuleGeometry(0.12, 0.35, 4, 8);
    const mitoMat = new MeshStandardMaterial({ color: 0xfb923c, roughness: 0.4, emissive: 0xfb923c, emissiveIntensity: 0.6 });
    for (let i = 0; i < 3; i++) {
      const mito = new Mesh(mitoGeo, mitoMat);
      mito.name = "organelle";
      const angle = (i / 3) * Math.PI * 2;
      const ox = Math.cos(angle) * radius * 0.5;
      const oz = Math.sin(angle) * radius * 0.5;
      mito.position.set(ox, Math.sqrt(Math.max(0, radius * radius - ox * ox - oz * oz)) * 0.55, oz);
      mito.rotation.z = angle;
      group.add(mito);
    }
    for (let i = 0; i < 2; i++) {
      const lys = new Mesh(
        new SphereGeometry(0.14, 10, 8),
        new MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35, emissive: 0xf472b6, emissiveIntensity: 0.55 }),
      );
      lys.name = "organelle";
      const angle = (i / 2) * Math.PI * 2 + 1.2;
      const ox = Math.cos(angle) * radius * 0.42;
      const oz = Math.sin(angle) * radius * 0.42;
      lys.position.set(ox, Math.sqrt(Math.max(0, radius * radius - ox * ox - oz * oz)) * 0.7, oz);
      group.add(lys);
    }

    const ring = new Mesh(
      new TorusGeometry(radius * 1.5, 0.04, 8, 32),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    ring.name = "select-ring";
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.25;
    ring.visible = this.selectedId === cell.id;
    group.add(ring);

    group.position.set(this.cellX(cell.index, this.cellData.size + 1), 1.05 + ratio * 0.15, this.cellZ(cell.index, this.cellData.size + 1));
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
    for (const [, group] of this.cellGroups) {
      const membrane = group.getObjectByName("membrane") as Mesh | undefined;
      if (membrane && !this.reducedMotion) {
        const base = membrane.scale.x;
        const data = group.userData.cellId as number | undefined;
        const ratio = data !== undefined ? (this.cellData.get(data)?.vitalityRatio ?? 0.5) : 0.5;
        const target = (0.55 + ratio * 0.85) * (1 + Math.sin(t * 1.6 + i) * 0.05);
        membrane.scale.setScalar(MathUtils.lerp(base, target, 0.08));
        group.rotation.y = t * 0.12 + i;
      }
      i++;
    }
    const glow = (this.mediumMesh.material as MeshStandardMaterial).emissiveIntensity;
    if (!this.reducedMotion) {
      (this.mediumMesh.material as MeshStandardMaterial).emissiveIntensity = glow + Math.sin(t * 0.9) * 0.002;
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
    this.renderer.dispose();
  }
}
