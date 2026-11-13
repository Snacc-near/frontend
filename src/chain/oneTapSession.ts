/**
 * RES-111 one-tap play state for the connected account, framework-free so it is tested without a
 * DOM, plus the React context (`useOneTap`) the Settings section, the wallet chip and the action
 * windows read. `WalletProvider` owns one controller and routes every `signAndSend` through
 * `sendWithOneTap` first.
 */
import { createContext, useContext, useSyncExternalStore } from "react";
import { CONTRACT_ID, type ContractCall } from "./actions.ts";
import {
  ONE_TAP_ALLOWANCE_YOCTO,
  ONE_TAP_METHODS,
  buildAddKeyAction,
  buildDeleteKeyAction,
  readAccessKey,
  sendSignless,
  signlessCall,
  type OneTapRpc,
  type OneTapSigner,
  type WalletTx,
} from "./oneTap.ts";
import { generateOneTapKey, newRecord, scopeOf, signerFromRecord, type KeyStorageKind, type OneTapRecord, type OneTapStore } from "./oneTapKeys.ts";
import { readThrown, type TxFailure, type TxResult } from "./txResult.ts";

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
  /** Where keys live in this browser (picked once, lazily); null when nowhere. */
  pickStore: (subtle: SubtleCrypto) => Promise<OneTapStore | null>;
  /** Whether Ed25519 works in this browser's Web Crypto. */
  ed25519: (subtle: SubtleCrypto) => Promise<boolean>;
  track?: TrackFn;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Polls after `AddKey` until the key is visible on chain. */
  confirmPolls?: number;
}

type Support = { ok: true; store: OneTapStore; subtle: SubtleCrypto } | { ok: false; reason: string };

export type TrySend = { kind: "skip" } | { kind: "fallback"; notice: string } | { kind: "sent"; result: TxResult };

const failure = (message: string, raw = message): TxFailure => ({ ok: false, txHash: null, message, raw, rejected: false });

