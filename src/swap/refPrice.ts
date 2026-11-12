/**
 * Ref / Rhea price indexer client (RES-107).
 * Reads public prices from Ref / Rhea indexer for display only.
 * External price data is display only and never feeds any game mechanic.
 */

import { SwapConfig, swapConfig } from "./config.ts";
import { httpJson, HttpOptions } from "./http.ts";

export interface TokenPriceEntry {
  price?: string | number;
  decimal?: number;
  symbol?: string;
}

export type TokenPriceMap = Record<string, TokenPriceEntry | string>;

export interface RefPriceModel {
  status: "ready" | "not_listed" | "error" | "loading";
  snaccPriceUsd: string | null;
  referencePriceUsd: string | null;
  relativePrice: string | null;
  referenceSymbol: string;
  rheaSwapUrl: string;
  updatedAtMs: number | null;
  errorMessage?: string;
}

export function buildRheaSwapUrl(config: SwapConfig): string {
  const base = config.rheaAppUrl.replace(/\/+$/, "");
  const pair = `${config.referenceTokenId}|${config.snaccTokenId ?? ""}`;
  return `${base}/#${pair}`;
}

export function parsePriceNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw.trim());
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export function formatUsd(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return "—";
  if (price === 0) return "$0.00";
  if (price < 0.0001) return `<$0.0001`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function extractPrice(prices: TokenPriceMap, tokenId: string | null): number | null {
  if (!tokenId) return null;
  const entry = prices[tokenId] ?? prices[tokenId.toLowerCase()];
  if (entry === undefined) return null;
  if (typeof entry === "string" || typeof entry === "number") return parsePriceNumber(entry);
  if (typeof entry === "object" && entry !== null) return parsePriceNumber(entry.price);
  return null;
}

export async function fetchRefPrices(
  config: SwapConfig = swapConfig,
  options: HttpOptions = {},
): Promise<RefPriceModel> {
  const rheaSwapUrl = buildRheaSwapUrl(config);
  const endpoint = `${config.refIndexerUrl}/list-token-price`;

  const res = await httpJson(endpoint, options);
  if (!res.ok) {
    return {
      status: "error",
      snaccPriceUsd: null,
      referencePriceUsd: null,
      relativePrice: null,
      referenceSymbol: DEFAULT_REF_SYMBOL(config),
      rheaSwapUrl,
      updatedAtMs: null,
      errorMessage: res.message ?? res.reason,
    };
  }

  const rawMap = (typeof res.body === "object" && res.body !== null ? res.body : {}) as TokenPriceMap;
  const refUsd = extractPrice(rawMap, config.referenceTokenId);
  const snaccUsd = extractPrice(rawMap, config.snaccTokenId);

  const relative =
    snaccUsd !== null && refUsd !== null && refUsd > 0
      ? (snaccUsd / refUsd).toFixed(6)
      : null;

  const isSnaccListed = config.snaccTokenId !== null && snaccUsd !== null;

  return {
    status: isSnaccListed ? "ready" : "not_listed",
    snaccPriceUsd: formatUsd(snaccUsd),
    referencePriceUsd: formatUsd(refUsd),
    relativePrice: relative ? `${relative} ${DEFAULT_REF_SYMBOL(config)}` : null,
    referenceSymbol: DEFAULT_REF_SYMBOL(config),
    rheaSwapUrl,
    updatedAtMs: Date.now(),
    errorMessage: isSnaccListed ? undefined : "not listed yet on dex pool",
  };
}

function DEFAULT_REF_SYMBOL(config: SwapConfig): string {
  if (config.referenceTokenId === "wrap.near") return "wNEAR";
  return config.referenceTokenId.replace(/\.near$/, "").toUpperCase();
}
