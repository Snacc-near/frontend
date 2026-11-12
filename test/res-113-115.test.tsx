import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { DEMO_FEAST, formatSocialPost } from "../src/swap/socialFormat.ts";
import { SocialLeaderboardModal } from "../src/hud/SocialLeaderboardModal.tsx";
import { ThesisDashboardModal } from "../src/hud/ThesisDashboardModal.tsx";
import { QUERY_TEMPLATES, THESIS_METRICS } from "../src/data/thesis.ts";
import { REHEARSAL_TX } from "../src/data/evidence.ts";
import type { AppetiteViewModel } from "../src/data/types.ts";

const liveAppetite: AppetiteViewModel = {
  zone: "FEVER",
  crucibleTempMk: 1037,
  currentEpoch: 1,
  burstBps: 360,
  burstUntil: 2,
  burstEpochsLeft: 1,
  dormant: false,
  feastVolume: "196514539503915099101877",
  feastTarget: "110708605367226947928032",
  riskHeat: 10000,
  feastProgressPct: 100,
  riskHeatPct: 100,
  topFeeders: [{ account_id: "snacc-v001.testnet", amount: "196514539503915099101877" }],
  contractId: "snacc-v001.testnet",
  blockHeight: 1,
};

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("Great Feast leaderboard", () => {
  it("formats amounts with 24 decimals and no emoji", () => {
    const post = formatSocialPost(
      { epoch: 1, zone: "FEVER", crucibleTempMk: 1037, feastVolume: liveAppetite.feastVolume, feastTarget: liveAppetite.feastTarget, topFeeders: liveAppetite.topFeeders },
      { simulated: false },
    );
    expect(post).toContain("fed 0.1965 $SNACC");
    expect(post).toContain("NEAR testnet");
    expect(post).toContain("no monetary value");
    expect(post).not.toContain("196,514");
    expect(post).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("labels every demo number as a simulation", () => {
    const html = renderToStaticMarkup(<SocialLeaderboardModal onClose={() => {}} appetite={null} mode="demo" />);
    expect(html).toContain("alkemis.testnet");
    // 3 stats rows + 3 podium rows + footer chip
    expect(count(html, 'class="fd-sim"')).toBeGreaterThanOrEqual(DEMO_FEAST.topFeeders.length + 3);
    expect(html).not.toContain("snacc-v001.near");
  });

  it("shows backend data in live mode without simulation chips", () => {
    const html = renderToStaticMarkup(<SocialLeaderboardModal onClose={() => {}} appetite={liveAppetite} mode="live" />);
    expect(html).toContain("snacc-v001.testnet");
    expect(html).toContain("0.1965 $SNACC");
    expect(html).not.toContain('class="fd-sim"');
  });

  it("never falls back to fixtures in live mode", () => {
    const html = renderToStaticMarkup(<SocialLeaderboardModal onClose={() => {}} appetite={null} mode="live" />);
    expect(html).toContain("reading get_appetite_meter");
    for (const f of DEMO_FEAST.topFeeders) expect(html).not.toContain(f.account_id);
    expect(html).not.toContain("196,514");
  });
});

describe("Thesis evidence", () => {
  for (const mode of ["demo", "live"] as const) {
    it(`shows rehearsal numbers with sources and no PROVEN badge (${mode})`, () => {
      const html = renderToStaticMarkup(<ThesisDashboardModal onClose={() => {}} mode={mode} />);
      expect(html).toContain("Testnet rehearsal 2026-11-09");
      expect(html).toContain("verified in rehearsal");
      expect(html).toContain(`https://testnet.nearblocks.io/txns/${REHEARSAL_TX.feverBurn}`);
      expect(html).toContain(`https://testnet.nearblocks.io/txns/${REHEARSAL_TX.teeApply}`);
      expect(html).not.toMatch(/PROVEN/);
      expect(html).not.toContain("650 mK");
      expect(html).not.toContain("35,827");
    });
  }

  it("uses 24 decimals for the burn: 3.58e22 yocto is 0.0358 $SNACC", () => {
    const burn = THESIS_METRICS.find((m) => m.id === "burn")!;
    expect(burn.value).toBe("0.0358");
    expect(burn.tx).toBe(REHEARSAL_TX.feverBurn);
  });

  it("keeps the SQL as unexecuted templates for the testnet contract", () => {
    for (const q of QUERY_TEMPLATES) {
      expect(q.sql).toContain("not executed");
      expect(q.sql).not.toMatch(/snacc-v001\.near/);
      expect(q.sql).not.toMatch(/1e18/);
    }
    expect(QUERY_TEMPLATES.some((q) => q.sql.includes("snacc-v001.testnet"))).toBe(true);
  });
});
