/**
 * RES-111 one-tap play state for the connected account, framework-free so it is tested without a
 * DOM, plus the React context (`useOneTap`) the Settings section, the wallet chip and the action
 * windows read. `WalletProvider` owns one controller and routes every `signAndSend` through
 * `sendWithOneTap` first.
 *
 * Every await is followed by a check that the record it started with is still the current one, so
 * an account switch in the middle of a send, a refresh or a wallet popup never writes one
 * account's key or status into another's view. Signers are cached by their own public key.
 */
import { createContext, useContext, useSyncExternalStore } from "react";
import { CONTRACT_ID, type ContractCall } from "./actions.ts";
import {
  FALLBACK_NOTICE,
  ONE_TAP_ALLOWANCE_YOCTO,
  ONE_TAP_METHODS,
  buildAddKeyAction,
  buildDeleteKeyAction,
  isCurrentMethodList,
  readAccessKey,
  sendSignless,
  signlessCall,
  type AccessKeyRead,
  type OneTapRpc,
  type OneTapSigner,
  type WalletTx,
} from "./oneTap.ts";
import { generateOneTapKey, newRecord, scopeOf, signerFromRecord, wipeOneTapDevice, type KeyStorageKind, type OneTapRecord, type OneTapStore } from "./oneTapKeys.ts";
import { readThrown, type TxFailure, type TxResult } from "./txResult.ts";
import { appStorage } from "../prefs/prefs.ts";

export type OneTapStatus =
  | { kind: "signed-out" }
  | { kind: "loading" }
  | { kind: "unsupported"; reason: string }
  | { kind: "off" }
  | {
      kind: "on";
      publicKey: string;
      storage: KeyStorageKind;
      /** Remaining allowance read from the chain (yocto); null = unlimited or not read yet. */
      allowanceYocto: string | null;
      /** `ok` = the key is on the account; `missing` = it is not (deleted elsewhere); `unknown` = not checked yet. */
      chain: "ok" | "missing" | "unknown";
      /**
       * True when the key is not this version's: its method list (here or on chain) differs from
       * `ONE_TAP_METHODS`, e.g. an older key that still allows `adopt`. It is never used; Settings
       * offers to replace it.
       */
      outdated: boolean;
      createdAt: number;
    };

export interface OneTapSnapshot {
  accountId: string | null;
  status: OneTapStatus;
  busy: "enabling" | "disabling" | null;
  /** Last problem, plain text. */
  error: string | null;
  /** Last neutral message (e.g. "forgot the key on this device"). */
  message: string | null;
}

export type WalletTxSender = (tx: WalletTx) => Promise<TxResult>;
type TrackFn = (name: "tx_submitted" | "tx_succeeded" | "tx_failed", props: Record<string, string | number | boolean>) => void;

export interface OneTapDeps {
  network: string;
  rpc: OneTapRpc;
  /** Web Crypto, or null when the page has none. */
  subtle: () => SubtleCrypto | null;
  /** Where keys live in this browser, picked once: the first is where new keys go, all are searched. Empty = nowhere. */
  pickStores: (subtle: SubtleCrypto) => Promise<OneTapStore[]>;
  /** Whether Ed25519 works in this browser's Web Crypto. */
  ed25519: (subtle: SubtleCrypto) => Promise<boolean>;
  track?: TrackFn;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Polls after `AddKey` until the key is visible on chain. */
  confirmPolls?: number;
}

type Support = { ok: true; stores: OneTapStore[]; subtle: SubtleCrypto } | { ok: false; reason: string };

export type TrySend = { kind: "skip" } | { kind: "fallback"; notice: string } | { kind: "sent"; result: TxResult };

const failure = (message: string, raw = message): TxFailure => ({ ok: false, txHash: null, message, raw, rejected: false });

type KeyCheck = { kind: "found"; read: Extract<AccessKeyRead, { kind: "found" }> } | { kind: "missing" } | { kind: "unknown" };

