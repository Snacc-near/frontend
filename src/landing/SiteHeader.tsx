import { useState } from "react";
import { LanguageToggle } from "../i18n/LanguageToggle.tsx";
import { useT } from "../i18n/react.tsx";
import { bioSound } from "../sound.ts";
import { BrandChip } from "./BrandChip.tsx";
import { LINKS } from "./chapters.ts";
import type { LiveStatus } from "./useLive.ts";

export function SiteHeader({ live }: { live: LiveStatus }) {
  const { t } = useT();
  const [sound, setSound] = useState(false);
  const toggle = () => {
    const next = !sound;
    bioSound.enabled = next;
    setSound(next);
    if (next) bioSound.playClick();
  };
  return (
    <header className="ln-header">
      <div className="ln-header__inner">
        <BrandChip />
        <span className="ln-header__live" data-status={live}>
          <span className="ln-dot" aria-hidden="true" />
          {t(`landing.header.status.${live}`)}
        </span>
        <nav className="ln-nav" aria-label={t("landing.header.nav.label")}>
          <a className="ln-nav__link ln-nav__link--opt" href="#story">
            {t("landing.header.nav.story")}
          </a>
          <a className="ln-nav__link ln-nav__link--opt" href="#live">
            {t("landing.header.nav.live")}
          </a>
          <a className="ln-nav__link ln-nav__link--opt" href={LINKS.github} target="_blank" rel="noopener noreferrer">
            {t("landing.header.nav.github")}
          </a>
          <LanguageToggle label={t("landing.header.language")} />
          <button type="button" className="ln-sound" aria-pressed={sound} onClick={toggle} aria-label={t("landing.header.sound")}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 8h3l4-3v10l-4-3H3z" />
              {sound ? <path className="ln-sound__wave" d="M13 7c1.2 1.6 1.2 4.4 0 6M15.5 5c2.2 2.8 2.2 7.2 0 10" /> : <path className="ln-sound__wave" d="M13 8l4 4M17 8l-4 4" />}
            </svg>
          </button>
          <a className="fd-btn fd-btn--primary fd-btn--sm" href={LINKS.app} data-magnetic="">
            {t("landing.header.launch")}
          </a>
        </nav>
      </div>
    </header>
  );
}
