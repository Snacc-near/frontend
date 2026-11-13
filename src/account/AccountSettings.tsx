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
        Anonymous usage stats
      </h4>
      <p className="fd-field__hint">
        Counts of steps like &quot;intro finished&quot; or &quot;transaction succeeded&quot;, plus error reports, sent to Snacc&apos;s own backend with a random
        device id. Never your account id, wallet, keys or IP address. Details on the <a className="fd-a" href="/privacy#usage-stats">privacy page</a>.
        {dnt ? " Your browser asks sites not to track, so this starts off." : ""}
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
        share anonymous usage stats
      </KeycapButton>
    </section>
  );
}

export function MyDataSettings() {
  const account = useAccount();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!account.enabled) return null;
  const signedIn = account.status === "signed-in" && account.client !== null;
  return (
    <section className="guide-section" aria-labelledby="settings-mydata-h" data-testid="settings-mydata">
      <h4 id="settings-mydata-h" className="fd-h">
        Your profile data
      </h4>
      {signedIn ? (
        <>
          <p className="fd-field__hint">
            Download everything the Snacc profile database stores about you as one JSON file: profile, recorded activity, achievements, notifications,
            settings, follows and the starter-pack claim. On-chain data stays on NEAR testnet.
          </p>
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
                setMsg("Downloaded.");
              }}
            >
              {busy ? "preparing…" : "download my data"}
            </KeycapButton>
          </div>
        </>
      ) : (
        <p className="fd-field__hint">Sign in to the profile (the key next to your wallet) to download your data.</p>
      )}
      {msg ? (
        <p className="fd-field__hint" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  );
}

function MetricsTable({ m }: { m: AdminMetrics }) {
  return (
    <div className="fd-stack" data-testid="admin-metrics">
      <table className="guide-table">
        <caption className="fd-sub">funnel · distinct devices per UTC day</caption>
        <thead>
          <tr>
            <th>day</th>
            <th>landing</th>
            <th>app</th>
            <th>intro done</th>
            <th>wallet</th>
            <th>signed in</th>
            <th>tx ok</th>
            <th>errors</th>
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
        <caption className="fd-sub">retention · devices first seen that day, back on day 1 / day 7</caption>
        <thead>
          <tr>
            <th>cohort</th>
            <th>devices</th>
            <th>D1</th>
            <th>D7</th>
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
        {m.top_errors.length === 0 ? <li>no client errors in the last 7 days</li> : null}
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
        Admin
      </h4>
      <p className="fd-field__hint">You are listed in admins_snacc. Every action here is checked again by the database.</p>
      <div className="fd-stack">
        <Field id={`${uid}-t`} label="announcement title" hint="3 to 120 characters">
          <Input id={`${uid}-t`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id={`${uid}-b`} label="announcement text" hint="up to 1000 characters">
          <Input id={`${uid}-b`} value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field id={`${uid}-d`} label="show for (days)">
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
              say(r, `Announcement sent to ${r.data ?? 0} profiles.`);
              if (!r.error) {
                setTitle("");
                setBody("");
              }
            }}
          >
            broadcast
          </KeycapButton>
        </div>
        <Field id={`${uid}-a`} label="reset username + bio of account">
          <Input id={`${uid}-a`} value={target} placeholder="someone.testnet" onChange={(e) => setTarget(e.target.value.trim().toLowerCase())} />
        </Field>
        <div className="fd-row">
          <KeycapButton
            mono
            icon="close"
            disabled={target.length < 2}
            onClick={async () => {
              const r = await adminResetProfileText(client, target);
              say(r, r.data ? `Reset ${target}.` : `No profile for ${target}.`);
            }}
          >
            reset profile text
          </KeycapButton>
        </div>
        <Field id={`${uid}-w`} label="block a word" hint="letters only after normalising; reserved = whole username, abusive = anywhere">
          <Input id={`${uid}-w`} value={term} onChange={(e) => setTerm(e.target.value)} />
        </Field>
        <div className="fd-row">
          <Select aria-label="word kind" value={termKind} onChange={(e) => setTermKind(e.target.value as "abusive" | "reserved")}>
            <option value="abusive">abusive</option>
            <option value="reserved">reserved</option>
          </Select>
          <KeycapButton mono icon="close" disabled={term.trim().length < 3} onClick={async () => say(await adminBlockTerm(client, term.trim(), termKind), "Word blocked.")}>
            block word
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
            load usage funnel (14 days)
          </KeycapButton>
        </div>
        {metrics ? <MetricsTable m={metrics} /> : null}
        {msg ? (
          <p className="fd-field__hint" role="status">
            {msg}
          </p>
        ) : null}
      </div>
    </section>
  );
}
