/**
 * Entry Point M6 Biolab 3D Console (UI-117..119).
 * Menghubungkan 3D Living Cell (Three.js), NutrientBurstBadge (UI-117),
 * ZoneBanner (UI-118), dan ThresholdBreachLog (UI-119) dengan polling <2 detik.
 */

import type {
  MacroTelemetryState,
  NutrientBurstState,
  OrganelleAllocation,
  RenderMode,
  SkinMode,
  ThresholdBreachEvent,
} from "./types.ts";
import {
  KAMUS_ANGKA,
  classifyZone,
} from "./types.ts";
import { NutrientBurstBadgeController } from "./components/NutrientBurstBadge.ts";
import { ZoneBannerController } from "./components/ZoneBanner.ts";
import { ThresholdBreachLogController } from "./components/ThresholdBreachLog.ts";
import { CrucibleScene3D } from "./scene3d.ts";
import { bioSound } from "./sound.ts";

class SnaccBiolabApp {
  private skin: SkinMode = "biolab";
  private renderMode: RenderMode = "3d";
  private vitality = 8500;
  private atpBalance = 1420;
  private organel: OrganelleAllocation = {
    mitokondria: 2,
    nukleus: 1,
    lisosom: 1,
  };

  private macro: MacroTelemetryState = {
    crucibleTemp: 605,
    zone: "Goldilocks",
    currentEpoch: 1,
    totalVitaSupply: "1000000000",
    totalVitaBurned: "35000",
    ruleBoundTreasury: "200000000",
    epochVolume: "42000",
    feastTargetVolume: "50000",
    contractId: "snacc-v001.testnet",
    blockHeight: 223270808,
  };

  private burst: NutrientBurstState = {
    isActive: true,
    activeBurstBps: KAMUS_ANGKA.BURST_BASE_BPS,
    untilEpoch: 2,
    releasedVita: 7200,
    triggeringStrainId: 3,
    lastUpdatedMs: Date.now(),
  };

  private events: ThresholdBreachEvent[] = [];

  private readonly shellEl: HTMLElement;
  private readonly burstController: NutrientBurstBadgeController;
  private readonly zoneController: ZoneBannerController;
  private readonly breachController: ThresholdBreachLogController;
  private readonly scene3d: CrucibleScene3D;

  constructor() {
    this.shellEl = document.getElementById("app")!;
    const stageEl = document.getElementById("crucible-stage")!;
    const burstMount = document.getElementById("mount-burst-badge")!;
    const zoneMount = document.getElementById("mount-zone-banner")!;
    const breachMount = document.getElementById("mount-breach-log")!;

    this.seedInitialGladiEvents();

    this.burstController = new NutrientBurstBadgeController(burstMount, () =>
      this.simulateNutrientBurst(),
    );
    this.zoneController = new ZoneBannerController(zoneMount);
    this.breachController = new ThresholdBreachLogController(breachMount, (evt) =>
      this.replayEventIn3D(evt),
    );

    this.scene3d = new CrucibleScene3D(stageEl, {
      onSporeHarvested: (kind, bonusTempMk) => {
        bioSound.playSporeAbsorb();
        this.vitality = Math.min(KAMUS_ANGKA.VITALITY_MAX, this.vitality + 180);
        this.atpBalance += 45 + this.organel.mitokondria * 10;
        const prevTemp = this.macro.crucibleTemp;
        const nextTemp = Math.min(690, prevTemp + bonusTempMk);
        this.applyTemperatureShift(
          nextTemp,
          `s-1.snacc-v001.testnet`,
          `Absorbed 3D ${kind.toUpperCase()} molecule in bioreactor (+${bonusTempMk} mK metabolic heat)`,
        );
      },
    });

    this.bindControls();
    this.syncAllViews();
    this.startLivePolling();
  }

  private seedInitialGladiEvents(): void {
    const now = Date.now();
    this.events = [
      {
        id: "gladi-evt-3",
        kind: "zone_changed",
        actor: "alkemis.testnet",
        strainId: 1,
        epoch: 1,
        fromZone: "Hypothermia",
        toZone: "Goldilocks",
        crucibleTemp: 605,
        tempDeltaMk: 14,
        summary: "ATP feeding batch pushed CrucibleTemp into Goldilocks equilibrium band (600–610 mK)",
        emittedAtMs: now - 420,
        renderedAtMs: now - 310,
      },
      {
        id: "gladi-evt-2",
        kind: "nutrient_burst_released",
        actor: "likuidator.testnet",
        strainId: 3,
        epoch: 1,
        crucibleTemp: 591,
        tempDeltaMk: 0,
        burstBps: 2000,
        releasedVita: 7200,
        untilEpoch: 2,
        summary: "Cell Lysis on starving Strain #3 released 7,200 VITA (-20.00% global feed discount)",
        emittedAtMs: now - 1200,
        renderedAtMs: now - 1060,
      },
      {
        id: "gladi-evt-1",
        kind: "strain_liquidated",
        actor: "Strain #3",
        strainId: 3,
        epoch: 1,
        crucibleTemp: 591,
        tempDeltaMk: -9,
        summary: "harvest_starving_strain(3): 10% bounty to liquidator, 90% kas returned to Rule-Bound Treasury",
        emittedAtMs: now - 2400,
        renderedAtMs: now - 2280,
      },
    ];
  }

