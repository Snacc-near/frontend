/**
 * Market (UI-164): the testnet demo marketplace for Snaccs (`snacc-market.testnet`, `contracts/market`).
 * Three tabs: Browse (every open listing, buy with a confirm step), Sell (list one of your living
 * Snaccs for a price in NEAR) and My listings (change the price or take a Snacc back).
 *
 * Reads come from the chain views (FastNEAR first), nothing is invented. Every signed call goes through
 * the connected wallet. The market can refuse a listing or settle a purchase as a refund inside a
 * transaction the wallet calls successful, so after a success the window reads the chain again and only
 * says "listed" / "bought" when the views agree (`confirmExpectation`).
 *
 * Testnet only. Testnet NEAR and Snaccs have no money value.
 *
 * UI-161 phase B3: every sentence comes from the `market` dictionary (`useT()`).
 */
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import "./collection.css";
import "./market.css";
import { maxGasFeeYocto, totalDeposit, type ContractCall } from "../chain/actions.ts";
import { fetchCollection, healthOf, isAlive, type CollectionItem } from "../data/collection.ts";
import {
  CONTRACT_ID,
  MARKET_ID,
  MAX_LISTINGS_PER_SELLER,
  MAX_PRICE_NEAR,
  PAGE_SIZE,
  buildBuy,
  buildDelist,
  buildList,
  buildUpdatePrice,
  buyBlockReason,
  chainView,
  checkPrice,
  confirmExpectation,
  enrichListings,
  fetchListingCount,
  fetchListingsPage,
  fetchSellerListings,
  notConfirmedMessage,
  pageCount,
  priceLabel,
  yoctoToNear,
  type ChainView,
  type Confirmation,
  type Expectation,
  type MarketRow,
  type MarketTx,
} from "../chain/market.ts";
import { EMPTY_ACCOUNT_INFO, type AccountInfo } from "../chain/useAccountInfo.ts";
import { useWallet, type WalletApi } from "../chain/wallet.tsx";
import { VITALITY_MAX } from "../config/constants.ts";
import { explorerAccount, explorerTx } from "../data/nearView.ts";
import type { Translate } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";
import { Modal } from "../ui/Modal.tsx";
import { Empty, ExtLink, Field, Input, KeycapButton, Select, TabPanel, Tabs, type TabDef } from "../ui/controls.tsx";
import { Icon, Tag } from "../ui/fd.tsx";
import { FaucetLine, TxStatusView, type TxPhase } from "./ChainActions.tsx";

const fmt = (n: number) => n.toLocaleString("en-US");

export type MarketTab = "browse" | "sell" | "mine";
const tabsFor = (t: Translate): readonly TabDef<MarketTab>[] => [
  { id: "browse", label: t("market.tabs.browse"), icon: "grid" },
  { id: "sell", label: t("market.tabs.sell"), icon: "cell" },
  { id: "mine", label: t("market.tabs.mine"), icon: "user" },
];

// ---------------------------------------------------------------- shared state

type Load<T> = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ok"; data: T };

