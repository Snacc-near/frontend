import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import "./plate/iso/iso.css";
import "./index.css";

// The game is a fixed full-viewport stage (no page scroll); see `html.route-app` in index.css.
document.documentElement.classList.add("route-app");

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
