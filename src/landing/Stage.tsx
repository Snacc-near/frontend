import type { ReactNode } from "react";

/**
 * Reserved slot for the illustrated figure of a chapter. The scroll theatre (a later item)
 * mounts into `[data-stage]`; until then it is an empty paper card with its "FIG nn" pill.
 */
export function Stage({ num, fig, children }: { num: string; fig: string; children?: ReactNode }) {
  return (
    <div className="ln-stage" data-stage={num} data-fig={fig}>
      <span className="label-plate ln-stage__pill">
        <span className="lp-label">FIG {num}</span>
        <span>{fig}</span>
      </span>
      {children}
    </div>
  );
}
