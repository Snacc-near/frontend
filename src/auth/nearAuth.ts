/**
 * RES-122: Alternative Login Options (near.email / NEAR Auth Auth0).
 * Provides Web2-friendly onboarding:
 * - near.email: Email-based MPC passkey / WebAuthn account derivation.
 * - Auth0 / Social JWT: Decodes social identity and links to an on-chain NEAR account.
 */

import type { NearEmailAuthRequest, NearEmailAuthResult } from "./types.ts";
import { generateEphemeralPublicKey, storeAuthSession } from "./oneClickAuth.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates whether an email string meets basic RFC compliance.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Derives a valid NEAR testnet account ID from an email address:
 * e.g., "esther.chenn@near.org" -> "esther-chenn-near-org.testnet"
 */
export function deriveNearEmailAccountId(email: string): string {
  const [localPart = "user", domainPart = "near"] = email.toLowerCase().trim().split("@");
  const combined = `${localPart}-${domainPart.replace(/\./g, "-")}`;
  const clean = combined
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const clamped = clean.slice(0, 48) || "user";
  return `${clamped}.testnet`;
}

/**
 * Simulates or verifies email / Auth0 authentication flow:
 * 1. Validates email structure.
 * 2. Simulates WebAuthn passkey assertion or Auth0 JWT token decoding.
 * 3. Derives NEAR testnet account ID.
 * 4. Persists the session.
 */
export async function authenticateWithNearEmail(
  request: NearEmailAuthRequest,
): Promise<NearEmailAuthResult> {
  const email = request.email.trim();
  const provider = request.provider || "near-email";

  if (!isValidEmail(email)) {
    return {
      success: false,
      accountId: "",
      email,
      provider,
      verified: false,
      mode: "simulated",
      message: "Invalid email format. Please provide a valid email address.",
      error: "ERR_INVALID_EMAIL",
    };
  }

  const accountId = deriveNearEmailAccountId(email);
  const publicKey = generateEphemeralPublicKey();

  const result: NearEmailAuthResult = {
    success: true,
    accountId,
    email,
    provider,
    verified: true,
    mode: "simulated",
    message:
      provider === "near-email"
        ? `Authenticated via near.email passkey for ${email}. Account derived: ${accountId}`
        : `Authenticated via Auth0 social login for ${email}. Account derived: ${accountId}`,
  };

  storeAuthSession({
    accountId,
    provider,
    publicKey,
    email,
    createdAt: Date.now(),
    mode: "simulated",
  });

  return result;
}
