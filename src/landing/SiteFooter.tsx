import { BrandChip } from "./BrandChip.tsx";
import { LINKS } from "./chapters.ts";

export function SiteFooter() {
  return (
    <footer className="ln-footer">
      <div className="ln-footer__inner">
        <BrandChip size="sm" />
        <p className="ln-footer__note">Testnet only. $SNACC is a testnet token with no monetary value.</p>
        <nav aria-label="Footer" className="ln-footer__links">
          <a href={LINKS.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href={LINKS.docs} target="_blank" rel="noopener noreferrer">
            Docs
          </a>
        </nav>
      </div>
    </footer>
  );
}
