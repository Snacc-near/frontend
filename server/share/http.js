// @ts-check
/**
 * Tiny helpers over Node's `IncomingMessage` / `ServerResponse` (what a Vercel Node function receives), so the
 * handlers stay testable with plain objects and need no framework helpers such as `res.status()`.
 */
import { originFromHost } from "./validate.js";

/** Pages and cards are cached at the edge for a while; error and fallback answers only briefly. */
export const CACHE_OK = "public, max-age=0, s-maxage=600, stale-while-revalidate=3600";
export const CACHE_SHORT = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

/**
 * @typedef {{ method?: string, url?: string, headers?: Record<string, string | string[] | undefined>, query?: Record<string, string | string[] | undefined> }} Req
 * @typedef {{ statusCode: number, setHeader(name: string, value: string): unknown, end(body?: string | Uint8Array): unknown }} Res
 */

/** One request header as a string. */
export function headerOf(/** @type {Req} */ req, /** @type {string} */ name) {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

/** The origin the request came in on: production or a Vercel preview host; production for anything else. */
export function requestOrigin(/** @type {Req} */ req) {
  return originFromHost(headerOf(req, "x-forwarded-host") ?? headerOf(req, "host"));
}

/** A query value from `req.query` (Vercel fills it, including `[id]` segments) or the URL's query string. */
export function queryOf(/** @type {Req} */ req, /** @type {string} */ key) {
  const q = req.query?.[key];
  if (typeof q === "string") return q;
  if (Array.isArray(q) && typeof q[0] === "string") return q[0];
  try {
    return new URL(req.url ?? "/", "http://localhost").searchParams.get(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/** The last path segment of the request URL, percent-decoded (a fallback for `[id]` route parameters). */
export function lastSegment(/** @type {Req} */ req) {
  try {
    const seg = new URL(req.url ?? "/", "http://localhost").pathname.split("/").filter(Boolean).pop();
    return seg === undefined ? undefined : decodeURIComponent(seg);
  } catch {
    return undefined;
  }
}

/** Answers 405 for anything but GET and HEAD; returns true when the request may proceed. */
export function allowGetHead(/** @type {Req} */ req, /** @type {Res} */ res) {
  const m = req.method ?? "GET";
  if (m === "GET" || m === "HEAD") return true;
  res.statusCode = 405;
  res.setHeader("allow", "GET, HEAD");
  res.setHeader("cache-control", "no-store");
  res.end();
  return false;
}

/** Writes a complete response; HEAD gets the headers only. */
export function send(
  /** @type {Req} */ req,
  /** @type {Res} */ res,
  /** @type {number} */ status,
  /** @type {Record<string, string>} */ headers,
  /** @type {string | Uint8Array} */ body,
) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(req.method === "HEAD" ? undefined : body);
}
