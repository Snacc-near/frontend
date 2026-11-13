/**
 * RES-111 one-tap play: deposit-free game actions signed in this browser with a function-call key.
 * Covers the method list, the AddKey/DeleteKey wallet actions, the wallet allowlist, the Borsh
 * encoding (pinned to near-api-js 7.4.0 vectors), the nonce/block-hash flow and every fallback with a
 * fake RPC, per-account/network storage, telemetry props and the Settings copy. No network: every
 * RPC answer comes from a fake `fetch`. Runs in node (Web Crypto Ed25519 is built in).
 *
 * How the vectors were made: a scratch directory outside the repo with `npm install near-api-js@7.4.0`
 * and a script that builds the same transactions with `createTransaction(signer, PublicKey, receiver,
 * nonce, [actions.functionCall(method, args, gas, 0n)], blockHash)`, `encodeTransaction(tx)`,
 * `sha256`, `KeyPair.fromString(seed‖pub).sign(hash)` and `encodeTransaction(new SignedTransaction(...))`.
 * Seed = bytes 0x01..0x20, block hash = bytes 0xa0..0xbf. Ed25519 is deterministic, so the signed
 * bytes are reproducible here with Web Crypto.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConnectorAction } from "@hot-labs/near-connect";
import {
  CONTRACT_ID,
  GAS,
  buildAdopt,
  buildAllocateAtp,
  buildClaimDividend,
  buildDivide,
  buildExtract,
  buildFeed,
  buildFtTransfer,
  buildHarvest,
  buildHostileTakeover,
  buildIncubate,
  buildNftTransfer,
  buildNpcBuy,
  buildRedeemAether,
  buildSplice,
  buildStorageDeposit,
  buildSynthesize,
  buildTransmute,
  type ContractCall,
} from "../src/chain/actions.ts";
import { buildList } from "../src/chain/market.ts";
import { MARKET_ID } from "../src/data/nearView.ts";
import {
  ATTACHES_NEAR_METHODS,
  CONTRACT_METHOD_DEPOSIT,
  FALLBACK_NOTICE,
  MAX_ONE_TAP_ALLOWANCE_YOCTO,
  NOT_CONFIRMED_MESSAGE,
  ONE_TAP_ALLOWANCE_YOCTO,
  ONE_TAP_METHODS,
  PAYS_OTHER_METHODS,
  WALLET_ONLY_METHODS,
  invalidNonceAk,
  isCurrentMethodList,
  base58Decode,
  base58Encode,
  buildAddKeyAction,
  buildDeleteKeyAction,
  checkWalletTx,
  classifySendError,
  deriveOneTapMethods,
  encodeFunctionCallTx,
  encodeSignedTx,
  fromBase64,
  sendSignless,
  signlessCall,
  toBase64,
  type OneTapRpc,
  type OneTapSigner,
  type WalletTx,
} from "../src/chain/oneTap.ts";
import {
  MemoryOneTapStore,
  ONE_TAP_LOCAL_KEY,
  generateOneTapKey,
  indexedDbStore,
  newRecord,
  pickOneTapStores,
  scopeOf,
  signerFromRecord,
  webStorageStore,
  wipeOneTapDevice,
  type OneTapRecord,
  type OneTapStore,
} from "../src/chain/oneTapKeys.ts";
import { NO_ONE_TAP, OneTapContext, OneTapController, sendWithOneTap, type OneTapHandle, type OneTapSnapshot } from "../src/chain/oneTapSession.ts";
import { DISCONNECTED_WALLET, SIGNABLE_RECEIVERS, WalletContext, type WalletApi } from "../src/chain/wallet.tsx";
import type { TxResult } from "../src/chain/txResult.ts";
import { EMPTY_ACCOUNT_INFO } from "../src/chain/useAccountInfo.ts";
import { OneTapSettings } from "../src/help/OneTapSettings.tsx";
import { Footer, TxStatusView, runSend, type TxPhase } from "../src/hud/ChainActions.tsx";
import { WalletControl } from "../src/hud/WalletControl.tsx";
import { APP_LOCAL_KEYS } from "../src/prefs/prefs.ts";
import { describePayload } from "../src/sign/payload.ts";

const subtle = globalThis.crypto.subtle;

// ------------------------------------------------------------------ near-api-js 7.4.0 vectors

const VECTOR = {
  seedHex: "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
  publicKey: "ed25519:9C6hybhQ6Aycep9jaUnP6uL9ZYvDjUp1aSkFWPUFJtpj",
  signerId: "player.testnet",
  receiverId: "snacc-v001.testnet",
  blockHash: "Bp3BbhbyBNoTt3LgewDgCf2ckx5pHoUyPxdEMC6KHgyL",
  cases: [
    {
      method: "feed_strain",
      args: { strain_id: 7, amount: "50000000000000000000000" },
      gas: "100000000000000",
      nonce: "187654321000001",
      txHex:
        "0e000000706c617965722e746573746e65740079b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad04966441ce24adabaa000012000000736e6163632d763030312e746573746e6574a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf01000000020b000000666565645f73747261696e320000007b2273747261696e5f6964223a372c22616d6f756e74223a223530303030303030303030303030303030303030303030227d00407a10f35a000000000000000000000000000000000000",
      txHash: "DCJ1fEnzTiUEigve2JD5SR6wBoq6cVLczLhG6HMMGeaL",
      signedBase64:
        "DgAAAHBsYXllci50ZXN0bmV0AHm1Vi6P5lT5QHixEuipi6eQH4U65pW+1+DjkQutBJZkQc4krauqAAASAAAAc25hY2MtdjAwMS50ZXN0bmV0oKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr8BAAAAAgsAAABmZWVkX3N0cmFpbjIAAAB7InN0cmFpbl9pZCI6NywiYW1vdW50IjoiNTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAifQBAehDzWgAAAAAAAAAAAAAAAAAAAAAAAAA6gh1Km5lTqFInZEtAnJlU+9BnMqxozhItmREpCdjp0+D1VT6uhMoe4BCgW+gh29Y2HkK706ZbVTDSn6yz9IkC",
    },
    {
      method: "allocate_atp",
      args: { strain_id: 12, mitokondria: 2, nukleus: 1, lisosom: 0 },
      gas: "50000000000000",
      nonce: "5",
      txHex:
        "0e000000706c617965722e746573746e65740079b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664050000000000000012000000736e6163632d763030312e746573746e6574a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf01000000020c000000616c6c6f636174655f617470380000007b2273747261696e5f6964223a31322c226d69746f6b6f6e64726961223a322c226e756b6c657573223a312c226c69736f736f6d223a307d00203d88792d000000000000000000000000000000000000",
      txHash: "9cUZm3yepePPtyYXM4t1Ax5BY7xZqV3ZYdox4Gd9W1Wt",
      signedBase64:
        "DgAAAHBsYXllci50ZXN0bmV0AHm1Vi6P5lT5QHixEuipi6eQH4U65pW+1+DjkQutBJZkBQAAAAAAAAASAAAAc25hY2MtdjAwMS50ZXN0bmV0oKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr8BAAAAAgwAAABhbGxvY2F0ZV9hdHA4AAAAeyJzdHJhaW5faWQiOjEyLCJtaXRva29uZHJpYSI6MiwibnVrbGV1cyI6MSwibGlzb3NvbSI6MH0AID2IeS0AAAAAAAAAAAAAAAAAAAAAAAAAtb5vj+/wWF8TMhUS+xCFZ8TWshjWPVmuucLCELAqw2gL8BGkvXzy4k7O/PoPYKUNy/dEvAEo76Oa0WoiCsh0BA==",
    },
  ],
} as const;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => Uint8Array.from(s.match(/../g)!.map((h) => parseInt(h, 16)));

/** The vector's key as a Web Crypto signer (seed imported as a non-extractable PKCS#8 key). */
async function seedSigner(): Promise<OneTapSigner> {
  const pkcs8 = new Uint8Array([...unhex("302e020100300506032b657004220420"), ...unhex(VECTOR.seedHex)]);
  const key = await subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  return { publicKey: VECTOR.publicKey, sign: async (m) => new Uint8Array(await subtle.sign({ name: "Ed25519" }, key, m as BufferSource)) };
}

/** Reads the head of a signed transaction (enough to check nonce, block hash and method). */
function decodeSigned(b64: string) {
  const b = fromBase64(b64);
  let o = 0;
  const u32 = () => {
    const v = b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24);
    o += 4;
    return v >>> 0;
  };
  const str = () => {
    const n = u32();
    const s = new TextDecoder().decode(b.slice(o, o + n));
    o += n;
    return s;
  };
  const u64 = () => {
    let v = 0n;
    for (let i = 0; i < 8; i++) v |= BigInt(b[o + i]!) << BigInt(8 * i);
    o += 8;
    return v;
  };
  const signerId = str();
  o += 1;
  const publicKey = `ed25519:${base58Encode(b.slice(o, o + 32))}`;
  o += 32;
  const nonce = u64();
  const receiverId = str();
  const blockHash = base58Encode(b.slice(o, o + 32));
  o += 32;
  const actions = u32();
  const variant = b[o]!;
  o += 1;
  const methodName = str();
  const args = JSON.parse(str()) as Record<string, unknown>;
  return { signerId, publicKey, nonce, receiverId, blockHash, actions, variant, methodName, args };
}

// ------------------------------------------------------------------ fake chain + RPC

interface FakeKey {
  nonce: bigint;
  permission: "FullAccess" | { FunctionCall: { allowance: string | null; receiver_id: string; method_names: string[] } };
}

