/**
 * UI-117: the Global Nutrient Burst Badge.
 * A diegetic HUD pill above the 3D tank that lights up on a cell lysis (harvest_starving_strain).
 * Uses the popOver spring curve from motionmaxxing (FE-26) with no inline styles (honors FE-01 CSP).
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
 * The pure view-model builder for UI-117 so `node --test` can test it directly (FE-04).
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
 * The DOM controller for the UI-117 pill on the main screen.
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

/**
 * Exact UI-117 text formatter:
 * "Nutrient Burst: feed fee −X% until epoch N" (X = burst_bps/100, tanda minus U+2212).
 */
export function formatBurstBadgeText(burstBps: number, untilEpoch: number): string {
  const percent = burstBps / 100;
  return `Nutrient Burst: feed fee \u2212${percent}% until epoch ${untilEpoch}`;
}

