/**
 * The "sign in to use this" block for windows that need a Snacc profile (UI-153): an explanation plus the
 * same two keys the profile window uses (connect a wallet first, then sign a short message).
 */
import type { ReactNode } from "react";
import { useWallet } from "../chain/wallet.tsx";
import { useAccount } from "../account/session.tsx";
import { accountMessageText } from "../i18n/accountText.ts";
import { useT } from "../i18n/react.tsx";
import { Empty, KeycapButton } from "../ui/controls.tsx";
import type { IconName } from "../ui/fd.tsx";

export function SignInPrompt({ icon = "user", children, testId = "signin-prompt" }: { icon?: IconName; children: ReactNode; testId?: string }) {
  const { t } = useT();
  const account = useAccount();
  const wallet = useWallet();
  return (
    <div className="fd-stack" data-testid={testId}>
      <Empty icon={icon}>{children}</Empty>
      {wallet.status === "connected" ? (
        <KeycapButton variant="primary" mono icon="lock" onClick={() => void account.signIn()} disabled={account.status === "signing"} data-testid={`${testId}-signin`}>
          {account.status === "signing" ? t("hud.account.signing") : t("hud.account.signIn")}
        </KeycapButton>
      ) : (
        <KeycapButton variant="primary" mono icon="user" onClick={() => void wallet.connect()} data-testid={`${testId}-connect`}>
          {t("hud.signIn.connectFirst")}
        </KeycapButton>
      )}
      {account.error ? (
        <p className="fd-field__hint fd-field__hint--bad" role="alert">
          {accountMessageText(t, account.error)}
        </p>
      ) : null}
    </div>
  );
}
