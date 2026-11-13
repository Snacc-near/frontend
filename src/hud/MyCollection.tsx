/**
 * My collection: every Snacc an account owns, read from the testnet contract views
 * (`nft_tokens_for_owner`, `get_colony`, `get_strain`). Filters, a hunger warning and the Strain
 * Detail window per strain. Nothing here is simulated, in demo mode too: the window says so.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import "./collection.css";
import type { GameMode, SkinMode } from "../config/constants.ts";
import { VITALITY_MAX } from "../config/constants.ts";
import {
  DISTRESS_MAX_EFFECTIVE_VITALITY,
  FILTERS,
  SORTS,
  countByFilter,
  fetchCollection,
  fetchVessel,
  filterItems,
  hungerMessage,
  hungerSummary,
  isValidAccountId,
  normalizeAccount,
  sortItems,
  type CollectionData,
  type CollectionFilter,
  type CollectionItem,
  type CollectionSort,
} from "../data/collection.ts";
import { CONTRACT_ID } from "../data/nearView.ts";
import type { StrainDetail } from "../data/types.ts";
import { Modal } from "../ui/Modal.tsx";
import { Empty, Field, KeycapButton, Select } from "../ui/controls.tsx";
import { Icon, Tag } from "../ui/fd.tsx";
import { StrainDetailModal } from "./StrainDetailModal.tsx";
import type { GameActionKey } from "./GameActions.tsx";
import { useWallet } from "../chain/wallet.tsx";

export interface MyCollectionProps {
  /** The account whose collection is shown: the wallet account, or the one typed in the highlight field. */
  accountId: string | null;
  skin?: SkinMode;
  mode?: GameMode;
  onClose: () => void;
  /** Opens the signed feed for a strain the connected wallet owns (`feed_strain`). */
  onFeedStrain?: (strainId: number) => void;
  /** UI-150: opens another signed action (allocate, divide, produce, give…) for an owned strain. */
  onStrainAction?: (key: GameActionKey, strainId: number) => void;
  /** Bumped by the app after a signed action succeeds: the list is read again. */
  refreshKey?: number;
}

type LoadState =
  | { kind: "none" }
  | { kind: "invalid"; account: string }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: CollectionData };

const TYPING_DELAY_MS = 300;

function initialState(account: string | null): LoadState {
  if (!account) return { kind: "none" };
  return isValidAccountId(account) ? { kind: "loading" } : { kind: "invalid", account };
}