  private bindControls(): void {
    const btnBiolab = document.getElementById("btn-skin-biolab");
    const btnFintech = document.getElementById("btn-skin-fintech");
    btnBiolab?.addEventListener("click", () => {
      this.skin = "biolab";
      btnBiolab.setAttribute("data-active", "true");
      btnFintech?.setAttribute("data-active", "false");
      this.syncAllViews();
    });
    btnFintech?.addEventListener("click", () => {
      this.skin = "fintech";
      btnFintech.setAttribute("data-active", "true");
      btnBiolab?.setAttribute("data-active", "false");
      this.syncAllViews();
    });

    const btnSound = document.getElementById("btn-sound");
    btnSound?.addEventListener("click", () => {
      bioSound.enabled = !bioSound.enabled;
      btnSound.setAttribute("data-active", String(bioSound.enabled));
      btnSound.textContent = bioSound.enabled ? "SFX On" : "SFX Off";
      if (bioSound.enabled) bioSound.playSporeAbsorb();
    });

    const btnRender = document.getElementById("btn-render-mode");
    btnRender?.addEventListener("click", () => {
      this.renderMode = this.renderMode === "3d" ? "2d-fallback" : "3d";
      const is2d = this.renderMode === "2d-fallback";
      btnRender.setAttribute("data-active", String(is2d));
      this.shellEl.setAttribute("data-render", this.renderMode);
      this.scene3d.setRenderPaused(is2d);
    });

    // Organelle ATP Allocation Pills (EN-119)
    document.getElementById("btn-org-mito")?.addEventListener("click", (e) => {
      if (this.atpBalance < 100) return;
      this.atpBalance -= 100;
      this.organel.mitokondria = (this.organel.mitokondria % 4) + 1;
      (e.currentTarget as HTMLElement).textContent =
        `+ Mitokondria Lv.${this.organel.mitokondria} (+${this.organel.mitokondria * 10}% ATP)`;
      bioSound.playSporeAbsorb();
      this.syncAllViews();
    });

    document.getElementById("btn-org-nukleus")?.addEventListener("click", (e) => {
      if (this.atpBalance < 100) return;
      this.atpBalance -= 100;
      this.organel.nukleus = (this.organel.nukleus % 4) + 1;
      (e.currentTarget as HTMLElement).textContent =
        `+ Nukleus Lv.${this.organel.nukleus} (+${this.organel.nukleus * 10}% Yield)`;
      bioSound.playSporeAbsorb();
      this.syncAllViews();
    });

    document.getElementById("btn-org-lisosom")?.addEventListener("click", (e) => {
      if (this.atpBalance < 100) return;
      this.atpBalance -= 100;
      this.organel.lisosom = (this.organel.lisosom % 4) + 1;
      (e.currentTarget as HTMLElement).textContent =
        `+ Lisosom Lv.${this.organel.lisosom} (-${this.organel.lisosom * 10}% BMR)`;
      bioSound.playSporeAbsorb();
      this.syncAllViews();
    });

    // Simulator Triggers untuk menguji UI-117..119 secara langsung
    document.getElementById("sim-hypo")?.addEventListener("click", () => {
      this.applyTemperatureShift(
        575,
        "dormant-colony.testnet",
        "Metabolic cooldown breached <600 mK threshold -> +2.00% Catalyst Rebate activated (I-04)",
      );
    });

    document.getElementById("sim-gold")?.addEventListener("click", () => {
      this.applyTemperatureShift(
        605,
        "alkemis.testnet",
        "Balanced feeding restored Goldilocks homeostasis (600–610 mK neutral band)",
      );
    });

    document.getElementById("sim-fever")?.addEventListener("click", () => {
      this.applyTemperatureShift(
        632,
        "whale-splicer.testnet",
        "High-velocity transmutation breached >610 mK threshold -> 3.50% Calcination Fever burn active (I-01)",
      );
    });

    document.getElementById("sim-burst")?.addEventListener("click", () => {
      this.simulateNutrientBurst();
    });

    // Tinycharts Modal Dialog Trigger
    const modal = document.getElementById("tinycharts-modal");
    const openModal = () => {
      if (modal) modal.hidden = false;
      bioSound.playSporeAbsorb();
    };
    const closeModal = () => {
      if (modal) modal.hidden = true;
    };
    document.getElementById("btn-open-tinycharts")?.addEventListener("click", openModal);
    document.getElementById("btn-close-tinycharts")?.addEventListener("click", closeModal);
    document.getElementById("tinycharts-backdrop")?.addEventListener("click", closeModal);
  }