type SendHook = (signedB64: string, url: string, n: number) => { result?: unknown; error?: unknown } | "transport" | undefined;

/** A tiny NEAR: access keys per account, a final block hash, and `send_tx` (overridable per call). */
function fakeChain(opts: { urls?: string[]; onSend?: SendHook; queryTransport?: boolean } = {}) {
  const keys = new Map<string, FakeKey>();
  const log: { url: string; method: string; params: Record<string, unknown> }[] = [];
  let sends = 0;
  const urls = opts.urls ?? ["https://rpc-a.test", "https://rpc-b.test"];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { id: string; method: string; params: Record<string, unknown> };
    log.push({ url, method: body.method, params: body.params });
    const reply = (x: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, ...(x as object) }));
    if (body.method === "query") {
      if (opts.queryTransport) throw new TypeError("fetch failed");
      const k = keys.get(`${body.params.account_id}|${body.params.public_key}`);
      if (!k) return reply({ error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_ACCESS_KEY", info: {} }, code: -32000, message: "Server error" } });
      return reply({ result: { nonce: Number(k.nonce), permission: k.permission, block_hash: VECTOR.blockHash, block_height: 1000 } });
    }
    if (body.method === "send_tx") {
      sends++;
      const b64 = String(body.params.signed_tx_base64);
      const hook = opts.onSend?.(b64, url, sends);
      if (hook === "transport") throw new TypeError("fetch failed");
      if (hook) return reply(hook);
      const tx = decodeSigned(b64);
      return reply({
        result: {
          final_execution_status: "EXECUTED_OPTIMISTIC",
          status: { SuccessValue: "" },
          transaction: { hash: `hash-${tx.nonce}`, nonce: Number(tx.nonce) },
          transaction_outcome: { id: `hash-${tx.nonce}` },
          receipts_outcome: [],
        },
      });
    }
    return reply({ error: { name: "UNKNOWN_METHOD" } });
  };
  const rpc: OneTapRpc = { urls, fetch: fetchImpl as OneTapRpc["fetch"] };
  return {
    rpc,
    log,
    keys,
    sends: () => log.filter((l) => l.method === "send_tx"),
    addFcKey(accountId: string, publicKey: string, nonce = 41n, allowance: string | null = ONE_TAP_ALLOWANCE_YOCTO, methods: readonly string[] = ONE_TAP_METHODS) {
      keys.set(`${accountId}|${publicKey}`, { nonce, permission: { FunctionCall: { allowance, receiver_id: CONTRACT_ID, method_names: [...methods] } } });
    },
  };
}

const ALICE = "alice.testnet";
const feed = () => buildFeed({ strainId: 7, amountYocto: "50000000000000000000000" });

// ------------------------------------------------------------------ method list

/** Pinned copy of the SDK lists (`sdk/src/session-key.ts` on origin/main, 2026-11-13). */
const SDK_SIGNLESS_METHODS = [
  "allocate_atp",
  "feed_strain",
  "commit_genome_experiment",
  "apply_tee_mutation_zero_trust",
  "splice_strains",
  "hostile_takeover_splice",
  "adopt",
  "divide_strain",
  "harvest_starving_strain",
  "conjugate_traits",
  "npc_buy_spores",
  "synthesize_and_redeem_aether",
  "claim_industrial_dividend",
  "advance_epoch",
  "ft_burn",
];
const SDK_DEPOSIT_METHODS = [
  "incubate_strain",
  "materialize_subaccount",
  "extract_spores",
  "transmute_spores_to_enzyme",
  "synthesize_elixir",
  "nft_transfer",
  "nft_transfer_call",
  "ft_transfer",
  "ft_transfer_call",
  "storage_deposit",
  "storage_unregister",
];

describe("RES-111 one-tap method list", () => {
  it("is exactly the eight deposit-free player methods that pay no counterparty", () => {
    expect(ONE_TAP_METHODS).toEqual([
      "allocate_atp",
      "claim_industrial_dividend",
      "divide_strain",
      "feed_strain",
      "harvest_starving_strain",
      "npc_buy_spores",
      "splice_strains",
      "synthesize_and_redeem_aether",
    ]);
    // `adopt` and `hostile_takeover_splice` pay another player's account: wallet-only, by rule.
    expect(CONTRACT_METHOD_DEPOSIT.adopt).toBe("pays_other");
    expect(CONTRACT_METHOD_DEPOSIT.hostile_takeover_splice).toBe("pays_other");
    expect(PAYS_OTHER_METHODS).toEqual(["hostile_takeover_splice", "adopt"]);
    for (const m of PAYS_OTHER_METHODS) {
      expect(ONE_TAP_METHODS).not.toContain(m);
      expect(WALLET_ONLY_METHODS).toContain(m);
      expect(ATTACHES_NEAR_METHODS).not.toContain(m);
    }
  });

  it("is derived from the deposit table and matches what the builders attach", () => {
    expect(deriveOneTapMethods({ b: "none", a: "none", c: "fee", d: "one_yocto", e: "pays_other" })).toEqual(["a", "b"]);
    const zero: ContractCall[] = [
      feed(),
      buildAllocateAtp({ strainId: 1, mitokondria: 1, nukleus: 0, lisosom: 0 }),
      buildDivide({ strainId: 1 }),
      buildSplice({ dominantId: 1, absorbedId: 2 }),
      buildHarvest({ targetId: 2 }),
      buildNpcBuy({ strainId: 1, npcId: "npc-extractor", buyAmount: 1 }),
      buildRedeemAether({ strainId: 1, amount: "1" }),
      buildClaimDividend({ strainId: 1, epoch: 2 }),
    ];
    for (const c of zero) expect(c.deposit, c.methodName).toBe("0");
    expect(zero.map((c) => c.methodName).sort()).toEqual([...ONE_TAP_METHODS]);
    // Zero deposit, yet wallet-only: the app keeps sending them, through the wallet.
    const paysOther: ContractCall[] = [
      buildHostileTakeover({ raiderStrainId: 1, distressedTargetId: 2, expectedTargetNonce: 3 }),
      buildAdopt({ targetId: 2, raiderStrainId: 1, expectedTargetNonce: 3 }),
    ];
    for (const c of paysOther) {
      expect(c.deposit).toBe("0");
      expect(signlessCall([c], CONTRACT_ID, ONE_TAP_METHODS)).toEqual({ ok: false, reason: "method" });
      // Even a key that still lists it (an older build) never makes it one-tap.
      expect(signlessCall([c], CONTRACT_ID, [...ONE_TAP_METHODS, c.methodName])).toEqual({ ok: false, reason: "method" });
    }

    const paid: ContractCall[] = [
      buildIncubate({ role: "Extractor", stakeYocto: "250000000000000000000000" }),
      buildStorageDeposit({ accountId: ALICE, minYocto: "5000000000000000000000" }),
      buildExtract({ strainId: 1, sporeType: "mt:spore-ignis", feeYocto: "1000000000000000000000" }),
      buildTransmute({ strainId: 1, sporesToBurn: 2, feeYocto: "1000000000000000000000" }),
      buildSynthesize({ strainId: 1, elixirType: "mt:elixir-homunculus", enzymesToBurn: 3, feeYocto: "1000000000000000000000" }),
      buildNftTransfer({ receiverId: "bob.testnet", strainId: 1 }),
      buildFtTransfer({ receiverId: "bob.testnet", amountYocto: "1" }),
      buildList({ strainId: 1, priceYocto: "1000000000000000000000000" }).call,
    ];
    for (const c of paid) {
      expect(BigInt(c.deposit) > 0n, c.methodName).toBe(true);
      expect(WALLET_ONLY_METHODS).toContain(c.methodName);
      expect(ONE_TAP_METHODS).not.toContain(c.methodName);
    }
    // Every method in the gas table has a deposit rule.
    for (const m of Object.keys(GAS)) expect(Object.keys(CONTRACT_METHOD_DEPOSIT)).toContain(m);
  });

  it("is a subset of the SDK's SIGNLESS_METHODS and shares nothing with DEPOSIT_METHODS", () => {
    for (const m of ONE_TAP_METHODS) {
      expect(SDK_SIGNLESS_METHODS).toContain(m);
      expect(SDK_DEPOSIT_METHODS).not.toContain(m);
    }
    for (const m of ATTACHES_NEAR_METHODS) expect(SDK_DEPOSIT_METHODS).toContain(m);
    // The two `pays_other` methods are deposit-free in the SDK too; the app keeps them in the wallet anyway.
    for (const m of PAYS_OTHER_METHODS) expect(SDK_SIGNLESS_METHODS).toContain(m);
  });
});

// ------------------------------------------------------------------ AddKey / DeleteKey and the allowlist

