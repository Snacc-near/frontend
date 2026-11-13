/**
 * UI-146 (hatch + feed): the pure action builders must match the SDK deposit rules
 * (`sdk/src/client.ts`) and the contract signatures (`contracts/snacc/src/lib.rs`); wallet results
 * map to plain English; the status lines render pending / success / failure. Runs in node.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CONTRACT_ID,
  DEFAULT_INITIAL_SPORES,
  GAS,
  buildFeed,
  buildIncubate,
  buildStorageDeposit,
  checkStake,
  formatYocto,
  maxGasFeeYocto,
  parseNear,
  parseUnits,
  toWalletActions,
  totalDeposit,
  withStorage,
} from "../src/chain/actions.ts";
import { humanizeTxError, readOutcome, readThrown } from "../src/chain/txResult.ts";
import { EMPTY_ACCOUNT_INFO, type AccountInfo } from "../src/chain/useAccountInfo.ts";
import { FaucetLine, StorageLine, TESTNET_FAUCET_URL, TxStatusView } from "../src/hud/ChainActions.tsx";
import { StrainDetailModal } from "../src/hud/StrainDetailModal.tsx";
import type { StrainDetail } from "../src/data/types.ts";

const QUARTER_NEAR = "250000000000000000000000";
const FIVE_MILLINEAR = "5000000000000000000000";

describe("UI-146 action builders mirror the SDK rules", () => {
  it("targets the testnet contract", () => {
    expect(CONTRACT_ID).toBe("snacc-v001.testnet");
  });

  it("incubate_strain: attached deposit == initial_snacc_stake, role by name, genesis spores", () => {
    const call = buildIncubate({ role: "Extractor", stakeYocto: QUARTER_NEAR });
    expect(call).toEqual({
      methodName: "incubate_strain",
      args: { role: "Extractor", initial_snacc_stake: QUARTER_NEAR, initial_spores: DEFAULT_INITIAL_SPORES },
      gas: "100000000000000",
      deposit: QUARTER_NEAR,
    });
    expect(call.deposit).toBe(call.args.initial_snacc_stake);
    expect(buildIncubate({ role: "Synthesizer", stakeYocto: "1", initialSpores: 0 }).args).toEqual({
      role: "Synthesizer",
      initial_snacc_stake: "1",
      initial_spores: 0,
    });
  });

  it("incubate_strain rejects a zero or non-integer stake and unknown roles", () => {
    expect(() => buildIncubate({ role: "Extractor", stakeYocto: "0" })).toThrow();
    expect(() => buildIncubate({ role: "Extractor", stakeYocto: "0.25" })).toThrow();
    expect(() => buildIncubate({ role: "Healer" as never, stakeYocto: "1" })).toThrow();
  });

  it("feed_strain: zero deposit, strain_id as a u64 number, amount as a u128 string", () => {
    expect(buildFeed({ strainId: 7, amountYocto: "50000000000000000000000" })).toEqual({
      methodName: "feed_strain",
      args: { strain_id: 7, amount: "50000000000000000000000" },
      gas: "100000000000000",
      deposit: "0",
    });
    expect(() => buildFeed({ strainId: 7, amountYocto: "0" })).toThrow();
    expect(() => buildFeed({ strainId: -1, amountYocto: "1" })).toThrow();
  });

  it("storage_deposit: registration only, deposit = storage_balance_bounds min", () => {
    expect(buildStorageDeposit({ accountId: "alice.testnet", minYocto: FIVE_MILLINEAR })).toEqual({
      methodName: "storage_deposit",
      args: { account_id: "alice.testnet", registration_only: true },
      gas: GAS.storage_deposit,
      deposit: FIVE_MILLINEAR,
    });
    expect(GAS.storage_deposit).toBe("30000000000000");
  });

  it("prepends storage_deposit only for unregistered accounts and sums deposits", () => {
    const hatch = buildIncubate({ role: "Fermenter", stakeYocto: QUARTER_NEAR });
    const fresh = withStorage(hatch, { accountId: "bob.testnet", registered: false, minYocto: FIVE_MILLINEAR });
    expect(fresh.map((c) => c.methodName)).toEqual(["storage_deposit", "incubate_strain"]);
    expect(totalDeposit(fresh)).toBe("255000000000000000000000");
    expect(withStorage(hatch, { accountId: "bob.testnet", registered: true, minYocto: FIVE_MILLINEAR })).toEqual([hatch]);
    // gas ceiling at 10^8 yocto/gas: (30 + 100) TGas → 0.013 NEAR
    expect(maxGasFeeYocto(fresh)).toBe("13000000000000000000000");
  });

  it("maps calls to NEAR Connect FunctionCall actions", () => {
    const [action] = toWalletActions([buildFeed({ strainId: 2, amountYocto: "5" })]);
    expect(action).toEqual({
      type: "FunctionCall",
      params: { methodName: "feed_strain", args: { strain_id: 2, amount: "5" }, gas: "100000000000000", deposit: "0" },
    });
  });

  it("parses and formats decimal amounts exactly (24 decimals)", () => {
    expect(parseNear("0.25")).toBe(QUARTER_NEAR);
    expect(parseNear("1")).toBe("1000000000000000000000000");
    expect(parseNear(".5")).toBe("500000000000000000000000");
    expect(parseNear("")).toBeNull();
    expect(parseNear("-1")).toBeNull();
    expect(parseNear("1e3")).toBeNull();
    expect(parseUnits("0.0000000000000000000000001", 24)).toBeNull();
    expect(formatYocto(QUARTER_NEAR)).toBe("0.25");
    expect(formatYocto("1")).toBe("<0.0001");
    expect(formatYocto(null)).toBe("—");
  });

  it("bounds the hatch stake on testnet", () => {
    expect(checkStake("0.25")).toEqual({ ok: true, yocto: QUARTER_NEAR });
    expect(checkStake("0.001").ok).toBe(false);
    expect(checkStake("50").ok).toBe(false);
    expect(checkStake("abc").ok).toBe(false);
  });
});

describe("UI-146 transaction results", () => {
  it("reads a successful outcome and its hash", () => {
    expect(readOutcome({ transaction: { hash: "AbC123" }, status: { SuccessValue: "" } })).toEqual({ ok: true, txHash: "AbC123" });
    expect(readOutcome([{ transaction_outcome: { id: "h1" }, status: { SuccessValue: "" } }])).toEqual({ ok: true, txHash: "h1" });
  });

  it("maps a contract panic inside a Failure status to plain English and keeps the raw text", () => {
    const outcome = {
      transaction: { hash: "Tx9" },
      status: { Failure: { ActionError: { kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: ERR_NOT_OWNED_BY_CALLEE" } } } } },
    };
    const r = readOutcome(outcome);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.txHash).toBe("Tx9");
    expect(r.message).toBe("You can only feed a Snacc you own.");
    expect(r.raw).toContain("ERR_NOT_OWNED_BY_CALLEE");
  });

  it("finds a failure in a receipt outcome", () => {
    const r = readOutcome({
      transaction: { hash: "T" },
      status: { SuccessValue: "" },
      receipts_outcome: [{ outcome: { status: { Failure: "ERR_INSUFFICIENT_BALANCE" } } }],
    });
    expect(r.ok).toBe(false);
  });

  it("treats a closed wallet prompt as a rejection and unknown codes generically", () => {
    expect(readThrown(new Error("User rejected")).rejected).toBe(true);
    expect(humanizeTxError("Smart contract panicked: ERR_SOMETHING_NEW").message).toBe("The contract refused the call (ERR_SOMETHING_NEW).");
    expect(humanizeTxError("NotEnoughBalance { ... }").message).toMatch(/testnet NEAR/);
  });
});

const info: AccountInfo = {
  ...EMPTY_ACCOUNT_INFO,
  nearYocto: "1500000000000000000000000",
  storage: { registered: false, minYocto: FIVE_MILLINEAR },
};

const strain: StrainDetail = {
  strain_id: 7,
  owner_id: "alice.testnet",
  vault_subaccount: "v7.alice.testnet",
  vitality: 7200,
  efficiency_bps: 10000,
  bmr_per_hour: 100,
  last_fed_sec: 0,
  role_mask: 1,
  state_nonce: 1,
  pending_callbacks: 0,
  atp_balance: "5",
  generation: 1,
  organel: { mitokondria: 1, nukleus: 2, lisosom: 0 },
  status: "Active",
  effective_vitality: 7100,
};

describe("UI-146 inject nutrients in Strain Detail", () => {
  const feedKey = (html: string) => /<button[^>]*data-testid="strain-feed"[^>]*>/.exec(html)?.[0] ?? "";

  it("stays disabled in live mode without an owning wallet, with the given hint", () => {
    const html = renderToStaticMarkup(<StrainDetailModal strain={strain} skin="biolab" mode="live" onClose={() => {}} feedHint="connect a wallet to feed" />);
    expect(feedKey(html)).toContain('disabled=""');
    expect(html).toContain("connect a wallet to feed");
  });

  it("is enabled in live mode when the connected wallet owns the strain", () => {
    const html = renderToStaticMarkup(<StrainDetailModal strain={strain} skin="biolab" mode="live" onClose={() => {}} feedEnabled />);
    expect(feedKey(html)).not.toContain("disabled");
    expect(html).toContain("feed_strain · signed in your wallet on testnet");
  });
});

describe("UI-146 status lines", () => {
  it("explains the one-time storage registration only when needed", () => {
    expect(renderToStaticMarkup(<StorageLine info={info} />)).toContain("storage_deposit");
    expect(renderToStaticMarkup(<StorageLine info={{ ...info, storage: { registered: true, minYocto: FIVE_MILLINEAR } }} />)).toBe("");
  });

  it("links the official testnet faucet when the balance is short", () => {
    const html = renderToStaticMarkup(<FaucetLine needYocto={QUARTER_NEAR} info={{ ...info, nearYocto: "0" }} />);
    expect(html).toContain(TESTNET_FAUCET_URL);
    expect(TESTNET_FAUCET_URL).toBe("https://docs.near.org/tools/faucet");
    expect(renderToStaticMarkup(<FaucetLine needYocto={QUARTER_NEAR} info={info} />)).toBe("");
  });

  it("renders pending, success with explorer link, and failure with raw details", () => {
    expect(renderToStaticMarkup(<TxStatusView phase={{ kind: "pending" }} />)).toContain("tx-pending");
    const ok = renderToStaticMarkup(<TxStatusView phase={{ kind: "done", result: { ok: true, txHash: "HASH1234567890" } }} />);
    expect(ok).toContain("https://testnet.nearblocks.io/txns/HASH1234567890");
    const bad = renderToStaticMarkup(
      <TxStatusView phase={{ kind: "done", result: { ok: false, txHash: null, message: "Not enough $SNACC for this.", raw: "ERR_INSUFFICIENT_BALANCE", rejected: false } }} />,
    );
    expect(bad).toContain("Not enough $SNACC");
    expect(bad).toContain("<details");
    expect(bad).toContain("ERR_INSUFFICIENT_BALANCE");
  });
});
