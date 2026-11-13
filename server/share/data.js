// @ts-check
/**
 * Read-only data for the share previews (UI-157): NEAR testnet views through the public RPC and two public
 * Supabase views. Nothing here signs anything or writes anything; every call has a short timeout and a
 * failure becomes `null` fields, never an exception, so a crawler always gets an answer.
 */
import { CONTRACT_ID, parseAccountId } from "./validate.js";
import { svgFromMedia } from "./svg.js";

export const RPCS = ["https://test.rpc.fastnear.com", "https://rpc.testnet.fastnear.com"];
const TIMEOUT_MS = 3000;

/**
 * @typedef {{ fetch?: typeof fetch, env?: Record<string, string | undefined>, timeoutMs?: number }} Deps
 * @typedef {{ ok: true, value: unknown } | { ok: false, kind: "rpc" | "contract" }} ViewResult
 */

/** Fetch with an abort timer; returns null on a network error or a timeout. */
async function timedFetch(/** @type {string} */ url, /** @type {RequestInit} */ init, /** @type {Deps} */ deps) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  try {
    return await (deps.fetch ?? fetch)(url, { ...init, signal: ac.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One `call_function` view on the Snacc contract. `ok: false, kind: "contract"` means the contract itself
 * refused (for example a strain that does not exist); `kind: "rpc"` means no endpoint answered usefully.
 * @returns {Promise<ViewResult>}
 */
export async function nearView(/** @type {string} */ method, /** @type {unknown} */ args, /** @type {Deps} */ deps = {}) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "snacc-share",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: CONTRACT_ID,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    },
  });
  for (const url of RPCS) {
    const res = await timedFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body }, deps);
    if (!res || !res.ok) continue;
    /** @type {any} */
    let json;
    try {
      json = await res.json();
    } catch {
      continue;
    }
    if (!json || json.error) continue;
    const r = json.result;
    if (r && typeof r.error === "string") return { ok: false, kind: "contract" };
    if (!r || !Array.isArray(r.result)) continue;
    try {
      const value = JSON.parse(new TextDecoder().decode(Uint8Array.from(r.result)));
      return value === null ? { ok: false, kind: "contract" } : { ok: true, value };
    } catch {
      continue;
    }
  }
  return { ok: false, kind: "rpc" };
}

const isObj = (/** @type {unknown} */ v) => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (/** @type {unknown} */ v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * @typedef {{
 *   state: "ok", id: number, owner: string | null, status: string | null, effectiveVitality: number | null,
 *   vitality: number | null, generation: number | null, svg: string | null
 * } | { state: "missing", id: number } | { state: "unavailable", id: number }} SnaccData
 */

/**
 * One Snacc: owner, status, vitality, generation and the on-chain SVG (all optional).
 * @param {number} id
 * @param {Deps} [deps]
 * @returns {Promise<SnaccData>}
 */
export async function loadSnacc(id, deps = {}) {
  const [tok, st] = await Promise.all([
    nearView("nft_token", { token_id: String(id) }, deps),
    nearView("get_strain", { strain_id: id }, deps),
  ]);
  if (!tok.ok && !st.ok) {
    return { state: tok.kind === "contract" && st.kind === "contract" ? "missing" : "unavailable", id };
  }
  const token = tok.ok && isObj(tok.value) ? /** @type {Record<string, any>} */ (tok.value) : null;
  const strain = st.ok && isObj(st.value) ? /** @type {Record<string, any>} */ (st.value) : null;
  const ownerRaw = typeof token?.owner_id === "string" ? token.owner_id : strain?.owner_id;
  return {
    state: "ok",
    id,
    owner: parseAccountId(ownerRaw),
    status: typeof strain?.status === "string" && /^[A-Za-z]{1,24}$/.test(strain.status) ? strain.status : null,
    effectiveVitality: num(strain?.effective_vitality),
    vitality: num(strain?.vitality),
    generation: num(strain?.generation),
    svg: svgFromMedia(token?.metadata?.media),
  };
}

/** The Supabase project URL and publishable key from the environment, or null when the profile database is off. */
export function supabaseEnv(/** @type {Record<string, string | undefined>} */ env) {
  const url = (env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!key || !/^https:\/\/[^/\s]+$/.test(url)) return null;
  return { url, key };
}

/** One public read on a `*_snacc` view or table; the first row, or null. */
async function restFirst(
  /** @type {{ url: string, key: string }} */ cfg,
  /** @type {string} */ table,
  /** @type {Record<string, string>} */ query,
  /** @type {Deps} */ deps,
) {
  const res = await timedFetch(
    `${cfg.url}/rest/v1/${table}?${new URLSearchParams({ ...query, limit: "1" }).toString()}`,
    { headers: { apikey: cfg.key, accept: "application/json" } },
    deps,
  );
  if (!res || !res.ok) return null;
  try {
    const rows = await res.json();
    return Array.isArray(rows) && isObj(rows[0]) ? /** @type {Record<string, any>} */ (rows[0]) : null;
  } catch {
    return null;
  }
}

/**
 * @typedef {{ account: string, username: string | null, level: number | null, totalXp: number | null, snaccCount: number | null }} ProfileData
 */

/**
 * A player: username (profiles_snacc), level and XP (player_xp_snacc) and the number of Snaccs on chain.
 * @param {string} account
 * @param {Deps} [deps]
 * @returns {Promise<ProfileData>}
 */
export async function loadProfile(account, deps = {}) {
  const cfg = supabaseEnv(deps.env ?? process.env);
  const eq = { near_account_id: `eq.${account}` };
  const [profile, xp, supply] = await Promise.all([
    cfg ? restFirst(cfg, "profiles_snacc", { select: "username", ...eq }, deps) : null,
    cfg ? restFirst(cfg, "player_xp_snacc", { select: "level,total_xp", ...eq }, deps) : null,
    nearView("nft_supply_for_owner", { account_id: account }, deps),
  ]);
  const count = supply.ok && /^\d{1,9}$/.test(String(supply.value)) ? Number(supply.value) : null;
  const username = typeof profile?.username === "string" && /^[a-z0-9_]{3,20}$/.test(profile.username) ? profile.username : null;
  return { account, username, level: num(xp?.level), totalXp: num(xp?.total_xp), snaccCount: count };
}