describe("RES-111 wallet actions and allowlist", () => {
  const pk = VECTOR.publicKey;
  const ctx = (deletableKey: string | null = null) => ({ signerId: ALICE, receivers: SIGNABLE_RECEIVERS, deletableKey });
  const addKey = (patch: Record<string, unknown> = {}): WalletTx => {
    const a = buildAddKeyAction(pk);
    return { signerId: ALICE, receiverId: ALICE, actions: [{ ...a, params: { ...a.params, accessKey: { ...a.params.accessKey, permission: { ...(a.params.accessKey.permission as object), ...patch } } } } as never] };
  };

  it("builds the AddKey and DeleteKey actions in NEAR Connect's shape", () => {
    const add = buildAddKeyAction(pk);
    expect(add).toEqual({
      type: "AddKey",
      params: {
        publicKey: pk,
        accessKey: { nonce: 0, permission: { receiverId: CONTRACT_ID, allowance: "250000000000000000000000", methodNames: [...ONE_TAP_METHODS] } },
      },
    });
    expect(buildDeleteKeyAction(pk)).toEqual({ type: "DeleteKey", params: { publicKey: pk } });
    // Type-level check against `@hot-labs/near-connect` 0.12's `ConnectorAction` (tsc runs on tests).
    const asConnector: ConnectorAction[] = [add as ConnectorAction, buildDeleteKeyAction(pk)];
    expect(asConnector).toHaveLength(2);
  });

  it("lets through game calls to the two contracts and nothing else", () => {
    const fc = { type: "FunctionCall" as const, params: { methodName: "feed_strain", args: {}, gas: "1", deposit: "0" } };
    expect(checkWalletTx({ signerId: ALICE, receiverId: CONTRACT_ID, actions: [fc] }, ctx())).toBeNull();
    expect(checkWalletTx({ signerId: ALICE, receiverId: MARKET_ID, actions: [fc] }, ctx())).toBeNull();
    expect(checkWalletTx({ signerId: ALICE, receiverId: "evil.testnet", actions: [fc] }, ctx())).toMatch(/not a contract/);
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [fc] }, ctx())).toMatch(/not a contract/);
    expect(checkWalletTx({ signerId: "bob.testnet", receiverId: CONTRACT_ID, actions: [fc] }, ctx())).toMatch(/signer/);
    expect(checkWalletTx({ signerId: ALICE, receiverId: CONTRACT_ID, actions: [] }, ctx())).toMatch(/at least one/);
  });

  it("allows the one-tap AddKey only to your own account and only in its exact form", () => {
    expect(checkWalletTx(addKey(), ctx())).toBeNull();
    const add = buildAddKeyAction(pk);
    expect(checkWalletTx({ signerId: ALICE, receiverId: CONTRACT_ID, actions: [add] }, ctx())).toMatch(/own account/);
    expect(checkWalletTx({ signerId: ALICE, receiverId: "bob.testnet", actions: [add] }, ctx())).toMatch(/own account/);
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [add, add] }, ctx())).toMatch(/only action/);
    const fc = { type: "FunctionCall" as const, params: { methodName: "feed_strain", args: {}, gas: "1", deposit: "0" } };
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [add, fc] }, ctx())).toMatch(/only action/);
    const full = { type: "AddKey" as const, params: { publicKey: pk, accessKey: { permission: "FullAccess" as const } } };
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [full] }, ctx())).toMatch(/full-access/);
    expect(checkWalletTx(addKey({ receiverId: MARKET_ID }), ctx())).toMatch(/only call/);
    expect(checkWalletTx(addKey({ methodNames: [...ONE_TAP_METHODS, "extract_spores"] }), ctx())).toMatch(/exactly/);
    expect(checkWalletTx(addKey({ methodNames: ONE_TAP_METHODS.slice(1) }), ctx())).toMatch(/exactly/);
    expect(checkWalletTx(addKey({ methodNames: [] }), ctx())).toMatch(/exactly/);
    // The earlier ten-method list (with `adopt` / `hostile_takeover_splice`) is no longer accepted.
    expect(checkWalletTx(addKey({ methodNames: OLD_METHODS }), ctx())).toMatch(/exactly/);
    expect(checkWalletTx(addKey({ methodNames: [...ONE_TAP_METHODS, "adopt"] }), ctx())).toMatch(/exactly/);
    expect((buildAddKeyAction(pk).params.accessKey.permission as { methodNames: string[] }).methodNames).not.toContain("adopt");
    expect(checkWalletTx(addKey({ allowance: undefined }), ctx())).toMatch(/fixed allowance/);
    expect(checkWalletTx(addKey({ allowance: "0" }), ctx())).toMatch(/out of range/);
    expect(checkWalletTx(addKey({ allowance: (BigInt(MAX_ONE_TAP_ALLOWANCE_YOCTO) + 1n).toString() }), ctx())).toMatch(/out of range/);
    const gasKey = { ...add, params: { ...add.params, gasKeyInfo: { balance: "0", numNonces: 1 } } };
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [gasKey] }, ctx())).toMatch(/gas keys/);
    const badKey = buildAddKeyAction("ed25519:abc");
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [badKey] }, ctx())).toMatch(/ed25519/);
  });

  it("allows a DeleteKey only for the one-tap key this browser holds, sent to your own account", () => {
    const del = buildDeleteKeyAction(pk);
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [del] }, ctx(pk))).toBeNull();
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [del] }, ctx(null))).toMatch(/only the one-tap key/);
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [buildDeleteKeyAction("ed25519:Other")] }, ctx(pk))).toMatch(/only the one-tap key/);
    expect(checkWalletTx({ signerId: ALICE, receiverId: CONTRACT_ID, actions: [del] }, ctx(pk))).toMatch(/own account/);
    expect(checkWalletTx({ signerId: ALICE, receiverId: ALICE, actions: [{ type: "Transfer", params: { deposit: "1" } } as never] }, ctx(pk))).toMatch(/not one this game signs/);
  });

  it("decides which calls may go out signless", () => {
    expect(signlessCall([feed()], CONTRACT_ID, ONE_TAP_METHODS).ok).toBe(true);
    expect(signlessCall([feed()], MARKET_ID, ONE_TAP_METHODS)).toEqual({ ok: false, reason: "receiver" });
    expect(signlessCall([buildStorageDeposit({ accountId: ALICE, minYocto: "1" }), feed()], CONTRACT_ID, ONE_TAP_METHODS)).toEqual({ ok: false, reason: "batch" });
    expect(signlessCall([buildExtract({ strainId: 1, sporeType: "mt:spore-ignis", feeYocto: "1" })], CONTRACT_ID, ONE_TAP_METHODS)).toEqual({ ok: false, reason: "deposit" });
    expect(signlessCall([{ ...feed(), methodName: "advance_epoch" }], CONTRACT_ID, [...ONE_TAP_METHODS, "advance_epoch"])).toEqual({ ok: false, reason: "method" });
    expect(signlessCall([feed()], CONTRACT_ID, ["allocate_atp"])).toEqual({ ok: false, reason: "method" });
  });
});

// ------------------------------------------------------------------ Borsh

describe("RES-111 Borsh encoding (near-api-js 7.4.0 vectors)", () => {
  it("encodes, hashes and signs both vectors byte for byte", async () => {
    const signer = await seedSigner();
    for (const c of VECTOR.cases) {
      const tx = encodeFunctionCallTx({
        signerId: VECTOR.signerId,
        publicKey: base58Decode(VECTOR.publicKey.slice(8)),
        nonce: BigInt(c.nonce),
        receiverId: VECTOR.receiverId,
        blockHash: base58Decode(VECTOR.blockHash),
        methodName: c.method,
        args: new TextEncoder().encode(JSON.stringify(c.args)),
        gas: BigInt(c.gas),
        deposit: 0n,
      });
      expect(hex(tx)).toBe(c.txHex);
      const digest = new Uint8Array(await subtle.digest("SHA-256", tx as BufferSource));
      expect(base58Encode(digest)).toBe(c.txHash);
      expect(toBase64(encodeSignedTx(tx, await signer.sign(digest)))).toBe(c.signedBase64);
    }
  });

  it("round-trips base58 and refuses out-of-range numbers", () => {
    const b = new Uint8Array([0, 0, 1, 2, 255]);
    expect(base58Decode(base58Encode(b))).toEqual(b);
    expect(() => base58Decode("0OIl")).toThrow();
    const base = { signerId: "a", publicKey: new Uint8Array(32), receiverId: "b", blockHash: new Uint8Array(32), methodName: "m", args: new Uint8Array(), gas: 1n, deposit: 0n };
    expect(() => encodeFunctionCallTx({ ...base, nonce: 1n << 64n })).toThrow(RangeError);
    expect(() => encodeFunctionCallTx({ ...base, nonce: 1n, publicKey: new Uint8Array(31) })).toThrow(RangeError);
  });
});

// ------------------------------------------------------------------ sendSignless with a fake RPC

