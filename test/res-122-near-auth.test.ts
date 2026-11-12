/**
 * Tests for RES-122: near.email / NEAR Auth (Auth0) Login Options
 */

import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  deriveNearEmailAccountId,
  authenticateWithNearEmail,
} from "../src/auth/nearAuth.ts";

describe("RES-122: near.email & NEAR Auth (Auth0)", () => {
  it("validates email formats accurately", () => {
    expect(isValidEmail("esther@near.org")).toBe(true);
    expect(isValidEmail("researcher.alkemis+tag@snacc.finance")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@missing-user.com")).toBe(false);
    expect(isValidEmail("no-domain@")).toBe(false);
  });

  it("derives deterministic NEAR testnet account ID from email", () => {
    expect(deriveNearEmailAccountId("esther@near.org")).toBe("esther-near-org.testnet");
    expect(deriveNearEmailAccountId("Alkemis.Lead@Snacc.Testnet")).toBe("alkemis-lead-snacc-testnet.testnet");
  });

  it("authenticates via near.email (passkey) flow", async () => {
    const result = await authenticateWithNearEmail({
      email: "chemist@snacc.org",
      provider: "near-email",
    });
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.accountId).toBe("chemist-snacc-org.testnet");
    expect(result.provider).toBe("near-email");
    expect(result.message).toContain("near.email passkey");
  });

  it("authenticates via Auth0 social login flow", async () => {
    const result = await authenticateWithNearEmail({
      email: "trader@fintech.io",
      provider: "auth0",
    });
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.accountId).toBe("trader-fintech-io.testnet");
    expect(result.provider).toBe("auth0");
    expect(result.message).toContain("Auth0 social login");
  });

  it("rejects invalid email with clear error", async () => {
    const result = await authenticateWithNearEmail({
      email: "bad-email",
    });
    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.error).toBe("ERR_INVALID_EMAIL");
  });
});
