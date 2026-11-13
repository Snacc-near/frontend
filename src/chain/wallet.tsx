/**
 * NEAR wallet connection for the game (UI-145), built on NEAR Connect (`@hot-labs/near-connect`,
 * the successor of NEAR Wallet Selector), network `testnet`.
 *
 * - The connector library is loaded on demand (`import()`), so neither the landing page nor the
 *   first paint of `/app` pays for it. It loads at mount only when NEAR Connect already remembers a
 *   wallet in this browser (its own `selected-wallet` entry) or the app runs inside a wallet frame.
 * - The app never sees, stores or handles the wallet's private keys: wallets run in NEAR Connect's
 *   sandboxed iframes and sign there. The app keeps no wallet state of its own beyond React memory.
 * - RES-111 one-tap play (opt-in, Settings): the app makes its OWN limited key in this browser, the
 *   wallet adds it to the account once (`AddKey`, function-call permission for the Snacc contract),
 *   and deposit-free game calls are then signed here without a popup (`chain/oneTap*.ts`).
 * - Without a provider (tests, guest mode) `useWallet()` returns a disconnected no-op wallet.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CONTRACT_ID, toWalletActions, type ContractCall } from "./actions.ts";
import { MARKET_ID } from "../data/nearView.ts";
import { readOutcome, readThrown, type TxResult } from "./txResult.ts";
import { privyManifestFromEnv } from "./privy.ts";
import { track } from "../telemetry.ts";
import { ONE_TAP_RPCS, checkWalletTx, type WalletAction, type WalletTx } from "./oneTap.ts";
import { ed25519Available, pickOneTapStore } from "./oneTapKeys.ts";
import { OneTapContext, OneTapController, sendWithOneTap, type OneTapHandle } from "./oneTapSession.ts";
import { appStorage } from "../prefs/prefs.ts";

export const NETWORK = "testnet" as const;
/**
 * NEAR Connect runs each wallet in a `srcdoc` iframe whose inline scripts inherit this page's CSP.
 * `index.html` allows them through this nonce (`script-src ... 'nonce-…'`). The CSP is a static
 * meta tag, so the nonce is a fixed token: it admits only scripts that carry it, and the app
 * renders no untrusted HTML. Keep the two values in sync (a test checks it).
 */
export const NEAR_CONNECT_CSP_NONCE = "c25hY2MtbmVhci1jb25uZWN0";
/** Key NEAR Connect itself writes to localStorage once a wallet is chosen. */
const SELECTED_WALLET_KEY = "selected-wallet";

/** Contracts the game signs transactions for: the Snacc contract (default) and the testnet market (UI-164). */
export const SIGNABLE_RECEIVERS: readonly string[] = [CONTRACT_ID, MARKET_ID];

/** The receiver for `signAndSend`: the Snacc contract when none is given, the id itself when allowed, otherwise null. */
export function resolveReceiver(receiverId?: string): string | null {
  if (receiverId === undefined) return CONTRACT_ID;
  return SIGNABLE_RECEIVERS.includes(receiverId) ? receiverId : null;
}

export type WalletStatus = "idle" | "restoring" | "connecting" | "connected" | "error";

export interface WalletApi {
  status: WalletStatus;
  accountId: string | null;
  /** Display name of the connected wallet, e.g. "Meteor Wallet". */
  walletName: string | null;
  /** Last connection error (plain text), cleared on the next attempt. */
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /**
   * Signs and sends one transaction with the given calls, in order. The receiver is the Snacc
   * contract unless `receiverId` names the testnet market (UI-164); any other receiver is refused.
   */
  signAndSend: (calls: ContractCall[], receiverId?: string) => Promise<TxResult>;
  /**
   * NEP-413 message signing (UI-148 sign-in to the optional profile). Rejects when no wallet is
   * connected, the player cancels, or the wallet cannot sign messages.
   */
  signMessage: (input: { message: string; recipient: string; nonce: Uint8Array }) => Promise<SignedMessage>;
}

/** NEAR Connect's `SignedMessage` (NEP-413): `publicKey` is `ed25519:<base58>`, `signature` base64. */
export interface SignedMessage {
  accountId: string;
  publicKey: string;
  signature: string;
}

const notConnected = async (): Promise<TxResult> => ({
  ok: false,
  txHash: null,
  message: "Connect a wallet first.",
  raw: "no wallet provider",
  rejected: false,
});

export const DISCONNECTED_WALLET: WalletApi = {
  status: "idle",
  accountId: null,
  walletName: null,
  error: null,
  connect: async () => undefined,
  disconnect: async () => undefined,
  signAndSend: notConnected,
  signMessage: async () => {
    throw new Error("Connect a wallet first.");
  },
};

export const WalletContext = createContext<WalletApi>(DISCONNECTED_WALLET);

export function useWallet(): WalletApi {
  return useContext(WalletContext);
}

