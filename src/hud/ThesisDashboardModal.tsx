/**
 * Thesis evidence: four numbers from the testnet rehearsal of 2026-11-09, each linked to its
 * transaction (or named view when there is no transaction). Live mode adds a fresh view read. The SQL
 * tab holds query templates that were not executed: Snacc runs on testnet only.
 */
import { useEffect, useId, useState } from "react";
import type { GameMode, SkinMode } from "../config/constants.ts";
import { QUERY_TEMPLATES, THESIS_METRICS, THESIS_SOURCE_LINE, fetchThesisLive, type ThesisLive } from "../data/thesis.ts";
import { REHEARSAL_DATE } from "../data/evidence.ts";
import { CONTRACT_ID, explorerTx, formatUnits } from "../data/nearView.ts";
import { Modal } from "../ui/Modal.tsx";
import { CopyButton, Empty, ExtLink, TabPanel, Tabs } from "../ui/controls.tsx";
import { Cap, Tag } from "../ui/fd.tsx";

export const EVIDENCE_PACK_URL = "https://github.com/Snacc-near/Snacc/blob/main/docs/evidence-pack.md";

export interface ThesisDashboardModalProps {
  onClose: () => void;
  mode: GameMode;
  skin?: SkinMode;
}

type ThesisTab = "evidence" | "queries";

export function ThesisDashboardModal({ onClose, mode, skin = "biolab" }: ThesisDashboardModalProps) {
  const idBase = useId();
  const [tab, setTab] = useState<ThesisTab>("evidence");
  const [live, setLive] = useState<ThesisLive | null | "loading">(mode === "live" ? "loading" : null);

  useEffect(() => {
    if (mode !== "live") return;
    const ac = new AbortController();
    void fetchThesisLive(ac.signal).then((r) => {
      if (!ac.signal.aborted) setLive(r);
    });
    return () => ac.abort();
  }, [mode]);

  return (
    <Modal
      title="thesis-evidence.log"
      heading={skin === "fintech" ? "Thesis evidence desk" : "Thesis evidence"}
      onClose={onClose}
      size="lg"
      testId="thesis-modal"
      footer={
        <>
          <span>{THESIS_SOURCE_LINE}</span>
          <ExtLink href={EVIDENCE_PACK_URL}>evidence pack</ExtLink>
        </>
      }
    >
      <div className="fd-stack">
        <Tabs
          label="thesis view"
          idBase={idBase}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "evidence", label: "rehearsal evidence", icon: "doc" },
            { id: "queries", label: "query templates", icon: "lines" },
          ]}
        />
        {tab === "evidence" ? (
          <TabPanel idBase={idBase} id="evidence">
            <div className="fd-row">
              <Cap icon="doc">Testnet rehearsal {REHEARSAL_DATE}</Cap>
              <Tag>{CONTRACT_ID}</Tag>
            </div>
            <ul className="fd-list" data-testid="thesis-metrics">
              {THESIS_METRICS.map((m) => (
                <li key={m.id} className="fd-stack thesis-metric">
                  <div className="fd-row fd-row--between">
                    <span className="fd-sub">{m.title}</span>
                    {m.tx ? (
                      <ExtLink href={explorerTx(m.tx)}>verified in rehearsal</ExtLink>
                    ) : (
                      <span className="fd-row">
                        <Tag>view {m.view}</Tag>
                        <ExtLink href={EVIDENCE_PACK_URL}>verified in rehearsal</ExtLink>
                      </span>
                    )}
                  </div>
                  <p className="thesis-metric__value">
                    <span className="fd-num">{m.value}</span> <span className="thesis-metric__unit">{m.unit}</span>
                  </p>
                  <p className="fd-field__hint">{m.detail}</p>
                  {m.caveat ? <p className="fd-field__hint thesis-metric__caveat">Caveat: {m.caveat}</p> : null}
                </li>
              ))}
            </ul>
            {mode === "live" ? (
              live === "loading" ? (
                <Empty icon="eye">reading get_macro_state and get_global_solvency…</Empty>
              ) : live === null ? (
                <Empty icon="warn">Could not reach the testnet RPC. Only the rehearsal record is shown.</Empty>
              ) : (
                <dl className="fd-kv" data-testid="thesis-live">
                  <div className="fd-kv__row">
                    <dt>burned now</dt>
                    <dd className="fd-kv__num">{live.totalBurned ? `${formatUnits(live.totalBurned, 24, 4)} $SNACC` : "—"}</dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>temp now</dt>
                    <dd className="fd-kv__num">{live.crucibleTempMk !== null ? `${live.crucibleTempMk} mK` : "—"}</dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>drift now</dt>
                    <dd className="fd-kv__num">
                      {live.drift ?? "—"} {live.solvent === null ? null : <Tag>{live.solvent ? "solvent" : "not solvent"}</Tag>}
                    </dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>read at</dt>
                    <dd>{new Date(live.readAtMs).toISOString().replace("T", " ").slice(0, 19)} UTC · view</dd>
                  </div>
                </dl>
              )
            ) : null}
          </TabPanel>
        ) : (
          <TabPanel idBase={idBase} id="queries">
            <p className="fd-note">
              <strong>Query templates — not executed (Snacc is testnet-only).</strong> They target <code>{CONTRACT_ID}</code> and divide
              by 1e24 ($SNACC has 24 decimals). The public SQL indexers we know of cover NEAR mainnet only, so none of these were run.
            </p>
            {QUERY_TEMPLATES.map((q) => (
              <section key={q.title} className="fd-stack" aria-label={q.title}>
                <div className="fd-row fd-row--between">
                  <span className="fd-sub">{q.title}</span>
                  <CopyButton label="copy SQL" text={q.sql} />
                </div>
                <pre className="fd-pre">{q.sql}</pre>
              </section>
            ))}
          </TabPanel>
        )}
      </div>
    </Modal>
  );
}

export default ThesisDashboardModal;