export class OneTapController {
  private snap: OneTapSnapshot = { accountId: null, status: { kind: "signed-out" }, busy: null, error: null, message: null };
  private readonly listeners = new Set<() => void>();
  private record: OneTapRecord | null = null;
  /** Signers by their own public key: a late write can only ever serve that same key. */
  private readonly signers = new Map<string, OneTapSigner>();
  private readonly lastNonce = new Map<string, bigint>();
  private queue: Promise<unknown> = Promise.resolve();
  private supportP: Promise<Support> | null = null;
  private seq = 0;

  constructor(private readonly deps: OneTapDeps) {}

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getSnapshot = () => this.snap;

  private set(patch: Partial<OneTapSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const cb of this.listeners) cb();
  }

  private support(): Promise<Support> {
    this.supportP ??= (async (): Promise<Support> => {
      const subtle = this.deps.subtle();
      if (!subtle) return { ok: false, reason: "this browser has no Web Crypto." };
      if (!(await this.deps.ed25519(subtle))) return { ok: false, reason: "this browser cannot sign with Ed25519 in Web Crypto." };
      const stores = await this.deps.pickStores(subtle).catch(() => []);
      if (stores.length === 0) return { ok: false, reason: "this browser blocks site storage (IndexedDB and localStorage)." };
      return { ok: true, stores, subtle };
    })();
    return this.supportP;
  }

  private scope(accountId: string) {
    return scopeOf(this.deps.network, accountId);
  }

  private onStatus(rec: OneTapRecord, chain: "ok" | "missing" | "unknown", allowanceYocto: string | null, chainCurrent = true): OneTapStatus {
    const outdated = !isCurrentMethodList(rec.methodNames) || rec.contractId !== CONTRACT_ID || !chainCurrent;
    return { kind: "on", publicKey: rec.publicKey, storage: rec.storage, allowanceYocto, chain, outdated, createdAt: rec.createdAt };
  }

  /** The status for a record after an on-chain read. */
  private statusFromRead(rec: OneTapRecord, read: AccessKeyRead): OneTapStatus | null {
    if (read.kind === "missing") return this.onStatus(rec, "missing", null);
    if (read.kind !== "found") return null;
    const p = read.permission;
    const fc = p.kind === "FunctionCall";
    const chainCurrent = fc && p.receiverId === CONTRACT_ID && isCurrentMethodList(p.methodNames);
    return this.onStatus(rec, "ok", fc && p.allowance !== null ? p.allowance.toString() : null, chainCurrent);
  }

  /** The first record for `accountId` in any store (the new-key store first). */
  private async findRecord(stores: readonly OneTapStore[], accountId: string): Promise<OneTapRecord | null> {
    for (const s of stores) {
      const rec = await s.get(this.scope(accountId)).catch(() => null);
      if (rec && rec.accountId === accountId && rec.network === this.deps.network) return rec;
    }
    return null;
  }

  /** Removes the record for `accountId` holding `publicKey` from every store (another key there is left alone). */
  private async removeEverywhere(stores: readonly OneTapStore[], accountId: string, publicKey: string): Promise<void> {
    const scope = this.scope(accountId);
    for (const s of stores) {
      const rec = await s.get(scope).catch(() => null);
      if (rec?.publicKey === publicKey) await s.remove(scope).catch(() => undefined);
    }
  }

  /** Reads the key on chain up to `confirmPolls` times until it shows up. */
  private async waitForKey(accountId: string, publicKey: string): Promise<KeyCheck> {
    let sawMissing = false;
    const polls = Math.max(1, this.deps.confirmPolls ?? 6);
    for (let i = 0; i < polls; i++) {
      const read = await readAccessKey(this.deps.rpc, accountId, publicKey);
      if (read.kind === "found") return { kind: "found", read };
      if (read.kind === "missing") sawMissing = true;
      if (i < polls - 1) await (this.deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(1000);
    }
    return sawMissing ? { kind: "missing" } : { kind: "unknown" };
  }

  /** Follows the connected account: loads its key (from any store) and checks it on chain. */
  async setAccount(accountId: string | null): Promise<void> {
    if (accountId === this.snap.accountId && this.snap.status.kind !== "signed-out") return;
    const seq = ++this.seq;
    this.record = null;
    // `busy` belongs to the previous account's popup; a new account starts idle.
    this.set({ accountId, status: accountId ? { kind: "loading" } : { kind: "signed-out" }, busy: null, error: null, message: null });
    if (!accountId) return;
    const support = await this.support();
    if (seq !== this.seq) return;
    if (!support.ok) {
      this.set({ status: { kind: "unsupported", reason: support.reason } });
      return;
    }
    const rec = await this.findRecord(support.stores, accountId);
    if (seq !== this.seq) return;
    if (!rec) {
      this.set({ status: { kind: "off" } });
      return;
    }
    this.record = rec;
    this.set({ status: this.onStatus(rec, "unknown", null) });
    await this.refresh();
  }

  /** Re-reads the key on chain (allowance, still present, still this version's method list). */
  async refresh(): Promise<void> {
    const rec = this.record;
    if (!rec) return;
    const read = await readAccessKey(this.deps.rpc, rec.accountId, rec.publicKey);
    if (this.record !== rec) return;
    const status = this.statusFromRead(rec, read);
    if (status) this.set({ status });
  }

  /** The one key a wallet `DeleteKey` may name (the wallet allowlist reads it). */
  deletableKey(): string | null {
    return this.record?.publicKey ?? null;
  }

  /** Sync guess for the pending label: true when `calls` would be tried with the one-tap key. */
  covers = (calls: ContractCall[], receiverId: string = CONTRACT_ID): boolean => {
    const rec = this.record;
    const st = this.snap.status;
    if (!rec || st.kind !== "on" || st.chain === "missing" || st.outdated) return false;
    return signlessCall(calls, receiverId, rec.methodNames).ok;
  };

  private async signerFor(rec: OneTapRecord, subtle: SubtleCrypto): Promise<OneTapSigner> {
    const hit = this.signers.get(rec.publicKey);
    if (hit) return hit;
    const signer = await signerFromRecord(rec, subtle);
    this.signers.set(signer.publicKey, signer);
    return signer;
  }

  /**
   * Tries one-tap first. `skip`: not a one-tap action (or one-tap is off), use the wallet as usual.
   * `fallback`: one-tap could not be used and nothing landed, use the wallet and show `notice`.
   * `sent`: the one-tap key sent it (or may have); never ask the wallet for the same action.
   */
  trySend(accountId: string, calls: ContractCall[], receiverId: string): Promise<TrySend> {
    const run = this.queue.then(() => this.trySendNow(accountId, calls, receiverId));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async trySendNow(accountId: string, calls: ContractCall[], receiverId: string): Promise<TrySend> {
    const rec = this.record;
    const st = this.snap.status;
    if (!rec || rec.accountId !== accountId || st.kind !== "on") return { kind: "skip" };
    const check = signlessCall(calls, receiverId, rec.methodNames);
    if (!check.ok) return { kind: "skip" };
    // A key from an older version (e.g. one that still allows `adopt`) is never used.
    if (st.outdated || !isCurrentMethodList(rec.methodNames)) return { kind: "fallback", notice: FALLBACK_NOTICE.outdated };
    const method = check.call.methodName;
    const support = await this.support();
    if (!support.ok || this.record !== rec) return { kind: "skip" };
    let signer: OneTapSigner;
    try {
      signer = await this.signerFor(rec, support.subtle);
    } catch {
      return { kind: "fallback", notice: FALLBACK_NOTICE["load-failed"] };
    }
    // The account changed while the key loaded: nothing was sent, and this record is not current any more.
    if (this.record !== rec || signer.publicKey !== rec.publicKey) return { kind: "skip" };
    const track = this.deps.track;
    let broadcast = false;
    try {
      const out = await sendSignless({
        rpc: this.deps.rpc,
        subtle: support.subtle,
        signer,
        accountId,
        call: check.call,
        lastNonce: this.lastNonce.get(rec.publicKey),
        requireMethods: ONE_TAP_METHODS,
        onBroadcast: () => {
          broadcast = true;
          track?.("tx_submitted", { method, signless: true });
        },
      });
      const current = this.record === rec;
      if (out.kind === "sent") {
        const prev = this.lastNonce.get(rec.publicKey);
        if (prev === undefined || out.nonce > prev) this.lastNonce.set(rec.publicKey, out.nonce);
        const r = out.result;
        track?.(r.ok ? "tx_succeeded" : "tx_failed", { method, rejected: false, signless: true });
        if (current) void this.refresh();
        return { kind: "sent", result: r };
      }
      if (out.broadcast) track?.("tx_failed", { method, rejected: false, signless: true });
      if (current) {
        if (out.reason === "key-missing") this.set({ status: this.onStatus(rec, "missing", null) });
        else if (out.reason === "outdated") {
          const now = this.snap.status;
          if (now.kind === "on") this.set({ status: { ...now, outdated: true } });
        }
        else if (out.reason === "allowance") void this.refresh();
      }
      return { kind: "fallback", notice: out.notice };
    } catch (e) {
      // An unexpected error: if a broadcast had started, the action may have landed, so no wallet retry.
      if (broadcast) {
        track?.("tx_failed", { method, rejected: false, signless: true });
        return { kind: "sent", result: { ...readThrown(e, method), signless: true } };
      }
      return { kind: "fallback", notice: "One-tap play hit an error before sending, so your wallet signs this one." };
    }
  }

  /** Turn on: make a key in this browser, then ONE wallet transaction adds it to the account. */
  async enable(sendWalletTx: WalletTxSender): Promise<TxResult> {
    const accountId = this.snap.accountId;
    if (!accountId) return failure("Connect a wallet first.");
    if (this.snap.busy) return failure("One-tap play is busy. Try again in a moment.");
    const support = await this.support();
    if (!support.ok) return failure(`One-tap play is not available in this browser: ${support.reason}`);
    const fail = (message: string, raw = message) => {
      const r = failure(message, raw);
      if (this.snap.accountId === accountId) this.set({ error: r.message });
      return r;
    };
    this.set({ busy: "enabling", error: null, message: null });
    const primary = support.stores[0]!;
    const scope = this.scope(accountId);
    let stored = false;
    let askedWallet = false;
    let rec: OneTapRecord | null = null;
    try {
      // A key from before, in any store: never orphan one that is still on the account.
      const existing = this.record ?? (await this.findRecord(support.stores, accountId));
      if (existing) {
        const read = await readAccessKey(this.deps.rpc, accountId, existing.publicKey);
        if (read.kind === "found") return fail("This browser already has a one-tap key on your account. Turn it off (or replace it) first.");
        if (read.kind === "unreachable") return fail("Could not reach NEAR testnet to check the existing one-tap key. Nothing was sent. Try again.", read.raw);
        await this.removeEverywhere(support.stores, accountId, existing.publicKey);
        if (this.record === existing) this.record = null;
      }
      const key = await generateOneTapKey(primary.kind, support.subtle);
      rec = newRecord({
        network: this.deps.network,
        accountId,
        key,
        storage: primary.kind,
        methodNames: ONE_TAP_METHODS,
        allowanceYocto: ONE_TAP_ALLOWANCE_YOCTO,
        now: (this.deps.now ?? Date.now)(),
      });
      // Saved before the wallet is asked, so a key that reaches the chain can always be deleted from here.
      await primary.put(scope, rec);
      stored = true;
      askedWallet = true;
      const result = await sendWalletTx({ signerId: accountId, receiverId: accountId, actions: [buildAddKeyAction(rec.publicKey, rec.allowanceYocto)] });
      if (!result.ok && result.rejected) {
        // Closed or rejected in the wallet: nothing was signed.
        await primary.remove(scope).catch(() => undefined);
        return result;
      }
      return await this.settleAdded(rec, accountId, result, primary, scope);
    } catch (e) {
      if (stored && rec) {
        if (askedWallet) await this.settleAdded(rec, accountId, readThrown(e), primary, scope).catch(() => undefined);
        else await primary.remove(scope).catch(() => undefined);
      }
      return fail(readThrown(e).message, readThrown(e).raw);
    } finally {
      // Every return path ends idle. After an account switch `setAccount` already reset `busy`
      // for the new account, so this only clears it for the account that set it.
      if (this.snap.accountId === accountId) this.set({ busy: null });
    }
  }

  /**
   * After the wallet answered an `AddKey` (anything but a rejection): look for the key on chain.
   * A wallet error may come after the transaction was broadcast, so the record is removed only when
   * the key is really not there; when it is (or the chain cannot be read), it is kept and shown.
   */
  private async settleAdded(rec: OneTapRecord, accountId: string, result: TxResult, primary: OneTapStore, scope: string): Promise<TxResult> {
    const check = await this.waitForKey(accountId, rec.publicKey);
    if (!result.ok && check.kind === "missing") {
      await primary.remove(scope).catch(() => undefined);
      if (this.snap.accountId === accountId) this.set({ error: result.message });
      return result;
    }
    if (this.snap.accountId !== accountId) return result;
    this.record = rec;
    const status = check.kind === "found" ? this.statusFromRead(rec, check.read) : this.onStatus(rec, "unknown", null);
    const message = result.ok
      ? "One-tap play is on."
      : check.kind === "found"
        ? "The wallet reported an error, but the key is on your account, so one-tap play is on."
        : "The wallet reported an error and testnet could not be checked. The key is kept here so it can still be turned off.";
    this.set({ status: status ?? this.onStatus(rec, "unknown", null), message, error: null });
    return result;
  }

  /**
   * Turn off: checks on chain that the key is this game's function-call key, then ONE wallet
   * `DeleteKey`, then forgets it here. A key already gone from the account is only forgotten here.
   */
  async disable(sendWalletTx: WalletTxSender): Promise<TxResult> {
    const rec = this.record;
    const accountId = this.snap.accountId;
    if (!rec || !accountId) return failure("One-tap play is already off.");
    if (this.snap.busy) return failure("One-tap play is busy. Try again in a moment.");
    const report = (r: TxResult, patch: Partial<OneTapSnapshot>) => {
      if (this.snap.accountId === accountId) this.set(patch);
      return r;
    };
    this.set({ busy: "disabling", error: null, message: null });
    try {
      const read = await readAccessKey(this.deps.rpc, accountId, rec.publicKey);
      if (read.kind === "missing") {
        await this.forgetRecord(rec);
        const notice = "The key was already gone from your account, so it was only forgotten on this device.";
        return report({ ok: true, txHash: null, notice }, { message: notice });
      }
      if (read.kind === "unreachable") {
        const r = failure("Could not reach NEAR testnet to check the key. Nothing was sent. Try again.", read.raw);
        return report(r, { error: r.message });
      }
      if (read.permission.kind !== "FunctionCall" || read.permission.receiverId !== CONTRACT_ID) {
        const r = failure("That key is not a one-tap play key for this game, so it was not deleted.");
        return report(r, { error: r.message });
      }
      const result = await sendWalletTx({ signerId: accountId, receiverId: accountId, actions: [buildDeleteKeyAction(rec.publicKey)] });
      if (!result.ok) return report(result, { error: result.rejected ? null : result.message });
      await this.forgetRecord(rec);
      return report(result, { message: "One-tap play is off. The key was deleted from your account." });
    } catch (e) {
      const r = readThrown(e);
      return report(r, { error: r.message });
    } finally {
      if (this.snap.accountId === accountId) this.set({ busy: null });
    }
  }

  /** Replace an outdated (or any) key: turn it off (DeleteKey), then on again (AddKey). Two wallet popups. */
  async replace(sendWalletTx: WalletTxSender): Promise<TxResult> {
    const off = await this.disable(sendWalletTx);
    if (!off.ok) return off;
    return this.enable(sendWalletTx);
  }

  /** Local only: removes the key from this browser; the account keeps it until deleted in a wallet. */
  async forget(): Promise<void> {
    const rec = this.record;
    if (!rec) return;
    await this.forgetRecord(rec);
  }

  private async forgetRecord(rec: OneTapRecord): Promise<void> {
    const support = await this.support();
    if (support.ok) await this.removeEverywhere(support.stores, rec.accountId, rec.publicKey);
    this.lastNonce.delete(rec.publicKey);
    this.signers.delete(rec.publicKey);
    if (this.record !== rec) return;
    this.record = null;
    this.set({ status: { kind: "off" }, message: "Forgot the one-tap key on this device." });
  }

  /** Closes the stores' connections (before "Reset local data" deletes the database). */
  async closeStores(): Promise<readonly OneTapStore[]> {
    const support = this.supportP ? await this.supportP : null;
    const stores = support?.ok ? support.stores : [];
    for (const s of stores) s.close?.();
    return stores;
  }
}

/**
 * The routing `signAndSend` uses: one-tap first, the wallet only when one-tap is skipped or fell
 * back before anything could land. `walletSend` runs at most once; `onWallet` runs right before it
 * (so a "sending with one-tap" status can switch to "waiting for your wallet"); on a fallback the
 * result carries the one-line notice.
 */
export async function sendWithOneTap(
  controller: OneTapController,
  signerId: string,
  calls: ContractCall[],
  receiverId: string,
  walletSend: () => Promise<TxResult>,
  hooks: { onWallet?: () => void } = {},
): Promise<TxResult> {
  const attempt = await controller.trySend(signerId, calls, receiverId);
  if (attempt.kind === "sent") return attempt.result;
  hooks.onWallet?.();
  const result = await walletSend();
  return attempt.kind === "fallback" ? { ...result, notice: attempt.notice } : result;
}

// ---------------------------------------------------------------------------- React

export interface OneTapHandle {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => OneTapSnapshot;
  covers: (calls: ContractCall[], receiverId?: string) => boolean;
  enable: () => Promise<TxResult>;
  disable: () => Promise<TxResult>;
  replace: () => Promise<TxResult>;
  forget: () => Promise<void>;
  refresh: () => Promise<void>;
  /** "Reset local data": closes the key database and deletes every one-tap key in this browser. */
  wipeDevice: () => Promise<void>;
}

const OFF_SNAPSHOT: OneTapSnapshot = { accountId: null, status: { kind: "signed-out" }, busy: null, error: null, message: null };

/** Outside a `WalletProvider` (tests, guest mode): one-tap play is simply not there. */
export const NO_ONE_TAP: OneTapHandle = {
  subscribe: () => () => undefined,
  getSnapshot: () => OFF_SNAPSHOT,
  covers: () => false,
  enable: async () => failure("Connect a wallet first."),
  disable: async () => failure("One-tap play is already off."),
  replace: async () => failure("One-tap play is already off."),
  forget: async () => undefined,
  refresh: async () => undefined,
  wipeDevice: () => wipeOneTapDevice({ indexedDB: typeof indexedDB !== "undefined" ? indexedDB : null, localStorage: appStorage() }),
};

export const OneTapContext = createContext<OneTapHandle>(NO_ONE_TAP);

export function useOneTap(): OneTapHandle & { snapshot: OneTapSnapshot } {
  const handle = useContext(OneTapContext);
  const snapshot = useSyncExternalStore(handle.subscribe, handle.getSnapshot, handle.getSnapshot);
  return { ...handle, snapshot };
}
