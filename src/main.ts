/**
 * Entry Point Snacc Biolab 3D Console (UI-117..126).
 * Menghubungkan 3D Isometric Bioreactor (CrucibleScene3D),
 * NutrientBurstBadge (UI-117), ZoneBanner (UI-118),
 * ThresholdBreachLog (UI-119), dan kontrol interaktif <2 detik SLA.
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
import { CrucibleScene3D, type SceneHover, type ThemeMode } from "./scene3d.ts";
import { bioSound } from "./sound.ts";

class SnaccBiolabApp {
  private skin: SkinMode = "biolab";
  private theme: ThemeMode = "bioluminescent";
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
  private readonly tooltipEl: HTMLElement | null;
  private readonly toastRegionEl: HTMLElement | null;

  constructor() {
    this.shellEl = document.getElementById("app")!;
    const stageEl = document.getElementById("crucible-stage")!;
    const burstMount = document.getElementById("mount-burst-badge")!;
    const zoneMount = document.getElementById("mount-zone-banner")!;
    const breachMount = document.getElementById("mount-breach-log")!;
    this.tooltipEl = document.getElementById("scene-tooltip");
    this.toastRegionEl = document.getElementById("toast-region");

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
          `Absorbed 3D ${kind.toUpperCase()} spore in bioreactor (+${bonusTempMk} mK metabolic heat)`,
        );
        this.showToast("Spore Harvested", `+180 Vitality, +${45 + this.organel.mitokondria * 10} ATP`);
      },
      onBellActivated: () => {
        this.simulateNutrientBurst();
      },
      onThermostatActivated: () => {
        this.nudgeThermostat();
      },
      onCellActivated: () => {
        this.feedStrain();
      },
      onHoverChange: (hover) => {
        this.handleHoverChange(hover);
      },
    });

    this.bindControls();
    this.syncAllViews();
    this.startLivePolling();
  }

  private handleHoverChange(hover: SceneHover | null): void {
    if (!this.tooltipEl) return;
    if (!hover) {
      this.tooltipEl.hidden = true;
      return;
    }
    this.tooltipEl.hidden = false;
    this.tooltipEl.style.left = `${hover.x + 12}px`;
    this.tooltipEl.style.top = `${hover.y - 12}px`;
    this.tooltipEl.innerHTML = `<strong>${hover.label}</strong><span>${hover.hint}</span>`;
  }

  private feedStrain(): void {
    bioSound.playSporeAbsorb();
    this.vitality = Math.min(KAMUS_ANGKA.VITALITY_MAX, this.vitality + 220);
    const atpGain = 35 + this.organel.mitokondria * 15;
    this.atpBalance += atpGain;
    const nextTemp = Math.min(670, this.macro.crucibleTemp + 3);
    this.applyTemperatureShift(
      nextTemp,
      "s-1.snacc-v001.testnet",
      `Direct cell nutrient feeding added metabolic heat (+3 mK) and +${atpGain} ATP`,
    );
    this.showToast("Strain #1 Fed", `Vitality boosted (+220), +${atpGain} ATP generated`);
  }

  private nudgeThermostat(): void {
    const currentZone = classifyZone(this.macro.crucibleTemp);
    let nextTemp = 605;
    if (currentZone === "Goldilocks") nextTemp = 632;
    else if (currentZone === "Fever") nextTemp = 575;
    else nextTemp = 605;

    this.applyTemperatureShift(
      nextTemp,
      "thermostat-dial.manual",
      `Manual thermostat regulation set target to ${nextTemp} mK (${classifyZone(nextTemp)})`,
    );
    this.showToast("Thermostat Dial", `Adjusted temperature to ${nextTemp} mK (${classifyZone(nextTemp)})`);
  }

  private showToast(title: string, body: string): void {
    if (!this.toastRegionEl) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span class="toast__title">${title}</span><span class="toast__body">${body}</span>`;
    this.toastRegionEl.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("is-exiting");
      setTimeout(() => toast.remove(), 260);
    }, 3200);
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
    // Theme Switcher (Daylight / Bioluminescent)
    const btnTheme = document.getElementById("btn-theme");
    btnTheme?.addEventListener("click", () => {
      this.theme = this.theme === "bioluminescent" ? "daylight" : "bioluminescent";
      this.shellEl.setAttribute("data-theme", this.theme);
      btnTheme.setAttribute("aria-pressed", String(this.theme === "daylight"));
      btnTheme.setAttribute("aria-label", this.theme === "daylight" ? "Switch to bioluminescent theme" : "Switch to daylight theme");
      const iconUse = btnTheme.querySelector("use");
      if (iconUse) {
        iconUse.setAttribute("href", this.theme === "daylight" ? "#i-sun" : "#i-moon");
      }
      this.scene3d.setTheme(this.theme);
      this.showToast("Theme Changed", `Activated ${this.theme} mode`);
    });

    // Sound FX Toggle
    const btnSound = document.getElementById("btn-sound");
    btnSound?.addEventListener("click", () => {
      bioSound.enabled = !bioSound.enabled;
      btnSound.setAttribute("aria-pressed", String(bioSound.enabled));
      btnSound.setAttribute("aria-label", bioSound.enabled ? "Disable sound" : "Enable sound");
      const iconUse = btnSound.querySelector("use");
      if (iconUse) {
        iconUse.setAttribute("href", bioSound.enabled ? "#i-sound-on" : "#i-sound-off");
      }
      if (bioSound.enabled) {
        bioSound.playSporeAbsorb();
        this.showToast("Audio SFX", "Sound effects enabled");
      } else {
        this.showToast("Audio SFX", "Sound effects muted");
      }
    });

    // Render Mode Toggle (3D Diorama vs 2D Poster)
    const btnRender = document.getElementById("btn-render") ?? document.getElementById("btn-render-mode");
    btnRender?.addEventListener("click", () => {
      this.renderMode = this.renderMode === "3d" ? "2d-fallback" : "3d";
      const is2d = this.renderMode === "2d-fallback";
      btnRender.setAttribute("aria-pressed", String(is2d));
      btnRender.setAttribute("aria-label", is2d ? "Switch to 3D diorama" : "Switch to 2D poster view");
      this.shellEl.setAttribute("data-render", is2d ? "2d-fallback" : "3d");
      this.scene3d.setRenderPaused(is2d);
      this.showToast("Render Mode", is2d ? "Switched to 2D poster view" : "Switched to 3D isometric diorama");
    });

    // Reset Camera View
    document.getElementById("btn-reset-camera")?.addEventListener("click", () => {
      this.scene3d.resetCamera();
      this.showToast("Camera Reset", "Returned to default isometric angle");
    });

    // Feed Button
    document.getElementById("btn-feed")?.addEventListener("click", () => {
      this.feedStrain();
    });

    // Help / Field Guide Dialog
    const helpDialog = document.getElementById("help-dialog") as HTMLDialogElement | null;
    document.getElementById("btn-help")?.addEventListener("click", () => {
      helpDialog?.showModal();
    });
    document.getElementById("btn-close-help")?.addEventListener("click", () => {
      helpDialog?.close();
    });
    helpDialog?.addEventListener("click", (e) => {
      if (e.target === helpDialog) helpDialog.close();
    });

    // Organelle ATP Allocation Pills
    document.getElementById("btn-org-mito")?.addEventListener("click", () => {
      if (this.atpBalance < 100) {
        this.showToast("Insufficient ATP", "Requires at least 100 ATP");
        return;
      }
      this.atpBalance -= 100;
      this.organel.mitokondria = (this.organel.mitokondria % 5) + 1;
      bioSound.playSporeAbsorb();
      this.syncOrganelleDisplays();
      this.syncAllViews();
      this.showToast("Mitochondria Upgraded", `Reached Lv.${this.organel.mitokondria} (+${this.organel.mitokondria * 10}% ATP)`);
    });

    document.getElementById("btn-org-nukleus")?.addEventListener("click", () => {
      if (this.atpBalance < 100) {
        this.showToast("Insufficient ATP", "Requires at least 100 ATP");
        return;
      }
      this.atpBalance -= 100;
      this.organel.nukleus = (this.organel.nukleus % 5) + 1;
      bioSound.playSporeAbsorb();
      this.syncOrganelleDisplays();
      this.syncAllViews();
      this.showToast("Nucleus Upgraded", `Reached Lv.${this.organel.nukleus} (+${this.organel.nukleus * 10}% Yield)`);
    });

    document.getElementById("btn-org-lisosom")?.addEventListener("click", () => {
      if (this.atpBalance < 100) {
        this.showToast("Insufficient ATP", "Requires at least 100 ATP");
        return;
      }
      this.atpBalance -= 100;
      this.organel.lisosom = (this.organel.lisosom % 5) + 1;
      bioSound.playSporeAbsorb();
      this.syncOrganelleDisplays();
      this.syncAllViews();
      this.showToast("Lysosome Upgraded", `Reached Lv.${this.organel.lisosom} (-${this.organel.lisosom * 10}% BMR)`);
    });

    // Simulator Triggers
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

    // Mobile Bottom Tabs
    const tabs = document.querySelectorAll<HTMLButtonElement>(".mobile-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;
        if (!targetTab) return;
        this.shellEl.setAttribute("data-mobile-tab", targetTab);
        tabs.forEach((t) => {
          const isSelected = t === tab;
          t.setAttribute("aria-selected", String(isSelected));
          t.setAttribute("tabindex", isSelected ? "0" : "-1");
        });
      });
    });

    // Global Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      const activeTag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if (e.key === "1") {
        document.getElementById("sim-hypo")?.click();
      } else if (e.key === "2") {
        document.getElementById("sim-gold")?.click();
      } else if (e.key === "3") {
        document.getElementById("sim-fever")?.click();
      } else if (e.key === "b" || e.key === "B") {
        document.getElementById("sim-burst")?.click();
      } else if (e.key === "f" || e.key === "F") {
        this.feedStrain();
      } else if (e.key === "r" || e.key === "R") {
        this.scene3d.resetCamera();
      } else if (e.key === "t" || e.key === "T") {
        btnTheme?.click();
      } else if (e.key === "s" || e.key === "S") {
        btnSound?.click();
      } else if (e.key === "?") {
        e.preventDefault();
        if (helpDialog?.open) helpDialog.close();
        else helpDialog?.showModal();
      }
    });
  }

  private syncOrganelleDisplays(): void {
    const mitoLevel = document.querySelector("[data-organ-level='mitokondria']");
    const mitoEffect = document.querySelector("[data-organ-effect='mitokondria']");
    if (mitoLevel) mitoLevel.textContent = `Lv.${this.organel.mitokondria}`;
    if (mitoEffect) mitoEffect.textContent = `+${this.organel.mitokondria * 10}% ATP yield`;

    const nukLevel = document.querySelector("[data-organ-level='nukleus']");
    const nukEffect = document.querySelector("[data-organ-effect='nukleus']");
    if (nukLevel) nukLevel.textContent = `Lv.${this.organel.nukleus}`;
    if (nukEffect) nukEffect.textContent = `+${this.organel.nukleus * 10}% enzyme yield`;

    const lisoLevel = document.querySelector("[data-organ-level='lisosom']");
    const lisoEffect = document.querySelector("[data-organ-effect='lisosom']");
    if (lisoLevel) lisoLevel.textContent = `Lv.${this.organel.lisosom}`;
    if (lisoEffect) lisoEffect.textContent = `−${this.organel.lisosom * 10}% basal metabolism`;
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
    this.showToast("Bell of Plenty Struck", `Lysis triggered -${(nextBps / 100).toFixed(2)}% feed discount`);
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
      vitEl.innerHTML = `${this.vitality.toLocaleString("en-US")} <small>/ 10,000</small>`;
    }

    const vitMeter = document.getElementById("vitality-meter");
    if (vitMeter) {
      vitMeter.setAttribute("aria-valuenow", String(this.vitality));
    }

    const vitFill = document.getElementById("vitality-fill");
    if (vitFill) {
      const pct = Math.min(100, Math.max(0, Math.round((this.vitality / KAMUS_ANGKA.VITALITY_MAX) * 100)));
      vitFill.style.width = `${pct}%`;
      vitFill.setAttribute("data-level", String(pct));
    }

    const atpEl = document.getElementById("kpi-atp");
    if (atpEl) {
      atpEl.innerHTML = `${this.atpBalance.toLocaleString("en-US")} <small>ATP</small>`;
    }

    const strainStatus = document.getElementById("strain-status");
    const strainStatusLabel = document.getElementById("strain-status-label");
    if (strainStatus && strainStatusLabel) {
      if (zone === "Fever") {
        strainStatus.setAttribute("data-state", "warning");
        strainStatusLabel.textContent = "Fever Hyperthermia";
      } else if (zone === "Hypothermia") {
        strainStatus.setAttribute("data-state", "cooling");
        strainStatusLabel.textContent = "Cryo Dormant";
      } else {
        strainStatus.setAttribute("data-state", "active");
        strainStatusLabel.textContent = "Homeostatic";
      }
    }

    // 2D Fallback Readouts
    const fallbackTemp = document.getElementById("fallback-temp");
    if (fallbackTemp) fallbackTemp.textContent = `${this.macro.crucibleTemp} mK`;
    const fallbackZone = document.getElementById("fallback-zone");
    if (fallbackZone) {
      fallbackZone.textContent = `${zone.toUpperCase()} ${
        zone === "Goldilocks" ? "HOMEOSTASIS" : zone === "Fever" ? "CALCINATION" : "REBATE"
      }`;
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
        const chipEl = document.getElementById("feed-status");
        const chipLabel = document.getElementById("feed-status-label");
        if (chipEl && chipLabel) {
          chipEl.setAttribute("data-state", "live");
          chipLabel.textContent = "Live RPC";
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
