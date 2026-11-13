import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DISTRESS_MAX_EFFECTIVE_VITALITY,
  PAGE_SIZE,
  buildItems,
  countByFilter,
  fetchCollection,
  filterItems,
  healthOf,
  hungerMessage,
  hungerSummary,
  isValidAccountId,
  normalizeAccount,
  parseOwnedToken,
  parseVessel,
  sortItems,
  type CollectionItem,
} from "../src/data/collection.ts";
import type { StrainDetail } from "../src/data/types.ts";
import { MyCollection } from "../src/hud/MyCollection.tsx";
import { StrainDetailModal } from "../src/hud/StrainDetailModal.tsx";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320"/></svg>`;
const MEDIA = `data:image/svg+xml;base64,${Buffer.from(SVG).toString("base64")}`;

function vesselRaw(id: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    strain_id: id,
    owner_id: "alice.testnet",
    vault_subaccount: `s-${id}-1.snacc-v001.testnet`,
    vitality: 8500,
    efficiency_bps: 10000,
    bmr_per_hour: 100,
    last_fed_sec: 1794227318,
    role_mask: 1,
    state_nonce: 0,
    pending_callbacks: 0,
    atp_balance: 50,
    pending_commitment: null,
    phenotype_trait: null,
    generation: 0,
    organel: { mitokondria: 0, nukleus: 0, lisosom: 0 },
    last_allocate_epoch: "18446744073709551615",
    status: "Active",
    effective_vitality: 6000,
    ...over,
  };
}

const tokenRaw = (id: number, media: string = MEDIA) => ({
  token_id: String(id),
  owner_id: "alice.testnet",
  metadata: { title: `Snacc Strain #${id}`, description: "Living balance-sheet organism (role 1, gen 0)", media },
});

function item(id: number, status: string, effective: number, generation = 0): CollectionItem {
  const detail = parseVessel(vesselRaw(id, { status, effective_vitality: effective, generation })) as StrainDetail;
  return buildItems([{ strainId: id, mediaSrc: MEDIA }], new Map([[id, detail]])).items[0];
}

describe("UI-147: health from the contract status and effective vitality", () => {
  it("uses the contract's tiers: 0 is starving, 1..2000 distressed, above healthy", () => {
    expect(DISTRESS_MAX_EFFECTIVE_VITALITY).toBe(2000);
    expect(healthOf("Active", 0)).toBe("starving");
    expect(healthOf("Active", 1)).toBe("distressed");
    expect(healthOf("Active", 2000)).toBe("distressed");
    expect(healthOf("Active", 2001)).toBe("healthy");
    expect(healthOf("Distressed", 1500)).toBe("distressed");
    expect(healthOf("Liquidated", 0)).toBe("dead");
    expect(healthOf("SplicedBurned", 0)).toBe("dead");
  });
});

describe("UI-147: parsing view results", () => {
  it("reads a StrainVesselView and keeps the contract status verbatim", () => {
    const v = parseVessel(vesselRaw(8, { atp_balance: "340282366920938463463374607431768211455" }));
    expect(v).toMatchObject({ strain_id: 8, status: "Active", effective_vitality: 6000, generation: 0, atp_balance: "340282366920938463463374607431768211455" });
  });

  it("rejects a vessel with a missing or mistyped field instead of filling a number in", () => {
    expect(parseVessel(null)).toBeNull();
    expect(parseVessel(vesselRaw(1, { effective_vitality: undefined }))).toBeNull();
    expect(parseVessel(vesselRaw(1, { vitality: "8500" }))).toBeNull();
    expect(parseVessel(vesselRaw(1, { organel: null }))).toBeNull();
  });

  it("reads an NftTokenView and only trusts valid on-chain svg media", () => {
    expect(parseOwnedToken(tokenRaw(5))).toEqual({ strainId: 5, mediaSrc: MEDIA });
    expect(parseOwnedToken(tokenRaw(5, "https://evil.example/x.svg"))?.mediaSrc).toBeNull();
    expect(parseOwnedToken({ token_id: "abc", metadata: {} })).toBeNull();
    expect(parseOwnedToken({ token_id: "0" })).toBeNull();
  });

  it("reports owned tokens without a vessel as unresolved", () => {
    const v = parseVessel(vesselRaw(2)) as StrainDetail;
    const { items, unresolved } = buildItems(
      [
        { strainId: 2, mediaSrc: null },
        { strainId: 3, mediaSrc: null },
      ],
      new Map([[2, v]]),
    );
    expect(items.map((i) => i.strainId)).toEqual([2]);
    expect(unresolved).toEqual([3]);
  });
});

