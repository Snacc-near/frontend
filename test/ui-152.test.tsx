/**
 * UI-152 (QA sweep of the production app): guards for the small layout and wording fixes found in
 * the sweep. Runs in node (no DOM): markup is rendered to a string and the stylesheets are read as text.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Footer } from "../src/hud/ChainActions.tsx";
import { ProductionQueuePanel } from "../src/hud/GameHud.tsx";
import { TOOLS, ToolsToolbar } from "../src/hud/ToolsToolbar.tsx";

const noop = () => {};
const read = (rel: string): string => readFileSync(join(__dirname, "..", rel), "utf8");

describe("toolbar fold (UI-152)", () => {
  const props = { skin: "biolab" as const, panelsOpen: false, onTogglePanels: noop, onOpen: noop, guestLabel: null };

  it("marks the strip as full only when every tool, the profile and quests keys included, is shown", () => {
    expect(renderToStaticMarkup(<ToolsToolbar {...props} />)).toContain("tools-bar--full");
    expect(renderToStaticMarkup(<ToolsToolbar {...props} hidden={["profile"]} />)).not.toContain("tools-bar--full");
    expect(renderToStaticMarkup(<ToolsToolbar {...props} hidden={["profile", "quests"]} />)).not.toContain("tools-bar--full");
    expect(TOOLS.some((t) => t.id === "profile")).toBe(true);
    expect(TOOLS.some((t) => t.id === "quests")).toBe(true);
  });

  it("folds the full strip into the tools sheet below 1360 px and the short one below 1140 px", () => {
    const css = read("src/ui/fd.css");
    expect(css).toMatch(/@media \(max-width: 1139\.98px\)[^@]*\.tools-bar \.tools-bar__tool\s*\{\s*display: none;/);
    expect(css).toMatch(/@media \(max-width: 1359\.98px\)[^@]*\.tools-bar--full \.tools-bar__tool\s*\{\s*display: none;/);
    expect(css).toMatch(/\.tools-bar--full \.tools-bar__more\s*\{\s*display: inline-flex;/);
  });
});

describe("window readouts and queue (UI-152)", () => {
  it("lets long method signatures in a key/value cell wrap instead of spilling out of the card", () => {
    expect(read("src/ui/fd.css")).toMatch(/\.fd-kv dd code\s*\{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/);
  });

  it("caps the height of the production queue list so a long queue scrolls instead of pushing the dock off a short screen", () => {
    const queue = Array.from({ length: 4 }, (_, i) => ({
      id: `q${i}`,
      kind: "atp" as const,
      amount: 3,
      durationSec: 10,
      remainingSec: 5,
      ready: false,
    }));
    const html = renderToStaticMarkup(<ProductionQueuePanel mode="demo" queue={queue} onCollect={noop} queueEmptyText="empty" />);
    expect(html).toContain('data-testid="queue-list"');
    expect(html).toMatch(/class="[^"]*max-h-\[max\(9\.5rem,22dvh\)\][^"]*overflow-y-auto[^"]*"/);
    expect((html.match(/data-testid="queue-item"/g) ?? []).length).toBe(4);
  });
});

describe("header and landing cards (UI-152)", () => {
  it("keeps the right header column on the first row (shrinkable) so the wallet key stays top-right below 1150 px", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('className="flex min-w-0 flex-1 flex-col items-end gap-1.5"');
    expect(read("src/hud/GameHud.tsx")).toContain("flex flex-wrap items-center justify-end gap-1.5");
  });

  it("wraps the status plate under the toolbar instead of clipping it at the screen edge", () => {
    expect(read("src/App.tsx")).toContain('className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5"');
  });

  it("lets the specimen card file name shrink so the title bar stays inside a 160 px phone card", () => {
    expect(read("src/landing/landing.css")).toMatch(/\.ln-nft \.fd-win__title\s*\{[^}]*flex: 0 1 auto;[^}]*min-width: 0;/);
  });
});

describe("action window footer (UI-152)", () => {
  it("does not read like a signed-in state while the wallet is not connected", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain("every call is signed in your wallet");
    expect(html).toContain("$SNACC on testnet has no monetary value");
  });
});
