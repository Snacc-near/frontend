/**
 * Tests for RES-113 & RES-115:
 * - RES-113: SocialDB leaderboard modal & formatted markdown post
 * - RES-115: Empirical thesis proof dashboard (Pikespeak/Artemis/Dune)
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SocialLeaderboardModal } from "../src/hud/SocialLeaderboardModal.tsx";
import { ThesisDashboardModal } from "../src/hud/ThesisDashboardModal.tsx";
import { formatSocialPost } from "../src/swap/socialFormat.ts";

describe("RES-113: SocialDB Leaderboard Publication", () => {
  it("formats standard SocialDB markdown post with top 3 podium", () => {
    const post = formatSocialPost({
      epoch: 3,
      crucibleTempMk: 650,
      zone: "FEVER",
      feastVolume: "300000000000000000000",
      feastTarget: "150000000000000000000",
      topFeeders: [
        { account_id: "alice.near", amount: "150000000000000000000" },
        { account_id: "bob.near", amount: "100000000000000000000" },
        { account_id: "charlie.near", amount: "50000000000000000000" },
      ],
      network: "NEAR Protocol",
    });

    expect(post).toContain("The Great Feast Leaderboard (Epoch 3)");
    expect(post).toContain("`FEVER`");
    expect(post).toContain("🥇 **#1 `alice.near`**");
    expect(post).toContain("🥈 **#2 `bob.near`**");
    expect(post).toContain("🥉 **#3 `charlie.near`**");
    expect(post).toContain("#SocialDB");
  });

  it("renders SocialLeaderboardModal when open with podium entries and actions", () => {
    const html = renderToStaticMarkup(
      <SocialLeaderboardModal
        isOpen={true}
        onClose={() => {}}
        appetite={{
          zone: "FEVER",
          crucibleTempMk: 650,
          currentEpoch: 2,
          burstBps: 360,
          burstUntil: 3,
          burstEpochsLeft: 1,
          dormant: false,
          feastVolume: "196514539503915099101877",
          feastTarget: "110708605367226947928032",
          riskHeat: 10000,
          feastProgressPct: 100,
          riskHeatPct: 100,
          topFeeders: [
            { account_id: "alkemis.near", amount: "196514539503915099101877" },
          ],
          contractId: "snacc-v001.near",
          blockHeight: 277203183,
        }}
        mode="live"
        skin="biolab"
      />
    );

    expect(html).toContain("SocialDB");
    expect(html).toContain("alkemis.near");
    expect(html).toContain("copy social.near markdown");
    expect(html).toContain("open social.near");
  });

  it("returns null when SocialLeaderboardModal is closed", () => {
    const html = renderToStaticMarkup(
      <SocialLeaderboardModal
        isOpen={false}
        onClose={() => {}}
        appetite={null}
        mode="demo"
      />
    );
    expect(html).toBe("");
  });
});

describe("RES-115: Empirical Thesis Proof Dashboard", () => {
  it("renders ThesisDashboardModal with >=3 proven metrics", () => {
    const html = renderToStaticMarkup(
      <ThesisDashboardModal
        isOpen={true}
        onClose={() => {}}
        macro={{
          crucibleTemp: 650,
          zone: "Fever",
          totalSnaccSupply: "2214172107344538958560658",
          totalSnaccBurned: "35827892655461041439342",
          ruleBoundTreasury: "471384202418197499999930",
          epochVolume: "2296686581569915086209727",
          contractId: "snacc-v001.near",
          blockHeight: 277204122,
        }}
        appetite={null}
        mode="live"
        skin="biolab"
      />
    );

    expect(html).toContain("Thesis");
    expect(html).toContain("84.42%");
    expect(html).toContain("F-01 PROVEN");
    expect(html).toContain("F-02 PROVEN");
    expect(html).toContain("F-03 PROVEN");
    expect(html).toContain("M1 · Storage Rent");
    expect(html).toContain("M2 · Monetary Thermostat");
    expect(html).toContain("M3 · Zero-Trust AI TEE");
    expect(html).toContain("M4 · Macro Solvency");
    expect(html).toContain("0 yocto");
  });

  it("renders in FinTech skin mode with institutional labels", () => {
    const html = renderToStaticMarkup(
      <ThesisDashboardModal
        isOpen={true}
        onClose={() => {}}
        macro={null}
        appetite={null}
        mode="demo"
        skin="fintech"
      />
    );

    expect(html).toContain("empirical thesis evidence &amp; indexing verification");
  });

  it("returns null when ThesisDashboardModal is closed", () => {
    const html = renderToStaticMarkup(
      <ThesisDashboardModal
        isOpen={false}
        onClose={() => {}}
        macro={null}
        appetite={null}
        mode="demo"
      />
    );
    expect(html).toBe("");
  });
});