describe("UI-147: account ids", () => {
  it("normalizes and validates", () => {
    expect(normalizeAccount("  Alice.TestNet ")).toBe("alice.testnet");
    expect(normalizeAccount("   ")).toBeNull();
    expect(normalizeAccount(null)).toBeNull();
    expect(isValidAccountId("alice.testnet")).toBe(true);
    expect(isValidAccountId("snacc-v001.testnet")).toBe(true);
    expect(isValidAccountId("a")).toBe(false);
    expect(isValidAccountId("bad account")).toBe(false);
    expect(isValidAccountId("a..b")).toBe(false);
    expect(isValidAccountId("-a.testnet")).toBe(false);
    expect(isValidAccountId("a".repeat(65))).toBe(false);
  });
});

describe("UI-147: filter, sort and hunger", () => {
  const all = [
    item(1, "SplicedBurned", 0),
    item(2, "Active", 9000, 2),
    item(3, "Active", 0, 1),
    item(4, "Distressed", 1200, 3),
    item(5, "Liquidated", 0),
    item(6, "Active", 4000),
  ];

  it("filters all / alive / hungry / dead", () => {
    expect(filterItems(all, "all")).toHaveLength(6);
    expect(filterItems(all, "alive").map((i) => i.strainId)).toEqual([2, 3, 4, 6]);
    expect(filterItems(all, "hungry").map((i) => i.strainId)).toEqual([3, 4]);
    expect(filterItems(all, "dead").map((i) => i.strainId)).toEqual([1, 5]);
    expect(countByFilter(all)).toEqual({ all: 6, alive: 4, hungry: 2, dead: 2 });
  });

  it("sorts the hungriest living strain first and dead ones last", () => {
    expect(sortItems(all, "vitality-asc").map((i) => i.strainId)).toEqual([3, 4, 6, 2, 1, 5]);
    expect(sortItems(all, "vitality-desc").map((i) => i.strainId)).toEqual([2, 6, 4, 3, 1, 5]);
    expect(sortItems(all, "id-asc").map((i) => i.strainId)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sortItems(all, "generation-desc").map((i) => i.strainId)).toEqual([4, 2, 3, 1, 5, 6]);
  });

  it("does not mutate its input", () => {
    const copy = [...all];
    sortItems(all, "vitality-asc");
    filterItems(all, "alive");
    expect(all).toEqual(copy);
  });

  it("counts hungry strains and words the warning", () => {
    expect(hungerSummary(all)).toEqual({ starving: 1, distressed: 1 });
    expect(hungerMessage({ starving: 2, distressed: 0 })).toBe("2 of your Snaccs are starving — feed them or they can be snacked");
    expect(hungerMessage({ starving: 1, distressed: 0 })).toBe("1 of your Snaccs is starving — feed it or it can be snacked");
    expect(hungerMessage({ starving: 0, distressed: 3 })).toBe("3 of your Snaccs are distressed — feed them or they can be snacked");
    expect(hungerMessage({ starving: 1, distressed: 1 })).toBe("2 of your Snaccs are at risk (1 starving, 1 distressed) — feed them or they can be snacked");
    expect(hungerMessage({ starving: 0, distressed: 0 })).toBeNull();
    expect(hungerMessage(hungerSummary([item(1, "Liquidated", 0), item(2, "Active", 9000)]))).toBeNull();
  });
});

describe("UI-147: reading the collection through injected views", () => {
  type Call = { method: string; args: Record<string, unknown> };

  function makeView(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
    const calls: Call[] = [];
    const view = async <T,>(method: string, args: unknown): Promise<T | null> => {
      calls.push({ method, args: args as Record<string, unknown> });
      const h = handlers[method];
      return h ? (h(args as Record<string, unknown>) as T | null) : null;
    };
    return { view, calls };
  }

  it("takes living vessels from get_colony and looks up the rest with get_strain", async () => {
    const { view, calls } = makeView({
      nft_tokens_for_owner: () => [tokenRaw(1), tokenRaw(5), tokenRaw(9)],
      get_colony: () => [vesselRaw(5, { effective_vitality: 0 })],
      get_strain: (a) => vesselRaw(a.strain_id as number, { status: a.strain_id === 1 ? "SplicedBurned" : "Liquidated", effective_vitality: 0 }),
    });
    const res = await fetchCollection("alice.testnet", undefined, view);
    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;
    expect(res.data.items.map((i) => [i.strainId, i.status, i.health])).toEqual([
      [1, "SplicedBurned", "dead"],
      [5, "Active", "starving"],
      [9, "Liquidated", "dead"],
    ]);
    expect(res.data.unresolved).toEqual([]);
    expect(calls.filter((c) => c.method === "get_strain").map((c) => c.args.strain_id).sort()).toEqual([1, 9]);
    expect(calls[0]).toEqual({ method: "nft_tokens_for_owner", args: { account_id: "alice.testnet", from_index: "0", limit: PAGE_SIZE } });
  });

  it("pages nft_tokens_for_owner until a short page", async () => {
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) => tokenRaw(i + 1));
    const page2 = [tokenRaw(PAGE_SIZE + 1)];
    const { view, calls } = makeView({
      nft_tokens_for_owner: (a) => (a.from_index === "0" ? page1 : page2),
      get_colony: () => Array.from({ length: PAGE_SIZE + 1 }, (_, i) => vesselRaw(i + 1)),
    });
    const res = await fetchCollection("alice.testnet", undefined, view);
    expect(res.kind === "ok" && res.data.items).toHaveLength(PAGE_SIZE + 1);
    expect(calls.filter((c) => c.method === "nft_tokens_for_owner").map((c) => c.args.from_index)).toEqual(["0", String(PAGE_SIZE)]);
  });

  it("returns an empty collection without asking get_colony", async () => {
    const { view, calls } = makeView({ nft_tokens_for_owner: () => [] });
    const res = await fetchCollection("nobody.testnet", undefined, view);
    expect(res).toEqual({ kind: "ok", data: { items: [], unresolved: [], truncated: false } });
    expect(calls.map((c) => c.method)).toEqual(["nft_tokens_for_owner"]);
  });

  it("is an honest error when the RPC does not answer", async () => {
    const { view } = makeView({});
    const res = await fetchCollection("alice.testnet", undefined, view);
    expect(res.kind).toBe("error");
    if (res.kind === "error") expect(res.message).toMatch(/did not answer/);
    const noColony = makeView({ nft_tokens_for_owner: () => [tokenRaw(1)] });
    expect((await fetchCollection("alice.testnet", undefined, noColony.view)).kind).toBe("error");
  });

  it("lists a strain whose get_strain failed as unresolved, not with made-up numbers", async () => {
    const { view } = makeView({ nft_tokens_for_owner: () => [tokenRaw(1), tokenRaw(2)], get_colony: () => [vesselRaw(2)] });
    const res = await fetchCollection("alice.testnet", undefined, view);
    expect(res.kind === "ok" && res.data.items.map((i) => i.strainId)).toEqual([2]);
    expect(res.kind === "ok" && res.data.unresolved).toEqual([1]);
  });
});

