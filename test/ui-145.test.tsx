/**
 * UI-145 (NEAR wallet login): the header wallet control renders the disconnected and connected
 * states from a mocked wallet, never shows an invented balance, and Privy is registered only when
 * both public client ids are configured. Runs in node: components are checked through
 * server-rendered markup.
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PRIVY_EXECUTOR_URL, privyConfigFromEnv, privyManifestFromEnv } from "../src/chain/privy.ts";
import { DISCONNECTED_WALLET, NEAR_CONNECT_CSP_NONCE, type WalletApi } from "../src/chain/wallet.tsx";
import { EMPTY_ACCOUNT_INFO, type AccountInfo } from "../src/chain/useAccountInfo.ts";
import { WalletControl, shortAccount } from "../src/hud/WalletControl.tsx";

const connected: WalletApi = { ...DISCONNECTED_WALLET, status: "connected", accountId: "alice.testnet", walletName: "Meteor Wallet" };
const info: AccountInfo = {
  ...EMPTY_ACCOUNT_INFO,
  nearYocto: "1500000000000000000000000",
  snaccYocto: "200000000000000000000000",
  storage: { registered: false, minYocto: "5000000000000000000000" },
};

describe("UI-145 wallet control", () => {
  it("shows a connect key while disconnected", () => {
    const html = renderToStaticMarkup(<WalletControl wallet={DISCONNECTED_WALLET} info={EMPTY_ACCOUNT_INFO} />);
    expect(html).toContain('data-testid="wallet-connect"');
    expect(html).toContain("connect wallet");
    expect(html).not.toContain('data-testid="wallet-chip"');
  });

  it("shows a busy label while restoring or connecting, and the connection error", () => {
    expect(renderToStaticMarkup(<WalletControl wallet={{ ...DISCONNECTED_WALLET, status: "restoring" }} info={EMPTY_ACCOUNT_INFO} />)).toContain("restoring wallet");
    const err = renderToStaticMarkup(<WalletControl wallet={{ ...DISCONNECTED_WALLET, status: "error", error: "Could not load the wallet list." }} info={EMPTY_ACCOUNT_INFO} />);
    expect(err).toContain('role="alert"');
    expect(err).toContain("Could not load the wallet list.");
  });

  it("shows the account chip with NEAR and $SNACC balances and a disconnect key", () => {
    const html = renderToStaticMarkup(<WalletControl wallet={connected} info={info} />);
    expect(html).toContain('data-testid="wallet-chip"');
    expect(html).toContain("alice.testnet");
    expect(html).toContain("https://testnet.nearblocks.io/address/alice.testnet");
    expect(html).toMatch(/1\.5 <span[^>]*>NEAR/);
    expect(html).toMatch(/0\.2 <span[^>]*>\$SNACC/);
    expect(html).toContain("no monetary value");
    expect(html).toContain('data-testid="wallet-disconnect"');
  });

  it("shows a dash, never a number, while balances are unread", () => {
    const html = renderToStaticMarkup(<WalletControl wallet={connected} info={EMPTY_ACCOUNT_INFO} />);
    expect(html).toMatch(/data-testid="wallet-near">—/);
    expect(html).toMatch(/data-testid="wallet-snacc">—/);
  });

  it("shortens implicit account ids only", () => {
    expect(shortAccount("alice.testnet")).toBe("alice.testnet");
    expect(shortAccount("a".repeat(64))).toBe(`${"a".repeat(8)}…${"a".repeat(6)}`);
  });

  it("index.html CSP admits the NEAR Connect wallet frames through the shared nonce", () => {
    const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
    const csp = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(csp).toContain(`'nonce-${NEAR_CONNECT_CSP_NONCE}'`);
    expect(/script-src[^;]*'unsafe-inline'/.test(csp)).toBe(false);
    expect(NEAR_CONNECT_CSP_NONCE).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("the default (no provider) wallet is disconnected and refuses to sign", async () => {
    expect(DISCONNECTED_WALLET.accountId).toBeNull();
    const r = await DISCONNECTED_WALLET.signAndSend([]);
    expect(r.ok).toBe(false);
  });
});

describe("UI-145 Privy is enabled only when both ids are set", () => {
  it("needs VITE_PRIVY_APP_ID and VITE_PRIVY_CLIENT_ID, both non-blank", () => {
    expect(privyConfigFromEnv({})).toBeNull();
    expect(privyConfigFromEnv({ VITE_PRIVY_APP_ID: "app" })).toBeNull();
    expect(privyConfigFromEnv({ VITE_PRIVY_CLIENT_ID: "client" })).toBeNull();
    expect(privyConfigFromEnv({ VITE_PRIVY_APP_ID: "  ", VITE_PRIVY_CLIENT_ID: "client" })).toBeNull();
    expect(privyConfigFromEnv({ VITE_PRIVY_APP_ID: "app", VITE_PRIVY_CLIENT_ID: "client" })).toEqual({ appId: "app", clientId: "client" });
  });

  it("registers a testnet sandbox wallet with a pinned executor and this origin's sign page", () => {
    expect(privyManifestFromEnv({ VITE_PRIVY_APP_ID: "app" }, "https://x.test")).toBeNull();
    const m = privyManifestFromEnv({ VITE_PRIVY_APP_ID: "app", VITE_PRIVY_CLIENT_ID: "client" }, "https://x.test");
    expect(m?.type).toBe("sandbox");
    expect(m?.features.testnet).toBe(true);
    expect(m?.features.mainnet).toBe(false);
    expect(m?.permissions.isPrivyConnect).toBe(true);
    expect(m?.permissions.allowsOpen).toEqual(["https://x.test"]);
    expect(m?.metadata.signPageURL).toBe("https://x.test/sign");
    expect(PRIVY_EXECUTOR_URL).toMatch(/\/[0-9a-f]{40}\/executor\.js$/);
    // the ids themselves never go into the manifest
    expect(JSON.stringify(m)).not.toContain("client");
  });
});
