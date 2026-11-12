/**
 * RES-121: Recipe Search Modal with Qwen Embedding & Rerank.
 * Natural language semantic recipe discovery in the Bio-Lab console.
 */

import React, { useEffect, useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import { searchRecipes, type RecipeSearchResult } from "../recipes/qwenSearch.ts";

interface RecipeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  skin?: SkinMode;
  zone?: string;
}

const PRESET_QUERIES = [
  "protect against fever burn",
  "slow down bmr decay",
  "industrial dividend pool",
  "homunculus full heal",
  "mitochondria power plant",
  "tee private mutation",
];

export const RecipeSearchModal: React.FC<RecipeSearchModalProps> = ({
  isOpen,
  onClose,
  skin = "biolab",
  zone = "Goldilocks",
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    searchRecipes(query).then((res) => {
      if (!cancelled) setResults(res);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!isOpen) return null;

  const handleCopyMethod = (id: string, method: string) => {
    navigator.clipboard?.writeText(method);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      role="dialog"
      aria-label="recipe search engine"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        className="plate-panel relative flex h-[85vh] max-h-[720px] w-full max-w-2xl flex-col gap-3 rounded-2xl border border-[var(--edge)] bg-[var(--panel)] p-5 text-[var(--ink-hi)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3">
          <div className="flex items-center gap-2">
            <span className="lp-label font-mono text-[10px] tracking-wider uppercase text-[var(--accent-dk)]">
              {skin === "biolab" ? "Alchemical Codex" : "Financial Engineering Matrix"}
            </span>
            <span className="text-xs font-semibold text-[var(--ink)]">· RES-121 Qwen Rerank</span>
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-mono text-[9px] font-bold text-[var(--accent-ink)]">
              Zone: {zone}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close modal"
            className="keycap min-h-[30px] min-w-[30px] px-2 text-xs"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col gap-2">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={
                skin === "biolab"
                  ? "Search recipes with natural language (e.g. 'how to survive fever', 'restore vitality')..."
                  : "Search clearing formulas & capital allocation rules..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-[var(--edge)] bg-[var(--bg)] px-4 py-2.5 pr-9 font-mono text-xs text-[var(--ink-hi)] placeholder-[var(--ink)]/50 focus:border-[var(--accent-dk)] focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 text-xs text-[var(--ink)] hover:text-[var(--ink-hi)]"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Quick preset chips */}
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
            {PRESET_QUERIES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setQuery(preset)}
                className={`keycap rounded-full px-2.5 py-1 text-[10px] font-medium ${
                  query === preset ? "border-[var(--accent-dk)] bg-[var(--accent)] text-[var(--accent-ink)]" : ""
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
          {results.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-xs text-[var(--ink)]">
              No matching recipes found for "{query}". Try one of the preset prompts above.
            </div>
          ) : (
            results.map(({ recipe, matchPercentage }) => {
              const title = skin === "biolab" ? recipe.name : recipe.fintechName;
              const desc = skin === "biolab" ? recipe.description : recipe.fintechDescription;
              return (
                <div
                  key={recipe.id}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--edge)] bg-[var(--bg)] p-3 text-xs transition-colors hover:border-[var(--accent-dk)]/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--ink-hi)]">{title}</span>
                      <span className="rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--ink)]">
                        {recipe.stage === "organelle" ? "Organelle" : recipe.stage === "macro" ? "Macro" : `Stage ${recipe.stage}`}
                      </span>
                      <span className="rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--accent-dk)]">
                        Role: {recipe.role}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {matchPercentage}% match
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--ink)]">{desc}</p>

                  {/* Inputs & Outputs */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--edge)]/60 bg-[var(--panel)]/50 p-2 text-[10px] font-mono">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase text-[var(--ink)]">Inputs / Cost:</span>
                      {recipe.inputs.map((inp, idx) => (
                        <span key={idx} className="text-[var(--ink-hi)]">
                          • {inp.amount} {skin === "biolab" ? inp.name : inp.fintechName}
                        </span>
                      ))}
                      {recipe.atpCost > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">• {recipe.atpCost} ATP</span>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase text-[var(--ink)]">Outputs / Benefit:</span>
                      {recipe.outputs.map((out, idx) => (
                        <span key={idx} className="text-emerald-600 dark:text-emerald-400">
                          • {out.amount} {skin === "biolab" ? out.name : out.fintechName}
                        </span>
                      ))}
                      <span className="text-[9px] text-[var(--ink)] truncate">{recipe.synergyEffect}</span>
                    </div>
                  </div>

                  {/* Contract Method Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <code className="font-mono text-[10px] text-[var(--ink)] truncate max-w-sm">
                      {recipe.contractMethod}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyMethod(recipe.id, recipe.contractMethod)}
                      className="keycap min-h-[26px] px-2 text-[10px] font-mono"
                    >
                      {copiedId === recipe.id ? "Copied ✓" : "Copy Call"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--edge)] pt-2 font-mono text-[9px] text-[var(--ink)]">
          <span>Qwen semantic concept embedding + lexical hybrid reranking</span>
          <span>Kamus Angka Resmi §13a compliant</span>
        </div>
      </div>
    </div>
  );
};
