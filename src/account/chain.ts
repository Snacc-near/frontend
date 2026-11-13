/**
 * Chain-index reads (UI-155 lineage + history, UI-156 graveyard). The contract stores no parent ids, so the backend's
 * `chain-index` function rebuilds them from the contract's NEP-297 events into three public, read-only views:
 * `strain_lineage_snacc`, `strain_history_snacc` and `graveyard_snacc` (current state generation only). This file holds the
 * queries (they take the client, so it never imports Supabase) and the pure mapping: rows to lineage, to plain-words history
 * lines, to graveyard lines and filters. Amounts are read from the exact `data` payload (16+ digit integers are strings there),
 * never from the numeric `amount` column, which PostgREST sends as a lossy JSON number.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUnits } from "../data/nearView.ts";

export type LineageRelation = "divided" | "spliced_into" | "hostile";

export interface LineageRow {
  child_id: number;
  parent_id: number;
  relation: LineageRelation;
  generation: number | null;
  actor: string | null;
  tx_hash: string;
  block_time: string;
}

export interface HistoryRow {
  strain_id: number;
  event: string;
  role: string | null;
  actor: string | null;
  data: Record<string, unknown>;
  tx_hash: string;
  block_time: string;
}

export type GraveCause = "harvested_starving" | "spliced_burned" | "hostile_takeover";

export interface GraveRow {
  strain_id: number;
  cause: GraveCause;
  by_account: string | null;
  absorbed_into: number | null;
  owner_before: string | null;
  tx_hash: string;
  block_time: string;
}

const RELATIONS: readonly LineageRelation[] = ["divided", "spliced_into", "hostile"];
const CAUSES: readonly GraveCause[] = ["harvested_starving", "spliced_burned", "hostile_takeover"];

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const asId = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
};
const asText = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

// ---------------------------------------------------------------------------------------------
// Normalizers (anything unexpected is dropped, never shown half-read)
// ---------------------------------------------------------------------------------------------

export function normalizeLineage(data: unknown): LineageRow[] {
  if (!Array.isArray(data)) return [];
  const out: LineageRow[] = [];
  for (const r of data) {
    if (!isRecord(r)) continue;
    const child = asId(r["child_id"]);
    const parent = asId(r["parent_id"]);
    const relation = RELATIONS.find((x) => x === r["relation"]);
    const tx = asText(r["tx_hash"]);
    const time = asText(r["block_time"]);
    if (child === null || parent === null || !relation || !tx || !time) continue;
    out.push({ child_id: child, parent_id: parent, relation, generation: asId(r["generation"]), actor: asText(r["actor"]), tx_hash: tx, block_time: time });
  }
  return out;
}

export function normalizeHistory(data: unknown): HistoryRow[] {
  if (!Array.isArray(data)) return [];
  const out: HistoryRow[] = [];
  for (const r of data) {
    if (!isRecord(r)) continue;
    const id = asId(r["strain_id"]);
    const event = asText(r["event"]);
    const tx = asText(r["tx_hash"]);
    const time = asText(r["block_time"]);
    if (id === null || !event || !tx || !time) continue;
    out.push({ strain_id: id, event, role: asText(r["role"]), actor: asText(r["actor"]), data: isRecord(r["data"]) ? r["data"] : {}, tx_hash: tx, block_time: time });
  }
  return out;
}

export function normalizeGraves(data: unknown): GraveRow[] {
  if (!Array.isArray(data)) return [];
  const out: GraveRow[] = [];
  for (const r of data) {
    if (!isRecord(r)) continue;
    const id = asId(r["strain_id"]);
    const cause = CAUSES.find((x) => x === r["cause"]);
    const tx = asText(r["tx_hash"]);
    const time = asText(r["block_time"]);
    if (id === null || !cause || !tx || !time) continue;
    out.push({ strain_id: id, cause, by_account: asText(r["by_account"]), absorbed_into: asId(r["absorbed_into"]), owner_before: asText(r["owner_before"]), tx_hash: tx, block_time: time });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Queries. They throw with the database's message so a window can tell "could not read" from "nothing recorded".
// ---------------------------------------------------------------------------------------------

const LINEAGE_COLS = "child_id,parent_id,relation,generation,actor,tx_hash,block_time";
const HISTORY_COLS = "strain_id,event,role,actor,data,tx_hash,block_time";
const GRAVE_COLS = "strain_id,cause,by_account,absorbed_into,owner_before,tx_hash,block_time";

/** Every lineage row that touches `strainId`, plus (for a divided strain) its siblings, i.e. the other children of its parent. */
export async function lineageOf(c: SupabaseClient, strainId: number): Promise<{ rows: LineageRow[]; siblingRows: LineageRow[] }> {
  if (!Number.isSafeInteger(strainId) || strainId < 0) return { rows: [], siblingRows: [] };
  const { data, error } = await c
    .from("strain_lineage_snacc")
    .select(LINEAGE_COLS)
    .or(`child_id.eq.${strainId},parent_id.eq.${strainId}`)
    .order("block_time", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = normalizeLineage(data);
  const parent = rows.find((r) => r.relation === "divided" && r.child_id === strainId)?.parent_id;
  if (parent === undefined) return { rows, siblingRows: [] };
  const sib = await c
    .from("strain_lineage_snacc")
    .select(LINEAGE_COLS)
    .eq("parent_id", parent)
    .eq("relation", "divided")
    .order("block_time", { ascending: true })
    .limit(100);
  if (sib.error) throw new Error(sib.error.message);
  return { rows, siblingRows: normalizeLineage(sib.data) };
}

/** The latest `limit` events of a strain, newest first. */
export async function historyOf(c: SupabaseClient, strainId: number, limit = 20): Promise<HistoryRow[]> {
  if (!Number.isSafeInteger(strainId) || strainId < 0) return [];
  const { data, error } = await c
    .from("strain_history_snacc")
    .select(HISTORY_COLS)
    .eq("strain_id", strainId)
    .order("block_time", { ascending: false })
    .order("block_height", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return normalizeHistory(data);
}

/** The latest deaths, newest first. */
export async function graveyardRows(c: SupabaseClient, limit = 200): Promise<GraveRow[]> {
  const { data, error } = await c.from("graveyard_snacc").select(GRAVE_COLS).order("block_time", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return normalizeGraves(data);
}

// ---------------------------------------------------------------------------------------------
// Lineage
// ---------------------------------------------------------------------------------------------

export interface Lineage {
  parent: number | null;
  /** Generation of this strain when the index saw it born by division; null otherwise (the contract's `generation` is shown instead). */
  generation: number | null;
  children: number[];
  siblings: number[];
  /** Strains this one absorbed (splice or hostile takeover). */
  absorbed: Array<{ id: number; relation: "spliced_into" | "hostile" }>;
  /** The survivor this strain was absorbed into, when it was. */
  mergedInto: { id: number; relation: "spliced_into" | "hostile" } | null;
}

const uniq = (ids: number[]): number[] => [...new Set(ids)];

export function buildLineage(strainId: number, rows: readonly LineageRow[], siblingRows: readonly LineageRow[]): Lineage {
  const born = rows.find((r) => r.relation === "divided" && r.child_id === strainId) ?? null;
  const merged = rows.find((r) => r.relation !== "divided" && r.child_id === strainId) ?? null;
  return {
    parent: born ? born.parent_id : null,
    generation: born ? born.generation : null,
    children: uniq(rows.filter((r) => r.relation === "divided" && r.parent_id === strainId).map((r) => r.child_id)),
    siblings: uniq(siblingRows.filter((r) => r.relation === "divided" && born !== null && r.parent_id === born.parent_id && r.child_id !== strainId).map((r) => r.child_id)),
    absorbed: rows
      .filter((r): r is LineageRow & { relation: "spliced_into" | "hostile" } => r.relation !== "divided" && r.parent_id === strainId)
      .map((r) => ({ id: r.child_id, relation: r.relation })),
    mergedInto: merged && merged.relation !== "divided" ? { id: merged.parent_id, relation: merged.relation } : null,
  };
}

export const lineageIsEmpty = (l: Lineage): boolean => l.parent === null && l.children.length === 0 && l.absorbed.length === 0 && l.mergedInto === null;

export const RELATION_WORDS: Record<"spliced_into" | "hostile", string> = {
  spliced_into: "splice",
  hostile: "hostile takeover",
};

// ---------------------------------------------------------------------------------------------
// History lines in plain words
// ---------------------------------------------------------------------------------------------

/** Testnet $SNACC, 24 decimals, from an exact integer string (or small number). */
export function snacc(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? formatUnits(v, 24, 4) : "?";
}

/** Testnet NEAR (yocto, 24 decimals). */
export function near(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? formatUnits(v, 24, 4) : "?";
}

const num = (v: unknown): string => (typeof v === "number" || typeof v === "string" ? String(v) : "?");
const who = (v: unknown, fallback = "someone"): string => (typeof v === "string" && v !== "" ? v : fallback);
const tag = (v: unknown): string => (typeof v === "string" && v !== "" ? `#${v}` : typeof v === "number" ? `#${v}` : "#?");

const DELIST_REASONS: Record<string, string> = { seller: "by the seller", token_left_market: "the token left the market" };

/** One history row as a short sentence. `role` says which part this strain played in a two-strain event. */
export function describeHistory(row: HistoryRow): string {
  const d = row.data;
  switch (row.event) {
    case "strain_created":
      return `hatched by ${who(d["owner_id"], who(row.actor))} with ${snacc(d["initial_snacc_stake"])} $SNACC`;
    case "fed":
      return `fed (fee ${snacc(d["effective_fee"])} $SNACC)${d["dormant"] === true ? ", woke up from dormancy" : ""}`;
    case "extracted":
      return `produced ${num(d["amount"])} ${who(d["token"], "molecule")}`;
    case "transmuted":
      return `transmuted ${num(d["burned_spores"])} spores into ${num(d["minted"])} ${who(d["token_out"], "molecule")}`;
    case "synthesized":
      return `synthesized ${num(d["minted"])} ${who(d["token_out"], "molecule")}`;
    case "genome_committed":
      return "genome experiment committed";
    case "genome_mutated": {
      const bps = d["efficiency_shift_bps"];
      return typeof bps === "number" ? `genome mutated (efficiency ${bps >= 0 ? "+" : ""}${(bps / 100).toFixed(2)}%)` : "genome mutated";
    }
    case "atp_allocated":
      return `allocated ATP: mitochondria ${num(d["mitokondria"])}, nucleus ${num(d["nukleus"])}, lysosome ${num(d["lisosom"])}`;
    case "aether_burned_for_dividend":
      return `burned ${num(d["amount"])} aether into the industrial pool (epoch ${num(d["epoch"])})`;
    case "dividend_claimed":
      return `claimed ${snacc(d["payout"])} $SNACC from the industrial pool (epoch ${num(d["epoch"])})`;
    case "npc_spores_bought":
      return `bought ${num(d["amount"])} spores from ${who(d["npc_id"], "an NPC")}`;
    case "strain_divided":
      return row.role === "child"
        ? `born by division of ${tag(d["parent_id"])} (generation ${num(d["child_generation"])})`
        : `divided: child ${tag(d["child_id"])} born (generation ${num(d["child_generation"])})`;
    case "strains_spliced":
      return row.role === "absorbed" ? `spliced into ${tag(d["dominant_id"])} and burned` : `spliced: absorbed ${tag(d["absorbed_id"])}`;
    case "hostile_takeover_spliced":
      return row.role === "target"
        ? `taken over by ${tag(d["raider_id"])} in a hostile takeover`
        : `hostile takeover: absorbed ${tag(d["target_id"])} (paid ${snacc(d["payment"])} $SNACC)`;
    case "strain_adopted":
      return row.role === "payer" ? `paid ${snacc(d["book_value"])} $SNACC to adopt ${tag(d["target_id"])}` : `adopted by ${who(d["adopter"])}`;
    case "strain_liquidated":
      return `starved and was harvested by ${who(d["liquidator"])}`;
    case "trait_conjugated":
      return row.role === "source"
        ? `shared trait “${who(d["phenotype_trait"], "?")}” with ${tag(d["to_strain_id"])}`
        : `received trait “${who(d["phenotype_trait"], "?")}” from ${tag(d["from_strain_id"])}`;
    case "nft_transfer":
      return `transferred from ${who(d["old_owner_id"])} to ${who(d["new_owner_id"])}`;
    case "listed":
      return `listed on the market for ${near(d["price"])} testnet NEAR`;
    case "sold":
      return `sold to ${who(d["buyer_id"])} for ${near(d["price"])} testnet NEAR`;
    case "delisted":
      return `taken off the market (${DELIST_REASONS[String(d["reason"])] ?? "delisted"})`;
    case "price_updated":
      return `market price changed to ${near(d["new_price"])} testnet NEAR (was ${near(d["old_price"])})`;
    default:
      return row.event.replace(/_/g, " ");
  }
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function relativeTime(iso: string, nowMs: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const s = Math.floor((nowMs - t) / 1000);
  if (s < 45) return "just now";
  if (s < 90) return "1 min ago";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(t).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------------------------
// Graveyard
// ---------------------------------------------------------------------------------------------

export type GraveFilter = "all" | "harvested" | "spliced" | "mine";
export const GRAVE_FILTERS: readonly { id: GraveFilter; label: string }[] = [
  { id: "all", label: "all" },
  { id: "harvested", label: "harvested" },
  { id: "spliced", label: "spliced" },
  { id: "mine", label: "mine" },
];

/** What happened, in plain words. */
export function causeWords(row: GraveRow): string {
  const by = who(row.by_account);
  switch (row.cause) {
    case "harvested_starving":
      return `starved to zero vitality and was harvested by ${by}`;
    case "spliced_burned":
      return row.absorbed_into !== null ? `spliced into #${row.absorbed_into} by ${by}` : `spliced away by ${by}`;
    case "hostile_takeover":
      return row.absorbed_into !== null ? `absorbed by #${row.absorbed_into} in a hostile takeover by ${by}` : `absorbed in a hostile takeover by ${by}`;
  }
}

/**
 * harvested = starved; spliced = absorbed by a splice or a hostile takeover; mine = Snaccs the given account owned when
 * they died (without an account, nothing matches).
 */
export function filterGraves(rows: readonly GraveRow[], filter: GraveFilter, account: string | null): GraveRow[] {
  switch (filter) {
    case "all":
      return [...rows];
    case "harvested":
      return rows.filter((r) => r.cause === "harvested_starving");
    case "spliced":
      return rows.filter((r) => r.cause === "spliced_burned" || r.cause === "hostile_takeover");
    case "mine":
      return account ? rows.filter((r) => r.owner_before === account) : [];
  }
}

export function countGraves(rows: readonly GraveRow[], account: string | null): Record<GraveFilter, number> {
  return {
    all: rows.length,
    harvested: filterGraves(rows, "harvested", account).length,
    spliced: filterGraves(rows, "spliced", account).length,
    mine: filterGraves(rows, "mine", account).length,
  };
}
