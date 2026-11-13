/**
 * Optional email / social login through Privy (UI-145), via the `@peerfolio/privy-near-connect`
 * plugin for NEAR Connect (docs.near.org, "web3-apps/tutorials/privy"). Privy then appears as one
 * more option inside the same NEAR Connect wallet picker, so `useWallet()` and the action builders
 * do not change.
 *
 * It is switched on when the public Privy App ID is set at build time (from the Privy dashboard;
 * not a secret):
 *   VITE_PRIVY_APP_ID      required
 *   VITE_PRIVY_CLIENT_ID   optional; passed to the Privy client only when set
 *                          (`PrivyOptions.clientId?: string` in @privy-io/js-sdk-core 0.72.1)
 * Without the App ID nothing is registered and the picker lists the normal wallets only.
 *
 * How it fits: the dApp registers one extra sandboxed wallet whose executor script (pinned to an
 * immutable commit, as the plugin README requires) opens this app's `/sign` page in a popup. The
 * `/sign` page holds the Privy client and the plugin's signing handshake; it is a separate lazy
 * route, so `/app` and `/` never download Privy.
 */

export const PRIVY_WALLET_ID = "snacc-privy";
/** Path of the signing page this app serves (see `src/sign/`). */
export const PRIVY_SIGN_PATH = "/sign";
/**
 * Executor of `@peerfolio/privy-near-connect`, pinned to an immutable commit of the repo's
 * `release` branch whose `executor.js` is byte-identical to the installed package's
 * `dist/executor.js` (0.0.8, 30 s READY timeout). The README's example commit is older (5 s
 * timeout). Bump together with the package, deliberately.
 */
export const PRIVY_EXECUTOR_URL =
  "https://raw.githubusercontent.com/beneviolabs/privy-near-connect/9a149fcb319b9208557452a1ea1287a0e4877c6c/executor.js";

export interface PrivyConfig {
  appId: string;
  /** Present only when `VITE_PRIVY_CLIENT_ID` is set. */
  clientId?: string;
}

type Env = Record<string, string | boolean | undefined>;

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** A non-blank App ID → config (client id added only when set); otherwise null (Privy stays off). */
export function privyConfigFromEnv(env: Env): PrivyConfig | null {
  const appId = clean(env.VITE_PRIVY_APP_ID);
  const clientId = clean(env.VITE_PRIVY_CLIENT_ID);
  if (!appId) return null;
  return clientId ? { appId, clientId } : { appId };
}

/** NEAR Connect manifest entry for the Privy wallet, or null when Privy is not configured. */
export function privyManifestFromEnv(env: Env, origin: string) {
  if (!privyConfigFromEnv(env)) return null;
  return {
    id: PRIVY_WALLET_ID,
    name: "Email or social login (Privy)",
    icon: `${origin}/favicon.svg`,
    description: "Sign in with email or a social account. Privy creates a NEAR account for you.",
    website: origin,
    version: "1.0.0",
    executor: PRIVY_EXECUTOR_URL,
    type: "sandbox" as const,
    platform: { web: origin },
    features: {
      signMessage: true,
      signTransaction: false,
      signInWithoutAddKey: true,
      signInAndSignMessage: true,
      signInWithFunctionCallKey: false,
      signAndSendTransaction: true,
      signAndSendTransactions: true,
      signDelegateActions: false,
      mainnet: false,
      testnet: true,
    },
    permissions: { isPrivyConnect: true, storage: true, allowsOpen: [origin] },
    metadata: { signPageURL: `${origin}${PRIVY_SIGN_PATH}`, debug: false },
  };
}