/** Runs `fn` when `deps` change (and on `reload`); `null` from `fn` is reported as `failure`. */
function useLoad<T>(fn: (signal: AbortSignal) => Promise<T | null>, deps: readonly unknown[], failure: string): { state: Load<T>; reload: () => void } {
  const [state, setState] = useState<Load<T>>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setState({ kind: "loading" });
    void fn(ac.signal)
      .then((data) => {
        if (ac.signal.aborted) return;
        setState(data === null ? { kind: "error", message: failure } : { kind: "ok", data });
      })
      .catch(() => {
        if (!ac.signal.aborted) setState({ kind: "error", message: failure });
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}

/** Status of the one transaction in flight: the shared `TxPhase`, plus the read-back after a success. */
export type MarketPhase =
  | TxPhase
  | { kind: "checking"; txHash: string | null }
  | { kind: "settled"; txHash: string | null; outcome: Confirmation; exp: Expectation };

export interface MarketTxApi {
  phase: MarketPhase;
  busy: boolean;
  run: (tx: MarketTx, exp: Expectation) => Promise<void>;
  reset: () => void;
}

function useMarketTx(wallet: WalletApi, view: ChainView, onDone: ((ok: boolean, txHash?: string | null) => void) | undefined, onSettled: () => void): MarketTxApi {
  const [phase, setPhase] = useState<MarketPhase>({ kind: "idle" });
  const run = async (tx: MarketTx, exp: Expectation) => {
    setPhase({ kind: "pending" });
    const result = await wallet.signAndSend([tx.call], tx.receiverId);
    if (!result.ok) {
      setPhase({ kind: "done", result });
      return;
    }
    setPhase({ kind: "checking", txHash: result.txHash });
    const outcome = await confirmExpectation(exp, view);
    setPhase({ kind: "settled", txHash: result.txHash, outcome, exp });
    onSettled();
    if (outcome === "confirmed") onDone?.(true, result.txHash);
  };
  const busy = phase.kind === "pending" || phase.kind === "checking";
  return { phase, busy, run, reset: () => setPhase({ kind: "idle" }) };
}

/** The sentence for a confirmed outcome. */
function settledText(t: Translate, e: Expectation): string {
  const id = e.tokenId;
  switch (e.kind) {
    case "listed":
      return "priceYocto" in e ? t("market.settled.listedFor", { id, price: priceLabel(e.priceYocto) }) : t("market.settled.listed", { id });
    case "repriced":
      return t("market.settled.repriced", { id, price: "priceYocto" in e ? priceLabel(e.priceYocto) : t("market.settled.newPrice") });
    case "delisted":
      return t("market.settled.delisted", { id });
    case "bought":
      return t("market.settled.bought", { id });
  }
}

const TxLink = ({ hash }: { hash: string | null }) => {
  const { t } = useT();
  return hash ? (
    <>
      {t("market.tx.prefix")} <ExtLink href={explorerTx(hash)}>{`${hash.slice(0, 10)}…`}</ExtLink>
    </>
  ) : (
    <>{t("market.tx.noHash")}</>
  );
};

/** Pending, failure and success lines; a success is only "done" once the views confirm it. */
export function MarketTxStatus({ phase }: { phase: MarketPhase }) {
  const { t } = useT();
  if (phase.kind === "checking") {
    return (
      <p className="fd-note" role="status" data-testid="market-checking">
        <strong>{t("market.tx.sent")}</strong> {t("market.tx.checking")}
      </p>
    );
  }
  if (phase.kind === "settled") {
    if (phase.outcome === "confirmed") {
      return (
        <div className="fd-note" role="status" data-testid="market-confirmed">
          <strong>{t("market.tx.done")}</strong> {settledText(t, phase.exp)} <TxLink hash={phase.txHash} />
        </div>
      );
    }
    return (
      <div className="fd-stack" role="alert" data-testid="market-not-confirmed">
        <p className="fd-field__hint fd-field__hint--bad">{notConfirmedMessage(phase.exp, phase.outcome)}</p>
        <p className="fd-field__hint">
          <TxLink hash={phase.txHash} />
        </p>
      </div>
    );
  }
  return <TxStatusView phase={phase} />;
}

// ---------------------------------------------------------------- listing rows

const hintFor = (row: MarketRow): "starving" | "distressed" | null => {
  if (!row.vessel) return null;
  const h = healthOf(row.vessel.status, row.vessel.effective_vitality);
  return h === "starving" || h === "distressed" ? h : null;
};

/** One listing: thumbnail, id, vitality, generation, seller and price; `children` are the action keys. */
export function ListingRow({ row, showSeller = true, children }: { row: MarketRow; showSeller?: boolean; children?: ReactNode }) {
  const { t, rich } = useT();
  const { listing, vessel, mediaSrc } = row;
  const hint = hintFor(row);
  const eff = vessel?.effective_vitality ?? 0;
  const pct = Math.min(100, Math.max(0, (eff / VITALITY_MAX) * 100));
  return (
    <li className="mkt-row" data-testid={`market-row-${listing.tokenId}`}>
      {mediaSrc ? (
        <img className="coll-thumb" src={mediaSrc} alt={t("market.row.svgAlt", { id: listing.tokenId })} loading="lazy" />
      ) : (
        <span className="coll-thumb coll-thumb--none" role="img" aria-label={t("market.row.noSvgLabel", { id: listing.tokenId })}>
          {t("market.row.noSvg")}
        </span>
      )}
      <span className="coll-main">
        <span className="fd-row" style={{ gap: 6 }}>
          <span className="coll-id">{t("market.row.strain", { id: listing.tokenId })}</span>
          {vessel ? <Tag>{vessel.status}</Tag> : null}
          {hint ? <span className="coll-flag">{t(`market.health.${hint}`)}</span> : null}
        </span>
        {vessel ? (
          <span className="coll-vit">
            <span
              className="fd-meter"
              role="meter"
              aria-label={t("market.row.vitalityLabel", { id: listing.tokenId })}
              aria-valuemin={0}
              aria-valuemax={VITALITY_MAX}
              aria-valuenow={Math.min(VITALITY_MAX, Math.max(0, eff))}
            >
              <span className="fd-meter__fill" style={{ transform: `scaleX(${(pct / 100).toFixed(3)})` }} />
            </span>
            <span className="fd-num">
              {fmt(eff)} / {fmt(VITALITY_MAX)}
            </span>
          </span>
        ) : (
          <span className="fd-field__hint">{t("market.row.noDetails")}</span>
        )}
        <span className="mkt-meta">
          {vessel ? t("market.row.generation", { n: vessel.generation }) : t("market.row.generationNone")}
          {showSeller ? rich("market.row.seller", { seller: <ExtLink href={explorerAccount(listing.sellerId)}>{listing.sellerId}</ExtLink> }) : null}
        </span>
      </span>
      <span className="mkt-side">
        <span className="mkt-price fd-num" data-testid={`market-price-${listing.tokenId}`}>
          {priceLabel(listing.priceYocto)}
        </span>
        {children}
      </span>
    </li>
  );
}

/** The rows of one page; `actions` renders the keys for each row. */
export function ListingList({
  rows,
  label,
  showSeller,
  actions,
}: {
  rows: readonly MarketRow[];
  label: string;
  showSeller?: boolean;
  actions?: (row: MarketRow) => ReactNode;
}) {
  return (
    <ul className="fd-list coll-list" aria-label={label} data-testid="market-list">
      {rows.map((row) => (
        <ListingRow key={row.listing.tokenId} row={row} showSeller={showSeller}>
          {actions?.(row)}
        </ListingRow>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- buy confirm

export function BuyConfirm({
  row,
  accountId,
  info,
  phase,
  onConfirm,
  onBack,
}: {
  row: MarketRow;
  accountId: string | null;
  info: AccountInfo;
  phase: MarketPhase;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { t, rich } = useT();
  const { listing, vessel } = row;
  const call: ContractCall = buildBuy({ tokenId: listing.tokenId, priceYocto: listing.priceYocto }).call;
  const gas = maxGasFeeYocto([call]);
  const need = (BigInt(totalDeposit([call])) + BigInt(gas)).toString();
  const blocked = buyBlockReason(row, accountId);
  const busy = phase.kind === "pending" || phase.kind === "checking";
  const done = phase.kind === "settled" && phase.outcome === "confirmed";
  const hungry = hintFor(row);
  return (
    <div className="fd-stack" data-testid="market-buy-confirm">
      <p className="fd-note">
        <strong>{t("market.buy.title", { id: listing.tokenId })}</strong>
        {rich("market.buy.note", { account: <code>{accountId ?? t("market.buy.you")}</code> })}
      </p>
      <dl className="fd-kv" data-testid="market-buy-cost">
        <div className="fd-kv__row">
          <dt>{t("market.buy.attach")}</dt>
          <dd className="fd-kv__num">
            {t("market.buy.attachValue", { near: yoctoToNear(listing.priceYocto) })} <code>{t("market.buy.yoctoPrice", { yocto: listing.priceYocto })}</code>
          </dd>
        </div>
        <div className="fd-kv__row">
          <dt>{t("market.buy.toSeller")}</dt>
          <dd className="fd-kv__num">{rich("market.buy.toSellerValue", { seller: <code>{listing.sellerId}</code> })}</dd>
        </div>
        <div className="fd-kv__row">
          <dt>{t("market.buy.gas")}</dt>
          <dd className="fd-kv__num">{t("market.buy.gasValue", { gas: yoctoToNear(gas) })}</dd>
        </div>
        <div className="fd-kv__row">
          <dt>{t("market.buy.yourNear")}</dt>
          <dd className="fd-kv__num">{info.nearYocto === null ? "—" : priceLabel(info.nearYocto)}</dd>
        </div>
        {vessel ? (
          <div className="fd-kv__row">
            <dt>{t("market.buy.thisSnacc")}</dt>
            <dd className="fd-kv__num">
              {t("market.buy.thisSnaccValue", { status: vessel.status, vit: fmt(vessel.effective_vitality), max: fmt(VITALITY_MAX), gen: vessel.generation })}
            </dd>
          </div>
        ) : null}
      </dl>
      {hungry ? (
        <p className="fd-field__hint fd-field__hint--bad" role="status">
          {t("market.buy.hungry", { state: t(`market.health.${hungry}`) })}
        </p>
      ) : null}
      <p className="fd-field__hint">{t("market.buy.refund")}</p>
      <FaucetLine needYocto={need} info={info} />
      <MarketTxStatus phase={phase} />
      <div className="fd-row">
        {done ? (
          <KeycapButton variant="primary" icon="check" onClick={onBack}>
            {t("market.buy.backToList")}
          </KeycapButton>
        ) : (
          <>
            <KeycapButton variant="primary" icon="spark" disabled={blocked !== null || busy} onClick={onConfirm} data-testid="market-buy-sign">
              {busy ? t("market.buy.waiting") : t("market.buy.sign")}
            </KeycapButton>
            <KeycapButton mono onClick={onBack} disabled={busy}>
              {t("market.buy.back")}
            </KeycapButton>
          </>
        )}
      </div>
      {blocked ? <p className="fd-field__hint fd-field__hint--bad">{blocked}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Browse

interface TabProps {
  view: ChainView;
  accountId: string | null;
  info: AccountInfo;
  tx: MarketTxApi;
  /** Bumped after each settled transaction: lists read again. */
  version: number;
}

function BrowseTab({ view, accountId, info, tx, version }: TabProps) {
  const { t } = useT();
  const [page, setPage] = useState(0);
  const [buying, setBuying] = useState<MarketRow | null>(null);
  const { state, reload } = useLoad<{ total: number; rows: MarketRow[] }>(
    async (signal) => {
      const [total, listings] = await Promise.all([fetchListingCount(view, signal), fetchListingsPage(page * PAGE_SIZE, PAGE_SIZE, view, signal)]);
      if (total === null || listings === null) return null;
      const rows = await enrichListings(listings, view, signal);
      return { total, rows };
    },
    [page, version, view],
    t("market.rpcDown"),
  );
  const total = state.kind === "ok" ? state.data.total : null;
  const pages = total === null ? 1 : pageCount(total);
  // After a purchase or a delist the last page can disappear: step back to the last one that exists.
  useEffect(() => {
    if (total !== null && page > 0 && page >= pages) setPage(pages - 1);
  }, [total, page, pages]);

  if (buying) {
    return (
      <BuyConfirm
        row={buying}
        accountId={accountId}
        info={info}
        phase={tx.phase}
        onBack={() => {
          if (!tx.busy) {
            tx.reset();
            setBuying(null);
          }
        }}
        onConfirm={() =>
          void tx.run(buildBuy({ tokenId: buying.listing.tokenId, priceYocto: buying.listing.priceYocto }), {
            kind: "bought",
            tokenId: buying.listing.tokenId,
            buyerId: accountId ?? "",
          })
        }
      />
    );
  }

  return (
    <div className="fd-stack">
      <div className="fd-row fd-row--between">
        <span className="fd-sub" data-testid="market-count">
          {total === null ? t("market.browse.listings") : t(total === 1 ? "market.browse.countOne" : "market.browse.countMany", { n: fmt(total) })}
        </span>
        <KeycapButton mono icon="ring" onClick={reload} disabled={state.kind === "loading"}>
          {t("market.browse.refresh")}
        </KeycapButton>
      </div>
      {state.kind === "loading" ? <Empty icon="eye">{t("market.browse.reading")}</Empty> : null}
      {state.kind === "error" ? (
        <Empty icon="warn">
          <div className="fd-stack" style={{ justifyItems: "center" }}>
            <span data-testid="market-error">{state.message}</span>
            <KeycapButton mono icon="ring" onClick={reload}>
              {t("market.browse.retry")}
            </KeycapButton>
          </div>
        </Empty>
      ) : null}
      {state.kind === "ok" && state.data.rows.length === 0 ? (
        <Empty icon="cell">
          <span data-testid="market-empty">{t("market.browse.empty")}</span>
          <br />
          {t("market.browse.emptyHint")}
        </Empty>
      ) : null}
      {state.kind === "ok" && state.data.rows.length > 0 ? (
        <>
          <ListingList
            rows={state.data.rows}
            label={t("market.browse.listLabel")}
            actions={(row) => {
              const blocked = buyBlockReason(row, accountId);
              return (
                <KeycapButton mono icon="spark" disabled={blocked !== null} title={blocked ?? undefined} onClick={() => setBuying(row)} data-testid={`market-buy-${row.listing.tokenId}`}>
                  {t("market.browse.buy")}
                </KeycapButton>
              );
            }}
          />
          {pages > 1 ? (
            <div className="fd-row fd-row--between" role="group" aria-label={t("market.browse.pages")}>
              <KeycapButton mono disabled={page === 0} onClick={() => setPage(page - 1)}>
                {t("market.browse.previous")}
              </KeycapButton>
              <span className="fd-sub" data-testid="market-page">
                {t("market.browse.page", { page: page + 1, pages })}
              </span>
              <KeycapButton mono disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                {t("market.browse.next")}
              </KeycapButton>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Sell

/** Living Snaccs that can be listed: alive and without a pending cross-contract call. */
export function sellableItems(items: readonly CollectionItem[]): CollectionItem[] {
  return items.filter((i) => isAlive(i) && i.detail.pending_callbacks === 0);
}

function SellTab({ view, accountId, tx, version }: TabProps) {
  const { t, rich } = useT();
  const uid = useId();
  const { state } = useLoad<{ items: CollectionItem[]; open: number }>(
    async (signal) => {
      if (!accountId) return null;
      const [coll, mine] = await Promise.all([fetchCollection(accountId, signal), fetchSellerListings(accountId, view, signal)]);
      if (coll.kind !== "ok" || mine === null) return null;
      return { items: sellableItems(coll.data.items), open: mine.length };
    },
    [accountId, version, view],
    t("market.rpcDown"),
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const items = state.kind === "ok" ? state.data.items : [];
  const open = state.kind === "ok" ? state.data.open : 0;
  const chosen = items.find((i) => i.strainId === picked) ?? items[0] ?? null;
  const check = checkPrice(price);
  const full = open >= MAX_LISTINGS_PER_SELLER;

  if (!accountId) return <Empty icon="user">{t("market.sell.connect")}</Empty>;
  if (state.kind === "loading") return <Empty icon="eye">{t("market.sell.reading", { account: accountId })}</Empty>;
  if (state.kind === "error") return <Empty icon="warn">{state.message}</Empty>;
  if (items.length === 0) {
    return (
      <Empty icon="cell">
        <span data-testid="market-sell-empty">{t("market.sell.none")}</span>
        <br />
        {t("market.sell.noneHint")}
      </Empty>
    );
  }

  const built = chosen && check.ok ? buildList({ strainId: chosen.strainId, priceYocto: check.yocto }) : null;
  const canSign = built !== null && !full && !tx.busy && !(tx.phase.kind === "settled" && tx.phase.outcome === "confirmed");
  return (
    <div className="fd-stack" data-testid="market-sell">
      <div className="fd-form-grid">
        <Field id={`${uid}-snacc`} label={t("market.sell.fieldSnacc")}>
          <Select id={`${uid}-snacc`} value={chosen?.strainId ?? ""} onChange={(e) => setPicked(Number(e.target.value))} disabled={tx.busy}>
            {items.map((i) => (
              <option key={i.strainId} value={i.strainId}>
                {t("market.sell.option", { id: i.strainId, vit: fmt(i.effectiveVitality), gen: i.generation, status: i.status })}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={`${uid}-price`}
          label={t("market.sell.fieldPrice")}
          bad={price.trim() !== "" && !check.ok}
          hint={check.ok ? t("market.sell.priceOk", { near: yoctoToNear(check.yocto) }) : price.trim() === "" ? t("market.sell.priceMax", { max: Number(MAX_PRICE_NEAR).toLocaleString("en-US") }) : check.reason}
        >
          <Input
            id={`${uid}-price`}
            data-autofocus=""
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={tx.busy}
            aria-invalid={price.trim() !== "" && !check.ok}
            aria-describedby={`${uid}-price-hint`}
            autoComplete="off"
            placeholder="1.5"
          />
        </Field>
      </div>
      {chosen?.mediaSrc ? <img className="coll-thumb" src={chosen.mediaSrc} alt={t("market.row.svgAlt", { id: chosen.strainId })} /> : null}
      <p className="fd-note">
        <strong>{t("market.sell.leavesTitle")}</strong>
        {rich("market.sell.leavesBody", { market: <code>{MARKET_ID}</code> })}
      </p>
      <dl className="fd-kv">
        <div className="fd-kv__row">
          <dt>{t("market.sell.attach")}</dt>
          <dd className="fd-kv__num">{t("market.sell.attachValue")}</dd>
        </div>
        <div className="fd-kv__row">
          <dt>{t("market.sell.gas")}</dt>
          <dd className="fd-kv__num">{built ? t("market.buy.gasValue", { gas: yoctoToNear(maxGasFeeYocto([built.call])) }) : "—"}</dd>
        </div>
        <div className="fd-kv__row">
          <dt>{t("market.sell.open")}</dt>
          <dd className="fd-kv__num">{t("market.sell.openOf", { open, max: MAX_LISTINGS_PER_SELLER })}</dd>
        </div>
      </dl>
      {full ? <p className="fd-field__hint fd-field__hint--bad">{t("market.sell.full", { max: MAX_LISTINGS_PER_SELLER })}</p> : null}
      <MarketTxStatus phase={tx.phase} />
      <div className="fd-row">
        <KeycapButton
          variant="primary"
          icon="spark"
          disabled={!canSign}
          onClick={() => {
            if (built && chosen && check.ok) {
              void tx.run(built, { kind: "listed", tokenId: String(chosen.strainId), sellerId: accountId, priceYocto: check.yocto });
            }
          }}
          data-testid="market-list-sign"
        >
          {tx.busy ? t("market.buy.waiting") : t("market.sell.sign")}
        </KeycapButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- My listings

function MineTab({ view, accountId, tx, version }: TabProps) {
  const { t, rich } = useT();
  const { state, reload } = useLoad<MarketRow[]>(
    async (signal) => {
      if (!accountId) return null;
      const mine = await fetchSellerListings(accountId, view, signal);
      return mine === null ? null : enrichListings(mine, view, signal);
    },
    [accountId, version, view],
    t("market.rpcDown"),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const uid = useId();
  const check = checkPrice(price);
  const settledOk = tx.phase.kind === "settled" && tx.phase.outcome === "confirmed";
  // A finished price change closes the editor.
  useEffect(() => {
    if (settledOk) setEditing(null);
  }, [settledOk]);

  if (!accountId) return <Empty icon="user">{t("market.mine.connect")}</Empty>;
  return (
    <div className="fd-stack" data-testid="market-mine">
      <div className="fd-row fd-row--between">
        <span className="fd-sub">{rich("market.mine.seller", { account: <code>{accountId}</code> })}</span>
        <KeycapButton mono icon="ring" onClick={reload} disabled={state.kind === "loading" || tx.busy}>
          {t("market.mine.refresh")}
        </KeycapButton>
      </div>
      {state.kind === "loading" ? <Empty icon="eye">{t("market.mine.reading")}</Empty> : null}
      {state.kind === "error" ? <Empty icon="warn">{state.message}</Empty> : null}
      {state.kind === "ok" && state.data.length === 0 ? (
        <Empty icon="cell">
          <span data-testid="market-mine-empty">{t("market.mine.empty")}</span>
        </Empty>
      ) : null}
      {state.kind === "ok" && state.data.length > 0 ? (
        <ListingList
          rows={state.data}
          label={t("market.mine.listLabel")}
          showSeller={false}
          actions={(row) => {
            const dead = row.vessel ? healthOf(row.vessel.status, row.vessel.effective_vitality) === "dead" : false;
            return (
              <span className="fd-row" style={{ gap: 6 }}>
                <KeycapButton
                  mono
                  icon="gauge"
                  disabled={tx.busy}
                  aria-expanded={editing === row.listing.tokenId}
                  onClick={() => {
                    tx.reset();
                    setPrice(yoctoToNear(row.listing.priceYocto));
                    setEditing(editing === row.listing.tokenId ? null : row.listing.tokenId);
                  }}
                  data-testid={`market-edit-${row.listing.tokenId}`}
                >
                  {t("market.mine.changePrice")}
                </KeycapButton>
                <KeycapButton
                  mono
                  icon="close"
                  disabled={tx.busy || dead}
                  title={dead ? t("market.mine.died") : undefined}
                  onClick={() => {
                    setEditing(null);
                    void tx.run(buildDelist({ tokenId: row.listing.tokenId }), { kind: "delisted", tokenId: row.listing.tokenId, sellerId: accountId });
                  }}
                  data-testid={`market-delist-${row.listing.tokenId}`}
                >
                  {t("market.mine.delist")}
                </KeycapButton>
              </span>
            );
          }}
        />
      ) : null}
      {editing !== null ? (
        <div className="fd-stack" data-testid="market-edit-form">
          <Field
            id={`${uid}-newprice`}
            label={t("market.mine.newPrice", { id: editing })}
            bad={!check.ok}
            hint={check.ok ? t("market.mine.priceOk", { near: yoctoToNear(check.yocto) }) : check.reason}
          >
            <Input
              id={`${uid}-newprice`}
              data-autofocus=""
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={tx.busy}
              aria-invalid={!check.ok}
              aria-describedby={`${uid}-newprice-hint`}
              autoComplete="off"
            />
          </Field>
          <div className="fd-row">
            <KeycapButton
              variant="primary"
              icon="check"
              disabled={!check.ok || tx.busy}
              onClick={() => {
                if (check.ok) void tx.run(buildUpdatePrice({ tokenId: editing, priceYocto: check.yocto }), { kind: "repriced", tokenId: editing, sellerId: accountId, priceYocto: check.yocto });
              }}
              data-testid="market-reprice-sign"
            >
              {t("market.mine.signPrice")}
            </KeycapButton>
            <KeycapButton mono onClick={() => setEditing(null)} disabled={tx.busy}>
              {t("market.mine.cancel")}
            </KeycapButton>
          </div>
        </div>
      ) : null}
      <MarketTxStatus phase={tx.phase} />
      <p className="fd-field__hint">{t("market.mine.delistNote")}</p>
    </div>
  );
}

// ---------------------------------------------------------------- the window

export interface MarketModalProps {
  onClose: () => void;
  /** Live reads for the connected account (NEAR balance for the buy confirm). */
  info?: AccountInfo;
  /** Called after a transaction is confirmed by the views: `ok` true means the game views should refresh. */
  onDone?: (ok: boolean, txHash?: string | null) => void;
  /** Chain reader; injectable for tests. */
  view?: ChainView;
}

export function MarketModal({ onClose, info = EMPTY_ACCOUNT_INFO, onDone, view = chainView }: MarketModalProps) {
  const { t } = useT();
  const idBase = useId();
  const wallet = useWallet();
  const accountId = wallet.status === "connected" ? wallet.accountId : null;
  const [tab, setTab] = useState<MarketTab>("browse");
  const [version, setVersion] = useState(0);
  const tx = useMarketTx(wallet, view, onDone, useCallback(() => setVersion((v) => v + 1), []));
  const props: TabProps = { view, accountId, info, tx, version };

  // A transaction in flight keeps its tab; a finished one is cleared when the player moves on.
  const changeTab = (next: MarketTab) => {
    if (tx.busy) return;
    tx.reset();
    setTab(next);
  };

  return (
    <Modal
      title={t("market.title")}
      heading={t("market.heading")}
      size="lg"
      onClose={onClose}
      testId="market-modal"
      footer={
        <>
          <span>{t("market.modal.footer", { market: MARKET_ID, contract: CONTRACT_ID })}</span>
          <Tag>testnet</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <p className="fd-note" data-testid="market-note">
          <Icon name="warn" /> <strong>{t("market.modal.noteTitle")}</strong>
          {t("market.modal.note")}
        </p>
        <Tabs label={t("market.tabs.label")} idBase={idBase} tabs={tabsFor(t)} value={tab} onChange={changeTab} />
        <TabPanel idBase={idBase} id={tab}>
          {tab === "browse" ? <BrowseTab {...props} /> : null}
          {tab === "sell" ? <SellTab {...props} /> : null}
          {tab === "mine" ? <MineTab {...props} /> : null}
        </TabPanel>
      </div>
    </Modal>
  );
}

export default MarketModal;
