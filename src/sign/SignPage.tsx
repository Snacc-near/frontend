/**
 * `/sign`: the popup NEAR Connect opens when the player picks "Email or social login (Privy)"
 * (UI-145). It holds the Privy client and the `@peerfolio/privy-near-connect` signing handshake:
 *   1. send READY to the opener at once (the executor waits 30 s for it) and receive the request;
 *   2. log in with an email code if this browser has no Privy session, and make sure the Privy user
 *      has a NEAR wallet (a new implicit account, 0 NEAR until funded);
 *   3. show what is being asked, then sign with Privy or reject.
 * Only requests from this app's own origin are accepted. Without VITE_PRIVY_APP_ID the page only
 * explains that email login is off (VITE_PRIVY_CLIENT_ID is optional).
 */
import "./buffer-polyfill.ts";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type FormEvent } from "react";
import Privy, { LocalStorage, create as createWallet } from "@privy-io/js-sdk-core";
import { initSigningPage, type SignPageSession } from "@peerfolio/privy-near-connect/sign-page";
import { privyConfigFromEnv } from "../chain/privy.ts";
// Plain markup with the shared `fd-*` classes: importing the React primitives (`src/ui/fd.tsx`,
// `controls.tsx`) would turn them into a chunk shared with the landing page.
import "../ui/fd.css";
import { describePayload, type PayloadLike } from "./payload.ts";

type Step =
  | { kind: "off" }
  | { kind: "starting" }
  | { kind: "email" }
  | { kind: "code"; email: string }
  | { kind: "ready"; account: string | null }
  | { kind: "signing" }
  | { kind: "error"; message: string };

interface LinkedAccount {
  type?: string;
  chain_type?: string;
  address?: string;
}
type UserLike = { linked_accounts?: LinkedAccount[] } | null | undefined;

const nearWalletOf = (user: UserLike) => user?.linked_accounts?.find((a) => a.type === "wallet" && a.chain_type === "near") ?? null;