export class OneTapController {
  private snap: OneTapSnapshot = { accountId: null, status: { kind: "signed-out" }, busy: null, error: null, message: null };
  private readonly listeners = new Set<() => void>();
  private record: OneTapRecord | null = null;
  private signer: OneTapSigner | null = null;
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
      const store = await this.deps.pickStore(subtle).catch(() => null);
      if (!store) return { ok: false, reason: "this browser blocks site storage (IndexedDB and localStorage)." };
      return { ok: true, store, subtle };
    })();
    return this.supportP;
  }

  private scope(accountId: string) {
    return scopeOf(this.deps.network, accountId);
  }

  private onStatus(rec: OneTapRecord, chain: "ok" | "missing" | "unknown", allowanceYocto: string | null): OneTapStatus {
    return { kind: "on", publicKey: rec.publicKey, storage: rec.storage, allowanceYocto, chain, createdAt: rec.createdAt };
  }

  /** Follows the connected account: loads its key (if any) from this browser and checks it on chain. */
  async setAccount(accountId: string | null): Promise<void> {
    if (accountId === this.snap.accountId && this.snap.status.kind !== "signed-out") return;
    const seq = ++this.seq;
    this.record = null;
    this.signer = null;
    if (!accountId) {
      this.set({ accountId: null, status: { kind: "signed-out" }, error: null, message: null });
      return;
    }
    this.set({ accountId, status: { kind: "loading" }, error: null, message: null });
    const support = await this.support();
    if (seq !== this.seq) return;
    if (!support.ok) {
      this.set({ status: { kind: "unsupported", reason: support.reason } });
      return;
    }
    const rec = await support.store.get(this.scope(accountId)).catch(() => null);
    if (seq !== this.seq) return;
    if (!rec || rec.accountId !== accountId || rec.network !== this.deps.network) {
      this.set({ status: { kind: "off" } });
      return;
    }
    this.record = rec;
    this.set({ status: this.onStatus(rec, "unknown", null) });
    await this.refresh();
  }

  /** Re-reads the key on chain (allowance, still present). */
  async refresh(): Promise<void> {
    const rec = this.record;
    if (!rec) return;
    const read = await readAccessKey(this.deps.rpc, rec.accountId, rec.publicKey);
    if (this.record !== rec) return;
    if (read.kind === "missing") this.set({ status: this.onStatus(rec, "missing", null) });
    else if (read.kind === "found")
      this.set({ status: this.onStatus(rec, "ok", read.permission.kind === "FunctionCall" && read.permission.allowance !== null ? read.permission.allowance.toString() : null) });
  }

  /** The one key a wallet `DeleteKey` may name (the wallet allowlist reads it). */
  deletableKey(): string | null {
    return this.record?.publicKey ?? null;
  }

  /** Sync guess for the pending label: true when `calls` would be tried with the one-tap key. */
  covers = (calls: ContractCall[], receiverId: string = CONTRACT_ID): boolean => {
    const rec = this.record;
    const st = this.snap.status;
    if (!rec || st.kind !== "on" || st.chain === "missing") return false;
    return signlessCall(calls, receiverId, rec.methodNames).ok;
  };

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
    if (!rec || rec.accountId !== accountId || this.snap.status.kind !== "on") return { kind: "skip" };
    const check = signlessCall(calls, receiverId, rec.methodNames);
    if (!check.ok) return { kind: "skip" };
    const method = check.call.methodName;
    const support = await this.support();
    if (!support.ok) return { kind: "skip" };
    let broadcast = false;
    try {
      this.signer ??= await signerFromRecord(rec, support.subtle);
    } catch {
      return { kind: "fallback", notice: "Could not load the one-tap key in this browser, so your wallet signs this one." };
    }
    const track = this.deps.track;
    try {
      const out = await sendSignless({
        rpc: this.deps.rpc,
        subtle: support.subtle,
        signer: this.signer,
        accountId,
        call: check.call,
        lastNonce: this.lastNonce.get(rec.publicKey),
        onBroadcast: () => {
          broadcast = true;
          track?.("tx_submitted", { method, signless: true });
        },
      });
      if (out.kind === "sent") {
        this.lastNonce.set(rec.publicKey, out.nonce);
        const r = out.result;
        track?.(r.ok ? "tx_succeeded" : "tx_failed", { method, rejected: false, signless: true });
        void this.refresh();
        return { kind: "sent", result: r };
      }
      if (out.broadcast) track?.("tx_failed", { method, rejected: false, signless: true });
      if (out.reason === "key-missing") this.set({ status: this.onStatus(rec, "missing", null) });
      if (out.reason === "allowance") void this.refresh();
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
    if (this.record) await this.forget();
    this.set({ busy: "enabling", error: null, message: null });
    const scope = this.scope(accountId);
    let stored = false;
    try {
      const key = await generateOneTapKey(support.store.kind, support.subtle);
      const rec = newRecord({
        network: this.deps.network,
        accountId,
        key,
        storage: support.store.kind,
        methodNames: ONE_TAP_METHODS,
        allowanceYocto: ONE_TAP_ALLOWANCE_YOCTO,
        now: (this.deps.now ?? Date.now)(),
      });
      // Saved before the wallet is asked, so a key that reaches the chain can always be deleted from here.
      await support.store.put(scope, rec);
      stored = true;
      const result = await sendWalletTx({ signerId: accountId, receiverId: accountId, actions: [buildAddKeyAction(rec.publicKey, rec.allowanceYocto)] });
      if (!result.ok) {
        await support.store.remove(scope).catch(() => undefined);
        this.set({ busy: null, error: result.rejected ? null : result.message });
        return result;
      }
      if (this.snap.accountId !== accountId) return result;
      this.record = rec;
      this.signer = null;
      let chain: "ok" | "unknown" = "unknown";
      let allowance: string | null = null;
      const polls = this.deps.confirmPolls ?? 6;
      for (let i = 0; i < polls; i++) {
        const read = await readAccessKey(this.deps.rpc, accountId, rec.publicKey);
        if (read.kind === "found") {
          chain = "ok";
          allowance = read.permission.kind === "FunctionCall" && read.permission.allowance !== null ? read.permission.allowance.toString() : null;
          break;
        }
        await (this.deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(1000);
      }
      this.set({ busy: null, status: this.onStatus(rec, chain, allowance), message: "One-tap play is on." });
      return result;
    } catch (e) {
      if (stored) await support.store.remove(scope).catch(() => undefined);
      const r = readThrown(e);
      this.set({ busy: null, error: r.message });
      return r;
    }
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
    this.set({ busy: "disabling", error: null, message: null });
    try {
      const read = await readAccessKey(this.deps.rpc, accountId, rec.publicKey);
      if (read.kind === "missing") {
        await this.forget();
        const notice = "The key was already gone from your account, so it was only forgotten on this device.";
        this.set({ busy: null, message: notice });
        return { ok: true, txHash: null, notice };
      }
      if (read.kind === "unreachable") {
        const r = failure("Could not reach NEAR testnet to check the key. Nothing was sent. Try again.", read.raw);
        this.set({ busy: null, error: r.message });
        return r;
      }
      if (read.permission.kind !== "FunctionCall" || read.permission.receiverId !== CONTRACT_ID) {
        const r = failure("That key is not a one-tap play key for this game, so it was not deleted.");
        this.set({ busy: null, error: r.message });
        return r;
      }
      const result = await sendWalletTx({ signerId: accountId, receiverId: accountId, actions: [buildDeleteKeyAction(rec.publicKey)] });
      if (result.ok) {
        await this.forget();
        this.set({ busy: null, message: "One-tap play is off. The key was deleted from your account." });
      } else this.set({ busy: null, error: result.rejected ? null : result.message });
      return result;
    } catch (e) {
      const r = readThrown(e);
      this.set({ busy: null, error: r.message });
      return r;
    }
  }

  /** Local only: removes the key from this browser; the account keeps it until deleted in a wallet. */
  async forget(): Promise<void> {
    const rec = this.record;
    const accountId = this.snap.accountId;
    if (!rec || !accountId) return;
    const support = await this.support();
    if (support.ok) await support.store.remove(this.scope(accountId)).catch(() => undefined);
    this.lastNonce.delete(rec.publicKey);
    this.record = null;
    this.signer = null;
    this.set({ status: { kind: "off" }, message: "Forgot the one-tap key on this device." });
  }
}

