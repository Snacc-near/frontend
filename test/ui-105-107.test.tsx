/**
 * Tests for UI-105..107:
 * - UI-105: Dual-Skin toggle and 1:1 glossary parity (ADR-31)
 * - UI-106: 3 Autonomous AI Alchemist NPCs on-chain pricing rule I-15 (ADR-30)
 * - UI-107: reasoning_tooltip component and dynamic speech bubble
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SKIN_LABELS } from "../src/config/constants.ts";
import {
  NPC_PROFILES,
  calculateNpcQuote,
  createDefaultNpcStates,
} from "../src/data/npc.ts";
import { NpcReasoningTooltip } from "../src/hud/NpcReasoningTooltip.tsx";
import { NpcPanel } from "../src/hud/NpcPanel.tsx";
import { SkinSwitch } from "../src/hud/SkinSwitch.tsx";

describe("UI-105: Dual-Skin Toggle & Glossary Parity (ADR-31)", () => {
  it("maintains strict 1:1 key parity between Bio-Lab and FinTech modes", () => {
    const biolabKeys = Object.keys(SKIN_LABELS.biolab).sort();
    const fintechKeys = Object.keys(SKIN_LABELS.fintech).sort();

    expect(biolabKeys).toEqual(fintechKeys);
    expect(biolabKeys.length).toBeGreaterThanOrEqual(30);

    for (const key of biolabKeys) {
      const bioVal = SKIN_LABELS.biolab[key];
      const ftVal = SKIN_LABELS.fintech[key];

      expect(bioVal).toBeTruthy();
      expect(ftVal).toBeTruthy();

      // Enforce design rule: All copy begins with lowercase character
      expect(bioVal![0]).toBe(bioVal![0]?.toLowerCase());
      expect(ftVal![0]).toBe(ftVal![0]?.toLowerCase());
    }
  });

  it("correctly maps core biological and institutional finance terminology", () => {
    expect(SKIN_LABELS.biolab.crucible).toBe("living cell crucible");
    expect(SKIN_LABELS.fintech.crucible).toBe("autonomous liquidity engine");

    expect(SKIN_LABELS.biolab.strain).toBe("living cell");
    expect(SKIN_LABELS.fintech.strain).toBe("nft subsidiary");

    expect(SKIN_LABELS.biolab.vitality).toBe("vitality");
    expect(SKIN_LABELS.fintech.vitality).toBe("solvency runway");

    expect(SKIN_LABELS.biolab.spores).toBe("glowing spores");
    expect(SKIN_LABELS.fintech.spores).toBe("catalyst coupons");

    expect(SKIN_LABELS.biolab.enzymes).toBe("enzymes");
    expect(SKIN_LABELS.fintech.enzymes).toBe("clearing derivatives");

    expect(SKIN_LABELS.biolab.elixir).toBe("homeostasis elixir");
    expect(SKIN_LABELS.fintech.elixir).toBe("solvency reserve");

    expect(SKIN_LABELS.biolab.productionChain).toBe("metabolic cascade");
    expect(SKIN_LABELS.fintech.productionChain).toBe("clearing settlement chain");

    expect(SKIN_LABELS.biolab.npcMerchants).toBe("alchemist npcs");
    expect(SKIN_LABELS.fintech.npcMerchants).toBe("market maker npcs");
  });

  it("renders SkinSwitch with aria-pressed states for both modes", () => {
    const bioHtml = renderToStaticMarkup(<SkinSwitch skin="biolab" onChange={() => {}} />);
    expect(bioHtml).toContain('aria-pressed="true"');
    expect(bioHtml).toContain("bio-lab");
    expect(bioHtml).toContain("fintech");

    const ftHtml = renderToStaticMarkup(<SkinSwitch skin="fintech" onChange={() => {}} />);
    expect(ftHtml).toContain('aria-pressed="true"');
  });
});

describe("UI-106: Autonomous AI Alchemist NPCs & Rule I-15 Pricing (ADR-30)", () => {
  it("initializes 3 distinct NPC archetypes matching contract parameters", () => {
    const npcs = createDefaultNpcStates();

    // Pyre-X (Extractor)
    expect(npcs["npc-extractor"].sporesStock).toBe(500);
    expect(npcs["npc-extractor"].targetSporesStock).toBe(500);
    expect(npcs["npc-extractor"].baseSporePrice).toBe(100);
    expect(NPC_PROFILES["npc-extractor"].archetype).toBe("Pyre-X");

    // Myco-7 (Central Arb)
    expect(npcs["npc-central-arb"].sporesStock).toBe(1000);
    expect(npcs["npc-central-arb"].targetSporesStock).toBe(1000);
    expect(npcs["npc-central-arb"].baseSporePrice).toBe(100);
    expect(NPC_PROFILES["npc-central-arb"].archetype).toBe("Myco-7");

    // Void-0 (Vulture M&A)
    expect(npcs["npc-vulture-ma"].sporesStock).toBe(300);
    expect(npcs["npc-vulture-ma"].targetSporesStock).toBe(300);
    expect(npcs["npc-vulture-ma"].baseSporePrice).toBe(100);
    expect(NPC_PROFILES["npc-vulture-ma"].archetype).toBe("Void-0");
  });

  it("calculates exact deterministic quotes matching contracts/snacc/src/lib.rs:3151", () => {
    const npcs = createDefaultNpcStates();

    // Test case 1: Pyre-X (stock 500, target 500, base 100) -> buy 10
    // s_after = 490 -> unit_price = max(1, floor(100 * 500 / 490)) = 102
    // total = 102 * 10 = 1020
    const quote1 = calculateNpcQuote(npcs["npc-extractor"], 10, 605, "biolab");
    expect(quote1.unitPriceVita).toBe(102);
    expect(quote1.totalCostSnacc).toBe(1020);
    expect(quote1.npcSporesStockAfter).toBe(490);

    // Test case 2: Void-0 (stock 300, target 300, base 100) -> buy 1
    // s_after = 299 -> unit_price = max(1, floor(100 * 300 / 299)) = 100
    // total = 100 * 1 = 100
    const quote2 = calculateNpcQuote(npcs["npc-vulture-ma"], 1, 605, "biolab");
    expect(quote2.unitPriceVita).toBe(100);
    expect(quote2.totalCostSnacc).toBe(100);
    expect(quote2.npcSporesStockAfter).toBe(299);

    // Test case 3: Void-0 (stock 300, target 300, base 100) -> buy 299
    // s_after = 1 -> unit_price = max(1, floor(100 * 300 / 1)) = 30000
    const quote3 = calculateNpcQuote(npcs["npc-vulture-ma"], 299, 605, "biolab");
    expect(quote3.unitPriceVita).toBe(30000);
    expect(quote3.totalCostSnacc).toBe(30000 * 299);
    expect(quote3.npcSporesStockAfter).toBe(1);

    // Test case 4: Myco-7 (stock 1000, target 1000, base 100) -> buy 100
    // s_after = 900 -> unit_price = max(1, floor(100 * 1000 / 900)) = 111
    const quote4 = calculateNpcQuote(npcs["npc-central-arb"], 100, 605, "biolab");
    expect(quote4.unitPriceVita).toBe(111);
    expect(quote4.totalCostSnacc).toBe(11100);
    expect(quote4.npcSporesStockAfter).toBe(900);
  });
});

describe("UI-107: reasoning_tooltip Component & Dual-Skin Personas", () => {
  it("formats the Bio-Lab reasoning tooltip verbatim to the Rust contract", () => {
    const npcs = createDefaultNpcStates();
    const quote = calculateNpcQuote(npcs["npc-extractor"], 10, 605, "biolab");

    expect(quote.reasoningTooltip).toBe(
      "I hold 500 Spore-Ignis (target 500). Selling 10 drops my stock to 490 — unit price rises to 102 (P_base 100). Scarcity is my leverage."
    );
  });

  it("formats the FinTech reasoning tooltip using institutional market maker framing", () => {
    const npcs = createDefaultNpcStates();
    const quote = calculateNpcQuote(npcs["npc-extractor"], 10, 605, "fintech");

    expect(quote.reasoningTooltip).toBe(
      "Market inventory: 500 Primary Catalyst units (target 500). Execution of 10 reduces reserves to 490 — unit quote adjusts to 102 (P_base 100). Dynamic bonding curve liquidity."
    );
  });

  it("renders NpcReasoningTooltip markup with persona badge and quotation", () => {
    const npcs = createDefaultNpcStates();
    const quote = calculateNpcQuote(npcs["npc-extractor"], 10, 605, "biolab");
    const profile = NPC_PROFILES["npc-extractor"];

    const html = renderToStaticMarkup(
      <NpcReasoningTooltip quote={quote} profile={profile} skin="biolab" />
    );

    expect(html).toContain("ADR-30 on-chain reasoning");
    expect(html).toContain("Pyre-X");
    expect(html).toContain("Scarcity is my leverage.");
  });

  it("renders the interactive NpcPanel markup with all 3 NPC options and quote preview", () => {
    const html = renderToStaticMarkup(
      <NpcPanel
        isOpen={true}
        onClose={() => {}}
        skin="biolab"
        crucibleTempMk={605}
        mode="demo"
        userSnaccBalance={5000}
      />
    );

    expect(html).toContain("Alchemist Guild Spore Merchants");
    expect(html).toContain("Pyre-X");
    expect(html).toContain("Myco-7");
    expect(html).toContain("Void-0");
    expect(html).toContain("Stock / Target");
    expect(html).toContain("Algorithmic Quote");
  });
});
