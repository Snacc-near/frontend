/**
 * First-run intro (UI-151): four short steps with Skip, Back and Next, a "step n of m" line with
 * progress dots, arrow-key navigation and Escape to skip. Escape, the close key and Skip all count as
 * done; the caller stores the seen-flag. The step change animation is plain CSS and is switched off
 * by reduce motion (see `guide.css`).
 */
import type { KeyboardEvent } from "react";
import { useState } from "react";
import { Modal } from "../ui/Modal.tsx";
import { KeycapButton } from "../ui/controls.tsx";
import { Cap } from "../ui/fd.tsx";
import { INTRO_STEPS } from "./content.ts";
import "../ui/fd.css";
import "./guide.css";

export interface OnboardingModalProps {
  /** Called on Skip, close, Escape and after the last step. */
  onDone: () => void;
}

export function OnboardingModal({ onDone }: OnboardingModalProps) {
  const [index, setIndex] = useState(0);
  const total = INTRO_STEPS.length;
  const step = INTRO_STEPS[index];
  const last = index === total - 1;

  const next = () => (last ? onDone() : setIndex((i) => Math.min(total - 1, i + 1)));
  const back = () => setIndex((i) => Math.max(0, i - 1));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      back();
    }
  };

  return (
    <Modal
      title="welcome.md"
      heading={step.title}
      onClose={onDone}
      testId="onboarding-modal"
      footer={
        <div className="guide-progress" data-testid="onboarding-progress">
          <span>
            step {index + 1} of {total}
          </span>
          <ol className="guide-dots" aria-hidden="true">
            {INTRO_STEPS.map((s, i) => (
              <li key={s.id} aria-current={i === index ? "step" : undefined} data-done={i < index ? "" : undefined} />
            ))}
          </ol>
        </div>
      }
    >
      <div className="fd-stack" onKeyDown={onKeyDown}>
        <div aria-live="polite" data-testid="onboarding-step">
          <div key={step.id} className="fd-stack guide-step">
            <div className="fd-row">
              <Cap icon={step.icon}>{step.topic}</Cap>
            </div>
            <p className="guide-lead">{step.body}</p>
            <ul className="guide-points">
              {step.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="guide-actions">
          {last ? null : (
            <KeycapButton mono onClick={onDone} data-testid="onboarding-skip">
              skip intro
            </KeycapButton>
          )}
          <div className="guide-actions__right">
            {index > 0 ? (
              <KeycapButton mono onClick={back} data-testid="onboarding-back">
                back
              </KeycapButton>
            ) : null}
            <KeycapButton variant="primary" mono icon={last ? "check" : undefined} onClick={next} data-autofocus="" data-testid="onboarding-next">
              {last ? "start playing" : "next"}
            </KeycapButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default OnboardingModal;
