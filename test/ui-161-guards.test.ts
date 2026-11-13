/**
 * UI-161 guards over the dictionaries and the converted landing files:
 *  - English and Indonesian have the same keys, the same `{placeholders}` and no empty strings;
 *  - the Indonesian copy obeys the same honesty rules as the English copy (see also UI-140, which
 *    scans all of `src` for the English words);
 *  - no user-visible string is written straight into the JSX of the converted files.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { CATALOG, flatten } from "../src/i18n/catalog.ts";
import { placeholderNames } from "../src/i18n/format.ts";

const ROOT = path.resolve(__dirname, "..");
const EN = flatten(CATALOG.en);
const ID = flatten(CATALOG.id);

// ------------------------------------------------------------------ parity

describe("UI-161 dictionaries", () => {
  it("English and Indonesian have exactly the same keys", () => {
    expect(Object.keys(ID).sort()).toEqual(Object.keys(EN).sort());
  });

  it("has no empty or whitespace-only string in either language", () => {
    for (const [lang, dict] of [["en", EN], ["id", ID]] as const) {
      for (const [key, value] of Object.entries(dict)) expect(value.trim(), `${lang}:${key}`).not.toBe("");
    }
  });

  it("uses the same {placeholders} in both languages", () => {
    for (const key of Object.keys(EN)) expect(placeholderNames(ID[key]!), key).toEqual(placeholderNames(EN[key]!));
  });

  it("keeps the accent phrase inside its headline in both languages", () => {
    // Any block with an `accent` next to a `headline` or a `title`: the accent must occur in it.
    const blocks: Array<[string, string, string]> = [];
    for (const dict of [EN, ID]) {
      for (const key of Object.keys(dict)) {
        if (!key.endsWith(".accent")) continue;
        const base = key.slice(0, -".accent".length);
        const text = dict[`${base}.headline`] ?? dict[`${base}.title`];
        if (text) blocks.push([key, text, dict[key]!]);
      }
    }
    expect(blocks.length).toBeGreaterThanOrEqual(2 * (7 + 3));
    for (const [key, text, accent] of blocks) expect(text, key).toContain(accent);
  });

  it("does not copy English into the landing and demo copy of the Indonesian file", () => {
    // Values that are the same in both languages on purpose: names, units, language codes, file-like labels.
    const SAME = /^(\{[a-z]+\}|[\p{N}\s·+×>‑<:./,%$()↗✓-]|mK|GitHub|Live|live|FAQ|offline|enclave|Enclave|memecoin|token|testnet|nearblocks|NEAR|NFT|CrucibleTemp|The Pantry|\$SNACC|reset|open source|Extractor|Fermenter|Synthesizer|ignis|homeostasis|strain|faq\.md|Language \/ Bahasa|English|Bahasa Indonesia)+$/u;
    const same = Object.keys(EN)
      .filter((k) => /^(landing|demos)\./.test(k) && EN[k] === ID[k])
      .filter((k) => !SAME.test(EN[k]!));
    expect(same).toEqual([]);
  });
});

// ------------------------------------------------------------------ honesty in Indonesian

describe("UI-161 honesty rules in Indonesian", () => {
  // The Indonesian counterparts of the words the English guard (UI-140) bans: GameFi, investment,
  // yield, guaranteed or passive profit, dividends. "Tanpa nilai uang" and "permainan ekonomi
  // on-chain" are the approved phrasings.
  const BANNED_ID =
    /\b(gamefi|investasi|berinvestasi|menginvestasikan|investor|imbal hasil|hasil investasi|dividen|profit|yield|untung|keuntungan|laba|cuan|penghasilan pasif|passive income|jaminan|dijamin|menjamin|pasti)\b/i;

  const idFiles = fs
    .readdirSync(path.join(ROOT, "src/i18n/messages/id"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(ROOT, "src/i18n/messages/id", f));

  it("has none of the banned words in any Indonesian string", () => {
    const hits = Object.entries(ID)
      .filter(([, v]) => BANNED_ID.test(v))
      .map(([k]) => k);
    expect(hits).toEqual([]);
  });

  it("has none of them in the Indonesian files, comments included", () => {
    const hits = idFiles.flatMap((f) =>
      fs
        .readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ line, at: `${path.basename(f)}:${i + 1}` }))
        .filter((x) => BANNED_ID.test(x.line))
        .map((x) => x.at),
    );
    expect(hits).toEqual([]);
  });

  it("says the testnet token has no money value, and calls the game an on-chain economic game", () => {
    expect(ID["landing.footer.disclaimer"]).toContain("tanpa nilai uang");
    expect(ID["landing.footer.blurb"]!.toLowerCase()).toContain("permainan ekonomi on-chain");
    expect(ID["landing.faq.token.a"]).toContain("tanpa nilai uang");
    expect(ID["landing.hood.coin.line"]).toContain("tanpa nilai uang");
    expect(ID["landing.live.line"]).toContain("tanpa nilai uang");
    expect(EN["landing.footer.disclaimer"]).toContain("no monetary value");
    expect(EN["landing.footer.blurb"]).toContain("on-chain economic game");
  });

  it("only quotes the official burn and relief figures, in both languages", () => {
    for (const dict of [EN, ID]) {
      const numbers = Object.keys(dict)
        .filter((k) => k.startsWith("landing.chapters.") && k.endsWith(".line"))
        .flatMap((k) => dict[k]!.match(/\d+(?:\.\d+)?%/g) ?? []);
      expect(numbers.sort()).toEqual(["2%", "3.5%"]);
    }
  });
});

// ------------------------------------------------------------------ no hard-coded user-visible strings

/** Files whose user-visible text must come from the dictionaries. */
function convertedFiles(): string[] {
  const landing = fs
    .readdirSync(path.join(ROOT, "src/landing"))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => path.join("src/landing", f));
  // Phase B1: the game HUD files converted so far. Add a file here when it is converted.
  const hud = [
    "AccountChip", "AccountFilter", "AppetitePanel", "AtpPill", "BreachLog", "GameHud", "HudOverlay", "ModeSwitch",
    "NotificationsBell", "NutrientBurstBadge", "SignInPrompt", "SkinSwitch", "ThermalGauge", "ToolsToolbar", "VitalsPill",
    "WalletControl", "XpWidgets", "ZoneBanner",
  ].map((f) => `src/hud/${f}.tsx`);
  return [...landing, ...hud, "src/help/LanguageSettings.tsx", "src/i18n/LanguageToggle.tsx", "src/i18n/react.tsx"];
}

