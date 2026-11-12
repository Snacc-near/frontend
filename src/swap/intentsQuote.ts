/**
 * NEAR Intents (1Click / Defuse) cross-chain quote client (RES-108).
 * Provides dry-run quotes for cross-chain swaps into $SNACC or reference assets.
 * Preview only: no on-chain transactions or wallet signatures are sent by this UI.
 */

import { SwapConfig, swapConfig } from "./config.ts";
import { httpJson, HttpOptions } from "./http.ts";

export interface SupportedAsset {
  id: string;
  symbol: string;
  chain: string;
  decimals: number;
}

export const PRESET_INPUT_ASSETS: SupportedAsset[] = [
  {
    id: "nep141:wrap.near",
    symbol: "NEAR",
    chain: "NEAR",
    decimals: 24,
  },
  {
    id: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    symbol: "USDC",
    chain: "NEAR",
    decimals: 6,
  },
  {
    id: "eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    symbol: "USDC",
    chain: "Ethereum",
    decimals: 6,
  },
  {
    id: "sol:native",
    symbol: "SOL",
    chain: "Solana",
    decimals: 9,
  },
  {
    id: "btc:native",
    symbol: "BTC",
    chain: "Bitcoin",
    decimals: 8,
  },
];

export interface IntentsQuoteRequest {
  assetIn: SupportedAsset;
  amountIn: string;
}

export interface IntentsQuoteResult {
  status: "ready" | "no_route" | "error" | "idle";
  amountIn: string;
  assetInSymbol: string;
  estimatedOut: string;
  minAmountOut: string;
  destSymbol: string;
  expirationTime?: string;
  errorMessage?: string;
}

/** Converts human readable amount (e.g. "1.5") to base integer units (e.g. 1500000). */
export function toBaseUnits(amount: string, decimals: number): string | null {
  const clean = amount.trim();
  if (!clean || !/^\d+(\.\d+)?$/.test(clean)) return null;

  const [whole, frac = ""] = clean.split(".");
  const trimmedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
  const combined = whole + trimmedFrac;
  const stripped = combined.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

/** Converts base integer units to a formatted human readable number. */
export function fromBaseUnits(rawUnits: string, decimals: number): string {
  if (!rawUnits || rawUnits === "0") return "0";
  const padded = rawUnits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, "");
  if (!frac) return whole;
  return `${whole}.${frac.slice(0, 4)}`;
}

export async function fetchIntentsQuote(
  req: IntentsQuoteRequest,
  config: SwapConfig = swapConfig,
  options: HttpOptions = {},
): Promise<IntentsQuoteResult> {
  const baseUnits = toBaseUnits(req.amountIn, req.assetIn.decimals);
  if (!baseUnits || baseUnits === "0") {
    return {
      status: "idle",
      amountIn: req.amountIn,
      assetInSymbol: req.assetIn.symbol,
      estimatedOut: "—",
      minAmountOut: "—",
      destSymbol: config.intentsDestSymbol,
    };
  }

  const endpoint = `${config.intentsApiUrl}/v0/quote`;
  const payload = {
    dry: true,
    defuse_asset_identifier_in: req.assetIn.id,
    defuse_asset_identifier_out: config.intentsDestAssetId,
    exact_amount_in: baseUnits,
  };

  const res = await httpJson(endpoint, {
    ...options,
    method: "POST",
    jsonBody: payload,
  });

  if (!res.ok) {
    const isNoRoute = res.status === 404 || res.status === 400;
    return {
      status: isNoRoute ? "no_route" : "error",
      amountIn: req.amountIn,
      assetInSymbol: req.assetIn.symbol,
      estimatedOut: "—",
      minAmountOut: "—",
      destSymbol: config.intentsDestSymbol,
      errorMessage: isNoRoute
        ? "pair not routed on intents yet"
        : res.message ?? "quote service temporarily unavailable",
    };
  }

  const body = (typeof res.body === "object" && res.body !== null ? res.body : {}) as Record<string, unknown>;
  const amountOutRaw = typeof body.amount_out === "string" ? body.amount_out : null;
  const minAmountOutRaw = typeof body.min_amount_out === "string" ? body.min_amount_out : amountOutRaw;

  if (!amountOutRaw) {
    return {
      status: "no_route",
      amountIn: req.amountIn,
      assetInSymbol: req.assetIn.symbol,
      estimatedOut: "—",
      minAmountOut: "—",
      destSymbol: config.intentsDestSymbol,
      errorMessage: "no valid route found for pair",
    };
  }

  const destDecimals = config.destIsSnacc ? 24 : 24;
  const estimatedOut = fromBaseUnits(amountOutRaw, destDecimals);
  const minOut = minAmountOutRaw ? fromBaseUnits(minAmountOutRaw, destDecimals) : estimatedOut;

  return {
    status: "ready",
    amountIn: req.amountIn,
    assetInSymbol: req.assetIn.symbol,
    estimatedOut,
    minAmountOut: minOut,
    destSymbol: config.intentsDestSymbol,
    expirationTime: typeof body.expiration_time === "string" ? body.expiration_time : undefined,
  };
}