describe("RES-111 signless send (fake RPC)", () => {
  it("takes nonce + 1 and the final block hash from view_access_key, then send_tx; the bytes match the vector", async () => {
    const chain = fakeChain();
    chain.addFcKey(VECTOR.signerId, VECTOR.publicKey, 187654321000000n);
    const onBroadcast = vi.fn();
    const out = await sendSignless({ rpc: chain.rpc, subtle, signer: await seedSigner(), accountId: VECTOR.signerId, call: feed(), onBroadcast });
    expect(chain.log.map((l) => l.method)).toEqual(["query", "send_tx"]);
    expect(chain.log[0]!.params).toMatchObject({ request_type: "view_access_key", finality: "final", account_id: VECTOR.signerId, public_key: VECTOR.publicKey });
    expect(chain.log[1]!.params).toEqual({ signed_tx_base64: VECTOR.cases[0].signedBase64, wait_until: "EXECUTED_OPTIMISTIC" });
    expect(onBroadcast).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ kind: "sent", nonce: 187654321000001n, result: { ok: true, txHash: "hash-187654321000001", signless: true } });
  });

  it("goes above the highest nonce this browser already used", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey, 41n);
    const signer = await seedSigner();
    const first = await sendSignless({ rpc: chain.rpc, subtle, signer, accountId: ALICE, call: feed() });
    const second = await sendSignless({ rpc: chain.rpc, subtle, signer, accountId: ALICE, call: feed(), lastNonce: 42n });
    expect(first.kind === "sent" && first.nonce).toBe(42n);
    expect(second.kind === "sent" && second.nonce).toBe(43n);
    const sent = chain.sends().map((s) => decodeSigned(String(s.params.signed_tx_base64)));
    expect(sent.map((t) => t.nonce)).toEqual([42n, 43n]);
    expect(sent[0]).toMatchObject({ signerId: ALICE, receiverId: CONTRACT_ID, blockHash: VECTOR.blockHash, actions: 1, variant: 2, methodName: "feed_strain" });
  });

  it("retries above the node's ak_nonce when the final read still lags behind it", async () => {
    const chain = fakeChain({
      onSend: (_b, _u, n) =>
        n === 1 ? { error: { name: "HANDLER_ERROR", cause: { name: "INVALID_TRANSACTION" }, data: { TxExecutionError: { InvalidTxError: { InvalidNonce: { ak_nonce: 60, tx_nonce: 46 } } } } } } : undefined,
    });
    // The final-finality read keeps saying 41 (it lags); lastNonce is 45; the node knows 60.
    chain.addFcKey(ALICE, VECTOR.publicKey, 41n);
    const out = await sendSignless({ rpc: chain.rpc, subtle, signer: await seedSigner(), accountId: ALICE, call: feed(), lastNonce: 45n });
    expect(chain.sends().map((s) => decodeSigned(String(s.params.signed_tx_base64)).nonce)).toEqual([46n, 61n]);
    expect(out.kind === "sent" && out.result.ok).toBe(true);
  });

  it("does not use an on-chain key whose method list is not this version's (requireMethods)", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey, 1n, ONE_TAP_ALLOWANCE_YOCTO, OLD_METHODS);
    const out = await sendSignless({ rpc: chain.rpc, subtle, signer: await seedSigner(), accountId: ALICE, call: feed(), requireMethods: ONE_TAP_METHODS });
    expect(out).toMatchObject({ kind: "fallback", reason: "outdated", notice: FALLBACK_NOTICE.outdated, broadcast: false });
    expect(chain.sends()).toHaveLength(0);
  });

  it("re-reads the nonce once after InvalidNonce (the tx was refused, so it cannot land twice)", async () => {
    const chain = fakeChain({
      onSend: (_b, _u, n) => {
        if (n !== 1) return undefined;
        chain.addFcKey(ALICE, VECTOR.publicKey, 50n);
        return { error: { name: "HANDLER_ERROR", cause: { name: "INVALID_TRANSACTION" }, data: { TxExecutionError: { InvalidTxError: { InvalidNonce: { ak_nonce: 50, tx_nonce: 42 } } } } } };
      },
    });
    chain.addFcKey(ALICE, VECTOR.publicKey, 41n);
    const out = await sendSignless({ rpc: chain.rpc, subtle, signer: await seedSigner(), accountId: ALICE, call: feed(), lastNonce: 45n });
    expect(chain.sends().map((s) => decodeSigned(String(s.params.signed_tx_base64)).nonce)).toEqual([46n, 51n]);
    expect(out.kind === "sent" && out.result.ok).toBe(true);
  });

  it("falls back before sending when the key is missing, the allowance is too low or the method is not allowed", async () => {
    const signer = await seedSigner();
    const none = fakeChain();
    expect(await sendSignless({ rpc: none.rpc, subtle, signer, accountId: ALICE, call: feed() })).toEqual({ kind: "fallback", reason: "key-missing", notice: FALLBACK_NOTICE["key-missing"], broadcast: false });
    const poor = fakeChain();
    poor.addFcKey(ALICE, VECTOR.publicKey, 1n, "1000");
    expect(await sendSignless({ rpc: poor.rpc, subtle, signer, accountId: ALICE, call: feed() })).toMatchObject({ kind: "fallback", reason: "allowance" });
    const narrow = fakeChain();
    narrow.addFcKey(ALICE, VECTOR.publicKey, 1n, ONE_TAP_ALLOWANCE_YOCTO, ["allocate_atp"]);
    expect(await sendSignless({ rpc: narrow.rpc, subtle, signer, accountId: ALICE, call: feed() })).toMatchObject({ kind: "fallback", reason: "method" });
    const down = fakeChain({ queryTransport: true });
    expect(await sendSignless({ rpc: down.rpc, subtle, signer, accountId: ALICE, call: feed() })).toMatchObject({ kind: "fallback", reason: "rpc-unreachable", broadcast: false });
    for (const c of [none, poor, narrow, down]) expect(c.sends()).toHaveLength(0);
  });

  it("falls back after an invalid-transaction answer (NotEnoughAllowance), which cannot land", async () => {
    const chain = fakeChain({ onSend: () => ({ error: { name: "HANDLER_ERROR", cause: { name: "INVALID_TRANSACTION" }, data: { TxExecutionError: { InvalidTxError: { InvalidAccessKeyError: { NotEnoughAllowance: {} } } } } } }) });
    chain.addFcKey(ALICE, VECTOR.publicKey);
    expect(await sendSignless({ rpc: chain.rpc, subtle, signer: await seedSigner(), accountId: ALICE, call: feed() })).toMatchObject({ kind: "fallback", reason: "allowance", broadcast: true });
  });

  it("never falls back once the tx may have landed: a timeout gives 'not confirmed' with the local hash", async () => {
    const chain = fakeChain({ onSend: () => ({ error: { name: "HANDLER_ERROR", cause: { name: "TIMEOUT_ERROR" } } }) });
    chain.addFcKey(VECTOR.signerId, VECTOR.publicKey, 187654321000000n);
    const out = await sendSignless({ rpc: chain.rpc, subtle, signer: await seedSigner(), accountId: VECTOR.signerId, call: feed() });
    expect(out.kind).toBe("sent");
    if (out.kind !== "sent" || out.result.ok) throw new Error("expected a not-confirmed failure");
    expect(out.result).toMatchObject({ txHash: VECTOR.cases[0].txHash, message: NOT_CONFIRMED_MESSAGE, signless: true, rejected: false });
  });

  it("sends the same signed bytes to the next RPC when one gives no answer", async () => {
    const chain = fakeChain({ onSend: (_b, url) => (url === "https://rpc-a.test" ? "transport" : undefined) });
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const out = await sendSignless({ rpc: chain.rpc, subtle, signer: await seedSigner(), accountId: ALICE, call: feed() });
    const sends = chain.sends();
    expect(sends.map((s) => s.url)).toEqual(["https://rpc-a.test", "https://rpc-b.test"]);
    expect(sends[0]!.params.signed_tx_base64).toBe(sends[1]!.params.signed_tx_base64);
    expect(out.kind === "sent" && out.result.ok).toBe(true);
  });

  it("treats an invalid answer after a lost broadcast as 'may have landed' (no fallback)", async () => {
    const chain = fakeChain({
      onSend: (_b, url) => (url === "https://rpc-a.test" ? "transport" : { error: { cause: { name: "INVALID_TRANSACTION" }, data: { TxExecutionError: { InvalidTxError: { InvalidNonce: {} } } } } }),
    });
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const out = await sendSignless({ rpc: chain.rpc, subtle, signer: await seedSigner(), accountId: ALICE, call: feed() });
    expect(out.kind === "sent" && !out.result.ok && out.result.message).toBe(NOT_CONFIRMED_MESSAGE);
    expect(chain.sends()).toHaveLength(2);
  });

  it("reports a contract panic like the wallet path does (it landed: no fallback)", async () => {
    const chain = fakeChain({
      onSend: () => ({
        result: {
          status: { Failure: { ActionError: { kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: ERR_NOT_OWNED_BY_CALLEE" } } } } },
          transaction: { hash: "panic-hash" },
          receipts_outcome: [],
        },
      }),
    });
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const out = await sendSignless({ rpc: chain.rpc, subtle, signer: await seedSigner(), accountId: ALICE, call: feed() });
    expect(out).toMatchObject({ kind: "sent", result: { ok: false, txHash: "panic-hash", message: "You can only feed a Snacc you own.", signless: true } });
  });

  it("classifies send_tx errors", () => {
    expect(classifySendError({ cause: { name: "TIMEOUT_ERROR" } })).toEqual({ included: "maybe" });
    expect(classifySendError({ data: { InvalidTxError: { InvalidAccessKeyError: { MethodNameMismatch: {} } } } })).toEqual({ included: "no", reason: "method" });
    expect(classifySendError({ data: { InvalidTxError: { InvalidAccessKeyError: { AccessKeyNotFound: {} } } } })).toEqual({ included: "no", reason: "key-missing" });
    expect(classifySendError({ cause: { name: "INVALID_TRANSACTION" } })).toEqual({ included: "no", reason: "invalid" });
    expect(classifySendError({ data: { TxExecutionError: { ActionError: {} } } })).toEqual({ included: "yes" });
    expect(classifySendError({ name: "INTERNAL_ERROR" })).toEqual({ included: "maybe" });
    // Free text such as an account id containing "timeout" no longer turns a clean refusal into "maybe".
    const refusal = {
      name: "HANDLER_ERROR",
      cause: { name: "INVALID_TRANSACTION", info: { signer_id: "timeout.testnet" } },
      message: "Server error: timed out? no",
      data: { TxExecutionError: { InvalidTxError: { InvalidAccessKeyError: { NotEnoughAllowance: { account_id: "timeout.testnet", allowance: "1", cost: "2" } } } } },
    };
    expect(classifySendError(refusal)).toEqual({ included: "no", reason: "allowance" });
    expect(classifySendError({ cause: { name: "INVALID_TRANSACTION" }, data: { signer: "timed-out.testnet" } })).toEqual({ included: "no", reason: "invalid" });
    // Old nodes: the variant name inside a `data` string, matched as a whole word.
    expect(classifySendError({ name: "HANDLER_ERROR", data: "InvalidTxError: InvalidNonce { tx_nonce: 3, ak_nonce: 9 }" })).toEqual({ included: "no", reason: "nonce" });
    expect(invalidNonceAk({ data: { TxExecutionError: { InvalidTxError: { InvalidNonce: { ak_nonce: 60, tx_nonce: 42 } } } } })).toBe(60n);
    expect(invalidNonceAk({ data: "InvalidNonce" })).toBeNull();
  });
});

// ------------------------------------------------------------------ controller

function controllerWith(
  chain: ReturnType<typeof fakeChain>,
  store = new MemoryOneTapStore(),
  extra: Partial<ConstructorParameters<typeof OneTapController>[0]> = {},
  others: OneTapStore[] = [],
) {
  const track = vi.fn();
  const controller = new OneTapController({
    network: "testnet",
    rpc: chain.rpc,
    subtle: () => subtle,
    ed25519: async () => true,
    pickStores: async () => [store, ...others],
    track,
    sleep: async () => undefined,
    now: () => 1_700_000_000_000,
    confirmPolls: 2,
    ...extra,
  });
  return { controller, store, track };
}

/**
 * A minimal in-memory IndexedDB: one database with one object store, async requests, and
 * `deleteDatabase` that fires `versionchange` on open connections and is blocked while any stays open.
 */
function fakeIdb() {
  const data = new Map<string, unknown>();
  let created = false;
  const conns: { closed: boolean; onversionchange: (() => void) | null }[] = [];
  const state = { blocked: 0 };
  const later = (fn: () => void) => setTimeout(fn, 0);
  const request = (run: () => unknown) => {
    const r: { result?: unknown; error?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
    later(() => {
      try {
        r.result = run();
        r.onsuccess?.();
      } catch (e) {
        r.error = e;
        r.onerror?.();
      }
    });
    return r;
  };
  const factory = {
    open: () => {
      const r: { result?: unknown; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void; onblocked?: () => void } = {};
      later(() => {
        const db = {
          closed: false,
          onversionchange: null as (() => void) | null,
          objectStoreNames: { contains: () => created },
          createObjectStore: () => {
            created = true;
          },
          close: () => {
            db.closed = true;
          },
          transaction: () => {
            if (db.closed) throw new Error("the connection is closed");
            return {
              objectStore: () => ({
                get: (k: string) => request(() => data.get(k)),
                put: (v: unknown, k: string) => request(() => void data.set(k, v)),
                delete: (k: string) => request(() => void data.delete(k)),
              }),
            };
          },
        };
        conns.push(db);
        r.result = db;
        if (!created) r.onupgradeneeded?.();
        r.onsuccess?.();
      });
      return r;
    },
    deleteDatabase: () => {
      const r: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {};
      later(() => {
        for (const c of conns) if (!c.closed) c.onversionchange?.();
        if (conns.some((c) => !c.closed)) {
          state.blocked++;
          r.onblocked?.();
          return;
        }
        data.clear();
        created = false;
        r.onsuccess?.();
      });
      return r;
    },
  };
  return {
    factory: factory as unknown as IDBFactory,
    data,
    conns,
    get blocked() {
      return state.blocked;
    },
  };
}

/** A record for `accountId` whose key the fake chain knows (vector seed, imported as PKCS#8). */
function recordFor(accountId: string, network = "testnet", methodNames: readonly string[] = ONE_TAP_METHODS): OneTapRecord {
  const pkcs8 = toBase64(new Uint8Array([...unhex("302e020100300506032b657004220420"), ...unhex(VECTOR.seedHex)]));
  return newRecord({ network, accountId, key: { publicKey: VECTOR.publicKey, pkcs8 }, storage: "localstorage", methodNames, allowanceYocto: ONE_TAP_ALLOWANCE_YOCTO, now: 1 });
}

/** The ten-method list an earlier build of this PR put on the key (it still allowed `adopt` and `hostile_takeover_splice`). */
const OLD_METHODS = [...ONE_TAP_METHODS, "adopt", "hostile_takeover_splice"].sort();

/** A wallet stand-in: records every transaction and applies AddKey/DeleteKey to the fake chain. */
function fakeWallet(chain: ReturnType<typeof fakeChain>, answer: (tx: WalletTx) => TxResult = () => ({ ok: true, txHash: "wallet-hash" })) {
  const txs: WalletTx[] = [];
  const send = vi.fn(async (tx: WalletTx) => {
    txs.push(tx);
    const r = answer(tx);
    if (r.ok) {
      for (const a of tx.actions) {
        if (a.type === "AddKey") chain.addFcKey(tx.signerId, a.params.publicKey, 1n);
        if (a.type === "DeleteKey") chain.keys.delete(`${tx.signerId}|${a.params.publicKey}`);
      }
    }
    return r;
  });
  return { txs, send };
}

describe("RES-111 storage scoping", () => {
  it("keeps keys per network and account id", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const store = new MemoryOneTapStore();
    await store.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    await store.put(scopeOf("mainnet", "carol.testnet"), recordFor("carol.testnet", "mainnet"));
    await store.put(scopeOf("testnet", "dave.testnet"), recordFor("eve.testnet"));
    const { controller } = controllerWith(chain, store);
    await controller.setAccount(ALICE);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "ok", allowanceYocto: ONE_TAP_ALLOWANCE_YOCTO, storage: "localstorage" });
    await controller.setAccount("bob.testnet");
    expect(controller.getSnapshot().status.kind).toBe("off");
    await controller.setAccount("carol.testnet");
    expect(controller.getSnapshot().status.kind).toBe("off");
    await controller.setAccount("dave.testnet");
    expect(controller.getSnapshot().status.kind).toBe("off");
    await controller.setAccount(null);
    expect(controller.getSnapshot().status.kind).toBe("signed-out");
  });

  it("localStorage fallback: one `snacc_one_tap` map keyed by scope, listed in Reset local data", async () => {
    const mem = new Map<string, string>();
    const ls = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const store = webStorageStore(ls);
    await store.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    await store.put(scopeOf("testnet", "bob.testnet"), recordFor("bob.testnet"));
    expect([...mem.keys()]).toEqual([ONE_TAP_LOCAL_KEY]);
    expect((await store.get(scopeOf("testnet", ALICE)))?.accountId).toBe(ALICE);
    await store.remove(scopeOf("testnet", ALICE));
    expect(await store.get(scopeOf("testnet", ALICE))).toBeNull();
    expect((await store.get(scopeOf("testnet", "bob.testnet")))?.accountId).toBe("bob.testnet");
    await store.remove(scopeOf("testnet", "bob.testnet"));
    expect(mem.size).toBe(0);
    expect(APP_LOCAL_KEYS).toContain(ONE_TAP_LOCAL_KEY);
    const kinds = (stores: OneTapStore[]) => stores.map((s) => s.kind);
    expect(kinds(await pickOneTapStores({ indexedDB: null, localStorage: ls, subtle }))).toEqual(["localstorage"]);
    expect(await pickOneTapStores({ indexedDB: null, localStorage: null, subtle })).toEqual([]);
    // IndexedDB that fails the probe: new keys go to localStorage, IndexedDB stays searchable (last).
    const brokenIdb = { open: () => { throw new Error("blocked"); } } as unknown as IDBFactory;
    expect(kinds(await pickOneTapStores({ indexedDB: brokenIdb, localStorage: ls, subtle }))).toEqual(["localstorage", "indexeddb"]);
    expect(await pickOneTapStores({ indexedDB: brokenIdb, localStorage: null, subtle })).toEqual([]);
    // A working IndexedDB (fake): it comes first, localStorage is still searched.
    expect(kinds(await pickOneTapStores({ indexedDB: fakeIdb().factory, localStorage: ls, subtle }))).toEqual(["indexeddb", "localstorage"]);
  });

  it("closes the key database on versionchange so Reset local data can delete it (finding: blocked delete)", async () => {
    const idb = fakeIdb();
    const store = indexedDbStore(idb.factory);
    await store.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    expect(idb.data.size).toBe(1);
    expect(idb.conns.filter((c) => !c.closed)).toHaveLength(1);
    // Another connection (another tab) that never closes by itself would block; ours closes on versionchange.
    await wipeOneTapDevice({ indexedDB: idb.factory, localStorage: null });
    expect(idb.blocked).toBe(0);
    expect(idb.data.size).toBe(0);
    expect(idb.conns.every((c) => c.closed)).toBe(true);
    // And `close()` lets go of the connection directly; the store reopens on the next use.
    await store.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    store.close?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(idb.conns.every((c) => c.closed)).toBe(true);
    expect((await store.get(scopeOf("testnet", ALICE)))?.accountId).toBe(ALICE);
  });

  it("makes non-extractable keys for IndexedDB and PKCS#8 bytes only for the fallback", async () => {
    const idbKey = await generateOneTapKey("indexeddb", subtle);
    expect(idbKey.privateKey?.extractable).toBe(false);
    expect(idbKey.pkcs8).toBeUndefined();
    const lsKey = await generateOneTapKey("localstorage", subtle);
    expect(lsKey.privateKey).toBeUndefined();
    const rec = newRecord({ network: "testnet", accountId: ALICE, key: lsKey, storage: "localstorage", methodNames: ONE_TAP_METHODS, allowanceYocto: "1", now: 1 });
    const signer = await signerFromRecord(rec, subtle);
    const msg = new Uint8Array([9, 9, 9]);
    const pub = await subtle.importKey("raw", base58Decode(lsKey.publicKey.slice(8)) as BufferSource, { name: "Ed25519" }, true, ["verify"]);
    expect(await subtle.verify({ name: "Ed25519" }, pub, (await signer.sign(msg)) as BufferSource, msg)).toBe(true);
  });

  it("says when this browser has no Ed25519 in Web Crypto", async () => {
    const { controller } = controllerWith(fakeChain(), new MemoryOneTapStore(), { ed25519: async () => false });
    await controller.setAccount(ALICE);
    expect(controller.getSnapshot().status).toEqual({ kind: "unsupported", reason: "this browser cannot sign with Ed25519 in Web Crypto." });
    const r = await controller.enable(vi.fn());
    expect(r.ok).toBe(false);
  });
});

