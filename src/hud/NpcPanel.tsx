/**
 * NPC spore merchants (ADR-30). Live mode reads the contract views `get_npc` and
 * `npc_quote_spores` on `snacc-v001.testnet` and shows their values only; buying needs the signed
 * change call `npc_buy_spores`, which this wallet-less app cannot make. Demo mode runs the same
 * quote rule on local genesis state and labels every number as a simulation.
 *
 * UI-161 phase B3: text comes from the `npc` dictionary. Merchant names and roles (`NPC_SKIN`) and the
 * contract's reasoning line stay as the data gives them.
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { SkinMode } from "../config/constants.ts";
import {
  NPC_IDS,
  NPC_SKIN,
  createGenesisNpcs,
  fetchAllNpcs,
  fetchNpcQuote,
  npcName,
  simulateNpcQuote,
  type NpcAgent,
  type NpcId,
  type NpcQuote,
} from "../data/npc.ts";
import { CONTRACT_ID } from "../data/nearView.ts";
import { useT } from "../i18n/react.tsx";
import { NpcReasoningTooltip } from "./NpcReasoningTooltip.tsx";
import { Modal } from "../ui/Modal.tsx";
import { CopyButton, Empty, Field, Input, KeycapButton, TabPanel, Tabs } from "../ui/controls.tsx";
import { Sim, Tag } from "../ui/fd.tsx";

export interface NpcPanelProps {
  onClose: () => void;
  skin: SkinMode;
  /** Demo temperature (live mode uses the contract's own reading in the quote). */
  crucibleTempMk: number | null;
  mode: "demo" | "live";
  userSnaccBalance: number;
  onBuySpores?: (npcId: NpcId, amount: number, totalCost: number) => void;
}

const QUICK_AMOUNTS = [1, 10, 50];
/** The contract call the live note names; code, the same in every language. */
const BUY_SIGNATURE = "npc_buy_spores(strain_id, npc_id, buy_amount)";