  private applyTemperatureShift(nextTempMk: number, actor: string, reason: string): void {
    const prevZone = classifyZone(this.macro.crucibleTemp);
    const nextZone = classifyZone(nextTempMk);
    const delta = nextTempMk - this.macro.crucibleTemp;
    this.macro.crucibleTemp = nextTempMk;
    this.macro.zone = nextZone;

    const emittedAt = Date.now() - 18;
    const newEvt: ThresholdBreachEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "zone_changed",
      actor,
      epoch: this.macro.currentEpoch,
      fromZone: prevZone,
      toZone: nextZone,
      crucibleTemp: nextTempMk,
      tempDeltaMk: delta,
      summary: reason,
      emittedAtMs: emittedAt,
      renderedAtMs: Date.now(),
    };

    this.events = [newEvt, ...this.events.slice(0, 11)];
    if (prevZone !== nextZone) {
      bioSound.playZoneShift(nextZone);
    }
    this.syncAllViews();
  }

  private simulateNutrientBurst(): void {
    const nextBps =
      this.burst.activeBurstBps >= KAMUS_ANGKA.BURST_CAP_BPS
        ? KAMUS_ANGKA.BURST_BASE_BPS
        : Math.min(KAMUS_ANGKA.BURST_CAP_BPS, this.burst.activeBurstBps + 500);

    const donorId = ((this.burst.triggeringStrainId ?? 2) % 7) + 2;
    const released = 7200 + donorId * 450;

    this.burst = {
      isActive: true,
      activeBurstBps: nextBps,
      untilEpoch: this.macro.currentEpoch + 1,
      releasedVita: released,
      triggeringStrainId: donorId,
      lastUpdatedMs: Date.now(),
    };

    const emittedAt = Date.now() - 12;
    const burstEvt: ThresholdBreachEvent = {
      id: `burst-${Date.now()}`,
      kind: "nutrient_burst_released",
      actor: `Strain #${donorId}`,
      strainId: donorId,
      epoch: this.macro.currentEpoch,
      crucibleTemp: this.macro.crucibleTemp,
      tempDeltaMk: 0,
      burstBps: nextBps,
      releasedVita: released,
      untilEpoch: this.macro.currentEpoch + 1,
      summary: `harvest_starving_strain(${donorId}) triggered -${(nextBps / 100).toFixed(2)}% global feed discount until Epoch #${this.macro.currentEpoch + 1}`,
      emittedAtMs: emittedAt,
      renderedAtMs: Date.now(),
    };

    this.events = [burstEvt, ...this.events.slice(0, 11)];
    bioSound.playNutrientBurst();
    this.scene3d.triggerNutrientBurstWave();
    this.syncAllViews();
  }

  private replayEventIn3D(evt: ThresholdBreachEvent): void {
    this.macro.crucibleTemp = evt.crucibleTemp;
    this.macro.zone = classifyZone(evt.crucibleTemp);
    if (evt.kind === "nutrient_burst_released") {
      this.scene3d.triggerNutrientBurstWave();
      bioSound.playNutrientBurst();
    } else {
      bioSound.playZoneShift(this.macro.zone);
    }
    this.syncAllViews();
  }

  private syncAllViews(): void {
    const zone = classifyZone(this.macro.crucibleTemp);
    this.shellEl.setAttribute("data-zone", zone);
    this.shellEl.setAttribute("data-skin", this.skin);

    this.burstController.update(this.burst, this.macro.currentEpoch);
    this.zoneController.update(this.macro, this.skin);
    this.breachController.renderEvents(this.events);

    this.scene3d.setTelemetryState({
      crucibleTemp: this.macro.crucibleTemp,
      skin: this.skin,
      vitalityRatio: this.vitality / KAMUS_ANGKA.VITALITY_MAX,
      organel: this.organel,
    });

    const vitEl = document.getElementById("kpi-vitality");
    if (vitEl) {
      vitEl.textContent = `${this.vitality.toLocaleString("en-US")} / 10,000`;
    }
    const atpEl = document.getElementById("kpi-atp");
    if (atpEl) {
      atpEl.textContent = `${this.atpBalance.toLocaleString("en-US")} ATP`;
    }
  }

  /**
   * Polling ringan ke backend `/api/crucible/macro` & `/api/events` (interval 1.5 dtk < 2 dtk SLA).
   * Bila backend lokal belum dinyalakan, aplikasi tetap interaktif penuh dengan state gladi.
   */
  private startLivePolling(): void {
    setInterval(async () => {
      try {
        const res = await fetch("/api/crucible/macro");
        if (!res.ok) return;
        const data = (await res.json()) as Partial<MacroTelemetryState>;
        if (typeof data.crucibleTemp === "number" && data.crucibleTemp !== this.macro.crucibleTemp) {
          this.applyTemperatureShift(
            data.crucibleTemp,
            data.contractId ?? "snacc-v001.testnet",
            `Live RPC sync at block #${data.blockHeight ?? this.macro.blockHeight}`,
          );
        }
      } catch {
        // Mode standalone aktif bila server backend lokal tidak berjalan
      }
    }, 1500);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new SnaccBiolabApp();
});