describe("RES-111 enable / disable / forget", () => {
  it("turns on with ONE wallet transaction: AddKey to your own account, in the allowlisted form", async () => {
    const chain = fakeChain();
    const { controller, store } = controllerWith(chain);
    await controller.setAccount(ALICE);
    expect(controller.getSnapshot().status.kind).toBe("off");
    const wallet = fakeWallet(chain);
    const r = await controller.enable(wallet.send);
    expect(r.ok).toBe(true);
    expect(wallet.txs).toHaveLength(1);
    const tx = wallet.txs[0]!;
    expect(tx.signerId).toBe(ALICE);
    expect(tx.receiverId).toBe(ALICE);
    expect(tx.actions).toHaveLength(1);
    expect(checkWalletTx(tx, { signerId: ALICE, receivers: SIGNABLE_RECEIVERS, deletableKey: null })).toBeNull();
    const rec = await store.get(scopeOf("testnet", ALICE));
    expect(rec?.publicKey).toBe((tx.actions[0] as ReturnType<typeof buildAddKeyAction>).params.publicKey);
    expect(rec?.privateKey?.extractable).toBe(false);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "ok", publicKey: rec?.publicKey });
    expect(controller.deletableKey()).toBe(rec?.publicKey);
  });

  it("stores nothing when the wallet request is rejected", async () => {
    const chain = fakeChain();
    const { controller, store } = controllerWith(chain);
    await controller.setAccount(ALICE);
    const wallet = fakeWallet(chain, () => ({ ok: false, txHash: null, message: "closed", raw: "User rejected", rejected: true }));
    const r = await controller.enable(wallet.send);
    expect(r.ok).toBe(false);
    expect(store.map.size).toBe(0);
    expect(controller.getSnapshot()).toMatchObject({ status: { kind: "off" }, error: null, busy: null });
  });

  it("turns off with a DeleteKey of that key, after checking on chain it is the game's function-call key", async () => {
    const chain = fakeChain();
    const { controller, store } = controllerWith(chain);
    await controller.setAccount(ALICE);
    const wallet = fakeWallet(chain);
    await controller.enable(wallet.send);
    const pk = controller.deletableKey()!;
    const r = await controller.disable(wallet.send);
    expect(r.ok).toBe(true);
    expect(wallet.txs[1]).toEqual({ signerId: ALICE, receiverId: ALICE, actions: [{ type: "DeleteKey", params: { publicKey: pk } }] });
    expect(store.map.size).toBe(0);
    expect(controller.getSnapshot().status.kind).toBe("off");
  });

  it("does not ask the wallet to delete a key that is gone, or one that is not a one-tap key", async () => {
    const chain = fakeChain();
    const store = new MemoryOneTapStore();
    await store.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    const { controller } = controllerWith(chain, store);
    await controller.setAccount(ALICE);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "missing" });
    const wallet = fakeWallet(chain);
    const gone = await controller.disable(wallet.send);
    expect(gone).toMatchObject({ ok: true, txHash: null });
    expect(wallet.send).not.toHaveBeenCalled();
    expect(store.map.size).toBe(0);

    await store.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    chain.keys.set(`${ALICE}|${VECTOR.publicKey}`, { nonce: 1n, permission: "FullAccess" });
    await controller.setAccount(null);
    await controller.setAccount(ALICE);
    const full = await controller.disable(wallet.send);
    expect(full.ok).toBe(false);
    expect(wallet.send).not.toHaveBeenCalled();
    expect(store.map.size).toBe(1);
  });

  it("forget only wipes this browser", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const store = new MemoryOneTapStore();
    await store.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    const { controller } = controllerWith(chain, store);
    await controller.setAccount(ALICE);
    const before = chain.log.length;
    await controller.forget();
    expect(store.map.size).toBe(0);
    expect(chain.log.length).toBe(before);
    expect(chain.keys.size).toBe(1);
    expect(controller.getSnapshot().status.kind).toBe("off");
  });
});

