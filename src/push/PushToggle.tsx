/**
 * "Push to this device" (UI-160): one toggle inside the notification settings (`BrowserAlertsToggle`). Turning it on
 * asks the browser for permission, registers the push service worker and subscribes this device; turning it off
 * undoes all three. Browser alerts (UI-149) keep working while a tab is open; push is what reaches a closed one.
 */
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "../account/session.tsx";
import { accountMessageText } from "../i18n/accountText.ts";
import { tEn } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";
import { KeycapButton } from "../ui/controls.tsx";
import { browserPushDeps, disableDevicePush, enableDevicePush, readDeviceState, readPushEnv, pushSupport, type PushDeps, type PushState } from "./client.ts";

/** The English state lines, kept as data (tests compare against them). The screen shows `push.state.*` in the reader's language. */
export const PUSH_TEXT: Record<PushState | "checking", string> = {
  checking: tEn("push.state.checking"),
  off: tEn("push.state.off"),
  on: tEn("push.state.on"),
  blocked: tEn("push.state.blocked"),
  unsupported: tEn("push.state.unsupported"),
  "needs-install": tEn("push.state.needsInstall"),
};

export const PUSH_PRIVACY = tEn("push.privacy");

const STATE_KEYS = {
  checking: "push.state.checking",
  off: "push.state.off",
  on: "push.state.on",
  blocked: "push.state.blocked",
  unsupported: "push.state.unsupported",
  "needs-install": "push.state.needsInstall",
} as const;

export function PushToggleView({
  state,
  busy = false,
  message = null,
  onEnable,
  onDisable,
}: {
  state: PushState | "checking";
  busy?: boolean;
  message?: string | null;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const { t } = useT();
  return (
    <div className="fd-stack" data-testid="push-device" data-state={state}>
      <span className="fd-sub">{t("push.title")}</span>
      {state === "on" ? (
        <div className="fd-row">
          <KeycapButton mono icon="close" onClick={onDisable} disabled={busy} data-testid="push-off">
            {t("push.turnOff")}
          </KeycapButton>
        </div>
      ) : null}
      {state === "off" ? (
        <div className="fd-row">
          <KeycapButton mono icon="warn" onClick={onEnable} disabled={busy} data-testid="push-on">
            {t("push.turnOn")}
          </KeycapButton>
        </div>
      ) : null}
      <p className="fd-field__hint" data-testid="push-state-text">
        {t(STATE_KEYS[state])}
      </p>
      {message ? (
        <p className="fd-field__hint" role="status" data-testid="push-message">
          {accountMessageText(t, message)}
        </p>
      ) : null}
      <p className="fd-field__hint" data-testid="push-privacy">
        {t("push.privacy")}
      </p>
    </div>
  );
}

export function PushToggle() {
  const account = useAccount();
  const { cfg, client, userId } = account;
  const env = useMemo(() => readPushEnv(), []);
  const initial = pushSupport(env);
  const [state, setState] = useState<PushState | "checking">(initial === "ok" ? "checking" : initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const deps = useMemo<PushDeps | null>(() => {
    if (!cfg || !client || !userId) return null;
    return browserPushDeps({
      cfg,
      getAccessToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
      // RLS lets a player read only their own rows, so this answers "is this browser registered for me?".
      serverHasEndpoint: async (endpoint) => {
        const { data, error } = await client.from("push_subscriptions_snacc").select("id").eq("user_id", userId).eq("endpoint", endpoint).limit(1);
        if (error) throw error;
        return (data?.length ?? 0) > 0;
      },
    });
  }, [cfg, client, userId]);

  useEffect(() => {
    if (!deps || initial !== "ok") return;
    let alive = true;
    void readDeviceState(env, deps).then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [env, deps, initial]);

  if (!deps) return null;

  const run = (job: Promise<{ state: PushState; message?: string }>) => {
    setBusy(true);
    setMessage(null);
    void job
      .then((r) => {
        setState(r.state);
        setMessage(r.message ?? null);
      })
      .catch(() => setMessage(tEn("push.messages.generic")))
      .finally(() => setBusy(false));
  };
  // enableDevicePush asks for permission before its first await, so the prompt still counts as a user gesture.
  return <PushToggleView state={state} busy={busy} message={message} onEnable={() => run(enableDevicePush(env, deps))} onDisable={() => run(disableDevicePush(deps))} />;
}