/** JSX attributes that carry text a reader sees or hears. */
const TEXT_ATTRS = new Set(["aria-label", "aria-valuetext", "aria-description", "aria-roledescription", "title", "alt", "placeholder", "label", "text", "accent", "k"]);

/** Names, standards, units and code-like labels that are the same in every language. */
const KEEP = /Snacc|\$SNACC|NEAR|NEP-[\d /]+|ATP|TEE|mK|µm|\bcm\b|\bmm\b|\bmk\b|\bms\b|GitHub|testnet|NFT|nft_tokens|\bfig\b|\bEN\b|\bID\b|&\w+;|0x/g;
/**
 * `faq.md`, `txs.testnet`: a file-like label; `crucible_temp`, `burst_bps`, `dormant`, `true`: field names and
 * values of the backend API, shown as they are.
 */
const FILE_LIKE = /^([a-z0-9-]+\.[a-z0-9]+|[a-z]+(_[a-z]+)+|dormant|true|false)$/;

function hardcodedStrings(file: string, source = fs.readFileSync(path.join(ROOT, file), "utf8")): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const report = (node: ts.Node, text: string) => {
    const cleaned = text.trim();
    if (!cleaned || FILE_LIKE.test(cleaned)) return;
    if (!/\p{L}/u.test(cleaned.replace(KEEP, ""))) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    found.push(`${file}:${line + 1} ${JSON.stringify(cleaned)}`);
  };

  /** String pieces an expression can show, following only the branches that are displayed. */
  const strings = (node: ts.Node | undefined, out: Array<[ts.Node, string]>) => {
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push([node, node.text]);
    else if (ts.isTemplateExpression(node)) {
      out.push([node, node.head.text]);
      for (const span of node.templateSpans) out.push([span, span.literal.text]);
    } else if (ts.isConditionalExpression(node)) {
      strings(node.whenTrue, out);
      strings(node.whenFalse, out);
    } else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) strings(node.expression, out);
    else if (ts.isBinaryExpression(node)) {
      const k = node.operatorToken.kind;
      if (k === ts.SyntaxKind.AmpersandAmpersandToken) strings(node.right, out);
      else if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) {
        strings(node.left, out);
        strings(node.right, out);
      }
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) report(node, node.text);
    else if (ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const out: Array<[ts.Node, string]> = [];
      strings(node.expression, out);
      for (const [n, text] of out) report(n, text);
    } else if (ts.isJsxAttribute(node) && TEXT_ATTRS.has(node.name.getText(sf)) && node.initializer) {
      const out: Array<[ts.Node, string]> = [];
      if (ts.isStringLiteral(node.initializer)) out.push([node.initializer, node.initializer.text]);
      else if (ts.isJsxExpression(node.initializer)) strings(node.initializer.expression, out);
      for (const [n, text] of out) report(n, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe("UI-161 no hard-coded user-visible strings", () => {
  it("covers the landing files and the picker", () => {
    const files = convertedFiles();
    for (const f of ["src/landing/Hero.tsx", "src/landing/SiteHeader.tsx", "src/landing/SiteFooter.tsx", "src/landing/demos.tsx", "src/landing/Finale.tsx", "src/help/LanguageSettings.tsx"]) {
      expect(files).toContain(f);
    }
  });

  it("every JSX text node and text attribute in them comes from t(), rich() or data", () => {
    expect(convertedFiles().flatMap((f) => hardcodedStrings(f))).toEqual([]);
  });

  it("the check itself catches a hard-coded string", () => {
    const bad = 'export const Bad = ({ ok }: { ok: boolean }) => <button aria-label="Close it">{ok ? "Yes please" : null}Hello there</button>;\n';
    expect(hardcodedStrings("Bad.tsx", bad)).toHaveLength(3);
    const good = 'export const Good = ({ t }: { t: (k: string) => string }) => <button aria-label={t("a")} title="Snacc">{t("b")} <span aria-hidden="true">↓</span> NEP-245</button>;\n';
    expect(hardcodedStrings("Good.tsx", good)).toEqual([]);
  });
});
