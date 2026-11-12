/**
 * Tests for RES-121: Recipe Search with Qwen Embedding & Rerank
 */

import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  vectorizeQuery,
  searchRecipes,
  RECIPE_CATALOG,
} from "../src/recipes/qwenSearch.ts";

describe("RES-121: Qwen Semantic Recipe Search & Reranker", () => {
  it("calculates exact cosine similarity", () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(0.0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("vectorizes natural language queries into 10-dimensional concept space", () => {
    const feverVec = vectorizeQuery("how to protect against fever burn 610");
    expect(feverVec[0]).toBeGreaterThan(0); // fever
    expect(feverVec[3]).toBeGreaterThan(0); // burn/shield

    const divVec = vectorizeQuery("claim industrial dividend pool");
    expect(divVec[4]).toBeGreaterThan(0); // dividend
  });

  it("returns all catalog entries when query is empty", async () => {
    const all = await searchRecipes("");
    expect(all.length).toBe(RECIPE_CATALOG.length);
    expect(all[0]?.matchPercentage).toBe(100);
  });

  it("ranks Homeostasis Buffer highest for fever protection queries", async () => {
    const results = await searchRecipes("how to protect against calcination fever burn");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.recipe.id).toBe("synthesize-homeostasis");
    expect(results[0]?.matchPercentage).toBeGreaterThanOrEqual(70);
  });

  it("ranks Cryo-Synthase highest for bmr decay reduction queries", async () => {
    const results = await searchRecipes("slow down bmr decay rate");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.recipe.id).toBe("transmute-synthase");
  });

  it("ranks Aether Sovereign highest for industrial dividend queries", async () => {
    const results = await searchRecipes("industrial dividend pool coupon");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.recipe.id).toBe("synthesize-aether");
  });

  it("ranks Mitochondria power plant for energy atp queries", async () => {
    const results = await searchRecipes("mitochondria atp power plant upgrade");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.recipe.id).toBe("organel-mitokondria");
  });
});
