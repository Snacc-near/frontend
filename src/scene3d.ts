/**
 * Mesin 3D Akuarium Sel Hidup ("The Living Cell" — M6 biolab-ui & Konsep UI 3D Semi-Realistis).
 * Dibangun di atas Three.js (FE-07) dengan GLSL shader membran organik, detak jantung Nukleus,
 * organel 3D (Mitokondria, Nukleus, Lisosom), cincin reaktor CrucibleTemp,
 * shockwave 3D Nutrient Burst (UI-117), serta molekul spora interaktif yang bisa diklik langsung.
 */

import * as THREE from "three";
import type {
  MacroZone,
  OrganelleAllocation,
  SkinMode,
} from "./types.ts";
import { classifyZone } from "./types.ts";
import { prefersReducedMotion } from "./motion.ts";

const CELL_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uTempFactor;
  uniform float uPulse;
  uniform float uBurstWave;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vDisplacement;

  // Gelombang organik multi-harmonik tanpa tekstur eksternal (patuh FE-01 CSP)
  float bioWave(vec3 p, float t) {
    float w1 = sin(p.x * 2.6 + t * 1.9) * cos(p.y * 2.4 - t * 1.5) * sin(p.z * 2.8 + t * 1.3);
    float w2 = sin(p.x * 5.2 - t * 2.7) * sin(p.y * 4.8 + t * 2.2) * 0.35;
    float w3 = cos(length(p.xy) * 6.0 - t * 3.4) * 0.18;
    return w1 + w2 + w3;
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);
    float speed = mix(0.65, 2.45, uTempFactor);
    float amp = mix(0.055, 0.19, uTempFactor) + uBurstWave * 0.14;
    float wave = bioWave(position, uTime * speed);
    float heartbeat = sin(uTime * mix(2.2, 6.8, uTempFactor)) * 0.035 * uPulse;
    float disp = wave * amp + heartbeat;
    vDisplacement = disp;

    vec3 displaced = position + normal * disp;
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const CELL_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uCoreColor;
  uniform vec3 uRimColor;
  uniform float uOpacity;
  uniform float uBurstWave;
  uniform float uFintechMode;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vDisplacement;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.35);

    // Ramp cel-shaded 3 tingkat (gaya FE-07 semi-realistis)
    vec3 lightDir = normalize(vec3(0.6, 0.8, 0.5));
    float ndl = dot(normal, lightDir) * 0.5 + 0.5;
    float toonBand = smoothstep(0.28, 0.34, ndl) * 0.45 + smoothstep(0.62, 0.68, ndl) * 0.55;

    vec3 baseCol = mix(uCoreColor * 0.55, uCoreColor * 1.18, toonBand);
    baseCol += uRimColor * (vDisplacement * 2.2);
    vec3 finalColor = mix(baseCol, uRimColor, fresnel * 0.88 + uBurstWave * 0.35);

    // Dalam mode FinTech, tambahkan garis kontur presisi
    if (uFintechMode > 0.5) {
      float contour = step(0.82, fract(vDisplacement * 28.0));
      finalColor = mix(finalColor, uRimColor * 1.35, contour * 0.45);
    }

    float alpha = clamp(uOpacity + fresnel * 0.38 + uBurstWave * 0.2, 0.25, 0.92);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

interface FloatingSpore {
  mesh: THREE.Mesh;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
  verticalOffset: number;
  verticalSpeed: number;
  absorbing: boolean;
  absorbProgress: number;
  kind: "snacc" | "ignis" | "myco";
}

interface BurstParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
}

export interface CrucibleSceneCallbacks {
  onSporeHarvested: (kind: "snacc" | "ignis" | "myco", bonusTempMk: number) => void;
}

