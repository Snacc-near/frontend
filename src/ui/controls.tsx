/**
 * Shared controls on the docs-site look: keycap buttons (40 px targets), labelled fields, tabs with
 * real tab semantics, empty states and a copy button that reports failure.
 */
import { useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Icon, type IconName } from "./fd.tsx";
import { tabKeyTarget } from "./a11y.ts";

type KeyStyle = { variant?: "default" | "primary"; mono?: boolean; block?: boolean; icon?: IconName };

function keyClass({ variant, mono, block }: KeyStyle, extra = ""): string {
  return ["fd-key", variant === "primary" ? "fd-key--primary" : "", mono ? "fd-key--mono" : "", block ? "fd-key--block" : "", extra]
    .filter(Boolean)
    .join(" ");
}

export function KeycapButton({
  variant,
  mono,
  block,
  icon,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & KeyStyle) {
  return (
    <button type={type} className={keyClass({ variant, mono, block }, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

/** External link styled as a keycap; always opens in a new tab without an opener. */
export function KeycapLink({
  variant,
  mono,
  block,
  icon = "ext",
  className = "",
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & KeyStyle) {
  return (
    <a target="_blank" rel="noopener noreferrer" className={keyClass({ variant, mono, block }, className)} {...rest}>
      {children}
      <Icon name={icon} />
    </a>
  );
}

/** Inline external link (mono, underlined) with the external-arrow icon. */
export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="fd-a" href={href} target="_blank" rel="noopener noreferrer">
      {children} <Icon name="ext" />
    </a>
  );
}

export function Field({
  id,
  label,
  hint,
  bad = false,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  bad?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="fd-field">
      <label htmlFor={id} className="fd-field__label">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className={bad ? "fd-field__hint fd-field__hint--bad" : "fd-field__hint"} role={bad ? "alert" : undefined}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`fd-input ${className}`.trim()} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`fd-select ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
}

/** `role=tablist` with roving focus: arrows, Home and End move and select. */
export function Tabs<T extends string>({
  label,
  idBase,
  tabs,
  value,
  onChange,
}: {
  label: string;
  idBase: string;
  tabs: readonly TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className="fd-tabs fd-tabs--app">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          id={`${idBase}-tab-${t.id}`}
          aria-selected={t.id === value}
          aria-controls={`${idBase}-panel-${t.id}`}
          tabIndex={t.id === value ? 0 : -1}
          className="fd-tab"
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            const next = tabKeyTarget(e.key, i, tabs.length);
            if (next === null) return;
            e.preventDefault();
            onChange(tabs[next].id);
            refs.current[next]?.focus();
          }}
        >
          {t.icon ? <Icon name={t.icon} /> : null}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idBase, id, children }: { idBase: string; id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} className="fd-stack">
      {children}
    </div>
  );
}

/** Dashed empty-state box. */
export function Empty({ icon = "ring", children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="fd-empty" role="status">
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

/** Writes text to the clipboard and says whether it worked (the promise is always handled). */
export async function copyText(text: string, clip: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator?.clipboard): Promise<boolean> {
  if (!clip) return false;
  try {
    await clip.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({
  text,
  label,
  copiedLabel = "copied",
  failedLabel = "copy failed, select the text",
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  failedLabel?: string;
}) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <KeycapButton
      mono
      icon={state === "ok" ? "check" : state === "fail" ? "warn" : "copy"}
      onClick={() => {
        void copyText(text).then((ok) => {
          setState(ok ? "ok" : "fail");
          window.setTimeout(() => setState("idle"), 2200);
        });
      }}
    >
      <span aria-live="polite">{state === "ok" ? copiedLabel : state === "fail" ? failedLabel : label}</span>
    </KeycapButton>
  );
}
