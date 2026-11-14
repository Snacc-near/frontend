/**
 * The NPC's reasoning line for a quote. Live mode shows the contract's `reasoning_tooltip`
 * verbatim; demo mode shows the same text produced by a local copy of the contract rule.
 *
 * UI-161 phase B3: labels come from the `npc.why` dictionary; the quote text itself is the contract's.
 */
import { useId, useState } from "react";
import type { NpcQuote } from "../data/npc.ts";
import { useT } from "../i18n/react.tsx";
import { Sim, Tag } from "../ui/fd.tsx";

export interface NpcReasoningTooltipProps {
  quote: NpcQuote;
  npcName: string;
  source: "contract" | "simulation";
  stockBefore: number;
}

export function NpcReasoningTooltip({ quote, npcName, source, stockBefore }: NpcReasoningTooltipProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const detailId = useId();
  return (
    <section className="fd-win npc-why" aria-label={t("npc.why.label", { name: npcName })}>
      <div className="fd-win__bar">
        <span className="fd-win__btn" aria-hidden="true" />
        <span className="fd-win__rule" aria-hidden="true" />
        <span className="fd-win__title">{t("npc.why.title")}</span>
        <span className="fd-win__rule" aria-hidden="true" />
        <span className="fd-win__btn" aria-hidden="true" />
      </div>
      <div className="fd-win__body fd-stack">
        <div className="fd-row fd-row--between">
          {source === "contract" ? <Tag>{t("npc.why.tagContract")}</Tag> : <Sim />}
          <button type="button" className="fd-key fd-key--mono" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((v) => !v)}>
            {open ? t("npc.why.hide") : t("npc.why.show")}
          </button>
        </div>
        <blockquote className="npc-why__quote">&ldquo;{quote.reasoning_tooltip}&rdquo;</blockquote>
        {open ? (
          <dl id={detailId} className="fd-kv">
            <div className="fd-kv__row">
              <dt>{t("npc.why.rule")}</dt>
              <dd>{t("npc.why.formula")}</dd>
            </div>
            <div className="fd-kv__row">
              <dt>{t("npc.why.stock")}</dt>
              <dd className="fd-kv__num">
                {stockBefore} → {quote.npc_spores_stock_after}
              </dd>
            </div>
            <div className="fd-kv__row">
              <dt>{t("npc.why.unitTotal")}</dt>
              <dd className="fd-kv__num">
                {String(quote.unit_price_vita)} / {String(quote.total_cost_snacc)}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
