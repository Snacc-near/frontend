import { describe, it, expect } from "vitest";
import {
  filterLogsForMode,
  formatLiveAtp,
  formatLiveVitality,
  isTerminalStrainStatus,
  resolveSelectedStrain,
} from "../src/data/liveView.ts";
import { statusLook } from "../src/plate/iso/layout.ts";
import type { BreachLogItem, StrainSummary } from "../src/data/types.ts";

// Fixture shaped after the real /api/strains response (StrainVesselView rows).
const LIVE_STRAINS: StrainSummary[] = [
  {
    strain_id: 1,
    owner_id: "alkemis.testnet",
    vault_subaccount: "s-1.snacc-v001.testnet",
    vitality: 5000,
    effective_vitality: 0,
    atp_balance: "880019",
    status: "SplicedBurned",
    generation: 2,
    organel: { mitokondria: 2, nukleus: 1, lisosom: 1 },
  },
  ...Array.from({ length: 8 }, (_, i) => ({
    strain_id: i + 2,
    owner_id: `owner-${i + 2}.testnet`,
    vitality: 8000 + i * 100,
    effective_vitality: 7900 + i * 100,
    atp_balance: String(1000 + i),
    status: "Active",
    generation: 1,
  })),
];

const SEED_LOGS: BreachLogItem[] = [
  {
    id: "seed-1",
    kind: "nutrient_burst_released",
    actor: "strain #3",
    summary: "cell lysis released 7200 nutrients · discount -20.00% until epoch 2",
    crucibleTemp: 591,
    timestampMs: 1,
    renderedAtMs: 2,
    latencyMs: 1,
    meetsSla: true,
  },
  {
    id: "seed-2",
    kind: "zone_changed",
    actor: "alkemis.testnet",
    summary: "alkemis.testnet triggered a zone shift from hypothermia to goldilocks (605 mK)",
    crucibleTemp: 605,
    timestampMs: 1,
    renderedAtMs: 2,
    latencyMs: 1,
    meetsSla: true,
  },
];

const API_LOG: BreachLogItem = {
  id: "log-1700000000000-ab12",
  kind: "zone_changed",
  actor: "cause not recorded",
  summary: "zone shift from Normal to Fever (1040 mK)",
  crucibleTemp: 1040,
  timestampMs: 1700000000000,
  renderedAtMs: 1700000000050,
  latencyMs: 50,
  meetsSla: true,
};

describe("UI-123..126: live-mode data truthfulness", () => {
  it("resolves the selected strain strictly from /api/strains fields", () => {
    const s = resolveSelectedStrain(1, LIVE_STRAINS);
    expect(s).not.toBeNull();
    expect(s!.vitality).toBe(5000);
    expect(s!.effective_vitality).toBe(0);
    expect(s!.atp_balance).toBe("880019");
    expect(s!.status).toBe("SplicedBurned");
    expect(s!.generation).toBe(2);
  });

  it("returns null instead of inventing values for an unknown strain", () => {
    expect(resolveSelectedStrain(999, LIVE_STRAINS)).toBeNull();
    expect(resolveSelectedStrain(1, [])).toBeNull();
  });

  it("never renders the demo seeds or simulated entries in live mode", () => {
    const live = filterLogsForMode([...SEED_LOGS, API_LOG], "live");
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(API_LOG.id);
    expect(live.some((l) => l.id.startsWith("seed-"))).toBe(false);
    expect(live.some((l) => l.summary.includes("7200 nutrients"))).toBe(false);
  });

  it("keeps the demo seeds visible in demo mode", () => {
    const demo = filterLogsForMode([...SEED_LOGS, API_LOG], "demo");
    expect(demo).toHaveLength(3);
  });

  it("renders an em dash placeholder when the API has no value", () => {
    expect(formatLiveVitality(null)).toBe("—");
    expect(formatLiveVitality(undefined)).toBe("—");
    expect(formatLiveVitality(5000)).toBe("5,000");
    expect(formatLiveAtp(null)).toBe("—");
    expect(formatLiveAtp("")).toBe("—");
    expect(formatLiveAtp("880019")).toBe("880,019");
  });

  it("marks SplicedBurned and Liquidated as visually distinct terminal statuses", () => {
    expect(isTerminalStrainStatus("SplicedBurned")).toBe(true);
    expect(isTerminalStrainStatus("Liquidated")).toBe(true);
    expect(isTerminalStrainStatus("Active")).toBe(false);
    expect(isTerminalStrainStatus("Distressed")).toBe(false);
    expect(isTerminalStrainStatus(undefined)).toBe(false);
  });

  it("carries the API status onto the dish cells without fabricating vitality", () => {
    expect(statusLook("SplicedBurned", false).ghost).toBe(true);
    expect(statusLook("Active", false).tone).toBe("hi");
  });
});
