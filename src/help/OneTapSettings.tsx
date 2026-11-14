/**
 * Settings → One-tap play (RES-111). Turning it on asks the wallet once to add a limited key to the
 * player's own account; deposit-free game actions are then signed in this browser without a popup.
 * The copy says which actions, what still uses the wallet, the allowance, where the key lives and
 * how to remove it. Status: tried with the logic tests and fakes only, not yet with every wallet.
 *
 * UI-161 phase B4: the copy comes from the `onetap` dictionary (English or Indonesian). Method names
 * and the contract id are code and are never translated.
 */
import { useState } from "react";
import { CONTRACT_ID, formatYocto } from "../chain/actions.ts";
import { ATTACHES_NEAR_METHODS, ONE_TAP_ALLOWANCE_NEAR, ONE_TAP_METHODS, PAYS_OTHER_METHODS } from "../chain/oneTap.ts";
import { useOneTap, type OneTapStatus } from "../chain/oneTapSession.ts";
import { useWallet } from "../chain/wallet.tsx";
import { useT } from "../i18n/react.tsx";
import { KeycapButton } from "../ui/controls.tsx";

const shortKey = (k: string) => (k.length > 24 ? `${k.slice(0, 14)}…${k.slice(-6)}` : k);

function StatusLine({ status, accountId }: { status: OneTapStatus; accountId: string | null }) {
  const { t, rich } = useT();
  switch (status.kind) {
    case "signed-out":
      return <p className="fd-field__hint">{t("onetap.status.signedOut")}</p>;
    case "loading":
      return <p className="fd-field__hint">{t("onetap.status.loading")}</p>;
    case "unsupported":
      return (
        <p className="fd-field__hint fd-field__hint--bad" data-testid="one-tap-unsupported">
          {t("onetap.status.unsupported", { reason: status.reason })}
        </p>
      );
    case "off":
      return <p className="fd-field__hint">{accountId ? t("onetap.status.offFor", { account: accountId }) : t("onetap.status.off")}</p>;
    case "on":
      return (
        <div className="fd-stack" data-testid="one-tap-on">
          <p className="fd-field__hint">
            {rich("onetap.status.onLine", {
              state: <strong>{accountId ? t("onetap.status.onFor", { account: accountId }) : t("onetap.status.on")}</strong>,
              key: <code>{shortKey(status.publicKey)}</code>,
              allowance:
                status.chain === "ok" ? (status.allowanceYocto === null ? t("onetap.status.unlimited") : `${formatYocto(status.allowanceYocto)} NEAR`) : "—",
              where: status.storage === "indexeddb" ? t("onetap.status.indexeddb") : t("onetap.status.localstorage"),
            })}
          </p>
          {status.chain === "missing" ? (
            <p className="fd-field__hint fd-field__hint--bad" data-testid="one-tap-missing">
              {t("onetap.status.missing")}
            </p>
          ) : status.outdated ? (
            <p className="fd-field__hint fd-field__hint--bad" data-testid="one-tap-outdated">
              {t("onetap.status.outdated")}
            </p>
          ) : null}
        </div>
      );
  }
}

const codeList = (methods: readonly string[]) =>
  methods.map((m, i) => (
    <span key={m}>
      {i ? ", " : ""}
      <code>{m}</code>
    </span>
  ));

export function OneTapSettings() {
  const { t, rich } = useT();
  const wallet = useWallet();
  const oneTap = useOneTap();
  const { status, busy, error, message, accountId } = oneTap.snapshot;
  const [confirmForget, setConfirmForget] = useState(false);
  const connected = Boolean(wallet.accountId) && status.kind !== "signed-out";

  return (
    <section className="guide-section" aria-labelledby="settings-one-tap-h" data-testid="settings-one-tap">
      <h4 id="settings-one-tap-h" className="fd-h">
        {t("onetap.heading")}
      </h4>
      <p className="fd-note">{t("onetap.intro")}</p>
      <p className="fd-field__hint" data-testid="one-tap-methods">
        {rich("onetap.methods", { count: ONE_TAP_METHODS.length, list: codeList(ONE_TAP_METHODS) })}
      </p>
      <p className="fd-field__hint" data-testid="one-tap-wallet-only">
        {rich("onetap.walletOnly", { attaches: codeList(ATTACHES_NEAR_METHODS), paysOther: codeList(PAYS_OTHER_METHODS) })}
      </p>
      <p className="fd-field__hint">
        {rich("onetap.key", { contract: <code>{CONTRACT_ID}</code>, allowance: ONE_TAP_ALLOWANCE_NEAR })}
      </p>
      <p className="fd-field__hint" data-testid="one-tap-sign-out">
        {t("onetap.signOut")}
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
            {busy === "enabling" ? t("onetap.button.waiting") : t("onetap.button.enable")}
          </KeycapButton>
        </div>
      ) : null}

      {connected && status.kind === "on" ? (
        <>
          <div className="fd-row">
            {status.chain !== "missing" && status.outdated ? (
              <KeycapButton mono variant="primary" icon="spark" disabled={busy !== null} onClick={() => void oneTap.replace()} data-testid="one-tap-replace">
                {busy ? t("onetap.button.waiting") : t("onetap.button.replace")}
              </KeycapButton>
            ) : null}
            {status.chain !== "missing" ? (
              <KeycapButton mono icon="close" disabled={busy !== null} onClick={() => void oneTap.disable()} data-testid="one-tap-disable">
                {busy === "disabling" ? t("onetap.button.waiting") : t("onetap.button.disable")}
              </KeycapButton>
            ) : null}
            <KeycapButton mono disabled={busy !== null} onClick={() => void oneTap.refresh()} data-testid="one-tap-refresh">
              {t("onetap.button.refresh")}
            </KeycapButton>
            {confirmForget ? null : (
              <KeycapButton mono disabled={busy !== null} onClick={() => setConfirmForget(true)} data-testid="one-tap-forget">
                {t("onetap.button.forget")}
              </KeycapButton>
            )}
          </div>
          {confirmForget ? (
            <div className="fd-stack" role="group" aria-label={t("onetap.confirmForget.group")}>
              <p className="fd-field__hint">{t("onetap.confirmForget.note")}</p>
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
                  {t("onetap.button.forgetConfirm")}
                </KeycapButton>
                <KeycapButton mono onClick={() => setConfirmForget(false)}>
                  {t("onetap.button.cancel")}
                </KeycapButton>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
