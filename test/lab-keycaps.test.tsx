import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { CellLab } from "../src/hud/CellLab.tsx";
import { LAB_ACTIONS, buildPlayMessage } from "../src/game/bridge.ts";
import {
  BUSY_TIMEOUT_MS,
  LAB_KEYCAPS,
  LIVE_PREVIEW_NOTE,
  buildLabStateMessage,
  busyReducer,
  createStateSender,
  idleBusy,
  isKeyDisabled,
  resolveOrganelLevels,
} from "../src/game/labState.ts";
import type { StrainDetail } from "../src/data/types.ts";
import type { OrganelleLevels } from "../src/game/simulation.ts";

const strain: StrainDetail = {
  strain_id: 7,
  owner_id: "alice.testnet",
  vault_subaccount: "v.alice.testnet",
  vitality: 7200,
  efficiency_bps: 10000,
  bmr_per_hour: 100,
  last_fed_sec: 0,
  role_mask: 0,
  state_nonce: 1,
  pending_callbacks: 0,
  atp_balance: "5",
  generation: 1,
  organel: { mitokondria: 1, nukleus: 1, lisosom: 0 },
  status: "Active",
  effective_vitality: 7200,
};

const sim: OrganelleLevels = { mitokondria: 2, nukleus: 1, lisosom: 1 };

function render(mode: "demo" | "live", s: StrainDetail | null, simOrganel = sim): string {
  return renderToStaticMarkup(
    <CellLab
      strain={s}
      isLoading={false}
      zone="Goldilocks"
      mode={mode}
      svgDataUri={null}
      svgStatus="idle"
      simOrganel={simOrganel}
      atpAvailable={500}
      onClose={() => {}}
      onAction={() => true}
      onUpgrade={() => {}}
    />,
  );
}

function panelLevels(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/data-testid="organel-level-(\w+)">([^<]*)</g)) out[m[1]] = m[2];
  return out;
}

