/**
 * Read-only NEAR testnet access for the landing page (no wallet, no keys): `nft_tokens` views and
 * the curated list of real testnet transactions from the gladi evidence pack.
 */
import { safeNftMediaSrc } from "./live.ts";

export const CONTRACT_ID = "snacc-v001.testnet";
const RPCS = ["https://rpc.testnet.near.org", "https://test.rpc.fastnear.com"];

export const explorerTx = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
export const explorerAccount = (id: string) => `https://testnet.nearblocks.io/address/${id}`;
export const explorerToken = (contract: string, tokenId: string) =>
  `https://testnet.nearblocks.io/nft-token/${contract}/${encodeURIComponent(tokenId)}`;

export interface NftCard {
  tokenId: string;
  owner: string;
  title: string;
  description: string;
  src: string | null;
}

function b64(json: unknown): string {
  return btoa(JSON.stringify(json));
}

async function viewCall<T>(method: string, args: unknown, signal?: AbortSignal): Promise<T | null> {
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "snacc-landing",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: CONTRACT_ID,
            method_name: method,
            args_base64: b64(args),
          },
        }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { result?: { result?: number[] } };
      const bytes = body.result?.result;
      if (!Array.isArray(bytes)) continue;
      return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes))) as T;
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return null;
    }
  }
  return null;
}

interface RawToken {
  token_id: string;
  owner_id: string;
  metadata?: { title?: string | null; description?: string | null; media?: string | null } | null;
}

export function toNftCard(t: RawToken): NftCard {
  return {
    tokenId: String(t.token_id),
    owner: t.owner_id,
    title: t.metadata?.title || `Snacc #${t.token_id}`,
    description: t.metadata?.description || "",
    src: safeNftMediaSrc(t.metadata?.media),
  };
}

export async function fetchNftCards(limit = 9, signal?: AbortSignal): Promise<NftCard[] | null> {
  const raw = await viewCall<RawToken[]>("nft_tokens", { from_index: "0", limit }, signal);
  return raw ? raw.map(toNftCard) : null;
}

export interface EvidenceTx {
  hash: string;
  action: string;
  detail: string;
}

/**
 * Real testnet transactions, copied from `evidence/gladi-manifest.json` in the Snacc umbrella repo
 * (rehearsal run 2026-11-09, contract `snacc-v001.testnet`).
 */
export const EVIDENCE_TXS: readonly EvidenceTx[] = [
  { hash: "5JCAmSL7pLTV8mShrNuEtG5WLPkCqKkYCZBf5WGtQ2wY", action: "incubate", detail: "Extractor, strain 1" },
  { hash: "4hnA4pEUqghdtN8WycJJXCnSYQSEZ9F5DQamAuEub3GF", action: "feed", detail: "strain 1" },
  { hash: "4ABtdBdjYkynQXXMsYD8ZKUwMtNAWX1wgEpREsX3i4nH", action: "merge (splice)", detail: "strain 1 absorbs 2" },
  { hash: "8dh9iuu1HaiFRFMSKiimnHj14saC3nqNRHz4yCiurYSf", action: "extract spores", detail: "ignis" },
  { hash: "9bTCpP7FJfgTLmHw4vXJHPjpEiQEAdcosnS9iRoLuvY5", action: "transmute", detail: "ignis + lumin to redactase" },
  { hash: "8Zi3VxSmGrmWEZPM346XPQGt4DS1fAw1HnB3MicKtxCA", action: "synthesize elixir", detail: "homeostasis" },
  { hash: "B8xdaukdnf3Fh9ZkMNfXxXW7TrHVLZLeXQNdYyBtD2AG", action: "apply_tee_mutation_zero_trust", detail: "strain 5, TEE-signed" },
  { hash: "ERBRL4rTS6JHEKVsSumLYtru1hXsSYWdkGJH8d1krJaL", action: "ft_burn", detail: "$SNACC burn" },
  { hash: "AhEk4TNNeTj4orchvXSuPood8vAxTiQNWhZZwSdD9JH9", action: "harvest_starving_strain", detail: "snack it" },
  { hash: "4o4qwoGZtR7HE5E3VnjQZpXwDicpa9QVBzXHS1YP2v4f", action: "hostile_takeover_splice", detail: "steal a plate" },
  { hash: "HfhZG6sAdqpKRSJsYRagD9mapCq7JrJvPthkUxFUZQQn", action: "nft_transfer", detail: "strain 4 to a second account" },
  { hash: "9F4KGd9bZXwtQEpvJGQYcx2Vz7fsa9LbyyTySxYhfLjW", action: "advance_epoch", detail: "close epoch 0" },
];

/** The TEE-verified mutation, linked from the enclave chapter. */
export const TEE_TX = EVIDENCE_TXS.find((t) => t.action === "apply_tee_mutation_zero_trust")!;