export class CrucibleScene3D {
  private readonly container: HTMLElement;
  private readonly callbacks: CrucibleSceneCallbacks;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rootGroup: THREE.Group;
  private readonly cellMembrane: THREE.Mesh;
  private readonly cellShaderMat: THREE.ShaderMaterial;
  private readonly nucleusMesh: THREE.Mesh;
  private readonly nucleusWire: THREE.LineSegments;
  private readonly organelleGroup: THREE.Group;
  private readonly mitoMeshes: THREE.Mesh[] = [];
  private readonly lisoMeshes: THREE.Mesh[] = [];
  private readonly ringOuter: THREE.Mesh;
  private readonly ringInner: THREE.Mesh;
  private readonly shockwaveRing: THREE.Mesh;
  private readonly spores: FloatingSpore[] = [];
  private readonly burstParticles: BurstParticle[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();

  private crucibleTemp = 605;
  private currentZone: MacroZone = "Goldilocks";
  private skinMode: SkinMode = "biolab";
  private vitalityRatio = 0.85;
  private isLiquidated = false;
  private burstIntensity = 0;
  private shockwaveProgress = 0;

  private isDragging = false;
  private dragMoved = false;
  private prevPointer = { x: 0, y: 0 };
  private targetRotation = { x: 0.22, y: 0.45 };
  private currentRotation = { x: 0.22, y: 0.45 };
  private targetZoom = 6.2;
  private currentZoom = 6.2;

  private rafId = 0;
  private paused = false;
  private clock = new THREE.Clock();

  constructor(container: HTMLElement, callbacks: CrucibleSceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0.3, this.currentZoom);

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // Pencahayaan tiga titik bioluminesensi
    const ambient = new THREE.AmbientLight(0x1e293b, 1.4);
    const keyLight = new THREE.DirectionalLight(0xe2f8ff, 2.2);
    keyLight.position.set(4, 6, 5);
    const rimLight = new THREE.PointLight(0x10b981, 3.5, 14);
    rimLight.position.set(-4, -3, 3);
    this.scene.add(ambient, keyLight, rimLight);

    // 1. Membran Sel Hidup (GLSL Shader Organik)
    const membraneGeo = new THREE.IcosahedronGeometry(1.52, 5);
    this.cellShaderMat = new THREE.ShaderMaterial({
      vertexShader: CELL_VERTEX_SHADER,
      fragmentShader: CELL_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uTempFactor: { value: 0.5 },
        uPulse: { value: 1.0 },
        uBurstWave: { value: 0.0 },
        uCoreColor: { value: new THREE.Color(0x059669) },
        uRimColor: { value: new THREE.Color(0x34d399) },
        uOpacity: { value: 0.46 },
        uFintechMode: { value: 0.0 },
      },
    });
    this.cellMembrane = new THREE.Mesh(membraneGeo, this.cellShaderMat);

