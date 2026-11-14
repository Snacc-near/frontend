/**
 * Signed game actions (UI-146): "Hatch a Snacc" (`incubate_strain`) and "Feed" (`feed_strain`),
 * sent through the connected wallet. Each window shows the exact cost before signing, adds the
 * one-time NEP-145 storage registration when the account is not registered yet, and reports the
 * transaction as pending → success (tx hash + explorer link) or failure (plain English + raw error).
 * Only real chain reads are shown; while a read is missing the value is "—".
 *
 * UI-161 phase B2: the text comes from the `actions` dictionary (English or Indonesian).
 */
import { useMemo, useState } from "react";
import {
  DEFAULT_FEED_SNACC,
  DEFAULT_STAKE_NEAR,
  STAKE_PRESETS_NEAR,
  STORAGE_MIN_FALLBACK_YOCTO,
  STRAIN_ROLES,
  TESTNET_FAUCET_URL,
  buildFeed,
  buildIncubate,
  checkStake,
  formatYocto,
  maxGasFeeYocto,
  parseUnits,
  totalDeposit,
  withStorage,
  type ContractCall,
  type StrainRole,
} from "../chain/actions.ts";
import type { AccountInfo } from "../chain/useAccountInfo.ts";
import type { WalletApi } from "../chain/wallet.tsx";
import type { TxResult } from "../chain/txResult.ts";
import { useOneTap } from "../chain/oneTapSession.ts";
import { CONTRACT_ID, explorerTx } from "../data/nearView.ts";
import { useT } from "../i18n/react.tsx";
import { Modal } from "../ui/Modal.tsx";
import { ExtLink, Field, Input, KeycapButton, Select } from "../ui/controls.tsx";
import { Tag } from "../ui/fd.tsx";

export { TESTNET_FAUCET_URL };

/** `oneTap`: RES-111, the call is expected to go out with this browser's one-tap key (no wallet popup). */
export type TxPhase = { kind: "idle" } | { kind: "pending"; oneTap?: boolean } | { kind: "done"; result: TxResult };

export function TxStatusView({ phase }: { phase: TxPhase }) {
  const { t, rich } = useT();
  if (phase.kind === "idle") return null;
  if (phase.kind === "pending") {
    if (phase.oneTap) {
      return (
        <p className="fd-note" role="status" data-testid="tx-pending">
          <strong>{t("actions.tx.pendingOneTapTitle")}</strong> {t("actions.tx.pendingOneTapBody")}
        </p>
      );
    }
    return (
      <p className="fd-note" role="status" data-testid="tx-pending">
        <strong>{t("actions.tx.pendingWalletTitle")}</strong> {t("actions.tx.pendingWalletBody")}
      </p>
    );
  }
  const r = phase.result;
  // RES-111: why a deposit-free action used the wallet after all (one line).
  const notice = r.notice ? (
    <p className="fd-field__hint" data-testid="tx-notice">
      {r.notice}
    </p>
  ) : null;
  if (r.ok) {
    return (
      <div className="fd-note" role="status" data-testid="tx-success">
        {notice}
        <strong>{r.signless ? t("actions.tx.doneOneTap") : t("actions.tx.done")}</strong>{" "}
        {r.txHash ? rich("actions.tx.hashLine", { link: <ExtLink href={explorerTx(r.txHash)}>{`${r.txHash.slice(0, 10)}…`}</ExtLink> }) : t("actions.tx.noHash")}
      </div>
    );
  }
  return (
    <div className="fd-stack" role="alert" data-testid="tx-failure">
      {notice}
      <p className="fd-field__hint fd-field__hint--bad">{r.message}</p>
      {r.txHash ? <p className="fd-field__hint">{rich("actions.tx.hashLine", { link: <ExtLink href={explorerTx(r.txHash)}>{`${r.txHash.slice(0, 10)}…`}</ExtLink> })}</p> : null}
      <details className="fd-field__hint">
        <summary>{t("actions.tx.details")}</summary>
        <code className="break-all">{r.raw.slice(0, 600)}</code>
      </details>
    </div>
  );
}

