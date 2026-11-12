/**
 * Types for RES-112 & RES-122:
 * - RES-112: 1Click user auth & account endpoints (instant 1-step account onboarding)
 * - RES-122: near.email / NEAR Auth (Auth0) passkey & email login options
 */

export type AuthProviderType = "1click" | "near-email" | "auth0" | "manual";

export interface AuthSession {
  accountId: string;
  provider: AuthProviderType;
  publicKey: string;
  email?: string;
  createdAt: number;
  mode: "simulated" | "testnet";
}

export interface OneClickAccountRequest {
  desiredAlias?: string;
  network?: "testnet" | "mainnet";
  endpoint?: string;
}

export interface OneClickAccountResult {
  success: boolean;
  accountId: string;
  publicKey: string;
  mode: "simulated" | "testnet";
  message: string;
  endpointCalled?: string;
  error?: string;
}

export interface NearEmailAuthRequest {
  email: string;
  provider?: "near-email" | "auth0";
  passkeyAttestation?: string;
}

export interface NearEmailAuthResult {
  success: boolean;
  accountId: string;
  email: string;
  provider: "near-email" | "auth0";
  verified: boolean;
  mode: "simulated" | "testnet";
  message: string;
  error?: string;
}
