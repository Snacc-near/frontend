/**
 * Thesis evidence: four numbers from the testnet rehearsal of 2026-11-09, each linked to its
 * transaction (or named view when there is no transaction). Live mode adds a fresh view read. The SQL
 * tab holds query templates that were not executed: Snacc runs on testnet only.
 *
 * UI-161 phase B3: text comes from the `npc.thesis` dictionary. The metric titles and details and the
 * SQL templates are English data from `data/thesis.ts`.
 */
import { useEffect, useId, useState } from "react";
import type { GameMode, SkinMode } from "../config/constants.ts";
import { QUERY_TEMPLATES, THESIS_METRICS, THESIS_SOURCE_LINE, fetchThesisLive, type ThesisLive } from "../data/thesis.ts";
import { REHEARSAL_DATE } from "../data/evidence.ts";
import { CONTRACT_ID, explorerTx, formatUnits } from "../data/nearView.ts";
import { useT } from "../i18n/react.tsx";
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
  const { t, rich } = useT();
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
      title={t("npc.thesis.title")}
      heading={skin === "fintech" ? t("npc.thesis.headingFintech") : t("npc.thesis.headingBiolab")}
      onClose={onClose}
      size="lg"
      testId="thesis-modal"
      footer={
        <>
          <span>{THESIS_SOURCE_LINE}</span>
          <ExtLink href={EVIDENCE_PACK_URL}>{t("npc.thesis.evidencePack")}</ExtLink>
        </>
      }
    >
      <div className="fd-stack">
        <Tabs
          label={t("npc.thesis.tabsLabel")}
          idBase={idBase}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "evidence", label: t("npc.thesis.tabEvidence"), icon: "doc" },
            { id: "queries", label: t("npc.thesis.tabQueries"), icon: "lines" },
          ]}
        />
        {tab === "evidence" ? (
          <TabPanel idBase={idBase} id="evidence">
            <div className="fd-row">
              <Cap icon="doc">{t("npc.thesis.rehearsal", { date: REHEARSAL_DATE })}</Cap>
              <Tag>{CONTRACT_ID}</Tag>
            </div>
            <ul className="fd-list" data-testid="thesis-metrics">
              {THESIS_METRICS.map((m) => (
                <li key={m.id} className="fd-stack thesis-metric">
                  <div className="fd-row fd-row--between">
                    <span className="fd-sub">{m.title}</span>
                    {m.tx ? (
                      <ExtLink href={explorerTx(m.tx)}>{t("npc.thesis.verified")}</ExtLink>
                    ) : (
                      <span className="fd-row">
                        <Tag>{t("npc.thesis.viewTag", { view: m.view ?? "" })}</Tag>
                        <ExtLink href={EVIDENCE_PACK_URL}>{t("npc.thesis.verified")}</ExtLink>
                      </span>
                    )}
                  </div>
                  <p className="thesis-metric__value">
                    <span className="fd-num">{m.value}</span> <span className="thesis-metric__unit">{m.unit}</span>
                  </p>
                  <p className="fd-field__hint">{m.detail}</p>
                  {m.caveat ? <p className="fd-field__hint thesis-metric__caveat">{t("npc.thesis.caveat", { text: m.caveat })}</p> : null}
                </li>
              ))}
            </ul>
            {mode === "live" ? (
              live === "loading" ? (
                <Empty icon="eye">{t("npc.thesis.readingLive")}</Empty>
              ) : live === null ? (
                <Empty icon="warn">{t("npc.thesis.noRpc")}</Empty>
              ) : (
                <dl className="fd-kv" data-testid="thesis-live">
                  <div className="fd-kv__row">
                    <dt>{t("npc.thesis.burned")}</dt>
                    <dd className="fd-kv__num">{live.totalBurned ? t("npc.thesis.burnedValue", { n: formatUnits(live.totalBurned, 24, 4) }) : "—"}</dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>{t("npc.thesis.temp")}</dt>
                    <dd className="fd-kv__num">{live.crucibleTempMk !== null ? `${live.crucibleTempMk} mK` : "—"}</dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>{t("npc.thesis.drift")}</dt>
                    <dd className="fd-kv__num">
                      {live.drift ?? "—"} {live.solvent === null ? null : <Tag>{live.solvent ? t("npc.thesis.solvent") : t("npc.thesis.notSolvent")}</Tag>}
                    </dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>{t("npc.thesis.readAt")}</dt>
                    <dd>{t("npc.thesis.readAtValue", { time: new Date(live.readAtMs).toISOString().replace("T", " ").slice(0, 19) })}</dd>
                  </div>
                </dl>
              )
            ) : null}
          </TabPanel>
        ) : (
          <TabPanel idBase={idBase} id="queries">
            <p className="fd-note">
              <strong>{t("npc.thesis.queriesTitle")}</strong>
              {rich("npc.thesis.queriesBody", { contract: <code>{CONTRACT_ID}</code> })}
            </p>
            {QUERY_TEMPLATES.map((q) => (
              <section key={q.title} className="fd-stack" aria-label={q.title}>
                <div className="fd-row fd-row--between">
                  <span className="fd-sub">{q.title}</span>
                  <CopyButton label={t("npc.thesis.copySql")} text={q.sql} />
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
