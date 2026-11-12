/**
 * Read-only NEAR testnet access for the landing page (no wallet, no keys): `nft_tokens` views and
 * the curated list of real testnet transactions from the gladi evidence pack.
 */
import { safeNftMediaSrc } from "./live.ts";
import { CONTRACT_ID, explorerAccount, explorerTx, viewCall } from "../../data/nearView.ts";

export { CONTRACT_ID, explorerAccount, explorerTx };
export const explorerToken = (contract: string, tokenId: string) =>
  `https://testnet.nearblocks.io/nft-token/${contract}/${encodeURIComponent(tokenId)}`;

export interface NftCard {
  tokenId: string;
  owner: string;
  title: string;
  description: string;
  src: string | null;
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

/** Real testnet transactions (rehearsal run 2026-11-09), shared with the game screens. */
export { EVIDENCE_TXS, TEE_TX, type EvidenceTx } from "../../data/evidence.ts";