/**
 * The routing `signAndSend` uses: one-tap first, the wallet only when one-tap is skipped or fell
 * back before anything could land. `walletSend` runs at most once; on a fallback its result carries
 * the one-line notice.
 */
export async function sendWithOneTap(
  controller: OneTapController,
  signerId: string,
  calls: ContractCall[],
  receiverId: string,
  walletSend: () => Promise<TxResult>,
): Promise<TxResult> {
  const attempt = await controller.trySend(signerId, calls, receiverId);
  if (attempt.kind === "sent") return attempt.result;
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
  forget: () => Promise<void>;
  refresh: () => Promise<void>;
}

const OFF_SNAPSHOT: OneTapSnapshot = { accountId: null, status: { kind: "signed-out" }, busy: null, error: null, message: null };

/** Outside a `WalletProvider` (tests, guest mode): one-tap play is simply not there. */
export const NO_ONE_TAP: OneTapHandle = {
  subscribe: () => () => undefined,
  getSnapshot: () => OFF_SNAPSHOT,
  covers: () => false,
  enable: async () => failure("Connect a wallet first."),
  disable: async () => failure("One-tap play is already off."),
  forget: async () => undefined,
  refresh: async () => undefined,
};

export const OneTapContext = createContext<OneTapHandle>(NO_ONE_TAP);

export function useOneTap(): OneTapHandle & { snapshot: OneTapSnapshot } {
  const handle = useContext(OneTapContext);
  const snapshot = useSyncExternalStore(handle.subscribe, handle.getSnapshot, handle.getSnapshot);
  return { ...handle, snapshot };
}
