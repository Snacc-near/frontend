/**
 * Settings → One-tap play (RES-111). Turning it on asks the wallet once to add a limited key to the
 * player's own account; deposit-free game actions are then signed in this browser without a popup.
 * The copy says which actions, what still uses the wallet, the allowance, where the key lives and
 * how to remove it. Status: tried with the logic tests and fakes only, not yet with every wallet.
 */
import { useState } from "react";
import { CONTRACT_ID, formatYocto } from "../chain/actions.ts";
import { ONE_TAP_ALLOWANCE_NEAR, ONE_TAP_METHODS, WALLET_ONLY_METHODS } from "../chain/oneTap.ts";
import { useOneTap, type OneTapStatus } from "../chain/oneTapSession.ts";
import { useWallet } from "../chain/wallet.tsx";
import { KeycapButton } from "../ui/controls.tsx";

const shortKey = (k: string) => (k.length > 24 ? `${k.slice(0, 14)}…${k.slice(-6)}` : k);

function StatusLine({ status, accountId }: { status: OneTapStatus; accountId: string | null }) {
  switch (status.kind) {
    case "signed-out":
      return <p className="fd-field__hint">Connect a wallet to turn on one-tap play.</p>;
    case "loading":
      return <p className="fd-field__hint">Checking this browser…</p>;
    case "unsupported":
      return (
        <p className="fd-field__hint fd-field__hint--bad" data-testid="one-tap-unsupported">
          One-tap play is not available in this browser: {status.reason} Every action keeps using your wallet.
        </p>
      );
    case "off":
      return <p className="fd-field__hint">One-tap play is off{accountId ? ` for ${accountId}` : ""}. Every action uses your wallet.</p>;
    case "on":
      return (
        <div className="fd-stack" data-testid="one-tap-on">
          <p className="fd-field__hint">
            <strong>On{accountId ? ` for ${accountId}` : ""}.</strong> Key <code>{shortKey(status.publicKey)}</code> · allowance left{" "}
            {status.chain === "ok" ? (status.allowanceYocto === null ? "unlimited" : `${formatYocto(status.allowanceYocto)} NEAR`) : "—"} ·{" "}
            {status.storage === "indexeddb"
              ? "kept in this browser's IndexedDB as a non-exportable key"
              : "kept in this browser's localStorage as raw key bytes, because IndexedDB is blocked here"}
          </p>
          {status.chain === "missing" ? (
            <p className="fd-field__hint fd-field__hint--bad" data-testid="one-tap-missing">
              This key is no longer on your account (deleted elsewhere, or the add did not land). Deposit-free actions use your wallet again; forget
              the key here and turn one-tap play on again if you want it back.
            </p>
          ) : null}
        </div>
      );
  }
}

export function OneTapSettings() {
  const wallet = useWallet();
  const oneTap = useOneTap();
  const { status, busy, error, message, accountId } = oneTap.snapshot;
  const [confirmForget, setConfirmForget] = useState(false);
  const connected = Boolean(wallet.accountId) && status.kind !== "signed-out";

  return (
    <section className="guide-section" aria-labelledby="settings-one-tap-h" data-testid="settings-one-tap">
      <h4 id="settings-one-tap-h" className="fd-h">
        One-tap play
      </h4>
      <p className="fd-note">
        Signs deposit-free game actions in this browser, so they go through without a wallet popup each time. Testnet only, and not yet tried with
        every wallet.
      </p>
      <p className="fd-field__hint" data-testid="one-tap-methods">
        One-tap actions:{" "}
        {ONE_TAP_METHODS.map((m, i) => (
          <span key={m}>
            {i ? ", " : ""}
            <code>{m}</code>
          </span>
        ))}
        .
      </p>
      <p className="fd-field__hint" data-testid="one-tap-wallet-only">
        Still in your wallet, because they attach NEAR (a stake, a catalyst fee, the storage deposit or 1 yoctoNEAR):{" "}
        {WALLET_ONLY_METHODS.map((m, i) => (
          <span key={m}>
            {i ? ", " : ""}
            <code>{m}</code>
          </span>
        ))}
        ; also every market call and any action sent together with the first storage registration.
      </p>
      <p className="fd-field__hint">
        Turning it on asks your wallet once to add a limited key to your own account. That key can only call the actions above on{" "}
        <code>{CONTRACT_ID}</code>, cannot attach NEAR, and can spend at most {ONE_TAP_ALLOWANCE_NEAR} NEAR of gas (its allowance), paid from your
        account. The private key is made in this browser and stays here; it is never sent anywhere, only its public key goes on chain. Anyone who
        could run code on this site in this browser could use it for those actions until you turn it off.
      </p>

      <StatusLine status={status} accountId={accountId} />
      {error ? (
        <p className="fd-field__hint fd-field__hint--bad" role="alert" data-testid="one-tap-error">
          {error}
        </p>
      ) : null}
      {message && !error ? (
        <p className="fd-field__hint" role="status" data-testid="one-tap-message">
          {message}
        </p>
      ) : null}

      {connected && status.kind === "off" ? (
        <div className="fd-row">
          <KeycapButton mono variant="primary" icon="spark" disabled={busy !== null} onClick={() => void oneTap.enable()} data-testid="one-tap-enable">
            {busy === "enabling" ? "waiting for wallet…" : "turn on one-tap play (1 wallet popup)"}
          </KeycapButton>
        </div>
      ) : null}

      {connected && status.kind === "on" ? (
        <>
          <div className="fd-row">
            {status.chain !== "missing" ? (
              <KeycapButton mono icon="close" disabled={busy !== null} onClick={() => void oneTap.disable()} data-testid="one-tap-disable">
                {busy === "disabling" ? "waiting for wallet…" : "turn off (delete the key, 1 wallet popup)"}
              </KeycapButton>
            ) : null}
            <KeycapButton mono disabled={busy !== null} onClick={() => void oneTap.refresh()} data-testid="one-tap-refresh">
              check again
            </KeycapButton>
            {confirmForget ? null : (
              <KeycapButton mono disabled={busy !== null} onClick={() => setConfirmForget(true)} data-testid="one-tap-forget">
                forget on this device
              </KeycapButton>
            )}
          </div>
          {confirmForget ? (
            <div className="fd-stack" role="group" aria-label="confirm forget">
              <p className="fd-field__hint">
                This only removes the key from this browser. It stays on your account (unusable, since only this browser had it) until you delete it
                with &quot;turn off&quot; first or in your wallet&apos;s key list.
              </p>
              <div className="fd-row">
                <KeycapButton
                  mono
                  variant="primary"
                  icon="warn"
                  onClick={() => {
                    setConfirmForget(false);
                    void oneTap.forget();
                  }}
                  data-testid="one-tap-forget-confirm"
                >
                  forget the key here
                </KeycapButton>
                <KeycapButton mono onClick={() => setConfirmForget(false)}>
                  cancel
                </KeycapButton>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
