/**
 * "Push to this device" (UI-160): one toggle inside the notification settings (`BrowserAlertsToggle`). Turning it on
 * asks the browser for permission, registers the push service worker and subscribes this device; turning it off
 * undoes all three. Browser alerts (UI-149) keep working while a tab is open; push is what reaches a closed one.
 */
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "../account/session.tsx";
import { KeycapButton } from "../ui/controls.tsx";
import { browserPushDeps, disableDevicePush, enableDevicePush, readDeviceState, readPushEnv, pushSupport, type PushDeps, type PushState } from "./client.ts";

export const PUSH_TEXT: Record<PushState | "checking", string> = {
  checking: "Checking this device…",
  off: "Off. Turn it on to get a notification on this device even when Snacc is closed. The browser asks for permission first.",
  on: "On for this device. Alerts about hungry Snaccs, lost Snaccs and announcements arrive even when Snacc is closed.",
  blocked: "The browser blocks notifications for this site. Allow them in the site settings, then come back here to turn push on.",
  unsupported: "This browser cannot receive push notifications.",
  "needs-install":
    "On iPhone and iPad, push works only for the installed app (iOS 16.4 or later): open the Share menu, choose Add to Home Screen, then open Snacc from the home screen and turn push on there.",
};

export const PUSH_PRIVACY =
  "What is sent: only the notification text, for example “Snacc #7 is starving”, encrypted end to end and delivered through your browser's push service (Google, Mozilla or Apple). Snacc keeps this device's push address with your profile, never a wallet key. Delivery is best effort and can lag by a minute. Turning it off or signing out removes this device.";

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
  return (
    <div className="fd-stack" data-testid="push-device" data-state={state}>
      <span className="fd-sub">Push to this device</span>
      {state === "on" ? (
        <div className="fd-row">
          <KeycapButton mono icon="close" onClick={onDisable} disabled={busy} data-testid="push-off">
            turn off push to this device
          </KeycapButton>
        </div>
      ) : null}
      {state === "off" ? (
        <div className="fd-row">
          <KeycapButton mono icon="warn" onClick={onEnable} disabled={busy} data-testid="push-on">
            turn on push to this device
          </KeycapButton>
        </div>
      ) : null}
      <p className="fd-field__hint" data-testid="push-state-text">
        {PUSH_TEXT[state]}
      </p>
      {message ? (
        <p className="fd-field__hint" role="status" data-testid="push-message">
          {message}
        </p>
      ) : null}
      <p className="fd-field__hint" data-testid="push-privacy">
        {PUSH_PRIVACY}
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
      .catch(() => setMessage("Something went wrong. Try again."))
      .finally(() => setBusy(false));
  };
  // enableDevicePush asks for permission before its first await, so the prompt still counts as a user gesture.
  return <PushToggleView state={state} busy={busy} message={message} onEnable={() => run(enableDevicePush(env, deps))} onDisable={() => run(disableDevicePush(deps))} />;
}
