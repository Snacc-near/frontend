/**
 * Route selection without a router library.
 * `/` is the landing page; `/app` and everything below it is the game; `/sign` is the Privy signing
 * popup that the optional email login opens (see `src/sign/`); `/terms` and `/privacy` are the static
 * legal pages (see `src/legal/`). `/p/<accountId>` is a public player profile and `/snacc/<id>` a
 * public Snacc page (UI-148, see `src/public/`). Any other path gets the 404 page.
 */
export type RouteName = "app" | "landing" | "sign" | "terms" | "privacy" | "profile" | "snacc" | "notfound";

/** NEAR account id: 2 to 64 chars, lowercase alphanumerics joined by single `-`, `_` or `.`. */
const ACCOUNT_RE = /^(?:[a-z\d]+[-_.])*[a-z\d]+$/;

export type PublicTarget = { kind: "profile"; accountId: string } | { kind: "snacc"; strainId: number };

/** The account of `/p/<accountId>` or the id of `/snacc/<id>`; null for any other or malformed path. */
export function parsePublicPath(pathname: string): PublicTarget | null {
  const path = pathname.replace(/\/+$/, "");
  const p = /^\/p\/([^/]+)$/.exec(path);
  if (p) {
    let id: string;
    try {
      id = decodeURIComponent(p[1]);
    } catch {
      return null;
    }
    return id.length >= 2 && id.length <= 64 && ACCOUNT_RE.test(id) ? { kind: "profile", accountId: id } : null;
  }
  const s = /^\/snacc\/(\d{1,9})$/.exec(path);
  if (s) {
    const n = Number(s[1]);
    return n >= 1 ? { kind: "snacc", strainId: n } : null;
  }
  return null;
}

export function selectRoute(pathname: string): RouteName {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/index.html") return "landing";
  if (path === "/app" || path.startsWith("/app/")) return "app";
  if (path === "/sign") return "sign";
  if (path === "/terms") return "terms";
  if (path === "/privacy") return "privacy";
  const pub = parsePublicPath(path);
  if (pub) return pub.kind;
  return "notfound";
}
