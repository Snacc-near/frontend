/**
 * "Lineage" and "History" sections of the Strain Detail window (UI-155). Both read the backend's chain index
 * (`strain_lineage_snacc`, `strain_history_snacc`) through the public Supabase client, lazily, when the window opens.
 * The pure parts (`LineageView`, `HistoryView`) take their state as props so they render the same in tests; `StrainChain`
 * is the connected wrapper. Without the profile database, or while the index has nothing for this Snacc, a plain
 * "appears once the chain index has caught up" text is shown instead of anything invented.
 *
 * UI-161 phase B2: the section text comes from `actions.chain.*`. `INDEX_PENDING` and `NOT_CONFIGURED` keep the
 * English sentence as data (tests compare against it); the screen shows `actions.chain.indexPending` and
 * `actions.chain.notConfigured`. Phase B5: the relation words and the event lines read `account.chain.*` and the time
 * ago reads `collection.ago.*`; `RELATION_WORDS`, `describeHistory(row)` and `relativeTime` keep their English as data.
 */
import { useEffect, useState } from "react";
import { useAccount } from "../account/session.tsx";
import { buildLineage, describeHistory, historyOf, lineageIsEmpty, lineageOf, type HistoryRow, type Lineage } from "../account/chain.ts";
import { explorerTx } from "../data/nearView.ts";
import { agoText } from "../i18n/ago.ts";
import { useT } from "../i18n/react.tsx";
import { ExtLink } from "../ui/controls.tsx";
import { usePublicClient } from "./PlayerBoards.tsx";
import "../account/account.css";

export const HISTORY_LIMIT = 20;

export type ChainState<T> = { kind: "off" } | { kind: "loading" } | { kind: "error" } | { kind: "ok"; value: T };

export const INDEX_PENDING = "History appears once the chain index has caught up.";
export const NOT_CONFIGURED = "Lineage and history need the profile database, which is not configured in this build.";

/** A strain id that opens that Snacc's detail when a handler is given, plain text otherwise. */
export function StrainLink({ id, onOpen }: { id: number; onOpen?: (id: number) => void }) {
  const { t } = useT();
  if (!onOpen) return <span className="fd-num">#{id}</span>;
  return (
    <button type="button" className="fd-a chain-link" onClick={() => onOpen(id)} data-testid={`chain-link-${id}`} aria-label={t("actions.chain.openStrain", { id })}>
      #{id}
    </button>
  );
}

function IdList({ ids, onOpen }: { ids: readonly number[]; onOpen?: (id: number) => void }) {
  return (
    <span className="chain-ids">
      {ids.map((id) => (
        <StrainLink key={id} id={id} onOpen={onOpen} />
      ))}
    </span>
  );
}

