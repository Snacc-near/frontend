/**
 * Small UI language shared by the landing sections: square "window" panels with a striped title
 * bar, bordered caption boxes with an icon, and callout chips. Purely presentational.
 */
import type { ReactNode } from "react";

export type IconName = "ring" | "lines" | "cell" | "flask" | "split" | "gauge" | "lock" | "eye" | "chain" | "spark" | "doc" | "grid";

/** 12×12 line icons drawn in currentColor. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="fd-ico" viewBox="0 0 12 12" aria-hidden="true">
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
  as?: "div" | "article" | "li" | "figure";
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

/** Mono "simulation" / "illustration" label. */
export const Sim = ({ kind = "simulation" }: { kind?: "simulation" | "illustration" }) => <span className="fd-sim">{kind}</span>;
