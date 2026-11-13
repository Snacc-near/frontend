/**
 * Guest label: a name kept in this browser only. No NEAR account is created, no key is made and
 * nothing is signed; the label is separate from the wallet (`src/chain/wallet.tsx`). A valid `.testnet` account id, if typed,
 * only highlights that account's strains.
 */
import { useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import { MAX_LABEL_CHARS, isTestnetAccount, sanitizeLabel, type GuestLabel } from "../auth/guestLabel.ts";
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
  const [label, setLabel] = useState(current?.label ?? "");
  const [account, setAccount] = useState(current?.account ?? "");
  const trimmedAccount = account.trim();
  const accountBad = trimmedAccount !== "" && !isTestnetAccount(trimmedAccount);
  const canSave = !accountBad && (sanitizeLabel(label) !== "" || trimmedAccount !== "");

  return (
    <Modal
      title="guest-label.cfg"
      heading={skin === "fintech" ? "Guest desk label" : "Guest label"}
      onClose={onClose}
      testId="guest-label-modal"
      footer={
        <>
          <span>local only · no on-chain account · nothing is signed</span>
          <Tag>testnet</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <p className="fd-note">
          <strong>Guest label — local only, no on-chain account, nothing is signed.</strong> The label is saved in this browser and
          nowhere else. It is separate from the wallet: to sign testnet transactions, use connect wallet in the header.
        </p>
        <form
          className="fd-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSave({ label: sanitizeLabel(label), account: trimmedAccount || null });
          }}
        >
          <Field id="guest-label-name" label="display label" hint={`Up to ${MAX_LABEL_CHARS} characters, shown in the header.`}>
            <Input
              id="guest-label-name"
              data-autofocus=""
              value={label}
              maxLength={MAX_LABEL_CHARS}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. night shift"
              autoComplete="off"
              aria-describedby="guest-label-name-hint"
            />
          </Field>
          <Field
            id="guest-label-account"
            label="highlight a testnet account (optional)"
            bad={accountBad}
            hint={accountBad ? "Use a NEAR testnet account id ending in .testnet, e.g. alice.testnet." : "Strains owned by this account get highlighted. Nothing is read from or sent to it."}
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
              save label
            </KeycapButton>
            {current ? (
              <KeycapButton icon="close" onClick={onClear}>
                clear label
              </KeycapButton>
            ) : null}
          </div>
        </form>
        <div className="fd-stack" aria-label="planned sign-in options">
          <p className="fd-sub">planned, not available</p>
          <div className="fd-row">
            <KeycapButton icon="lock" disabled aria-describedby="guest-planned-note">
              near.email <Tag>planned</Tag>
            </KeycapButton>
            <KeycapButton icon="lock" disabled aria-describedby="guest-planned-note">
              Auth0 <Tag>planned</Tag>
            </KeycapButton>
          </div>
          <p id="guest-planned-note" className="fd-field__hint">
            These two sign-in options are not built and do nothing today.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default GuestLabelModal;
