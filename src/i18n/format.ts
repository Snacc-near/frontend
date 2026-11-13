/**
 * Message templates (UI-161). The only syntax is `{name}`: a placeholder replaced by a value. There is
 * no plural engine; word order and plurals are handled by writing a separate key per case.
 */
import type { Vars } from "./types.ts";

const PLACEHOLDER = /\{(\w+)\}/g;

export type TemplatePart = string | { readonly name: string };

/** Splits a template into literal text and placeholders, in order. */
export function splitTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const m of template.matchAll(PLACEHOLDER)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(template.slice(last, at));
    parts.push({ name: m[1]! });
    last = at + m[0].length;
  }
  if (last < template.length) parts.push(template.slice(last));
  return parts;
}

/** Replaces every `{name}` with `vars[name]`; a placeholder with no value is left as written. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** Names of the placeholders in a template, sorted and unique (used by the parity test). */
export function placeholderNames(template: string): string[] {
  return [...new Set(splitTemplate(template).flatMap((p) => (typeof p === "string" ? [] : [p.name])))].sort();
}
