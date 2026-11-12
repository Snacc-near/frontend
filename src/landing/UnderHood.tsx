import { LINKS } from "./chapters.ts";
import { Accent, Cap, Chip, Icon, Win } from "./fd.tsx";

const REPOS = ["contracts", "oracle-tee", "sdk", "backend", "frontend", "scripts"] as const;

function CoinIcon() {
  return (
    <svg viewBox="0 0 96 80" aria-hidden="true" className="ln-ico ln-ico--coin">
      <ellipse cx="48" cy="66" rx="30" ry="9" className="ln-ico__shadow" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(0 ${-i * 9})`}>
          <path d="M18 58v6c0 5 13.4 9 30 9s30-4 30-9v-6" className="ln-ico__side" />
          <ellipse cx="48" cy="58" rx="30" ry="9" className="ln-ico__top" />
        </g>
      ))}
      <g className="ln-ico__drop">
        <path d="M30 20v5c0 3 8 5.5 18 5.5s18-2.5 18-5.5v-5" className="ln-ico__side ln-ico__mari" />
        <ellipse cx="48" cy="20" rx="18" ry="5.5" className="ln-ico__top ln-ico__mari" />
      </g>
    </svg>
  );
}

function NftIcon() {
  return (
    <svg viewBox="0 0 96 80" aria-hidden="true" className="ln-ico ln-ico--nft">
      <path d="M22 18l40-8 14 10v46l-40 8-14-10Z" className="ln-ico__side" />
      <path d="M22 18l40-8v46l-40 8Z" className="ln-ico__top" />
      <g className="ln-ico__cell">
        <ellipse cx="42" cy="40" rx="11" ry="9" className="ln-ico__mari" />
        <circle cx="45" cy="37" r="3" className="ln-ico__ink" />
      </g>
      <path d="M28 56l28-5.6M28 61l18-3.6" className="ln-ico__line" />
    </svg>
  );
}

function VialsIcon() {
  return (
    <svg viewBox="0 0 96 80" aria-hidden="true" className="ln-ico ln-ico--vials">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${20 + i * 22} ${10 + i * 4})`}>
          <rect x="0" y="0" width="14" height="52" rx="7" className="ln-ico__top" />
          <rect x="2.5" y="18" width="9" height="31.5" rx="4.5" className="ln-ico__fill" style={{ animationDelay: `${-i * 0.7}s` }} />
          <rect x="-2" y="-3" width="18" height="6" rx="2" className="ln-ico__side" />
        </g>
      ))}
    </svg>
  );
}

function TeeIcon() {
  return (
    <svg viewBox="0 0 96 80" aria-hidden="true" className="ln-ico ln-ico--tee">
      <path d="M16 22l42-8 22 12v38l-42 8-22-12Z" className="ln-ico__side" />
      <path d="M16 22l42-8v38l-42 8Z" className="ln-ico__frost" />
      <g className="ln-ico__lock" transform="translate(37 34)">
        <rect x="-8" y="0" width="16" height="13" rx="3" className="ln-ico__mari" />
        <path d="M-5 0v-4a5 5 0 0 1 10 0v4" className="ln-ico__line" />
      </g>
      <path d="M24 58l26-5" className="ln-ico__sig" />
    </svg>
  );
}

const ITEMS = [
  { std: "NEP-141", file: "nep-141.coin", name: "$SNACC", line: "The memecoin every Snacc eats. A testnet token with no monetary value.", Art: CoinIcon },
  { std: "NEP-171 / 177", file: "nep-171.nft", name: "Living NFT", line: "Each Snacc is an NFT whose picture is an SVG drawn by the contract itself.", Art: NftIcon },
  { std: "NEP-245", file: "nep-245.multi", name: "Spores · enzymes · elixirs", line: "The supply chain is a multi-token: raw, refined and finished goods.", Art: VialsIcon },
  { std: "NEAR AI Cloud", file: "near-ai.tee", name: "TEE diet plans", line: "Plans run inside a TEE; the contract checks the enclave signature.", Art: TeeIcon },
] as const;

export function UnderHood() {
  return (
    <section id="hood" className="ln-section ln-hood" aria-labelledby="ln-hood-title">
      <div className="ln-section__inner">
        <header className="ln-section__head" data-reveal="">
          <Chip>fig-08.under-the-hood</Chip>
          <h2 id="ln-hood-title" className="ln-section__title">
            <Accent text="Four NEAR building blocks, one living machine." accent="one living machine" />
          </h2>
        </header>
        <ul className="ln-hood__grid">
          {ITEMS.map(({ std, file, name, line, Art }, i) => (
            <li key={std} className="ln-hood__cell" data-reveal="" style={{ transitionDelay: `${i * 80}ms` }}>
              <Win title={file} className="ln-hood__item">
                <Art />
                <p className="ln-hood__std">
                  <Cap icon="doc">{std}</Cap>
                </p>
                <h3 className="ln-hood__name">{name}</h3>
                <p className="ln-hood__line">{line}</p>
              </Win>
            </li>
          ))}
        </ul>
        <nav className="ln-repos" aria-label="Source code" data-reveal="">
          <span className="ln-repos__k">
            <Icon name="grid" /> open source
          </span>
          {REPOS.map((r) => (
            <a key={r} href={`${LINKS.github}/${r}`} target="_blank" rel="noopener noreferrer">
              {r}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