/** One line on the NEP-145 storage registration the first signed call carries. */
export function StorageLine({ info }: { info: AccountInfo }) {
  const { rich } = useT();
  if (info.storage?.registered) return null;
  const min = info.storage?.minYocto ?? STORAGE_MIN_FALLBACK_YOCTO;
  return (
    <p className="fd-field__hint" data-testid="storage-line">
      {rich("actions.tx.storage", { method: <code>storage_deposit</code>, amount: formatYocto(min) })}
    </p>
  );
}

/** Shown when the account cannot cover the attached NEAR plus the gas ceiling. */
export function FaucetLine({ needYocto, info }: { needYocto: string; info: AccountInfo }) {
  const { t, rich } = useT();
  if (info.nearYocto === null || BigInt(info.nearYocto) >= BigInt(needYocto)) return null;
  return (
    <p className="fd-field__hint fd-field__hint--bad" data-testid="faucet-line">
      {rich("actions.tx.faucet", {
        have: formatYocto(info.nearYocto),
        need: formatYocto(needYocto),
        link: <ExtLink href={TESTNET_FAUCET_URL}>{t("actions.tx.faucetLink")}</ExtLink>,
      })}
    </p>
  );
}

export function plan(call: ContractCall | null, accountId: string, info: AccountInfo): ContractCall[] {
  if (!call) return [];
  return withStorage(call, {
    accountId,
    registered: info.storage?.registered ?? false,
    minYocto: info.storage?.minYocto ?? STORAGE_MIN_FALLBACK_YOCTO,
  });
}

/**
 * The send step of `useSend`: pending ("sending with one-tap" when the one-tap key is expected to
 * sign) → back to "waiting for your wallet" the moment the wallet is asked after all (a one-tap
 * fallback) → done.
 */
export async function runSend(wallet: Pick<WalletApi, "signAndSend">, calls: ContractCall[], oneTapLikely: boolean, setPhase: (p: TxPhase) => void): Promise<TxResult> {
  setPhase({ kind: "pending", oneTap: oneTapLikely });
  const result = await wallet.signAndSend(calls, undefined, { onWalletPrompt: () => setPhase({ kind: "pending", oneTap: false }) });
  setPhase({ kind: "done", result });
  return result;
}

export function useSend(wallet: WalletApi, onDone: (ok: boolean, txHash?: string | null) => void) {
  const [phase, setPhase] = useState<TxPhase>({ kind: "idle" });
  const oneTap = useOneTap();
  const send = async (calls: ContractCall[]) => {
    if (calls.length === 0) return;
    const result = await runSend(wallet, calls, oneTap.covers(calls), setPhase);
    // UI-148: the hash goes along so the app can record the activity (fire and forget).
    onDone(result.ok, result.txHash);
  };
  return { phase, send };
}

export function Footer() {
  const { t } = useT();
  const st = useOneTap().snapshot.status;
  const oneTapOn = st.kind === "on" && st.chain !== "missing" && !st.outdated;
  return (
    <>
      <span>{t("actions.footer.line", { mode: oneTapOn ? t("actions.footer.oneTapOn") : t("actions.footer.walletOnly"), contract: CONTRACT_ID })}</span>
      <Tag>testnet</Tag>
    </>
  );
}

export interface ChainActionProps {
  wallet: WalletApi;
  info: AccountInfo;
  onClose: () => void;
  /** Called after the chain answers; `ok` true means the views should refresh. */
  onDone: (ok: boolean, txHash?: string | null) => void;
}

