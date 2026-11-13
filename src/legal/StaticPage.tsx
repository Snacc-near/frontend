/**
 * Static pages on the docs look (UI-151): `/terms`, `/privacy` and the 404 page. One small lazy chunk;
 * it loads only `fd.css` and `legal.css`, never the landing or the game.
 */
import { useEffect } from "react";
import { Chip, Icon, Win } from "../ui/fd.tsx";
import { DISCLAIMER, ISSUES_URL, LEGAL_UPDATED, NOT_FOUND, PRIVACY, TERMS, type LegalDoc } from "./content.ts";
import "../ui/fd.css";
import "./legal.css";

export type StaticPageName = "terms" | "privacy" | "notfound";

const GITHUB_ORG = "https://github.com/Snacc-near";

function Header() {
  return (
    <header className="lg-header">
      <div className="lg-header__inner">
        <a className="lg-brand" href="/" aria-label="Snacc, home">
          <img src="/brand/snacc-logo.webp" alt="Snacc" width={1200} height={403} decoding="async" />
        </a>
        <nav className="lg-nav" aria-label="Primary">
          <a className="lg-nav__link" href="/">
            Home
          </a>
          <a className="fd-btn fd-btn--primary fd-btn--sm" href="/app">
            Launch app
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="lg-foot">
      <nav className="lg-foot__nav" aria-label="Legal">
        <a href="/">Home</a>
        <a href="/app">Game</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
          Contact (GitHub issues)
        </a>
        <a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer">
          Snacc-near
        </a>
      </nav>
      <p className="lg-foot__note">{DISCLAIMER}</p>
    </footer>
  );
}

function Doc({ doc }: { doc: LegalDoc }) {
  return (
    <Win title={doc.file} className="lg-doc">
      <div className="lg-stack">
        <h1 className="lg-title">{doc.title}</h1>
        <p className="lg-meta">Last updated {LEGAL_UPDATED}</p>
        <Chip>{DISCLAIMER}</Chip>
        <p className="lg-lead">{doc.lead}</p>
        {doc.sections.map((s) => (
          <section key={s.id} className="lg-sec" aria-labelledby={`lg-${s.id}`}>
            <h2 id={`lg-${s.id}`} className="lg-h2">
              {s.heading}
            </h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.items ? (
              <ul className="lg-list">
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            ) : null}
            {s.id === "contact" ? (
              <p>
                <a className="fd-a" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
                  Open a GitHub issue <Icon name="ext" />
                </a>
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </Win>
  );
}

function NotFound() {
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  return (
    <Win title={NOT_FOUND.file} className="lg-doc lg-doc--narrow">
      <div className="lg-stack" role="alert">
        <p className="lg-code" aria-hidden="true">
          404
        </p>
        <h1 className="lg-title">{NOT_FOUND.heading}</h1>
        <p className="lg-lead">{NOT_FOUND.body}</p>
        {path ? (
          <p className="lg-meta">
            Requested: <code>{path}</code>
          </p>
        ) : null}
        <div className="lg-actions">
          <a className="fd-btn fd-btn--primary" href="/">
            Back to the home page
          </a>
          <a className="fd-btn" href="/app">
            Open the game
          </a>
        </div>
      </div>
    </Win>
  );
}

const TITLES: Record<StaticPageName, string> = {
  terms: "Terms of use — Snacc",
  privacy: "Privacy — Snacc",
  notfound: "Page not found — Snacc",
};

export default function StaticPage({ page }: { page: StaticPageName }) {
  useEffect(() => {
    document.title = TITLES[page];
    if (page !== "notfound") return;
    // An unknown address is served with the app shell, so ask crawlers not to index it.
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [page]);

  return (
    <div className="lg-page fd-ui">
      <a className="lg-skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" className="lg-main">
        {page === "terms" ? <Doc doc={TERMS} /> : page === "privacy" ? <Doc doc={PRIVACY} /> : <NotFound />}
      </main>
      <Footer />
    </div>
  );
}
