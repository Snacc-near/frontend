import { describe, it, expect } from "vitest";
import {
  QUOTE_ASSETS,
  buildQuotePayload,
  fetchIntentsQuote,
  fromBaseUnits,
  toBaseUnits,
} from "../src/swap/intentsQuote.ts";
import { readSwapConfig } from "../src/swap/config.ts";
import type { FetchLike } from "../src/swap/http.ts";

const config = readSwapConfig({});
const NEAR = QUOTE_ASSETS[0];
const USDC = QUOTE_ASSETS[1];

function reply(status: number, body: unknown): { fetchImpl: FetchLike; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { fetchImpl, calls };
}

describe("1Click dry quote client (POST /v0/quote)", () => {
  it("converts amounts to and from base units", () => {
    expect(toBaseUnits("1", 24)).toBe("1000000000000000000000000");
    expect(toBaseUnits("1.5", 6)).toBe("1500000");
    expect(toBaseUnits("abc", 6)).toBeNull();
    expect(fromBaseUnits("3503343", 6)).toBe("3.503343");
    expect(fromBaseUnits("1000000", 6)).toBe("1");
  });

  it("builds the request with the fields the 1Click schema requires", () => {
    const p = buildQuotePayload({ assetIn: NEAR, assetOut: USDC, amountIn: "1" }, "1000000000000000000000000", 0);
    for (const k of ["dry", "swapType", "slippageTolerance", "originAsset", "depositType", "destinationAsset", "amount", "refundTo", "refundType", "recipient", "recipientType", "deadline"]) {
      expect(p).toHaveProperty(k);
    }
    expect(p.dry).toBe(true);
    expect(p.swapType).toBe("EXACT_INPUT");
    expect(p.originAsset).toBe("nep141:wrap.near");
    expect(p.deadline).toBe(new Date(600_000).toISOString());
    expect(JSON.stringify(p)).not.toContain("defuse_asset_identifier");
  });

  it("lists only real 1Click asset ids and no $SNACC", () => {
    for (const a of QUOTE_ASSETS) expect(a.id).toMatch(/^nep141:[a-z0-9.-]+$/);
    expect(QUOTE_ASSETS.some((a) => /snacc/i.test(a.id + a.symbol))).toBe(false);
  });

  it("parses quote.amountOut from a 201 response", async () => {
    const { fetchImpl, calls } = reply(201, {
      quote: { amountIn: "1000000000000000000000000", amountOut: "3503343", minAmountOut: "3468309", timeEstimate: 12 },
      quoteRequest: { dry: true },
    });
    const r = await fetchIntentsQuote({ assetIn: NEAR, assetOut: USDC, amountIn: "1" }, config, { fetchImpl });
    expect(r.status).toBe("ready");
    expect(r.amountOut).toBe("3.503343");
    expect(r.minAmountOut).toBe("3.468309");
    expect(r.timeEstimateSec).toBe(12);
    expect(calls[0].url).toBe("https://1click.chaindefuser.com/v0/quote");
    expect(calls[0].init?.method).toBe("POST");
  });

  it("reports HTTP 400 as an error with the service message, not as 'no route'", async () => {
    const { fetchImpl } = reply(400, { message: ["swapType should not be empty"], error: "Bad Request" });
    const r = await fetchIntentsQuote({ assetIn: NEAR, assetOut: USDC, amountIn: "1" }, config, { fetchImpl });
    expect(r.status).toBe("error");
    expect(r.message).toContain("400");
    expect(r.message).toContain("swapType should not be empty");
    expect(r.message).not.toMatch(/route/i);
  });

  it("says plainly when the service wants an API key", async () => {
    const { fetchImpl } = reply(401, { message: "Unauthorized" });
    const r = await fetchIntentsQuote({ assetIn: NEAR, assetOut: USDC, amountIn: "1" }, config, { fetchImpl });
    expect(r.status).toBe("needs_key");
    expect(r.message).toBe("quote preview unavailable without an API key");
  });

  it("does not call the network for a zero amount or the same asset twice", async () => {
    const { fetchImpl, calls } = reply(201, {});
    expect((await fetchIntentsQuote({ assetIn: NEAR, assetOut: USDC, amountIn: "0" }, config, { fetchImpl })).status).toBe("idle");
    expect((await fetchIntentsQuote({ assetIn: NEAR, assetOut: NEAR, amountIn: "1" }, config, { fetchImpl })).status).toBe("idle");
    expect(calls).toHaveLength(0);
  });
});
