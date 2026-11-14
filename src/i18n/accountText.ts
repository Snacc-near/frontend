/**
 * The plain-language messages of the profile service and of push (UI-161 phase B5) in the reader's language.
 * The code that produces them (`account/signIn.ts`, `account/api.ts`, `account/session.tsx`, `account/turnstile.ts`,
 * `push/client.ts`) keeps its English sentences: tests, logs and `AccountError.message` compare them. A screen
 * that shows one passes it through here; a sentence this file does not know (a message from the database, from
 * a wallet, from the browser) is shown as it came.
 *
 * The match table is built from the English dictionary, so an English sentence is typed once, in
 * `messages/en/account.ts` or `messages/en/push.ts`.
 */
import { flatten, type MessageKey, type Translate } from "./catalog.ts";
import { splitTemplate } from "./format.ts";
import { en } from "./messages/en/index.ts";

interface Entry {
  key: MessageKey;
  names: string[];
  re: RegExp;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function entriesOf(namespace: "account" | "push"): Entry[] {
  return Object.entries(flatten(en[namespace].messages)).map(([name, template]) => {
    const names: string[] = [];
    const source = splitTemplate(template)
      .map((part) => {
        if (typeof part === "string") return escapeRe(part);
        names.push(part.name);
        return "([\\s\\S]*?)";
      })
      .join("");
    return { key: `${namespace}.messages.${name}` as MessageKey, names, re: new RegExp(`^${source}$`) };
  });
}

const ENTRIES: readonly Entry[] = [...entriesOf("account"), ...entriesOf("push")];

/** The translated form of a known service message; anything else comes back unchanged. */
export function accountMessageText(t: Translate, message: string): string {
  for (const entry of ENTRIES) {
    const match = entry.re.exec(message);
    if (!match) continue;
    const vars: Record<string, string> = {};
    entry.names.forEach((name, i) => {
      vars[name] = match[i + 1] ?? "";
    });
    return t(entry.key, vars);
  }
  return message;
}
