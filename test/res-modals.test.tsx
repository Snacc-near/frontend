import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { GuestLabelModal } from "../src/hud/GuestLabelModal.tsx";
import { RecipeSearchModal } from "../src/hud/RecipeSearchModal.tsx";
import { GUEST_LABEL_KEY, isTestnetAccount, readGuestLabel, sanitizeLabel, saveGuestLabel } from "../src/auth/guestLabel.ts";
import { CONTRACT_SIGNATURES, RECIPE_CATALOG, callTemplate, searchRecipes } from "../src/recipes/recipeSearch.ts";

function memoryStore(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

describe("Guest label (local only)", () => {
  it("says what it is and offers sign-in only as disabled planned options", () => {
    const html = renderToStaticMarkup(<GuestLabelModal current={null} onSave={() => {}} onClear={() => {}} onClose={() => {}} />);
    expect(html).toContain("Guest label — local only, no on-chain account, nothing is signed.");
    expect(html).toContain("This app has no wallet connection.");
    expect(html.match(/disabled="" aria-describedby="guest-planned-note"/g) ?? []).toHaveLength(2);
    expect(html).toContain("near.email");
    expect(html).toContain("Auth0");
    for (const claim of ["Authenticated", "passkey", "verified", "ed25519:", "Create 1Click Account", "@"]) {
      expect(html).not.toContain(claim);
    }
  });

  it("accepts only .testnet account ids for the highlight filter", () => {
    expect(isTestnetAccount("alice.testnet")).toBe(true);
    expect(isTestnetAccount("snacc-v001.testnet")).toBe(true);
    expect(isTestnetAccount("alice.near")).toBe(false);
    expect(isTestnetAccount("me@example.com")).toBe(false);
    expect(isTestnetAccount("Alice.testnet")).toBe(false);
  });

  it("stores a label and an optional account, never an email, and drops the old session key", () => {
    const store = memoryStore({ snacc_auth_session: JSON.stringify({ email: "x@y.z" }) });
    saveGuestLabel({ label: "  night\nshift  ", account: "not-an-account" }, store);
    expect(JSON.parse(store.dump()[GUEST_LABEL_KEY])).toEqual({ label: "night shift", account: null });
    expect(readGuestLabel(store)).toEqual({ label: "night shift", account: null });
    expect(store.dump().snacc_auth_session).toBeUndefined();
    saveGuestLabel({ label: "", account: "bob.testnet" }, store);
    expect(readGuestLabel(store)?.account).toBe("bob.testnet");
    expect(sanitizeLabel("x".repeat(80))).toHaveLength(32);
  });
});

describe("Local recipe search (keyword)", () => {
  it("names itself honestly and claims no model", () => {
    const html = renderToStaticMarkup(<RecipeSearchModal onClose={() => {}} />);
    expect(html).toContain("Local recipe search (keyword)");
    expect(html).not.toMatch(/qwen|semantic|rerank|embedding/i);
  });

  it("matches words, not substrings: a two-letter query does not match everything", () => {
    expect(searchRecipes("ma").length).toBeLessThan(RECIPE_CATALOG.length);
    expect(searchRecipes("fever")[0].recipe.id).toBe("synthesize-homeostasis");
    expect(searchRecipes("aether").map((r) => r.recipe.id)).toContain("redeem-aether");
    expect(searchRecipes("")).toHaveLength(RECIPE_CATALOG.length);
  });

  it("copies call templates whose argument names match the contract signatures", () => {
    for (const r of RECIPE_CATALOG) {
      if (!r.method) continue;
      expect(Object.keys(r.args)).toEqual([...CONTRACT_SIGNATURES[r.method]]);
      expect(callTemplate(r)).toMatch(new RegExp(`^${r.method}\\(\\{`));
    }
    expect(CONTRACT_SIGNATURES.allocate_atp).toEqual(["strain_id", "mitokondria", "nukleus", "lisosom"]);
    expect(CONTRACT_SIGNATURES.synthesize_and_redeem_aether).toEqual(["strain_id", "amount"]);
    expect(CONTRACT_SIGNATURES.synthesize_elixir).toContain("elixir_type");
  });

  it("lists elixir types the contract knows", () => {
    const types = RECIPE_CATALOG.filter((r) => r.method === "synthesize_elixir").map((r) => r.args.elixir_type);
    expect(types.sort()).toEqual(["mt:elixir-aether", "mt:elixir-homeostasis", "mt:elixir-homunculus"]);
  });
});
