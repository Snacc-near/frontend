/**
 * NEAR Intents 1Click quote preview (`POST /v0/quote` with `dry: true`).
 * A dry quote generates no deposit address and starts no swap; this UI signs nothing and moves no
 * funds. `$SNACC` is not in the 1Click token list (it is a testnet token), so only reference pairs
 * between listed assets can be quoted.
 * Schema: https://1click.chaindefuser.com/docs/v0/openapi.yaml (QuoteRequest / QuoteResponse).
 */

import { swapConfig, type SwapConfig } from "./config.ts";
import { httpJson, type HttpOptions } from "./http.ts";

export interface SupportedAsset {
  /** 1Click `assetId`, copied from `GET /v0/tokens`. */
  id: string;
  symbol: string;
  chain: string;
  decimals: number;
}

/** Listed 1Click assets (ids and decimals from `GET /v0/tokens`, checked 2026-11-12). */
export const QUOTE_ASSETS: readonly SupportedAsset[] = [
  { id: "nep141:wrap.near", symbol: "wNEAR", chain: "NEAR", decimals: 24 },
  { id: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", symbol: "USDC", chain: "NEAR", decimals: 6 },
  { id: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near", symbol: "USDC", chain: "Ethereum", decimals: 6 },
  { id: "nep141:eth.omft.near", symbol: "ETH", chain: "Ethereum", decimals: 18 },
  { id: "nep141:sol.omft.near", symbol: "SOL", chain: "Solana", decimals: 9 },
  { id: "nep141:btc.omft.near", symbol: "BTC", chain: "Bitcoin", decimals: 8 },
];

/**
 * The schema requires a recipient and a refund address even for a dry quote. Nothing is deposited
 * or sent in a dry run, so a fixed public intents account is used as the placeholder.
 */
export const DRY_RUN_PLACEHOLDER_ACCOUNT = "intents.near";
export const QUOTE_SLIPPAGE_BPS = 100;

export interface IntentsQuoteRequest {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  amountIn: string;
}

export type QuoteStatus = "idle" | "ready" | "needs_key" | "error";

export interface IntentsQuoteResult {
  status: QuoteStatus;
  amountIn: string;
  assetInSymbol: string;
  assetOutSymbol: string;
  amountOut: string;
  minAmountOut: string;
  /** Seconds, from `quote.timeEstimate`. */
  timeEstimateSec?: number;
  message?: string;
}

/** Human amount ("1.5") to base units ("1500000" for 6 decimals); null when not a plain decimal. */
export function toBaseUnits(amount: string, decimals: number): string | null {
  const clean = amount.trim();
  if (!clean || !/^\d+(\.\d+)?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  const combined = whole + frac.slice(0, decimals).padEnd(decimals, "0");
  const stripped = combined.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

/** Base units to a short human number (up to 6 fraction digits). */
export function fromBaseUnits(rawUnits: string, decimals: number): string {
  if (!/^\d+$/.test(rawUnits)) return "—";
  if (/^0+$/.test(rawUnits)) return "0";
  const padded = rawUnits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals).replace(/^0+(?=\d)/, "");
  const frac = padded.slice(padded.length - decimals).slice(0, 6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export function buildQuotePayload(req: IntentsQuoteRequest, amountBase: string, nowMs: number = Date.now()) {
  return {
    dry: true,
    swapType: "EXACT_INPUT",
    slippageTolerance: QUOTE_SLIPPAGE_BPS,
    originAsset: req.assetIn.id,
    depositType: "INTENTS",
    destinationAsset: req.assetOut.id,
    amount: amountBase,
    refundTo: DRY_RUN_PLACEHOLDER_ACCOUNT,
    refundType: "INTENTS",
    recipient: DRY_RUN_PLACEHOLDER_ACCOUNT,
    recipientType: "INTENTS",
    deadline: new Date(nowMs + 10 * 60_000).toISOString(),
  };
}

function base(req: IntentsQuoteRequest, status: QuoteStatus, message?: string): IntentsQuoteResult {
  return {
    status,
    amountIn: req.amountIn,
    assetInSymbol: req.assetIn.symbol,
    assetOutSymbol: req.assetOut.symbol,
    amountOut: "—",
    minAmountOut: "—",
    message,
  };
}

export async function fetchIntentsQuote(
  req: IntentsQuoteRequest,
  config: SwapConfig = swapConfig,
  options: HttpOptions = {},
): Promise<IntentsQuoteResult> {
  if (req.assetIn.id === req.assetOut.id) return base(req, "idle", "pick two different assets");
  const amountBase = toBaseUnits(req.amountIn, req.assetIn.decimals);
  if (!amountBase || amountBase === "0") return base(req, "idle", "enter an amount above zero");

  const res = await httpJson(`${config.intentsApiUrl}/v0/quote`, {
    ...options,
    method: "POST",
    jsonBody: buildQuotePayload(req, amountBase),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return base(req, "needs_key", "quote preview unavailable without an API key");
    }
    if (res.reason === "http") {
      return base(req, "error", `1Click returned HTTP ${res.status ?? "error"}${res.message ? `: ${res.message}` : ""}`);
    }
    return base(req, "error", res.reason === "timeout" ? "1Click did not answer in time" : "1Click could not be reached");
  }

  const body = (typeof res.body === "object" && res.body !== null ? res.body : {}) as { quote?: Record<string, unknown> };
  const quote = body.quote ?? {};
  const amountOut = typeof quote.amountOut === "string" ? quote.amountOut : null;
  if (!amountOut) return base(req, "error", "1Click answered without quote.amountOut");
  const minOut = typeof quote.minAmountOut === "string" ? quote.minAmountOut : amountOut;
  const decimals = req.assetOut.decimals;
  return {
    ...base(req, "ready"),
    amountOut: fromBaseUnits(amountOut, decimals),
    minAmountOut: fromBaseUnits(minOut, decimals),
    timeEstimateSec: typeof quote.timeEstimate === "number" ? quote.timeEstimate : undefined,
  };
}