describe("lab keycaps → snacc:play mapping", () => {
  it("covers every figure action exactly once", () => {
    expect(LAB_KEYCAPS.map((k) => k.action).sort()).toEqual([...LAB_ACTIONS].sort());
    expect(LAB_KEYCAPS).toHaveLength(12);
  });

  it("each keycap builds the snacc:play message for its own action", () => {
    for (const cap of LAB_KEYCAPS) {
      expect(buildPlayMessage(cap.action)).toEqual({ type: "snacc:play", action: cap.action });
    }
  });

  it("marks only produce atp as the primary key, vacuole and attest as preview-only", () => {
    expect(LAB_KEYCAPS.filter((k) => k.primary).map((k) => k.action)).toEqual(["atp"]);
    expect(LAB_KEYCAPS.filter((k) => k.previewOnly).map((k) => k.action)).toEqual(["vacuole", "attest"]);
  });

  it("renders all 12 keycaps in the sheet, enabled, with a data-action each", () => {
    const html = render("demo", strain);
    for (const action of LAB_ACTIONS) expect(html).toContain(`data-action="${action}"`);
    const keys = html.match(/<button[^>]*data-action="[a-z]+"[^>]*>/g) ?? [];
    expect(keys).toHaveLength(12);
    expect(keys.some((k) => k.includes("disabled"))).toBe(false);
  });

  it("live mode keeps every key and shows the honest preview-only label", () => {
    const html = render("live", strain);
    expect((html.match(/data-action="/g) ?? []).length).toBe(12);
    expect(html).toContain(LIVE_PREVIEW_NOTE);
    expect(LIVE_PREVIEW_NOTE).toBe("preview only — on-chain transactions need a wallet");
  });
});

describe("busy / done state", () => {
  it("locks every key while an animation runs and releases on done", () => {
    let s = idleBusy;
    expect(isKeyDisabled(s)).toBe(false);
    s = busyReducer(s, { type: "start", action: "atp" });
    expect(isKeyDisabled(s)).toBe(true);
    expect(s.busy.has("atp")).toBe(true);
    s = busyReducer(s, { type: "done", action: "atp" });
    expect(isKeyDisabled(s)).toBe(false);
  });

  it("releases on the timeout fallback when snacc:done never arrives", () => {
    let s = busyReducer(idleBusy, { type: "start", action: "attest" });
    s = busyReducer(s, { type: "timeout", action: "attest" });
    expect(isKeyDisabled(s)).toBe(false);
    // longest figure animation is 8.0 s: the fallback must outlast it
    expect(BUSY_TIMEOUT_MS).toBeGreaterThan(8000);
    expect(BUSY_TIMEOUT_MS).toBeLessThanOrEqual(12000);
  });

  it("does not mutate the previous state and ignores done for other actions", () => {
    const a = busyReducer(idleBusy, { type: "start", action: "feed" });
    const b = busyReducer(a, { type: "done", action: "vacuole" });
    expect(idleBusy.busy.size).toBe(0);
    expect(b.busy.has("feed")).toBe(true);
  });
});

describe("single source of truth for organelle levels", () => {
  it("demo: the panel renders the sim levels, and snacc:state carries the same numbers", () => {
    const html = render("demo", strain);
    const panel = panelLevels(html);
    const posted = buildLabStateMessage("demo", strain, sim, "Goldilocks").strain.organel;
    expect(panel).toEqual({
      mitokondria: String(posted.mitokondria),
      nukleus: String(posted.nukleus),
      lisosom: String(posted.lisosom),
    });
    // the strain's own organel (1/1/0) must not leak into the demo view
    expect(posted).toEqual({ mitokondria: 2, nukleus: 1, lisosom: 1 });
  });

  it("live: the panel renders the API strain levels, and snacc:state carries the same numbers", () => {
    const live = { ...strain, organel: { mitokondria: 3, nukleus: 2, lisosom: 4 } };
    const panel = panelLevels(render("live", live));
    const posted = buildLabStateMessage("live", live, sim, "Fever").strain.organel;
    expect(posted).toEqual({ mitokondria: 3, nukleus: 2, lisosom: 4 });
    expect(panel).toEqual({ mitokondria: "3", nukleus: "2", lisosom: "4" });
  });

  it("live: missing organelle fields render as a dash and post level 0", () => {
    const partial = { ...strain, organel: { mitokondria: 2 } } as unknown as StrainDetail;
    const resolved = resolveOrganelLevels("live", partial, sim);
    expect(resolved.levels).toEqual({ mitokondria: 2, nukleus: 0, lisosom: 0 });
    expect(resolved.known).toEqual({ mitokondria: true, nukleus: false, lisosom: false });
    const panel = panelLevels(render("live", partial));
    expect(panel).toEqual({ mitokondria: "2", nukleus: "—", lisosom: "—" });
    expect(buildLabStateMessage("live", partial, sim, "Goldilocks").strain.organel).toEqual(resolved.levels);
  });

  it("a demo upgrade changes both the panel and the posted state together", () => {
    const upgraded: OrganelleLevels = { mitokondria: 3, nukleus: 1, lisosom: 1 };
    expect(panelLevels(render("demo", strain, upgraded)).mitokondria).toBe("3");
    expect(buildLabStateMessage("demo", strain, upgraded, "Goldilocks").strain.organel.mitokondria).toBe(3);
  });

  it("carries the zone through unchanged", () => {
    expect(buildLabStateMessage("demo", strain, sim, "Hypothermia").zone).toBe("Hypothermia");
  });
});

describe("snacc:state re-send handshake", () => {
  it("de-duplicates unchanged state but re-sends after snacc:ready (force)", () => {
    const post = vi.fn();
    const sender = createStateSender(post);
    const msg = buildLabStateMessage("demo", strain, sim, "Goldilocks");
    expect(sender.send(msg)).toBe(true);
    expect(sender.send(msg)).toBe(false);
    // figure finished loading later and announced ready: it must get the state again
    expect(sender.send(msg, true)).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("re-sends on every change: upgrade, strain switch, zone change", () => {
    const post = vi.fn();
    const sender = createStateSender(post);
    sender.send(buildLabStateMessage("demo", strain, sim, "Goldilocks"));
    sender.send(buildLabStateMessage("demo", strain, { ...sim, mitokondria: 3 }, "Goldilocks"));
    sender.send(buildLabStateMessage("demo", { ...strain, strain_id: 8 }, { ...sim, mitokondria: 3 }, "Goldilocks"));
    sender.send(buildLabStateMessage("demo", { ...strain, strain_id: 8 }, { ...sim, mitokondria: 3 }, "Fever"));
    expect(post).toHaveBeenCalledTimes(4);
    expect(post.mock.calls[3][0].zone).toBe("Fever");
  });
});