describe("UI-147: the window states", () => {
  const html = (accountId: string | null, mode?: "demo" | "live") =>
    renderToStaticMarkup(<MyCollection accountId={accountId} skin="biolab" mode={mode} onClose={() => {}} />);

  it("asks for a wallet or an account when there is none", () => {
    const h = html(null);
    expect(h).toContain('data-testid="collection-modal"');
    expect(h).toContain("Connect a wallet or type an account to see its collection.");
    expect(h).not.toContain("refresh");
  });

  it("rejects an invalid account id without a request", () => {
    expect(html("Bad Account!")).toContain("is not a valid NEAR account id");
  });

  it("shows loading for a valid account and names the views it reads", () => {
    const h = html("alice.testnet");
    expect(h).toContain("reading nft_tokens_for_owner, get_colony and get_strain for alice.testnet");
    expect(h).toContain("live · testnet");
  });

  it("says in demo mode that the list is not simulated", () => {
    expect(html("alice.testnet", "demo")).toContain("this list is not");
    expect(html("alice.testnet", "live")).not.toContain("collection-demo-note");
  });
});

describe("UI-147: Strain Detail from the collection", () => {
  it("names the real source of the on-chain svg", () => {
    const detail = parseVessel(vesselRaw(5)) as StrainDetail;
    const h = renderToStaticMarkup(
      <StrainDetailModal strain={detail} svgDataUri={MEDIA} svgStatus="ready" svgSource="from nft_tokens_for_owner on snacc-v001.testnet" skin="biolab" mode="live" onClose={() => {}} />,
    );
    expect(h).toContain("from nft_tokens_for_owner on snacc-v001.testnet");
    expect(h).not.toContain("/api/strains/{id}/svg");
  });

  it("leads with the effective vitality and flags a starving strain", () => {
    const starving = parseVessel(vesselRaw(5, { vitality: 3792, effective_vitality: 0 })) as StrainDetail;
    const h = renderToStaticMarkup(<StrainDetailModal strain={starving} svgDataUri={null} svgStatus="no-data" skin="biolab" mode="live" onClose={() => {}} />);
    expect(h).toContain('aria-valuenow="0"');
    expect(h).toContain("stored vitality (before bmr decay)");
    expect(h).toContain("3,792");
    expect(h).toContain("Active");
    expect(h).toContain("starving (effective vitality 0)");
    const healthy = parseVessel(vesselRaw(6, { vitality: 7200, effective_vitality: 7100 })) as StrainDetail;
    const h2 = renderToStaticMarkup(<StrainDetailModal strain={healthy} skin="biolab" mode="live" onClose={() => {}} />);
    expect(h2).toContain('aria-valuenow="7100"');
    expect(h2).not.toContain("starving");
    const dead = parseVessel(vesselRaw(7, { status: "Liquidated", effective_vitality: 0 })) as StrainDetail;
    expect(renderToStaticMarkup(<StrainDetailModal strain={dead} skin="biolab" mode="live" onClose={() => {}} />)).not.toContain("starving");
  });
});
