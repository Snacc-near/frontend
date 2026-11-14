/**
 * Swap and price preview. Both tabs query real public services in demo and live mode alike (no
 * sample numbers): the Rhea price list and a NEAR Intents 1Click dry quote. Display only: nothing
 * here feeds a game mechanic, signs a transaction or moves funds. `$SNACC` is a testnet token and is
 * listed on neither service.
 *
 * UI-161 phase B3: text comes from the `npc.swap` dictionary. A quote's own message comes from the service.
 */
import { useEffect, useId, useState } from "react";
import type { GameMode, SkinMode } from "../config/constants.ts";
import { fetchRefPrices, type RefPriceModel } from "../swap/refPrice.ts";
import { QUOTE_ASSETS, fetchIntentsQuote, type IntentsQuoteResult } from "../swap/intentsQuote.ts";
import { swapConfig } from "../swap/config.ts";
import { useT } from "../i18n/react.tsx";
import { Modal } from "../ui/Modal.tsx";
import { Empty, ExtLink, Field, Input, KeycapButton, KeycapLink, Select, TabPanel, Tabs } from "../ui/controls.tsx";
import { Tag } from "../ui/fd.tsx";

export interface SwapPanelProps {
  mode: GameMode;
  onClose: () => void;
  skin?: SkinMode;
}

type SwapTab = "price" | "quote";

/** Service routes and request fields: code, the same in every language. */
const RHEA_SOURCE = "api.rhea.finance /list-token-price";
const QUOTE_ROUTE = "POST /v0/quote";
const QUOTE_DRY = "dry: true";

const assetLabel =(i: number) => `${QUOTE_ASSETS[i].symbol} (${QUOTE_ASSETS[i].chain})`;

export function SwapPanel({ mode, onClose, skin = "biolab" }: SwapPanelProps) {
  const { t, rich } = useT();
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
      title={t("npc.swap.title")}
      heading={skin === "fintech" ? t("npc.swap.headingFintech") : t("npc.swap.headingBiolab")}
      onClose={onClose}
      testId="swap-modal"
      footer={
        <>
          <span>{t("npc.swap.footer")}</span>
          <Tag>{mode === "demo" ? t("npc.swap.tagDemo") : t("npc.swap.tagLive")}</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <p className="fd-note">
          <strong>{t("npc.swap.noteTitle")}</strong>
          {t("npc.swap.note")}
        </p>
        <Tabs
          label={t("npc.swap.tabsLabel")}
          idBase={idBase}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "price", label: t("npc.swap.tabPrice"), icon: "gauge" },
            { id: "quote", label: t("npc.swap.tabQuote"), icon: "swap" },
          ]}
        />
        {tab === "price" ? (
          <TabPanel idBase={idBase} id="price">
            {price === null ? (
              <Empty icon="gauge">{t("npc.swap.readingPrice")}</Empty>
            ) : (
              <dl className="fd-kv" data-testid="swap-price">
                <div className="fd-kv__row">
                  <dt>{price.referenceSymbol}</dt>
                  <dd className="fd-kv__num">{price.referencePriceUsd ?? "—"}</dd>
                </div>
                <div className="fd-kv__row">
                  <dt>$SNACC</dt>
                  <dd>
                    — <Tag>{t("npc.swap.notListed")}</Tag>
                  </dd>
                </div>
                <div className="fd-kv__row">
                  <dt>{t("npc.swap.source")}</dt>
                  <dd>{price.status === "error" ? t("npc.swap.rheaDown", { msg: price.errorMessage ?? t("npc.swap.errorWord") }) : RHEA_SOURCE}</dd>
                </div>
              </dl>
            )}
            <KeycapLink href={price?.rheaSwapUrl ?? "https://app.rhea.finance"} mono>
              {t("npc.swap.openRhea")}
            </KeycapLink>
          </TabPanel>
        ) : (
          <TabPanel idBase={idBase} id="quote">
            <div className="fd-form-grid">
              <Field id={`${idBase}-in`} label={t("npc.swap.from")}>
                <Select id={`${idBase}-in`} value={inIdx} onChange={(e) => setInIdx(Number(e.target.value))}>
                  {QUOTE_ASSETS.map((a, i) => (
                    <option key={a.id} value={i}>
                      {assetLabel(i)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={`${idBase}-out`} label={t("npc.swap.to")}>
                <Select id={`${idBase}-out`} value={outIdx} onChange={(e) => setOutIdx(Number(e.target.value))}>
                  {QUOTE_ASSETS.map((a, i) => (
                    <option key={a.id} value={i}>
                      {assetLabel(i)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={`${idBase}-amt`} label={t("npc.swap.amountIn")}>
                <Input id={`${idBase}-amt`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1.0" />
              </Field>
            </div>
            <KeycapButton variant="primary" icon="swap" onClick={getQuote} disabled={quoting || inIdx === outIdx}>
              {quoting ? t("npc.swap.asking") : inIdx === outIdx ? t("npc.swap.pickTwo") : t("npc.swap.getQuote")}
            </KeycapButton>
            {quote ? (
              quote.status === "ready" ? (
                <dl className="fd-kv" data-testid="swap-quote">
                  <div className="fd-kv__row">
                    <dt>{t("npc.swap.amountOut")}</dt>
                    <dd className="fd-kv__num">
                      {quote.amountOut} {quote.assetOutSymbol}
                    </dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>{t("npc.swap.minOut")}</dt>
                    <dd className="fd-kv__num">
                      {quote.minAmountOut} {quote.assetOutSymbol} <Tag>{t("npc.swap.slippage")}</Tag>
                    </dd>
                  </div>
                  <div className="fd-kv__row">
                    <dt>{t("npc.swap.estTime")}</dt>
                    <dd className="fd-kv__num">{quote.timeEstimateSec !== undefined ? t("npc.swap.seconds", { n: quote.timeEstimateSec }) : "—"}</dd>
                  </div>
                </dl>
              ) : (
                <p className={quote.status === "error" ? "fd-field__hint fd-field__hint--bad" : "fd-field__hint"} role="status" data-testid="swap-quote-msg">
                  {quote.message}
                </p>
              )
            ) : null}
            <p className="fd-field__hint">
              {rich("npc.swap.dryNote", {
                post: <code>{QUOTE_ROUTE}</code>,
                dry: <code>{QUOTE_DRY}</code>,
                link: <ExtLink href="https://docs.near-intents.org">{t("npc.swap.docs")}</ExtLink>,
              })}
            </p>
          </TabPanel>
        )}
      </div>
    </Modal>
  );
}

export default SwapPanel;
