/**
 * UI-140: shared primitives, modal semantics, honesty guards over all of `src`.
 * The suite runs in node (no DOM), so keyboard behaviour is tested through the pure logic the
 * Modal and Tabs use; the browser run is in the PR notes.
 */
import fs from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isTopModal, modalKeyAction, openModalCount, popModal, pushModal, tabKeyTarget, trapIndex } from "../src/ui/a11y.ts";
import { copyText } from "../src/ui/controls.tsx";
import { Modal } from "../src/ui/Modal.tsx";
import { formatUnits, parseJsonBig, quoteBigInts } from "../src/data/nearView.ts";
import { EVIDENCE_TXS, REHEARSAL_TX } from "../src/data/evidence.ts";
import { GuestLabelModal } from "../src/hud/GuestLabelModal.tsx";
import { NpcPanel } from "../src/hud/NpcPanel.tsx";
import { RecipeSearchModal } from "../src/hud/RecipeSearchModal.tsx";
import { SocialLeaderboardModal } from "../src/hud/SocialLeaderboardModal.tsx";
import { SwapPanel } from "../src/hud/SwapPanel.tsx";
import { ThesisDashboardModal } from "../src/hud/ThesisDashboardModal.tsx";
import { ToolsToolbar, TOOLS } from "../src/hud/ToolsToolbar.tsx";

const SRC = path.resolve(__dirname, "../src");
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const SOURCES = walk(SRC).filter((f) => /\.(tsx?|css)$/.test(f));
const rel = (f: string) => path.relative(SRC, f);

describe("modal keyboard logic", () => {
  it("Escape closes; Tab and Shift+Tab wrap inside the dialog", () => {
    expect(modalKeyAction("Escape", false, 3, 1)).toEqual({ type: "close" });
    expect(modalKeyAction("Tab", false, 3, 2)).toEqual({ type: "focus", index: 0 });
    expect(modalKeyAction("Tab", true, 3, 0)).toEqual({ type: "focus", index: 2 });
    expect(modalKeyAction("Tab", false, 3, -1)).toEqual({ type: "focus", index: 0 });
    expect(modalKeyAction("Enter", false, 3, 0)).toBeNull();
    expect(trapIndex(0, -1, false)).toBe(-1);
  });

  it("only the top-most modal reacts", () => {
    const a = pushModal();
    const b = pushModal();
    expect(isTopModal(b)).toBe(true);
    expect(isTopModal(a)).toBe(false);
    popModal(b);
    expect(isTopModal(a)).toBe(true);
    popModal(a);
    expect(openModalCount()).toBe(0);
  });

  it("tabs move with arrows, Home and End", () => {
    expect(tabKeyTarget("ArrowRight", 2, 3)).toBe(0);
    expect(tabKeyTarget("ArrowLeft", 0, 3)).toBe(2);
    expect(tabKeyTarget("Home", 2, 3)).toBe(0);
    expect(tabKeyTarget("End", 0, 3)).toBe(2);
    expect(tabKeyTarget("a", 0, 3)).toBeNull();
  });
});

describe("every tool window is a labelled modal dialog", () => {
  const noop = () => {};
  const cases: [string, ReactElement][] = [
    ["swap", <SwapPanel mode="demo" onClose={noop} />],
    ["npc", <NpcPanel mode="demo" onClose={noop} skin="biolab" crucibleTempMk={605} userSnaccBalance={100} />],
    ["social", <SocialLeaderboardModal mode="demo" onClose={noop} appetite={null} />],
    ["thesis", <ThesisDashboardModal mode="demo" onClose={noop} />],
    ["guest", <GuestLabelModal current={null} onSave={noop} onClear={noop} onClose={noop} />],
    ["recipes", <RecipeSearchModal onClose={noop} />],
  ];
  for (const [name, el] of cases) {
    it(`${name}: role=dialog, aria-modal, aria-labelledby → title, close button, no emoji`, () => {
      const html = renderToStaticMarkup(el);
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      const labelled = html.match(/aria-labelledby="([^"]+)"/)?.[1];
      expect(labelled).toBeTruthy();
      for (const id of labelled!.split(" ")) expect(html).toContain(`id="${id}"`);
      expect(html).toMatch(/class="fd-win__close" aria-label="close [a-z.-]+"/);
      expect(html).not.toMatch(/\p{Emoji_Presentation}|️/u);
      expect(html).not.toContain("rounded-");
    });
  }

  it("the shared Modal puts its title in the bar and the body in a scroll box", () => {
    const html = renderToStaticMarkup(
      <Modal title="x.view" heading="Hello" onClose={noop}>
        <p>body</p>
      </Modal>,
    );
    expect(html).toContain('class="fd-win__title">x.view</h2>');
    expect(html).toContain('class="fd-win__body"');
    expect(html).toContain("Hello");
  });
});

describe("toolbar", () => {
  it("folds the seven tools plus help and settings (UI-151) into one toolbar with a mobile overflow key", () => {
    const html = renderToStaticMarkup(<ToolsToolbar skin="biolab" panelsOpen={false} onTogglePanels={() => {}} onOpen={() => {}} guestLabel={null} />);
    // UI-148 added "profile", UI-153 "quests" (the app hides both when the profile features are off) and UI-164 "market".
    expect(TOOLS).toHaveLength(12);
    expect((html.match(/tools-bar__tool/g) ?? []).length).toBe(12);
    expect(html).toContain("tools-bar__more");
    expect(html).toContain('aria-label="game tools"');
    expect(html).not.toMatch(/\p{Emoji_Presentation}|️/u);
  });
});