describe("RES-111 routing: one-tap first, the wallet at most once", () => {
  async function onFor(chain: ReturnType<typeof fakeChain>) {
    const store = new MemoryOneTapStore();
    await store.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    const ctl = controllerWith(chain, store);
    await ctl.controller.setAccount(ALICE);
    return ctl;
  }
  const walletOk = () => vi.fn(async (): Promise<TxResult> => ({ ok: true, txHash: "wallet-hash" }));

  it("sends a deposit-free call signless and never calls the wallet", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const { controller, track } = await onFor(chain);
    expect(controller.covers([feed()])).toBe(true);
    const wallet = walletOk();
    const r = await sendWithOneTap(controller, ALICE, [feed()], CONTRACT_ID, wallet);
    expect(r).toMatchObject({ ok: true, signless: true, txHash: "hash-42" });
    expect(wallet).not.toHaveBeenCalled();
    expect(track.mock.calls).toEqual([
      ["tx_submitted", { method: "feed_strain", signless: true }],
      ["tx_succeeded", { method: "feed_strain", rejected: false, signless: true }],
    ]);
    for (const [, props] of track.mock.calls) expect(JSON.stringify(props)).not.toContain(ALICE);
  });

  it("serialises parallel sends so nonces do not clash", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const { controller } = await onFor(chain);
    await Promise.all([sendWithOneTap(controller, ALICE, [feed()], CONTRACT_ID, walletOk()), sendWithOneTap(controller, ALICE, [feed()], CONTRACT_ID, walletOk())]);
    expect(chain.sends().map((s) => decodeSigned(String(s.params.signed_tx_base64)).nonce)).toEqual([42n, 43n]);
  });

  it("uses the wallet without a notice for deposit calls, storage batches, the market, or when one-tap is off", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const { controller } = await onFor(chain);
    const extract = buildExtract({ strainId: 1, sporeType: "mt:spore-ignis", feeYocto: "1000000000000000000000" });
    const cases: [ContractCall[], string][] = [
      [[extract], CONTRACT_ID],
      [[buildStorageDeposit({ accountId: ALICE, minYocto: "1" }), feed()], CONTRACT_ID],
      [[feed()], MARKET_ID],
    ];
    for (const [calls, receiver] of cases) {
      const wallet = walletOk();
      const r = await sendWithOneTap(controller, ALICE, calls, receiver, wallet);
      expect(wallet).toHaveBeenCalledTimes(1);
      expect(r.notice).toBeUndefined();
      expect(r.signless).toBeUndefined();
    }
    const off = controllerWith(chain).controller;
    await off.setAccount(ALICE);
    const wallet = walletOk();
    await sendWithOneTap(off, ALICE, [feed()], CONTRACT_ID, wallet);
    expect(wallet).toHaveBeenCalledTimes(1);
    expect(chain.sends()).toHaveLength(0);
  });

  it("falls back to the wallet once, with a one-line notice, when the key was revoked on chain", async () => {
    const chain = fakeChain();
    const { controller, track } = await onFor(chain);
    const wallet = walletOk();
    const r = await sendWithOneTap(controller, ALICE, [feed()], CONTRACT_ID, wallet);
    expect(wallet).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ ok: true, txHash: "wallet-hash", notice: FALLBACK_NOTICE["key-missing"] });
    expect(chain.sends()).toHaveLength(0);
    expect(track).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "missing" });
    expect(controller.covers([feed()])).toBe(false);
  });

  it("falls back once after an allowance error from send_tx, and counts the failed signless try", async () => {
    const chain = fakeChain({ onSend: () => ({ error: { cause: { name: "INVALID_TRANSACTION" }, data: { TxExecutionError: { InvalidTxError: { InvalidAccessKeyError: { NotEnoughAllowance: {} } } } } } }) });
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const { controller, track } = await onFor(chain);
    const wallet = walletOk();
    const r = await sendWithOneTap(controller, ALICE, [feed()], CONTRACT_ID, wallet);
    expect(wallet).toHaveBeenCalledTimes(1);
    expect(r.notice).toBe(FALLBACK_NOTICE.allowance);
    expect(track.mock.calls).toEqual([
      ["tx_submitted", { method: "feed_strain", signless: true }],
      ["tx_failed", { method: "feed_strain", rejected: false, signless: true }],
    ]);
  });

  it("does not call the wallet when the signless tx may have landed (timeout)", async () => {
    const chain = fakeChain({ onSend: () => ({ error: { cause: { name: "TIMEOUT_ERROR" } } }) });
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const { controller } = await onFor(chain);
    const wallet = walletOk();
    const r = await sendWithOneTap(controller, ALICE, [feed()], CONTRACT_ID, wallet);
    expect(wallet).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: false, message: NOT_CONFIRMED_MESSAGE, signless: true });
    expect(r.txHash).toBeTruthy();
  });
});

