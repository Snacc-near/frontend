/**
 * Shared UI language for the landing and the game: square "window" panels with a striped title
 * bar, bordered caption boxes with an icon, callout chips and line icons. Purely presentational;
 * styles live in `fd.css`.
 */
import type { ReactNode } from "react";
import { useT } from "../i18n/react.tsx";

export type IconName =
  | "ring"
  | "lines"
  | "cell"
  | "flask"
  | "split"
  | "gauge"
  | "lock"
  | "eye"
  | "chain"
  | "spark"
  | "doc"
  | "grid"
  | "close"
  | "search"
  | "copy"
  | "swap"
  | "podium"
  | "user"
  | "more"
  | "ext"
  | "check"
  | "warn"
  | "scale";

/** 12×12 line icons drawn in currentColor. */
export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `fd-ico ${className}` : "fd-ico"} viewBox="0 0 12 12" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const ICONS: Record<IconName, ReactNode> = {
  ring: (
    <>
      <circle cx="6" cy="6" r="4.5" />
      <circle cx="6" cy="6" r="1.6" className="fd-ico__fill" />
    </>
  ),
  lines: <path d="M2 3h8M2 6h8M2 9h5" />,
  cell: (
    <>
      <ellipse cx="6" cy="6.3" rx="4.6" ry="3.8" />
      <circle cx="7.4" cy="5.2" r="1.2" className="fd-ico__fill" />
    </>
  ),
  flask: <path d="M4.5 1.5h3M5 1.5v3L2.2 9.4a1 1 0 0 0 .9 1.4h5.8a1 1 0 0 0 .9-1.4L7 4.5v-3" />,
  split: <path d="M1.5 6h4l4-3.5M5.5 6l4 3.5M8 2.5h1.5V4M8 9.5h1.5V8" />,
  gauge: (
    <>
      <path d="M1.8 8.6a4.4 4.4 0 1 1 8.4 0" />
      <path d="M6 7.4 8.2 4.2" />
    </>
  ),
  lock: (
    <>
      <rect x="2.3" y="5.2" width="7.4" height="5.3" />
      <path d="M4 5.2V3.8a2 2 0 0 1 4 0v1.4" />
    </>
  ),
  eye: (
    <>
      <path d="M1 6s1.8-3.4 5-3.4S11 6 11 6s-1.8 3.4-5 3.4S1 6 1 6Z" />
      <circle cx="6" cy="6" r="1.4" className="fd-ico__fill" />
    </>
  ),
  chain: <path d="M5 7 7 5M4.2 5.4 3 6.6a1.8 1.8 0 0 0 2.5 2.5l1.2-1.2M7.8 6.6 9 5.4A1.8 1.8 0 0 0 6.5 2.9L5.3 4.1" />,
  spark: <path d="M6 1v3M6 8v3M1 6h3M8 6h3M2.6 2.6l1.6 1.6M7.8 7.8l1.6 1.6M2.6 9.4l1.6-1.6M7.8 4.2l1.6-1.6" />,
  doc: <path d="M3 1.5h4l2 2v7H3ZM7 1.5v2h2M4.5 6h3M4.5 8h3" />,
  grid: <path d="M1.5 1.5h9v9h-9ZM1.5 6h9M6 1.5v9" />,
  close: <path d="M2.8 2.8l6.4 6.4M9.2 2.8 2.8 9.2" />,
  search: (
    <>
      <circle cx="5" cy="5" r="3.2" />
      <path d="M7.4 7.4 10.6 10.6" />
    </>
  ),
  copy: <path d="M4 4h6.5v6.5H4ZM8 4V1.5H1.5V8H4" />,
  swap: <path d="M1.5 4h8M7.5 2l2 2-2 2M10.5 8h-8M4.5 6l-2 2 2 2" />,
  podium: <path d="M1 10.5h10M4.2 10.5V4.5h3.6v6M1 10.5V7h3.2M7.8 10.5V8.2H11v2.3" />,
  user: (
    <>
      <circle cx="6" cy="3.9" r="2.1" />
      <path d="M1.8 10.6c.6-2.3 2.2-3.5 4.2-3.5s3.6 1.2 4.2 3.5" />
    </>
  ),
  more: (
    <>
      <circle cx="2.3" cy="6" r="1" className="fd-ico__fill" />
      <circle cx="6" cy="6" r="1" className="fd-ico__fill" />
      <circle cx="9.7" cy="6" r="1" className="fd-ico__fill" />
    </>
  ),
  ext: <path d="M5 2.5H2v7.5h7.5V7M7 1.5h3.5V5M10.5 1.5 5.5 6.5" />,
  check: <path d="M2.2 6.3 4.8 8.8 9.8 3.2" />,
  warn: <path d="M6 1.5 11 10.5H1ZM6 4.8v2.7M6 8.6v.9" />,
  scale: <path d="M6 1.5v9M3.5 10.5h5M2 3.2h8M2 3.2 .8 6.6h2.4ZM10 3.2 8.8 6.6h2.4Z" />,
};

/** Retro window panel: `====  title  ====` bar with square buttons, content below. */
export function Win({
  title,
  children,
  className = "",
  as: Tag = "div",
  labelledBy,
  bodyClass = "",
  card = false,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li" | "figure" | "section";
  labelledBy?: string;
  bodyClass?: string;
  /** Marks the panel as the chapter card the theatre leader line attaches to. */
  card?: boolean;
}) {
  return (
    <Tag className={`fd-win ${className}`} aria-labelledby={labelledBy} data-card={card ? "" : undefined}>
      <div className="fd-win__bar" aria-hidden="true">
        <span className="fd-win__btn" />
        <span className="fd-win__rule" />
        <span className="fd-win__title">{title}</span>
        <span className="fd-win__rule" />
        <span className="fd-win__btn" />
      </div>
      <div className={`fd-win__body ${bodyClass}`}>{children}</div>
    </Tag>
  );
}

/** Small bordered caption box: icon + text. */
export function Cap({ icon, children, className = "" }: { icon: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={`fd-cap ${className}`}>
      <Icon name={icon} />
      <span>{children}</span>
    </span>
  );
}

/** Callout chip: `[●] text` with an icon cell and a dither offset. */
export function Chip({ children, className = "", dot = "accent" }: { children: ReactNode; className?: string; dot?: "accent" | "live" | "off" }) {
  return (
    <p className={`fd-chip ${className}`}>
      <span className="fd-chip__ico" aria-hidden="true">
        <span className={`fd-chip__dot fd-chip__dot--${dot}`} />
      </span>
      <span className="fd-chip__txt">{children}</span>
    </p>
  );
}

/** Headline with one accent phrase (first occurrence of `accent`) in the deep marigold. */
export function Accent({ text, accent }: { text: string; accent?: string }) {
  if (!accent) return <>{text}</>;
  const i = text.indexOf(accent);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <em className="fd-accent">{accent}</em>
      {text.slice(i + accent.length)}
    </>
  );
}

/** Mono "simulation" / "illustration" label (rendered uppercase), in the reader's language. */
export function Sim({ kind = "simulation" }: { kind?: "simulation" | "illustration" }) {
  const { t } = useT();
  return <span className="fd-sim">{t(`common.sim.${kind}`)}</span>;
}

/** Solid mono tag, e.g. `testnet` or `view`. */
export const Tag = ({ children }: { children: ReactNode }) => <span className="fd-tag">{children}</span>;
