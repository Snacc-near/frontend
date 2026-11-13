/**
 * Header controls of the optional profile (UI-148), shown next to the wallet chip:
 * - wallet connected, no session: "Save progress — sign in" (NEAR message signature, no transaction);
 * - signed in: the username (or account) opening the Profile window, a sign-out key that clears only
 *   the profile session (the wallet stays connected).
 * Everything renders nothing when the Supabase env vars are missing.
 */
import { useEffect, useRef, useState } from "react";
import { useWallet } from "../chain/wallet.tsx";
import { accountLabel, useAccount } from "../account/session.tsx";
import { claimStarterPackWithCaptcha, type StarterOutcome } from "../account/model.ts";
import { createCaptchaGate, turnstileSiteKey, type CaptchaGate } from "../account/turnstile.ts";
import { explorerTx } from "../data/nearView.ts";
import { useT } from "../i18n/react.tsx";
import { formatYocto } from "../chain/actions.ts";
import { KeycapButton } from "../ui/controls.tsx";
import { Icon } from "../ui/fd.tsx";
import { shortAccount } from "./WalletControl.tsx";
import "../account/account.css";

export function AccountChip({ compact = false, onOpenProfile }: { compact?: boolean; onOpenProfile: () => void }) {
  const { t } = useT();
  const account = useAccount();
  const wallet = useWallet();
  if (!account.enabled) return null;
  const walletConnected = wallet.status === "connected" && wallet.accountId !== null;

  if (account.status === "signed-in") {
    const label = accountLabel(account);
    return (
      <div className="fd-ui acct-chip" data-testid="account-chip">
        <KeycapButton mono icon="user" onClick={onOpenProfile} aria-haspopup="dialog" title={account.nearAccountId ?? undefined} data-testid="account-open">
          {shortAccount(label)}
        </KeycapButton>
        <KeycapButton mono icon="close" onClick={() => void account.signOut()} aria-label={t("hud.account.signOutAria")} data-testid="account-signout">
          {compact ? null : t("hud.account.signOut")}
        </KeycapButton>
      </div>
    );
  }
  if (!walletConnected) return null;
  const signing = account.status === "signing";
  return (
    <div className="fd-ui acct-chip acct-chip--stack" data-testid="account-chip">
      <KeycapButton mono icon="lock" onClick={() => void account.signIn()} disabled={signing || account.status === "loading"} data-testid="account-signin">
        {signing ? t("hud.account.signing") : t("hud.account.signIn")}
      </KeycapButton>
      {account.error ? (
        <span className="fd-field__hint fd-field__hint--bad acct-chip__err" role="alert" data-testid="account-error">
          {account.error}
        </span>
      ) : compact ? null : (
        <span className="acct-chip__note">{t("hud.account.note")}</span>
      )}
    </div>
  );
}

/** Outcomes shown as a problem (red hint) rather than as a plain note. */
function isStarterProblem(kind: StarterOutcome["kind"]): boolean {
  return kind === "error" || kind === "captcha_failed" || kind === "captcha_unavailable";
}

/**
 * "Get testnet NEAR to start" (UI-148): shown beside the faucet link when the wallet is low. Signs in
 * first when needed, then asks the backend's `starter-pack` function to send a little testnet NEAR.
 */
export function StarterPackButton({
  onSent,
  siteKey = turnstileSiteKey(),
}: {
  onSent?: () => void;
  /** SEC-119: Cloudflare Turnstile site key (`VITE_TURNSTILE_SITE_KEY`). Empty or null: no script, no widget. */
  siteKey?: string | null;
}) {
  const { t } = useT();
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<StarterOutcome | null>(null);
  const captchaEl = useRef<HTMLSpanElement | null>(null);
  const gate = useRef<CaptchaGate | null>(null);
  useEffect(
    () => () => {
      gate.current?.dispose();
      gate.current = null;
    },
    [],
  );
  if (!account.enabled || !account.cfg) return null;
  const cfg = account.cfg;

  const claim = async () => {
    setBusy(true);
    setOut(null);
    try {
      let token = account.accessToken;
      if (!token) {
        const ok = await account.signIn();
        if (!ok) {
          setOut({ kind: "error", message: t("hud.account.signInFirst") });
          return;
        }
        const c = await account.ensureClient();
        token = (await c?.auth.getSession())?.data.session?.access_token ?? null;
      }
      if (!token) {
        setOut({ kind: "error", message: t("hud.account.signInFirst") });
        return;
      }
      // The Turnstile script and widget exist only when a site key is set, and only from the first claim on.
      const captcha = siteKey ? (gate.current ??= createCaptchaGate(siteKey)) : null;
      const result = await claimStarterPackWithCaptcha(cfg, token, captcha, captchaEl.current);
      setOut(result);
      if (result.kind === "sent") onSent?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="acct-starter" data-testid="starter-pack">
      <KeycapButton mono icon="spark" onClick={() => void claim()} disabled={busy || out?.kind === "sent"} data-testid="starter-pack-claim">
        {busy ? t("hud.account.asking") : t("hud.account.getNear")}
      </KeycapButton>
      {siteKey ? <span ref={captchaEl} className="acct-starter__captcha" data-testid="starter-pack-captcha" /> : null}
      {out ? (
        out.kind === "sent" ? (
          <span className="fd-field__hint" role="status" data-testid="starter-pack-sent">
            {t("hud.account.sent", { amount: formatYocto(out.amountYocto) })}{" "}
            <a className="fd-a" href={explorerTx(out.txHash)} target="_blank" rel="noopener noreferrer">
              {t("hud.account.tx", { hash: out.txHash.slice(0, 8) })} <Icon name="ext" />
            </a>
          </span>
        ) : (
          <span className={isStarterProblem(out.kind) ? "fd-field__hint fd-field__hint--bad" : "fd-field__hint"} role="status" data-testid="starter-pack-msg">
            {out.message}
          </span>
        )
      ) : null}
    </span>
  );
}
