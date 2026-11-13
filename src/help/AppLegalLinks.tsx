/**
 * One quiet line at the foot of the game (UI-151): the testnet disclaimer and links to the terms and
 * privacy pages. Plain links, so they open the static pages in the same tab.
 */
export function AppLegalLinks() {
  return (
    <nav className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-0 font-mono text-[10px] lowercase text-[var(--ink)]" aria-label="legal" data-testid="app-legal">
      <span>testnet only · $snacc has no monetary value</span>
      <a className="fd-a" href="/terms" data-testid="app-terms">
        terms
      </a>
      <a className="fd-a" href="/privacy" data-testid="app-privacy">
        privacy
      </a>
    </nav>
  );
}
