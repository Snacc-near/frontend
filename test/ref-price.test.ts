import { describe, it, expect } from "vitest";
import {
  buildRheaSwapUrl,
  extractPrice,
  formatUsd,
  fetchRefPrices,
  parsePriceNumber,
} from "../src/swap/refPrice.ts";
import { readSwapConfig } from "../src/swap/config.ts";

describe("RES-107: Ref / Rhea price indexer client", () => {
  it("builds the Rhea swap deep-link URL correctly", () => {
    const cfg = readSwapConfig({
      VITE_SNACC_TOKEN_ID: "snacc.near",
      VITE_REFERENCE_TOKEN_ID: "wrap.near",
      VITE_RHEA_APP_URL: "https://app.rhea.finance",
    });
    expect(buildRheaSwapUrl(cfg)).toBe("https://app.rhea.finance/#wrap.near|snacc.near");
  });

  it("parses price numbers safely across strings and numbers", () => {
    expect(parsePriceNumber(1.25)).toBe(1.25);
    expect(parsePriceNumber("4.50")).toBe(4.5);
    expect(parsePriceNumber("invalid")).toBeNull();
    expect(parsePriceNumber(-1)).toBeNull();
    expect(parsePriceNumber(null)).toBeNull();
  });

  it("formats USD prices properly with honest fallback", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.00005)).toBe("<$0.0001");
    expect(formatUsd(0.4521)).toBe("$0.4521");
    expect(formatUsd(12.5)).toBe("$12.50");
  });

  it("extracts prices from various indexer response formats", () => {
    const map = {
      "wrap.near": { price: "5.40", decimal: 24, symbol: "wNEAR" },
      "snacc.near": "0.025",
    };
    expect(extractPrice(map, "wrap.near")).toBe(5.4);
    expect(extractPrice(map, "snacc.near")).toBe(0.025);
    expect(extractPrice(map, "unknown.near")).toBeNull();
    expect(extractPrice(map, null)).toBeNull();
  });

  it("returns ready status when $SNACC is listed on the indexer", async () => {
    const cfg = readSwapConfig({
      VITE_SNACC_TOKEN_ID: "snacc.near",
      VITE_REFERENCE_TOKEN_ID: "wrap.near",
      VITE_REF_INDEXER_URL: "https://api.rhea.finance",
    });

    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          "wrap.near": { price: "5.00" },
          "snacc.near": { price: "0.25" },
        }),
        { status: 200 },
      );

    const res = await fetchRefPrices(cfg, { fetchImpl: mockFetch });
    expect(res.status).toBe("ready");
    expect(res.snaccPriceUsd).toBe("$0.2500");
    expect(res.referencePriceUsd).toBe("$5.00");
    expect(res.relativePrice).toBe("0.050000 wNEAR");
  });

  it("returns not_listed status with honest placeholder when $SNACC is not listed", async () => {
    const cfg = readSwapConfig({
      VITE_SNACC_TOKEN_ID: "snacc.near",
      VITE_REFERENCE_TOKEN_ID: "wrap.near",
      VITE_REF_INDEXER_URL: "https://api.rhea.finance",
    });

    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          "wrap.near": { price: "5.00" },
        }),
        { status: 200 },
      );

    const res = await fetchRefPrices(cfg, { fetchImpl: mockFetch });
    expect(res.status).toBe("not_listed");
    expect(res.snaccPriceUsd).toBe("—");
    expect(res.referencePriceUsd).toBe("$5.00");
    expect(res.relativePrice).toBeNull();
    expect(res.errorMessage).toBe("not listed yet on dex pool");
  });

  it("handles network failure gracefully without throwing", async () => {
    const cfg = readSwapConfig({});
    const mockFetch = async () => {
      throw new Error("Network offline");
    };

    const res = await fetchRefPrices(cfg, { fetchImpl: mockFetch });
    expect(res.status).toBe("error");
    expect(res.snaccPriceUsd).toBeNull();
    expect(res.referencePriceUsd).toBeNull();
  });
});
