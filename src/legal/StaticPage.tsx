/**
 * Static pages on the docs look (UI-151): `/terms`, `/privacy` and the 404 page. One small lazy chunk;
 * it loads only `fd.css` and `legal.css`, never the landing or the game.
 *
 * UI-161: Terms and Privacy stay English. With the UI in Indonesian a one-line note at the top says so
 * (`help.legal.onlyEnglish`) and the legal text is marked `lang="en"`. The frame around it (header,
 * footer, skip link) and the 404 page follow the UI language (phase B5); the route is wrapped in
 * `I18nProvider`, which keeps `<html lang>` in step with that frame.
 */
import { useEffect } from "react";
import { useT } from "../i18n/react.tsx";
import { DEFAULT_LOCALE } from "../i18n/types.ts";
import { Chip, Icon, Win } from "../ui/fd.tsx";
import { DISCLAIMER, ISSUES_URL, LEGAL_UPDATED, NOT_FOUND, PRIVACY, TERMS, type LegalDoc } from "./content.ts";
import "../ui/fd.css";
import "./legal.css";

export type StaticPageName = "terms" | "privacy" | "notfound";

const GITHUB_ORG = "https://github.com/Snacc-near";
const GITHUB_ORG_NAME = "Snacc-near";
// Part of the legal text, which stays English on purpose (the page marks it `lang="en"`).
const LAST_UPDATED_LABEL = "Last updated";
const OPEN_ISSUE_LABEL = "Open a GitHub issue";

function Header() {
  const { t } = useT();
  return (
    <header className="lg-header">
      <div className="lg-header__inner">
        <a className="lg-brand" href="/" aria-label={t("public.nav.homeAria")}>
          <img src="/brand/snacc-logo.webp" alt="Snacc" width={1200} height={403} decoding="async" />
        </a>
        <nav className="lg-nav" aria-label={t("public.nav.primary")}>
          <a className="lg-nav__link" href="/">
            {t("public.nav.home")}
          </a>
          <a className="fd-btn fd-btn--primary fd-btn--sm" href="/app">
            {t("public.nav.launch")}
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useT();
  return (
    <footer className="lg-foot">
      <nav className="lg-foot__nav" aria-label={t("public.nav.legal")}>
        <a href="/">{t("public.nav.home")}</a>
        <a href="/app">{t("public.nav.game")}</a>
        <a href="/terms">{t("public.nav.terms")}</a>
        <a href="/privacy">{t("public.nav.privacy")}</a>
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
          {t("public.nav.contact")}
        </a>
        <a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer">
          {GITHUB_ORG_NAME}
        </a>
      </nav>
      <p className="lg-foot__note">{t("public.disclaimer")}</p>
    </footer>
  );
}

function Doc({ doc }: { doc: LegalDoc }) {
  const { t, locale } = useT();
  return (
    <Win title={doc.file} className="lg-doc">
      <div className="lg-stack" lang={DEFAULT_LOCALE}>
        {/* UI-161: the legal text stays English on purpose; when the UI is Indonesian, say so once at the top. */}
        {locale !== DEFAULT_LOCALE ? (
          <p className="lg-meta" lang={locale} data-testid="legal-language-note">
            {t("help.legal.onlyEnglish")}
          </p>
        ) : null}
        <h1 className="lg-title">{doc.title}</h1>
        <p className="lg-meta">
          {LAST_UPDATED_LABEL} {LEGAL_UPDATED}
        </p>
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
                  {OPEN_ISSUE_LABEL} <Icon name="ext" />
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
  const { t } = useT();
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  return (
    <Win title={NOT_FOUND.file} className="lg-doc lg-doc--narrow">
      <div className="lg-stack" role="alert">
        <p className="lg-code" aria-hidden="true">
          404
        </p>
        <h1 className="lg-title">{t("public.notFound.heading")}</h1>
        <p className="lg-lead">{t("public.notFound.body")}</p>
        {path ? (
          <p className="lg-meta">
            {t("public.notFound.requested")} <code>{path}</code>
          </p>
        ) : null}
        <div className="lg-actions">
          <a className="fd-btn fd-btn--primary" href="/">
            {t("public.notFound.home")}
          </a>
          <a className="fd-btn" href="/app">
            {t("public.notFound.game")}
          </a>
        </div>
      </div>
    </Win>
  );
}

/** Tab titles of the two legal pages: the pages are English, so are their titles. */
const LEGAL_TITLES = { terms: "Terms of use — Snacc", privacy: "Privacy — Snacc" } as const;

export default function StaticPage({ page }: { page: StaticPageName }) {
  const { t } = useT();
  useEffect(() => {
    document.title = page === "notfound" ? t("public.notFound.title") : LEGAL_TITLES[page];
    if (page !== "notfound") return;
    // An unknown address is served with the app shell, so ask crawlers not to index it.
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [page, t]);

  return (
    <div className="lg-page fd-ui">
      <a className="lg-skip" href="#main">
        {t("public.nav.skip")}
      </a>
      <Header />
      <main id="main" className="lg-main">
        {page === "terms" ? <Doc doc={TERMS} /> : page === "privacy" ? <Doc doc={PRIVACY} /> : <NotFound />}
      </main>
      <Footer />
    </div>
  );
}
