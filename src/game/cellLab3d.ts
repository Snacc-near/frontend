import * as THREE from "three";

export interface CellLab3DCallbacks {
  onMessage?: (html: string, isError?: boolean) => void;
  onOrganelleSelect?: (key: string | null) => void;
  onDone?: (action: string) => void;
  onAction?: (action: string) => void;
  onZoneChange?: (zoneIndex: number, tempMk: number) => void;
}

export interface OrganelleDef {
  k: string;
  g: THREE.Group;
  name: string;
  d: number;
  glow: number;
  until: number;
  mats: THREE.MeshPhysicalMaterial[];
  by: number;
  hp?: THREE.Mesh[];
  syn?: THREE.Mesh[];
  rib?: THREE.Vector3[];
}

export class CellLab3DEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private callbacks: CellLab3DCallbacks;

  private cellGroup: THREE.Group;
  private memMesh: THREE.Mesh;
  private rimMesh: THREE.Mesh;
  private fresnelMat: THREE.ShaderMaterial;
  private organelles: Record<string, OrganelleDef> = {};
  private pickObjects: THREE.Mesh[] = [];

  private chromMesh!: THREE.Mesh;
  private cytoDust!: THREE.Points;
  private medDust!: THREE.Points;
  private nutrientOrbs: THREE.Mesh[] = [];
  private rivalOrg!: OrganelleDef;
  private rivalMat!: THREE.MeshPhysicalMaterial;
  private nuc2Group!: THREE.Group;
  private pinchMesh!: THREE.Mesh;

  private animFrameId: number | null = null;
  private isDisposed = false;
  private lastTime = performance.now();
  private currentTime = 0;
  private animQueue: Array<{ t: number; f: () => void }> = [];
  private activeFx: Array<{
    m: THREE.Mesh;
    h: THREE.Mesh;
    r: number;
    cv: THREE.CatmullRomCurve3 | null;
    a: THREE.Vector3;
    t0: number;
    d: number;
    done?: (() => void) | null;
    hud?: string;
    c2?: number;
    sw?: number;
  }> = [];
  private pmCache: Record<number, THREE.MeshBasicMaterial> = {};

  // Camera state
  private yaw = 0.55;
  private pitch = 0.25;
  private dist = 46;
  private target = new THREE.Vector3(0, 0, 0);
  private followTarget = new THREE.Vector3(0, 0, 0);
  private followDist = 46;
  private lastInputTime = 0;
  private selectedOrganelleKey: string | null = null;
  private isBusy = false;
  private divideAnimStartTime = 0;

  // Touch / pointer tracking
  private activePointers = new Map<number, [number, number]>();
  private pointerMoveDelta = 0;
  private raycaster = new THREE.Raycaster();

  private reducedMotion = false;

  // Fixed coordinates matching Snacc Cell Lab 3D
  private readonly CHANNEL_POS = new THREE.Vector3(-14.2, 2, 0);
  private readonly EXOCYTOSIS_POS = new THREE.Vector3(13, 4.6, -2.4);
  private readonly OUT_POS = [
    new THREE.Vector3(-19, 4, 3),
    new THREE.Vector3(-18, 0, -3),
    new THREE.Vector3(-20, -2.5, 2),
  ];

  constructor(canvas: HTMLCanvasElement, callbacks: CellLab3DCallbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Renderer matching Snacc_Cell_Lab_3D.html
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    );
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14123a);
    this.scene.fog = new THREE.FogExp2(0x14123a, 0.012);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    this.followDist = this.getBaseCameraDistance();
    this.dist = this.followDist + 10;

    // Lights
    this.setupLights();

    // Textures & Shaders
    const bumpTexture = this.createBumpTexture();
    const softSprite = this.createSoftSpriteTexture();
    this.fresnelMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { c: { value: new THREE.Color(0x8fd0ff) } },
      vertexShader: `
        varying vec3 n, v;
        void main() {
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          n = normalize(normalMatrix * normal);
          v = normalize(-p.xyz);
          gl_Position = projectionMatrix * p;
        }
      `,
      fragmentShader: `
        varying vec3 n, v;
        uniform vec3 c;
        void main() {
          float f = pow(1.0 - abs(dot(n, v)), 2.6);
          gl_FragColor = vec4(c * f * 1.3, f);
        }
      `,
    });

    // PMREM Environment
    this.setupEnvironment();

    // Cell Group
    this.cellGroup = new THREE.Group();
    this.scene.add(this.cellGroup);

    // Dust particles
    this.medDust = this.createDust(420, 45, 30, 30, 0.5, 0xcdbcff, false, softSprite);
    this.scene.add(this.medDust);
    this.cytoDust = this.createDust(600, 14, 11.5, 11.5, 0.3, 0xbfd8ff, true, softSprite);
    this.cellGroup.add(this.cytoDust);

    // Membrane
    this.memMesh = new THREE.Mesh(
      new THREE.SphereGeometry(12, 56, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0x7a6cff,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        bumpMap: bumpTexture,
        bumpScale: 0.8,
        depthWrite: false,
      }),
    );
    this.rimMesh = new THREE.Mesh(new THREE.SphereGeometry(12.15, 40, 26), this.fresnelMat);
    [this.memMesh, this.rimMesh].forEach((m) => {
      m.scale.set(1.2, 1, 1);
      m.renderOrder = 10;
      this.cellGroup.add(m);
    });

    // Build Organelles
    this.buildOrganelles(bumpTexture);

    // Event listeners
    this.setupEventListeners();

    // Initial resize
    this.handleResize();

    // Start loop
    this.currentTime = performance.now();
    this.lastTime = this.currentTime;
    this.loop = this.loop.bind(this);
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  private getBaseCameraDistance(): number {
    return (typeof window !== "undefined" ? window.innerWidth : 1280) < 700 ? 46 : 34;
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.scene.add(new THREE.HemisphereLight(0xb9a8ff, 0x2a1233, 0.55));

    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(10, 20, 15);
    this.scene.add(dl);

    const pl = new THREE.PointLight(0x9fe8ff, 0.8, 60);
    pl.position.set(-8, 6, 10);
    this.scene.add(pl);

    const rl = new THREE.DirectionalLight(0x7ad7ff, 1.1);
    rl.position.set(-10, 6, -22);
    this.scene.add(rl);
  }

  private setupEnvironment(): void {
    const pg = new THREE.PMREMGenerator(this.renderer);
    const es = new THREE.Scene();
    es.background = new THREE.Color(0x1d1a4a);
    (
      [
        [0xffe2b0, 20, 30, 10, 12],
        [0x7ad7ff, -30, 10, -20, 12],
        [0xff9ac8, 0, -30, 20, 9],
      ] as const
    ).forEach(([c, x, y, z, q]) => {
      const l = new THREE.Mesh(
        new THREE.SphereGeometry(q, 16, 8),
        new THREE.MeshBasicMaterial({ color: c }),
      );
      l.position.set(x, y, z);
      es.add(l);
    });
    this.scene.environment = pg.fromScene(es, 0.05).texture;
    pg.dispose();
  }

  private createBumpTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 700; i++) {
        const a = Math.random() * 256;
        const b = Math.random() * 256;
        const r = 3 + Math.random() * 13;
        const g = ctx.createRadialGradient(a, b, 0, a, b, r);
        const v = Math.random() < 0.5 ? 255 : 0;
        g.addColorStop(0, `rgba(${v},${v},${v},0.3)`);
        g.addColorStop(1, "rgba(128,128,128,0)");
        ctx.fillStyle = g;
        ctx.fillRect(a - r, b - r, r * 2, r * 2);
      }
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  private createSoftSpriteTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "#fff");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    return new THREE.CanvasTexture(canvas);
  }

  private createDust(
    n: number,
    sx: number,
    sy: number,
    sz: number,
    sc: number,
    c: number,
    inside: boolean,
    softSprite: THREE.Texture,
  ): THREE.Points {
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x: number, y: number, z: number;
      do {
        x = (Math.random() * 2 - 1) * sx;
        y = (Math.random() * 2 - 1) * sy;
        z = (Math.random() * 2 - 1) * sz;
      } while (
        inside &&
        Math.pow(x / 14, 2) + Math.pow(y / 11.5, 2) + Math.pow(z / 11.5, 2) > 1
      );
      p.set([x, y, z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: c,
        size: sc,
        map: softSprite,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
  }

  private makeMat(
    color: number,
    bump: THREE.Texture,
    opts: THREE.MeshPhysicalMaterialParameters = {},
  ): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial(
      Object.assign(
        {
          color,
          roughness: 0.38,
          metalness: 0.05,
          clearcoat: 0.7,
          clearcoatRoughness: 0.3,
          bumpMap: bump,
          bumpScale: 0.4,
          emissive: color,
          emissiveIntensity: 0,
        },
        opts,
      ),
    );
  }

  private addOrgMesh(
    o: OrganelleDef,
    geo: THREE.BufferGeometry,
    m: THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial,
    px = 0,
    py = 0,
    pz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
    pick = 1,
  ): THREE.Mesh {
    const me = new THREE.Mesh(geo, m);
    me.position.set(px, py, pz);
    me.scale.set(sx, sy, sz);
    o.g.add(me);
    if (pick) {
      me.userData.k = o.k;
      this.pickObjects.push(me);
    }
    if ("emissive" in m && m.emissive && !o.mats.includes(m as THREE.MeshPhysicalMaterial)) {
      o.mats.push(m as THREE.MeshPhysicalMaterial);
    }
    return me;
  }

  private registerOrg(k: string, name: string, x: number, y: number, z: number, d: number): OrganelleDef {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    this.cellGroup.add(g);
    const def: OrganelleDef = {
      k,
      g,
      name,
      d,
      glow: 0,
      until: 0,
      mats: [],
      by: y,
    };
    return (this.organelles[k] = def);
  }

  private buildOrganelles(bump: THREE.Texture): void {
    const SP = new THREE.SphereGeometry(1, 48, 32);

    // 1. Nucleus
    const nu = this.registerOrg("nuc", "Nucleus", -1, 2.5, -1, 10);
    this.addOrgMesh(
      nu,
      SP,
      this.makeMat(0xb69cff, bump, { transparent: true, opacity: 0.5 }),
      0,
      0,
      0,
      3.2,
      3.2,
      3.2,
    );
    this.addOrgMesh(nu, SP, this.makeMat(0xffe6a8, bump), 0.9, 0.6, 0.3, 1, 1, 1);
    this.chromMesh = this.addOrgMesh(
      nu,
      new THREE.TorusKnotGeometry(1.7, 0.16, 140, 8, 2, 3),
      this.makeMat(0xfff3a8, bump, { emissive: 0xffd24a }),
    );

    // 2. Mitochondria
    const makeMito = (k: string, x: number, y: number, z: number, ry: number, rz: number) => {
      const o = this.registerOrg(k, "Mitochondrion", x, y, z, 9);
      o.g.rotation.set(0, ry, rz);
      this.addOrgMesh(
        o,
        SP,
        this.makeMat(0xff9a6b, bump, { transparent: true, opacity: 0.55 }),
        0,
        0,
        0,
        3.4,
        1.5,
        1.5,
      );
      this.addOrgMesh(
        o,
        SP,
        this.makeMat(0xffd6bd, bump, { transparent: true, opacity: 0.5 }),
        0,
        0,
        0,
        3.1,
        1.2,
        1.2,
      );
      const cm = this.makeMat(0xffc24a, bump, { emissive: 0xffc24a });
      for (let i = 0; i < 6; i++) {
        this.addOrgMesh(o, SP, cm, (i - 2.5) * 0.9, (i % 2 ? 1 : -1) * 0.35, 0, 0.14, 0.8, 0.95);
      }
      o.syn = [0, 1, 2].map((i) =>
        this.addOrgMesh(o, SP, this.makeMat(0x7cc4ff, bump), (i - 1) * 1.5, -0.82, 0, 0.22, 0.22, 0.22),
      );
      o.hp = Array.from({ length: 10 }, () => {
        const h = new THREE.Mesh(SP, new THREE.MeshBasicMaterial({ color: 0x9fe0ff }));
        h.scale.setScalar(0.09);
        o.g.add(h);
        return h;
      });
      return o;
    };
    makeMito("mit", 6, -3, 2, 0.5, -0.3);
    makeMito("m2", -6.5, -5, 3, -0.6, 0.45);
    this.organelles.m2.d = 8;

    // 3. Rough ER
    const er = this.registerOrg("er", "Rough ER + ribosomes", -1, 2.5, -1, 10);
    const erm = this.makeMat(0x5be3c1, bump, { transparent: true, opacity: 0.8 });
    er.rib = [];
    for (let i = 0; i < 4; i++) {
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 24; j++) {
        const u = j / 24;
        const th = i * 0.9 + u * 3.4;
        const ph = -0.5 + i * 0.42 + Math.sin(u * 10 + i) * 0.12;
        const r = 4.5 + Math.sin(u * 14 + i * 2) * 0.3;
        pts.push(
          new THREE.Vector3(
            r * Math.cos(ph) * Math.cos(th),
            r * Math.sin(ph),
            r * Math.cos(ph) * Math.sin(th),
          ),
        );
      }
      const cv3 = new THREE.CatmullRomCurve3(pts);
      this.addOrgMesh(er, new THREE.TubeGeometry(cv3, 40, 0.28, 6), erm);
      for (let j = 1; j < 24; j += 3) {
        const p = pts[j].clone().multiplyScalar(1.08);
        this.addOrgMesh(
          er,
          SP,
          this.makeMat(0x2b2a7a, bump, { emissive: 0x9be86a }),
          p.x,
          p.y,
          p.z,
          0.17,
          0.17,
          0.17,
          0,
        );
        er.rib.push(p);
      }
    }

    // 4. Golgi
    const go = this.registerOrg("gol", "Golgi apparatus", 7, 4.2, -3, 9);
    const gm = this.makeMat(0xffd24a, bump, { transparent: true, opacity: 0.9 });
    go.g.rotation.z = 0.25;
    for (let i = 0; i < 4; i++) {
      this.addOrgMesh(
        go,
        SP,
        gm,
        0,
        (i - 1.5) * 0.75,
        0,
        2.8 - i * 0.28,
        0.22,
        1.9 - i * 0.2,
      );
    }
    (
      [
        [3.4, -0.8],
        [3.2, 0.9],
        [-3.3, 0],
      ] as const
    ).forEach((p) =>
      this.addOrgMesh(go, SP, this.makeMat(0xffe48a, bump), p[0], p[1], 0, 0.38, 0.38, 0.38),
    );

    // 5. Lysosome
    const ly = this.registerOrg("lys", "Lysosome", -3, -6.5, -2, 7);
    this.addOrgMesh(ly, SP, this.makeMat(0xff7aa8, bump), 0, 0, 0, 1.1, 1.1, 1.1);
    (
      [
        [0.3, 0.2, 0.5],
        [-0.4, -0.3, 0.3],
        [0.1, 0.5, -0.4],
      ] as const
    ).forEach((p) =>
      this.addOrgMesh(
        ly,
        SP,
        this.makeMat(0x7a2748, bump, { emissive: 0x000000 }),
        p[0],
        p[1],
        p[2],
        0.22,
        0.22,
        0.22,
        0,
      ),
    );

    // 6. Vacuole
    const va = this.registerOrg("vac", "Vacuole", 2, -7.5, -3, 8);
    this.addOrgMesh(
      va,
      SP,
      this.makeMat(0x7cc4ff, bump, { transparent: true, opacity: 0.6 }),
      0,
      0,
      0,
      2,
      2,
      2,
    );

    // 7. Membrane channel
    const ch = this.registerOrg("ch", "Membrane channel", this.CHANNEL_POS.x, this.CHANNEL_POS.y, this.CHANNEL_POS.z, 9);
    ch.g.rotation.y = Math.PI / 2;
    this.addOrgMesh(ch, new THREE.TorusGeometry(1, 0.3, 10, 24), this.makeMat(0xc9b8ff, bump), 0, 0, 0, 1.1, 1.1, 1.1);
    this.addOrgMesh(ch, SP, this.makeMat(0xffb35c, bump, { transparent: true, opacity: 0.35 }), 0, 0, 0, 0.8, 0.8, 0.2, 0);

    // 8. Exocytosis site
    this.registerOrg("ex", "Exocytosis site", this.EXOCYTOSIS_POS.x, this.EXOCYTOSIS_POS.y, this.EXOCYTOSIS_POS.z, 12);

    // 9. Rival cell
    this.rivalOrg = this.registerOrg("rv", "Rival cell", -38, 5, -10, 16);
    this.rivalMat = this.makeMat(0xff6b8a, bump, {
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rivalOrg.g.visible = false;
    this.addOrgMesh(this.rivalOrg, new THREE.SphereGeometry(7, 40, 28), this.rivalMat, 0, 0, 0, 1, 1, 1, 0);
    this.addOrgMesh(this.rivalOrg, SP, this.makeMat(0x3a1a40, bump), 1, 1, 0, 2.4, 2.4, 2.4, 0);
    (
      [
        [2, -3, 1],
        [-3, 2, 2],
        [-2, -3, -2],
      ] as const
    ).forEach((p) => this.addOrgMesh(this.rivalOrg, SP, this.makeMat(0xff9a6b, bump), p[0], p[1], p[2], 1.5, 0.7, 0.7, 0));

    // Division clone and pinch ring
    this.nuc2Group = nu.g.clone();
    this.nuc2Group.visible = false;
    this.cellGroup.add(this.nuc2Group);

    this.pinchMesh = new THREE.Mesh(
      new THREE.TorusGeometry(10, 0.35, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd24a }),
    );
    this.pinchMesh.rotation.y = Math.PI / 2;
    this.pinchMesh.visible = false;
    this.cellGroup.add(this.pinchMesh);

    // Nutrients outside the cell
    this.nutrientOrbs = this.OUT_POS.map((p) => {
      const m = new THREE.Mesh(SP, new THREE.MeshBasicMaterial({ color: 0xffb35c }));
      m.scale.setScalar(0.45);
      m.position.copy(p);
      this.scene.add(m);
      return m;
    });
  }

  private setupEventListeners(): void {
    const cv = this.canvas;
    const onPointerDown = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      this.activePointers.set(e.pointerId, [e.clientX, e.clientY]);
      this.pointerMoveDelta = 0;
      this.lastInputTime = this.currentTime;
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = this.activePointers.get(e.pointerId);
      if (!p) return;
      this.lastInputTime = this.currentTime;
      if (this.activePointers.size === 2) {
        // Pinch to zoom
        const pts = Array.from(this.activePointers.values());
        const d0 = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        p[0] = e.clientX;
        p[1] = e.clientY;
        const d1 = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        if (d0 > 0) {
          this.followDist = Math.max(6, Math.min(60, this.followDist * (d0 / d1)));
        }
        return;
      }
      const dx = e.clientX - p[0];
      const dy = e.clientY - p[1];
      this.pointerMoveDelta += Math.abs(dx) + Math.abs(dy);
      this.yaw -= dx * 0.006;
      this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch + dy * 0.006));
      p[0] = e.clientX;
      p[1] = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
      if (this.pointerMoveDelta < 6) {
        const rect = cv.getBoundingClientRect();
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
        const hits = this.raycaster.intersectObjects(this.pickObjects, false);
        const hitKey = hits.length && hits[0].object.userData.k ? hits[0].object.userData.k : null;
        this.selectOrganelle(hitKey);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.lastInputTime = this.currentTime;
      this.followDist = Math.max(6, Math.min(60, this.followDist * Math.exp(e.deltaY * 0.001)));
    };

    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("pointercancel", (e) => this.activePointers.delete(e.pointerId));
    cv.addEventListener("wheel", onWheel, { passive: false });

    window.addEventListener("resize", () => this.handleResize());
  }

  public handleResize(): void {
    if (!this.canvas || this.isDisposed) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.selectedOrganelleKey) {
      this.followDist = this.getBaseCameraDistance();
    }
  }

  public getOrganelleWorldPos(key: string): THREE.Vector3 {
    const o = this.organelles[key];
    if (!o) return new THREE.Vector3(0, 0, 0);
    const v = new THREE.Vector3();
    o.g.getWorldPosition(v);
    return v;
  }

  public getProjectedOrganellePosition(key: string): { x: number; y: number; visible: boolean } {
    const pos = this.getOrganelleWorldPos(key);
    pos.project(this.camera);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    return {
      x: (pos.x * 0.5 + 0.5) * w,
      y: (-pos.y * 0.5 + 0.5) * h,
      visible: pos.z <= 1,
    };
  }

  public selectOrganelle(k: string | null): void {
    this.selectedOrganelleKey = k;
    if (k && this.organelles[k]) {
      this.focusOn(k, this.organelles[k].d);
      if (this.callbacks.onOrganelleSelect) this.callbacks.onOrganelleSelect(k);
    } else {
      this.focusOn(null);
      if (this.callbacks.onOrganelleSelect) this.callbacks.onOrganelleSelect(null);
    }
  }

  public focusOn(key: string | null, dist?: number): void {
    if (key && this.organelles[key]) {
      this.followTarget.copy(this.getOrganelleWorldPos(key));
      this.followDist = dist || this.getBaseCameraDistance();
    } else {
      this.followTarget.set(0, 0, 0);
      this.followDist = this.getBaseCameraDistance();
    }
  }

  public setSeeThrough(on: boolean): void {
    if (this.memMesh.material instanceof THREE.MeshPhysicalMaterial) {
      this.memMesh.material.opacity = on ? 0.03 : 0.14;
    }
  }

  public setZoneTheme(zoneIndex: number, dt = 0.016): void {
    const ZN_COLORS = [0x0c1a3c, 0x14123a, 0x2a1233];
    const c = new THREE.Color(ZN_COLORS[Math.max(0, Math.min(2, zoneIndex))]);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(c, Math.min(1, dt * 2));
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this.scene.background);
      }
    }
  }

  public setVitalityColor(vitalityPct: number, dt = 0.016): void {
    const normalCol = new THREE.Color(0x7a6cff);
    const redCol = new THREE.Color(0xff5d7a);
    const target = normalCol.lerp(redCol, Math.max(0, 1 - vitalityPct / 30));
    if (this.memMesh.material instanceof THREE.MeshPhysicalMaterial) {
      this.memMesh.material.color.lerp(target, Math.min(1, dt * 2));
      this.fresnelMat.uniforms.c.value
        .copy(this.memMesh.material.color)
        .multiplyScalar(1.7);
    }
  }

  private pm(c: number): THREE.MeshBasicMaterial {
    return this.pmCache[c] || (this.pmCache[c] = new THREE.MeshBasicMaterial({ color: c }));
  }

  private spawnOrb(
    color: number,
    radius: number,
    pts: THREE.Vector3[],
    dur: number,
    delay: number,
    done?: (() => void) | null,
    opts: { hud?: string; c2?: number } = {},
  ): void {
    const SP = new THREE.SphereGeometry(1, 48, 32);
    const m = new THREE.Mesh(SP, this.pm(color));
    m.visible = false;
    this.scene.add(m);

    const h = new THREE.Mesh(
      SP,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    h.scale.setScalar(2.3);
    m.add(h);

    this.activeFx.push({
      m,
      h,
      r: radius,
      cv: pts.length > 1 ? new THREE.CatmullRomCurve3(pts) : null,
      a: pts[0],
      t0: this.currentTime + delay,
      d: dur,
      done,
      hud: opts.hud,
      c2: opts.c2,
    });
  }

  private at(delayMs: number, f: () => void): void {
    this.animQueue.push({ t: this.currentTime + delayMs, f });
  }

  private lit(k: string, ms: number): void {
    if (this.organelles[k]) {
      this.organelles[k].until = this.currentTime + ms;
    }
  }

  public play(action: string, _isPreview = false): void {
    if (this.isBusy) {
      if (this.callbacks.onMessage) {
        this.callbacks.onMessage(
          "A mechanism is still running. Watch it finish first.",
          true,
        );
      }
      return;
    }
    this.isBusy = true;
    if (this.callbacks.onAction) this.callbacks.onAction(action);

    const mp = this.getOrganelleWorldPos("mit");
    const m2 = this.getOrganelleWorldPos("m2");
    const vp = this.getOrganelleWorldPos("vac");
    const gp = this.getOrganelleWorldPos("gol");
    const np = this.getOrganelleWorldPos("nuc");

    const fin = () => {
      this.isBusy = false;
      this.focusOn(this.selectedOrganelleKey);
      if (this.callbacks.onDone) this.callbacks.onDone(action);
    };

    if (action === "feed") {
      this.focusOn("ch", 13);
      this.lit("ch", 2200);
      this.OUT_POS.forEach((p, i) =>
        this.spawnOrb(
          0xffb35c,
          0.45,
          [p, this.CHANNEL_POS, new THREE.Vector3(-9, 1.5, 0), new THREE.Vector3(-4, -1, 1.5), i ? m2 : mp],
          2600,
          i * 350,
          null,
        ),
      );
      this.at(1500, () => this.focusOn("mit", 10));
      this.at(3300, () => {
        this.lit("mit", 2800);
        this.lit("m2", 2800);
      });
      this.at(3500, () => {
        for (let i = 0; i < 5; i++) {
          this.spawnOrb(
            0xffd24a,
            0.32,
            [i % 2 ? m2 : mp],
            1300,
            i * 140,
            null,
            { hud: "p-atp" },
          );
        }
        this.spawnOrb(0xff7a4a, 0.5, [mp, mp.clone().add(new THREE.Vector3(0, 3, 0))], 1500, 0, null);
      });
      this.at(5300, fin);
    } else if (action === "extract") {
      this.focusOn("er", 12);
      this.lit("er", 3200);
      const er = this.organelles.er;
      const ribs = er?.rib || [];
      for (let i = 0; i < 2; i++) {
        const offset = ribs[(i * 7 + 3) % (ribs.length || 1)] || new THREE.Vector3();
        this.spawnOrb(
          0x9be86a,
          0.3,
          [this.getOrganelleWorldPos("er").add(offset), new THREE.Vector3(1, -1, -2), vp],
          1800,
          600 + i * 450,
          null,
        );
      }
      this.at(3200, fin);
    } else if (action === "transmute") {
      this.focusOn("er", 12);
      this.lit("nuc", 2400);
      this.lit("er", 3400);
      const ribs = this.organelles.er?.rib || [];
      for (let i = 0; i < 3; i++) {
        this.spawnOrb(
          0xd7c6ff,
          0.22,
          [np, this.getOrganelleWorldPos("er").add(ribs[i * 6] || new THREE.Vector3()), this.getOrganelleWorldPos("er").add(ribs[i * 6 + 2] || new THREE.Vector3())],
          1400,
          i * 250,
          null,
        );
      }
      [0, 1].forEach((i) =>
        this.spawnOrb(
          0x9be86a,
          0.3,
          [vp, new THREE.Vector3(0, -2, -1), this.getOrganelleWorldPos("er").add(ribs[10 + i * 5] || new THREE.Vector3())],
          2000,
          400 + i * 300,
          null,
          { c2: 0xb69cff },
        ),
      );
      this.at(3400, fin);
    } else if (action === "synth") {
      this.focusOn("gol", 11);
      this.lit("gol", 4200);
      const ribs = this.organelles.er?.rib || [];
      [0, 1].forEach((i) =>
        this.spawnOrb(
          0xb69cff,
          0.3,
          [this.getOrganelleWorldPos("er").add(ribs[4 + i * 5] || new THREE.Vector3()), new THREE.Vector3(3, 4, -2), gp],
          1500,
          i * 350,
          null,
        ),
      );
      this.at(1800, () => {
        this.focusOn("ex", 12);
        this.spawnOrb(
          0xffb3c8,
          0.6,
          [gp, new THREE.Vector3(10, 4.4, -2.6), this.EXOCYTOSIS_POS],
          1800,
          0,
          () => {
            for (let i = 0; i < 8; i++) {
              const d = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
              ).normalize();
              this.spawnOrb(
                0xffb3c8,
                0.2,
                [this.EXOCYTOSIS_POS, this.EXOCYTOSIS_POS.clone().add(d.multiplyScalar(3.5))],
                900,
                0,
                null,
              );
            }
          },
        );
      });
      this.at(4300, fin);
    } else if (action === "divide") {
      this.focusOn(null, this.getBaseCameraDistance() + 4);
      this.lit("nuc", 3600);
      this.divideAnimStartTime = this.currentTime;
      this.at(4400, fin);
    } else if (action === "splice") {
      this.focusOn("ch", 14);
      this.spawnOrb(
        0xff9a6b,
        1.1,
        [this.OUT_POS[1], this.CHANNEL_POS, new THREE.Vector3(-9, 0, 1), m2],
        3200,
        0,
        null,
      );
      this.at(1200, () => this.focusOn("m2", 10));
      this.at(3300, () => {
        this.lit("m2", 2400);
        this.lit("mit", 2400);
      });
      this.at(5400, fin);
    } else if (action === "harvest") {
      this.focusOn(null, this.getBaseCameraDistance() + 6);
      this.at(600, () => {
        if (this.memMesh.material instanceof THREE.MeshPhysicalMaterial) {
          this.memMesh.material.opacity = 0.5;
        }
        this.lit("lys", 2500);
      });
      const lp = this.getOrganelleWorldPos("lys");
      for (let i = 0; i < 30; i++) {
        const d = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
        ).normalize();
        this.spawnOrb(
          i % 3 ? 0xffb35c : 0xff7a8a,
          0.3,
          [lp, lp.clone().add(d.clone().multiplyScalar(8)), d.clone().multiplyScalar(22)],
          2600,
          700 + i * 25,
          null,
        );
      }
      this.at(3700, () => {
        if (this.memMesh.material instanceof THREE.MeshPhysicalMaterial) {
          this.memMesh.material.opacity = 0.14;
        }
        fin();
      });
    } else if (action === "redeem") {
      this.focusOn("gol", 10);
      this.lit("gol", 2200);
      for (let i = 0; i < 6; i++) {
        this.spawnOrb(
          0xffb3c8,
          0.25,
          [
            gp.clone().add(
              new THREE.Vector3(
                (Math.random() * 2 - 1) * 3,
                (Math.random() * 2 - 1) * 2,
                (Math.random() * 2 - 1) * 2,
              ),
            ),
            gp,
          ],
          1200,
          i * 180,
          null,
        );
      }
      this.at(2400, fin);
    } else if (action === "raid") {
      this.rivalOrg.g.visible = true;
      this.followTarget.set(-20, 4, -4);
      this.followDist = 48;
      const rp = this.getOrganelleWorldPos("rv");
      for (let i = 0; i < 8; i++) {
        this.spawnOrb(
          0x9be86a,
          0.3,
          [gp, new THREE.Vector3(-14, 3, -4), rp],
          1700,
          i * 200,
          null,
        );
      }
      this.at(2300, () => {
        this.lit("rv", 2000);
        for (let i = 0; i < 6; i++) {
          this.spawnOrb(
            0xffb35c,
            0.4,
            [rp, new THREE.Vector3(-14, 2, 0), gp],
            1500,
            i * 140,
            null,
            { hud: "p-sn" },
          );
        }
      });
      this.at(5000, () => {
        this.rivalOrg.g.visible = false;
        fin();
      });
    } else if (action.startsWith("u")) {
      const idx = parseInt(action[1], 10);
      const keys = ["mit", "nuc", "lys"];
      const k = keys[idx] || "mit";
      this.focusOn(k, 10);
      this.lit(k, 2500);
      this.at(2500, fin);
    } else {
      fin();
    }
  }

  private loop(now: number): void {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.currentTime = now;
    const T = now;

    // Process timed animation queue
    this.animQueue.sort((a, b) => a.t - b.t);
    while (this.animQueue.length && this.animQueue[0].t <= T) {
      const item = this.animQueue.shift();
      if (item) item.f();
    }

    // Heartbeat scale
    const beat = this.reducedMotion ? 1 : 1 + 0.012 * Math.sin(T / 450);
    const dvv =
      this.divideAnimStartTime
        ? Math.sin(Math.min(1, (T - this.divideAnimStartTime) / 4200) * Math.PI)
        : 0;
    if (this.divideAnimStartTime && T - this.divideAnimStartTime >= 4200) {
      this.divideAnimStartTime = 0;
    }
    this.cellGroup.scale.set(
      beat * (1 + 0.4 * dvv),
      beat * (1 - 0.15 * dvv),
      beat * (1 - 0.15 * dvv),
    );

    // Organelle updates & bobbing
    const nu = this.organelles.nuc;
    if (nu) {
      nu.g.position.x = -1 - dvv * 5;
    }
    this.nuc2Group.visible = this.pinchMesh.visible = dvv > 0.02;
    this.nuc2Group.position.set(-1 + dvv * 5, 2.5, -1);
    this.pinchMesh.scale.setScalar(Math.max(0.15, 1 - dvv * 0.85));

    for (const k in this.organelles) {
      const o = this.organelles[k];
      o.glow += ((T < o.until ? 1 : 0) - o.glow) * Math.min(1, dt * 5);
      o.mats.forEach((m) => (m.emissiveIntensity = o.glow * 1.1));
      if (!this.reducedMotion && k !== "ex" && k !== "ch" && k !== "nuc" && k !== "er") {
        o.g.position.y = o.by + Math.sin(T / 1300 + o.by) * 0.25;
      }
    }

    // Mitochondria H+ particles and ATP synthase rotation
    [this.organelles.mit, this.organelles.m2].forEach((o) => {
      if (!o) return;
      const g = o.glow;
      if (o.hp) {
        o.hp.forEach((h, i) => {
          h.visible = g > 0.05;
          const u = (T / (this.reducedMotion ? 2400 : 1100) + i * 0.1) % 1;
          h.position.set(
            (i % 5 - 2) * 0.9,
            -0.9 + Math.sin(u * Math.PI) * 1.5,
            i < 5 ? 0.25 : -0.25,
          );
        });
      }
      if (o.syn) {
        o.syn.forEach((s, i) => {
          const a = T / 200 + i * 2;
          s.position.x = (i - 1) * 1.5 + (g > 0.05 ? Math.cos(a) * 0.12 : 0);
          s.position.z = g > 0.05 ? Math.sin(a) * 0.12 : 0;
        });
      }
    });

    // Chromatin & Dust rotations
    if (this.chromMesh) {
      this.chromMesh.rotation.y = this.reducedMotion ? 0 : T / 1800;
    }
    if (this.cytoDust) {
      this.cytoDust.rotation.y += this.reducedMotion ? 0 : dt * 0.02;
    }
    if (this.medDust) {
      this.medDust.rotation.y += this.reducedMotion ? 0 : dt * 0.01;
    }

    // Nutrient floating
    this.nutrientOrbs.forEach((m, i) => {
      m.position.y =
        this.OUT_POS[i].y + (this.reducedMotion ? 0 : Math.sin(T / 700 + i * 2) * 0.5);
    });

    // Particle FX
    for (let i = this.activeFx.length - 1; i >= 0; i--) {
      const f = this.activeFx[i];
      const u = (T - f.t0) / f.d;
      if (u < 0) continue;
      f.m.visible = true;
      if (u >= 1) {
        this.scene.remove(f.m);
        if (Array.isArray(f.h.material)) {
          f.h.material.forEach((m) => m.dispose());
        } else {
          f.h.material.dispose();
        }
        this.activeFx.splice(i, 1);
        if (f.done) f.done();
        continue;
      }
      const e = u * u * (3 - 2 * u);
      if (f.cv) {
        f.m.position.copy(f.cv.getPoint(e));
      } else {
        f.m.position.copy(f.a).addScaledVector(new THREE.Vector3(0, 1, 0), e * 3);
      }
      if (f.c2 && u > 0.5 && !f.sw) {
        f.sw = 1;
        f.m.material = this.pm(f.c2);
        (f.h.material as THREE.MeshBasicMaterial).color.setHex(f.c2);
      }
      f.m.scale.setScalar(f.r * Math.min(1, (1 - u) * 6, u * 8 + 0.25));
    }

    // Camera smoothing & auto-orbit
    const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 3);
    this.target.lerp(this.followTarget, k);
    this.dist += (this.followDist - this.dist) * k;

    if (!this.reducedMotion && !this.selectedOrganelleKey && !this.isBusy && T - this.lastInputTime > 4000) {
      this.yaw += dt * 0.05;
    }

    this.camera.position.set(
      this.target.x + this.dist * Math.cos(this.pitch) * Math.sin(this.yaw),
      this.target.y + this.dist * Math.sin(this.pitch),
      this.target.z + this.dist * Math.cos(this.pitch) * Math.cos(this.yaw),
    );
    this.camera.lookAt(this.target);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.renderer.dispose();
  }
}
