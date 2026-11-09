/**
 * The HTTP client for the SNACC backend API (INT-101..104).
 * The URL comes from `VITE_API_BASE` (e.g. from `.env.local`).
 * Integrity rule: never fabricate data while the backend is offline / 501.
 */

import type { MacroTelemetry, CrucibleEvent, StrainSummary, StrainDetail, AppetiteTelemetry } from "./types.ts";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") || "";

export async function fetchMacro(): Promise<MacroTelemetry | null> {
  try {
    const res = await fetch(`${API_BASE}/api/crucible/macro`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as MacroTelemetry;
  } catch {
    return null;
  }
}

export async function fetchEvents(): Promise<{
  events: CrucibleEvent[];
  indexer_incomplete: boolean;
  contractId?: string;
} | null> {
  try {
    const res = await fetch(`${API_BASE}/api/events`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      events: CrucibleEvent[];
      indexer_incomplete: boolean;
      contractId?: string;
    };
  } catch {
    return null;
  }
}

export async function fetchStrains(): Promise<{
  strains: StrainSummary[];
  indexer_incomplete: boolean;
} | null> {
  try {
    const res = await fetch(`${API_BASE}/api/strains`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      strains: StrainSummary[];
      indexer_incomplete: boolean;
    };
  } catch {
    return null;
  }
}

export async function fetchStrain(id: number): Promise<StrainDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/strains/${id}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as StrainDetail;
  } catch {
    return null;
  }
}

export async function fetchAppetite(): Promise<AppetiteTelemetry | null> {
  try {
    const res = await fetch(`${API_BASE}/api/appetite`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as AppetiteTelemetry;
  } catch {
    return null;
  }
}

export async function fetchStrainSvg(
  id: number,
): Promise<{ svg: string | null; status: number | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/strains/${id}/svg`);
    if (!res.ok) return { svg: null, status: res.status };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("svg")) return { svg: null, status: res.status };
    const text = await res.text();
    if (!text || !text.trimStart().startsWith("<svg")) return { svg: null, status: res.status };
    return { svg: text, status: res.status };
  } catch {
    return { svg: null, status: null };
  }
}