// ------------------------------------------------------------------ review fixes

const BOB = "bob.testnet";

/** A controller with ALICE's current record loaded (vector key). */
async function aliceOn(chain: ReturnType<typeof fakeChain>, methodNames: readonly string[] = ONE_TAP_METHODS) {
  const store = new MemoryOneTapStore();
  await store.put(scopeOf("testnet", ALICE), recordFor(ALICE, "testnet", methodNames));
  const ctl = controllerWith(chain, store);
  await ctl.controller.setAccount(ALICE);
  return ctl;
}

/** A Web Crypto whose first `importKey` waits for `release()` (to hold a key load mid-way). */
function gatedSubtle() {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let first = true;
  const wrapped = new Proxy(subtle, {
    get(target, prop) {
      if (prop === "importKey") {
        return async (...args: Parameters<SubtleCrypto["importKey"]>) => {
          if (first) {
            first = false;
            await gate;
          }
          return (target.importKey as (...a: unknown[]) => Promise<CryptoKey>).apply(target, args);
        };
      }
      const v = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  }) as SubtleCrypto;
  return { subtle: wrapped, release: () => release() };
}

describe("RES-111 review: keys that still allow adopt / hostile_takeover_splice", () => {
  it("treats such a key as outdated: never used, the wallet signs with a notice, adopt is never one-tap", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey, 41n, ONE_TAP_ALLOWANCE_YOCTO, OLD_METHODS);
    const { controller } = await aliceOn(chain, OLD_METHODS);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "ok", outdated: true });
    expect(controller.covers([feed()])).toBe(false);
    const wallet = vi.fn(async (): Promise<TxResult> => ({ ok: true, txHash: "wallet-hash" }));
    const r = await sendWithOneTap(controller, ALICE, [feed()], CONTRACT_ID, wallet);
    expect(r.notice).toBe(FALLBACK_NOTICE.outdated);
    const adopt = buildAdopt({ targetId: 2, raiderStrainId: 1, expectedTargetNonce: 3 });
    const takeover = buildHostileTakeover({ raiderStrainId: 1, distressedTargetId: 2, expectedTargetNonce: 3 });
    for (const c of [adopt, takeover]) {
      const out = await sendWithOneTap(controller, ALICE, [c], CONTRACT_ID, wallet);
      expect(out.notice).toBeUndefined();
    }
    expect(wallet).toHaveBeenCalledTimes(3);
    expect(chain.sends()).toHaveLength(0);
  });

  it("marks a key outdated when only the chain's method list is the old one", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey, 41n, ONE_TAP_ALLOWANCE_YOCTO, OLD_METHODS);
    const { controller } = await aliceOn(chain);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "ok", outdated: true });
    const r = await sendWithOneTap(controller, ALICE, [feed()], CONTRACT_ID, async () => ({ ok: true, txHash: "w" }));
    expect(r.notice).toBe(FALLBACK_NOTICE.outdated);
    expect(chain.sends()).toHaveLength(0);
  });

  it("replaces it: DeleteKey of the old key, then AddKey with the eight methods, both allowlisted", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey, 41n, ONE_TAP_ALLOWANCE_YOCTO, OLD_METHODS);
    const { controller, store } = await aliceOn(chain, OLD_METHODS);
    const wallet = fakeWallet(chain);
    const r = await controller.replace(wallet.send);
    expect(r.ok).toBe(true);
    expect(wallet.txs.map((t) => t.actions[0]!.type)).toEqual(["DeleteKey", "AddKey"]);
    expect(checkWalletTx(wallet.txs[0]!, { signerId: ALICE, receivers: SIGNABLE_RECEIVERS, deletableKey: VECTOR.publicKey })).toBeNull();
    expect(checkWalletTx(wallet.txs[1]!, { signerId: ALICE, receivers: SIGNABLE_RECEIVERS, deletableKey: null })).toBeNull();
    const added = wallet.txs[1]!.actions[0] as ReturnType<typeof buildAddKeyAction>;
    expect((added.params.accessKey.permission as { methodNames: string[] }).methodNames).toEqual([...ONE_TAP_METHODS]);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "ok", outdated: false });
    const rec = await store.get(scopeOf("testnet", ALICE));
    expect(rec && isCurrentMethodList(rec.methodNames)).toBe(true);
    expect(chain.keys.has(`${ALICE}|${VECTOR.publicKey}`)).toBe(false);
  });
});

describe("RES-111 review: account switches never mix keys or leave the controller busy", () => {
  it("does not serve the old account's key after a switch during key loading (signer race)", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const bobKey = await generateOneTapKey("localstorage", subtle);
    chain.addFcKey(BOB, bobKey.publicKey);
    const store = new MemoryOneTapStore();
    await store.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    await store.put(
      scopeOf("testnet", BOB),
      newRecord({ network: "testnet", accountId: BOB, key: bobKey, storage: "localstorage", methodNames: ONE_TAP_METHODS, allowanceYocto: ONE_TAP_ALLOWANCE_YOCTO, now: 1 }),
    );
    const gated = gatedSubtle();
    const { controller } = controllerWith(chain, store, { subtle: () => gated.subtle });
    await controller.setAccount(ALICE);
    const aliceSend = controller.trySend(ALICE, [feed()], CONTRACT_ID);
    await new Promise((r) => setTimeout(r, 0)); // Alice's send now waits inside importKey
    await controller.setAccount(BOB);
    gated.release();
    expect(await aliceSend).toEqual({ kind: "skip" });
    expect(chain.sends()).toHaveLength(0);
    const bobSend = await controller.trySend(BOB, [feed()], CONTRACT_ID);
    expect(bobSend.kind).toBe("sent");
    const sent = chain.sends().map((s) => decodeSigned(String(s.params.signed_tx_base64)));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ signerId: BOB, publicKey: bobKey.publicKey });
    expect(controller.getSnapshot()).toMatchObject({ accountId: BOB, status: { kind: "on", chain: "ok", publicKey: bobKey.publicKey } });
  });

  it("ends idle when the account changes while the AddKey popup is open", async () => {
    const chain = fakeChain();
    const { controller, store } = controllerWith(chain);
    await controller.setAccount(ALICE);
    const wallet = fakeWallet(chain);
    const switchDuringPopup = vi.fn(async (tx: WalletTx) => {
      await controller.setAccount(BOB);
      return wallet.send(tx);
    });
    const r = await controller.enable(switchDuringPopup);
    expect(r.ok).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ accountId: BOB, busy: null, status: { kind: "off" } });
    // Not stuck on "busy": Bob can turn it on right away.
    const again = await controller.enable(wallet.send);
    expect(again.ok).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ busy: null, status: { kind: "on", chain: "ok" } });
    // Alice's key reached the chain and was kept for Alice.
    expect(await store.get(scopeOf("testnet", ALICE))).not.toBeNull();
    await controller.setAccount(ALICE);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "ok" });
  });
});

describe("RES-111 review: the wallet status switches when one-tap falls back", () => {
  it("runSend goes pending (one-tap) → pending (wallet) → done when the wallet is asked after all", async () => {
    const phases: TxPhase[] = [];
    const wallet = {
      signAndSend: vi.fn(async (_calls: ContractCall[], _receiver?: string, opts?: { onWalletPrompt?: () => void }): Promise<TxResult> => {
        opts?.onWalletPrompt?.();
        return { ok: true, txHash: "w" };
      }),
    };
    await runSend(wallet, [feed()], true, (p) => phases.push(p));
    expect(phases).toEqual([{ kind: "pending", oneTap: true }, { kind: "pending", oneTap: false }, { kind: "done", result: { ok: true, txHash: "w" } }]);
  });

  it("sendWithOneTap calls onWallet right before the wallet on a fallback, and never on a one-tap send", async () => {
    const order: string[] = [];
    const walletSend = async (): Promise<TxResult> => {
      order.push("wallet");
      return { ok: true, txHash: "w" };
    };
    const missing = await aliceOn(fakeChain());
    await sendWithOneTap(missing.controller, ALICE, [feed()], CONTRACT_ID, walletSend, { onWallet: () => order.push("onWallet") });
    expect(order).toEqual(["onWallet", "wallet"]);
    order.length = 0;
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const on = await aliceOn(chain);
    const r = await sendWithOneTap(on.controller, ALICE, [feed()], CONTRACT_ID, walletSend, { onWallet: () => order.push("onWallet") });
    expect(r.signless).toBe(true);
    expect(order).toEqual([]);
  });
});

describe("RES-111 review: a wallet error after the AddKey may have landed", () => {
  const walletError: TxResult = { ok: false, txHash: null, message: "The transaction did not go through.", raw: "RPC timeout", rejected: false };

  it("keeps the key when it is on the account after all", async () => {
    const chain = fakeChain();
    const { controller, store } = controllerWith(chain);
    await controller.setAccount(ALICE);
    const landedThenErrored = vi.fn(async (tx: WalletTx) => {
      chain.addFcKey(ALICE, (tx.actions[0] as ReturnType<typeof buildAddKeyAction>).params.publicKey, 1n);
      return walletError;
    });
    const r = await controller.enable(landedThenErrored);
    expect(r.ok).toBe(false);
    const rec = await store.get(scopeOf("testnet", ALICE));
    expect(rec).not.toBeNull();
    expect(controller.deletableKey()).toBe(rec?.publicKey);
    expect(controller.getSnapshot()).toMatchObject({ busy: null, error: null, status: { kind: "on", chain: "ok", outdated: false } });
  });

  it("removes it only when the key is really not there, and right away after a rejection", async () => {
    const chain = fakeChain();
    const { controller, store } = controllerWith(chain);
    await controller.setAccount(ALICE);
    const r = await controller.enable(async () => walletError);
    expect(r.ok).toBe(false);
    expect(store.map.size).toBe(0);
    expect(controller.getSnapshot()).toMatchObject({ busy: null, status: { kind: "off" }, error: walletError.message });
    const before = chain.log.length;
    const rejected = await controller.enable(async () => ({ ok: false, txHash: null, message: "closed", raw: "User rejected", rejected: true }));
    expect(rejected.ok).toBe(false);
    expect(store.map.size).toBe(0);
    expect(chain.log.length).toBe(before);
    expect(controller.getSnapshot()).toMatchObject({ busy: null, error: null, status: { kind: "off" } });
  });
});

