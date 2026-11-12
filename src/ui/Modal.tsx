/**
 * Modal window on the shared `Win` look: Escape and backdrop click close it, Tab stays inside, the
 * first control gets focus on open and focus returns to the opener on close. A bottom sheet under
 * 640 px (CSS); the body scrolls inside the window.
 */
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Icon } from "./fd.tsx";
import { FOCUSABLE, isTopModal, modalKeyAction, popModal, pushModal } from "./a11y.ts";

export interface ModalProps {
  /** Mono `name.ext` window title. */
  title: string;
  /** Plain-language heading at the top of the body; it joins the title as the dialog's name. */
  heading?: string;
  onClose: () => void;
  children: ReactNode;
  /** Bottom strip (status / provenance line). */
  footer?: ReactNode;
  size?: "md" | "lg";
  /** Element to focus on open; defaults to `[data-autofocus]`, then the first control. */
  initialFocus?: RefObject<HTMLElement | null>;
  testId?: string;
}

function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getAttribute("aria-hidden") !== "true");
}

export function Modal({ title, heading, onClose, children, footer, size = "md", initialFocus, testId }: ModalProps) {
  const titleId = useId();
  const headingId = useId();
  const winRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = pushModal();
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const win = winRef.current;
    const first =
      initialFocus?.current ??
      win?.querySelector<HTMLElement>("[data-autofocus]") ??
      focusablesIn(win).find((el) => !el.classList.contains("fd-win__close")) ??
      win;
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (!isTopModal(id)) return;
      const list = focusablesIn(winRef.current);
      const action = modalKeyAction(e.key, e.shiftKey, list.length, list.indexOf(document.activeElement as HTMLElement));
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      if (action.type === "close") closeRef.current();
      else list[action.index]?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      popModal(id);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // Mount/unmount only: the opener and the first focus are captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fd-modal fd-ui"
      data-testid={testId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={winRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading ? `${titleId} ${headingId}` : titleId}
        tabIndex={-1}
        className={`fd-win fd-win--modal fd-modal__win${size === "lg" ? " fd-modal__win--lg" : ""}`}
      >
        <div className="fd-win__bar">
          <span className="fd-win__btn" aria-hidden="true" />
          <span className="fd-win__rule" aria-hidden="true" />
          <h2 id={titleId} className="fd-win__title">
            {title}
          </h2>
          <span className="fd-win__rule" aria-hidden="true" />
          <button type="button" className="fd-win__close" onClick={onClose} aria-label={`close ${title}`}>
            <Icon name="close" />
          </button>
        </div>
        <div className="fd-win__body">
          {heading ? (
            <h3 id={headingId} className="fd-h fd-modal__heading">
              {heading}
            </h3>
          ) : null}
          {children}
        </div>
        {footer ? <div className="fd-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
