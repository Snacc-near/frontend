/**
 * NPC spore merchants (ADR-30). Live mode reads the contract views `get_npc` and
 * `npc_quote_spores` on `snacc-v001.testnet` and shows their values only; buying needs the signed
 * change call `npc_buy_spores`, which this wallet-less app cannot make. Demo mode runs the same
 * quote rule on local genesis state and labels every number as a simulation.
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

export function NpcPanel({ onClose, skin, crucibleTempMk, mode, userSnaccBalance, onBuySpores }: NpcPanelProps) {
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
    const t = window.setTimeout(() => {
      void fetchNpcQuote(selected, amount, ac.signal).then((q) => {
        if (!ac.signal.aborted) setLiveQuote(q);
      });
    }, 300);
    return () => {
      ac.abort();
      clearTimeout(t);
    };
  }, [live, selected, amount]);

  const npc: NpcAgent | undefined = live ? liveNpcs?.[selected] : demoNpcs[selected];
  const demoQuote = useMemo(
    () => (live ? null : simulateNpcQuote(demoNpcs[selected], amount, crucibleTempMk ?? 605)),
    [live, demoNpcs, selected, amount, crucibleTempMk],
  );
  const quote: NpcQuote | null = live ? (liveQuote === "loading" ? null : liveQuote) : demoQuote;
  const name = npcName(selected, skin);
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
      setFeedback(`${name} holds only ${demoNpcs[selected].spores_stock} spores.`);
      return;
    }
    if (cost > userSnaccBalance) {
      setFeedback(`Not enough simulated $SNACC: need ${cost}, have ${userSnaccBalance}.`);
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
    setFeedback(`Simulation: bought ${amount} spores from ${name} for ${cost} simulated $SNACC.`);
  };

  return (
    <Modal
      title={skin === "fintech" ? "market-makers.view" : "npc-merchants.view"}
      heading={skin === "fintech" ? "NPC market makers" : "NPC spore merchants"}
      onClose={onClose}
      size="lg"
      testId="npc-modal"
      footer={
        live ? (
          <>
            <span>contract views get_npc · npc_quote_spores on {CONTRACT_ID}</span>
            <Tag>live · testnet</Tag>
          </>
        ) : (
          <>
            <span>local copy of the contract rule on genesis state</span>
            <Sim />
          </>
        )
      }
    >
      <div className="fd-stack">
        <Tabs
          label="NPC merchant"
          idBase={idBase}
          value={selected}
          onChange={(id) => {
            setSelected(id);
            setFeedback(null);
          }}
          tabs={NPC_IDS.map((id) => ({ id, label: NPC_SKIN[id][skin].name }))}
        />
        <TabPanel idBase={idBase} id={selected}>
          <p className="fd-sub">
            {NPC_SKIN[selected][skin].role} · <code>{selected}</code> · sells mt:spore-ignis
          </p>
          {live && liveNpcs === null ? (
            <Empty icon="eye">reading get_npc from {CONTRACT_ID}…</Empty>
          ) : !npc ? (
            <Empty icon="warn">Could not read get_npc(&quot;{selected}&quot;) from {CONTRACT_ID}. No numbers are shown instead.</Empty>
          ) : (
            <dl className="fd-kv" data-testid="npc-state">
              <div className="fd-kv__row">
                <dt>role_archetype</dt>
                <V>{npc.role_archetype}</V>
              </div>
              <div className="fd-kv__row">
                <dt>spores_stock</dt>
                <V>
                  {npc.spores_stock} / target {npc.target_spores_stock}
                </V>
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

          <Field id={`${idBase}-amount`} label="buy_amount (spores)">
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
            <Empty icon="eye">reading npc_quote_spores…</Empty>
          ) : !quote ? (
            <Empty icon="warn">The contract did not return a quote for this amount (the view rejects amounts it cannot fill).</Empty>
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
                    {String(quote.total_cost_snacc)} {live ? <Tag>raw yocto units</Tag> : null}
                  </V>
                </div>
                <div className="fd-kv__row">
                  <dt>stock after</dt>
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
              <p className="fd-note">
                Buying calls <code>npc_buy_spores(strain_id, npc_id, buy_amount)</code>, a signed change call. This app has no wallet
                connection, so live mode is read-only.
              </p>
              <div className="fd-row">
                <CopyButton label="copy call template" text={`npc_buy_spores(${JSON.stringify({ strain_id: "<your strain id>", npc_id: selected, buy_amount: amount })})`} />
              </div>
            </div>
          ) : (
            <div className="fd-row">
              <KeycapButton variant="primary" icon="spark" onClick={buyDemo}>
                buy in simulation
              </KeycapButton>
              <span className="fd-field__hint">
                balance {userSnaccBalance.toLocaleString("en-US")} <Sim />
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
