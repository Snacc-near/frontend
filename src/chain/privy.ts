/**
 * Optional email / social login through Privy (UI-145), via the `@peerfolio/privy-near-connect`
 * plugin for NEAR Connect (docs.near.org, "web3-apps/tutorials/privy"). Privy then appears as one
 * more option inside the same NEAR Connect wallet picker, so `useWallet()` and the action builders
 * do not change.
 *
 * It is switched on only when BOTH public client ids are set at build time:
 *   VITE_PRIVY_APP_ID, VITE_PRIVY_CLIENT_ID   (from the Privy dashboard; not secrets)
 * Otherwise nothing is registered and the picker lists the normal wallets only.
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
 * Executor of `@peerfolio/privy-near-connect`, pinned to the commit its README references
 * (same bytes as the package's `dist/executor.js`, 0.0.8). Bump deliberately.
 */
export const PRIVY_EXECUTOR_URL =
  "https://raw.githubusercontent.com/beneviolabs/privy-near-connect/3d56b782669d242a1ea432921e291abc26b4ebc7/executor.js";

export interface PrivyConfig {
  appId: string;
  clientId: string;
}

type Env = Record<string, string | boolean | undefined>;

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Both ids present and non-blank → config; anything else → null (Privy stays off). */
export function privyConfigFromEnv(env: Env): PrivyConfig | null {
  const appId = clean(env.VITE_PRIVY_APP_ID);
  const clientId = clean(env.VITE_PRIVY_CLIENT_ID);
  return appId && clientId ? { appId, clientId } : null;
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
