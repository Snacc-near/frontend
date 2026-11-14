/**
 * Guest label: a name kept in this browser only. No NEAR account is created, no key is made and
 * nothing is signed; the label is separate from the wallet (`src/chain/wallet.tsx`). A valid `.testnet` account id, if typed,
 * only highlights that account's strains.
 *
 * UI-161 phase B3: text comes from the `social.guest` dictionary.
 */
import { useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import { MAX_LABEL_CHARS, isTestnetAccount, sanitizeLabel, type GuestLabel } from "../auth/guestLabel.ts";
import { useT } from "../i18n/react.tsx";
import { Modal } from "../ui/Modal.tsx";
import { Field, Input, KeycapButton } from "../ui/controls.tsx";
import { Tag } from "../ui/fd.tsx";

export interface GuestLabelModalProps {
  current: GuestLabel | null;
  onSave: (next: GuestLabel) => void;
  onClear: () => void;
  onClose: () => void;
  skin?: SkinMode;
}

export function GuestLabelModal({ current, onSave, onClear, onClose, skin = "biolab" }: GuestLabelModalProps) {
  const { t } = useT();
  const [label, setLabel] = useState(current?.label ?? "");
  const [account, setAccount] = useState(current?.account ?? "");
  const trimmedAccount = account.trim();
  const accountBad = trimmedAccount !== "" && !isTestnetAccount(trimmedAccount);
  const canSave = !accountBad && (sanitizeLabel(label) !== "" || trimmedAccount !== "");

  return (
    <Modal
      title={t("social.guest.title")}
      heading={skin === "fintech" ? t("social.guest.headingFintech") : t("social.guest.headingBiolab")}
      onClose={onClose}
      testId="guest-label-modal"
      footer={
        <>
          <span>{t("social.guest.footer")}</span>
          <Tag>testnet</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <p className="fd-note">
          <strong>{t("social.guest.noteTitle")}</strong>
          {t("social.guest.note")}
        </p>
        <form
          className="fd-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSave({ label: sanitizeLabel(label), account: trimmedAccount || null });
          }}
        >
          <Field id="guest-label-name" label={t("social.guest.labelField")} hint={t("social.guest.labelHint", { max: MAX_LABEL_CHARS })}>
            <Input
              id="guest-label-name"
              data-autofocus=""
              value={label}
              maxLength={MAX_LABEL_CHARS}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("social.guest.placeholder")}
              autoComplete="off"
              aria-describedby="guest-label-name-hint"
            />
          </Field>
          <Field
            id="guest-label-account"
            label={t("social.guest.accountField")}
            bad={accountBad}
            hint={accountBad ? t("social.guest.accountBad") : t("social.guest.accountHint")}
          >
            <Input
              id="guest-label-account"
              value={account}
              onChange={(e) => setAccount(e.target.value.toLowerCase())}
              placeholder="alice.testnet"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={accountBad}
              aria-describedby="guest-label-account-hint"
            />
          </Field>
          <div className="fd-row">
            <KeycapButton type="submit" variant="primary" icon="check" disabled={!canSave}>
              {t("social.guest.save")}
            </KeycapButton>
            {current ? (
              <KeycapButton icon="close" onClick={onClear}>
                {t("social.guest.clear")}
              </KeycapButton>
            ) : null}
          </div>
        </form>
        <div className="fd-stack" aria-label={t("social.guest.plannedLabel")}>
          <p className="fd-sub">{t("social.guest.plannedTitle")}</p>
          <div className="fd-row">
            <KeycapButton icon="lock" disabled aria-describedby="guest-planned-note">
              near.email <Tag>{t("social.guest.planned")}</Tag>
            </KeycapButton>
            <KeycapButton icon="lock" disabled aria-describedby="guest-planned-note">
              {t("social.guest.auth0")} <Tag>{t("social.guest.planned")}</Tag>
            </KeycapButton>
          </div>
          <p id="guest-planned-note" className="fd-field__hint">
            {t("social.guest.plannedNote")}
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default GuestLabelModal;
