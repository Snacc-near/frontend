/**
 * UI-150 (every game action): builders mirror `contracts/snacc/src/lib.rs` (method names, argument
 * names and types, attached deposit, gas); the UI guards match the contract's asserts; contract
 * panics map to plain English per method; the windows render their disconnected state. Runs in node.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GAS,
  allocationCost,
  bookValue,
  buildAdopt,
  buildAllocateAtp,
  buildClaimDividend,
  buildDivide,
  buildExtract,
  buildFtTransfer,
  buildHarvest,
  buildHostileTakeover,
  buildNftTransfer,
  buildNpcBuy,
  buildRedeemAether,
  buildSplice,
  buildSynthesize,
  buildTransmute,
  checkAllocation,
  checkDivide,
  checkTestnetAccount,
  claimableEpochs,
  formatCountdown,
  harvestSplit,
  hostilePrice,
  rolesOf,
  synthesizePreview,
  transmuteDeposit,
  transmuteDietBps,
  transmutePreview,
} from "../src/chain/actions.ts";
import { humanizeTxError, readOutcome } from "../src/chain/txResult.ts";
import { estimatePayout, fetchHungryStrains, fetchInventory, fetchRegistered, hungerKind, parseMacro } from "../src/chain/gameViews.ts";
import { EMPTY_ACCOUNT_INFO, type AccountInfo } from "../src/chain/useAccountInfo.ts";
import { DISCONNECTED_WALLET } from "../src/chain/wallet.tsx";
import { parseVessel } from "../src/data/collection.ts";
import GameActionWindow, { GAME_ACTIONS, type GameActionKey } from "../src/hud/GameActions.tsx";

const TGAS = (n: number) => (BigInt(n) * 10n ** 12n).toString();
const MILLI = "1000000000000000000000"; // 0.001 NEAR

describe("UI-150 builders: method, args, deposit, gas", () => {
  it("allocate_atp sends the contract's own slot names as u8 and no deposit", () => {
    expect(buildAllocateAtp({ strainId: 3, mitokondria: 2, nukleus: 1, lisosom: 0 })).toEqual({
      methodName: "allocate_atp",
      args: { strain_id: 3, mitokondria: 2, nukleus: 1, lisosom: 0 },
      gas: TGAS(50),
      deposit: "0",
    });
    expect(() => buildAllocateAtp({ strainId: 3, mitokondria: 6, nukleus: 0, lisosom: 0 })).toThrow();
    expect(() => buildAllocateAtp({ strainId: -1, mitokondria: 0, nukleus: 0, lisosom: 0 })).toThrow();
  });

  it("divide_strain / harvest_starving_strain / splice_strains take ids only", () => {
    expect(buildDivide({ strainId: 4 })).toEqual({ methodName: "divide_strain", args: { strain_id: 4 }, gas: TGAS(100), deposit: "0" });
    expect(buildHarvest({ targetId: 9 })).toEqual({ methodName: "harvest_starving_strain", args: { target_id: 9 }, gas: TGAS(100), deposit: "0" });
    expect(buildSplice({ dominantId: 1, absorbedId: 2 })).toEqual({ methodName: "splice_strains", args: { dominant_id: 1, absorbed_id: 2 }, gas: TGAS(150), deposit: "0" });
    expect(() => buildSplice({ dominantId: 1, absorbedId: 1 })).toThrow();
  });

  it("extract_spores attaches exactly the catalyst fee", () => {
    const c = buildExtract({ strainId: 1, sporeType: "mt:spore-lumin", feeYocto: MILLI });
    expect(c).toEqual({
      methodName: "extract_spores",
      args: { strain_id: 1, spore_type: "mt:spore-lumin", snacc_catalyst_fee: MILLI },
      gas: TGAS(100),
      deposit: MILLI,
    });
    expect(buildExtract({ strainId: 1, sporeType: "mt:spore-ignis", feeYocto: "0" }).deposit).toBe("0");
    expect(() => buildExtract({ strainId: 1, sporeType: "mt:spore-x" as never, feeYocto: "1" })).toThrow();
  });

  it("transmute_spores_to_enzyme attaches the fee after the diet discount and needs an even burn", () => {
    const c = buildTransmute({ strainId: 2, sporesToBurn: 4, feeYocto: "10000000000000", dietBps: 2000 });
    expect(c.methodName).toBe("transmute_spores_to_enzyme");
    expect(c.args).toEqual({ strain_id: 2, spores_to_burn: 4, snacc_catalyst_fee: "10000000000000" });
    expect(c.deposit).toBe("8000000000000");
    expect(buildTransmute({ strainId: 2, sporesToBurn: 2, feeYocto: MILLI }).deposit).toBe(MILLI);
    expect(() => buildTransmute({ strainId: 2, sporesToBurn: 3, feeYocto: MILLI })).toThrow();
    expect(transmuteDeposit("10", 2000)).toBe("8");
  });

  it("synthesize_elixir needs whole batches and attaches the fee", () => {
    const c = buildSynthesize({ strainId: 5, elixirType: "mt:elixir-homeostasis", enzymesToBurn: 4, feeYocto: MILLI });
    expect(c).toEqual({
      methodName: "synthesize_elixir",
      args: { strain_id: 5, elixir_type: "mt:elixir-homeostasis", enzymes_to_burn: 4, snacc_catalyst_fee: MILLI },
      gas: TGAS(100),
      deposit: MILLI,
    });
    expect(() => buildSynthesize({ strainId: 5, elixirType: "mt:elixir-homunculus", enzymesToBurn: 4, feeYocto: MILLI })).toThrow();
  });

  it("npc_buy_spores is paid from the strain, no deposit", () => {
    expect(buildNpcBuy({ strainId: 1, npcId: "npc-extractor", buyAmount: 3 })).toEqual({
      methodName: "npc_buy_spores",
      args: { strain_id: 1, npc_id: "npc-extractor", buy_amount: 3 },
      gas: TGAS(50),
      deposit: "0",
    });
    expect(() => buildNpcBuy({ strainId: 1, npcId: "npc-extractor", buyAmount: 0 })).toThrow();
  });

  it("adopt and hostile_takeover_splice send the target nonce as a u64 number", () => {
    expect(buildAdopt({ targetId: 7, raiderStrainId: 2, expectedTargetNonce: 41 })).toEqual({
      methodName: "adopt",
      args: { target_id: 7, raider_strain_id: 2, expected_target_nonce: 41 },
      gas: TGAS(150),
      deposit: "0",
    });
    expect(buildHostileTakeover({ raiderStrainId: 2, distressedTargetId: 7, expectedTargetNonce: 41 })).toEqual({
      methodName: "hostile_takeover_splice",
      args: { raider_strain_id: 2, distressed_target_id: 7, expected_target_nonce: 41 },
      gas: TGAS(150),
      deposit: "0",
    });
    expect(() => buildAdopt({ targetId: 2, raiderStrainId: 2, expectedTargetNonce: 0 })).toThrow();
  });

  it("claim_industrial_dividend and synthesize_and_redeem_aether attach nothing; amount is a U128 string", () => {
    expect(buildClaimDividend({ strainId: 3, epoch: 12 })).toEqual({
      methodName: "claim_industrial_dividend",
      args: { strain_id: 3, epoch: 12 },
      gas: TGAS(50),
      deposit: "0",
    });
    expect(buildRedeemAether({ strainId: 3, amount: "2" })).toEqual({
      methodName: "synthesize_and_redeem_aether",
      args: { strain_id: 3, amount: "2" },
      gas: TGAS(50),
      deposit: "0",
    });
    expect(() => buildRedeemAether({ strainId: 3, amount: "0" })).toThrow();
  });

  it("nft_transfer and ft_transfer attach exactly 1 yoctoNEAR; token_id is a string", () => {
    expect(buildNftTransfer({ receiverId: "friend.testnet", strainId: 12 })).toEqual({
      methodName: "nft_transfer",
      args: { receiver_id: "friend.testnet", token_id: "12" },
      gas: TGAS(50),
      deposit: "1",
    });
    expect(buildFtTransfer({ receiverId: "friend.testnet", amountYocto: "100000000000000000000000" })).toEqual({
      methodName: "ft_transfer",
      args: { receiver_id: "friend.testnet", amount: "100000000000000000000000" },
      gas: TGAS(30),
      deposit: "1",
    });
    expect(() => buildFtTransfer({ receiverId: "friend.testnet", amountYocto: "0" })).toThrow();
  });

  it("every prepaid gas fits the 300 TGas transaction limit", () => {
    for (const g of Object.values(GAS)) expect(BigInt(g) <= 300n * 10n ** 12n).toBe(true);
  });
});

describe("UI-150 guards mirror the contract asserts", () => {
  const base = { status: "Active", atp: 5n, current: { mitokondria: 1, nukleus: 0, lisosom: 0 }, lastAllocateEpoch: 3, currentEpoch: 4 };

  it("allocate: 1 ATP per level increase, lowering is free, once per epoch, max level 5", () => {
    expect(allocationCost({ mitokondria: 1, nukleus: 0, lisosom: 2 }, { mitokondria: 0, nukleus: 2, lisosom: 3 })).toBe(3);
    expect(checkAllocation({ ...base, target: { mitokondria: 3, nukleus: 1, lisosom: 0 } })).toEqual({ ok: true, cost: 3 });
    expect(checkAllocation({ ...base, target: { mitokondria: 5, nukleus: 5, lisosom: 0 } }).ok).toBe(false);
    expect(checkAllocation({ ...base, lastAllocateEpoch: 4, target: { mitokondria: 2, nukleus: 0, lisosom: 0 } })).toMatchObject({ ok: false });
    expect(checkAllocation({ ...base, target: { mitokondria: 6, nukleus: 0, lisosom: 0 } }).ok).toBe(false);
    expect(checkAllocation({ ...base, target: base.current }).ok).toBe(false);
    expect(checkAllocation({ ...base, status: "Liquidated", target: { mitokondria: 0, nukleus: 0, lisosom: 0 } }).ok).toBe(false);
    expect(checkAllocation({ ...base, currentEpoch: null, target: { mitokondria: 2, nukleus: 0, lisosom: 0 } }).ok).toBe(false);
  });

  it("divide: 3 ATP, colony below 5, child generation at most 8, birth budget", () => {
    const ok = { status: "Active", effectiveVitality: 5000, atp: 3n, generation: 2, colonySize: 4, birthBudget: 1 };
    expect(checkDivide(ok)).toEqual({ ok: true });
    expect(checkDivide({ ...ok, atp: 2n }).ok).toBe(false);
    expect(checkDivide({ ...ok, colonySize: 5 }).ok).toBe(false);
    expect(checkDivide({ ...ok, generation: 8 }).ok).toBe(false);
    expect(checkDivide({ ...ok, generation: 7 }).ok).toBe(true);
    expect(checkDivide({ ...ok, effectiveVitality: 0 }).ok).toBe(false);
    expect(checkDivide({ ...ok, birthBudget: 0 }).ok).toBe(false);
  });

  it("diet discount: Fever + Extractor bit or Hypothermia + Synthesizer bit only", () => {
    const zone = { feverMk: 610, hypothermiaMk: 600 };
    expect(transmuteDietBps({ roleMask: 0b010, tempMk: 900, ...zone })).toBe(0);
    expect(transmuteDietBps({ roleMask: 0b011, tempMk: 900, ...zone })).toBe(2000);
    expect(transmuteDietBps({ roleMask: 0b110, tempMk: 100, ...zone })).toBe(2000);
    expect(transmuteDietBps({ roleMask: 0b111, tempMk: 605, ...zone })).toBe(0);
    expect(rolesOf(0b101)).toEqual(["Extractor", "Synthesizer"]);
  });

  it("transmute recipe priority amalgam → redactase → synthase with nucleus bonus", () => {
    expect(transmutePreview({ "mt:spore-ignis": 2n }, 2, 10000, 0)).toEqual({ enzyme: "mt:enzyme-amalgam", burns: [["mt:spore-ignis", 2]], minted: 2n });
    expect(transmutePreview({ "mt:spore-ignis": 1n, "mt:spore-lumin": 1n }, 2, 10000, 1)?.enzyme).toBe("mt:enzyme-redactase");
    expect(transmutePreview({ "mt:spore-cryo": 4n }, 4, 10000, 5)).toMatchObject({ enzyme: "mt:enzyme-synthase", minted: 6n });
    expect(transmutePreview({ "mt:spore-cryo": 1n }, 2, 10000, 0)).toBeNull();
    expect(synthesizePreview("mt:elixir-homunculus", 6, 0)).toMatchObject({ batches: 2n, minted: 2n });
    expect(synthesizePreview("mt:elixir-homunculus", 4, 0)).toBeNull();
  });

  it("book value, hostile price split and harvest split use the contract's bps", () => {
    expect(bookValue(1000n, { "mt:spore-ignis": 3n, "mt:elixir-aether": 2n })).toBe(1005n);
    expect(hostilePrice(10000n)).toEqual({ payment: 11500n, seller: 10925n, treasury: 575n });
    expect(harvestSplit(1000n)).toEqual({ bounty: 100n, treasury: 900n });
  });

  it("claim window: closed epochs within the last 8", () => {
    expect(claimableEpochs(10, 10)).toEqual([9, 8, 7, 6, 5, 4, 3, 2]);
    expect(claimableEpochs(0, 0)).toEqual([]);
    expect(estimatePayout({ epoch: 1, contribution: 2n, claimed: false, rate: 5n * 10n ** 18n }, 7n)).toBe(7n);
  });

  it("validates testnet receivers", () => {
    expect(checkTestnetAccount(" Friend.testnet ", null)).toEqual({ ok: true, id: "friend.testnet" });
    expect(checkTestnetAccount("a".repeat(64).replace(/a/g, "f"), null).ok).toBe(true);
    expect(checkTestnetAccount("friend.near", null).ok).toBe(false);
    expect(checkTestnetAccount("bad..testnet", null).ok).toBe(false);
    expect(checkTestnetAccount("me.testnet", "me.testnet").ok).toBe(false);
    expect(checkTestnetAccount("", null).ok).toBe(false);
  });

  it("formats the epoch countdown", () => {
    expect(formatCountdown(0)).toBe("now");
    expect(formatCountdown(3 * 3600 + 12 * 60)).toBe("3h 12m");
    expect(formatCountdown(90000)).toBe("1d 1h");
  });
});

describe("UI-150 error mapping", () => {
  const panic = (code: string) => `Smart contract panicked: ${code}`;
  it("maps the new codes to plain English", () => {
    expect(humanizeTxError(panic("ERR_ALREADY_ALLOCATED")).message).toMatch(/already allocated/);
    expect(humanizeTxError(panic("ERR_NOT_ENOUGH_ATP")).message).toMatch(/ATP/);
    expect(humanizeTxError(panic("ERR_COLONY_FULL")).message).toBe("Your colony is full.");
    expect(humanizeTxError(panic("ERR_STATE_NONCE_CHANGED_SELLER_DRAIN_BLOCKED")).message).toMatch(/changed since/);
    expect(humanizeTxError(panic("ERR_DIVIDEND_POOL_EMPTY")).message).toMatch(/Nothing to pay/);
    expect(humanizeTxError(panic("ERR_ROLE_NOT_ALLOWED")).message).toMatch(/role/);
    expect(humanizeTxError(panic("ERR_NPC_OUT_OF_STOCK")).message).toMatch(/spores left/);
  });

  it("uses the method for codes that mean different things per call", () => {
    expect(humanizeTxError(panic("ERR_STAKE_DEPOSIT_MISMATCH"), "extract_spores").message).toMatch(/catalyst fee/);
    expect(humanizeTxError(panic("ERR_STAKE_DEPOSIT_MISMATCH"), "transmute_spores_to_enzyme").message).toMatch(/diet discount/);
    expect(humanizeTxError(panic("ERR_ACCOUNT_NOT_REGISTERED"), "ft_transfer").message).toMatch(/receiver is not registered/);
    expect(humanizeTxError(panic("ERR_NOT_OWNED_BY_CALLEE"), "divide_strain").message).toMatch(/divide/);
    // feed keeps its UI-146 wording without a method and with feed_strain
    expect(humanizeTxError(panic("ERR_NOT_OWNED_BY_CALLEE")).message).toBe("You can only feed a Snacc you own.");
    expect(humanizeTxError(panic("ERR_NOT_OWNED_BY_CALLEE"), "feed_strain").message).toBe("You can only feed a Snacc you own.");
    const r = readOutcome({ transaction: { hash: "T" }, status: { Failure: panic("ERR_SAME_STRAIN") } }, "nft_transfer");
    expect(r.ok === false && r.message).toBe("You cannot send a Snacc to yourself.");
  });
});

describe("UI-150 views", () => {
  const view = (answers: Record<string, unknown>) =>
    (async (method: string, args: unknown) => {
      const key = `${method}:${JSON.stringify(args)}`;
      return (key in answers ? answers[key] : answers[method] ?? null) as never;
    }) as <T>(m: string, a: unknown) => Promise<T | null>;

  it("reads the macro state fields the windows use", () => {
    const m = parseMacro({
      current_epoch: 4,
      epoch_ends_sec: 1000,
      last_closed_epoch: 4,
      crucible_temp: 650,
      params: { fever_threshold_mk: 610, hypothermia_threshold_mk: 600 },
      total_mergers: 2,
      total_lyses: 1,
      total_divides: 2,
      industrial_dividend_pool: "12345678901234567890",
      epoch_dividend_inflow: 0,
      epoch_aether_burned_total: 0,
    });
    expect(m).toMatchObject({ currentEpoch: 4, birthBudget: 1, feverMk: 610, dividendPool: 12345678901234567890n });
    expect(parseMacro({})).toBeNull();
  });

  it("reads all nine molecules or nothing", async () => {
    const inv = await fetchInventory(1, undefined, view({ get_inventory: "2" }));
    expect(Object.keys(inv ?? {})).toHaveLength(9);
    expect(inv?.["mt:spore-ignis"]).toBe(2n);
    expect(await fetchInventory(1, undefined, view({}))).toBeNull();
  });

  it("tells an unregistered receiver from a failed read", async () => {
    expect(await fetchRegistered("a.testnet", undefined, view({ storage_balance_of: { total: "5" }, ft_balance_of: "0" }))).toBe(true);
    expect(await fetchRegistered("a.testnet", undefined, view({ ft_balance_of: "0" }))).toBe(false);
    expect(await fetchRegistered("a.testnet", undefined, view({}))).toBeNull();
  });

  it("lists other owners' distressed and starving strains, hungriest first", async () => {
    const vessel = (id: number, owner: string, eff: number, status = "Active") => ({
      strain_id: id,
      owner_id: owner,
      vault_subaccount: `s-${id}`,
      vitality: eff,
      effective_vitality: eff,
      efficiency_bps: 10000,
      bmr_per_hour: 100,
      last_fed_sec: 0,
      role_mask: 1,
      state_nonce: id,
      pending_callbacks: 0,
      atp_balance: 3,
      generation: 0,
      organel: { mitokondria: 0, nukleus: 0, lisosom: 0 },
      status,
    });
    const answers: Record<string, unknown> = { nft_total_supply: "5" };
    const strains = [vessel(1, "me.testnet", 0), vessel(2, "bob.testnet", 1500, "Distressed"), vessel(3, "bob.testnet", 0), vessel(4, "eve.testnet", 9000), vessel(5, "eve.testnet", 0, "Liquidated")];
    for (const s of strains) answers[`get_strain:${JSON.stringify({ strain_id: s.strain_id })}`] = s;
    const r = await fetchHungryStrains("me.testnet", undefined, view(answers));
    expect(r?.items.map((h) => [h.vessel.strain_id, h.kind])).toEqual([
      [3, "starving"],
      [2, "distressed"],
    ]);
    expect(hungerKind(parseVessel(vessel(9, "x.testnet", 2001))!)).toBeNull();
  });

  it("keeps last_allocate_epoch, also the never-allocated u64::MAX", () => {
    const raw = { strain_id: 1, owner_id: "a", vault_subaccount: "s", vitality: 1, effective_vitality: 1, efficiency_bps: 1, bmr_per_hour: 1, last_fed_sec: 1, role_mask: 1, state_nonce: 1, pending_callbacks: 0, atp_balance: 1, generation: 0, organel: { mitokondria: 0, nukleus: 0, lisosom: 0 }, status: "Active" };
    expect(parseVessel({ ...raw, last_allocate_epoch: 3, phenotype_trait: null })).toMatchObject({ last_allocate_epoch: 3, phenotype_trait: null });
    expect(parseVessel({ ...raw, last_allocate_epoch: "18446744073709551615" })?.last_allocate_epoch).toBeGreaterThan(1e15);
  });
});

describe("UI-150 windows render without a wallet", () => {
  const info: AccountInfo = EMPTY_ACCOUNT_INFO;
  const render = (action: "menu" | GameActionKey) =>
    renderToStaticMarkup(
      <GameActionWindow action={action} wallet={DISCONNECTED_WALLET} info={info} onPick={() => {}} onClose={() => {}} onDone={() => {}} preferredStrainId={null} />,
    );

  it("the menu lists every action with its contract method", () => {
    const html = render("menu");
    for (const a of GAME_ACTIONS) expect(html).toContain(`data-testid="action-${a.key}"`);
    expect(GAME_ACTIONS.map((a) => a.method).join(" ")).toContain("hostile_takeover_splice");
  });

  it.each(["allocate", "divide", "splice", "extract", "transmute", "synthesize", "npc", "hungry", "pool", "gift", "send"] as const)(
    "%s shows the connect line and a disabled sign button",
    (key) => {
      const html = render(key);
      expect(html).toContain('data-testid="connect-line"');
      expect(html).toMatch(/data-testid="[a-z]+-sign"[^>]*disabled=""|disabled=""[^>]*data-testid="[a-z]+-sign"/);
      expect(html).toContain("$SNACC on testnet has no monetary value");
    },
  );

  it("produce names the role it needs", () => {
    expect(render("transmute")).toContain("Fermenter role");
    expect(render("synthesize")).toContain("Synthesizer role");
  });
});