function useCollection(account: string | null): { state: LoadState; reload: () => void } {
  const [state, setState] = useState<LoadState>(() => initialState(account));
  const [nonce, setNonce] = useState(0);
  const retrying = useRef(false);

  useEffect(() => {
    const first = initialState(account);
    setState(first);
    if (first.kind !== "loading" || !account) return;
    const ac = new AbortController();
    // Typing in the highlight field changes the account on every key: wait for a pause, but not on refresh.
    const delay = retrying.current ? 0 : TYPING_DELAY_MS;
    retrying.current = false;
    const timer = window.setTimeout(() => {
      void fetchCollection(account, ac.signal).then((res) => {
        if (ac.signal.aborted) return;
        setState(res.kind === "ok" ? { kind: "ok", data: res.data } : { kind: "error", message: res.message });
      });
    }, delay);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [account, nonce]);

  const reload = useCallback(() => {
    retrying.current = true;
    setNonce((n) => n + 1);
  }, []);
  return { state, reload };
}

const fmt = (n: number) => n.toLocaleString("en-US");

function hintFor(item: CollectionItem): string | null {
  if (item.health === "starving") return "starving";
  if (item.health === "distressed" && item.status !== "Distressed") return "distressed";
  return null;
}

function Row({ item, onOpen }: { item: CollectionItem; onOpen: (id: number) => void }) {
  const pct = Math.min(100, Math.max(0, (item.effectiveVitality / VITALITY_MAX) * 100));
  const hint = hintFor(item);
  return (
    <li>
      <button type="button" className="coll-row" onClick={() => onOpen(item.strainId)} data-testid={`collection-row-${item.strainId}`} aria-haspopup="dialog">
        {item.mediaSrc ? (
          <img className="coll-thumb" src={item.mediaSrc} alt={`on-chain svg of strain ${item.strainId}`} loading="lazy" />
        ) : (
          <span className="coll-thumb coll-thumb--none" role="img" aria-label={`no valid on-chain svg for strain ${item.strainId}`}>
            no svg
          </span>
        )}
        <span className="coll-main">
          <span className="fd-row" style={{ gap: 6 }}>
            <span className="coll-id">strain #{item.strainId}</span>
            <Tag>{item.status}</Tag>
            {hint ? <span className="coll-flag">{hint}</span> : null}
          </span>
          <span className="coll-vit">
            <span
              className="fd-meter"
              role="meter"
              aria-label={`effective vitality of strain ${item.strainId}`}
              aria-valuemin={0}
              aria-valuemax={VITALITY_MAX}
              aria-valuenow={Math.min(VITALITY_MAX, Math.max(0, item.effectiveVitality))}
            >
              <span className="fd-meter__fill" style={{ transform: `scaleX(${(pct / 100).toFixed(3)})` }} />
            </span>
            <span className="fd-num">
              {fmt(item.effectiveVitality)} / {fmt(VITALITY_MAX)}
            </span>
          </span>
        </span>
        <span className="coll-gen">generation {item.generation}</span>
      </button>
    </li>
  );
}

export function MyCollection({ accountId, skin = "biolab", mode = "live", onClose, onFeedStrain, onStrainAction, refreshKey = 0 }: MyCollectionProps) {
  const uid = useId();
  const account = normalizeAccount(accountId);
  const { state, reload } = useCollection(account);
  const wallet = useWallet();
  const firstRefresh = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== firstRefresh.current) reload();
  }, [refreshKey, reload]);
  const [filter, setFilter] = useState<CollectionFilter>("all");
  const [sort, setSort] = useState<CollectionSort>("vitality-asc");
  const [openId, setOpenId] = useState<number | null>(null);
  const [fresh, setFresh] = useState<StrainDetail | null>(null);

  const data = state.kind === "ok" ? state.data : null;
  const items = data?.items;
  const counts = useMemo(() => countByFilter(items ?? []), [items]);
  const shown = useMemo(() => sortItems(filterItems(items ?? [], filter), sort), [items, filter, sort]);
  const warning = useMemo(() => hungerMessage(hungerSummary(items ?? [])), [items]);
  const opened = openId === null ? null : (items?.find((i) => i.strainId === openId) ?? null);

  // The list is a snapshot; opening a strain reads it again so its effective vitality is current.
  useEffect(() => {
    setFresh(null);
    if (openId === null) return;
    const ac = new AbortController();
    void fetchVessel(openId, ac.signal).then((v) => {
      if (!ac.signal.aborted && v) setFresh(v);
    });
    return () => ac.abort();
  }, [openId]);

  useEffect(() => {
    setOpenId(null);
  }, [account]);

  return (
    <>
      <Modal
        title="my-collection.idx"
        heading="My collection"
        size="lg"
        onClose={onClose}
        testId="collection-modal"
        footer={
          <>
            <span>
              source: nft_tokens_for_owner · get_colony · get_strain on {CONTRACT_ID}
            </span>
            <Tag>live · testnet</Tag>
          </>
        }
      >
        <div className="fd-stack">
          {mode === "demo" ? (
            <p className="fd-note" data-testid="collection-demo-note">
              Demo mode is on: the dish behind this window is simulated, but this list is not. Every number here is read from the testnet contract.
            </p>
          ) : null}

          {state.kind === "none" ? (
            <Empty icon="user">
              Connect a wallet or type an account to see its collection.
              <br />
              Type it in the highlight account field, then open this window again.
            </Empty>
          ) : (
            <div className="fd-row fd-row--between">
              <span className="fd-sub">
                account <code>{account}</code>
              </span>
              <KeycapButton mono icon="ring" onClick={reload} disabled={state.kind === "loading" || state.kind === "invalid"}>
                refresh
              </KeycapButton>
            </div>
          )}

          {state.kind === "invalid" ? (
            <Empty icon="warn">
              “{state.account}” is not a valid NEAR account id (lowercase letters, digits, “-”, “_” and “.”; 2 to 64 characters). Nothing was requested.
            </Empty>
          ) : null}

          {state.kind === "loading" ? <Empty icon="eye">{`reading nft_tokens_for_owner, get_colony and get_strain for ${account}…`}</Empty> : null}

          {state.kind === "error" ? (
            <Empty icon="warn">
              <div className="fd-stack" style={{ justifyItems: "center" }}>
                <span data-testid="collection-error">{state.message}</span>
                <KeycapButton mono icon="ring" onClick={reload}>
                  retry
                </KeycapButton>
              </div>
            </Empty>
          ) : null}

          {data && data.items.length === 0 && data.unresolved.length === 0 ? (
            <Empty icon="cell">
              <span data-testid="collection-empty">{account} owns no Snacc yet (nft_tokens_for_owner returned an empty list).</span>
              <br />
              Hatch your first Snacc with the Hatch action to start a collection.
            </Empty>
          ) : null}

          {data && (data.items.length > 0 || data.unresolved.length > 0) ? (
            <>
              {warning ? (
                <p className="coll-banner" role="status" data-testid="collection-hunger">
                  <Icon name="warn" />
                  <span>{warning}</span>
                </p>
              ) : null}

              <div className="coll-controls">
                <div>
                  <div className="coll-filters" role="group" aria-label="filter the collection">
                    {FILTERS.map((f) => (
                      <KeycapButton key={f} mono aria-pressed={filter === f} onClick={() => setFilter(f)} data-testid={`collection-filter-${f}`}>
                        {f} ({counts[f]})
                      </KeycapButton>
                    ))}
                  </div>
                </div>
                <Field id={`${uid}-sort`} label="sort">
                  <Select id={`${uid}-sort`} value={sort} onChange={(e) => setSort(e.target.value as CollectionSort)}>
                    {SORTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <p className="fd-field__hint">
                {`hungry: alive, with effective vitality at or below ${fmt(DISTRESS_MAX_EFFECTIVE_VITALITY)} (the contract’s Distressed band); 0 is starving. Bars show effective vitality, after hunger decay.`}
              </p>

              {shown.length === 0 ? (
                <Empty icon="search">No Snacc matches the “{filter}” filter.</Empty>
              ) : (
                <ul className="fd-list coll-list" aria-label="owned snaccs" data-testid="collection-list">
                  {shown.map((item) => (
                    <Row key={item.strainId} item={item} onOpen={setOpenId} />
                  ))}
                </ul>
              )}

              {data.unresolved.length > 0 ? (
                <p className="fd-field__hint fd-field__hint--bad" role="status" data-testid="collection-unresolved">
                  {data.unresolved.length} owned strain{data.unresolved.length === 1 ? "" : "s"} could not be read this time (
                  {data.unresolved.map((id) => `#${id}`).join(", ")}). Refresh to try again.
                </p>
              ) : null}
              {data.truncated ? <p className="fd-field__hint">This account owns more strains than one read covers; the first {fmt(data.items.length + data.unresolved.length)} are listed.</p> : null}
            </>
          ) : null}
        </div>
      </Modal>

      {opened ? (
        <StrainDetailModal
          strain={fresh && fresh.strain_id === opened.strainId ? fresh : opened.detail}
          svgDataUri={opened.mediaSrc}
          svgStatus={opened.mediaSrc ? "ready" : "no-data"}
          svgSource={`from nft_tokens_for_owner on ${CONTRACT_ID}`}
          skin={skin}
          mode="live"
          onClose={() => setOpenId(null)}
          feedEnabled={Boolean(onFeedStrain && wallet.accountId && opened.detail.owner_id === wallet.accountId)}
          feedHint={wallet.accountId ? "only the owner's connected wallet can feed this Snacc" : "connect a wallet to feed"}
          onFeedClick={() => onFeedStrain?.(opened.strainId)}
          onAction={
            onStrainAction && wallet.accountId && opened.detail.owner_id === wallet.accountId ? (key) => onStrainAction(key, opened.strainId) : undefined
          }
        />
      ) : null}
    </>
  );
}

export default MyCollection;
