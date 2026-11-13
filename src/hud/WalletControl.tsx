/**
 * Header wallet control (UI-145): a "connect wallet" key while disconnected; once connected, an
 * account chip with the account id, its spendable testnet NEAR and its `$SNACC` balance
 * (`ft_balance_of`), plus a disconnect key. `$SNACC` on testnet has no monetary value.
 */
import type { WalletApi } from "../chain/wallet.tsx";
import type { AccountInfo } from "../chain/useAccountInfo.ts";
import { formatYocto } from "../chain/actions.ts";
import { explorerAccount } from "../data/nearView.ts";
import { KeycapButton } from "../ui/controls.tsx";
import { Chip, Icon, Tag } from "../ui/fd.tsx";

export interface WalletControlProps {
  wallet: WalletApi;
  info: AccountInfo;
  /** Tighter layout for the phone header. */
  compact?: boolean;
}

/** Shortens long implicit (64-hex) account ids for the chip; named accounts stay whole. */
export function shortAccount(id: string): string {
  return id.length > 24 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}

export function WalletControl({ wallet, info, compact = false }: WalletControlProps) {
  const { status, accountId } = wallet;
  if (status !== "connected" || !accountId) {
    const busy = status === "connecting" || status === "restoring";
    return (
      <div className="fd-ui wallet-ctl flex flex-col items-end gap-1" data-testid="wallet-control">
        <KeycapButton
          variant="primary"
          icon="user"
          mono
          onClick={() => void wallet.connect()}
          disabled={busy}
          aria-haspopup="dialog"
          data-testid="wallet-connect"
        >
          {status === "restoring" ? "restoring wallet…" : status === "connecting" ? "opening wallets…" : "connect wallet"}
        </KeycapButton>
        {wallet.error ? (
          <span className="fd-field__hint fd-field__hint--bad" role="alert">
            {wallet.error}
          </span>
        ) : compact ? null : (
          <span className="font-mono text-[10px] lowercase text-[var(--ink)]">testnet · optional · the app never sees your keys</span>
        )}
      </div>
    );
  }

  return (
    <div className="fd-ui wallet-ctl plate-panel flex flex-col gap-1 px-2.5 py-1.5" data-testid="wallet-chip" aria-label="connected wallet">
      <div className="flex items-center gap-2">
        <Chip dot="live" className="wallet-ctl__acct">
          <a className="fd-a" href={explorerAccount(accountId)} target="_blank" rel="noopener noreferrer" title={accountId}>
            {shortAccount(accountId)} <Icon name="ext" />
          </a>
        </Chip>
        <KeycapButton mono icon="close" onClick={() => void wallet.disconnect()} aria-label={`disconnect ${accountId}`} data-testid="wallet-disconnect">
          {compact ? null : "disconnect"}
        </KeycapButton>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-[var(--ink-hi)]">
        <span data-testid="wallet-near">
          {info.nearYocto === null ? "—" : formatYocto(info.nearYocto)} <span className="text-[var(--ink)]">NEAR</span>
        </span>
        <span data-testid="wallet-snacc">
          {info.snaccYocto === null ? "—" : formatYocto(info.snaccYocto)} <span className="text-[var(--ink)]">$SNACC</span>
        </span>
        <Tag>testnet</Tag>
      </div>
      <span className="font-mono text-[10px] lowercase text-[var(--ink)]">
        {wallet.walletName ? `${wallet.walletName} · ` : ""}$SNACC on testnet has no monetary value
      </span>
    </div>
  );
}
