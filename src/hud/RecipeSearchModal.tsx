/**
 * Local recipe search (keyword) over the recipes the contract implements. No model, no network call.
 * Each result shows the contract method and a JSON call template the player can copy.
 *
 * UI-161 phase B3: text comes from the `npc.recipe` dictionary. The recipe names, inputs, outputs and effects
 * and the suggested search words are English data from `recipes/recipeSearch.ts` (the search matches them).
 */
import { useId, useMemo, useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import type { MacroZone } from "../config/zones.ts";
import { useT } from "../i18n/react.tsx";
import { CONTRACT_SIGNATURES, callTemplate, searchRecipes } from "../recipes/recipeSearch.ts";
import { Modal } from "../ui/Modal.tsx";
import { CopyButton, Empty, Field, Input, KeycapButton } from "../ui/controls.tsx";
import { Tag } from "../ui/fd.tsx";

export interface RecipeSearchModalProps {
  onClose: () => void;
  skin?: SkinMode;
  zone?: MacroZone;
}

const SUGGESTIONS = ["fever", "aether", "enzyme", "organelle", "npc"];

export function RecipeSearchModal({ onClose, skin = "biolab", zone }: RecipeSearchModalProps) {
  const { t } = useT();
  const id = useId();
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchRecipes(query), [query]);

  return (
    <Modal
      title={t("npc.recipe.title")}
      heading={t("npc.recipe.heading")}
      onClose={onClose}
      size="lg"
      testId="recipe-modal"
      footer={
        <>
          <span>{t("npc.recipe.footer")}</span>
          <Tag>{t("npc.recipe.tagNoNetwork")}</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <Field id={`${id}-q`} label={t("npc.recipe.field")} hint={zone === "Fever" ? t("npc.recipe.hintFever") : t("npc.recipe.hint")}>
          <Input
            id={`${id}-q`}
            type="search"
            data-autofocus=""
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("npc.recipe.placeholder")}
            autoComplete="off"
            aria-describedby={`${id}-q-hint`}
          />
        </Field>
        <div className="fd-row" aria-label={t("npc.recipe.suggestedLabel")}>
          {SUGGESTIONS.map((s) => (
            <KeycapButton key={s} mono aria-pressed={query === s} onClick={() => setQuery(s)}>
              {s}
            </KeycapButton>
          ))}
        </div>
        <p className="fd-sub" role="status" aria-live="polite">
          {query.trim() ? t(results.length === 1 ? "npc.recipe.matchOne" : "npc.recipe.matchMany", { n: results.length }) : t("npc.recipe.total", { n: results.length })}
        </p>
        {results.length === 0 ? (
          <Empty icon="search">{t("npc.recipe.none", { query })}</Empty>
        ) : (
          <ul className="fd-list" data-testid="recipe-results">
            {results.map(({ recipe, matchPercentage }) => {
              const call = callTemplate(recipe);
              const params = recipe.method ? CONTRACT_SIGNATURES[recipe.method] : [];
              return (
                <li key={recipe.id} className="fd-stack recipe-row">
                  <div className="fd-row fd-row--between">
                    <span className="fd-h">{skin === "fintech" ? recipe.fintechName : recipe.name}</span>
                    <span className="fd-row">
                      <Tag>{recipe.stage}</Tag>
                      {recipe.role !== "any" ? <Tag>{recipe.role}</Tag> : null}
                      {query.trim() ? <span className="fd-field__hint">{t("npc.recipe.wordsPct", { pct: matchPercentage })}</span> : null}
                    </span>
                  </div>
                  <dl className="fd-kv">
                    <div className="fd-kv__row">
                      <dt>{t("npc.recipe.in")}</dt>
                      <dd>{recipe.inputs.join(" · ")}</dd>
                    </div>
                    <div className="fd-kv__row">
                      <dt>{t("npc.recipe.out")}</dt>
                      <dd>{recipe.outputs.join(" · ")}</dd>
                    </div>
                    <div className="fd-kv__row">
                      <dt>{t("npc.recipe.effect")}</dt>
                      <dd>{recipe.effect}</dd>
                    </div>
                    {recipe.method ? (
                      <div className="fd-kv__row">
                        <dt>{t("npc.recipe.method")}</dt>
                        <dd>
                          <code>
                            {recipe.method}({params.join(", ")})
                          </code>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {call ? (
                    <div className="fd-row">
                      <CopyButton label={t("npc.recipe.copy")} text={call} />
                      <span className="fd-field__hint">{t("npc.recipe.fill")}</span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default RecipeSearchModal;
