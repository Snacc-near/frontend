/**
 * Keyboard logic for the shared Modal and Tabs, kept DOM-free so it can be unit tested.
 */

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Index to focus after Tab / Shift+Tab inside a trap of `count` elements (`current` = -1 when focus is outside). */
export function trapIndex(count: number, current: number, shift: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return shift ? count - 1 : 0;
  if (shift) return current === 0 ? count - 1 : current - 1;
  return current === count - 1 ? 0 : current + 1;
}

export type ModalKeyAction = { type: "close" } | { type: "focus"; index: number } | null;

/** What a modal does with a key: Escape closes, Tab cycles inside the dialog, anything else passes through. */
export function modalKeyAction(key: string, shift: boolean, count: number, current: number): ModalKeyAction {
  if (key === "Escape") return { type: "close" };
  if (key === "Tab") {
    const index = trapIndex(count, current, shift);
    return index < 0 ? null : { type: "focus", index };
  }
  return null;
}

/** Roving tabs: the index an arrow / Home / End key moves to, or null for any other key. */
export function tabKeyTarget(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Open modals, newest last: only the top one reacts to Escape and Tab. */
const stack: number[] = [];
let seq = 0;

export function pushModal(): number {
  seq += 1;
  stack.push(seq);
  return seq;
}

export function popModal(id: number): void {
  const i = stack.lastIndexOf(id);
  if (i >= 0) stack.splice(i, 1);
}

export function isTopModal(id: number): boolean {
  return stack[stack.length - 1] === id;
}

export function openModalCount(): number {
  return stack.length;
}
