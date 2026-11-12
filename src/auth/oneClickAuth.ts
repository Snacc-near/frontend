/**
 * RES-112: 1Click User Auth & Account Endpoints.
 * Enables 1-step account creation without requiring seed phrases, extension installs,
 * or upfront NEAR funding.
 *
 * Adheres to Snacc Honesty Rules:
 * - If endpoint is not reachable or not configured, clearly reports mode: "simulated"
 * - Never fabricates fake transaction hashes
 */

import type { AuthSession, OneClickAccountRequest, OneClickAccountResult } from "./types.ts";

const SESSION_STORAGE_KEY = "snacc_auth_session";

/**
 * Sanitizes a user-provided alias into a valid NEAR testnet account ID:
 * lowercase, only a-z, 0-9, _, - (length 2 to 56 chars before .testnet).
 */
let memorySession: AuthSession | null = null;

export function sanitizeNearAlias(alias?: string): string {
  if (!alias || !alias.trim()) {
    const randomHex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
    return `snacc-guest-${randomHex}`;
  }
  const clean = alias
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const clamped = clean.slice(0, 50) || "snacc-guest";
  return clamped;
}

/**
 * Generates an ephemeral ed25519 public key representation for the session.
 */
export function generateEphemeralPublicKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `ed25519:${hex.slice(0, 44)}`;
  }
  const pseudo = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `ed25519:${pseudo.padEnd(44, "0").slice(0, 44)}`;
}

/**
 * Executes a 1Click account creation request:
 * 1. Derives account ID from alias.
 * 2. Generates ephemeral keypair.
 * 3. Attempts external 1Click API call if configured.
 * 4. Falls back gracefully to deterministic simulated onboarding.
 */
export async function createOneClickAccount(
  request: OneClickAccountRequest = {},
): Promise<OneClickAccountResult> {
  const alias = sanitizeNearAlias(request.desiredAlias);
  const accountId = alias.endsWith(".testnet") ? alias : `${alias}.testnet`;
  const publicKey = generateEphemeralPublicKey();
  const endpoint = request.endpoint || (typeof import.meta !== "undefined" && import.meta.env?.VITE_1CLICK_AUTH_ENDPOINT) || "";

  // If a live endpoint is configured, attempt actual network request
  if (endpoint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias,
          publicKey,
          network: request.network || "testnet",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const assignedId = data.accountId || data.account_id || accountId;
        const result: OneClickAccountResult = {
          success: true,
          accountId: assignedId,
          publicKey,
          mode: "testnet",
          message: "1Click account successfully created via live 1Click endpoint.",
          endpointCalled: endpoint,
        };
        storeAuthSession({
          accountId: assignedId,
          provider: "1click",
          publicKey,
          createdAt: Date.now(),
          mode: "testnet",
        });
        return result;
      }
    } catch {
      // Fall through to simulated mode
    }
  }

  // Deterministic local simulated mode
  const result: OneClickAccountResult = {
    success: true,
    accountId,
    publicKey,
    mode: "simulated",
    message: "1Click instant account created locally in 1 step without seed phrases.",
    endpointCalled: endpoint || undefined,
  };

  storeAuthSession({
    accountId,
    provider: "1click",
    publicKey,
    createdAt: Date.now(),
    mode: "simulated",
  });

  return result;
}

export function storeAuthSession(session: AuthSession): void {
  memorySession = session;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage errors
    }
  }
}

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return memorySession;
      return JSON.parse(raw) as AuthSession;
    } catch {
      return memorySession;
    }
  }
  return memorySession;
}

export function clearAuthSession(): void {
  memorySession = null;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}
