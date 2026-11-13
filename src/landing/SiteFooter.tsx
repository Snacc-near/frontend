import { tEn, type MessageKey } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";
import { LINKS } from "./chapters.ts";
import { Icon, type IconName } from "../ui/fd.tsx";
import { explorerAccount } from "./lib/chain.ts";
import { Wordmark } from "./Wordmark.tsx";

/**
 * A footer link. `label` and `note` hold the English text (tests, non-React callers). When `labelKey`
 * or `noteKey` is set the page shows that dictionary entry in the reader's language; links without
 * one carry a verbatim name (repository, account, standard) that is never translated.
 */
export interface FooterLink {
  label: string;
  labelKey?: MessageKey;
  href: string;
  /** Small mono note after the label. */
  note?: string;
  noteKey?: MessageKey;
}

export interface FooterColumn {
  /** English title. */
  title: string;
  titleKey: MessageKey;
  icon: IconName;
  links: readonly FooterLink[];
}

const repo = (name: string) => `${LINKS.github}/${name}`;
const words = (labelKey: MessageKey) => ({ label: tEn(labelKey), labelKey });
const note = (noteKey: MessageKey) => ({ note: tEn(noteKey), noteKey });

/** Real destinations only: in-page sections, the app, the Snacc-near repos, the testnet contract, NEAR. */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: tEn("landing.footer.product.title"),
    titleKey: "landing.footer.product.title",
    icon: "cell",
    links: [
      { ...words("landing.footer.product.launch"), href: LINKS.app, ...note("landing.footer.product.launchNote") },
      { ...words("landing.footer.product.story"), href: "#ch-02" },
      { ...words("landing.footer.product.live"), href: "#live" },
      { ...words("landing.footer.product.hood"), href: "#hood" },
      { ...words("landing.footer.product.faq"), href: "#faq" },
    ],
  },
  {
    title: tEn("landing.footer.build.title"),
    titleKey: "landing.footer.build.title",
    icon: "doc",
    links: [
      { label: "Snacc-near", href: LINKS.github, ...note("landing.footer.build.githubNote") },
      { label: "contracts", href: repo("contracts") },
      { label: "sdk", href: repo("sdk") },
      { label: "backend", href: repo("backend") },
      { label: "frontend", href: repo("frontend") },
    ],
  },
  {
    title: tEn("landing.footer.proof.title"),
    titleKey: "landing.footer.proof.title",
    icon: "chain",
    links: [
      { label: "snacc-v001.testnet", href: explorerAccount("snacc-v001.testnet"), ...note("landing.footer.proof.nearblocksNote") },
      { label: "oracle-tee", href: repo("oracle-tee"), ...note("landing.footer.proof.oracleNote") },
      { label: "scripts", href: repo("scripts"), ...note("landing.footer.proof.scriptsNote") },
    ],
  },
  {
    title: tEn("landing.footer.near.title"),
    titleKey: "landing.footer.near.title",
    icon: "spark",
    links: [
      { ...words("landing.footer.near.docs"), href: "https://docs.near.org" },
      { label: "NEP-171", href: "https://github.com/near/NEPs/blob/master/neps/nep-0171.md", ...note("landing.footer.near.nftNote") },
      { label: "NEP-245", href: "https://github.com/near/NEPs/blob/master/neps/nep-0245.md", ...note("landing.footer.near.multiNote") },
      { ...words("landing.footer.near.explorer"), href: "https://testnet.nearblocks.io" },
    ],
  },
];

/** English disclaimer; the page shows `t("landing.footer.disclaimer")`. */
export const FOOTER_DISCLAIMER = tEn("landing.footer.disclaimer");

const external = (href: string) => /^https?:\/\//.test(href);

/** The base reset removes link underlines; the terms and privacy links in the note keep theirs. */
const LEGAL_LINK_STYLE = { textDecoration: "underline", textUnderlineOffset: "3px" } as const;

/** Docs-style footer: colophon + four link columns, the dot-matrix wordmark, and a base line. */
export function SiteFooter() {
  const { t } = useT();
  return (
    <footer className="ln-footer" aria-labelledby="ln-footer-title">
      <h2 id="ln-footer-title" className="ln-vh">
        Snacc
      </h2>
      <div className="ln-footer__grid">
        <div className="ln-footer__about">
          <p className="ln-footer__k">
            <Icon name="ring" />
            {t("landing.footer.colophon")}
          </p>
          <p className="ln-footer__blurb">{t("landing.footer.blurb")}</p>
          <a className="fd-btn fd-btn--primary ln-footer__cta" href={LINKS.app}>
            {t("landing.footer.cta")}
          </a>
        </div>
        {FOOTER_COLUMNS.map((col) => {
          const title = t(col.titleKey);
          return (
            <nav key={col.titleKey} className="ln-footer__col" aria-label={title}>
              <p className="ln-footer__k">
                <Icon name={col.icon} />
                {title}
              </p>
              <ul>
                {col.links.map((l) => {
                  const text = l.noteKey ? t(l.noteKey) : l.note;
                  return (
                    <li key={l.href}>
                      <a href={l.href} {...(external(l.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                        {l.labelKey ? t(l.labelKey) : l.label}
                        {external(l.href) ? (
                          <span className="ln-footer__ext" aria-hidden="true">
                            ↗
                          </span>
                        ) : null}
                      </a>
                      {text ? <small>{text}</small> : null}
                    </li>
                  );
                })}
              </ul>
            </nav>
          );
        })}
      </div>
      <Wordmark text="Snacc" />
      <div className="ln-footer__base">
        <p className="ln-footer__note">
          {t("landing.footer.disclaimer")}{" "}
          <a href="/terms" data-testid="footer-terms" style={LEGAL_LINK_STYLE}>
            {t("landing.footer.terms")}
          </a>
          <span aria-hidden="true"> · </span>
          <a href="/privacy" data-testid="footer-privacy" style={LEGAL_LINK_STYLE}>
            {t("landing.footer.privacy")}
          </a>
        </p>
        <p className="ln-footer__legal">
          <a href={`${repo("frontend")}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
            {t("landing.footer.license")}
          </a>
          <span aria-hidden="true">·</span>
          {t("landing.footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
