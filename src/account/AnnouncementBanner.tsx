/**
 * UI-162: the newest unexpired announcement from `announcements_snacc` (written by admins through
 * `snacc_admin_broadcast()`), shown as a slim dismissible banner once the profile client is loaded
 * (wallet connected or profile session); the same text also arrives as a notification for every
 * profile. Dismissed ids are remembered in this browser. Inert without Supabase.
 */
import { useEffect, useState } from "react";
import { useAccount } from "./session.tsx";
import { loadAnnouncements, type AnnouncementRow } from "./api.ts";
import { safeLocalStorage } from "./config.ts";
import "./account.css";

export const DISMISSED_ANNOUNCEMENTS_KEY = "snacc_dismissed_announcements";

export function readDismissed(store: Pick<Storage, "getItem"> | null = safeLocalStorage()): number[] {
  try {
    const raw = JSON.parse(store?.getItem(DISMISSED_ANNOUNCEMENTS_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is number => Number.isSafeInteger(x)).slice(-50) : [];
  } catch {
    return [];
  }
}

/** The announcement to show: newest first, skipping dismissed ones. */
export function pickAnnouncement(rows: readonly AnnouncementRow[], dismissed: readonly number[]): AnnouncementRow | null {
  return rows.find((r) => !dismissed.includes(r.id)) ?? null;
}

export function AnnouncementBanner() {
  const account = useAccount();
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [dismissed, setDismissed] = useState<number[]>(() => readDismissed());

  // Uses the client only once it exists (a wallet is connected or a profile session is stored), so the
  // app does not contact Supabase for visitors who never connect — as the privacy page promises.
  const client = account.client;
  useEffect(() => {
    if (!client) return;
    let alive = true;
    void loadAnnouncements(client, 3).then((list) => {
      if (alive) setRows(list);
    });
    return () => {
      alive = false;
    };
  }, [client]);

  const current = pickAnnouncement(rows, dismissed);
  if (!current) return null;
  const dismiss = () => {
    const next = [...dismissed, current.id].slice(-50);
    setDismissed(next);
    try {
      safeLocalStorage()?.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="acct-announce" role="status" data-testid="announcement">
      <strong className="acct-announce__title">{current.title}</strong>
      {current.body ? <span className="acct-announce__body">{current.body}</span> : null}
      <button type="button" className="acct-announce__close" onClick={dismiss} aria-label="dismiss announcement">
        ×
      </button>
    </div>
  );
}
