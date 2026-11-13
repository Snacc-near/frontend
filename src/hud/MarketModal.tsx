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
import { Modal } from "../ui/Modal.tsx";
import { Empty, ExtLink, Field, Input, KeycapButton, Select, TabPanel, Tabs, type TabDef } from "../ui/controls.tsx";
import { Icon, Tag } from "../ui/fd.tsx";
import { FaucetLine, TxStatusView, type TxPhase } from "./ChainActions.tsx";

const fmt = (n: number) => n.toLocaleString("en-US");
const RPC_DOWN = "The testnet RPC did not answer (test.rpc.fastnear.com and rpc.testnet.near.org). Nothing is shown in its place.";

export type MarketTab = "browse" | "sell" | "mine";
const TABS: readonly TabDef<MarketTab>[] = [
  { id: "browse", label: "Browse", icon: "grid" },
  { id: "sell", label: "Sell", icon: "cell" },
  { id: "mine", label: "My listings", icon: "user" },
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

const SETTLED_TEXT: Record<Expectation["kind"], (e: Expectation) => string> = {
  listed: (e) => `Snacc #${e.tokenId} is listed${"priceYocto" in e ? ` for ${priceLabel(e.priceYocto)}` : ""}.`,
  repriced: (e) => `Snacc #${e.tokenId} now costs ${"priceYocto" in e ? priceLabel(e.priceYocto) : "the new price"}.`,
  delisted: (e) => `Snacc #${e.tokenId} is back in your collection.`,
  bought: (e) => `Snacc #${e.tokenId} is yours now.`,
};

const TxLink = ({ hash }: { hash: string | null }) =>
  hash ? (
    <>
      tx <ExtLink href={explorerTx(hash)}>{`${hash.slice(0, 10)}…`}</ExtLink>
    </>
  ) : (
    <>The wallet did not return a transaction hash.</>
  );

/** Pending, failure and success lines; a success is only "done" once the views confirm it. */
export function MarketTxStatus({ phase }: { phase: MarketPhase }) {
  if (phase.kind === "checking") {
    return (
      <p className="fd-note" role="status" data-testid="market-checking">
        <strong>Transaction sent.</strong> Checking the market for the result…
      </p>
    );
  }
  if (phase.kind === "settled") {
    if (phase.outcome === "confirmed") {
      return (
        <div className="fd-note" role="status" data-testid="market-confirmed">
          <strong>Done on testnet.</strong> {SETTLED_TEXT[phase.exp.kind](phase.exp)} <TxLink hash={phase.txHash} />
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

const hintFor = (row: MarketRow): string | null => {
  if (!row.vessel) return null;
  const h = healthOf(row.vessel.status, row.vessel.effective_vitality);
  return h === "starving" || h === "distressed" ? h : null;
};

/** One listing: thumbnail, id, vitality, generation, seller and price; `children` are the action keys. */
export function ListingRow({ row, showSeller = true, children }: { row: MarketRow; showSeller?: boolean; children?: ReactNode }) {
  const { listing, vessel, mediaSrc } = row;
  const hint = hintFor(row);
  const eff = vessel?.effective_vitality ?? 0;
  const pct = Math.min(100, Math.max(0, (eff / VITALITY_MAX) * 100));
  return (
    <li className="mkt-row" data-testid={`market-row-${listing.tokenId}`}>
      {mediaSrc ? (
        <img className="coll-thumb" src={mediaSrc} alt={`on-chain svg of strain ${listing.tokenId}`} loading="lazy" />
      ) : (
        <span className="coll-thumb coll-thumb--none" role="img" aria-label={`no valid on-chain svg for strain ${listing.tokenId}`}>
          no svg
        </span>
      )}
      <span className="coll-main">
        <span className="fd-row" style={{ gap: 6 }}>
          <span className="coll-id">strain #{listing.tokenId}</span>
          {vessel ? <Tag>{vessel.status}</Tag> : null}
          {hint ? <span className="coll-flag">{hint}</span> : null}
        </span>
        {vessel ? (
          <span className="coll-vit">
            <span
              className="fd-meter"
              role="meter"
              aria-label={`effective vitality of strain ${listing.tokenId}`}
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
          <span className="fd-field__hint">strain details could not be read this time</span>
        )}
        <span className="mkt-meta">
          {vessel ? `generation ${vessel.generation}` : "generation —"}
          {showSeller ? (
            <>
              {" · seller "}
              <ExtLink href={explorerAccount(listing.sellerId)}>{listing.sellerId}</ExtLink>
            </>
          ) : null}
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
        <strong>Confirm: buy Snacc #{listing.tokenId}.</strong> Testnet only: testnet NEAR and Snaccs have no money value, and this is a demo market. The
        Snacc moves to <code>{accountId ?? "you"}</code> with its whole state (stomach $SNACC, inventory), like a normal transfer.
      </p>
      <dl className="fd-kv" data-testid="market-buy-cost">
        <div className="fd-kv__row">
          <dt>you attach</dt>
          <dd className="fd-kv__num">
            {yoctoToNear(listing.priceYocto)} NEAR <code>({listing.priceYocto} yoctoNEAR)</code>
          </dd>
        </div>
        <div className="fd-kv__row">
          <dt>goes to the seller</dt>
          <dd className="fd-kv__num">
            <code>{listing.sellerId}</code>, the full price (market fee 0%)
          </dd>
        </div>
        <div className="fd-kv__row">
          <dt>gas, at most</dt>
          <dd className="fd-kv__num">{`${yoctoToNear(gas)} NEAR (unused gas is refunded)`}</dd>
        </div>
        <div className="fd-kv__row">
          <dt>your NEAR</dt>
          <dd className="fd-kv__num">{info.nearYocto === null ? "—" : priceLabel(info.nearYocto)}</dd>
        </div>
        {vessel ? (
          <div className="fd-kv__row">
            <dt>this Snacc</dt>
            <dd className="fd-kv__num">{`${vessel.status}, vitality ${fmt(vessel.effective_vitality)} / ${fmt(VITALITY_MAX)}, generation ${vessel.generation}`}</dd>
          </div>
        ) : null}
      </dl>
      {hungry ? (
        <p className="fd-field__hint fd-field__hint--bad" role="status">
          This Snacc is {hungry}: its vitality keeps falling until it is fed, and a starving Snacc can be snacked by others.
        </p>
      ) : null}
      <p className="fd-field__hint">
        If the Snacc cannot be transferred (it died, or someone else bought it at the same moment) the market refunds the full price; only gas is spent.
      </p>
      <FaucetLine needYocto={need} info={info} />
      <MarketTxStatus phase={phase} />
      <div className="fd-row">
        {done ? (
          <KeycapButton variant="primary" icon="check" onClick={onBack}>
            back to the list
          </KeycapButton>
        ) : (
          <>
            <KeycapButton variant="primary" icon="spark" disabled={blocked !== null || busy} onClick={onConfirm} data-testid="market-buy-sign">
              {busy ? "waiting…" : "sign and buy"}
            </KeycapButton>
            <KeycapButton mono onClick={onBack} disabled={busy}>
              back
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
    RPC_DOWN,
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
          {total === null ? "listings" : `${fmt(total)} open listing${total === 1 ? "" : "s"}`}
        </span>
        <KeycapButton mono icon="ring" onClick={reload} disabled={state.kind === "loading"}>
          refresh
        </KeycapButton>
      </div>
      {state.kind === "loading" ? <Empty icon="eye">reading get_listings, get_strain and nft_token…</Empty> : null}
      {state.kind === "error" ? (
        <Empty icon="warn">
          <div className="fd-stack" style={{ justifyItems: "center" }}>
            <span data-testid="market-error">{state.message}</span>
            <KeycapButton mono icon="ring" onClick={reload}>
              retry
            </KeycapButton>
          </div>
        </Empty>
      ) : null}
      {state.kind === "ok" && state.data.rows.length === 0 ? (
        <Empty icon="cell">
          <span data-testid="market-empty">No Snacc is listed right now.</span>
          <br />
          Use the Sell tab to list one of yours.
        </Empty>
      ) : null}
      {state.kind === "ok" && state.data.rows.length > 0 ? (
        <>
          <ListingList
            rows={state.data.rows}
            label="open listings"
            actions={(row) => {
              const blocked = buyBlockReason(row, accountId);
              return (
                <KeycapButton mono icon="spark" disabled={blocked !== null} title={blocked ?? undefined} onClick={() => setBuying(row)} data-testid={`market-buy-${row.listing.tokenId}`}>
                  buy
                </KeycapButton>
              );
            }}
          />
          {pages > 1 ? (
            <div className="fd-row fd-row--between" role="group" aria-label="pages">
              <KeycapButton mono disabled={page === 0} onClick={() => setPage(page - 1)}>
                previous
              </KeycapButton>
              <span className="fd-sub" data-testid="market-page">{`page ${page + 1} of ${pages}`}</span>
              <KeycapButton mono disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                next
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
  const uid = useId();
  const { state } = useLoad<{ items: CollectionItem[]; open: number }>(
    async (signal) => {
      if (!accountId) return null;
      const [coll, mine] = await Promise.all([fetchCollection(accountId, signal), fetchSellerListings(accountId, view, signal)]);
      if (coll.kind !== "ok" || mine === null) return null;
      return { items: sellableItems(coll.data.items), open: mine.length };
    },
    [accountId, version, view],
    RPC_DOWN,
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const items = state.kind === "ok" ? state.data.items : [];
  const open = state.kind === "ok" ? state.data.open : 0;
  const chosen = items.find((i) => i.strainId === picked) ?? items[0] ?? null;
  const check = checkPrice(price);
  const full = open >= MAX_LISTINGS_PER_SELLER;

  if (!accountId) return <Empty icon="user">Connect a wallet to sell. Browsing is open to everyone.</Empty>;
  if (state.kind === "loading") return <Empty icon="eye">{`reading ${accountId}'s Snaccs and listings…`}</Empty>;
  if (state.kind === "error") return <Empty icon="warn">{state.message}</Empty>;
  if (items.length === 0) {
    return (
      <Empty icon="cell">
        <span data-testid="market-sell-empty">You have no living Snacc to list.</span>
        <br />
        A Snacc that has died cannot be listed. Hatch one first.
      </Empty>
    );
  }

  const built = chosen && check.ok ? buildList({ strainId: chosen.strainId, priceYocto: check.yocto }) : null;
  const canSign = built !== null && !full && !tx.busy && !(tx.phase.kind === "settled" && tx.phase.outcome === "confirmed");
  return (
    <div className="fd-stack" data-testid="market-sell">
      <div className="fd-form-grid">
        <Field id={`${uid}-snacc`} label="your snacc">
          <Select id={`${uid}-snacc`} value={chosen?.strainId ?? ""} onChange={(e) => setPicked(Number(e.target.value))} disabled={tx.busy}>
            {items.map((i) => (
              <option key={i.strainId} value={i.strainId}>
                {`#${i.strainId} · vitality ${fmt(i.effectiveVitality)} · generation ${i.generation} · ${i.status}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={`${uid}-price`}
          label="price (NEAR)"
          bad={price.trim() !== "" && !check.ok}
          hint={check.ok ? `${yoctoToNear(check.yocto)} NEAR, the buyer pays this much and you get all of it (fee 0%)` : price.trim() === "" ? `up to ${Number(MAX_PRICE_NEAR).toLocaleString("en-US")} NEAR` : check.reason}
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
      {chosen?.mediaSrc ? <img className="coll-thumb" src={chosen.mediaSrc} alt={`on-chain svg of strain ${chosen.strainId}`} /> : null}
      <p className="fd-note">
        <strong>The Snacc leaves your account while it is listed.</strong> It moves to <code>{MARKET_ID}</code> with its whole state (stomach $SNACC,
        inventory) and moves on to the buyer the same way, like a normal transfer. It keeps getting hungry while listed. You can take it back any time
        with the My listings tab.
      </p>
      <dl className="fd-kv">
        <div className="fd-kv__row">
          <dt>you attach</dt>
          <dd className="fd-kv__num">1 yoctoNEAR (the market pays the listing storage)</dd>
        </div>
        <div className="fd-kv__row">
          <dt>gas, at most</dt>
          <dd className="fd-kv__num">{built ? `${yoctoToNear(maxGasFeeYocto([built.call]))} NEAR (unused gas is refunded)` : "—"}</dd>
        </div>
        <div className="fd-kv__row">
          <dt>your open listings</dt>
          <dd className="fd-kv__num">{`${open} of ${MAX_LISTINGS_PER_SELLER}`}</dd>
        </div>
      </dl>
      {full ? <p className="fd-field__hint fd-field__hint--bad">You already have {MAX_LISTINGS_PER_SELLER} open listings, the most one account can have.</p> : null}
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
          {tx.busy ? "waiting…" : "sign and list for sale"}
        </KeycapButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- My listings

function MineTab({ view, accountId, tx, version }: TabProps) {
  const { state, reload } = useLoad<MarketRow[]>(
    async (signal) => {
      if (!accountId) return null;
      const mine = await fetchSellerListings(accountId, view, signal);
      return mine === null ? null : enrichListings(mine, view, signal);
    },
    [accountId, version, view],
    RPC_DOWN,
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

  if (!accountId) return <Empty icon="user">Connect a wallet to see and manage your listings.</Empty>;
  return (
    <div className="fd-stack" data-testid="market-mine">
      <div className="fd-row fd-row--between">
        <span className="fd-sub">
          seller <code>{accountId}</code>
        </span>
        <KeycapButton mono icon="ring" onClick={reload} disabled={state.kind === "loading" || tx.busy}>
          refresh
        </KeycapButton>
      </div>
      {state.kind === "loading" ? <Empty icon="eye">reading get_listings_by_seller…</Empty> : null}
      {state.kind === "error" ? <Empty icon="warn">{state.message}</Empty> : null}
      {state.kind === "ok" && state.data.length === 0 ? (
        <Empty icon="cell">
          <span data-testid="market-mine-empty">You have no open listing.</span>
        </Empty>
      ) : null}
      {state.kind === "ok" && state.data.length > 0 ? (
        <ListingList
          rows={state.data}
          label="your open listings"
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
                  change price
                </KeycapButton>
                <KeycapButton
                  mono
                  icon="close"
                  disabled={tx.busy || dead}
                  title={dead ? "this Snacc has died and cannot be transferred back" : undefined}
                  onClick={() => {
                    setEditing(null);
                    void tx.run(buildDelist({ tokenId: row.listing.tokenId }), { kind: "delisted", tokenId: row.listing.tokenId, sellerId: accountId });
                  }}
                  data-testid={`market-delist-${row.listing.tokenId}`}
                >
                  delist
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
            label={`new price for #${editing} (NEAR)`}
            bad={!check.ok}
            hint={check.ok ? `${yoctoToNear(check.yocto)} NEAR, changed with 1 yoctoNEAR and gas only` : check.reason}
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
              sign the new price
            </KeycapButton>
            <KeycapButton mono onClick={() => setEditing(null)} disabled={tx.busy}>
              cancel
            </KeycapButton>
          </div>
        </div>
      ) : null}
      <MarketTxStatus phase={tx.phase} />
      <p className="fd-field__hint">Delisting sends the Snacc back to you with its whole state. A Snacc that died while listed cannot be moved by the contract at all.</p>
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
      title="market.idx"
      heading="Market"
      size="lg"
      onClose={onClose}
      testId="market-modal"
      footer={
        <>
          <span>
            market {MARKET_ID} · Snaccs {CONTRACT_ID} · testnet NEAR has no money value
          </span>
          <Tag>testnet</Tag>
        </>
      }
    >
      <div className="fd-stack">
        <p className="fd-note" data-testid="market-note">
          <Icon name="warn" /> <strong>Testnet demo market.</strong> Testnet NEAR and Snaccs have no money value, and this is not a real exchange. Sellers set
          their own prices; the market takes no fee (0%). A Snacc moves with its whole state (its stomach $SNACC and inventory) when it is sold, like a
          normal transfer.
        </p>
        <Tabs label="market" idBase={idBase} tabs={TABS} value={tab} onChange={changeTab} />
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