describe("honesty guards over all of src", () => {
  // Contract and backend identifiers are copied verbatim from the spec and are not prose.
  const IDENTIFIERS = /\b(dividend_claimed|industrial_dividend_pool|epoch_dividend_inflow|sum_dividend_pool|claim_industrial_dividend|aether_burned_for_dividend|get_dividend_pool)\b/g;
  const BANNED = /\b(gamefi|investments?|invest|investing|investors?|yields?|yielding|profits?|profitable|dividends?|earnings?)\b|real money/i;
  // UI-151: the disclaimers must be able to say "no promise of profit", and the Help glossary defines the
  // game's own "dividends" (the fee-sharing pool). Both stay exact: the phrase, and one file.
  const DISCLAIMER_PHRASE = /\b(no|a) promise of profit\b/gi;
  const GLOSSARY_FILE = path.join("help", "content.ts");
  const DIVIDEND_TERM = /\bdividends?\b/gi;
  // UI-149: the backend's notification kind is the quoted identifier "dividend" (`notifications_snacc.kind`).
  const NOTIFICATION_KIND_ID = /"dividend"/g;

  it("has none of the banned words in UI strings or comments", () => {
    const hits = SOURCES.flatMap((f) =>
      fs
        .readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => {
          const clean = line.replace(IDENTIFIERS, "").replace(DISCLAIMER_PHRASE, "").replace(NOTIFICATION_KIND_ID, "");
          return { line: rel(f) === GLOSSARY_FILE ? clean.replace(DIVIDEND_TERM, "") : clean, at: `${rel(f)}:${i + 1}` };
        })
        .filter((x) => BANNED.test(x.line))
        .map((x) => x.at),
    );
    expect(hits).toEqual([]);
  });

  it("uses no emoji and no dark: variants (the UI is light only)", () => {
    const hits = SOURCES.filter((f) => {
      const t = fs.readFileSync(f, "utf8");
      return /\p{Emoji_Presentation}|️/u.test(t) || /\bdark:/.test(t);
    }).map(rel);
    expect(hits).toEqual([]);
  });

  it("never names a mainnet Snacc account or a .near player", () => {
    // Real external NEAR mainnet accounts the swap preview needs (1Click / Rhea), not Snacc accounts.
    const EXTERNAL = /"(wrap|intents)\.near"|nep141:[a-z0-9.-]+\.near/g;
    const hits = SOURCES.filter((f) => /snacc-v001\.near|"[a-z0-9-]+\.near"|\b[a-z0-9-]+\.near\b(?!\.)/.test(fs.readFileSync(f, "utf8").replace(EXTERNAL, "").replace(/\b(docs|rpc|app|api|social)\.near\b|near\.(org|social|email|page)/g, ""))).map(rel);
    expect(hits).toEqual([]);
  });

  it("does not claim a verified sign-in, and claims a wallet connection only from real wallet state", () => {
    const hits = SOURCES.filter((f) => /connect(ed)? your wallet|Authenticated via|verified: ?true/i.test(fs.readFileSync(f, "utf8"))).map(rel);
    expect(hits).toEqual([]);
    // UI-145: "wallet connected" may only appear where the state comes from the real connector (`useWallet`).
    const claims = SOURCES.filter((f) => {
      const t = fs.readFileSync(f, "utf8");
      return /wallet connected/i.test(t) && !/\buseWallet\(\)/.test(t);
    }).map(rel);
    expect(claims).toEqual([]);
  });

  it("puts no API key in a VITE_ variable", () => {
    // UI-148: the Supabase publishable key is public by design (row-level security guards the data).
    const hits = SOURCES.filter((f) => /VITE_[A-Z_]*(KEY|SECRET|TOKEN_SECRET|JWT)/.test(fs.readFileSync(f, "utf8").replace(/VITE_SUPABASE_PUBLISHABLE_KEY/g, ""))).map(rel);
    expect(hits).toEqual([]);
  });
});

describe("chain helpers", () => {
  it("keeps u128 digits exact when parsing view results", () => {
    const text = '{"total_snacc_burned":35827892655461041439342,"n":5,"list":[{"amount":196514539503915099101877}]}';
    expect(quoteBigInts(text)).toContain('"35827892655461041439342"');
    const v = parseJsonBig<{ total_snacc_burned: string; n: number; list: { amount: string }[] }>(text);
    expect(v.total_snacc_burned).toBe("35827892655461041439342");
    expect(v.n).toBe(5);
    expect(v.list[0].amount).toBe("196514539503915099101877");
  });

  it("formats yocto-$SNACC with 24 decimals", () => {
    expect(formatUnits("35827892655461041439342")).toBe("0.0358");
    expect(formatUnits("2250000000000000000000000")).toBe("2.25");
    expect(formatUnits("1000")).toBe("<0.0001");
    expect(formatUnits("0")).toBe("0");
    expect(formatUnits(null)).toBe("—");
  });

  it("links only real-looking base58 tx hashes", () => {
    for (const h of [...EVIDENCE_TXS.map((t) => t.hash), ...Object.values(REHEARSAL_TX)]) expect(h).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
  });

  it("copyText reports a rejected clipboard instead of throwing", async () => {
    await expect(copyText("x", { writeText: () => Promise.reject(new Error("denied")) })).resolves.toBe(false);
    await expect(copyText("x", { writeText: () => Promise.resolve() })).resolves.toBe(true);
    await expect(copyText("x", undefined)).resolves.toBe(false);
  });
});
