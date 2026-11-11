import { useEffect, useState } from "react";
import { fetchEvents, fetchMacro, fetchStrains } from "../data/api.ts";
import type { CrucibleEvent, MacroTelemetry, StrainSummary } from "../data/types.ts";
import { countAlive, latestEvent } from "./lib/live.ts";

export type LiveStatus = "loading" | "live" | "offline";

export interface LiveState {
  status: LiveStatus;
  macro: MacroTelemetry | null;
  alive: number | null;
  strains: number | null;
  events: number | null;
  last: CrucibleEvent | null;
  updatedAt: number | null;
}

const INITIAL: LiveState = {
  status: "loading",
  macro: null,
  alive: null,
  strains: null,
  events: null,
  last: null,
  updatedAt: null,
};

let shared: LiveState = INITIAL;
const listeners = new Set<(s: LiveState) => void>();
let timer: number | null = null;
let inflight = false;

async function poll() {
  if (inflight || document.hidden) return;
  inflight = true;
  try {
    const [macro, strains, events] = await Promise.all([fetchMacro(), fetchStrains(), fetchEvents()]);
    const list: StrainSummary[] | null = strains?.strains ?? null;
    // Never fake numbers: if the core telemetry is missing the page says "offline".
    shared = macro
      ? {
          status: "live",
          macro,
          alive: countAlive(list),
          strains: list ? list.length : null,
          events: events ? events.events.length : null,
          last: latestEvent(events?.events ?? null),
          updatedAt: Date.now(),
        }
      : { ...INITIAL, status: "offline" };
  } finally {
    inflight = false;
    for (const l of listeners) l(shared);
  }
}

/** Shared live telemetry (one poller for every subscriber; 30 s cadence, paused in hidden tabs). */
export function useLive(): LiveState {
  const [state, setState] = useState(shared);
  useEffect(() => {
    listeners.add(setState);
    if (listeners.size === 1) {
      void poll();
      timer = window.setInterval(() => void poll(), 30_000);
    } else {
      setState(shared);
    }
    return () => {
      listeners.delete(setState);
      if (listeners.size === 0 && timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return state;
}
