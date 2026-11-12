/**
 * Tiny fetch wrapper for the swap widget: injectable fetch, hard timeout, caller abort.
 * Never throws; every failure maps to a typed reason so the UI can render `—` plus a short reason.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type HttpFailureReason = "timeout" | "aborted" | "network" | "http" | "invalid";

export type HttpResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; reason: HttpFailureReason; status?: number; message?: string };

export interface HttpOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  signal?: AbortSignal;
  method?: "GET" | "POST";
  jsonBody?: unknown;
}

export const DEFAULT_TIMEOUT_MS = 8000;
const MAX_MESSAGE_CHARS = 160;

function safeMessage(body: unknown): string | undefined {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim().slice(0, MAX_MESSAGE_CHARS);
  }
  return undefined;
}

async function parseBody(res: Response): Promise<unknown | undefined> {
  try {
    return JSON.parse(await res.text());
  } catch {
    return undefined;
  }
}

export async function httpJson(url: string, options: HttpOptions = {}): Promise<HttpResult> {
  const fetchImpl: FetchLike | undefined =
    options.fetchImpl ?? (typeof fetch === "function" ? (i, init) => fetch(i, init) : undefined);
  if (!fetchImpl) return { ok: false, reason: "network", message: "fetch unavailable" };
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (options.signal?.aborted) return { ok: false, reason: "aborted" };

  const ctrl = new AbortController();
  let timedOut = false;
  let onExternalAbort: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = new Promise<HttpResult>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
      resolve({ ok: false, reason: "timeout" });
    }, timeoutMs);
    onExternalAbort = () => {
      ctrl.abort();
      resolve({ ok: false, reason: "aborted" });
    };
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });
  });

  const run = (async (): Promise<HttpResult> => {
    try {
      const init: RequestInit = {
        method: options.method ?? "GET",
        headers:
          options.jsonBody === undefined
            ? { Accept: "application/json" }
            : { Accept: "application/json", "Content-Type": "application/json" },
        signal: ctrl.signal,
      };
      if (options.jsonBody !== undefined) init.body = JSON.stringify(options.jsonBody);
      const res = await fetchImpl(url, init);
      const body = await parseBody(res);
      if (!res.ok) return { ok: false, reason: "http", status: res.status, message: safeMessage(body) };
      if (body === undefined) return { ok: false, reason: "invalid", status: res.status };
      return { ok: true, status: res.status, body };
    } catch {
      if (timedOut) return { ok: false, reason: "timeout" };
      if (options.signal?.aborted) return { ok: false, reason: "aborted" };
      return { ok: false, reason: "network" };
    }
  })();

  try {
    return await Promise.race([run, stop]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onExternalAbort) options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