export function HatchModal({ wallet, info, onClose, onDone }: ChainActionProps) {
  const { t, rich } = useT();
  const [role, setRole] = useState<StrainRole>("Extractor");
  const [stake, setStake] = useState(DEFAULT_STAKE_NEAR);
  const { phase, send } = useSend(wallet, onDone);
  const check = checkStake(stake);
  const accountId = wallet.accountId ?? "";
  const calls = useMemo(
    () => plan(check.ok ? buildIncubate({ role, stakeYocto: check.yocto }) : null, accountId, info),
    [check.ok, check.ok ? check.yocto : "", role, accountId, info],
  );
  const attached = totalDeposit(calls);
  const gasCap = maxGasFeeYocto(calls);
  const need = (BigInt(attached) + BigInt(gasCap)).toString();
  const busy = phase.kind === "pending";
  const done = phase.kind === "done" && phase.result.ok;

  return (
    <Modal title="hatch.tx" heading={t("actions.hatch.heading")} onClose={onClose} testId="hatch-modal" footer={<Footer />}>
      <div className="fd-stack">
        <p className="fd-note">
          <strong>{t("actions.hatch.noteTitle")}</strong> {rich("actions.hatch.noteBody", { account: <code>{accountId}</code> })}
        </p>
        <div className="fd-form-grid">
          <Field id="hatch-role" label={t("actions.hatch.role")} hint={t(`actions.hatch.roleHint.${role}`)}>
            <Select id="hatch-role" value={role} onChange={(e) => setRole(e.target.value as StrainRole)} disabled={busy} aria-describedby="hatch-role-hint">
              {STRAIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="hatch-stake" label={t("actions.hatch.stake")} bad={!check.ok} hint={check.ok ? t("actions.hatch.stakeHint") : check.reason}>
            <Input
              id="hatch-stake"
              data-autofocus=""
              inputMode="decimal"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              disabled={busy}
              aria-invalid={!check.ok}
              aria-describedby="hatch-stake-hint"
              autoComplete="off"
            />
          </Field>
        </div>
        <div className="fd-row" role="group" aria-label={t("actions.hatch.presets")}>
          {STAKE_PRESETS_NEAR.map((p) => (
            <KeycapButton key={p} mono onClick={() => setStake(p)} disabled={busy} aria-pressed={stake === p}>
              {p} NEAR
            </KeycapButton>
          ))}
        </div>
        <dl className="fd-kv" data-testid="hatch-cost">
          <div className="fd-kv__row">
            <dt>{t("actions.shared.attached")}</dt>
            <dd className="fd-kv__num">{check.ok ? t("actions.shared.nearAmount", { amount: formatYocto(attached) }) : "—"}</dd>
          </div>
          <div className="fd-kv__row">
            <dt>{t("actions.shared.gasAtMost")}</dt>
            <dd className="fd-kv__num">{check.ok ? t("actions.shared.gasValue", { amount: formatYocto(gasCap) }) : "—"}</dd>
          </div>
          <div className="fd-kv__row">
            <dt>{t("actions.hatch.yourNear")}</dt>
            <dd className="fd-kv__num">{info.nearYocto === null ? "—" : t("actions.shared.nearAmount", { amount: formatYocto(info.nearYocto) })}</dd>
          </div>
        </dl>
        <StorageLine info={info} />
        {check.ok ? <FaucetLine needYocto={need} info={info} /> : null}
        <TxStatusView phase={phase} />
        <div className="fd-row">
          {done ? (
            <KeycapButton variant="primary" icon="check" onClick={onClose}>
              {t("actions.shared.close")}
            </KeycapButton>
          ) : (
            <KeycapButton variant="primary" icon="spark" disabled={!check.ok || busy} onClick={() => void send(calls)} data-testid="hatch-sign">
              {busy ? t("actions.shared.waitingWallet") : t("actions.hatch.sign")}
            </KeycapButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

export interface FeedModalProps extends ChainActionProps {
  /** Strain selected on the plate, used as the default when the account owns it. */
  preferredStrainId: number | null;
}

export function FeedModal({ wallet, info, onClose, onDone, preferredStrainId }: FeedModalProps) {
  const { t } = useT();
  const owned = info.colony ?? [];
  const initial = owned.find((s) => s.strain_id === preferredStrainId)?.strain_id ?? owned[0]?.strain_id ?? null;
  const [strainId, setStrainId] = useState<number | null>(initial);
  const [amount, setAmount] = useState(DEFAULT_FEED_SNACC);
  const { phase, send } = useSend(wallet, onDone);
  const amountYocto = parseUnits(amount, 24);
  const amountOk = amountYocto !== null && BigInt(amountYocto) > 0n;
  const accountId = wallet.accountId ?? "";
  const effectiveId = strainId ?? initial;
  const calls = useMemo(
    () => plan(amountOk && effectiveId !== null ? buildFeed({ strainId: effectiveId, amountYocto: amountYocto! }) : null, accountId, info),
    [amountOk, amountYocto, effectiveId, accountId, info],
  );
  const need = (BigInt(totalDeposit(calls)) + BigInt(maxGasFeeYocto(calls))).toString();
  const inStrains =
    info.wealthYocto !== null && info.snaccYocto !== null ? (BigInt(info.wealthYocto) - BigInt(info.snaccYocto)).toString() : null;
  const busy = phase.kind === "pending";
  const done = phase.kind === "done" && phase.result.ok;

  return (
    <Modal title="feed.tx" heading={t("actions.feed.heading")} onClose={onClose} testId="feed-modal" footer={<Footer />}>
      <div className="fd-stack">
        <p className="fd-note">
          <strong>{t("actions.feed.noteTitle")}</strong> {t("actions.feed.noteBody")}
        </p>
        {info.colony === null ? (
          <p className="fd-field__hint" role="status">
            {info.loading ? t("actions.shared.readingColony") : t("actions.feed.colonyFailed")}
          </p>
        ) : owned.length === 0 ? (
          <p className="fd-field__hint" role="status" data-testid="feed-empty">
            {t("actions.feed.empty")}
          </p>
        ) : (
          <div className="fd-form-grid">
            <Field id="feed-strain" label={t("actions.shared.yourSnacc")}>
              <Select id="feed-strain" value={effectiveId ?? ""} onChange={(e) => setStrainId(Number(e.target.value))} disabled={busy}>
                {owned.map((s) => (
                  <option key={s.strain_id} value={s.strain_id}>
                    {t("actions.feed.option", { id: s.strain_id, vitality: s.effective_vitality.toLocaleString("en-US"), status: s.status })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="feed-amount" label={t("actions.feed.amount")} bad={!amountOk} hint={amountOk ? t("actions.feed.amountHint") : t("actions.feed.amountBad")}>
              <Input
                id="feed-amount"
                data-autofocus=""
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
                aria-invalid={!amountOk}
                aria-describedby="feed-amount-hint"
                autoComplete="off"
              />
            </Field>
          </div>
        )}
        <dl className="fd-kv">
          <div className="fd-kv__row">
            <dt>{t("actions.feed.inSnaccs")}</dt>
            <dd className="fd-kv__num">{inStrains === null ? "—" : t("actions.feed.inSnaccsValue", { amount: formatYocto(inStrains) })}</dd>
          </div>
          <div className="fd-kv__row">
            <dt>{t("actions.shared.gasAtMost")}</dt>
            <dd className="fd-kv__num">{calls.length ? t("actions.shared.gasValue", { amount: formatYocto(maxGasFeeYocto(calls)) }) : "—"}</dd>
          </div>
        </dl>
        <StorageLine info={info} />
        {calls.length ? <FaucetLine needYocto={need} info={info} /> : null}
        <TxStatusView phase={phase} />
        <div className="fd-row">
          {done ? (
            <KeycapButton variant="primary" icon="check" onClick={onClose}>
              {t("actions.shared.close")}
            </KeycapButton>
          ) : (
            <KeycapButton variant="primary" icon="spark" disabled={calls.length === 0 || busy} onClick={() => void send(calls)} data-testid="feed-sign">
              {busy ? (phase.kind === "pending" && phase.oneTap ? t("actions.shared.sendingOneTap") : t("actions.shared.waitingWallet")) : t("actions.feed.sign")}
            </KeycapButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default HatchModal;
