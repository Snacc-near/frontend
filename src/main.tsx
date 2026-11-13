import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { selectRoute } from "./route.ts";
import { startTelemetry } from "./telemetry.ts";
// Order matters: iso.css first, index.css second (index.css tokens must win the cascade, as before the
// route split). iso.css is tiny (~2 KB gzip), so it stays in the entry chunk instead of the game chunk.
import "./plate/iso/iso.css";
import "./index.css";

const route = selectRoute(window.location.pathname);

// The game is a fixed full-viewport stage (no page scroll); see `html.route-app` in index.css.
// Set before first render so the page never flashes the wrong layout.
if (route === "app") document.documentElement.classList.add("route-app");

// OPS-127: anonymous page view + error reports to Snacc's own backend (off on opt-out / DNT / no Supabase).
startTelemetry();

// Each route is its own chunk: visitors on `/` never download the game, and vice versa.
const Game = React.lazy(() => import("./app-entry.tsx"));
const Landing = React.lazy(() => import("./landing/Landing.tsx"));
// Privy signing popup for the optional email login (only reachable when Privy is configured).
const SignPage = React.lazy(() => import("./sign/SignPage.tsx"));
// Terms, privacy and the 404 page share one small static chunk (UI-151).
const StaticPage = React.lazy(() => import("./legal/StaticPage.tsx"));
// Public player profile `/p/<account>` and Snacc page `/snacc/<id>` (UI-148): their own chunk.
const PublicPage = React.lazy(() => import("./public/PublicPage.tsx"));

function BootFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#efefec",
        color: "#5d6165",
        fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
        fontSize: 12,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      {route === "app" ? (
        <Suspense fallback={<BootFallback label="loading the lab…" />}>
          <Game />
        </Suspense>
      ) : route === "sign" ? (
        <Suspense fallback={<BootFallback label="opening the signer…" />}>
          <SignPage />
        </Suspense>
      ) : route === "profile" || route === "snacc" ? (
        <Suspense fallback={<BootFallback label="loading…" />}>
          <PublicPage />
        </Suspense>
      ) : route === "terms" || route === "privacy" || route === "notfound" ? (
        <Suspense fallback={<BootFallback label="loading…" />}>
          <StaticPage page={route} />
        </Suspense>
      ) : (
        <Suspense fallback={<BootFallback label="warming the incubator…" />}>
          <Landing />
        </Suspense>
      )}
    </React.StrictMode>,
  );
}
