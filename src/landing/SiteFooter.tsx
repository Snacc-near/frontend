import { LINKS } from "./chapters.ts";
import { Icon, type IconName } from "../ui/fd.tsx";
import { explorerAccount } from "./lib/chain.ts";
import { Wordmark } from "./Wordmark.tsx";

export interface FooterLink {
  label: string;
  href: string;
  /** Small mono note after the label. */
  note?: string;
}

export interface FooterColumn {
  title: string;
  icon: IconName;
  links: readonly FooterLink[];
}

const repo = (name: string) => `${LINKS.github}/${name}`;

/** Real destinations only: in-page sections, the app, the Snacc-near repos, the testnet contract, NEAR. */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: "Product",
    icon: "cell",
    links: [
      { label: "Launch app", href: LINKS.app, note: "testnet" },
      { label: "The story", href: "#ch-02" },
      { label: "Live colony", href: "#live" },
      { label: "Under the hood", href: "#hood" },
      { label: "Questions", href: "#faq" },
    ],
  },
  {
    title: "Build",
    icon: "doc",
    links: [
      { label: "Snacc-near", href: LINKS.github, note: "GitHub" },
      { label: "contracts", href: repo("contracts") },
      { label: "sdk", href: repo("sdk") },
      { label: "backend", href: repo("backend") },
      { label: "frontend", href: repo("frontend") },
    ],
  },
  {
    title: "Proof",
    icon: "chain",
    links: [
      { label: "snacc-v001.testnet", href: explorerAccount("snacc-v001.testnet"), note: "nearblocks" },
      { label: "oracle-tee", href: repo("oracle-tee"), note: "TEE oracle" },
      { label: "scripts", href: repo("scripts"), note: "evidence + replay" },
    ],
  },
  {
    title: "NEAR",
    icon: "spark",
    links: [
      { label: "NEAR docs", href: "https://docs.near.org" },
      { label: "NEP-171", href: "https://github.com/near/NEPs/blob/master/neps/nep-0171.md", note: "NFT" },
      { label: "NEP-245", href: "https://github.com/near/NEPs/blob/master/neps/nep-0245.md", note: "multi token" },
      { label: "Testnet explorer", href: "https://testnet.nearblocks.io" },
    ],
  },
];

export const FOOTER_DISCLAIMER = "Testnet only. $SNACC has no monetary value. Not financial advice.";

const external = (href: string) => /^https?:\/\//.test(href);

/** Docs-style footer: colophon + four link columns, the dot-matrix wordmark, and a base line. */
export function SiteFooter() {
  return (
    <footer className="ln-footer" aria-labelledby="ln-footer-title">
      <h2 id="ln-footer-title" className="ln-vh">
        Snacc
      </h2>
      <div className="ln-footer__grid">
        <div className="ln-footer__about">
          <p className="ln-footer__k">
            <Icon name="ring" />
            colophon.md
          </p>
          <p className="ln-footer__blurb">
            NFTs that eat a memecoin. An on-chain economic game on NEAR testnet, drawn as a lab culture.
          </p>
          <a className="fd-btn fd-btn--primary ln-footer__cta" href={LINKS.app}>
            Enter the lab
          </a>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.title} className="ln-footer__col" aria-label={col.title}>
            <p className="ln-footer__k">
              <Icon name={col.icon} />
              {col.title}
            </p>
            <ul>
              {col.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} {...(external(l.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {l.label}
                    {external(l.href) ? (
                      <span className="ln-footer__ext" aria-hidden="true">
                        ↗
                      </span>
                    ) : null}
                  </a>
                  {l.note ? <small>{l.note}</small> : null}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <Wordmark text="Snacc" />
      <div className="ln-footer__base">
        <p className="ln-footer__note">{FOOTER_DISCLAIMER}</p>
        <p className="ln-footer__legal">
          <a href={`${repo("frontend")}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
            MIT License
          </a>
          <span aria-hidden="true">·</span>© 2026 Snacc contributors
        </p>
      </div>
    </footer>
  );
}