export function LineageView({ state, generation, onOpen }: { state: ChainState<Lineage>; generation: number | null; onOpen?: (id: number) => void }) {
  const { t } = useT();
  return (
    <section className="fd-stack" style={{ gap: 6 }} aria-label={t("actions.chain.lineage")} data-testid="strain-lineage">
      <div className="fd-row fd-row--between">
        <span className="fd-sub">{t("actions.chain.lineage")}</span>
        <span className="fd-field__hint">{generation !== null ? t("actions.chain.generation", { n: generation }) : t("actions.chain.fromIndex")}</span>
      </div>
      {state.kind === "off" ? (
        <p className="fd-field__hint" data-testid="lineage-off">
          {t("actions.chain.notConfigured")}
        </p>
      ) : state.kind === "loading" ? (
        <p className="fd-field__hint" role="status">
          {t("actions.chain.reading")}
        </p>
      ) : state.kind === "error" ? (
        <p className="fd-field__hint fd-field__hint--bad" role="status" data-testid="lineage-error">
          {t("actions.chain.lineageError")}
        </p>
      ) : lineageIsEmpty(state.value) ? (
        <p className="fd-field__hint" data-testid="lineage-empty">
          {t("actions.chain.lineageEmpty", { pending: t("actions.chain.indexPending") })}
        </p>
      ) : (
        <dl className="fd-kv" data-testid="lineage-list">
          <div className="fd-kv__row">
            <dt>{t("actions.chain.parent")}</dt>
            <dd className="fd-kv__num">{state.value.parent !== null ? <StrainLink id={state.value.parent} onOpen={onOpen} /> : t("actions.chain.noneRecorded")}</dd>
          </div>
          <div className="fd-kv__row">
            <dt>{t("actions.chain.children")}</dt>
            <dd className="fd-kv__num">{state.value.children.length > 0 ? <IdList ids={state.value.children} onOpen={onOpen} /> : t("actions.chain.none")}</dd>
          </div>
          <div className="fd-kv__row">
            <dt>{t("actions.chain.siblings")}</dt>
            <dd className="fd-kv__num">{state.value.siblings.length > 0 ? <IdList ids={state.value.siblings} onOpen={onOpen} /> : t("actions.chain.none")}</dd>
          </div>
          {state.value.absorbed.length > 0 ? (
            <div className="fd-kv__row">
              <dt>{t("actions.chain.absorbed")}</dt>
              <dd className="fd-kv__num">
                <span className="chain-ids">
                  {state.value.absorbed.map((a) => (
                    <span key={`${a.id}-${a.relation}`}>
                      <StrainLink id={a.id} onOpen={onOpen} /> <span className="fd-field__hint">({t(`account.chain.${a.relation}`)})</span>
                    </span>
                  ))}
                </span>
              </dd>
            </div>
          ) : null}
          {state.value.mergedInto ? (
            <div className="fd-kv__row">
              <dt>{t("actions.chain.absorbedInto")}</dt>
              <dd className="fd-kv__num">
                <StrainLink id={state.value.mergedInto.id} onOpen={onOpen} /> <span className="fd-field__hint">({t(`account.chain.${state.value.mergedInto.relation}`)})</span>
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}

export function HistoryView({ state, nowMs }: { state: ChainState<HistoryRow[]>; nowMs: number }) {
  const { t } = useT();
  return (
    <section className="fd-stack" style={{ gap: 6 }} aria-label={t("actions.chain.history")} data-testid="strain-history">
      <div className="fd-row fd-row--between">
        <span className="fd-sub">{t("actions.chain.history")}</span>
        <span className="fd-field__hint">{t("actions.chain.latest", { n: HISTORY_LIMIT })}</span>
      </div>
      {state.kind === "off" ? (
        <p className="fd-field__hint" data-testid="history-off">
          {t("actions.chain.notConfigured")}
        </p>
      ) : state.kind === "loading" ? (
        <p className="fd-field__hint" role="status">
          {t("actions.chain.reading")}
        </p>
      ) : state.kind === "error" ? (
        <p className="fd-field__hint fd-field__hint--bad" role="status" data-testid="history-error">
          {t("actions.chain.historyError")}
        </p>
      ) : state.value.length === 0 ? (
        <p className="fd-field__hint" data-testid="history-empty">
          {t("actions.chain.indexPending")}
        </p>
      ) : (
        <ol className="fd-list chain-history" aria-label={t("actions.chain.latestEvents")} data-testid="history-list">
          {state.value.map((row, i) => (
            <li key={`${row.tx_hash}-${row.event}-${row.role ?? ""}-${i}`} className="chain-event">
              <span className="chain-event__text">{describeHistory(row, t)}</span>
              <span className="chain-event__meta">
                <time dateTime={row.block_time} title={row.block_time}>
                  {agoText(t, row.block_time, nowMs)}
                </time>
                <ExtLink href={explorerTx(row.tx_hash)}>{t("actions.chain.tx")}</ExtLink>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Loads both sections for one strain; they reload when the strain changes. */
export function StrainChain({ strainId, generation, onOpenStrain }: { strainId: number; generation: number | null; onOpenStrain?: (id: number) => void }) {
  const account = useAccount();
  const client = usePublicClient(true);
  const [lineage, setLineage] = useState<ChainState<Lineage>>({ kind: account.enabled ? "loading" : "off" });
  const [history, setHistory] = useState<ChainState<HistoryRow[]>>({ kind: account.enabled ? "loading" : "off" });

  useEffect(() => {
    if (!account.enabled) {
      setLineage({ kind: "off" });
      setHistory({ kind: "off" });
      return;
    }
    setLineage({ kind: "loading" });
    setHistory({ kind: "loading" });
    if (!client) return;
    let alive = true;
    void lineageOf(client, strainId)
      .then(({ rows, siblingRows }) => alive && setLineage({ kind: "ok", value: buildLineage(strainId, rows, siblingRows) }))
      .catch(() => alive && setLineage({ kind: "error" }));
    void historyOf(client, strainId, HISTORY_LIMIT)
      .then((rows) => alive && setHistory({ kind: "ok", value: rows }))
      .catch(() => alive && setHistory({ kind: "error" }));
    return () => {
      alive = false;
    };
  }, [account.enabled, client, strainId]);

  const born = lineage.kind === "ok" ? lineage.value.generation : null;
  return (
    <>
      <LineageView state={lineage} generation={generation ?? born} onOpen={onOpenStrain} />
      <HistoryView state={history} nowMs={Date.now()} />
    </>
  );
}
