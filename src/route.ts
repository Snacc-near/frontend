/**
 * Route selection without a router library.
 * `/` (and anything unknown) is the landing page; `/app` and everything below it is the game.
 */
export type RouteName = "app" | "landing";

export function selectRoute(pathname: string): RouteName {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/app" || path.startsWith("/app/")) return "app";
  return "landing";
}
