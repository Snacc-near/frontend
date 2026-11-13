/**
 * Route selection without a router library.
 * `/` is the landing page; `/app` and everything below it is the game; `/sign` is the Privy signing
 * popup that the optional email login opens (see `src/sign/`); `/terms` and `/privacy` are the static
 * legal pages (see `src/legal/`). Any other path gets the 404 page.
 */
export type RouteName = "app" | "landing" | "sign" | "terms" | "privacy" | "notfound";

export function selectRoute(pathname: string): RouteName {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/index.html") return "landing";
  if (path === "/app" || path.startsWith("/app/")) return "app";
  if (path === "/sign") return "sign";
  if (path === "/terms") return "terms";
  if (path === "/privacy") return "privacy";
  return "notfound";
}
