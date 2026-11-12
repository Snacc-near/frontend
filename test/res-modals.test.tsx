/**
 * Tests for RES-112, RES-121, RES-122 Modal UI Components
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { AuthModal } from "../src/hud/AuthModal.tsx";
import { RecipeSearchModal } from "../src/hud/RecipeSearchModal.tsx";

describe("RES-112 & RES-122: AuthModal UI", () => {
  it("renders AuthModal when isOpen is true", () => {
    const html = renderToStaticMarkup(
      <AuthModal
        isOpen={true}
        onClose={() => {}}
        activeAccount="esther.testnet"
        onLogin={() => {}}
        onLogout={() => {}}
        skin="biolab"
      />
    );

    expect(html).toContain("Alchemical Identity");
    expect(html).toContain("RES-112 &amp; RES-122");
    expect(html).toContain("esther.testnet");
    expect(html).toContain("1Click Guest (RES-112)");
    expect(html).toContain("near.email / Auth0 (RES-122)");
    expect(html).toContain("Create 1Click Account");
  });

  it("renders Fintech mode labels in AuthModal", () => {
    const html = renderToStaticMarkup(
      <AuthModal
        isOpen={true}
        onClose={() => {}}
        activeAccount=""
        onLogin={() => {}}
        onLogout={() => {}}
        skin="fintech"
      />
    );

    expect(html).toContain("Institutional Access");
    expect(html).toContain("Instant non-custodial session key onboarding");
  });

  it("returns null when AuthModal is closed", () => {
    const html = renderToStaticMarkup(
      <AuthModal
        isOpen={false}
        onClose={() => {}}
        activeAccount=""
        onLogin={() => {}}
        onLogout={() => {}}
      />
    );
    expect(html).toBe("");
  });
});

describe("RES-121: RecipeSearchModal UI", () => {
  it("renders RecipeSearchModal when isOpen is true", () => {
    const html = renderToStaticMarkup(
      <RecipeSearchModal
        isOpen={true}
        onClose={() => {}}
        skin="biolab"
        zone="FEVER"
      />
    );

    expect(html).toContain("Alchemical Codex");
    expect(html).toContain("RES-121 Qwen Rerank");
    expect(html).toContain("Zone: FEVER");
    expect(html).toContain("Search recipes with natural language");
    expect(html).toContain("protect against fever burn");
  });

  it("renders Fintech dual-skin labels in RecipeSearchModal", () => {
    const html = renderToStaticMarkup(
      <RecipeSearchModal
        isOpen={true}
        onClose={() => {}}
        skin="fintech"
        zone="Goldilocks"
      />
    );

    expect(html).toContain("Financial Engineering Matrix");
    expect(html).toContain("Search clearing formulas &amp; capital allocation rules");
  });

  it("returns null when RecipeSearchModal is closed", () => {
    const html = renderToStaticMarkup(
      <RecipeSearchModal
        isOpen={false}
        onClose={() => {}}
      />
    );
    expect(html).toBe("");
  });
});
