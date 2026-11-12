/**
 * Swap and price preview. Both tabs query real public services in demo and live mode alike (no
 * sample numbers): the Rhea price list and a NEAR Intents 1Click dry quote. Display only: nothing
 * here feeds a game mechanic, signs a transaction or moves funds. `$SNACC` is a testnet token and is
 * listed on neither service.
 */
import { useEffect, useId, useState } from "react";
import type { GameMode, SkinMode } from "../config/constants.ts";
import { fetchRefPrices, type RefPriceModel } from "../swap/refPrice.ts";
import { QUOTE_ASSETS, fetchIntentsQuote, type IntentsQuoteResult } from "../swap/intentsQuote.ts";
import { swapConfig } from "../swap/config.ts";
import { Modal } from "../ui/Modal.tsx";
import { Empty, ExtLink, Field, Input, KeycapButton, KeycapLink, Select, TabPanel, Tabs } from "../ui/controls.tsx";
import { Tag } from "../ui/fd.tsx";

export interface SwapPanelProps {
  mode: GameMode;
  onClose: () => void;
  skin?: SkinMode;
}

type SwapTab = "price" | "quote";

const assetLabel = (i: number) => `${QUOTE_ASSETS[i].symbol} (${QUOTE_ASSETS[i].chain})`;

export function SwapPanel({ mode, onClose, skin = "biolab" }: SwapPanelProps) {
  const idBase = useId();
  const [tab, setTab] = useState<SwapTab>("price");
  const [price, setPrice] = useState<RefPriceModel | null>(null);
  const [inIdx, setInIdx] = useState(0);
  const [outIdx, setOutIdx] = useState(1);
  const [amount, setAmount] = useState("1");
  const [quote, setQuote] = useState<IntentsQuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void fetchRefPrices(swapConfig, { signal: ac.signal }).then((res) => {
      if (!ac.signal.aborted) setPrice(res);
    });
    return () => ac.abort();
  }, []);

  const getQuote = () => {
    setQuoting(true);
    void fetchIntentsQuote({ assetIn: QUOTE_ASSETS[inIdx], assetOut: QUOTE_ASSETS[outIdx], amountIn: amount }).then((res) => {
      setQuote(res);
      setQuoting(false);
    });
  };

  return (
    <Modal
      title="swap-quote.view"
      heading={skin === "fintech" ? "Secondary liquidity preview" : "Swap and price preview"}
      onClose={onClose}
      testId="swap-modal"
      footer={
        <>
          <span>external public APIs · display only · nothing is signed</span>
          <Tag>{mode === "demo" ? "demo mode: same live data" : "live"}</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <p className="fd-note">
          <strong>$SNACC is a testnet token with no monetary value.</strong> It is not listed on Rhea or in the 1Click token list, so
          this panel can only show reference prices and quotes between listed assets.
        </p>
        <Tabs
          label="swap preview source"
          idBase={idBase}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "price", label: "Rhea price", icon: "gauge" },
            { id: "quote", label: "1Click dry quote", icon: "swap" },
          ]}
        />
        {tab === "price" ? (
          <TabPanel idBase={idBase} id="price">
            {price === null ? (
              <Empty icon="gauge">reading the Rhea price list…</Empty>
            ) : (
              <dl className="fd-kv" data-testid="swap-price">
                <div className="fd-kv__row">
                  <dt>{price.referenceSymbol}</dt>
                  <dd className="fd-kv__num">{price.referencePriceUsd ?? "—"}</dd>
                </div>
                <div className="fd-kv__row">
                  <dt>$SNACC</dt>
                  <dd>
                    — <Tag>not listed</Tag>
                  </dd>
                </div>
                <div className="fd-kv__row">
                  <dt>source</dt>
                  <dd>{price.status === "error" ? `Rhea unavailable (${price.errorMessage ?? "error"})` : "api.rhea.finance /list-token-price"}</dd>
                </div>
              </dl>
            )}
            <KeycapLink href={price?.rheaSwapUrl ?? "https://app.rhea.finance"} mono>
              open Rhea
            </KeycapLink>
          </TabPanel>
        ) : (
          <TabPanel idBase={idBase} id="quote">
            <div className="fd-form-grid">
              <Field id={`${idBase}-in`} label="from">
                <Select id={`${idBase}-in`} value={inIdx} onChange={(e) => setInIdx(Number(e.target.value))}>
                  {QUOTE_ASSETS.map((a, i) => (
                    <option key={a.id} value={i}>
                      {assetLabel(i)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={`${idBase}-out`} label="to">
                <Select id={`${idBase}-out`} value={outIdx} onChange={(e) => setOutIdx(Number(e.target.value))}>
                  {QUOTE_ASSETS.map((a, i) => (
                    <option key={a.id} value={i}>
                      {assetLabel(i)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={`${idBase}-amt`} label="amount in">
                <Input id={`${idBase}-amt`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1.0" />
              </Field>
            </div>
            <KeycapButton variant="primary" icon="swap" onClick={getQuote} disabled={quoting || inIdx === outIdx}>
              {quoting ? "asking 1Click…" : inIdx === outIdx ? "pick two different assets" : "get dry-run quote"}
            </KeycapButton>
            {quote ? (
              quote.status === "ready" ? (
                <dl className="fd-kv" data-testid="swap-quote">
                  <div className="fd-kv__row">
                    <dt>amount out</dt>
                    <dd className="fd-kv__num">
                      {quote.amountOut} {quote.assetOutSymbol}
                    </dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>min out</dt>
                    <dd className="fd-kv__num">
                      {quote.minAmountOut} {quote.assetOutSymbol} <Tag>1% slippage</Tag>
                    </dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>est. time</dt>
                    <dd className="fd-kv__num">{quote.timeEstimateSec !== undefined ? `${quote.timeEstimateSec} s` : "—"}</dd>
                  </div>
                </dl>
              ) : (
                <p className={quote.status === "error" ? "fd-field__hint fd-field__hint--bad" : "fd-field__hint"} role="status" data-testid="swap-quote-msg">
                  {quote.message}
                </p>
              )
            ) : null}
            <p className="fd-field__hint">
              A dry quote (<code>POST /v0/quote</code>, <code>dry: true</code>) creates no deposit address and starts no swap. See the{" "}
              <ExtLink href="https://docs.near-intents.org">1Click API docs</ExtLink>.
            </p>
          </TabPanel>
        )}
      </div>
    </Modal>
  );
}

export default SwapPanel;
