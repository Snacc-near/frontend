/**
 * Read-only NEAR testnet view calls for the landing and the game (no wallet, no keys). Contract
 * views return u128 values as bare JSON numbers, so integers of 16+ digits are quoted before
 * parsing to keep every digit.
 */

export const CONTRACT_ID = "snacc-v001.testnet";
export const RPCS = ["https://rpc.testnet.near.org", "https://test.rpc.fastnear.com"] as const;
/** `$SNACC` decimals (`ft_metadata.decimals`). */
export const SNACC_DECIMALS = 24;

export const explorerTx = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
export const explorerAccount = (id: string) => `https://testnet.nearblocks.io/address/${id}`;

/** Quotes long integer literals (16+ digits) so `JSON.parse` keeps them exact as strings. */
export function quoteBigInts(text: string): string {
  return text.replace(/([:[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"$2"');
}

export function parseJsonBig<T>(text: string): T {
  return JSON.parse(quoteBigInts(text)) as T;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Calls a view method; tries each RPC for 7 s and returns `null` when all fail. */
export async function viewCall<T>(
  method: string,
  args: unknown,
  signal?: AbortSignal,
  fetchImpl: FetchLike = (i, init) => fetch(i, init),
  contractId: string = CONTRACT_ID,
): Promise<T | null> {
  for (const url of RPCS) {
    if (signal?.aborted) return null;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 7000);
    const relay = () => ac.abort();
    signal?.addEventListener("abort", relay);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "snacc-view",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: contractId,
            method_name: method,
            args_base64: btoa(JSON.stringify(args)),
          },
        }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { result?: { result?: number[] } };
      const bytes = body.result?.result;
      if (!Array.isArray(bytes)) continue;
      return parseJsonBig<T>(new TextDecoder().decode(new Uint8Array(bytes)));
    } catch {
      // timeout or network error: try the next endpoint (unless the caller aborted)
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", relay);
    }
  }
  return null;
}

/** Formats an integer amount with `decimals` places, e.g. yocto-$SNACC to `0.0358`. */
export function formatUnits(raw: string | number | bigint | null | undefined, decimals = SNACC_DECIMALS, maxFrac = 4): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  let v: bigint;
  try {
    v = typeof raw === "bigint" ? raw : BigInt(typeof raw === "number" ? Math.trunc(raw) : String(raw).trim());
  } catch {
    return "—";
  }
  const neg = v < 0n;
  if (neg) v = -v;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  let frac = (v % base).toString().padStart(decimals, "0").slice(0, maxFrac).replace(/0+$/, "");
  if (!frac && whole === 0n && v > 0n) frac = "";
  const tiny = whole === 0n && !frac && v > 0n;
  const out = tiny ? `<0.${"0".repeat(Math.max(0, maxFrac - 1))}1` : `${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
  return neg ? `-${out}` : out;
}
