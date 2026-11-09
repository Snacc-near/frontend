/**
 * Klien HTTP untuk API backend SNACC (INT-101..104).
 * Membaca URL dari `VITE_API_BASE` (misalnya dari `.env.local`).
 * Aturan integritas: tidak mengarang data saat backend offline / 501.
 */

import type { MacroTelemetry, CrucibleEvent, StrainSummary, StrainDetail } from "./types.ts";

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
