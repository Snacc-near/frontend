import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { CellLab } from "../src/hud/CellLab.tsx";
import { StrainDetailModal } from "../src/hud/StrainDetailModal.tsx";
import { ActionDock } from "../src/hud/GameHud.tsx";
import type { StrainDetail } from "../src/data/types.ts";

const strain: StrainDetail = {
  strain_id: 7,
  owner_id: "alice.testnet",
  vault_subaccount: "v7.alice.testnet",
  vitality: 7200,
  efficiency_bps: 10000,
  bmr_per_hour: 100,
  last_fed_sec: 0,
  role_mask: 0,
  state_nonce: 1,
  pending_callbacks: 0,
  atp_balance: "5",
  generation: 1,
  organel: { mitokondria: 1, nukleus: 2, lisosom: 0 },
  status: "Active",
  effective_vitality: 7100,
};

function lab(mode: "demo" | "live"): string {
  return renderToStaticMarkup(
    <CellLab
      strain={strain}
      isLoading={false}
      zone="Goldilocks"
      mode={mode}
      svgDataUri={null}
      svgStatus="idle"
      simOrganel={{ mitokondria: 1, nukleus: 1, lisosom: 1 }}
      atpAvailable={500}
      onClose={() => {}}
      onAction={() => true}
      onUpgrade={() => {}}
    />,
  );
}

function detail(props: Partial<React.ComponentProps<typeof StrainDetailModal>> = {}): string {
  return renderToStaticMarkup(<StrainDetailModal strain={strain} skin="biolab" mode="demo" onClose={() => {}} {...props} />);
}

describe("UI-144: Cell Lab and Strain Detail on the shared Modal", () => {
  it("Cell Lab is one modal dialog with the shared window bar, close key and footer", () => {
    const html = lab("demo");
    expect(html).toContain('class="fd-modal fd-ui"');
    expect(html).toContain('data-testid="cell-lab"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="close cell-lab.fig"');
    expect(html).toContain("fd-modal__win--xl");
    expect(html).toContain("cell lab — strain #7");
    expect(html).not.toContain("fixed inset-0");
  });

  it("Cell Lab keeps the mode label and the connection line", () => {
    expect(lab("demo")).toContain("demo · simulated");
    expect(lab("live")).toContain("live · mechanism preview");
    expect(lab("demo")).toContain("waiting for figure (snacc:ready)…");
  });

  it("Strain Detail is one modal dialog and keeps the numbers from the strain", () => {
    const html = detail();
    expect(html).toContain('data-testid="strain-detail-modal"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="close strain.nft"');
    expect(html).toContain("strain #7");
    expect(html).toContain("alice.testnet");
    expect(html).toContain("v7.alice.testnet");
    expect(html).toContain("7,200");
    expect(html).toContain("7,100");
    expect(html).toContain("100 / hour");
    expect(html).toContain("demo, simulated");
    expect(html).not.toContain("fixed inset-0");
  });

  it("Strain Detail shows only a dash when the effective vitality is unknown, and disables feeding live", () => {
    // The API can omit the field even though the type says number: the modal guards with a typeof check.
    const html = detail({ strain: { ...strain, effective_vitality: undefined as unknown as number }, mode: "live", svgStatus: "error" });
    expect(html).toContain("svg request failed");
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).not.toContain("7,100");
  });

  it("Strain Detail renders nothing without a strain that is loading or loaded", () => {
    expect(detail({ strain: null, isLoading: false })).toBe("");
    expect(detail({ strain: null, isLoading: true })).toContain("loading the strain data from the contract...");
  });
});

describe("UI-144: action dock labels on a phone", () => {
  const dock = [
    { key: "feed", label: "Feed", hint: "feed_strain", disabled: false },
    { key: "atp", label: "Produce ATP", hint: "allocate_atp", disabled: false },
    { key: "synthesize", label: "Synthesize", hint: "synthesize", disabled: false },
  ];
  const html = renderToStaticMarkup(<ActionDock dock={dock} onDock={() => {}} />);

  it("wraps to rows under 640 px instead of squeezing every label into one row", () => {
    expect(html).toContain("max-sm:flex-wrap");
    expect(html).toContain("max-sm:basis-[calc(25%-4px)]");
    expect(html).not.toContain("max-sm:text-[10px]");
  });

  it("keeps every label, test id and the primary key", () => {
    for (const d of dock) {
      expect(html).toContain(`data-testid="dock-${d.key}"`);
      expect(html).toContain(`<span>${d.label}</span>`);
    }
    expect(html).toContain("keycap--primary");
  });
});