export function NpcPanel({ onClose, skin, crucibleTempMk, mode, userSnaccBalance, onBuySpores }: NpcPanelProps) {
  const { t, rich } = useT();
  const idBase = useId();
  const live = mode === "live";
  const [selected, setSelected] = useState<NpcId>("npc-extractor");
  const [amount, setAmount] = useState(10);
  const [demoNpcs, setDemoNpcs] = useState<Record<NpcId, NpcAgent>>(createGenesisNpcs);
  const [liveNpcs, setLiveNpcs] = useState<Partial<Record<NpcId, NpcAgent>> | null>(null);
  const [liveQuote, setLiveQuote] = useState<NpcQuote | null | "loading">("loading");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    const ac = new AbortController();
    void fetchAllNpcs(ac.signal).then((rows) => {
      if (!ac.signal.aborted) setLiveNpcs(rows);
    });
    return () => ac.abort();
  }, [live]);

  useEffect(() => {
    if (!live) return;
    setLiveQuote("loading");
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchNpcQuote(selected, amount, ac.signal).then((q) => {
        if (!ac.signal.aborted) setLiveQuote(q);
      });
    }, 300);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [live, selected, amount]);

  const npc: NpcAgent | undefined = live ? liveNpcs?.[selected] : demoNpcs[selected];
  const demoQuote = useMemo(
    () => (live ? null : simulateNpcQuote(demoNpcs[selected], amount, crucibleTempMk ?? 605)),
    [live, demoNpcs, selected, amount, crucibleTempMk],
  );
  const quote: NpcQuote | null = live ? (liveQuote === "loading" ? null : liveQuote) : demoQuote;
  const name = npcName(selected, skin);
  const callTemplate = `npc_buy_spores(${JSON.stringify({ strain_id: "<your strain id>", npc_id: selected, buy_amount: amount })})`;
  // Every demo number carries its own SIMULATION chip.
  const V = ({ children }: { children: ReactNode }) => (
    <dd className="fd-kv__num">
      {children} {live ? null : <Sim />}
    </dd>
  );

  const buyDemo = () => {
    if (!demoQuote) return;
    const cost = Number(demoQuote.total_cost_snacc);
    if (amount > demoNpcs[selected].spores_stock) {
      setFeedback(t("npc.holdsOnly", { name, n: demoNpcs[selected].spores_stock }));
      return;
    }
    if (cost > userSnaccBalance) {
      setFeedback(t("npc.notEnough", { cost, have: userSnaccBalance }));
      return;
    }
    setDemoNpcs((prev) => ({
      ...prev,
      [selected]: {
        ...prev[selected],
        spores_stock: demoQuote.npc_spores_stock_after,
        snacc_reserve: Number(prev[selected].snacc_reserve) + cost,
        trades_executed: prev[selected].trades_executed + 1,
      },
    }));
    onBuySpores?.(selected, amount, cost);
    setFeedback(t("npc.bought", { n: amount, name, cost }));
  };

  return (
    <Modal
      title={skin === "fintech" ? t("npc.titleFintech") : t("npc.titleBiolab")}
      heading={skin === "fintech" ? t("npc.headingFintech") : t("npc.headingBiolab")}
      onClose={onClose}
      size="lg"
      testId="npc-modal"
      footer={
        live ? (
          <>
            <span>{t("npc.footerLive", { contract: CONTRACT_ID })}</span>
            <Tag>{t("hud.resources.live")}</Tag>
          </>
        ) : (
          <>
            <span>{t("npc.footerDemo")}</span>
            <Sim />
          </>
        )
      }
    >
      <div className="fd-stack">
        <Tabs
          label={t("npc.tabsLabel")}
          idBase={idBase}
          value={selected}
          onChange={(id) => {
            setSelected(id);
            setFeedback(null);
          }}
          tabs={NPC_IDS.map((id) => ({ id, label: NPC_SKIN[id][skin].name }))}
        />
        <TabPanel idBase={idBase} id={selected}>
          <p className="fd-sub">{rich("npc.sells", { role: NPC_SKIN[selected][skin].role, npc: <code>{selected}</code> })}</p>
          {live && liveNpcs === null ? (
            <Empty icon="eye">{t("npc.readingNpc", { contract: CONTRACT_ID })}</Empty>
          ) : !npc ? (
            <Empty icon="warn">{t("npc.noNpc", { id: selected, contract: CONTRACT_ID })}</Empty>
          ) : (
            <dl className="fd-kv" data-testid="npc-state">
              <div className="fd-kv__row">
                <dt>role_archetype</dt>
                <V>{npc.role_archetype}</V>
              </div>
              <div className="fd-kv__row">
                <dt>spores_stock</dt>
                <V>{t("npc.stockTarget", { stock: npc.spores_stock, target: npc.target_spores_stock })}</V>
              </div>
              <div className="fd-kv__row">
                <dt>base_spore_price</dt>
                <V>{String(npc.base_spore_price)}</V>
              </div>
              <div className="fd-kv__row">
                <dt>snacc_reserve</dt>
                <V>{String(npc.snacc_reserve)}</V>
              </div>
              <div className="fd-kv__row">
                <dt>trades_executed</dt>
                <V>{npc.trades_executed}</V>
              </div>
            </dl>
          )}

          <Field id={`${idBase}-amount`} label={t("npc.amountLabel")}>
            <div className="fd-row">
              <Input
                id={`${idBase}-amount`}
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                style={{ maxWidth: 120 }}
              />
              {QUICK_AMOUNTS.map((n) => (
                <KeycapButton key={n} mono aria-pressed={amount === n} onClick={() => setAmount(n)}>
                  {n}
                </KeycapButton>
              ))}
            </div>
          </Field>

          {live && liveQuote === "loading" ? (
            <Empty icon="eye">{t("npc.readingQuote")}</Empty>
          ) : !quote ? (
            <Empty icon="warn">{t("npc.noQuote")}</Empty>
          ) : (
            <>
              <dl className="fd-kv" data-testid="npc-quote">
                <div className="fd-kv__row">
                  <dt>unit_price_vita</dt>
                  <V>{String(quote.unit_price_vita)}</V>
                </div>
                <div className="fd-kv__row">
                  <dt>total_cost_snacc</dt>
                  <V>
                    {String(quote.total_cost_snacc)} {live ? <Tag>{t("npc.rawYocto")}</Tag> : null}
                  </V>
                </div>
                <div className="fd-kv__row">
                  <dt>{t("npc.stockAfter")}</dt>
                  <V>{quote.npc_spores_stock_after}</V>
                </div>
                <div className="fd-kv__row">
                  <dt>crucible_temp_mk</dt>
                  <V>{quote.crucible_temp_mk}</V>
                </div>
              </dl>
              <NpcReasoningTooltip quote={quote} npcName={name} source={live ? "contract" : "simulation"} stockBefore={npc?.spores_stock ?? 0} />
            </>
          )}

          {live ? (
            <div className="fd-stack">
              <p className="fd-note">{rich("npc.buyNote", { call: <code>{BUY_SIGNATURE}</code> })}</p>
              <div className="fd-row">
                <CopyButton label={t("npc.copyCall")} text={callTemplate} />
              </div>
            </div>
          ) : (
            <div className="fd-row">
              <KeycapButton variant="primary" icon="spark" onClick={buyDemo}>
                {t("npc.buyDemo")}
              </KeycapButton>
              <span className="fd-field__hint">
                {t("npc.balance", { n: userSnaccBalance.toLocaleString("en-US") })} <Sim />
              </span>
            </div>
          )}
          {feedback ? (
            <p className="fd-field__hint" role="status">
              {feedback}
            </p>
          ) : null}
        </TabPanel>
      </div>
    </Modal>
  );
}

export default NpcPanel;