describe("RES-111 review: keys kept in the other store", () => {
  /** A store whose first read fails (IndexedDB hiccup), later reads work. */
  function flakyStore(kind: "indexeddb" | "localstorage"): MemoryOneTapStore {
    const s = new MemoryOneTapStore(kind);
    const get = s.get.bind(s);
    let failed = false;
    s.get = async (scope: string) => {
      if (!failed) {
        failed = true;
        throw new Error("transient");
      }
      return get(scope);
    };
    return s;
  }

  it("loads a key from the second store and refuses to add a second key while it is on the account", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const primary = new MemoryOneTapStore("indexeddb");
    const other = new MemoryOneTapStore("localstorage");
    await other.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    const { controller } = controllerWith(chain, primary, {}, [other]);
    await controller.setAccount(ALICE);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "ok", storage: "localstorage" });
    const wallet = fakeWallet(chain);
    const r = await controller.enable(wallet.send);
    expect(r.ok).toBe(false);
    expect(wallet.send).not.toHaveBeenCalled();
    expect(primary.map.size).toBe(0);
    await controller.forget();
    expect(other.map.size).toBe(0);
  });

  it("finds it at enable time even when the first read failed, so no second key is added", async () => {
    const chain = fakeChain();
    chain.addFcKey(ALICE, VECTOR.publicKey);
    const primary = new MemoryOneTapStore("localstorage");
    const other = flakyStore("indexeddb");
    await other.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    const { controller } = controllerWith(chain, primary, {}, [other]);
    await controller.setAccount(ALICE);
    expect(controller.getSnapshot().status.kind).toBe("off");
    const wallet = fakeWallet(chain);
    const r = await controller.enable(wallet.send);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.message).toMatch(/already has a one-tap key/);
    expect(wallet.send).not.toHaveBeenCalled();
    expect(primary.map.size).toBe(0);
  });

  it("cleans a stale key (gone from the account) out of the other store before adding the new one", async () => {
    const chain = fakeChain();
    const primary = new MemoryOneTapStore("indexeddb");
    const other = new MemoryOneTapStore("localstorage");
    await other.put(scopeOf("testnet", ALICE), recordFor(ALICE));
    const { controller } = controllerWith(chain, primary, {}, [other]);
    await controller.setAccount(ALICE);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "missing" });
    const wallet = fakeWallet(chain);
    const r = await controller.enable(wallet.send);
    expect(r.ok).toBe(true);
    expect(wallet.txs).toHaveLength(1);
    expect(other.map.size).toBe(0);
    expect(primary.map.size).toBe(1);
    expect(controller.getSnapshot().status).toMatchObject({ kind: "on", chain: "ok", storage: "indexeddb" });
  });
});

// ------------------------------------------------------------------ UI copy

function handleWith(snapshot: OneTapSnapshot): OneTapHandle {
  return { ...NO_ONE_TAP, getSnapshot: () => snapshot };
}
const connected: WalletApi = { ...DISCONNECTED_WALLET, status: "connected", accountId: ALICE, walletName: "Meteor Wallet" };
const onSnapshot: OneTapSnapshot = {
  accountId: ALICE,
  status: { kind: "on", publicKey: VECTOR.publicKey, storage: "indexeddb", allowanceYocto: "200000000000000000000000", chain: "ok", outdated: false, createdAt: 1 },
  busy: null,
  error: null,
  message: null,
};
const withProviders = (snapshot: OneTapSnapshot, node: ReactNode) => (
  <WalletContext.Provider value={connected}>
    <OneTapContext.Provider value={handleWith(snapshot)}>{node}</OneTapContext.Provider>
  </WalletContext.Provider>
);

describe("RES-111 Settings copy and status lines", () => {
  it("explains the actions, what stays in the wallet, the allowance, where the key lives and the honest status", () => {
    const html = renderToStaticMarkup(<OneTapSettings />);
    expect(html).toContain("One-tap play");
    expect(html).toContain("Connect a wallet to turn on one-tap play.");
    for (const m of ONE_TAP_METHODS) expect(html).toContain(`<code>${m}</code>`);
    for (const m of WALLET_ONLY_METHODS) expect(html).toContain(`<code>${m}</code>`);
    expect(html).toContain("at most 0.25 NEAR of gas");
    expect(html).toContain("never sent anywhere");
    expect(html).toContain("not yet tried with");
    expect(html).toContain("Disconnecting the wallet does not remove the key");
    for (const m of PAYS_OTHER_METHODS) expect(html).toContain(`<code>${m}</code>`);
    expect(html).toContain("One-tap actions (8)");
    expect(html).not.toContain('data-testid="one-tap-enable"');
  });

  it("offers turn on when off, and turn off / forget with the remaining allowance when on", () => {
    const off = renderToStaticMarkup(withProviders({ ...onSnapshot, status: { kind: "off" } }, <OneTapSettings />));
    expect(off).toContain('data-testid="one-tap-enable"');
    expect(off).toContain("1 wallet popup");
    const on = renderToStaticMarkup(withProviders(onSnapshot, <OneTapSettings />));
    expect(on).toContain('data-testid="one-tap-disable"');
    expect(on).toContain('data-testid="one-tap-forget"');
    expect(on).toContain("allowance left 0.2 NEAR");
    expect(on).toContain("non-exportable");
    const missing = renderToStaticMarkup(withProviders({ ...onSnapshot, status: { ...onSnapshot.status, chain: "missing" } as OneTapSnapshot["status"] }, <OneTapSettings />));
    expect(missing).toContain('data-testid="one-tap-missing"');
    expect(missing).not.toContain('data-testid="one-tap-disable"');
    const outdatedSnap = { ...onSnapshot, status: { ...onSnapshot.status, outdated: true } as OneTapSnapshot["status"] };
    const outdated = renderToStaticMarkup(withProviders(outdatedSnap, <OneTapSettings />));
    expect(outdated).toContain('data-testid="one-tap-outdated"');
    expect(outdated).toContain('data-testid="one-tap-replace"');
    expect(outdated).toContain("2 wallet popups");
    expect(renderToStaticMarkup(withProviders(outdatedSnap, <WalletControl wallet={connected} info={EMPTY_ACCOUNT_INFO} />))).not.toContain("one-tap on");
    expect(on).not.toContain('data-testid="one-tap-replace"');
    const unsupported = renderToStaticMarkup(withProviders({ ...onSnapshot, status: { kind: "unsupported", reason: "no Ed25519." } }, <OneTapSettings />));
    expect(unsupported).toContain("One-tap play is not available in this browser: no Ed25519.");
  });

  it("shows the one-tap state in the wallet chip, the footer and the tx status", () => {
    expect(renderToStaticMarkup(<WalletControl wallet={connected} info={EMPTY_ACCOUNT_INFO} />)).not.toContain("one-tap on");
    expect(renderToStaticMarkup(withProviders(onSnapshot, <WalletControl wallet={connected} info={EMPTY_ACCOUNT_INFO} />))).toContain("one-tap on");
    expect(renderToStaticMarkup(<Footer />)).toContain("every call is signed in your wallet");
    expect(renderToStaticMarkup(withProviders(onSnapshot, <Footer />))).toContain("deposit-free calls are signed by your one-tap key");
    expect(renderToStaticMarkup(<TxStatusView phase={{ kind: "pending", oneTap: true }} />)).toContain("Sending with one-tap play.");
    expect(renderToStaticMarkup(<TxStatusView phase={{ kind: "pending" }} />)).toContain("Waiting for your wallet.");
    expect(renderToStaticMarkup(<TxStatusView phase={{ kind: "done", result: { ok: true, txHash: "abc", signless: true } }} />)).toContain("Done on testnet with one-tap play.");
    const fellBack = renderToStaticMarkup(<TxStatusView phase={{ kind: "done", result: { ok: true, txHash: "abc", notice: FALLBACK_NOTICE.allowance } }} />);
    expect(fellBack).toContain('data-testid="tx-notice"');
    expect(fellBack).toContain("allowance is used up");
  });

  it("describes the AddKey and DeleteKey requests on the email-login signing page", () => {
    const add = describePayload({ kind: "signAndSendTransaction", receiverId: ALICE, actions: [buildAddKeyAction(VECTOR.publicKey)] });
    expect(add).toEqual([`add a limited key for ${CONTRACT_ID} (8 methods, gas allowance 0.25 NEAR) on ${ALICE}`]);
    const del = describePayload({ kind: "signAndSendTransaction", receiverId: ALICE, actions: [buildDeleteKeyAction(VECTOR.publicKey)] });
    expect(del).toEqual([`delete the key ${VECTOR.publicKey} on ${ALICE}`]);
  });
});
