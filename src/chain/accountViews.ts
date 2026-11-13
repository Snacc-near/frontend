/**
 * Read-only views for the connected account (UI-145): NEAR balance (`view_account`), `$SNACC`
 * balance (`ft_balance_of`), NEP-145 storage registration and the owned strains (`get_colony`).
 * Every reader returns `null` when the RPC cannot answer, so the UI shows "—" instead of a number.
 */
import { RPCS, viewCall } from "../data/nearView.ts";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Storage cost per byte on NEAR: 10^19 yocto. */
const YOCTO_PER_BYTE = 10n ** 19n;

/** Spendable NEAR (yocto) of an account: `amount` minus the part locked for its own storage. */
export async function fetchNearBalance(
  accountId: string,
  signal?: AbortSignal,
  fetchImpl: FetchLike = (i, init) => fetch(i, init),
): Promise<string | null> {
  for (const url of RPCS) {
    if (signal?.aborted) return null;
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "snacc-account",
          method: "query",
          params: { request_type: "view_account", finality: "final", account_id: accountId },
        }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { result?: { amount?: string; storage_usage?: number }; error?: { cause?: { name?: string } } };
      // A brand-new implicit account (e.g. from an email login) does not exist on chain until funded.
      if (body.error?.cause?.name === "UNKNOWN_ACCOUNT") return "0";
      const amount = body.result?.amount;
      if (typeof amount !== "string") continue;
      const locked = BigInt(body.result?.storage_usage ?? 0) * YOCTO_PER_BYTE;
      const free = BigInt(amount) - locked;
      return (free > 0n ? free : 0n).toString();
    } catch {
      // try the next endpoint
    }
  }
  return null;
}

const asU128 = (v: unknown): string | null => (typeof v === "string" || typeof v === "number" ? String(v) : null);

export async function fetchSnaccBalance(accountId: string, signal?: AbortSignal): Promise<string | null> {
  return asU128(await viewCall<unknown>("ft_balance_of", { account_id: accountId }, signal));
}

/** `get_total_wealth`: `ft_balance_of` plus the `$SNACC` held inside the account's strains. */
export async function fetchTotalWealth(accountId: string, signal?: AbortSignal): Promise<string | null> {
  return asU128(await viewCall<unknown>("get_total_wealth", { account_id: accountId }, signal));
}

export interface StorageState {
  registered: boolean;
  /** `storage_balance_bounds().min` in yocto. */
  minYocto: string;
}

/** `storage_balance_of` + `storage_balance_bounds`; null when either view fails. */
export async function fetchStorageState(accountId: string, signal?: AbortSignal): Promise<StorageState | null> {
  const [balance, bounds] = await Promise.all([
    viewCall<{ total?: unknown } | null>("storage_balance_of", { account_id: accountId }, signal),
    viewCall<{ min?: unknown }>("storage_balance_bounds", {}, signal),
  ]);
  const min = asU128(bounds?.min);
  if (bounds === null || min === null) return null;
  // `storage_balance_of` legitimately returns JSON `null` for an unregistered account, which
  // `viewCall` also uses for "no answer"; a registered account always has total > 0.
  const total = asU128(balance?.total);
  return { registered: total !== null && BigInt(total) > 0n, minYocto: min };
}

export interface OwnedStrain {
  strain_id: number;
  vitality: number;
  effective_vitality: number;
  status: string;
  role_mask: number;
  generation: number;
}

/** `get_colony(owner_id)`: the account's living strains (liquidated and spliced ones excluded). */
export async function fetchColony(accountId: string, signal?: AbortSignal): Promise<OwnedStrain[] | null> {
  const raw = await viewCall<Array<Record<string, unknown>>>("get_colony", { owner_id: accountId }, signal);
  if (!Array.isArray(raw)) return null;
  return raw.map((s) => ({
    strain_id: Number(s.strain_id),
    vitality: Number(s.vitality ?? 0),
    effective_vitality: Number(s.effective_vitality ?? s.vitality ?? 0),
    status: typeof s.status === "string" ? s.status : "Active",
    role_mask: Number(s.role_mask ?? 0),
    generation: Number(s.generation ?? 0),
  }));
}
