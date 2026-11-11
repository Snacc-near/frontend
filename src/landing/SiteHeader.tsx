import { BrandChip } from "./BrandChip.tsx";
import { LINKS } from "./chapters.ts";

export function SiteHeader() {
  return (
    <header className="ln-header">
      <div className="ln-header__inner">
        <BrandChip />
        <nav className="ln-nav" aria-label="Primary">
          <a className="ln-nav__link" href="#story">
            Story
          </a>
          <a className="ln-nav__link ln-nav__link--opt" href={LINKS.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a className="keycap keycap--primary ln-btn ln-btn--sm" href={LINKS.app}>
            Launch app
          </a>
        </nav>
      </div>
    </header>
  );
}
