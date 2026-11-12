import { describe, it, expect } from "vitest";
import {
  toBaseUnits,
  fromBaseUnits,
  fetchIntentsQuote,
  PRESET_INPUT_ASSETS,
} from "../src/swap/intentsQuote.ts";
import { readSwapConfig } from "../src/swap/config.ts";

describe("RES-108: NEAR Intents (1Click) quote client", () => {
  it("converts human amounts to base integer units accurately", () => {
    // 24 decimals (NEAR)
    expect(toBaseUnits("1", 24)).toBe("1000000000000000000000000");
    expect(toBaseUnits("0.5", 24)).toBe("500000000000000000000000");
    // 6 decimals (USDC)
    expect(toBaseUnits("10.25", 6)).toBe("10250000");
    expect(toBaseUnits("0", 6)).toBe("0");
    expect(toBaseUnits("abc", 6)).toBeNull();
  });

  it("converts base units back to human readable numbers", () => {
    expect(fromBaseUnits("1000000000000000000000000", 24)).toBe("1");
    expect(fromBaseUnits("1500000000000000000000000", 24)).toBe("1.5");
    expect(fromBaseUnits("10250000", 6)).toBe("10.25");
    expect(fromBaseUnits("0", 6)).toBe("0");
  });

  it("returns ready status with valid dry quote response", async () => {
    const cfg = readSwapConfig({
      VITE_INTENTS_API_URL: "https://1click.chaindefuser.com",
      VITE_INTENTS_DEST_ASSET_ID: "nep141:snacc.near",
      VITE_SNACC_TOKEN_ID: "snacc.near",
    });

    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          amount_out: "5000000000000000000000000",
          min_amount_out: "4950000000000000000000000",
          expiration_time: "60s",
        }),
        { status: 200 },
      );

    const res = await fetchIntentsQuote(
      { assetIn: PRESET_INPUT_ASSETS[0], amountIn: "2" },
      cfg,
      { fetchImpl: mockFetch },
    );

    expect(res.status).toBe("ready");
    expect(res.estimatedOut).toBe("5");
    expect(res.minAmountOut).toBe("4.95");
    expect(res.destSymbol).toBe("$SNACC");
  });

  it("returns no_route status when pair is not routed on intents", async () => {
    const cfg = readSwapConfig({
      VITE_INTENTS_API_URL: "https://1click.chaindefuser.com",
    });

    const mockFetch = async () =>
      new Response(
        JSON.stringify({ message: "No route found for token pair" }),
        { status: 404 },
      );

    const res = await fetchIntentsQuote(
      { assetIn: PRESET_INPUT_ASSETS[0], amountIn: "10" },
      cfg,
      { fetchImpl: mockFetch },
    );

    expect(res.status).toBe("no_route");
    expect(res.estimatedOut).toBe("—");
    expect(res.errorMessage).toBe("pair not routed on intents yet");
  });

  it("returns idle status when input amount is zero or empty", async () => {
    const cfg = readSwapConfig({});
    const res = await fetchIntentsQuote(
      { assetIn: PRESET_INPUT_ASSETS[0], amountIn: "0" },
      cfg,
    );
    expect(res.status).toBe("idle");
    expect(res.estimatedOut).toBe("—");
  });
});
