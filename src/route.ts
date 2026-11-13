/**
 * Route selection without a router library.
 * `/` (and anything unknown) is the landing page; `/app` and everything below it is the game;
 * `/sign` is the Privy signing popup that the optional email login opens (see `src/sign/`).
 */
export type RouteName = "app" | "landing" | "sign";

export function selectRoute(pathname: string): RouteName {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/app" || path.startsWith("/app/")) return "app";
  if (path === "/sign") return "sign";
  return "landing";
}