// Minimal structural types for the parts of NEAR Connect used here (see its `build/*.d.ts`).
interface ConnectorWallet {
  manifest: { id: string; name: string };
  getAccounts(data?: { network?: string }): Promise<Array<{ accountId: string }>>;
  signAndSendTransaction(params: { network?: string; signerId?: string; receiverId: string; actions: WalletAction[] }): Promise<unknown>;
  signMessage(params: { message: string; recipient: string; nonce: Uint8Array; network?: string; signerId?: string }): Promise<SignedMessage>;
}
interface Connector {
  whenManifestLoaded: Promise<void>;
  connect(input?: { walletId?: string }): Promise<ConnectorWallet>;
  disconnect(wallet?: ConnectorWallet): Promise<void>;
  getConnectedWallet(): Promise<{ wallet: ConnectorWallet; accounts: Array<{ accountId: string }> }>;
  wallet(id?: string | null): Promise<ConnectorWallet>;
  registerWallet(manifest: unknown): Promise<void>;
  on(event: "wallet:signIn", cb: (p: { wallet: ConnectorWallet; accounts: Array<{ accountId: string }> }) => void): void;
  on(event: "wallet:signOut", cb: () => void): void;
}

let connectorPromise: Promise<Connector> | null = null;

/** Creates the single NEAR Connect instance on first use (lazy chunk). */
function loadConnector(): Promise<Connector> {
  if (!connectorPromise) {
    connectorPromise = import("@hot-labs/near-connect")
      .then(async ({ NearConnector }) => {
        const connector = new NearConnector({
          network: NETWORK,
          // Only wallets that can sign and send a transaction are useful to the game.
          features: { signAndSendTransaction: true },
          cspNonce: NEAR_CONNECT_CSP_NONCE,
        }) as unknown as Connector;
        await connector.whenManifestLoaded.catch(() => undefined);
        const privy = privyManifestFromEnv(import.meta.env as Record<string, string | undefined>, window.location.origin);
        if (privy) await connector.registerWallet(privy).catch(() => undefined);
        return connector;
      })
      .catch((e) => {
        connectorPromise = null;
        throw e;
      });
  }
  return connectorPromise;
}