/** Returns the user's NEAR wallet address, creating the wallet once if the user has none. */
async function ensureNearWallet(privy: Privy, user: UserLike): Promise<string | null> {
  const existing = nearWalletOf(user);
  if (existing) return existing.address ?? null;
  await createWallet(
    { fetchPrivyRoute: privy.fetchPrivyRoute.bind(privy), getCompiledPath: privy.getCompiledPath.bind(privy), app: { appId: privy.app.appId } },
    { request: { chain_type: "near" } },
  );
  const { user: refreshed } = await privy.user.get();
  return nearWalletOf(refreshed as UserLike)?.address ?? null;
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Key({ primary = false, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" className={`fd-key${primary ? " fd-key--primary" : ""} ${className}`.trim()} {...rest} />;
}

export default function SignPage() {
  const config = privyConfigFromEnv(import.meta.env as Record<string, string | undefined>);
  const [step, setStep] = useState<Step>(config ? { kind: "starting" } : { kind: "off" });
  const [session, setSession] = useState<SignPageSession | null>(null);
  const [handshakeError, setHandshakeError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const privyRef = useRef<Privy | null>(null);

  useEffect(() => {
    if (!config) return;
    const ac = new AbortController();
    const privy =
      privyRef.current ??
      new Privy({ appId: config.appId, ...(config.clientId ? { clientId: config.clientId } : {}), storage: new LocalStorage() });
    privyRef.current = privy;
    void (async () => {
      try {
        await privy.initialize();
        // READY goes out now; the request arrives while the player may still be logging in.
        initSigningPage(privy, { allowedOrigins: [window.location.origin], signal: ac.signal })
          .then((s) => {
            if (!ac.signal.aborted) setSession(s);
          })
          .catch((e) => {
            if (!ac.signal.aborted) setHandshakeError(/opener/i.test(messageOf(e)) ? "This page opens from the wallet picker in the game. You can close it." : messageOf(e));
          });
        const { user } = await privy.user.get().catch(() => ({ user: null }));
        if (ac.signal.aborted) return;
        if (!user) {
          setStep({ kind: "email" });
          return;
        }
        setStep({ kind: "ready", account: await ensureNearWallet(privy, user as UserLike) });
      } catch (e) {
        if (!ac.signal.aborted) setStep({ kind: "error", message: messageOf(e) });
      }
    })();
    return () => ac.abort();
    // The env config is fixed at build time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    const privy = privyRef.current;
    if (!privy || !email.trim()) return;
    setBusy(true);
    try {
      await privy.auth.email.sendCode(email.trim());
      setStep({ kind: "code", email: email.trim() });
    } catch (err) {
      setStep({ kind: "error", message: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    const privy = privyRef.current;
    if (!privy || step.kind !== "code" || !code.trim()) return;
    setBusy(true);
    try {
      const result = await privy.auth.email.loginWithCode(step.email, code.trim());
      setStep({ kind: "ready", account: await ensureNearWallet(privy, result.user as UserLike) });
    } catch (err) {
      setStep({ kind: "error", message: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    if (!session) return;
    setStep({ kind: "signing" });
    try {
      await session.sign(); // posts the result to the game and closes this window
    } catch (err) {
      setStep({ kind: "error", message: messageOf(err) });
    }
  };

  const lines = session ? describePayload(session.payload as unknown as PayloadLike) : [];

  return (
    <main className="fd-ui" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <section className="fd-win" style={{ width: "100%", maxWidth: 440 }} aria-labelledby="sign-title">
        <div className="fd-win__bar" aria-hidden="true">
          <span className="fd-win__btn" />
          <span className="fd-win__rule" />
          <span className="fd-win__title">privy-sign.tx</span>
          <span className="fd-win__rule" />
          <span className="fd-win__btn" />
        </div>
        <div className="fd-win__body fd-stack" data-testid="sign-page">
          <h1 id="sign-title" className="fd-h">
            Snacc · email login
          </h1>
          {step.kind === "off" ? (
            <p className="fd-note" data-testid="sign-off">
              <strong>Email login is not configured on this deployment.</strong> Close this window and pick a NEAR wallet instead.
            </p>
          ) : null}
          {step.kind === "starting" ? (
            <p className="fd-field__hint" role="status">
              Starting Privy…
            </p>
          ) : null}
          {step.kind === "email" ? (
            <form className="fd-stack" onSubmit={(e) => void sendCode(e)}>
              <p className="fd-field__hint">Privy sends a one-time code. A new NEAR testnet account is created for you on first login; it starts with 0 NEAR.</p>
              <div className="fd-field">
                <label htmlFor="sign-email" className="fd-field__label">
                  email
                </label>
                <input id="sign-email" className="fd-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} required />
              </div>
              <Key type="submit" primary disabled={busy || !email.trim()}>
                {busy ? "sending…" : "send code"}
              </Key>
            </form>
          ) : null}
          {step.kind === "code" ? (
            <form className="fd-stack" onSubmit={(e) => void verifyCode(e)}>
              <div className="fd-field">
                <label htmlFor="sign-code" className="fd-field__label">
                  {`code sent to ${step.email}`}
                </label>
                <input id="sign-code" className="fd-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} required />
              </div>
              <div className="fd-row">
                <Key type="submit" primary disabled={busy || !code.trim()}>
                  {busy ? "checking…" : "log in"}
                </Key>
                <Key onClick={() => setStep({ kind: "email" })} disabled={busy}>
                  back
                </Key>
              </div>
            </form>
          ) : null}
          {step.kind === "ready" || step.kind === "signing" ? (
            <div className="fd-stack">
              {step.kind === "ready" && step.account ? (
                <p className="fd-field__hint">
                  NEAR account: <code className="break-all">{step.account}</code>
                </p>
              ) : null}
              {session ? (
                <>
                  <p className="fd-field__hint">
                    Requested by <strong>{session.targetOrigin}</strong>:
                  </p>
                  <ul className="fd-list" data-testid="sign-request">
                    {lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                  <div className="fd-row">
                    <Key primary onClick={() => void sign()} disabled={step.kind === "signing"}>
                      {step.kind === "signing" ? "signing…" : "approve"}
                    </Key>
                    <Key onClick={() => window.close()} disabled={step.kind === "signing"}>
                      reject
                    </Key>
                  </div>
                </>
              ) : (
                <p className="fd-field__hint" role="status">
                  {handshakeError ?? "Waiting for the request from the game…"}
                </p>
              )}
            </div>
          ) : null}
          {step.kind === "error" ? (
            <p className="fd-field__hint fd-field__hint--bad" role="alert">
              {step.message}
            </p>
          ) : null}
          {handshakeError && step.kind !== "ready" ? <p className="fd-field__hint">{handshakeError}</p> : null}
          <p className="fd-field__hint">
            Keys stay with Privy; the game never sees them. <span className="fd-tag">testnet</span>
          </p>
        </div>
      </section>
    </main>
  );
}
