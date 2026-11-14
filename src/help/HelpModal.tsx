/**
 * How to play (UI-151): rules, a glossary and a "what things cost" list in which every value names the
 * constant or function it comes from. "Replay intro" reopens the first-run steps.
 *
 * UI-161 phase B4: the words come from the `help` dictionary (English or Indonesian); the figures are
 * computed in `content.ts`. The `source:` line of a cost row (file and constant names) is code.
 */
import { useId, useMemo, useState } from "react";
import { useT } from "../i18n/react.tsx";
import { Modal } from "../ui/Modal.tsx";
import { KeycapButton, TabPanel, Tabs } from "../ui/controls.tsx";
import { Cap, Tag } from "../ui/fd.tsx";
import { costs, glossary, rules } from "./content.ts";
import "../ui/fd.css";
import "./guide.css";

export interface HelpModalProps {
  onClose: () => void;
  /** Closes Help and opens the intro again. */
  onReplay: () => void;
}

type HelpTab = "rules" | "glossary" | "costs";

export function HelpModal({ onClose, onReplay }: HelpModalProps) {
  const { t, locale } = useT();
  const idBase = useId();
  const [tab, setTab] = useState<HelpTab>("rules");
  const ruleList = useMemo(() => rules(locale), [locale]);
  const glossaryList = useMemo(() => glossary(locale), [locale]);
  const costList = useMemo(() => costs(locale), [locale]);
  return (
    <Modal
      title="help.md"
      heading={t("help.modal.heading")}
      size="lg"
      onClose={onClose}
      testId="help-modal"
      footer={
        <>
          <span>{t("help.modal.footer")}</span>
          <Tag>testnet</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <div className="fd-row fd-row--between">
          <Cap icon="doc">{t("help.modal.cap")}</Cap>
          <KeycapButton mono icon="spark" onClick={onReplay} data-testid="help-replay">
            {t("help.modal.replay")}
          </KeycapButton>
        </div>
        <Tabs
          label={t("help.modal.tabsLabel")}
          idBase={idBase}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "rules", label: t("help.modal.tabRules"), icon: "doc" },
            { id: "glossary", label: t("help.modal.tabGlossary"), icon: "search" },
            { id: "costs", label: t("help.modal.tabCosts"), icon: "scale" },
          ]}
        />
        {tab === "rules" ? (
          <TabPanel idBase={idBase} id="rules">
            {ruleList.map((r) => (
              <section key={r.id} className="guide-rule" aria-labelledby={`${idBase}-rule-${r.id}`}>
                <h4 id={`${idBase}-rule-${r.id}`} className="fd-h">
                  {r.title}
                </h4>
                <p className="guide-lead">{r.body}</p>
              </section>
            ))}
          </TabPanel>
        ) : null}
        {tab === "glossary" ? (
          <TabPanel idBase={idBase} id="glossary">
            <dl className="guide-gloss" data-testid="help-glossary">
              {glossaryList.map((g) => (
                <div key={g.id}>
                  <dt>{g.term}</dt>
                  <dd>{g.body}</dd>
                </div>
              ))}
            </dl>
          </TabPanel>
        ) : null}
        {tab === "costs" ? (
          <TabPanel idBase={idBase} id="costs">
            <p className="fd-note">
              <strong>{t("help.costs.lead")}</strong> {t("help.costs.note")}
            </p>
            <ul className="fd-list" data-testid="help-costs">
              {costList.map((c) => (
                <li key={c.id} className="guide-cost">
                  <span className="fd-sub">{c.item}</span>
                  <span className="guide-cost__value">{c.value}</span>
                  <p>{c.note}</p>
                  <p className="guide-source">
                    {t("help.costs.source")} <code>{c.source}</code>
                  </p>
                </li>
              ))}
            </ul>
          </TabPanel>
        ) : null}
      </div>
    </Modal>
  );
}

export default HelpModal;
