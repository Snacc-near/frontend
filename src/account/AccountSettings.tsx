/**
 * Settings sections that talk to the Snacc profile database or the usage-stats endpoint:
 * - UsageStatsSettings (OPS-127): turn anonymous usage stats and error reports on or off.
 * - MyDataSettings (UI-163): download everything the profile database holds about you (JSON).
 * - AdminTools (UI-162, OPS-127): shown only to admins (`snacc_is_admin()`): broadcast an announcement,
 *   reset a player's username/bio, block a word, and the funnel / retention / top-errors view.
 */
import { useEffect, useId, useState } from "react";
import { useAccount } from "./session.tsx";
import {
  adminBlockTerm,
  adminBroadcast,
  adminMetrics,
  adminResetProfileText,
  amIAdmin,
  exportMyData,
  type AdminMetrics,
} from "./api.ts";
import { accountMessageText } from "../i18n/accountText.ts";
import { useT } from "../i18n/react.tsx";
import { browserOptedOut, readTelemetryChoice, setTelemetryChoice } from "../telemetry.ts";
import { Field, Input, KeycapButton, Select } from "../ui/controls.tsx";

/** File name for the export download, e.g. `snacc-data-alice.testnet-2026-11-13.json`. */
export function exportFileName(account: string | null, now = new Date()): string {
  const who = (account ?? "player").replace(/[^a-z0-9._-]/gi, "_").slice(0, 64);
  return `snacc-data-${who}-${now.toISOString().slice(0, 10)}.json`;
}

function download(name: string, json: unknown): void {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function UsageStatsSettings() {
  const { t, rich } = useT();
  const [on, setOn] = useState(() => {
    const choice = readTelemetryChoice();
    return choice === "on" || (choice === null && !browserOptedOut());
  });
  const account = useAccount();
  if (!account.enabled) return null;
  const dnt = browserOptedOut();
  return (
    <section className="guide-section" aria-labelledby="settings-stats-h" data-testid="settings-stats">
      <h4 id="settings-stats-h" className="fd-h">
        {t("account.usage.title")}
      </h4>
      <p className="fd-field__hint">
        {rich("account.usage.hint", {
          privacy: (
            <a className="fd-a" href="/privacy#usage-stats">
              {t("account.usage.privacyPage")}
            </a>
          ),
        })}
        {dnt ? ` ${t("account.usage.dnt")}` : ""}
      </p>
      <KeycapButton
        mono
        icon={on ? "check" : "close"}
        role="switch"
        aria-checked={on}
        onClick={() => {
          setTelemetryChoice(!on);
          setOn(!on);
        }}
        data-testid="settings-stats-toggle"
      >
        {t("account.usage.toggle")}
      </KeycapButton>
    </section>
  );
}

export function MyDataSettings() {
  const { t } = useT();
  const account = useAccount();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!account.enabled) return null;
  const signedIn = account.status === "signed-in" && account.client !== null;
  return (
    <section className="guide-section" aria-labelledby="settings-mydata-h" data-testid="settings-mydata">
      <h4 id="settings-mydata-h" className="fd-h">
        {t("account.data.title")}
      </h4>
      {signedIn ? (
        <>
          <p className="fd-field__hint">{t("account.data.hint")}</p>
          <div className="fd-row">
            <KeycapButton
              mono
              icon="check"
              disabled={busy}
              data-testid="settings-export"
              onClick={async () => {
                if (!account.client) return;
                setBusy(true);
                const { data, error } = await exportMyData(account.client);
                setBusy(false);
                if (error) return setMsg(error);
                download(exportFileName(account.nearAccountId), data);
                setMsg(t("account.data.downloaded"));
              }}
            >
              {busy ? t("account.data.preparing") : t("account.data.download")}
            </KeycapButton>
          </div>
        </>
      ) : (
        <p className="fd-field__hint">{t("account.data.signIn")}</p>
      )}
      {msg ? (
        <p className="fd-field__hint" role="status">
          {accountMessageText(t, msg)}
        </p>
      ) : null}
    </section>
  );
}

