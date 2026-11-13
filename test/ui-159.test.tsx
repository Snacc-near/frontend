import { describe, expect, it } from "vitest";
import { FEED_REQUEST_EVENT, feedParamOf, feedTargetOf, urgencyOf, type NotificationRow } from "../src/account/model.ts";
import { RULES } from "../src/help/content.ts";

const n = (kind: NotificationRow["kind"], strain_id: number | null = 7): NotificationRow => ({
  id: 1,
  user_id: "u1",
  kind,
  strain_id,
  title: "t",
  body: null,
  created_at: "2026-11-13T00:00:00Z",
  read_at: null,
});

describe("UI-159 feed-now from a hungry Snacc alert", () => {
  it("targets the Snacc only for starving and distressed alerts with a strain id", () => {
    expect(feedTargetOf(n("starving"))).toBe(7);
    expect(feedTargetOf(n("distressed", 0))).toBe(0);
    expect(feedTargetOf(n("starving", null))).toBeNull();
    for (const k of ["lost", "dividend", "starter", "system"] as const) expect(feedTargetOf(n(k))).toBeNull();
  });

  it("explains the risk in plain words for urgent kinds only", () => {
    expect(urgencyOf(n("starving"))).toMatch(/harvest/);
    expect(urgencyOf(n("distressed"))).toMatch(/feed it before it starves/);
    expect(urgencyOf(n("lost"))).toBeNull();
    expect(urgencyOf(n("system"))).toBeNull();
  });

  it("parses the /app?feed=<id> deep link strictly", () => {
    expect(feedParamOf("?feed=42")).toBe(42);
    expect(feedParamOf("?x=1&feed=0")).toBe(0);
    expect(feedParamOf("")).toBeNull();
    expect(feedParamOf("?feed=")).toBeNull();
    expect(feedParamOf("?feed=-1")).toBeNull();
    expect(feedParamOf("?feed=1e3")).toBeNull();
    expect(feedParamOf("?feed=12abc")).toBeNull();
    expect(feedParamOf("?feed=1234567890")).toBeNull();
    expect(FEED_REQUEST_EVENT).toBe("snacc:feed-request");
  });
});

describe("UI-159 help text matches the live action set", () => {
  it("no longer claims that only hatch and feed are signed", () => {
    const modes = RULES.find((t) => t.id === "modes");
    expect(modes?.body).toMatch(/every player action/);
    expect(modes?.body).not.toMatch(/run in the demo only/);
    for (const action of ["hatch", "feed", "divide", "splice", "adopt", "harvest", "dividend"]) expect(modes?.body).toContain(action);
  });
});
