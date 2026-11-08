/**
 * UI-118: Banner Zona Makro & Spektrum Termostat CrucibleTemp.
 * Menampilkan posisi suhu ekonomi real-time (<600 mK Hypothermia, 600..610 mK Goldilocks, >610 mK Fever),
 * aturan moneter bank sentral algoritmik (I-01 Burn 3.50% vs I-04 Rebate 2.00%), serta ADR-31 Dual-Skin.
 */

import type {
  MacroTelemetryState,
  MacroZone,
  SkinMode,
} from "../types.ts";
import {
  KAMUS_ANGKA,
  classifyZone,
  computeThermalGaugeRatio,
  describeZonePolicy,
} from "../types.ts";
import { dur, ease, tweenValue } from "../motion.ts";

export interface ZoneBannerViewModel {
  zone: MacroZone;
  tempLabel: string;
  epochLabel: string;
  gaugePercent: number;
  badgeLabel: string;
  headline: string;
  policyRule: string;
  rateLabel: string;
  invariantCode: string;
}

/**
 * Pure view-model builder untuk UI-118 (diuji langsung di `node --test`).
 */
export function buildZoneBannerViewModel(
  macro: Pick<MacroTelemetryState, "crucibleTemp" | "currentEpoch">,
  skin: SkinMode,
): ZoneBannerViewModel {
  const zone = classifyZone(macro.crucibleTemp);
  const policy = describeZonePolicy(zone, skin);
  const ratio = computeThermalGaugeRatio(macro.crucibleTemp);

  return {
    zone,
    tempLabel: `${Math.round(macro.crucibleTemp)} mK`,
    epochLabel: `EPOCH #${macro.currentEpoch}`,
    gaugePercent: Math.round(ratio * 1000) / 10,
    badgeLabel: policy.badgeLabel,
    headline: policy.headline,
    policyRule: policy.policyRule,
    rateLabel: policy.rateLabel,
    invariantCode: policy.invariantCode,
  };
}

/**
 * Controller DOM untuk instrumen termostat zona makro UI-118.
 */
export class ZoneBannerController {
  private readonly root: HTMLElement;
  private readonly zonePill: HTMLElement;
  private readonly ratePill: HTMLElement;
  private readonly tempValueEl: HTMLElement;
  private readonly epochValueEl: HTMLElement;
  private readonly headlineEl: HTMLElement;
  private readonly policyEl: HTMLElement;
  private readonly markerEl: HTMLElement;
  private currentDisplayedTemp = 605;
  private cancelTween: (() => void) | null = null;

  constructor(mount: HTMLElement) {
    this.root = document.createElement("section");
    this.root.className = "zone-instrument";
    this.root.setAttribute("data-testid", "zone-banner");
    this.root.setAttribute("data-zone", "Goldilocks");

    // Baris atas: pil zona + angka besar tanpa kartu kotak (aturan DS-00 & M5)
    const headerRow = document.createElement("div");
    headerRow.className = "zone-instrument__header";

    const pillGroup = document.createElement("div");
    pillGroup.className = "zone-instrument__pills";

    this.zonePill = document.createElement("span");
    this.zonePill.className = "zone-pill";

    this.ratePill = document.createElement("span");
    this.ratePill.className = "rate-pill";

    pillGroup.append(this.zonePill, this.ratePill);

    const readoutGroup = document.createElement("div");
    readoutGroup.className = "zone-instrument__readout";

    this.tempValueEl = document.createElement("span");
    this.tempValueEl.className = "zone-instrument__temp";

    this.epochValueEl = document.createElement("span");
    this.epochValueEl.className = "zone-instrument__epoch";

    readoutGroup.append(this.tempValueEl, this.epochValueEl);
    headerRow.append(pillGroup, readoutGroup);

    // Spektrum termal horisontal dengan penanda ambang 600 mK & 610 mK
    const trackWrap = document.createElement("div");
    trackWrap.className = "thermal-spectrum";

    const trackBar = document.createElement("div");
    trackBar.className = "thermal-spectrum__bar";

    const tickHypo = document.createElement("span");
    tickHypo.className = "thermal-spectrum__tick thermal-spectrum__tick--hypo";
    tickHypo.textContent = `${KAMUS_ANGKA.HYPOTHERMIA_THRESHOLD_MK} mK Hypo`;

    const tickFever = document.createElement("span");
    tickFever.className = "thermal-spectrum__tick thermal-spectrum__tick--fever";
    tickFever.textContent = `${KAMUS_ANGKA.FEVER_THRESHOLD_MK} mK Fever`;

    this.markerEl = document.createElement("div");
    this.markerEl.className = "thermal-spectrum__needle";

    trackBar.append(this.markerEl);
    trackWrap.append(trackBar, tickHypo, tickFever);

    // Teks kebijakan langsung di atas adegan (tanpa kotak paragraf M5)
    const copyWrap = document.createElement("div");
    copyWrap.className = "zone-instrument__copy";

    this.headlineEl = document.createElement("h2");
    this.headlineEl.className = "zone-instrument__headline";

    this.policyEl = document.createElement("p");
    this.policyEl.className = "zone-instrument__rule";

    copyWrap.append(this.headlineEl, this.policyEl);
    this.root.append(headerRow, trackWrap, copyWrap);
    mount.appendChild(this.root);
  }

  public update(
    macro: Pick<MacroTelemetryState, "crucibleTemp" | "currentEpoch">,
    skin: SkinMode,
  ): ZoneBannerViewModel {
    const vm = buildZoneBannerViewModel(macro, skin);
    this.root.setAttribute("data-zone", vm.zone);
    this.zonePill.textContent = `${vm.badgeLabel} · ${vm.invariantCode}`;
    this.ratePill.textContent = vm.rateLabel;
    this.epochValueEl.textContent = vm.epochLabel;
    this.headlineEl.textContent = vm.headline;
    this.policyEl.textContent = vm.policyRule;

    // Posisi jarum via CSS custom property (aman untuk CSP style-src 'self' lewat kelas step)
    const bucket = Math.min(20, Math.max(0, Math.round(vm.gaugePercent / 5) * 5));
    this.markerEl.setAttribute("data-pos", String(bucket));

    this.cancelTween?.();
    const startTemp = this.currentDisplayedTemp;
    this.cancelTween = tweenValue(
      startTemp,
      macro.crucibleTemp,
      dur.snap,
      ease.snapSettle,
      (val) => {
        this.currentDisplayedTemp = val;
        this.tempValueEl.textContent = `${Math.round(val)} mK`;
      },
    );

    return vm;
  }
}
