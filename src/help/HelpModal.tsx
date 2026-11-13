/**
 * How to play (UI-151): rules, a glossary and a "what things cost" list in which every value names the
 * constant or function it comes from. "Replay intro" reopens the first-run steps.
 */
import { useId, useState } from "react";
import { Modal } from "../ui/Modal.tsx";
import { KeycapButton, TabPanel, Tabs } from "../ui/controls.tsx";
import { Cap, Tag } from "../ui/fd.tsx";
import { COSTS, GLOSSARY, RULES } from "./content.ts";
import "../ui/fd.css";
import "./guide.css";

export interface HelpModalProps {
  onClose: () => void;
  /** Closes Help and opens the intro again. */
  onReplay: () => void;
}

type HelpTab = "rules" | "glossary" | "costs";

export function HelpModal({ onClose, onReplay }: HelpModalProps) {
  const idBase = useId();
  const [tab, setTab] = useState<HelpTab>("rules");
  return (
    <Modal
      title="help.md"
      heading="How to play"
      size="lg"
      onClose={onClose}
      testId="help-modal"
      footer={
        <>
          <span>numbers come from code constants or the contract source, each with its source</span>
          <Tag>testnet</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <div className="fd-row fd-row--between">
          <Cap icon="doc">rules, glossary and costs</Cap>
          <KeycapButton mono icon="spark" onClick={onReplay} data-testid="help-replay">
            replay intro
          </KeycapButton>
        </div>
        <Tabs
          label="help sections"
          idBase={idBase}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "rules", label: "rules", icon: "doc" },
            { id: "glossary", label: "glossary", icon: "search" },
            { id: "costs", label: "what things cost", icon: "scale" },
          ]}
        />
        {tab === "rules" ? (
          <TabPanel idBase={idBase} id="rules">
            {RULES.map((r) => (
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
              {GLOSSARY.map((g) => (
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
              <strong>What things cost.</strong> Testnet figures. $SNACC on testnet has no monetary value, and none of this is a promise
              of any return.
            </p>
            <ul className="fd-list" data-testid="help-costs">
              {COSTS.map((c) => (
                <li key={c.id} className="guide-cost">
                  <span className="fd-sub">{c.item}</span>
                  <span className="guide-cost__value">{c.value}</span>
                  <p>{c.note}</p>
                  <p className="guide-source">
                    source: <code>{c.source}</code>
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
