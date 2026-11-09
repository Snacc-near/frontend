/**
 * Snacc — The Living Crucible.
 *
 * A procedural isometric bioreactor diorama rendered with Three.js.
 * No external models or textures: every object is built from primitives,
 * canvas textures, and small shaders so the scene stays crisp and cheap.
 *
 * Visual language:
 * - orthographic game-diorama camera with slow idle orbit
 * - toon shading, vector outlines, copper hardware, bioluminescent glass
 * - a glass crucible holding a living cell, a Bell of Plenty, and a thermostat
 */

import * as THREE from "three";
import type { MacroZone, OrganelleAllocation, SkinMode } from "./types.ts";
import { classifyZone } from "./types.ts";
import { prefersReducedMotion } from "./motion.ts";

export type ThemeMode = "bioluminescent" | "daylight";
export type SporeKind = "snacc" | "ignis" | "myco";

export interface SceneHover {
  label: string;
  hint: string;
  x: number;
  y: number;
}

export interface CrucibleSceneCallbacks {
  onSporeHarvested: (kind: SporeKind, bonusTempMk: number) => void;
  onBellActivated?: () => void;
  onThermostatActivated?: () => void;
  onCellActivated?: () => void;
  onHoverChange?: (hover: SceneHover | null) => void;
}

interface InteractiveData {
  kind: "spore" | "bell" | "thermostat" | "cell";
  label: string;
  hint: string;
  spore?: FloatingSpore;
}

interface ScenePalette {
  stoneTop: number;
  stoneSide: number;
  stoneDeep: number;
  moss: number;
  copper: number;
  copperDark: number;
  darkMetal: number;
  accent: number;
  accentAlt: number;
  liquid: number;
  mushroom: number;
  crystal: number;
  glass: number;
  outline: number;
  fog: number;
  ambient: number;
  key: number;
  rim: number;
  mote: number;
  cellCore: number;
  cellRim: number;
}

type PaletteRole = keyof ScenePalette;

interface ColorEntry {
  color: THREE.Color;
  target: THREE.Color;
  role: PaletteRole;
}

interface FloatingSpore {
  root: THREE.Group;
  shape: THREE.Mesh;
  halo: THREE.Sprite;
  kind: SporeKind;
  angle: number;
  radius: number;
  height: number;
  speed: number;
  phase: number;
  spin: number;
  absorbing: boolean;
  absorbProgress: number;
  respawnAt: number;
}

interface Bubble {
  mesh: THREE.Mesh;
  speed: number;
  offset: number;
  baseScale: number;
}

interface MoteDatum {
  baseX: number;
  baseZ: number;
  y: number;
  speed: number;
  phase: number;
  sway: number;
}

interface Shockwave {
  mesh: THREE.Mesh;
  progress: number;
  speed: number;
  growth: number;
  strength: number;
}

interface LightRig {
  ambient: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  rim: THREE.PointLight;
  fill: THREE.PointLight;
  cell: THREE.PointLight;
}

const ZONE_ACCENTS: Record<MacroZone, { accent: number; alt: number }> = {
  Hypothermia: { accent: 0x5ad8ff, alt: 0x8f9dff },
  Goldilocks: { accent: 0x63f0b7, alt: 0xffcf7a },
  Fever: { accent: 0xffa15c, alt: 0xff5f6d },
};

function darken(hex: number, factor: number): number {
  const color = new THREE.Color(hex);
  color.multiplyScalar(factor);
  return color.getHex();
}

function resolvePalette(theme: ThemeMode, zone: MacroZone, skin: SkinMode): ScenePalette {
  const base = ZONE_ACCENTS[zone];
  const accent = skin === "fintech"
    ? (theme === "daylight" ? 0x23628c : 0x79b8ff)
    : (theme === "daylight" ? darken(base.accent, 0.54) : base.accent);
  const accentAlt = skin === "fintech"
    ? (theme === "daylight" ? 0x5b7a9e : 0xa9d0ff)
    : (theme === "daylight" ? darken(base.alt, 0.58) : base.alt);

  if (theme === "daylight") {
    return {
      stoneTop: 0xd8cfb5,
      stoneSide: 0xbdb198,
      stoneDeep: 0x8c816b,
      moss: 0x7a9a63,
      copper: 0xb16c40,
      copperDark: 0x74462b,
      darkMetal: 0x45463d,
      accent,
      accentAlt,
      liquid: accent,
      mushroom: accent,
      crystal: accentAlt,
      glass: 0xf4fff8,
      outline: 0x2b3932,
      fog: 0xece5d4,
      ambient: 0xfff1d2,
      key: 0xfff9ea,
      rim: accent,
      mote: 0x5c9c84,
      cellCore: darken(accent, 0.72),
      cellRim: accent,
    };
  }

  return {
    stoneTop: 0x244541,
    stoneSide: 0x173230,
    stoneDeep: 0x0a1d22,
    moss: 0x2f6b52,
    copper: 0xc07b4b,
    copperDark: 0x75482d,
    darkMetal: 0x0c1a1e,
    accent,
    accentAlt,
    liquid: accent,
    mushroom: accent,
    crystal: accentAlt,
    glass: 0xbfffe9,
    outline: 0x031116,
    fog: 0x061014,
    ambient: 0x3b6268,
    key: 0xfff2dc,
    rim: accent,
    mote: 0xa9ffe4,
    cellCore: darken(accent, 0.36),
    cellRim: accent,
  };
}

function makeCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createToonGradient(): THREE.DataTexture {
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function createGlowTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(128, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.22, "rgba(255,255,255,0.72)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

function createDotTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(64, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0.65)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

function createIslandTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(512, (ctx, size) => {
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(0, 0, size, size);
    const center = size / 2;

    // Concentric machined rings.
    for (let i = 0; i < 7; i++) {
      const radius = 34 + i * 33;
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 === 0 ? "rgba(84,84,84,0.32)" : "rgba(238,238,238,0.58)";
      ctx.lineWidth = i % 3 === 0 ? 2.4 : 1.2;
      ctx.stroke();
    }

    // Radial seams.
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * 44, center + Math.sin(angle) * 44);
      ctx.lineTo(center + Math.cos(angle) * 250, center + Math.sin(angle) * 250);
      ctx.strokeStyle = "rgba(76,76,76,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Mineral speckle.
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 260; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 30 + random() * 220;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      const alpha = 0.06 + random() * 0.16;
      ctx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(40,40,40,${alpha})`;
      ctx.fillRect(x, y, 1 + random() * 2.4, 1 + random() * 2.4);
    }

    // Soft center crater.
    const crater = ctx.createRadialGradient(center, center, 0, center, center, 100);
    crater.addColorStop(0, "rgba(255,255,255,0.38)");
    crater.addColorStop(0.7, "rgba(120,120,120,0.08)");
    crater.addColorStop(1, "rgba(120,120,120,0)");
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(center, center, 100, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createDialTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(512, (ctx, size) => {
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);

    const face = ctx.createRadialGradient(c, c - 30, 8, c, c, c - 14);
    face.addColorStop(0, "#18302f");
    face.addColorStop(1, "#081417");
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(c, c, c - 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(196,244,224,0.2)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, c, c - 22, 0, Math.PI * 2);
    ctx.stroke();

    // Zone arcs, mapped to 560..650 mK.
    const angleFor = (temp: number) => -2.28 + ((temp - 560) / 90) * 4.56;
    const arc = (from: number, to: number, color: string) => {
      ctx.beginPath();
      ctx.arc(c, c, c - 52, angleFor(from) - Math.PI / 2, angleFor(to) - Math.PI / 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.stroke();
    };
    arc(560, 600, "rgba(90,216,255,0.72)");
    arc(600, 610, "rgba(99,240,183,0.9)");
    arc(610, 650, "rgba(255,161,92,0.78)");

    ctx.lineCap = "butt";
    for (let i = 0; i <= 44; i++) {
      const angle = -2.28 + (i / 44) * 4.56;
      const major = i % 6 === 0;
      const inner = c - (major ? 34 : 28);
      const outer = c - 20;
      ctx.beginPath();
      ctx.moveTo(c + Math.sin(angle) * inner, c - Math.cos(angle) * inner);
      ctx.lineTo(c + Math.sin(angle) * outer, c - Math.cos(angle) * outer);
      ctx.strokeStyle = major ? "rgba(235,255,247,0.8)" : "rgba(235,255,247,0.28)";
      ctx.lineWidth = major ? 3 : 1.4;
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(235,255,247,0.86)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 19px Consolas, monospace";
    ctx.fillText("600", c + Math.sin(angleFor(600)) * (c - 76), c - Math.cos(angleFor(600)) * (c - 76));
    ctx.fillText("610", c + Math.sin(angleFor(610)) * (c - 76), c - Math.cos(angleFor(610)) * (c - 76));
    ctx.font = "500 17px Consolas, monospace";
    ctx.fillStyle = "rgba(235,255,247,0.48)";
    ctx.fillText("CRUCIBLE", c, c - 44);
    ctx.fillText("mK", c, c + 58);
    ctx.fillText("575", c - 104, c + 72);
    ctx.fillText("635", c + 104, c + 72);
  });
}

function createPlaqueTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(512, (ctx, size) => {
    ctx.fillStyle = "#0a181a";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#c07b4b";
    ctx.lineWidth = 5;
    ctx.strokeRect(16, 16, size - 32, size - 32);
    ctx.strokeStyle = "rgba(196,244,224,0.25)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, 28, size - 56, size - 56);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e9fff6";
    ctx.font = "700 52px Consolas, monospace";
    ctx.fillText("STRAIN #1", size / 2, size / 2 - 18);
    ctx.fillStyle = "#9dd9c3";
    ctx.font = "500 26px Consolas, monospace";
    ctx.fillText("s-1.snacc-v001.testnet", size / 2, size / 2 + 34);
    ctx.fillStyle = "#c07b4b";
    ctx.font = "600 22px Consolas, monospace";
    ctx.fillText("TESTNET", size / 2, size / 2 + 82);
  });
}

export class CrucibleScene3D {
  private readonly container: HTMLElement;
  private readonly callbacks: CrucibleSceneCallbacks;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly root: THREE.Group;
  private readonly clock = new THREE.Clock();
  private readonly toonGradient: THREE.DataTexture;
  private readonly outlineMaterial: THREE.LineBasicMaterial;
  private readonly glowTexture: THREE.CanvasTexture;
  private readonly dotTexture: THREE.CanvasTexture;
  private readonly fog: THREE.FogExp2;
  private readonly motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private readonly onMotionChange = () => {
    this.reducedMotion = this.motionQuery.matches;
  };

  private renderer: THREE.WebGLRenderer | null = null;
  private rafId = 0;
  private paused = false;
  private hidden = false;
  private reducedMotion = prefersReducedMotion();
  private theme: ThemeMode = "bioluminescent";
  private skin: SkinMode = "biolab";
  private currentZone: MacroZone = "Goldilocks";
  private crucibleTemp = 605;
  private vitalityRatio = 0.85;
  private liquidated = false;
  private time = 0;

  // Camera state.
  private azimuth = Math.PI * 0.24;
  private targetAzimuth = Math.PI * 0.24;
  private polar = 0.95;
  private targetPolar = 0.95;
  private zoom = 1;
  private targetZoom = 1;
  private portrait = false;
  private baseWidth = 18.5;
  private readonly radius = 30;
  private readonly cameraTarget = new THREE.Vector3(0, 1, 0);
  private lastInteractionAt = performance.now();

  // Pointer state.
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private dragging = false;
  private dragMoved = 0;
  private dragStartAt = 0;
  private prevPointer = { x: 0, y: 0 };
  private pinchStart = 0;
  private pinchZoomStart = 1;
  private lastHoverCheck = 0;
  private readonly colorEntries: ColorEntry[] = [];

  // Built objects.
  private lights!: LightRig;
  private jarGlassMat!: THREE.ShaderMaterial;
  private cellMat!: THREE.ShaderMaterial;
  private cellMesh!: THREE.Mesh;
  private nucleusMesh!: THREE.Mesh;
  private organelleGroup!: THREE.Group;
  private readonly mitoMeshes: THREE.Mesh[] = [];
  private readonly lisoMeshes: THREE.Mesh[] = [];
  private readonly orbitRings: THREE.Mesh[] = [];
  private liquidMesh!: THREE.Mesh;
  private liquidSurface!: THREE.Mesh;
  private readonly ripples: THREE.Mesh[] = [];
  private readonly bubbles: Bubble[] = [];
  private bellPivot!: THREE.Group;
  private bellClapper!: THREE.Mesh;
  private bellGlow!: THREE.Sprite;
  private dialNeedle!: THREE.Group;
  private dialGroup!: THREE.Group;
  private tubeLiquid!: THREE.Mesh;
  private readonly spores: FloatingSpore[] = [];
  private motes!: THREE.Points;
  private readonly moteData: MoteDatum[] = [];
  private readonly interactiveRoots: THREE.Object3D[] = [];
  private readonly outlineLines: THREE.LineSegments[] = [];
  private readonly topRings: THREE.Mesh[] = [];
  private readonly glowSprites: THREE.Sprite[] = [];
  private readonly crystals: THREE.Mesh[] = [];
  private readonly floatingRocks: THREE.Mesh[] = [];
  private readonly shockwaves: Shockwave[] = [];
  private burstPoints!: THREE.Points;
  private burstVelocities = new Float32Array(0);
  private burstAge = 0;
  private burstActive = false;
  private burstPulse = 0;
  private bellKick = 0;
  private zonePulse = 0;
  private currentDialAngle = 0;
  private targetDialAngle = 0;
  private currentLiquid = 0.34;
  private targetLiquid = 0.34;
  private currentMitoScale = 1;
  private currentLisoScale = 1;
  private currentNucleusScale = 1;
  private targetMitoScale = 1;
  private targetLisoScale = 1;
  private targetNucleusScale = 1;
  private quality: "high" | "medium" | "low" = "high";
  private sampleFrames = 0;
  private sampleSeconds = 0;
  private sampled = false;

  private readonly onResize = () => this.handleResize();
  private readonly onVisibility = () => {
    this.hidden = document.hidden;
    if (!this.hidden) this.clock.getDelta();
  };
  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerUp = (event: PointerEvent) => this.handlePointerUp(event);
  private readonly onPointerCancel = (event: PointerEvent) => this.handlePointerUp(event);
  private readonly onPointerLeave = () => {
    this.callbacks.onHoverChange?.(null);
    this.container.classList.remove("is-hovering");
  };
  private readonly onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom - event.deltaY * 0.0012, 0.8, 1.55);
    this.lastInteractionAt = performance.now();
  };

  constructor(container: HTMLElement, callbacks: CrucibleSceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x061014, 0.012);
    this.scene.fog = this.fog;
    this.camera = new THREE.OrthographicCamera(-9, 9, 6, -6, 0.1, 90);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.toonGradient = createToonGradient();
    this.outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x031116,
      transparent: true,
      opacity: 0.9,
    });
    this.glowTexture = createGlowTexture();
    this.dotTexture = createDotTexture();
    this.registerColor(this.outlineMaterial.color, "outline");
    this.registerColor(this.fog.color, "fog");

    this.buildLights();
    this.buildIsland();
    this.buildCrucible();
    this.buildBell();
    this.buildThermostat();
    this.buildPipes();
    this.buildProps();
    this.buildSpores();
    this.buildMotes();
    this.buildBurst();

    this.applyPalette(true);
    this.initWebGL();
    this.bindInteractions();
    this.updateCamera(0, true);
    this.startLoop();
  }

  private registerColor(color: THREE.Color, role: PaletteRole): void {
    this.colorEntries.push({ color, target: color.clone(), role });
  }

  private toonMaterial(hex: number, options: Partial<THREE.MeshToonMaterialParameters> = {}): THREE.MeshToonMaterial {
    const material = new THREE.MeshToonMaterial({
      color: hex,
      gradientMap: this.toonGradient,
      ...options,
    });
    return material;
  }

  private addOutline(mesh: THREE.Mesh, threshold = 32): THREE.LineSegments {
    const edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
    const line = new THREE.LineSegments(edges, this.outlineMaterial);
    line.renderOrder = 4;
    mesh.add(line);
    this.outlineLines.push(line);
    return line;
  }

  private makeRod(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, length, 10), material);
    mesh.position.copy(from).addScaledVector(direction, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  private makePipe(points: THREE.Vector3[], radius: number, material: THREE.Material): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 56, radius, 8, false);
    return new THREE.Mesh(geometry, material);
  }

  private makeGlow(
    hex: number,
    role: PaletteRole,
    scale: number,
    opacity: number,
    position: THREE.Vector3,
  ): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: hex,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.registerColor(material.color, role);
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.setScalar(scale);
    sprite.userData.baseScale = scale;
    sprite.userData.baseOpacity = opacity;
    this.glowSprites.push(sprite);
    return sprite;
  }

  private makeLabel(texture: THREE.Texture, width: number, height: number): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  }

  private buildLights(): void {
    const ambient = new THREE.HemisphereLight(0x3b6268, 0x081216, 1.25);
    const key = new THREE.DirectionalLight(0xfff2dc, 2.4);
    key.position.set(7, 12, 8);
    const rim = new THREE.PointLight(0x63f0b7, 42, 28, 2);
    rim.position.set(-5.5, 4.2, 4.5);
    const fill = new THREE.PointLight(0xffcf7a, 24, 20, 2);
    fill.position.set(5, 2.6, -5);
    const cell = new THREE.PointLight(0x63f0b7, 14, 9, 2);
    cell.position.set(0, 2.1, 0);
    this.lights = { ambient, key, rim, fill, cell };
    this.scene.add(ambient, key, rim, fill, cell);
    this.registerColor(ambient.color, "ambient");
    this.registerColor(ambient.groundColor, "stoneDeep");
    this.registerColor(key.color, "key");
    this.registerColor(rim.color, "rim");
    this.registerColor(fill.color, "accentAlt");
    this.registerColor(cell.color, "cellRim");
  }

  private buildIsland(): void {
    const island = new THREE.Group();
    this.root.add(island);

    const topMaterial = this.toonMaterial(0x244541, { map: createIslandTexture() });
    this.registerColor(topMaterial.color, "stoneTop");
    const top = new THREE.Mesh(new THREE.CylinderGeometry(4.35, 4.25, 0.24, 64), topMaterial);
    top.position.y = -0.12;
    this.addOutline(top, 45);
    island.add(top);

    const rimMaterial = this.toonMaterial(0x0c1a1e);
    this.registerColor(rimMaterial.color, "darkMetal");
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(4.42, 4.42, 0.12, 64), rimMaterial);
    rim.position.y = -0.28;
    island.add(rim);

    const sideMaterial = this.toonMaterial(0x173230);
    this.registerColor(sideMaterial.color, "stoneSide");
    const side = new THREE.Mesh(new THREE.CylinderGeometry(4.32, 3.55, 0.7, 48, 2), sideMaterial);
    side.position.y = -0.66;
    island.add(side);

    const deepMaterial = this.toonMaterial(0x0a1d22);
    this.registerColor(deepMaterial.color, "stoneDeep");

    const underGeometry = new THREE.CylinderGeometry(3.55, 0.55, 2.55, 18, 5);
    const underPosition = underGeometry.attributes.position;
    if (underPosition) {
      for (let i = 0; i < underPosition.count; i++) {
        const x = underPosition.getX(i);
        const y = underPosition.getY(i);
        const z = underPosition.getZ(i);
        const t = (y + 1.275) / 2.55;
        const wobble = Math.sin(x * 1.7 + z * 2.1 + y * 3.4) * 0.22 + Math.cos(z * 2.6 - y * 2.2) * 0.16;
        underPosition.setX(i, x * (1 + wobble * (1 - t) * 0.9));
        underPosition.setZ(i, z * (1 + wobble * (1 - t) * 0.9));
        underPosition.setY(i, y + Math.sin(x * 1.2 + z * 1.6) * 0.13);
      }
      underGeometry.computeVertexNormals();
    }
    const under = new THREE.Mesh(underGeometry, deepMaterial);
    under.position.y = -2.25;
    this.addOutline(under, 22);
    island.add(under);

    // Machine rings inlaid into the top surface.
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x63f0b7,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.registerColor(ringMaterial.color, "accent");
    for (const [inner, outer, opacity] of [
      [3.62, 3.66, 0.22],
      [2.86, 2.9, 0.16],
      [1.84, 1.87, 0.24],
    ] as const) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128), ringMaterial.clone());
      (ring.material as THREE.MeshBasicMaterial).opacity = opacity;
      this.registerColor((ring.material as THREE.MeshBasicMaterial).color, "accent");
      ring.userData.baseOpacity = opacity;
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.012;
      island.add(ring);
      this.topRings.push(ring);
    }

    const seamMaterial = this.toonMaterial(0x0a1d22, { transparent: true, opacity: 0.55 });
    this.registerColor(seamMaterial.color, "darkMetal");
    for (let i = 0; i < 8; i++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.014, 0.022), seamMaterial);
      seam.position.y = 0.016;
      seam.rotation.y = (i / 8) * Math.PI;
      island.add(seam);
    }

    // Rivets around the copper-dark rim.
    const rivetGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 8);
    const rivetMaterial = this.toonMaterial(0xc07b4b);
    this.registerColor(rivetMaterial.color, "copper");
    const rivets = new THREE.InstancedMesh(rivetGeometry, rivetMaterial, 28);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      matrix.makeRotationY(angle);
      matrix.setPosition(Math.cos(angle) * 4.4, -0.2, Math.sin(angle) * 4.4);
      rivets.setMatrixAt(i, matrix);
    }
    rivets.instanceMatrix.needsUpdate = true;
    island.add(rivets);

    // Moss patches, mushrooms, crystals.
    const mossMaterial = this.toonMaterial(0x2f6b52);
    this.registerColor(mossMaterial.color, "moss");
    const mushroomStemMaterial = this.toonMaterial(0xd7c6a0);
    this.registerColor(mushroomStemMaterial.color, "glass");
    const mushroomCapMaterial = this.toonMaterial(0x63f0b7, {
      emissive: 0x2f8f6c,
      emissiveIntensity: 0.7,
    });
    this.registerColor(mushroomCapMaterial.color, "mushroom");
    this.registerColor(mushroomCapMaterial.emissive, "mushroom");
    const crystalMaterial = this.toonMaterial(0xffcf7a, {
      emissive: 0x9a6a25,
      emissiveIntensity: 0.55,
    });
    this.registerColor(crystalMaterial.color, "crystal");
    this.registerColor(crystalMaterial.emissive, "crystal");

    let seed = 20261109;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const mossGeometry = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 11; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 3.05 + random() * 0.9;
      const moss = new THREE.Mesh(mossGeometry, mossMaterial);
      moss.position.set(Math.cos(angle) * radius, 0.02 + random() * 0.04, Math.sin(angle) * radius);
      moss.scale.set(0.35 + random() * 0.55, 0.05 + random() * 0.05, 0.26 + random() * 0.42);
      moss.rotation.y = random() * Math.PI;
      island.add(moss);
    }

    const stemGeometry = new THREE.CylinderGeometry(0.026, 0.042, 0.2, 6);
    const capGeometry = new THREE.SphereGeometry(0.12, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5);
    for (let cluster = 0; cluster < 7; cluster++) {
      const angle = (cluster / 7) * Math.PI * 2 + 0.35;
      const radius = 3.25 + random() * 0.62;
      const base = new THREE.Vector3(Math.cos(angle) * radius, 0.03, Math.sin(angle) * radius);
      const count = 2 + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const mushroom = new THREE.Group();
        const scale = 0.72 + random() * 0.7;
        const stem = new THREE.Mesh(stemGeometry, mushroomStemMaterial);
        stem.position.y = 0.1;
        const cap = new THREE.Mesh(capGeometry, mushroomCapMaterial);
        cap.position.y = 0.21;
        cap.scale.set(1, 0.62, 1);
        mushroom.add(stem, cap);
        mushroom.position.set(base.x + (random() - 0.5) * 0.28, base.y, base.z + (random() - 0.5) * 0.28);
        mushroom.scale.setScalar(scale);
        mushroom.rotation.y = random() * Math.PI;
        island.add(mushroom);
      }
    }

    const crystalGeometry = new THREE.OctahedronGeometry(0.15, 0);
    for (let i = 0; i < 8; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 3.15 + random() * 0.85;
      const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
      crystal.position.set(Math.cos(angle) * radius, 0.12, Math.sin(angle) * radius);
      crystal.scale.set(0.55 + random() * 0.8, 1.1 + random() * 1.5, 0.55 + random() * 0.8);
      crystal.rotation.set(random() * 0.8, random() * Math.PI, random() * 0.7);
      crystal.userData.baseScale = crystal.scale.clone();
      crystal.userData.phase = random() * Math.PI * 2;
      island.add(crystal);
      this.crystals.push(crystal);
    }

    const plaque = this.makeLabel(createPlaqueTexture(), 1.38, 0.44);
    plaque.position.set(0, 0.48, 4.08);
    plaque.rotation.y = Math.PI * 0.24;
    plaque.rotation.x = -0.12;
    island.add(plaque);

    const underGlow = this.makeGlow(0x63f0b7, "accent", 12, 0.2, new THREE.Vector3(0, -4.2, 0));
    underGlow.material.rotation = Math.PI;
    this.root.add(underGlow);
  }

  private buildCrucible(): void {
    const group = new THREE.Group();
    this.root.add(group);

    const pedestalMaterial = this.toonMaterial(0x75482d);
    this.registerColor(pedestalMaterial.color, "copperDark");
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.95, 0.34, 48), pedestalMaterial);
    pedestal.position.y = 0.17;
    this.addOutline(pedestal, 40);
    group.add(pedestal);

    const insetMaterial = this.toonMaterial(0x0c1a1e);
    this.registerColor(insetMaterial.color, "darkMetal");
    const inset = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.52, 0.1, 48), insetMaterial);
    inset.position.y = 0.38;
    group.add(inset);

    const brassMaterial = this.toonMaterial(0xc07b4b);
    this.registerColor(brassMaterial.color, "copper");
    const collar = new THREE.Mesh(new THREE.TorusGeometry(1.46, 0.06, 8, 64), brassMaterial);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.42;
    group.add(collar);

    // Glass bell jar, built as a lathe profile.
    const profile = [
      new THREE.Vector2(0.06, 0.0),
      new THREE.Vector2(1.28, 0.0),
      new THREE.Vector2(1.46, 0.16),
      new THREE.Vector2(1.5, 0.5),
      new THREE.Vector2(1.4, 0.82),
      new THREE.Vector2(1.3, 1.75),
      new THREE.Vector2(1.25, 2.5),
      new THREE.Vector2(1.07, 2.86),
      new THREE.Vector2(0.66, 3.05),
      new THREE.Vector2(0.28, 3.1),
      new THREE.Vector2(0.06, 3.11),
    ];
    this.jarGlassMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTint: { value: new THREE.Color(0xbfffe9) },
        uEdge: { value: new THREE.Color(0x63f0b7) },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vView = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTint;
        uniform vec3 uEdge;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec2 vUv;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vView);
          float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.15);
          float band = smoothstep(0.9, 1.0, sin(vUv.y * 58.0 - uTime * 1.1) * 0.5 + 0.5) * 0.07;
          float top = smoothstep(0.8, 1.0, vUv.y) * 0.09;
          vec3 color = mix(uTint, uEdge, fresnel * 0.9 + top * 2.0);
          float alpha = 0.075 + fresnel * 0.34 + band + top;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.5));
        }
      `,
    });
    this.registerColor(this.jarGlassMat.uniforms.uTint!.value as THREE.Color, "glass");
    this.registerColor(this.jarGlassMat.uniforms.uEdge!.value as THREE.Color, "accent");
    const jar = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), this.jarGlassMat);
    jar.position.y = 0.42;
    group.add(jar);

    const topKnob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), brassMaterial);
    topKnob.position.y = 3.62;
    group.add(topKnob);
    const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 24), brassMaterial);
    neckRing.rotation.x = Math.PI / 2;
    neckRing.position.y = 3.42;
    group.add(neckRing);

    // Liquid pool and its surface.
    const liquidMaterial = this.toonMaterial(0x63f0b7, {
      emissive: 0x1c8a67,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.92,
    });
    this.registerColor(liquidMaterial.color, "liquid");
    this.registerColor(liquidMaterial.emissive, "liquid");
    this.liquidMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.24, 0.76, 40), liquidMaterial);
    this.liquidMesh.position.y = 0.78;
    group.add(this.liquidMesh);

    const surfaceMaterial = new THREE.MeshBasicMaterial({
      color: 0x63f0b7,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.registerColor(surfaceMaterial.color, "accent");
    this.liquidSurface = new THREE.Mesh(new THREE.CircleGeometry(1.19, 48), surfaceMaterial);
    this.liquidSurface.rotation.x = -Math.PI / 2;
    this.liquidSurface.position.y = 1.16;
    group.add(this.liquidSurface);

    const rippleMaterial = new THREE.MeshBasicMaterial({
      color: 0x63f0b7,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.registerColor(rippleMaterial.color, "accent");
    for (let i = 0; i < 3; i++) {
      const ripple = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.34, 48), rippleMaterial.clone());
      this.registerColor((ripple.material as THREE.MeshBasicMaterial).color, "accent");
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.y = 1.18;
      ripple.userData.phase = i * 0.33;
      group.add(ripple);
      this.ripples.push(ripple);
    }

    const bubbleGeometry = new THREE.SphereGeometry(0.03, 6, 5);
    const bubbleMaterial = new THREE.MeshBasicMaterial({
      color: 0xd8fff0,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.registerColor(bubbleMaterial.color, "glass");
    let bubbleSeed = 8128;
    const bubbleRandom = () => {
      bubbleSeed = (bubbleSeed * 1664525 + 1013904223) % 4294967296;
      return bubbleSeed / 4294967296;
    };
    for (let i = 0; i < 12; i++) {
      const angle = bubbleRandom() * Math.PI * 2;
      const radius = 0.25 + bubbleRandom() * 0.75;
      const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
      bubble.position.set(Math.cos(angle) * radius, 0.48 + bubbleRandom() * 0.7, Math.sin(angle) * radius);
      bubble.userData.baseX = bubble.position.x;
      bubble.userData.baseZ = bubble.position.z;
      const baseScale = 0.55 + bubbleRandom() * 0.85;
      bubble.scale.setScalar(baseScale);
      group.add(bubble);
      this.bubbles.push({
        mesh: bubble,
        speed: 0.08 + bubbleRandom() * 0.2,
        offset: bubbleRandom() * Math.PI * 2,
        baseScale,
      });
    }

    // Living cell with a soft organic shader.
    this.cellMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uTemp: { value: 0.5 },
        uVitality: { value: 0.85 },
        uBurst: { value: 0 },
        uCore: { value: new THREE.Color(0x1c8a67) },
        uRim: { value: new THREE.Color(0x63f0b7) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uTemp;
        uniform float uBurst;
        varying vec3 vNormal;
        varying vec3 vView;
        varying float vDisplacement;
        float bioWave(vec3 p, float t) {
          float w1 = sin(p.x * 2.6 + t * 1.7) * cos(p.y * 2.3 - t * 1.4) * sin(p.z * 2.8 + t * 1.2);
          float w2 = sin(p.x * 5.1 - t * 2.4) * sin(p.y * 4.7 + t * 2.0) * 0.32;
          float w3 = cos(length(p.xy) * 6.2 - t * 3.1) * 0.16;
          return w1 + w2 + w3;
        }
        void main() {
          vNormal = normalize(normalMatrix * normal);
          float speed = mix(0.6, 2.2, uTemp);
          float amp = mix(0.04, 0.12, uTemp) + uBurst * 0.12;
          float wave = bioWave(position, uTime * speed);
          float heartbeat = sin(uTime * mix(2.2, 6.2, uTemp)) * 0.03;
          vDisplacement = wave * amp + heartbeat;
          vec3 displaced = position + normal * vDisplacement;
          vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
          vView = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore;
        uniform vec3 uRim;
        uniform float uVitality;
        uniform float uBurst;
        varying vec3 vNormal;
        varying vec3 vView;
        varying float vDisplacement;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vView);
          float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.2);
          vec3 lightDir = normalize(vec3(0.55, 0.8, 0.45));
          float ndl = dot(normal, lightDir) * 0.5 + 0.5;
          float toon = smoothstep(0.3, 0.36, ndl) * 0.45 + smoothstep(0.64, 0.7, ndl) * 0.55;
          vec3 color = mix(uCore * 0.55, uCore * 1.2, toon);
          color += uRim * (vDisplacement * 1.8 + uBurst * 0.35);
          color = mix(color, uRim, fresnel * 0.82);
          float alpha = clamp(0.44 + fresnel * 0.34 + uBurst * 0.15 + uVitality * 0.06, 0.3, 0.94);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    this.registerColor(this.cellMat.uniforms.uCore!.value as THREE.Color, "cellCore");
    this.registerColor(this.cellMat.uniforms.uRim!.value as THREE.Color, "cellRim");
    this.cellMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 5), this.cellMat);
    this.cellMesh.position.y = 1.85;
    group.add(this.cellMesh);

    const nucleusMaterial = this.toonMaterial(0x63f0b7, {
      emissive: 0x2fa47a,
      emissiveIntensity: 0.95,
    });
    this.registerColor(nucleusMaterial.color, "cellRim");
    this.registerColor(nucleusMaterial.emissive, "cellCore");
    this.nucleusMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 2), nucleusMaterial);
    this.nucleusMesh.position.y = 1.85;
    group.add(this.nucleusMesh);

    const nucleusWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.29, 1)),
      new THREE.LineBasicMaterial({ color: 0xd8fff0, transparent: true, opacity: 0.52 }),
    );
    this.registerColor(nucleusWire.material.color, "glass");
    this.nucleusMesh.add(nucleusWire);

    this.organelleGroup = new THREE.Group();
    this.organelleGroup.position.y = 1.85;
    group.add(this.organelleGroup);

    const mitoMaterial = this.toonMaterial(0xffcf7a, {
      emissive: 0x9a641c,
      emissiveIntensity: 0.55,
    });
    this.registerColor(mitoMaterial.color, "accentAlt");
    this.registerColor(mitoMaterial.emissive, "accentAlt");
    const lisoMaterial = this.toonMaterial(0x5ad8ff, {
      emissive: 0x1c6f9a,
      emissiveIntensity: 0.55,
    });
    this.registerColor(lisoMaterial.color, "crystal");
    this.registerColor(lisoMaterial.emissive, "crystal");

    const mitoGeometry = new THREE.CapsuleGeometry(0.055, 0.17, 5, 10);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const mito = new THREE.Mesh(mitoGeometry, mitoMaterial);
      mito.position.set(Math.cos(angle) * 1.08, Math.sin(angle * 2) * 0.18, Math.sin(angle) * 1.08);
      mito.rotation.set(angle, angle * 0.5, 0);
      this.organelleGroup.add(mito);
      this.mitoMeshes.push(mito);
    }
    const lisoGeometry = new THREE.OctahedronGeometry(0.09, 0);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.5;
      const liso = new THREE.Mesh(lisoGeometry, lisoMaterial);
      liso.position.set(Math.cos(angle) * 1.2, -Math.sin(angle * 2) * 0.22, Math.sin(angle) * 1.2);
      this.organelleGroup.add(liso);
      this.lisoMeshes.push(liso);
    }

    const orbitMaterial = new THREE.MeshBasicMaterial({
      color: 0x63f0b7,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.registerColor(orbitMaterial.color, "accent");
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.94 + i * 0.16, 0.008, 5, 64), orbitMaterial.clone());
      this.registerColor((ring.material as THREE.MeshBasicMaterial).color, "accent");
      ring.position.y = 1.85;
      ring.rotation.set(Math.PI * (0.32 + i * 0.22), Math.PI * (0.16 + i * 0.3), 0);
      group.add(ring);
      this.orbitRings.push(ring);
    }

    const cellGlow = this.makeGlow(0x63f0b7, "cellRim", 3.2, 0.5, new THREE.Vector3(0, 1.85, 0.1));
    group.add(cellGlow);

    // Invisible hit volume around the cell.
    const cellHit = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    cellHit.position.y = 1.85;
    cellHit.userData.interactive = {
      kind: "cell",
      label: "Strain #1",
      hint: "Feed the living cell",
    } satisfies InteractiveData;
    group.add(cellHit);
    this.interactiveRoots.push(cellHit);
  }

  private buildBell(): void {
    const group = new THREE.Group();
    group.position.set(2.72, 0, 0.36);
    this.root.add(group);

    const baseMaterial = this.toonMaterial(0x75482d);
    this.registerColor(baseMaterial.color, "copperDark");
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.04, 0.26, 32), baseMaterial);
    base.position.y = 0.13;
    this.addOutline(base, 40);
    group.add(base);

    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.98, 0.7, 0.28, 32),
      this.toonMaterial(0x0c1a1e),
    );
    this.registerColor((basin.material as THREE.MeshToonMaterial).color, "darkMetal");
    basin.position.y = 0.4;
    group.add(basin);

    const basinLiquid = new THREE.Mesh(
      new THREE.CircleGeometry(0.78, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffcf7a,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.registerColor((basinLiquid.material as THREE.MeshBasicMaterial).color, "accentAlt");
    basinLiquid.rotation.x = -Math.PI / 2;
    basinLiquid.position.y = 0.56;
    group.add(basinLiquid);

    const copperMaterial = this.toonMaterial(0xc07b4b);
    this.registerColor(copperMaterial.color, "copper");
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.95, 10), copperMaterial);
    pillar.position.set(0.62, 1.48, 0);
    group.add(pillar);
    const pillarFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.18, 12), copperMaterial);
    pillarFoot.position.set(0.62, 0.53, 0);
    group.add(pillarFoot);

    const arm = this.makePipe(
      [
        new THREE.Vector3(0.62, 2.55, 0),
        new THREE.Vector3(0.66, 2.92, 0),
        new THREE.Vector3(0.42, 3.08, 0),
        new THREE.Vector3(0.12, 3.03, 0),
        new THREE.Vector3(-0.08, 2.86, 0),
        new THREE.Vector3(-0.12, 2.72, 0),
      ],
      0.055,
      copperMaterial,
    );
    group.add(arm);

    const brace = this.makeRod(
      new THREE.Vector3(0.62, 1.95, 0),
      new THREE.Vector3(0.12, 3.0, 0),
      0.028,
      copperMaterial,
    );
    group.add(brace);

    this.bellPivot = new THREE.Group();
    this.bellPivot.position.set(-0.12, 2.72, 0);
    group.add(this.bellPivot);

    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 18), copperMaterial);
    hook.position.y = -0.05;
    this.bellPivot.add(hook);

    const bellProfile = [
      new THREE.Vector2(0.08, 1.12),
      new THREE.Vector2(0.13, 1.08),
      new THREE.Vector2(0.2, 0.98),
      new THREE.Vector2(0.28, 0.82),
      new THREE.Vector2(0.34, 0.62),
      new THREE.Vector2(0.42, 0.4),
      new THREE.Vector2(0.52, 0.18),
      new THREE.Vector2(0.66, 0.05),
      new THREE.Vector2(0.7, 0.0),
      new THREE.Vector2(0.58, 0.0),
    ];
    const bellMesh = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 48), copperMaterial);
    bellMesh.position.y = -1.62;
    this.addOutline(bellMesh, 28);
    this.bellPivot.add(bellMesh);

    const bellRim = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.045, 8, 48), copperMaterial);
    bellRim.rotation.x = Math.PI / 2;
    bellRim.position.y = -1.62;
    this.bellPivot.add(bellRim);

    const bandMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcf7a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.registerColor(bandMaterial.color, "accentAlt");
    for (const [radius, y] of [
      [0.43, -1.17],
      [0.57, -1.42],
    ] as const) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.01, 5, 48), bandMaterial.clone());
      this.registerColor((band.material as THREE.MeshBasicMaterial).color, "accentAlt");
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      this.bellPivot.add(band);
    }

    const clapperMaterial = this.toonMaterial(0xffcf7a, {
      emissive: 0xd58a26,
      emissiveIntensity: 1.15,
    });
    this.registerColor(clapperMaterial.color, "accentAlt");
    this.registerColor(clapperMaterial.emissive, "accentAlt");
    this.bellClapper = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), clapperMaterial);
    this.bellClapper.position.y = -1.58;
    this.bellPivot.add(this.bellClapper);

    this.bellGlow = this.makeGlow(0xffcf7a, "accentAlt", 1.2, 0.5, new THREE.Vector3(0, 0.5, 0));
    group.add(this.bellGlow);

    const bellHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 2.1, 1.55),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    bellHit.position.set(-0.1, 1.65, 0);
    bellHit.userData.interactive = {
      kind: "bell",
      label: "Bell of Plenty",
      hint: "Ring it to trigger a nutrient burst",
    } satisfies InteractiveData;
    group.add(bellHit);
    this.interactiveRoots.push(bellHit);
  }

  private buildThermostat(): void {
    const group = new THREE.Group();
    group.position.set(-2.78, 0, 0.28);
    this.root.add(group);

    const baseMaterial = this.toonMaterial(0x75482d);
    this.registerColor(baseMaterial.color, "copperDark");
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.66, 0.24, 28), baseMaterial);
    base.position.y = 0.12;
    this.addOutline(base, 40);
    group.add(base);

    const copperMaterial = this.toonMaterial(0xc07b4b);
    this.registerColor(copperMaterial.color, "copper");
    const tubeGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 2.16, 24, 1, true),
      this.jarGlassMat.clone(),
    );
    this.registerColor((tubeGlass.material as THREE.ShaderMaterial).uniforms.uTint!.value as THREE.Color, "glass");
    this.registerColor((tubeGlass.material as THREE.ShaderMaterial).uniforms.uEdge!.value as THREE.Color, "accent");
    tubeGlass.position.y = 1.5;
    group.add(tubeGlass);

    const tubeLiquidMaterial = this.toonMaterial(0x63f0b7, {
      emissive: 0x1c8a67,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.9,
    });
    this.registerColor(tubeLiquidMaterial.color, "liquid");
    this.registerColor(tubeLiquidMaterial.emissive, "liquid");
    this.tubeLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.95, 16), tubeLiquidMaterial);
    this.tubeLiquid.position.y = 1.25;
    group.add(this.tubeLiquid);

    for (const y of [0.55, 1.55, 2.52]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.035, 6, 24), copperMaterial);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      group.add(band);
    }

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.14, 20), copperMaterial);
    cap.position.y = 2.62;
    group.add(cap);

    // Billboarded dial that always faces the camera.
    this.dialGroup = new THREE.Group();
    this.dialGroup.position.set(0, 2.68, 0.08);
    group.add(this.dialGroup);
    const dialFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.56, 48),
      new THREE.MeshBasicMaterial({ map: createDialTexture(), toneMapped: false }),
    );
    this.dialGroup.add(dialFace);
    const dialRim = new THREE.Mesh(new THREE.TorusGeometry(0.575, 0.035, 8, 48), copperMaterial);
    this.dialGroup.add(dialRim);
    this.dialNeedle = new THREE.Group();
    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.4, 0.018),
      new THREE.MeshBasicMaterial({ color: 0xe9fff6 }),
    );
    needle.position.y = 0.18;
    this.dialNeedle.add(needle);
    const needleTail = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.1, 0.014),
      new THREE.MeshBasicMaterial({ color: 0x63f0b7 }),
    );
    needleTail.position.y = -0.05;
    this.dialNeedle.add(needleTail);
    const needleCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xc07b4b }),
    );
    this.dialNeedle.add(needleCap);
    this.dialGroup.add(this.dialNeedle);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.52, 6), copperMaterial);
    antenna.position.y = 3.0;
    group.add(antenna);
    const antennaTip = this.makeGlow(0x63f0b7, "accent", 0.65, 0.7, new THREE.Vector3(0, 3.28, 0));
    group.add(antennaTip);

    const thermoHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 3.25, 1.15),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    thermoHit.position.y = 1.6;
    thermoHit.userData.interactive = {
      kind: "thermostat",
      label: "Crucible thermostat",
      hint: "Nudge the reactor to the next zone",
    } satisfies InteractiveData;
    group.add(thermoHit);
    this.interactiveRoots.push(thermoHit);
  }

  private buildPipes(): void {
    const copperMaterial = this.toonMaterial(0xc07b4b);
    this.registerColor(copperMaterial.color, "copper");
    const copperDarkMaterial = this.toonMaterial(0x75482d);
    this.registerColor(copperDarkMaterial.color, "copperDark");

    const rightPipe = this.makePipe(
      [
        new THREE.Vector3(2.0, 0.52, 0.42),
        new THREE.Vector3(1.82, 0.78, 0.52),
        new THREE.Vector3(1.7, 1.1, 0.46),
        new THREE.Vector3(1.5, 0.96, 0.3),
        new THREE.Vector3(1.34, 0.62, 0.18),
      ],
      0.065,
      copperMaterial,
    );
    this.root.add(rightPipe);
    const leftPipe = this.makePipe(
      [
        new THREE.Vector3(-2.12, 0.5, 0.36),
        new THREE.Vector3(-1.86, 0.74, 0.44),
        new THREE.Vector3(-1.72, 1.03, 0.38),
        new THREE.Vector3(-1.5, 0.9, 0.26),
        new THREE.Vector3(-1.34, 0.62, 0.16),
      ],
      0.065,
      copperMaterial,
    );
    this.root.add(leftPipe);

    for (const [x, y, z] of [
      [2.02, 0.5, 0.42],
      [1.35, 0.63, 0.18],
      [-2.12, 0.5, 0.36],
      [-1.35, 0.63, 0.16],
    ] as const) {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12), copperDarkMaterial);
      flange.position.set(x, y, z);
      flange.rotation.x = Math.PI / 2;
      this.root.add(flange);
    }

    // Small glowing flow lines above the copper.
    const flowMaterial = new THREE.MeshBasicMaterial({
      color: 0x63f0b7,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.registerColor(flowMaterial.color, "accent");
    const rightFlow = this.makePipe(
      [
        new THREE.Vector3(2.0, 0.63, 0.42),
        new THREE.Vector3(1.8, 0.86, 0.52),
        new THREE.Vector3(1.68, 1.17, 0.46),
        new THREE.Vector3(1.5, 1.03, 0.3),
        new THREE.Vector3(1.35, 0.7, 0.18),
      ],
      0.018,
      flowMaterial,
    );
    const leftFlow = this.makePipe(
      [
        new THREE.Vector3(-2.12, 0.61, 0.36),
        new THREE.Vector3(-1.86, 0.82, 0.44),
        new THREE.Vector3(-1.72, 1.1, 0.38),
        new THREE.Vector3(-1.5, 0.97, 0.26),
        new THREE.Vector3(-1.35, 0.7, 0.16),
      ],
      0.018,
      flowMaterial,
    );
    this.root.add(rightFlow, leftFlow);

    // A compact valve wheel on the right pipe.
    const valve = new THREE.Group();
    valve.position.set(1.86, 0.94, 0.52);
    valve.rotation.x = Math.PI / 2;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 6, 20), copperDarkMaterial);
    valve.add(wheel);
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.014, 0.014), copperDarkMaterial);
      spoke.rotation.z = (i / 3) * Math.PI;
      valve.add(spoke);
    }
    this.root.add(valve);
  }

  private buildProps(): void {
    const glassMaterial = new THREE.MeshToonMaterial({
      color: 0xe8fff8,
      gradientMap: this.toonGradient,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.registerColor(glassMaterial.color, "glass");
    const fluidMaterial = this.toonMaterial(0x63f0b7, {
      emissive: 0x2f8f6c,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.86,
    });
    this.registerColor(fluidMaterial.color, "accent");
    this.registerColor(fluidMaterial.emissive, "accent");

    for (let i = 0; i < 3; i++) {
      const flask = new THREE.Group();
      const angle = -0.55 + i * 0.26;
      flask.position.set(Math.cos(angle) * 3.35, 0.04, Math.sin(angle) * 3.35 + 0.55);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), glassMaterial);
      body.scale.y = 1.1;
      body.position.y = 0.14;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.18, 10), glassMaterial);
      neck.position.y = 0.34;
      const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), fluidMaterial);
      liquid.scale.y = 0.55;
      liquid.position.y = 0.09;
      flask.add(body, neck, liquid);
      this.root.add(flask);
    }

    const crateMaterial = this.toonMaterial(0x173230);
    this.registerColor(crateMaterial.color, "stoneSide");
    const bandMaterial = this.toonMaterial(0xc07b4b);
    this.registerColor(bandMaterial.color, "copper");
    for (const [x, z, rotation] of [
      [-3.15, -1.85, 0.25],
      [3.22, -1.72, -0.35],
    ] as const) {
      const crate = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.42), crateMaterial);
      box.position.y = 0.19;
      this.addOutline(box, 30);
      const bandA = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.045, 0.46), bandMaterial);
      bandA.position.y = 0.19;
      const bandB = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.46), bandMaterial);
      bandB.position.y = 0.19;
      crate.add(box, bandA, bandB);
      crate.position.set(x, 0.02, z);
      crate.rotation.y = rotation;
      this.root.add(crate);
    }

    const miniRockMaterial = this.toonMaterial(0x173230);
    this.registerColor(miniRockMaterial.color, "stoneSide");
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.4;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + (i % 3) * 0.08, 0), miniRockMaterial);
      rock.position.set(Math.cos(angle) * (4.9 + (i % 2) * 0.5), -1.0 + Math.sin(i * 1.7) * 0.55, Math.sin(angle) * 4.8);
      rock.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      rock.userData.baseY = rock.position.y;
      rock.userData.phase = i * 1.2;
      this.root.add(rock);
      this.floatingRocks.push(rock);
    }
  }

  private buildSpores(): void {
    const kinds: SporeKind[] = ["snacc", "ignis", "myco"];
    const shapeGeometry: Record<SporeKind, THREE.BufferGeometry> = {
      snacc: new THREE.OctahedronGeometry(0.13, 0),
      ignis: new THREE.TetrahedronGeometry(0.14, 0),
      myco: new THREE.IcosahedronGeometry(0.12, 0),
    };
    const shapeColor: Record<SporeKind, number> = {
      snacc: 0x63f0b7,
      ignis: 0xffcf7a,
      myco: 0x5ad8ff,
    };
    const role: Record<SporeKind, PaletteRole> = {
      snacc: "accent",
      ignis: "accentAlt",
      myco: "crystal",
    };

    let seed = 7719;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < 9; i++) {
      const kind = kinds[i % kinds.length]!;
      const material = this.toonMaterial(shapeColor[kind], {
        emissive: shapeColor[kind],
        emissiveIntensity: 0.65,
      });
      this.registerColor(material.color, role[kind]);
      this.registerColor(material.emissive, role[kind]);
      const shape = new THREE.Mesh(shapeGeometry[kind], material);
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: shapeColor[kind],
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      this.registerColor(halo.material.color, role[kind]);
      halo.scale.setScalar(0.58);
      const root = new THREE.Group();
      root.add(shape, halo);
      const spore: FloatingSpore = {
        root,
        shape,
        halo,
        kind,
        angle: (i / 9) * Math.PI * 2 + random() * 0.35,
        radius: 2.48 + (i % 3) * 0.38,
        height: 0.9 + (i % 5) * 0.48,
        speed: 0.2 + (i % 4) * 0.055,
        phase: random() * Math.PI * 2,
        spin: 0.6 + random() * 1.2,
        absorbing: false,
        absorbProgress: 0,
        respawnAt: 0,
      };
      root.traverse((child) => {
        child.userData.interactive = {
          kind: "spore",
          label: kind === "snacc" ? "Snacc spore" : kind === "ignis" ? "Ignis spore" : "Myco spore",
          hint: "Feed it to Strain #1",
          spore,
        } satisfies InteractiveData;
      });
      this.root.add(root);
      this.spores.push(spore);
    }
  }

  private buildMotes(): void {
    const count = 78;
    const positions = new Float32Array(count * 3);
    let seed = 99173;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 1.4 + random() * 5.4;
      const datum: MoteDatum = {
        baseX: Math.cos(angle) * radius,
        baseZ: Math.sin(angle) * radius,
        y: -0.5 + random() * 6.4,
        speed: 0.12 + random() * 0.3,
        phase: random() * Math.PI * 2,
        sway: 0.08 + random() * 0.2,
      };
      this.moteData.push(datum);
      positions[i * 3] = datum.baseX;
      positions[i * 3 + 1] = datum.y;
      positions[i * 3 + 2] = datum.baseZ;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xa9ffe4,
      size: 0.065,
      map: this.dotTexture,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.registerColor(material.color, "mote");
    this.motes = new THREE.Points(geometry, material);
    this.root.add(this.motes);
  }

  private buildBurst(): void {
    const count = 48;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x63f0b7,
      size: 0.11,
      map: this.dotTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.registerColor(material.color, "accent");
    this.burstPoints = new THREE.Points(geometry, material);
    this.burstPoints.visible = false;
    this.root.add(this.burstPoints);
    this.burstVelocities = new Float32Array(count * 3);
  }

  public isAvailable(): boolean {
    return this.renderer !== null;
  }

  private chooseDpr(): number {
    const raw = window.devicePixelRatio || 1;
    const cores = navigator.hardwareConcurrency || 8;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const cap = coarse || cores <= 4 ? 1.25 : 1.5;
    return Math.max(1, Math.min(raw, cap));
  }

  private initWebGL(): void {
    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(this.chooseDpr());
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.className = "stage__canvas";
      renderer.domElement.setAttribute("aria-hidden", "true");
      this.renderer = renderer;
      this.container.appendChild(renderer.domElement);
      this.handleResize();
    } catch {
      this.renderer = null;
    }
  }

  public handleResize(): void {
    if (!this.renderer) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / Math.max(1, height);
    this.portrait = aspect < 0.85;
    this.baseWidth = this.portrait ? 12.2 : aspect < 1.25 ? 15.5 : 18.5;
    const halfWidth = this.baseWidth / 2;
    const halfHeight = halfWidth / aspect;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.root.position.y = this.portrait ? 2.05 : 0;
    this.cameraTarget.set(0, 1.0, 0);
    this.renderer.setPixelRatio(this.quality === "high" ? this.chooseDpr() : 1);
    this.renderer.setSize(width, height, false);
  }

  private updateCamera(dt = 0, instant = false): void {
    if (!this.reducedMotion && !this.dragging && performance.now() - this.lastInteractionAt > 5200) {
      this.targetAzimuth += dt * 0.028;
    }
    const k = instant || this.reducedMotion ? 1 : 1 - Math.exp(-dt * 7.5);
    this.azimuth += (this.targetAzimuth - this.azimuth) * k;
    this.polar += (this.targetPolar - this.polar) * k;
    this.zoom += (this.targetZoom - this.zoom) * k;
    const sinPolar = Math.sin(this.polar);
    this.camera.position.set(
      this.cameraTarget.x + this.radius * sinPolar * Math.sin(this.azimuth),
      this.cameraTarget.y + this.radius * Math.cos(this.polar),
      this.cameraTarget.z + this.radius * sinPolar * Math.cos(this.azimuth),
    );
    this.camera.lookAt(this.cameraTarget);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
  }

  public resetCamera(): void {
    this.targetAzimuth = Math.PI * 0.24;
    this.targetPolar = 0.95;
    this.targetZoom = 1;
    this.lastInteractionAt = performance.now();
  }

  public setTheme(theme: ThemeMode): void {
    if (this.theme === theme) return;
    this.theme = theme;
    this.applyPalette(false);
  }

  public setTelemetryState(opts: {
    crucibleTemp: number;
    skin: SkinMode;
    vitalityRatio: number;
    organel: OrganelleAllocation;
    theme?: ThemeMode;
    isLiquidated?: boolean;
  }): void {
    if (opts.theme) this.theme = opts.theme;
    this.crucibleTemp = opts.crucibleTemp;
    this.skin = opts.skin;
    this.vitalityRatio = Math.max(0.05, Math.min(1, opts.vitalityRatio));
    const wasLiquidated = this.liquidated;
    this.liquidated = Boolean(opts.isLiquidated);

    const nextZone = classifyZone(opts.crucibleTemp);
    const zoneChanged = nextZone !== this.currentZone;
    this.currentZone = nextZone;

    this.targetDialAngle = THREE.MathUtils.clamp((opts.crucibleTemp - 605) * 0.032, -2.15, 2.15);
    this.targetLiquid = 0.27 + THREE.MathUtils.clamp((opts.crucibleTemp - 540) / 120, 0, 1) * 0.4;
    this.targetMitoScale = 0.85 + opts.organel.mitokondria * 0.22;
    this.targetLisoScale = 0.85 + opts.organel.lisosom * 0.22;
    this.targetNucleusScale = 0.88 + opts.organel.nukleus * 0.14;

    if (zoneChanged || wasLiquidated !== this.liquidated) {
      this.zonePulse = 1;
      this.spawnShockwave(0.16, 6.4, 1.25, 0.5);
      this.applyPalette(false);
    }
    if (this.cellMat) {
      this.cellMat.uniforms.uVitality!.value = this.vitalityRatio;
    }
  }

  private applyPalette(immediate: boolean): void {
    const palette = resolvePalette(this.theme, this.currentZone, this.skin);
    if (this.liquidated) {
      palette.accent = 0xff3b6b;
      palette.accentAlt = 0xff8a9d;
      palette.liquid = 0xff5d7d;
      palette.cellCore = 0x7d1233;
      palette.cellRim = 0xff6186;
      palette.mushroom = 0xff5d7d;
      palette.rim = 0xff3b6b;
    }

    for (const entry of this.colorEntries) {
      entry.target.setHex(palette[entry.role]);
      if (immediate) entry.color.copy(entry.target);
    }

    const dark = this.theme === "bioluminescent";
    this.fog.density = dark ? 0.012 : 0.009;
    this.lights.ambient.intensity = dark ? 1.25 : 1.6;
    this.lights.key.intensity = dark ? 2.4 : 2.8;
    this.lights.rim.intensity = dark ? 42 : 26;
    this.lights.fill.intensity = dark ? 24 : 16;
    this.lights.cell.intensity = dark ? 14 : 9;
    this.outlineMaterial.opacity = dark ? 0.9 : 0.5;
    if (this.renderer) {
      this.renderer.toneMappingExposure = dark ? 1.05 : 1.12;
    }
  }

  public setRenderPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) this.clock.getDelta();
  }

  public triggerNutrientBurstWave(): void {
    this.burstPulse = 1;
    this.bellKick = 1;
    this.zonePulse = 1;
    this.spawnShockwave(0.55, 5.8, 1.35, 0.9);
    this.spawnShockwave(1.85, 3.4, 1.1, 0.7);
    this.activateBurstParticles();
  }

  private spawnShockwave(y: number, growth: number, speed: number, strength: number): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0x63f0b7,
      transparent: true,
      opacity: strength,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.registerColor(material.color, "accent");
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.018, 6, 64), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    this.root.add(mesh);
    this.shockwaves.push({ mesh, progress: 0, speed, growth, strength });
  }

  private activateBurstParticles(): void {
    const position = this.burstPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 0.5 + Math.random() * 1.1;
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const y = 1.85 + Math.sin(phi) * Math.sin(theta) * radius;
      const z = Math.cos(phi) * radius;
      position.setXYZ(i, x, y, z);
      const speed = 1.25 + Math.random() * 1.8;
      this.burstVelocities[i * 3] = x * speed;
      this.burstVelocities[i * 3 + 1] = (y - 1.85) * speed + 0.55;
      this.burstVelocities[i * 3 + 2] = z * speed;
    }
    position.needsUpdate = true;
    this.burstAge = 0;
    this.burstActive = true;
    this.burstPoints.visible = true;
    (this.burstPoints.material as THREE.PointsMaterial).opacity = 0.95;
  }

  private bindInteractions(): void {
    this.container.addEventListener("pointerdown", this.onPointerDown);
    this.container.addEventListener("pointermove", this.onPointerMove);
    this.container.addEventListener("pointerup", this.onPointerUp);
    this.container.addEventListener("pointercancel", this.onPointerCancel);
    this.container.addEventListener("pointerleave", this.onPointerLeave);
    this.container.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.motionQuery.addEventListener("change", this.onMotionChange);
  }

  private pointerDistance(): number {
    const values = [...this.pointers.values()];
    if (values.length < 2) return 0;
    const first = values[0]!;
    const second = values[1]!;
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      this.container.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail when the pointer is already gone.
    }
    if (this.pointers.size === 1) {
      this.dragging = true;
      this.dragMoved = 0;
      this.dragStartAt = performance.now();
      this.prevPointer = { x: event.clientX, y: event.clientY };
      this.container.classList.add("is-dragging");
    } else if (this.pointers.size === 2) {
      this.dragging = false;
      this.pinchStart = this.pointerDistance();
      this.pinchZoomStart = this.targetZoom;
    }
    this.callbacks.onHoverChange?.(null);
    this.lastInteractionAt = performance.now();
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) {
      if (event.pointerType === "mouse") this.updateHover(event.clientX, event.clientY);
      return;
    }

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.lastInteractionAt = performance.now();

    if (this.pointers.size >= 2) {
      const distance = this.pointerDistance();
      if (this.pinchStart > 0 && distance > 0) {
        this.targetZoom = THREE.MathUtils.clamp(
          this.pinchZoomStart * (distance / this.pinchStart),
          0.8,
          1.55,
        );
      }
      return;
    }

    if (!this.dragging) return;
    const dx = event.clientX - this.prevPointer.x;
    const dy = event.clientY - this.prevPointer.y;
    this.dragMoved += Math.abs(dx) + Math.abs(dy);
    this.targetAzimuth -= dx * 0.0052;
    this.targetPolar = THREE.MathUtils.clamp(this.targetPolar - dy * 0.004, 0.52, 1.34);
    this.prevPointer = { x: event.clientX, y: event.clientY };
    if (this.dragMoved > 4) {
      this.callbacks.onHoverChange?.(null);
      this.container.classList.remove("is-hovering");
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    const wasSingle = this.pointers.size === 1;
    if (wasSingle && this.dragMoved < 8 && performance.now() - this.dragStartAt < 700) {
      this.activateAt(event.clientX, event.clientY);
    }
    this.pointers.delete(event.pointerId);
    try {
      this.container.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may already have released the pointer.
    }
    if (this.pointers.size === 0) {
      this.dragging = false;
      this.container.classList.remove("is-dragging");
    } else if (this.pointers.size === 1) {
      const remaining = [...this.pointers.values()][0]!;
      this.dragging = true;
      this.dragMoved = 99;
      this.prevPointer = { x: remaining.x, y: remaining.y };
    }
    this.lastInteractionAt = performance.now();
  }

  private pickInteractive(clientX: number, clientY: number): InteractiveData | null {
    if (!this.renderer) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactiveRoots, true);
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const interactive = node.userData.interactive as InteractiveData | undefined;
        if (interactive) {
          if (interactive.spore && (interactive.spore.absorbing || !interactive.spore.root.visible)) {
            break;
          }
          return interactive;
        }
        node = node.parent;
      }
    }
    return null;
  }

  private activateAt(clientX: number, clientY: number): void {
    const target = this.pickInteractive(clientX, clientY);
    if (!target) return;
    this.callbacks.onHoverChange?.(null);
    this.container.classList.remove("is-hovering");
    if (target.kind === "spore" && target.spore) {
      this.absorbSpore(target.spore);
      return;
    }
    if (target.kind === "bell") {
      this.bellKick = 1;
      this.callbacks.onBellActivated?.();
      return;
    }
    if (target.kind === "thermostat") {
      this.callbacks.onThermostatActivated?.();
      return;
    }
    this.burstPulse = Math.max(this.burstPulse, 0.4);
    this.callbacks.onCellActivated?.();
  }

  private updateHover(clientX: number, clientY: number): void {
    const now = performance.now();
    if (now - this.lastHoverCheck < 70) return;
    this.lastHoverCheck = now;
    const target = this.pickInteractive(clientX, clientY);
    if (!target) {
      this.container.classList.remove("is-hovering");
      this.callbacks.onHoverChange?.(null);
      return;
    }
    this.container.classList.add("is-hovering");
    this.callbacks.onHoverChange?.({
      label: target.label,
      hint: target.hint,
      x: clientX,
      y: clientY,
    });
  }

  private absorbSpore(spore: FloatingSpore): void {
    if (spore.absorbing) return;
    spore.absorbing = true;
    spore.absorbProgress = 0;
    const bonusTempMk = spore.kind === "ignis" ? 9 : spore.kind === "snacc" ? 6 : 4;
    this.callbacks.onSporeHarvested(spore.kind, bonusTempMk);
  }

  private startLoop(): void {
    this.clock.start();
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.tick();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.paused || this.hidden) return;
    this.time += dt;
    this.updateColors(dt);
    this.animate(dt);
    this.updateCamera(dt);
    this.sampleQuality(dt);
    this.renderer?.render(this.scene, this.camera);
  }

  private sampleQuality(dt: number): void {
    if (this.sampled) return;
    this.sampleFrames++;
    this.sampleSeconds += dt;
    if (this.sampleSeconds < 2.4) return;

    const fps = this.sampleFrames / this.sampleSeconds;
    const rawDpr = window.devicePixelRatio || 1;
    this.sampleFrames = 0;
    this.sampleSeconds = 0;

    if (fps < 40 && this.quality === "high") {
      this.quality = "medium";
      this.renderer?.setPixelRatio(Math.min(1, rawDpr));
      this.handleResize();
    } else if (fps < 30 && this.quality === "medium") {
      this.quality = "low";
      this.sampled = true;
      this.motes.visible = false;
    } else {
      this.sampled = true;
    }
  }

  private updateColors(dt: number): void {
    const k = 1 - Math.exp(-dt * 2.4);
    for (const entry of this.colorEntries) {
      entry.color.lerp(entry.target, k);
    }
  }

  private animate(dt: number): void {
    const time = this.time;
    const motion = this.reducedMotion ? 0.4 : 1;
    const smooth = 1 - Math.exp(-dt * 5.2);
    const heat = THREE.MathUtils.clamp((this.crucibleTemp - 560) / 90, 0, 1);

    this.jarGlassMat.uniforms.uTime!.value = time * motion;
    if (this.cellMat) {
      this.cellMat.uniforms.uTime!.value = time * motion;
      this.cellMat.uniforms.uBurst!.value = this.burstPulse;
      this.cellMat.uniforms.uTemp!.value = heat;
    }

    this.burstPulse = Math.max(0, this.burstPulse - dt * 1.5);
    this.bellKick *= Math.exp(-dt * 1.9);
    this.zonePulse = Math.max(0, this.zonePulse - dt * 0.75);

    // Living cell, nucleus, and organelles.
    const heartbeat = Math.sin(time * (2.2 + this.vitalityRatio * 2.4)) * 0.035 * motion;
    const cellBase = 0.92 + this.vitalityRatio * 0.12;
    const cellY = 1.85 + Math.sin(time * 1.1) * 0.05 * motion;
    this.cellMesh.scale.setScalar(cellBase * (1 + heartbeat) * (1 + this.burstPulse * 0.08));
    this.cellMesh.position.y = cellY;
    this.nucleusMesh.position.y = cellY;
    this.nucleusMesh.rotation.y += dt * 0.4 * motion;
    this.nucleusMesh.scale.setScalar(this.currentNucleusScale);
    this.organelleGroup.position.y = cellY + Math.sin(time * 1.4 + 1.2) * 0.02 * motion;
    this.organelleGroup.rotation.y += dt * 0.35 * motion;
    this.organelleGroup.rotation.z = Math.sin(time * 0.7) * 0.06 * motion;

    this.currentMitoScale += (this.targetMitoScale - this.currentMitoScale) * smooth;
    this.currentLisoScale += (this.targetLisoScale - this.currentLisoScale) * smooth;
    this.currentNucleusScale += (this.targetNucleusScale - this.currentNucleusScale) * smooth;
    for (const mito of this.mitoMeshes) mito.scale.setScalar(this.currentMitoScale);
    for (const liso of this.lisoMeshes) liso.scale.setScalar(this.currentLisoScale);

    for (let i = 0; i < this.orbitRings.length; i++) {
      this.orbitRings[i]!.rotation.z += dt * (0.12 + i * 0.08) * motion;
    }

    // Liquid volume, surface ripples, rising bubbles.
    this.currentLiquid += (this.targetLiquid - this.currentLiquid) * smooth;
    const liquidRatio = this.currentLiquid / 0.34;
    const surfaceY = 0.4 + 0.76 * liquidRatio;
    this.liquidMesh.scale.y = liquidRatio;
    this.liquidMesh.position.y = 0.4 + 0.38 * liquidRatio;
    this.liquidSurface.position.y = surfaceY + 0.008 + Math.sin(time * 2.4) * 0.003 * motion;

    for (const ripple of this.ripples) {
      const phase = ((ripple.userData.phase as number) + time * 0.22 * motion) % 1;
      ripple.scale.setScalar(0.6 + phase * 3.2);
      (ripple.material as THREE.MeshBasicMaterial).opacity = 0.34 * (1 - phase);
    }

    for (const bubble of this.bubbles) {
      bubble.mesh.position.y += dt * bubble.speed * (this.reducedMotion ? 0.35 : 1);
      if (bubble.mesh.position.y > surfaceY - 0.06) {
        bubble.mesh.position.y = 0.5;
        bubble.offset += 1.7;
      }
      bubble.mesh.position.x = (bubble.mesh.userData.baseX as number) + Math.sin(time * 1.6 + bubble.offset) * 0.035;
      bubble.mesh.position.z =
        (bubble.mesh.userData.baseZ as number) + Math.cos(time * 1.3 + bubble.offset) * 0.03;
      bubble.mesh.scale.setScalar(bubble.baseScale * (0.85 + Math.sin(time * 3 + bubble.offset) * 0.15));
    }

    // Bell swing, clapper, and glow.
    const swing = Math.sin(time * 7.2) * 0.22 * this.bellKick * motion;
    this.bellPivot.rotation.x = swing;
    this.bellPivot.rotation.z = Math.cos(time * 5.6) * 0.12 * this.bellKick * motion;
    this.bellClapper.rotation.x = swing * 0.6;
    const bellGlowMaterial = this.bellGlow.material as THREE.SpriteMaterial;
    bellGlowMaterial.opacity = 0.32 + Math.sin(time * 2.2) * 0.08 * motion + this.bellKick * 0.55;

    // Thermostat dial and tube.
    this.currentDialAngle += (this.targetDialAngle - this.currentDialAngle) * (1 - Math.exp(-dt * 3.2));
    this.dialNeedle.rotation.z = -this.currentDialAngle;
    this.dialGroup.quaternion.copy(this.camera.quaternion);
    const tubeScale = 0.55 + heat * 0.45;
    this.tubeLiquid.scale.y = tubeScale;
    this.tubeLiquid.position.y = 0.42 + (1.95 * tubeScale) / 2;

    // Floating spores: orbit, bob, or get absorbed by the cell.
    for (const spore of this.spores) {
      if (spore.absorbing) {
        spore.absorbProgress = Math.min(1, spore.absorbProgress + dt * 1.9);
        spore.root.position.lerp(new THREE.Vector3(0, 1.85, 0), 0.16);
        spore.root.scale.setScalar(Math.max(0.05, 1 - spore.absorbProgress));
        if (spore.absorbProgress >= 1) {
          spore.absorbing = false;
          spore.root.visible = false;
          spore.root.scale.setScalar(1);
          spore.respawnAt = time + 5.5;
        }
        continue;
      }
      if (!spore.root.visible) {
        if (time < spore.respawnAt) continue;
        spore.root.visible = true;
        spore.absorbProgress = 0;
        spore.angle = Math.random() * Math.PI * 2;
      }
      spore.angle += dt * spore.speed * 0.36 * motion;
      const radius = spore.radius + Math.sin(time * 0.5 + spore.phase) * 0.18 * motion;
      spore.root.position.set(
        Math.cos(spore.angle) * radius,
        spore.height + Math.sin(time * 0.9 + spore.phase) * 0.2 * motion,
        Math.sin(spore.angle) * radius,
      );
      spore.shape.rotation.x += dt * spore.spin * motion;
      spore.shape.rotation.y += dt * spore.spin * 0.7 * motion;
      (spore.halo.material as THREE.SpriteMaterial).opacity =
        0.26 + Math.sin(time * 2.1 + spore.phase) * 0.08 * motion;
    }

    // Ambient dust motes.
    if (this.motes.visible) {
      const positions = this.motes.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < this.moteData.length; i++) {
        const datum = this.moteData[i]!;
        positions.setX(i, datum.baseX + Math.cos(time * datum.speed + datum.phase) * datum.sway);
        positions.setY(i, datum.y + Math.sin(time * datum.speed * 1.7 + datum.phase) * 0.45);
        positions.setZ(i, datum.baseZ + Math.sin(time * datum.speed * 0.9 + datum.phase) * datum.sway);
      }
      positions.needsUpdate = true;
    }

    // Crystals and floating rocks.
    for (const crystal of this.crystals) {
      const base = crystal.userData.baseScale as THREE.Vector3;
      const phase = crystal.userData.phase as number;
      const pulse = 1 + Math.sin(time * 1.7 + phase) * 0.06 * motion;
      crystal.scale.set(
        base.x * pulse,
        base.y * (1 + Math.sin(time * 2.1 + phase) * 0.08 * motion),
        base.z * pulse,
      );
      crystal.rotation.y += dt * 0.25 * motion;
    }
    for (const rock of this.floatingRocks) {
      rock.position.y =
        (rock.userData.baseY as number) + Math.sin(time * 0.6 + (rock.userData.phase as number)) * 0.2 * motion;
      rock.rotation.y += dt * 0.12 * motion;
    }

    // Burst shockwaves.
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i]!;
      wave.progress += dt * wave.speed;
      if (wave.progress >= 1) {
        this.root.remove(wave.mesh);
        wave.mesh.geometry.dispose();
        (wave.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }
      wave.mesh.scale.setScalar(1 + wave.progress * wave.growth);
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity = wave.strength * (1 - wave.progress);
    }

    // Burst particle fountain.
    if (this.burstActive) {
      this.burstAge += dt;
      const positions = this.burstPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const vx = this.burstVelocities[i * 3]!;
        const vy = this.burstVelocities[i * 3 + 1]!;
        const vz = this.burstVelocities[i * 3 + 2]!;
        this.burstVelocities[i * 3 + 1] = vy - dt * 1.6;
        positions.setXYZ(
          i,
          positions.getX(i) + vx * dt,
          positions.getY(i) + vy * dt,
          positions.getZ(i) + vz * dt,
        );
      }
      positions.needsUpdate = true;
      const material = this.burstPoints.material as THREE.PointsMaterial;
      material.opacity = Math.max(0, 0.95 * (1 - this.burstAge / 1.5));
      if (this.burstAge > 1.5) {
        this.burstActive = false;
        this.burstPoints.visible = false;
      }
    }

    // Glow rings and sprites breathe with the reactor.
    const beat = 0.75 + Math.sin(time * 1.4) * 0.12 * motion + this.zonePulse * 0.45;
    for (const ring of this.topRings) {
      (ring.material as THREE.MeshBasicMaterial).opacity =
        (ring.userData.baseOpacity as number) * beat;
    }
    for (const sprite of this.glowSprites) {
      const baseScale = sprite.userData.baseScale as number;
      const baseOpacity = sprite.userData.baseOpacity as number;
      const pulse = 1 + Math.sin(time * 1.8 + sprite.position.x) * 0.06 * motion + this.burstPulse * 0.35;
      sprite.scale.setScalar(baseScale * pulse);
      (sprite.material as THREE.SpriteMaterial).opacity = Math.min(
        1,
        baseOpacity *
          (0.85 + Math.sin(time * 2.2 + sprite.position.z) * 0.15 * motion + this.burstPulse * 0.6),
      );
    }
  }

  public dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    this.container.removeEventListener("pointermove", this.onPointerMove);
    this.container.removeEventListener("pointerup", this.onPointerUp);
    this.container.removeEventListener("pointercancel", this.onPointerCancel);
    this.container.removeEventListener("pointerleave", this.onPointerLeave);
    this.container.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.motionQuery.removeEventListener("change", this.onMotionChange);

    const disposed = new Set<THREE.Material | THREE.BufferGeometry | THREE.Texture>();
    const disposeTexture = (texture: THREE.Texture) => {
      if (disposed.has(texture)) return;
      disposed.add(texture);
      texture.dispose();
    };
    const disposeMaterial = (material: THREE.Material) => {
      if (disposed.has(material)) return;
      disposed.add(material);
      for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        if (value instanceof THREE.Texture) disposeTexture(value);
      }
      material.dispose();
    };

    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry && !disposed.has(mesh.geometry)) {
        disposed.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const entry of material) disposeMaterial(entry);
      } else if (material instanceof THREE.Material) {
        disposeMaterial(material);
      }
    });

    disposeTexture(this.toonGradient);
    disposeTexture(this.glowTexture);
    disposeTexture(this.dotTexture);
    this.outlineMaterial.dispose();
    this.scene.clear();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
    this.container.classList.remove("is-hovering", "is-dragging");
  }
}
