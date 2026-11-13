/**
 * Settings (UI-151): sound on or off and volume, reduce motion (follows the OS unless you override
 * it), the terminology skin, and "Reset local data", which lists the exact localStorage keys it
 * clears. The wallet's own entries are never touched.
 */
import { useState } from "react";
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
import { NotificationSettings } from "../hud/NotificationsModal.tsx";
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

const MOTION_CHOICES: readonly { id: MotionPref; label: string }[] = [
  { id: "system", label: "follow system" },
  { id: "reduce", label: "reduce" },
  { id: "full", label: "full motion" },
];

function osReducesMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SettingsModal({ onClose, skin, onSkin }: SettingsModalProps) {
  const [sound, setSound] = useState(() => readSoundPrefs());
  const [motion, setMotion] = useState<MotionPref>(() => readMotionPref());
  const [confirmReset, setConfirmReset] = useState(false);
  const volumePct = Math.round(sound.volume * 100);

  const toggleSound = () => {
    const next = setSoundPrefs({ ...sound, on: !sound.on });
    setSound(next);
    if (next.on) bioSound.playClick();
  };

  return (
    <Modal
      title="settings.cfg"
      heading="Settings"
      onClose={onClose}
      testId="settings-modal"
      footer={
        <>
          <span>saved in this browser only</span>
          <Tag>local</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <section className="guide-section" aria-labelledby="settings-sound-h">
          <h4 id="settings-sound-h" className="fd-h">
            Sound
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
              sound effects {sound.on ? "on" : "off"}
            </KeycapButton>
          </div>
          <Field id="settings-volume" label={`volume ${volumePct}%`}>
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
            Reduce motion
          </h4>
          <div className="fd-tabs fd-dither skin-switch" role="group" aria-label="reduce motion">
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
                {c.label}
              </button>
            ))}
          </div>
          <p className="fd-field__hint">
            Follow system uses your device setting, which is currently {osReducesMotion() ? "reduce motion" : "full motion"}. Your choice here
            is saved and wins over it.
          </p>
        </section>

        <section className="guide-section" aria-labelledby="settings-skin-h">
          <h4 id="settings-skin-h" className="fd-h">
            Wording
          </h4>
          <SkinSwitch skin={skin} onChange={onSkin} />
          <p className="fd-field__hint">The same mechanics named as a bio-lab or as a fintech desk.</p>
        </section>

        {/* UI-149: shown only when the profile features are on (Supabase env set). */}
        <NotificationSettings />

        {/* OPS-127 / UI-163 / UI-162: usage stats choice, data download, admin tools (each hides itself when not relevant). */}
        <UsageStatsSettings />
        <MyDataSettings />
        <AdminTools />

        <section className="guide-section" aria-labelledby="settings-data-h">
          <h4 id="settings-data-h" className="fd-h">
            Local data
          </h4>
          <p className="fd-note">
            <strong>Reset local data</strong> clears exactly these keys in this browser, then reloads the page. Your wallet&apos;s own entries,
            such as the <code>selected-wallet</code> key NEAR Connect keeps, are not touched. The intro will show again.
          </p>
          <ul className="guide-keys" data-testid="settings-keys">
            {APP_LOCAL_KEY_INFO.map((k) => (
              <li key={k.key}>
                <code>{k.key}</code> · {k.what}
              </li>
            ))}
          </ul>
          {confirmReset ? (
            <div className="fd-row" role="group" aria-label="confirm reset">
              <KeycapButton
                mono
                variant="primary"
                icon="warn"
                onClick={() => {
                  resetLocalData();
                  window.location.reload();
                }}
                data-testid="settings-reset-confirm"
              >
                clear these keys and reload
              </KeycapButton>
              <KeycapButton mono onClick={() => setConfirmReset(false)}>
                cancel
              </KeycapButton>
            </div>
          ) : (
            <div className="fd-row">
              <KeycapButton mono icon="close" onClick={() => setConfirmReset(true)} data-testid="settings-reset">
                reset local data
              </KeycapButton>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

export default SettingsModal;