function rememberedWallet(): boolean {
  try {
    return Boolean(window.localStorage.getItem(SELECTED_WALLET_KEY)) || window.self !== window.top;
  } catch {
    return false;
  }
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accountRef = useRef<string | null>(null);
  accountRef.current = accountId;
  const listening = useRef(false);

  const attach = useCallback((connector: Connector) => {
    if (listening.current) return;
    listening.current = true;
    connector.on("wallet:signIn", ({ wallet, accounts }) => {
      const id = accounts[0]?.accountId ?? null;
      setAccountId(id);
      setWalletName(wallet.manifest.name);
      setStatus(id ? "connected" : "idle");
    });
    connector.on("wallet:signOut", () => {
      setAccountId(null);
      setWalletName(null);
      setStatus("idle");
    });
  }, []);

  // Restore a session NEAR Connect remembers; otherwise stay idle and load nothing.
  useEffect(() => {
    if (!rememberedWallet()) return;
    let alive = true;
    setStatus("restoring");
    loadConnector()
      .then(async (connector) => {
        attach(connector);
        const { wallet, accounts } = await connector.getConnectedWallet();
        if (!alive) return;
        const id = accounts[0]?.accountId ?? null;
        setAccountId(id);
        setWalletName(wallet.manifest.name);
        setStatus(id ? "connected" : "idle");
      })
      .catch(() => {
        if (alive) setStatus("idle");
      });
    return () => {
      alive = false;
    };
  }, [attach]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    track("wallet_connect_click");
    try {
      const connector = await loadConnector();
      attach(connector);
      const wallet = await connector.connect();
      const accounts = await wallet.getAccounts({ network: NETWORK });
      const id = accounts[0]?.accountId ?? null;
      setAccountId(id);
      setWalletName(wallet.manifest.name);
      setStatus(id ? "connected" : "idle");
      if (id) track("wallet_connected", { wallet: wallet.manifest.name });
    } catch (e) {
      const msg = messageOf(e);
      if (/user rejected/i.test(msg)) {
        setStatus(accountRef.current ? "connected" : "idle");
        return;
      }
      setError(/manifest|fetch|network/i.test(msg) ? "Could not load the wallet list. Check the connection and try again." : msg);
      setStatus(accountRef.current ? "connected" : "error");
    }
  }, [attach]);

  const disconnect = useCallback(async () => {
    try {
      const connector = await loadConnector();
      await connector.disconnect();
    } catch {
      // Already signed out on the wallet side: clear the local view anyway.
    }
    setAccountId(null);
    setWalletName(null);
    setStatus("idle");
  }, []);

  // RES-111: one controller per provider; it follows the connected account.
  const oneTapRef = useRef<OneTapController | null>(null);
  oneTapRef.current ??= new OneTapController(defaultOneTapDeps());
  const oneTap = oneTapRef.current;
  useEffect(() => {
    void oneTap.setAccount(accountId);
  }, [oneTap, accountId]);

  /**
   * The only door to the wallet's `signAndSendTransaction`. `checkWalletTx` lets through
   * FunctionCalls to `SIGNABLE_RECEIVERS`, the one-tap `AddKey` to your own account, and a
   * `DeleteKey` of the one-tap key this browser holds; anything else is refused before the wallet.
   */
  const walletTx = useCallback(
    async (tx: WalletTx, method?: string): Promise<TxResult> => {
      const refused = checkWalletTx(tx, { signerId: accountRef.current, receivers: SIGNABLE_RECEIVERS, deletableKey: oneTap.deletableKey() });
      if (refused) return readThrown(new Error(refused), method);
      try {
        const connector = await loadConnector();
        const wallet = await connector.wallet();
        const outcome = await wallet.signAndSendTransaction({ network: NETWORK, signerId: tx.signerId, receiverId: tx.receiverId, actions: tx.actions });
        return readOutcome(outcome, method);
      } catch (e) {
        return readThrown(e, method);
      }
    },
    [oneTap],
  );

  const signAndSend = useCallback(
    async (calls: ContractCall[], receiverId?: string): Promise<TxResult> => {
      const signer = accountRef.current;
      if (!signer) return notConnected();
      // The game call is the last action (a storage registration may come first).
      const method = calls[calls.length - 1]?.methodName;
      // Only the Snacc contract (the default) and the testnet market can be a receiver; nothing else reaches the wallet.
      const receiver = resolveReceiver(receiverId);
      if (receiver === null) return readThrown(new Error(`receiver ${receiverId} is not a contract this game signs for`), method);
      // OPS-127: anonymous funnel counts (method name only; never the account or the hash).
      const report = (r: TxResult): TxResult => {
        track(r.ok ? "tx_succeeded" : "tx_failed", { method: method ?? "unknown", rejected: !r.ok && Boolean(r.rejected) });
        return r;
      };
      // RES-111: deposit-free calls try the one-tap key first (it tracks its own `signless: true` events).
      return sendWithOneTap(oneTap, signer, calls, receiver, async () => {
        track("tx_submitted", { method: method ?? "unknown" });
        return report(await walletTx({ signerId: signer, receiverId: receiver, actions: toWalletActions(calls) }, method));
      });
    },
    [oneTap, walletTx],
  );

  const oneTapHandle = useMemo<OneTapHandle>(
    () => ({
      subscribe: oneTap.subscribe,
      getSnapshot: oneTap.getSnapshot,
      covers: oneTap.covers,
      enable: () => oneTap.enable((tx) => walletTx(tx)),
      disable: () => oneTap.disable((tx) => walletTx(tx)),
      forget: () => oneTap.forget(),
      refresh: () => oneTap.refresh(),
    }),
    [oneTap, walletTx],
  );

  const signMessage = useCallback(async (input: { message: string; recipient: string; nonce: Uint8Array }): Promise<SignedMessage> => {
    const signer = accountRef.current;
    if (!signer) throw new Error("Connect a wallet first.");
    const connector = await loadConnector();
    const wallet = await connector.wallet();
    if (typeof wallet.signMessage !== "function") throw new Error("signMessage not supported by this wallet");
    return wallet.signMessage({ ...input, network: NETWORK, signerId: signer });
  }, []);

  const value = useMemo<WalletApi>(
    () => ({ status, accountId, walletName, error, connect, disconnect, signAndSend, signMessage }),
    [status, accountId, walletName, error, connect, disconnect, signAndSend, signMessage],
  );
  return (
    <WalletContext.Provider value={value}>
      <OneTapContext.Provider value={oneTapHandle}>{children}</OneTapContext.Provider>
    </WalletContext.Provider>
  );
}

/** Browser wiring of the one-tap controller: FastNEAR RPC with a fallback, Web Crypto, IndexedDB (localStorage fallback). */
function defaultOneTapDeps(): ConstructorParameters<typeof OneTapController>[0] {
  const idb = (): IDBFactory | null => {
    try {
      return typeof indexedDB !== "undefined" ? indexedDB : null;
    } catch {
      return null;
    }
  };
  return {
    network: NETWORK,
    rpc: { urls: ONE_TAP_RPCS, fetch: (input, init) => fetch(input, init) },
    subtle: () => (typeof crypto !== "undefined" && crypto.subtle ? crypto.subtle : null),
    ed25519: (subtle) => ed25519Available(subtle),
    pickStore: (subtle) => pickOneTapStore({ indexedDB: idb(), localStorage: appStorage(), subtle }),
    track: (name, props) => track(name, props),
  };
}
