/**
 * Settings (UI-151): sound on or off and volume, reduce motion (follows the OS unless you override
 * it), the terminology skin, and "Reset local data", which lists the exact localStorage keys it
 * clears. The wallet's own entries are never touched. RES-111 adds "One-tap play"; the reset also
 * deletes this browser's one-tap key database (not the key on the account).
 *
 * UI-161 phase B4: every sentence comes from the `settings` dictionary (English or Indonesian). The
 * Notifications, usage-stats, data-download and admin sections come from `hud/` and `account/` and
 * are not converted yet.
 */
import { useState } from "react";
import { useT } from "../i18n/react.tsx";
import type { MessageKey } from "../i18n/catalog.ts";
import type { SkinMode } from "../config/constants.ts";
import { SkinSwitch } from "../hud/SkinSwitch.tsx";
import { setMotionPref } from "../prefs/motionPref.ts";
import { setSoundPrefs } from "../prefs/applyPrefs.ts";
import {
  APP_LOCAL_KEY_INFO,
  readMotionPref,
  readSoundPrefs,
  resetLocalData,
  type MotionPref,
} from "../prefs/prefs.ts";
import { bioSound } from "../sound.ts";
import { LanguageSettings } from "./LanguageSettings.tsx";
import { NotificationSettings } from "../hud/NotificationsModal.tsx";
import { ONE_TAP_DB } from "../chain/oneTapKeys.ts";
import { useOneTap } from "../chain/oneTapSession.ts";
import { OneTapSettings } from "./OneTapSettings.tsx";
import { AdminTools, MyDataSettings, UsageStatsSettings } from "../account/AccountSettings.tsx";
import { Modal } from "../ui/Modal.tsx";
import { Field, KeycapButton } from "../ui/controls.tsx";
import { Tag } from "../ui/fd.tsx";
import "../ui/fd.css";
import "./guide.css";

export interface SettingsModalProps {
  onClose: () => void;
  skin: SkinMode;
  onSkin: (skin: SkinMode) => void;
}

/** The key NEAR Connect keeps for the chosen wallet; Reset local data never touches it. */
const WALLET_KEY = "selected-wallet";

const MOTION_CHOICES: readonly { id: MotionPref; label: MessageKey }[] = [
  { id: "system", label: "settings.motion.system" },
  { id: "reduce", label: "settings.motion.reduce" },
  { id: "full", label: "settings.motion.full" },
];

function osReducesMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SettingsModal({ onClose, skin, onSkin }: SettingsModalProps) {
  const { t, rich } = useT();
  const [sound, setSound] = useState(() => readSoundPrefs());
  const [motion, setMotion] = useState<MotionPref>(() => readMotionPref());
  const [confirmReset, setConfirmReset] = useState(false);
  const oneTap = useOneTap();
  const volumePct = Math.round(sound.volume * 100);

  const toggleSound = () => {
    const next = setSoundPrefs({ ...sound, on: !sound.on });
    setSound(next);
    if (next.on) bioSound.playClick();
  };

  return (
    <Modal
      title="settings.cfg"
      heading={t("settings.modal.heading")}
      onClose={onClose}
      testId="settings-modal"
      footer={
        <>
          <span>{t("settings.modal.footer")}</span>
          <Tag>{t("settings.modal.tag")}</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <section className="guide-section" aria-labelledby="settings-sound-h">
          <h4 id="settings-sound-h" className="fd-h">
            {t("settings.sound.heading")}
          </h4>
          <div className="fd-row">
            <KeycapButton
              mono
              icon={sound.on ? "check" : "close"}
              role="switch"
              aria-checked={sound.on}
              onClick={toggleSound}
              data-autofocus=""
              data-testid="settings-sound"
            >
              {sound.on ? t("settings.sound.on") : t("settings.sound.off")}
            </KeycapButton>
          </div>
          <Field id="settings-volume" label={t("settings.sound.volume", { pct: volumePct })}>
            <input
              id="settings-volume"
              className="guide-range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={volumePct}
              disabled={!sound.on}
              onChange={(e) => setSound(setSoundPrefs({ ...sound, volume: Number(e.target.value) / 100 }))}
              onPointerUp={() => bioSound.playClick()}
              onKeyUp={() => bioSound.playClick()}
              data-testid="settings-volume"
            />
          </Field>
        </section>

        <section className="guide-section" aria-labelledby="settings-motion-h">
          <h4 id="settings-motion-h" className="fd-h">
            {t("settings.motion.heading")}
          </h4>
          <div className="fd-tabs fd-dither skin-switch" role="group" aria-label={t("settings.motion.group")}>
            {MOTION_CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                className="fd-tab skin-switch__opt"
                aria-pressed={motion === c.id}
                onClick={() => {
                  setMotion(c.id);
                  setMotionPref(c.id);
                }}
                data-testid={`settings-motion-${c.id}`}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
          <p className="fd-field__hint">
            {t("settings.motion.hint", { current: osReducesMotion() ? t("settings.motion.reduceNow") : t("settings.motion.full") })}
          </p>
        </section>

        <section className="guide-section" aria-labelledby="settings-skin-h">
          <h4 id="settings-skin-h" className="fd-h">
            {t("settings.skin.heading")}
          </h4>
          <SkinSwitch skin={skin} onChange={onSkin} />
          <p className="fd-field__hint">{t("settings.skin.hint")}</p>
        </section>

        <LanguageSettings />

        {/* UI-149: shown only when the profile features are on (Supabase env set). */}
        <NotificationSettings />

        {/* OPS-127 / UI-163 / UI-162: usage stats choice, data download, admin tools (each hides itself when not relevant). */}
        {/* RES-111: deposit-free actions without a wallet popup (opt-in). */}
        <OneTapSettings />

        <UsageStatsSettings />
        <MyDataSettings />
        <AdminTools />

        <section className="guide-section" aria-labelledby="settings-data-h">
          <h4 id="settings-data-h" className="fd-h">
            {t("settings.data.heading")}
          </h4>
          <p className="fd-note">
            {rich("settings.data.note", {
              reset: <strong>{t("settings.data.resetName")}</strong>,
              walletKey: <code>{WALLET_KEY}</code>,
              db: <code>{ONE_TAP_DB}</code>,
            })}
          </p>
          <ul className="guide-keys" data-testid="settings-keys">
            {APP_LOCAL_KEY_INFO.map((k) => (
              <li key={k.key}>
                <code>{k.key}</code> · {t(k.label)}
              </li>
            ))}
          </ul>
          {confirmReset ? (
            <div className="fd-row" role="group" aria-label={t("settings.data.confirmGroup")}>
              <KeycapButton
                mono
                variant="primary"
                icon="warn"
                onClick={() => {
                  resetLocalData();
                  // Closes this page's key database connection, then deletes the database.
                  void oneTap.wipeDevice().finally(() => window.location.reload());
                }}
                data-testid="settings-reset-confirm"
              >
                {t("settings.data.confirm")}
              </KeycapButton>
              <KeycapButton mono onClick={() => setConfirmReset(false)}>
                {t("settings.data.cancel")}
              </KeycapButton>
            </div>
          ) : (
            <div className="fd-row">
              <KeycapButton mono icon="close" onClick={() => setConfirmReset(true)} data-testid="settings-reset">
                {t("settings.data.reset")}
              </KeycapButton>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

export default SettingsModal;
