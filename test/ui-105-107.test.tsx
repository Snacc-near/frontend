/**
 * Dual skin (ADR-31) and the on-chain NPC merchants (ADR-30, rule I-15).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SKIN_LABELS } from "../src/config/constants.ts";
import { NPC_GENESIS, NPC_IDS, NPC_SKIN, simulateNpcQuote } from "../src/data/npc.ts";
import { NpcReasoningTooltip } from "../src/hud/NpcReasoningTooltip.tsx";
import { NpcPanel } from "../src/hud/NpcPanel.tsx";
import { SkinSwitch } from "../src/hud/SkinSwitch.tsx";

describe("Dual skin toggle and glossary parity (ADR-31)", () => {
  it("keeps 1:1 key parity between Bio-Lab and FinTech labels", () => {
    const biolabKeys = Object.keys(SKIN_LABELS.biolab).sort();
    const fintechKeys = Object.keys(SKIN_LABELS.fintech).sort();
    expect(biolabKeys).toEqual(fintechKeys);
    expect(biolabKeys.length).toBeGreaterThanOrEqual(30);
    for (const key of biolabKeys) {
      const bioVal = SKIN_LABELS.biolab[key];
      const ftVal = SKIN_LABELS.fintech[key];
      expect(bioVal).toBeTruthy();
      expect(ftVal).toBeTruthy();
      expect(bioVal![0]).toBe(bioVal![0]?.toLowerCase());
      expect(ftVal![0]).toBe(ftVal![0]?.toLowerCase());
    }
  });

  it("maps the core terms", () => {
    expect(SKIN_LABELS.biolab.crucible).toBe("living cell crucible");
    expect(SKIN_LABELS.fintech.crucible).toBe("autonomous liquidity engine");
    expect(SKIN_LABELS.biolab.strain).toBe("living cell");
    expect(SKIN_LABELS.fintech.strain).toBe("nft subsidiary");
    expect(SKIN_LABELS.biolab.spores).toBe("glowing spores");
    expect(SKIN_LABELS.fintech.spores).toBe("catalyst coupons");
  });

  it("renders SkinSwitch with aria-pressed and line icons, no emoji", () => {
    const bioHtml = renderToStaticMarkup(<SkinSwitch skin="biolab" onChange={() => {}} />);
    expect(bioHtml).toContain('aria-pressed="true"');
    expect(bioHtml).toContain("bio-lab");
    expect(bioHtml).toContain("fintech");
    expect(bioHtml).toContain('class="fd-ico"');
    expect(bioHtml).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("NPC merchants (ADR-30)", () => {
  it("starts from the contract's genesis values", () => {
    expect(NPC_IDS).toEqual(["npc-extractor", "npc-central-arb", "npc-vulture-ma"]);
    expect(NPC_GENESIS["npc-extractor"]).toMatchObject({ role_archetype: "Pyre-X", spores_stock: 500, target_spores_stock: 500, base_spore_price: 100 });
    expect(NPC_GENESIS["npc-central-arb"]).toMatchObject({ role_archetype: "Myco-7", spores_stock: 1000, target_spores_stock: 1000 });
    expect(NPC_GENESIS["npc-vulture-ma"]).toMatchObject({ role_archetype: "Void-0", spores_stock: 300, target_spores_stock: 300 });
    for (const id of NPC_IDS) expect(NPC_SKIN[id].archetype).toBe(NPC_GENESIS[id].role_archetype);
  });

  it("applies rule I-15 exactly", () => {
    const q = (id: (typeof NPC_IDS)[number], n: number) => simulateNpcQuote(NPC_GENESIS[id], n, 605);
    expect(q("npc-extractor", 10)).toMatchObject({ unit_price_vita: "102", total_cost_snacc: "1020", npc_spores_stock_after: 490 });
    expect(q("npc-vulture-ma", 1)).toMatchObject({ unit_price_vita: "100", total_cost_snacc: "100", npc_spores_stock_after: 299 });
    expect(q("npc-vulture-ma", 299)).toMatchObject({ unit_price_vita: "30000", total_cost_snacc: String(30000 * 299), npc_spores_stock_after: 1 });
    expect(q("npc-central-arb", 100)).toMatchObject({ unit_price_vita: "111", total_cost_snacc: "11100", npc_spores_stock_after: 900 });
  });

  it("reproduces a real npc_quote_spores response from snacc-v001.testnet (read 2026-11-12)", () => {
    // get_npc("npc-extractor") returned spores_stock 450 after the rehearsal's npc_buy_spores
    const live = { ...NPC_GENESIS["npc-extractor"], spores_stock: 450, snacc_reserve: 5550, trades_executed: 1 };
    expect(simulateNpcQuote(live, 10, 1037)).toEqual({
      npc_id: "npc-extractor",
      unit_price_vita: "113",
      total_cost_snacc: "1130",
      npc_spores_stock_after: 440,
      crucible_temp_mk: 1037,
      reasoning_tooltip: "I hold 450 Spore-Ignis (target 500). Selling 10 drops my stock to 440 — unit price rises to 113 (P_base 100). Scarcity is my leverage.",
    });
  });

  it("renders the reasoning with its source", () => {
    const quote = simulateNpcQuote(NPC_GENESIS["npc-extractor"], 10, 605);
    const sim = renderToStaticMarkup(<NpcReasoningTooltip quote={quote} npcName="Pyre-X" source="simulation" stockBefore={500} />);
    expect(sim).toContain("Scarcity is my leverage.");
    expect(sim).toContain('class="fd-sim"');
    const live = renderToStaticMarkup(<NpcReasoningTooltip quote={quote} npcName="Pyre-X" source="contract" stockBefore={500} />);
    expect(live).toContain("contract view npc_quote_spores");
    expect(live).not.toContain('class="fd-sim"');
  });

  it("demo panel labels its numbers as a simulation and invents no spore types or mottos", () => {
    const html = renderToStaticMarkup(<NpcPanel onClose={() => {}} skin="biolab" crucibleTempMk={605} mode="demo" userSnaccBalance={5000} />);
    for (const name of ["Pyre-X", "Myco-7", "Void-0"]) expect(html).toContain(name);
    expect(html).toContain('role="tab"');
    expect((html.match(/class="fd-sim"/g) ?? []).length).toBeGreaterThanOrEqual(9);
    for (const invented of ["Spore-Amalgam", "Spore-Necro", "Equilibrium is stability", "Survival belongs to the solvent", "external wallet"]) {
      expect(html).not.toContain(invented);
    }
  });

  it("live panel shows no local numbers before the contract answers", () => {
    const html = renderToStaticMarkup(<NpcPanel onClose={() => {}} skin="biolab" crucibleTempMk={605} mode="live" userSnaccBalance={5000} />);
    expect(html).toContain("reading get_npc from snacc-v001.testnet");
    expect(html).toContain("reading npc_quote_spores");
    expect(html).not.toContain('class="fd-sim"');
    expect(html).not.toContain("buy in simulation");
    expect(html).toContain("npc_buy_spores(strain_id, npc_id, buy_amount)");
  });
});
