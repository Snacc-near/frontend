/**
 * Local recipe search (keyword) over the recipes the contract implements. No model, no network call.
 * Each result shows the contract method and a JSON call template the player can copy.
 */
import { useId, useMemo, useState } from "react";
import type { SkinMode } from "../config/constants.ts";
import type { MacroZone } from "../config/zones.ts";
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
  const id = useId();
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchRecipes(query), [query]);

  return (
    <Modal
      title="recipe-search.idx"
      heading="Local recipe search (keyword)"
      onClose={onClose}
      size="lg"
      testId="recipe-modal"
      footer={
        <>
          <span>keyword match in this browser · recipes and calls from the snacc-v001 contract</span>
          <Tag>no network</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <Field id={`${id}-q`} label="search recipes" hint={zone === "Fever" ? "The crucible is in Fever: try “homeostasis”, which halves the Fever burn." : "Matches whole words and word starts in names, inputs, outputs and methods."}>
          <Input
            id={`${id}-q`}
            type="search"
            data-autofocus=""
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. fever, aether, organelle"
            autoComplete="off"
            aria-describedby={`${id}-q-hint`}
          />
        </Field>
        <div className="fd-row" aria-label="suggested searches">
          {SUGGESTIONS.map((s) => (
            <KeycapButton key={s} mono aria-pressed={query === s} onClick={() => setQuery(s)}>
              {s}
            </KeycapButton>
          ))}
        </div>
        <p className="fd-sub" role="status" aria-live="polite">
          {query.trim() ? `${results.length} match${results.length === 1 ? "" : "es"}` : `${results.length} recipes`}
        </p>
        {results.length === 0 ? (
          <Empty icon="search">No recipe matches “{query}”.</Empty>
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
                      {query.trim() ? <span className="fd-field__hint">{matchPercentage}% of words</span> : null}
                    </span>
                  </div>
                  <dl className="fd-kv">
                    <div className="fd-kv__row">
                      <dt>in</dt>
                      <dd>{recipe.inputs.join(" · ")}</dd>
                    </div>
                    <div className="fd-kv__row">
                      <dt>out</dt>
                      <dd>{recipe.outputs.join(" · ")}</dd>
                    </div>
                    <div className="fd-kv__row">
                      <dt>effect</dt>
                      <dd>{recipe.effect}</dd>
                    </div>
                    {recipe.method ? (
                      <div className="fd-kv__row">
                        <dt>method</dt>
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
                      <CopyButton label="copy call template" text={call} />
                      <span className="fd-field__hint">fill the &lt;…&gt; values; this app does not send it</span>
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
