import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { browserOptedOut, buildBatch, readTelemetryChoice, telemetryEnabled, TELEMETRY_KEY, DEVICE_KEY } from "../src/telemetry.ts";
import { APP_LOCAL_KEYS } from "../src/prefs/prefs.ts";
import { profileSaveError } from "../src/account/api.ts";
import { pickAnnouncement, readDismissed, DISMISSED_ANNOUNCEMENTS_KEY } from "../src/account/AnnouncementBanner.tsx";
import { exportFileName, MyDataSettings, UsageStatsSettings, AdminTools } from "../src/account/AccountSettings.tsx";
import { PRIVACY } from "../src/legal/content.ts";

const store = (o: Record<string, string>) => ({ getItem: (k: string) => o[k] ?? null });
const cfg = { url: "https://x.supabase.co", key: "sb_publishable_test" };

describe("OPS-127 usage stats switch", () => {
  it("is off without Supabase, off in tests, off on explicit opt-out, and follows DNT/GPC by default", () => {
    // vitest runs with MODE=test, so even a full config is off here: telemetry never fires from the test suite.
    expect(telemetryEnabled("on", false, cfg)).toBe(false);
    expect(telemetryEnabled("on", false, null)).toBe(false);
    expect(browserOptedOut({ doNotTrack: "1" })).toBe(true);
    expect(browserOptedOut({ globalPrivacyControl: true } as never)).toBe(true);
    expect(browserOptedOut({ doNotTrack: "0" })).toBe(false);
    expect(browserOptedOut(undefined)).toBe(false);
  });

  it("reads only the two valid choices", () => {
    expect(readTelemetryChoice(store({ [TELEMETRY_KEY]: "off" }))).toBe("off");
    expect(readTelemetryChoice(store({ [TELEMETRY_KEY]: "on" }))).toBe("on");
    expect(readTelemetryChoice(store({ [TELEMETRY_KEY]: "maybe" }))).toBeNull();
    expect(readTelemetryChoice(null)).toBeNull();
  });

  it("builds a batch with only ids, allow-listed names, routes and small props", () => {
    const body = JSON.parse(buildBatch("dev-12345678", "ses-12345678", [{ name: "page_view", route: "/app", props: {}, ts: 1 }], []));
    expect(Object.keys(body).sort()).toEqual(["deviceId", "errors", "events", "sessionId"]);
    expect(JSON.stringify(body)).not.toMatch(/testnet|ed25519|accountId/);
  });

  it("lists its two browser keys so Reset local data clears them", () => {
    expect(APP_LOCAL_KEYS).toContain(TELEMETRY_KEY);
    expect(APP_LOCAL_KEYS).toContain(DEVICE_KEY);
  });

  it("is described on the privacy page, including how to turn it off", () => {
    const s = PRIVACY.sections.find((x) => x.id === "usage-stats");
    expect(s).toBeTruthy();
    const text = s!.paragraphs.join(" ");
    expect(text).toMatch(/never holds your account id/);
    expect(text).toMatch(/Do Not Track/);
    expect(PRIVACY.lead).not.toMatch(/runs no analytics/);
  });
});

describe("UI-162 moderation messages + announcements", () => {
  it("turns database errors into plain text", () => {
    expect(profileSaveError({ code: "23505", message: "dup" })).toMatch(/taken/);
    expect(profileSaveError({ code: "P0001", message: "username_not_allowed" })).toMatch(/reserved or contains a blocked word/);
    expect(profileSaveError({ code: "P0001", message: "bio_not_allowed" })).toMatch(/bio contains a blocked word/);
    expect(profileSaveError({ message: "other" })).toBe("other");
  });

  it("shows the newest announcement that was not dismissed", () => {
    const rows = [
      { id: 9, title: "new", body: "", created_at: "2026-11-13T10:00:00Z", expires_at: null },
      { id: 4, title: "old", body: "", created_at: "2026-11-12T10:00:00Z", expires_at: null },
    ];
    expect(pickAnnouncement(rows, [])?.id).toBe(9);
    expect(pickAnnouncement(rows, [9])?.id).toBe(4);
    expect(pickAnnouncement(rows, [9, 4])).toBeNull();
  });

  it("reads dismissed ids defensively", () => {
    expect(readDismissed(store({ [DISMISSED_ANNOUNCEMENTS_KEY]: "[1,2,\"x\",3.5]" }))).toEqual([1, 2]);
    expect(readDismissed(store({ [DISMISSED_ANNOUNCEMENTS_KEY]: "not json" }))).toEqual([]);
    expect(readDismissed(null)).toEqual([]);
  });
});

describe("UI-163 data download", () => {
  it("names the file after the account and the UTC date", () => {
    expect(exportFileName("alice.testnet", new Date("2026-11-13T23:00:00Z"))).toBe("snacc-data-alice.testnet-2026-11-13.json");
    expect(exportFileName(null, new Date("2026-11-13T00:00:00Z"))).toBe("snacc-data-player-2026-11-13.json");
    expect(exportFileName("a/../b", new Date("2026-11-13T00:00:00Z"))).toBe("snacc-data-a_.._b-2026-11-13.json");
  });

  it("settings sections stay hidden without the profile backend", () => {
    expect(renderToStaticMarkup(<MyDataSettings />)).toBe("");
    expect(renderToStaticMarkup(<UsageStatsSettings />)).toBe("");
    expect(renderToStaticMarkup(<AdminTools />)).toBe("");
  });
});
