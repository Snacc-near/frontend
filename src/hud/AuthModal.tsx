/**
 * RES-112 & RES-122: Authentication & Onboarding Modal.
 * Integrates:
 * - RES-112: 1Click User Auth & Account Endpoints (instant 1-step guest onboarding)
 * - RES-122: near.email / NEAR Auth (Auth0) passkey & email login flow
 */

import React, { useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import type { AuthSession } from "../auth/types.ts";
import { createOneClickAccount, getStoredAuthSession, clearAuthSession } from "../auth/oneClickAuth.ts";
import { authenticateWithNearEmail, isValidEmail } from "../auth/nearAuth.ts";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount: string;
  onLogin: (accountId: string, session: AuthSession) => void;
  onLogout: () => void;
  skin?: SkinMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  activeAccount,
  onLogin,
  onLogout,
  skin = "biolab",
}) => {
  const [tab, setTab] = useState<"1click" | "email">("1click");
  const [alias, setAlias] = useState("");
  const [email, setEmail] = useState("");
  const [emailProvider, setEmailProvider] = useState<"near-email" | "auth0">("near-email");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSession = getStoredAuthSession();

  const handle1ClickCreate = async () => {
    setLoading(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await createOneClickAccount({ desiredAlias: alias.trim() });
      if (res.success) {
        setStatusMsg(res.message);
        const session: AuthSession = {
          accountId: res.accountId,
          provider: "1click",
          publicKey: res.publicKey,
          createdAt: Date.now(),
          mode: res.mode,
        };
        onLogin(res.accountId, session);
      } else {
        setErrorMsg(res.error || "Failed to create 1Click account.");
      }
    } catch (e: unknown) {
      setErrorMsg((e as Error).message || "Unknown error creating 1Click account.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!isValidEmail(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await authenticateWithNearEmail({
        email: email.trim(),
        provider: emailProvider,
      });
      if (res.success) {
        setStatusMsg(res.message);
        const session: AuthSession = {
          accountId: res.accountId,
          provider: res.provider,
          publicKey: "ed25519:passkey-derived-key",
          email: res.email,
          createdAt: Date.now(),
          mode: res.mode,
        };
        onLogin(res.accountId, session);
      } else {
        setErrorMsg(res.error || "Authentication failed.");
      }
    } catch (e: unknown) {
      setErrorMsg((e as Error).message || "Unknown error during email login.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    onLogout();
    setStatusMsg("Logged out successfully.");
  };

  return (
    <div
      role="dialog"
      aria-label="onboarding and authentication"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        className="plate-panel relative flex w-full max-w-lg flex-col gap-3.5 rounded-2xl border border-[var(--edge)] bg-[var(--panel)] p-5 text-[var(--ink-hi)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3">
          <div className="flex items-center gap-2">
            <span className="lp-label font-mono text-[10px] tracking-wider uppercase text-[var(--accent-dk)]">
              {skin === "biolab" ? "Alchemical Identity" : "Institutional Access"}
            </span>
            <span className="text-xs font-semibold text-[var(--ink)]">· RES-112 & RES-122</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close modal"
            className="keycap min-h-[30px] min-w-[30px] px-2 text-xs"
          >
            ✕
          </button>
        </div>

        {/* Active Account Banner */}
        {activeAccount ? (
          <div className="flex items-center justify-between rounded-xl border border-[var(--edge)] bg-[var(--bg)] p-3 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase text-[var(--ink)]">Active Account</span>
              <span className="font-mono font-bold text-[var(--ink-hi)]">{activeAccount}</span>
              {currentSession ? (
                <span className="font-mono text-[10px] text-[var(--accent-dk)]">
                  Provider: {currentSession.provider} · Mode: {currentSession.mode}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="keycap min-h-[32px] px-3 text-[11px] text-red-500 hover:text-red-700"
            >
              Disconnect
            </button>
          </div>
        ) : null}

        {/* Tab Selector */}
        <div className="flex gap-1.5 border-b border-[var(--edge)] pb-2">
          <button
            type="button"
            onClick={() => {
              setTab("1click");
              setErrorMsg(null);
            }}
            className={`keycap min-h-[34px] px-3 text-xs font-semibold ${
              tab === "1click" ? "border-[var(--accent-dk)] bg-[var(--accent)] text-[var(--accent-ink)]" : ""
            }`}
          >
            ⚡ 1Click Guest (RES-112)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("email");
              setErrorMsg(null);
            }}
            className={`keycap min-h-[34px] px-3 text-xs font-semibold ${
              tab === "email" ? "border-[var(--accent-dk)] bg-[var(--accent)] text-[var(--accent-ink)]" : ""
            }`}
          >
            ✉️ near.email / Auth0 (RES-122)
          </button>
        </div>

        {/* Tab 1: 1Click Onboarding */}
        {tab === "1click" ? (
          <div className="flex flex-col gap-3 py-1 text-xs">
            <p className="text-[11px] text-[var(--ink)]">
              {skin === "biolab"
                ? "Create an instant ephemeral testnet identity in 1 step without seed phrases or gas fees."
                : "Instant non-custodial session key onboarding with automated testnet sub-account derivation."}
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="oneclick-alias" className="font-mono text-[10px] uppercase text-[var(--ink)]">
                Desired Account Alias (Optional)
              </label>
              <input
                id="oneclick-alias"
                type="text"
                placeholder="e.g. alkemis-alpha"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full rounded-lg border border-[var(--edge)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--ink-hi)] placeholder-[var(--ink)]/50 focus:border-[var(--accent-dk)] focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handle1ClickCreate}
              className="keycap min-h-[38px] w-full border-[var(--accent-dk)] bg-[var(--accent)] text-xs font-bold text-[var(--accent-ink)]"
            >
              {loading ? "Generating Account..." : "⚡ Create 1Click Account"}
            </button>
          </div>
        ) : null}

        {/* Tab 2: near.email / Auth0 Passkey */}
        {tab === "email" ? (
          <div className="flex flex-col gap-3 py-1 text-xs">
            <p className="text-[11px] text-[var(--ink)]">
              {skin === "biolab"
                ? "Authenticate with email or passkey to derive a deterministic on-chain NEAR testnet identity."
                : "Web2-to-Web3 authentication bridge utilizing email MPC / Auth0 passkey assertions."}
            </p>
            <div className="flex gap-2">
              <label className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--ink-hi)]">
                <input
                  type="radio"
                  name="emailProvider"
                  checked={emailProvider === "near-email"}
                  onChange={() => setEmailProvider("near-email")}
                />
                near.email (Passkey)
              </label>
              <label className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--ink-hi)]">
                <input
                  type="radio"
                  name="emailProvider"
                  checked={emailProvider === "auth0"}
                  onChange={() => setEmailProvider("auth0")}
                />
                Auth0 (Social JWT)
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email-input" className="font-mono text-[10px] uppercase text-[var(--ink)]">
                Email Address
              </label>
              <input
                id="email-input"
                type="email"
                placeholder="researcher@snacc.near"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--edge)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--ink-hi)] placeholder-[var(--ink)]/50 focus:border-[var(--accent-dk)] focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleEmailAuth}
              className="keycap min-h-[38px] w-full border-[var(--accent-dk)] bg-[var(--accent)] text-xs font-bold text-[var(--accent-ink)]"
            >
              {loading ? "Authenticating..." : `Sign in with ${emailProvider === "near-email" ? "near.email" : "Auth0"}`}
            </button>
          </div>
        ) : null}

        {/* Status / Error Toast */}
        {statusMsg ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
            ✓ {statusMsg}
          </div>
        ) : null}
        {errorMsg ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 font-mono text-[11px] text-red-600 dark:text-red-400">
            ✕ {errorMsg}
          </div>
        ) : null}

        {/* Footer Honesty Note */}
        <div className="border-t border-[var(--edge)] pt-2 text-center font-mono text-[9px] lowercase text-[var(--ink)]">
          honest auth · simulated keypairs fallback gracefully · no private keys stored on server
        </div>
      </div>
    </div>
  );
};
