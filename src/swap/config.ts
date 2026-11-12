/**
 * Swap widget configuration (RES-107 / RES-108).
 * Every `VITE_*` value is read here, once, and falls back to a safe default.
 * Nothing in `src/swap/` feeds any game mechanic: external prices and quotes are
 * display only.
 */

export const DEFAULT_REF_INDEXER_URL = "https://api.rhea.finance";
export const DEFAULT_INTENTS_API_URL = "https://1click.chaindefuser.com";
export const DEFAULT_REFERENCE_TOKEN_ID = "wrap.near";
export const DEFAULT_INTENTS_DEST_ASSET_ID = "nep141:wrap.near";
export const DEFAULT_REFERENCE_SYMBOL = "wNEAR";
export const DEFAULT_RHEA_APP_URL = "https://app.rhea.finance";

export interface SwapConfig {
  /** NEAR contract id of the $SNACC fungible token. `null` = not configured / not listed yet. */
  snaccTokenId: string | null;
  /** Token the price is compared against (reference price shown next to $SNACC). */
  referenceTokenId: string;
  /** Ref / Rhea public price indexer base URL (no trailing slash). */
  refIndexerUrl: string;
  /** NEAR Intents 1Click API base URL (no trailing slash). */
  intentsApiUrl: string;
  /** Destination asset of the cross-chain quote (`nep141:<contract>`). */
  intentsDestAssetId: string;
  /** Short symbol of the destination asset, shown next to the estimated output. */
  intentsDestSymbol: string;
  /** True when the destination of the quote is $SNACC itself. */
  destIsSnacc: boolean;
  /** Rhea web app base URL used by the "open in rhea" deep link. */
  rheaAppUrl: string;
}

/** NEAR account / contract ids: lowercase letters, digits, `.`, `-`, `_`. */
const TOKEN_ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/;

function readString(env: Record<string, unknown>, key: string): string {
  const v = env[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Accepts only well-formed `https://` URLs (the dev server may also use localhost over http). */
export function sanitizeBaseUrl(value: string, fallback: string): string {
  if (!value) return fallback;
  try {
    const u = new URL(value);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return fallback;
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return fallback;
  }
}

export function sanitizeTokenId(value: string): string | null {
  const v = value.trim().toLowerCase();
  return TOKEN_ID_RE.test(v) ? v : null;
}

export function readSwapConfig(env: Record<string, unknown>): SwapConfig {
  const snaccTokenId = sanitizeTokenId(readString(env, "VITE_SNACC_TOKEN_ID"));
  const referenceTokenId =
    sanitizeTokenId(readString(env, "VITE_REFERENCE_TOKEN_ID")) ?? DEFAULT_REFERENCE_TOKEN_ID;
  const destOverride = readString(env, "VITE_INTENTS_DEST_ASSET_ID");
  const destFromOverride = /^nep141:[a-z0-9][a-z0-9._-]{1,63}$/.test(destOverride) ? destOverride : null;
  const intentsDestAssetId =
    destFromOverride ?? (snaccTokenId ? `nep141:${snaccTokenId}` : DEFAULT_INTENTS_DEST_ASSET_ID);
  const destIsSnacc = snaccTokenId !== null && intentsDestAssetId === `nep141:${snaccTokenId}`;
  return {
    snaccTokenId,
    referenceTokenId,
    refIndexerUrl: sanitizeBaseUrl(readString(env, "VITE_REF_INDEXER_URL"), DEFAULT_REF_INDEXER_URL),
    intentsApiUrl: sanitizeBaseUrl(readString(env, "VITE_INTENTS_API_URL"), DEFAULT_INTENTS_API_URL),
    intentsDestAssetId,
    intentsDestSymbol: destIsSnacc
      ? "$SNACC"
      : intentsDestAssetId === DEFAULT_INTENTS_DEST_ASSET_ID
        ? DEFAULT_REFERENCE_SYMBOL
        : intentsDestAssetId.replace(/^nep141:/, ""),
    destIsSnacc,
    rheaAppUrl: sanitizeBaseUrl(readString(env, "VITE_RHEA_APP_URL"), DEFAULT_RHEA_APP_URL),
  };
}

export const swapConfig: SwapConfig = readSwapConfig(
  (import.meta.env ?? {}) as unknown as Record<string, unknown>,
);
