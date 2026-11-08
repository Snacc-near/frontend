/**
 * UI-117: Badge Nutrient Burst Global.
 * Diegetic pill HUD di atas akuarium 3D yang menyala saat terjadi lisis sel (harvest_starving_strain).
 * Memakai kurva pegas popOver dari motionmaxxing (FE-26) dan bebas inline style (patuh FE-01 CSP).
 */

import type { NutrientBurstState } from "../types.ts";
import {
  computeActiveBurstBps,
  computeBurstEpochsRemaining,
  formatBps,
} from "../types.ts";

export interface BurstBadgeViewModel {
  stateAttr: "active" | "standby";
  discountLabel: string;
  epochRemainingLabel: string;
  donorLabel: string;
  vitaReleasedLabel: string;
}

/**
 * Pure view-model builder untuk UI-117 agar dapat diuji langsung oleh `node --test` (FE-04).
 */
export function buildBurstBadgeViewModel(
  burst: NutrientBurstState,
  currentEpoch: number,
): BurstBadgeViewModel {
  const effectiveBps = computeActiveBurstBps(burst.activeBurstBps, burst.untilEpoch, currentEpoch);
  const isActive = burst.isActive && effectiveBps > 0;
  const remaining = computeBurstEpochsRemaining(burst.untilEpoch, currentEpoch);

  if (!isActive) {
    return {
      stateAttr: "standby",
      discountLabel: "0.00% STANDBY",
      epochRemainingLabel: "Awaiting Lysis Harvest",
      donorLabel: "No recent cell lysis",
      vitaReleasedLabel: "0 VITA",
    };
  }

  return {
    stateAttr: "active",
    discountLabel: `-${formatBps(effectiveBps)} FEED DISCOUNT`,
    epochRemainingLabel: `${remaining} Epoch${remaining === 1 ? "" : "s"} Left (Until E#${burst.untilEpoch})`,
    donorLabel:
      burst.triggeringStrainId !== null
        ? `Donor: Strain #${burst.triggeringStrainId}`
        : "Ecosystem Burst",
    vitaReleasedLabel: `+${burst.releasedVita.toLocaleString("en-US")} VITA Released`,
  };
}

/**
 * Controller DOM untuk pill UI-117 di layar utama.
 */
export class NutrientBurstBadgeController {
  private readonly root: HTMLButtonElement;
  private readonly statusDot: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly metaEl: HTMLElement;
  private readonly donorEl: HTMLElement;

  constructor(mount: HTMLElement, onTriggerDemoBurst: () => void) {
    this.root = document.createElement("button");
    this.root.type = "button";
    this.root.className = "burst-pill";
    this.root.setAttribute("data-testid", "nutrient-burst-badge");
    this.root.setAttribute("data-state", "standby");
    this.root.setAttribute("title", "Click to simulate Cell Lysis & Nutrient Burst shockwave in 3D");

    this.statusDot = document.createElement("span");
    this.statusDot.className = "burst-pill__beacon";

    const content = document.createElement("span");
    content.className = "burst-pill__body";

    const topRow = document.createElement("span");
    topRow.className = "burst-pill__top";

    const eyebrow = document.createElement("span");
    eyebrow.className = "burst-pill__tag";
    eyebrow.textContent = "NUTRIENT BURST";

    this.titleEl = document.createElement("strong");
    this.titleEl.className = "burst-pill__discount";

    topRow.append(eyebrow, this.titleEl);

    const bottomRow = document.createElement("span");
    bottomRow.className = "burst-pill__sub";

    this.metaEl = document.createElement("span");
    this.donorEl = document.createElement("span");
    this.donorEl.className = "burst-pill__donor";

    bottomRow.append(this.metaEl, this.donorEl);
    content.append(topRow, bottomRow);

    this.root.append(this.statusDot, content);
    this.root.addEventListener("click", onTriggerDemoBurst);
    mount.appendChild(this.root);
  }

  public update(burst: NutrientBurstState, currentEpoch: number): BurstBadgeViewModel {
    const vm = buildBurstBadgeViewModel(burst, currentEpoch);
    const prevState = this.root.getAttribute("data-state");
    this.root.setAttribute("data-state", vm.stateAttr);

    if (prevState !== vm.stateAttr && vm.stateAttr === "active") {
      this.root.classList.remove("burst-pill--pop");
      void this.root.offsetWidth;
      this.root.classList.add("burst-pill--pop");
    }

    this.titleEl.textContent = vm.discountLabel;
    this.metaEl.textContent = `${vm.epochRemainingLabel} · ${vm.vitaReleasedLabel}`;
    this.donorEl.textContent = vm.donorLabel;
    return vm;
  }
}