    // 2. Inti Sel (Nukleus Berdenyut)
    const nucleusGeo = new THREE.DodecahedronGeometry(0.56, 2);
    const nucleusMat = new THREE.MeshToonMaterial({
      color: 0x10b981,
      emissive: 0x065f46,
      emissiveIntensity: 0.85,
    });
    this.nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);

    const wireGeo = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.64, 1));
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xa7f3d0,
      transparent: true,
      opacity: 0.55,
    });
    this.nucleusWire = new THREE.LineSegments(wireGeo, wireMat);
    this.nucleusMesh.add(this.nucleusWire);

    // 3. Organel Sitoplasma (Mitokondria & Lisosom — EN-119)
    this.organelleGroup = new THREE.Group();
    this.buildOrganelles();

    // 4. Cincin Reaktor Termostat CrucibleTemp
    const outerRingGeo = new THREE.TorusGeometry(2.38, 0.028, 16, 96);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.65,
    });
    this.ringOuter = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.ringOuter.rotation.x = Math.PI * 0.36;

    const innerRingGeo = new THREE.TorusGeometry(2.05, 0.018, 12, 72);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
    });
    this.ringInner = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.ringInner.rotation.y = Math.PI * 0.28;

    // 5. Cincin Shockwave Nutrient Burst (UI-117)
    const shockGeo = new THREE.TorusGeometry(1.6, 0.045, 16, 64);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0,
    });
    this.shockwaveRing = new THREE.Mesh(shockGeo, shockMat);
    this.shockwaveRing.rotation.x = Math.PI * 0.5;

    this.rootGroup.add(
      this. nucleusMesh,
      this.organelleGroup,
      this.cellMembrane,
      this.ringOuter,
      this.ringInner,
      this.shockwaveRing,
    );

    // 6. Molekul Spora & $SNACC yang Mengorbit (Bisa Diklik)
    this.buildFloatingSpores();

    this.initWebGL();
    this.bindInteractions();
    this.applyZonePalette("Goldilocks");
    this.startLoop();
  }

  private buildOrganelles(): void {
    // 5 kapsul Mitokondria (pembangkit $ATP)
    const mitoGeo = new THREE.CapsuleGeometry(0.09, 0.22, 6, 12);
    const mitoMat = new THREE.MeshToonMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.6,
    });

    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(mitoGeo, mitoMat);
      const angle = (i / 5) * Math.PI * 2;
      m.position.set(Math.cos(angle) * 0.98, Math.sin(angle * 2) * 0.28, Math.sin(angle) * 0.98);
      m.rotation.set(angle, angle * 0.5, 0);
      this.organelleGroup.add(m);
      this.mitoMeshes.push(m);
    }

    // 5 oktahedron Lisosom (vesikel pencernaan BMR)
    const lisoGeo = new THREE.OctahedronGeometry(0.11, 1);
    const lisoMat = new THREE.MeshToonMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.65,
    });

    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(lisoGeo, lisoMat);
      const angle = (i / 5) * Math.PI * 2 + 0.5;
      l.position.set(Math.cos(angle) * 1.15, -Math.sin(angle * 2) * 0.34, Math.sin(angle) * 1.15);
      this.organelleGroup.add(l);
      this.lisoMeshes.push(l);
    }
  }

  private buildFloatingSpores(): void {
    const kinds: Array<"snacc" | "ignis" | "myco"> = ["snacc", "ignis", "myco"];

    for (let i = 0; i < 12; i++) {
      const kind = kinds[i % kinds.length]!;
      const geo =
        kind === "snacc"
          ? new THREE.OctahedronGeometry(0.14, 0)
          : kind === "ignis"
            ? new THREE.TetrahedronGeometry(0.15, 0)
            : new THREE.IcosahedronGeometry(0.13, 0);

      const col =
        kind === "snacc" ? 0x34d399 : kind === "ignis" ? 0xfb923c : 0x38bdf8;

      const mat = new THREE.MeshToonMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.45,
      });

      const mesh = new THREE.Mesh(geo, mat);
      const orbitRadius = 2.75 + (i % 3) * 0.42;
      const orbitAngle = (i / 12) * Math.PI * 2;
      const verticalOffset = ((i % 5) - 2) * 0.38;

      mesh.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        verticalOffset,
        Math.sin(orbitAngle) * orbitRadius,
      );

      this.rootGroup.add(mesh);
      this.spores.push({
        mesh,
        orbitRadius,
        orbitSpeed: 0.28 + (i % 4) * 0.08,
        orbitAngle,
        verticalOffset,
        verticalSpeed: 1.1 + (i % 3) * 0.35,
        absorbing: false,
        absorbProgress: 0,
        kind,
      });
    }
  }

  private initWebGL(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.renderer.setPixelRatio(dpr);
      this.renderer.domElement.className = "crucible-canvas";
      this.container.appendChild(this.renderer.domElement);
      this.handleResize();
    } catch {
      this.renderer = null;
    }
  }

  private bindInteractions(): void {
    window.addEventListener("resize", () => this.handleResize());
    document.addEventListener("visibilitychange", () => {
      this.paused = document.hidden;
    });

    const el = this.container;
    el.addEventListener("pointerdown", (e) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.prevPointer = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevPointer.x;
      const dy = e.clientY - this.prevPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        this.dragMoved = true;
      }
      this.targetRotation.y += dx * 0.0065;
      this.targetRotation.x = Math.max(-0.9, Math.min(0.9, this.targetRotation.x + dy * 0.0055));
      this.prevPointer = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("pointerup", (e) => {
      if (this.isDragging && !this.dragMoved) {
        this.tryHarvestSporeAtPointer(e.clientX, e.clientY);
      }
      this.isDragging = false;
    });

    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.targetZoom = Math.max(4.1, Math.min(8.6, this.targetZoom + e.deltaY * 0.0025));
      },
      { passive: false },
    );
  }

  private tryHarvestSporeAtPointer(clientX: number, clientY: number): void {
    if (!this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const candidates = this.spores.filter((s) => !s.absorbing).map((s) => s.mesh);
    const hits = this.raycaster.intersectObjects(candidates, false);

    if (hits.length > 0) {
      const hitMesh = hits[0]!.object;
      const targetSpore = this.spores.find((s) => s.mesh === hitMesh);
      if (targetSpore && !targetSpore.absorbing) {
        targetSpore.absorbing = true;
        targetSpore.absorbProgress = 0;
        const deltaMk = targetSpore.kind === "ignis" ? 9 : targetSpore.kind === "snacc" ? 6 : 4;
        this.callbacks.onSporeHarvested(targetSpore.kind, deltaMk);
      }
    }
  }

  public handleResize(): void {
    if (!this.renderer) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  public setTelemetryState(opts: {
    crucibleTemp: number;
    skin: SkinMode;
    vitalityRatio: number;
    isLiquidated?: boolean;
    organel: OrganelleAllocation;
  }): void {
    this.crucibleTemp = opts.crucibleTemp;
    this.skinMode = opts.skin;
    this.vitalityRatio = Math.max(0.05, Math.min(1, opts.vitalityRatio));
    this.isLiquidated = Boolean(opts.isLiquidated);

    const newZone = classifyZone(opts.crucibleTemp);
    if (newZone !== this.currentZone || this.isLiquidated) {
      this.currentZone = newZone;
    }
    this.applyZonePalette(newZone);

    // Skala visual organel berdasarkan alokasi $ATP (EN-119)
    const mitoScale = 0.85 + opts.organel.mitokondria * 0.22;
    for (const m of this.mitoMeshes) {
      m.scale.setScalar(mitoScale);
    }
    const lisoScale = 0.85 + opts.organel.lisosom * 0.22;
    for (const l of this.lisoMeshes) {
      l.scale.setScalar(lisoScale);
    }
    const nucScale = 0.9 + opts.organel.nukleus * 0.14;
    this.nucleusMesh.scale.setScalar(nucScale);
  }

  private applyZonePalette(zone: MacroZone): void {
    const u = this.cellShaderMat.uniforms;
    u["uFintechMode"]!.value = this.skinMode === "fintech" ? 1.0 : 0.0;

    if (this.isLiquidated) {
      // Merah #ff2255 saat Liquidated (VC-009)
      (u["uCoreColor"]!.value as THREE.Color).setHex(0x991b1b);
      (u["uRimColor"]!.value as THREE.Color).setHex(0xff2255);
      (this.ringOuter.material as THREE.MeshBasicMaterial).color.setHex(0xff2255);
      return;
    }

    if (zone === "Fever") {
      (u["uCoreColor"]!.value as THREE.Color).setHex(0xc2410c);
      (u["uRimColor"]!.value as THREE.Color).setHex(0xfb923c);
      (this.ringOuter.material as THREE.MeshBasicMaterial).color.setHex(0xf97316);
      (this.ringInner.material as THREE.MeshBasicMaterial).color.setHex(0xfef08a);
      (this.nucleusMesh.material as THREE.MeshToonMaterial).color.setHex(0xf97316);
    } else if (zone === "Hypothermia") {
      (u["uCoreColor"]!.value as THREE.Color).setHex(0x0369a1);
      (u["uRimColor"]!.value as THREE.Color).setHex(0x38bdf8);
      (this.ringOuter.material as THREE.MeshBasicMaterial).color.setHex(0x06b6d4);
      (this.ringInner.material as THREE.MeshBasicMaterial).color.setHex(0xa5f3fc);
      (this.nucleusMesh.material as THREE.MeshToonMaterial).color.setHex(0x06b6d4);
    } else {
      (u["uCoreColor"]!.value as THREE.Color).setHex(0x047857);
      (u["uRimColor"]!.value as THREE.Color).setHex(0x34d399);
      (this.ringOuter.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
      (this.ringInner.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
      (this.nucleusMesh.material as THREE.MeshToonMaterial).color.setHex(0x10b981);
    }
  }

  /**
   * Ledakan visual 3D saat event `nutrient_burst_released` (UI-117) aktif.
   */
  public triggerNutrientBurstWave(): void {
    this.burstIntensity = 1.0;
    this.shockwaveProgress = 0.01;

    // Bersihkan partikel lama
    for (const p of this.burstParticles) {
      this.rootGroup.remove(p.mesh);
    }
    this.burstParticles.length = 0;

    const geo = new THREE.SphereGeometry(0.055, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.95,
    });

    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.6 + Math.random() * 0.8;
      m.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
      const vel = m.position.clone().normalize().multiplyScalar(-1.9 - Math.random() * 1.2);
      this.rootGroup.add(m);
      this.burstParticles.push({
        mesh: m,
        velocity: vel,
        age: 0,
        maxAge: 1.15 + Math.random() * 0.45,
      });
    }
  }

  public setRenderPaused(pause: boolean): void {
    this.paused = pause;
  }

  private startLoop(): void {
    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      if (this.paused || !this.renderer) return;

      const dt = Math.min(0.05, this.clock.getDelta());
      const elapsed = this.clock.getElapsedTime();
      const reduced = prefersReducedMotion();

      // Normalisasi faktor suhu (0 = 540 mK dingin, 0.5 = 605 mK netral, 1 = 660 mK panas)
      const tempNorm = Math.max(0, Math.min(1, (this.crucibleTemp - 550) / 110));
      const u = this.cellShaderMat.uniforms;
      u["uTime"]!.value = reduced ? 0 : elapsed;
      u["uTempFactor"]!.value = tempNorm;
      u["uPulse"]!.value = this.vitalityRatio;
      u["uBurstWave"]!.value = this.burstIntensity;

      this.burstIntensity = Math.max(0, this.burstIntensity - dt * 0.85);

      // Gelombang kejut torus Nutrient Burst
      if (this.shockwaveProgress > 0) {
        this.shockwaveProgress += dt * 1.45;
        const scale = 1 + this.shockwaveProgress * 1.65;
        this.shockwaveRing.scale.setScalar(scale);
        (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          0.85 * (1 - this.shockwaveProgress),
        );
        if (this.shockwaveProgress >= 1) {
          this.shockwaveProgress = 0;
        }
      }

      // Animasi partikel spora Nutrient Burst yang tersedot ke inti sel
      for (let i = this.burstParticles.length - 1; i >= 0; i--) {
        const bp = this.burstParticles[i]!;
        bp.age += dt;
        bp.mesh.position.addScaledVector(bp.velocity, dt);
        const lifeRatio = bp.age / bp.maxAge;
        (bp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - lifeRatio);
        if (bp.age >= bp.maxAge || bp.mesh.position.length() < 0.45) {
          this.rootGroup.remove(bp.mesh);
          this.burstParticles.splice(i, 1);
        }
      }

      if (!reduced) {
        // Detak jantung Nukleus & putaran organel
        const beatRate = 2.2 + tempNorm * 4.5;
        const beat = 1 + Math.sin(elapsed * beatRate) * 0.065 * this.vitalityRatio;
        this.nucleusWire.rotation.y = elapsed * 0.55;
        this.nucleusWire.rotation.x = elapsed * 0.35;
        this.nucleusMesh.rotation.y = -elapsed * 0.25;
        this.nucleusWire.scale.setScalar(beat);

        this.organelleGroup.rotation.y = elapsed * (0.28 + tempNorm * 0.45);
        this.organelleGroup.rotation.z = Math.sin(elapsed * 0.4) * 0.15;

        this.ringOuter.rotation.z = elapsed * (0.18 + tempNorm * 0.35);
        this.ringInner.rotation.x = -elapsed * 0.24;

        // Orbit & absorbsi molekul spora interaktif
        for (const s of this.spores) {
          if (s.absorbing) {
            s.absorbProgress = Math.min(1, s.absorbProgress + dt * 2.6);
            const r = s.orbitRadius * (1 - s.absorbProgress * s.absorbProgress);
            s.mesh.position.set(
              Math.cos(s.orbitAngle) * r,
              s.verticalOffset * (1 - s.absorbProgress),
              Math.sin(s.orbitAngle) * r,
            );
            s.mesh.scale.setScalar(1 - s.absorbProgress * 0.85);
            if (s.absorbProgress >= 1) {
              // Respawn molekul baru di orbit luar
              s.absorbing = false;
              s.absorbProgress = 0;
              s.orbitAngle = Math.random() * Math.PI * 2;
              s.mesh.scale.setScalar(1);
            }
          } else {
            s.orbitAngle += dt * s.orbitSpeed * (0.7 + tempNorm * 0.9);
            s.mesh.position.x = Math.cos(s.orbitAngle) * s.orbitRadius;
            s.mesh.position.z = Math.sin(s.orbitAngle) * s.orbitRadius;
            s.mesh.position.y =
              s.verticalOffset + Math.sin(elapsed * s.verticalSpeed + s.orbitAngle) * 0.22;
            s.mesh.rotation.x += dt * 1.1;
            s.mesh.rotation.y += dt * 1.4;
          }
        }
      }

      // Redaman inersia kamera & rotasi grup
      if (!this.isDragging && !reduced) {
        this.targetRotation.y += dt * 0.08;
      }
      this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.1;
      this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.1;
      this.currentZoom += (this.targetZoom - this.currentZoom) * 0.12;

      this.rootGroup.rotation.x = this.currentRotation.x;
      this.rootGroup.rotation.y = this.currentRotation.y;
      this.camera.position.z = this.currentZoom;

      this.renderer.render(this.scene, this.camera);
    };

    this.rafId = requestAnimationFrame(animate);
  }

  public dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.renderer?.dispose();
  }
}
