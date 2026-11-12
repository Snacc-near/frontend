/**
 * Tests for RES-112: 1Click User Auth & Account Endpoints
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitizeNearAlias,
  generateEphemeralPublicKey,
  createOneClickAccount,
  getStoredAuthSession,
  storeAuthSession,
  clearAuthSession,
} from "../src/auth/oneClickAuth.ts";

describe("RES-112: 1Click User Auth & Account Endpoints", () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it("sanitizes user alias into compliant NEAR testnet account ID", () => {
    expect(sanitizeNearAlias("Alkemis_Novice!")).toBe("alkemis-novice");
    expect(sanitizeNearAlias("  my-Cool-strain  ")).toBe("my-cool-strain");
    expect(sanitizeNearAlias("")).toMatch(/^snacc-guest-[a-f0-9]{6}$/);
    expect(sanitizeNearAlias("a".repeat(80)).length).toBeLessThanOrEqual(50);
  });

  it("generates an ephemeral ed25519-formatted public key", () => {
    const key1 = generateEphemeralPublicKey();
    const key2 = generateEphemeralPublicKey();
    expect(key1).toMatch(/^ed25519:[a-f0-9]{44}$/);
    expect(key2).toMatch(/^ed25519:[a-f0-9]{44}$/);
    expect(key1).not.toBe(key2);
  });

  it("creates a 1Click account in simulated mode without seed phrases", async () => {
    const result = await createOneClickAccount({ desiredAlias: "lab-apprentice" });
    expect(result.success).toBe(true);
    expect(result.accountId).toBe("lab-apprentice.testnet");
    expect(result.publicKey).toMatch(/^ed25519:/);
    expect(result.mode).toBe("simulated");
    expect(result.message).toContain("1Click instant account created locally");

    const session = getStoredAuthSession();
    expect(session).not.toBeNull();
    expect(session?.accountId).toBe("lab-apprentice.testnet");
    expect(session?.provider).toBe("1click");
  });

  it("stores and clears auth session safely", () => {
    storeAuthSession({
      accountId: "persisted.testnet",
      provider: "1click",
      publicKey: "ed25519:test",
      createdAt: 123456789,
      mode: "simulated",
    });
    expect(getStoredAuthSession()?.accountId).toBe("persisted.testnet");

    clearAuthSession();
    expect(getStoredAuthSession()).toBeNull();
  });
});