function MetricsTable({ m }: { m: AdminMetrics }) {
  const { t } = useT();
  return (
    <div className="fd-stack" data-testid="admin-metrics">
      <table className="guide-table">
        <caption className="fd-sub">{t("account.metrics.funnel")}</caption>
        <thead>
          <tr>
            <th>{t("account.metrics.day")}</th>
            <th>{t("account.metrics.landing")}</th>
            <th>{t("account.metrics.app")}</th>
            <th>{t("account.metrics.introDone")}</th>
            <th>{t("account.metrics.wallet")}</th>
            <th>{t("account.metrics.signedIn")}</th>
            <th>{t("account.metrics.txOk")}</th>
            <th>{t("account.metrics.errors")}</th>
          </tr>
        </thead>
        <tbody>
          {m.funnel.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.landing}</td>
              <td>{d.app}</td>
              <td>{d.onboarding_done}</td>
              <td>{d.wallet_connected}</td>
              <td>{d.signed_in}</td>
              <td>{d.tx_succeeded}</td>
              <td>{d.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="guide-table">
        <caption className="fd-sub">{t("account.metrics.retention")}</caption>
        <thead>
          <tr>
            <th>{t("account.metrics.cohort")}</th>
            <th>{t("account.metrics.devices")}</th>
            <th>{t("account.metrics.d1")}</th>
            <th>{t("account.metrics.d7")}</th>
          </tr>
        </thead>
        <tbody>
          {m.retention.map((r) => (
            <tr key={r.cohort}>
              <td>{r.cohort}</td>
              <td>{r.devices}</td>
              <td>{r.d1}</td>
              <td>{r.d7}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="guide-keys">
        {m.top_errors.length === 0 ? <li>{t("account.metrics.noErrors")}</li> : null}
        {m.top_errors.map((e, i) => (
          <li key={i}>
            <code>{e.name}</code> ×{e.n} · {e.route} · {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminTools() {
  const { t } = useT();
  const account = useAccount();
  const uid = useId();
  const [admin, setAdmin] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [days, setDays] = useState(7);
  const [target, setTarget] = useState("");
  const [term, setTerm] = useState("");
  const [termKind, setTermKind] = useState<"abusive" | "reserved">("abusive");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const client = account.status === "signed-in" ? account.client : null;

  useEffect(() => {
    if (!client) return;
    let alive = true;
    void amIAdmin(client).then((yes) => alive && setAdmin(yes));
    return () => {
      alive = false;
    };
  }, [client]);

  if (!client || !admin) return null;
  const say = (r: { error: string | null }, okText: string) => setMsg(r.error ?? okText);

  return (
    <section className="guide-section" aria-labelledby="settings-admin-h" data-testid="settings-admin">
      <h4 id="settings-admin-h" className="fd-h">
        {t("account.admin.title")}
      </h4>
      <p className="fd-field__hint">{t("account.admin.hint")}</p>
      <div className="fd-stack">
        <Field id={`${uid}-t`} label={t("account.admin.announceTitle")} hint={t("account.admin.announceTitleHint")}>
          <Input id={`${uid}-t`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id={`${uid}-b`} label={t("account.admin.announceText")} hint={t("account.admin.announceTextHint")}>
          <Input id={`${uid}-b`} value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field id={`${uid}-d`} label={t("account.admin.days")}>
          <Input id={`${uid}-d`} type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value) || 7)} />
        </Field>
        <div className="fd-row">
          <KeycapButton
            mono
            icon="warn"
            disabled={title.trim().length < 3}
            data-testid="admin-broadcast"
            onClick={async () => {
              const r = await adminBroadcast(client, title.trim(), body.trim(), days);
              say(r, t("account.admin.sent", { n: r.data ?? 0 }));
              if (!r.error) {
                setTitle("");
                setBody("");
              }
            }}
          >
            {t("account.admin.broadcast")}
          </KeycapButton>
        </div>
        <Field id={`${uid}-a`} label={t("account.admin.resetLabel")}>
          <Input id={`${uid}-a`} value={target} placeholder="someone.testnet" onChange={(e) => setTarget(e.target.value.trim().toLowerCase())} />
        </Field>
        <div className="fd-row">
          <KeycapButton
            mono
            icon="close"
            disabled={target.length < 2}
            onClick={async () => {
              const r = await adminResetProfileText(client, target);
              say(r, r.data ? t("account.admin.resetDone", { account: target }) : t("account.admin.resetNone", { account: target }));
            }}
          >
            {t("account.admin.reset")}
          </KeycapButton>
        </div>
        <Field id={`${uid}-w`} label={t("account.admin.blockLabel")} hint={t("account.admin.blockHint")}>
          <Input id={`${uid}-w`} value={term} onChange={(e) => setTerm(e.target.value)} />
        </Field>
        <div className="fd-row">
          <Select aria-label={t("account.admin.wordKind")} value={termKind} onChange={(e) => setTermKind(e.target.value as "abusive" | "reserved")}>
            <option value="abusive">{t("account.admin.abusive")}</option>
            <option value="reserved">{t("account.admin.reserved")}</option>
          </Select>
          <KeycapButton
            mono
            icon="close"
            disabled={term.trim().length < 3}
            onClick={async () => say(await adminBlockTerm(client, term.trim(), termKind), t("account.admin.blocked"))}
          >
            {t("account.admin.blockButton")}
          </KeycapButton>
        </div>
        <div className="fd-row">
          <KeycapButton
            mono
            icon="check"
            data-testid="admin-metrics-load"
            onClick={async () => {
              const r = await adminMetrics(client, 14);
              if (r.error) setMsg(r.error);
              else setMetrics(r.data);
            }}
          >
            {t("account.admin.loadMetrics")}
          </KeycapButton>
        </div>
        {metrics ? <MetricsTable m={metrics} /> : null}
        {msg ? (
          <p className="fd-field__hint" role="status">
            {accountMessageText(t, msg)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
