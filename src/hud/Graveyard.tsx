/**
 * The graveyard (UI-156), a tab of the leaderboard window: every Snacc that died, from `graveyard_snacc` (the backend's chain
 * index of the contract's events, current state generation). Each row shows the Snacc's id and on-chain SVG when the backend can
 * serve it, what killed it in plain words, who did it, when, and the explorer link to the transaction. Filters: all / harvested
 * (starved, then harvested) / spliced (absorbed by a splice or a hostile takeover) / mine (Snaccs the signed-in account owned
 * when they died). The list is a plain read of public chain data; nothing is simulated.
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GRAVE_FILTERS, causeWords, countGraves, filterGraves, graveyardRows, relativeTime, type GraveFilter, type GraveRow } from "../account/chain.ts";
import { fetchStrainSvg } from "../data/api.ts";
import { explorerTx } from "../data/nearView.ts";
import { svgToSafeDataUri } from "../data/svg.ts";
import { Empty, ExtLink, KeycapButton } from "../ui/controls.tsx";
import "../account/account.css";
import "./collection.css";

export const GRAVE_PAGE = 10;
export const GRAVE_PENDING = "The graveyard fills once the chain index has caught up with the contract's history.";

/**
 * What one row's thumbnail shows: the image when there is a `src`, the plain "no svg" tile otherwise. `onImageError` fires when the
 * browser cannot decode the image; the caller then drops `src`, so a row never keeps a broken-image icon.
 */
export function GraveThumbView({ strainId, src, onImageError }: { strainId: number; src: string | null; onImageError?: () => void }) {
  return src ? (
    <img className="grave-thumb" src={src} alt={`on-chain svg of strain ${strainId}`} loading="lazy" onError={onImageError} />
  ) : (
    <span className="grave-thumb" role="img" aria-label={`no on-chain svg for strain ${strainId}`}>
      no svg
    </span>
  );
}

/**
 * The Snacc's on-chain SVG when the backend serves one (loaded lazily, one request per visible row), a plain tile otherwise: no SVG
 * from the backend, an SVG that does not validate, or an image the browser fails to load (`onError`).
 */
export function GraveThumb({ strainId }: { strainId: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    void fetchStrainSvg(strainId).then((r) => {
      if (alive && r.svg) setSrc(svgToSafeDataUri(r.svg));
    });
    return () => {
      alive = false;
    };
  }, [strainId]);
  return <GraveThumbView strainId={strainId} src={src} onImageError={() => setSrc(null)} />;
}

export function GraveyardList({ rows, nowMs }: { rows: readonly GraveRow[]; nowMs: number }) {
  return (
    <ul className="fd-list" aria-label="strains that died" data-testid="graveyard-list">
      {rows.map((r) => (
        <li key={`${r.tx_hash}-${r.strain_id}`} className="grave-row" data-testid={`grave-${r.strain_id}`}>
          <GraveThumb strainId={r.strain_id} />
          <span className="grave-row__main">
            <span className="grave-row__id">strain #{r.strain_id}</span>
            <span className="grave-row__text">{causeWords(r)}</span>
            <span className="grave-row__meta">
              <span>{r.owner_before ? `owned by ${r.owner_before}` : "owner not recorded"}</span>
              <time dateTime={r.block_time} title={r.block_time}>
                {relativeTime(r.block_time, nowMs)}
              </time>
              <ExtLink href={explorerTx(r.tx_hash)}>tx</ExtLink>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

type Rows = GraveRow[] | null | "error";

/** Reads the graveyard once and offers the filters; `account` is the signed-in NEAR account for the "mine" filter. */
export function GraveyardPanel({ client, account, live = true }: { client: SupabaseClient | null; account: string | null; live?: boolean }) {
  const [rows, setRows] = useState<Rows>(null);
  const [filter, setFilter] = useState<GraveFilter>("all");
  const [shownCount, setShownCount] = useState(GRAVE_PAGE);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    void graveyardRows(client)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows("error"));
    return () => {
      alive = false;
    };
  }, [client]);

  const all = Array.isArray(rows) ? rows : [];
  const counts = countGraves(all, account);
  const filtered = filterGraves(all, filter, account);
  const visible = filtered.slice(0, shownCount);

  return (
    <div className="fd-stack" data-testid="graveyard">
      {!live ? (
        <p className="fd-note" data-testid="graveyard-demo-note">
          Demo mode is on, but this list is real testnet history, not a simulation.
        </p>
      ) : null}
      <div className="coll-filters" role="group" aria-label="filter the graveyard">
        {GRAVE_FILTERS.map((f) => (
          <KeycapButton
            key={f.id}
            mono
            aria-pressed={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setShownCount(GRAVE_PAGE);
            }}
            data-testid={`graveyard-filter-${f.id}`}
          >
            {f.label} ({counts[f.id]})
          </KeycapButton>
        ))}
      </div>
      {rows === null ? (
        <Empty icon="eye">reading graveyard_snacc…</Empty>
      ) : rows === "error" ? (
        <Empty icon="warn">The profile database did not answer. Nothing is shown in its place.</Empty>
      ) : all.length === 0 ? (
        <Empty icon="ring">{GRAVE_PENDING}</Empty>
      ) : filtered.length === 0 ? (
        <Empty icon="ring">
          {filter === "mine"
            ? account
              ? `None of the Snaccs ${account} owned has died.`
              : "Sign in or connect a wallet to see the Snaccs you owned."
            : "No Snacc matches this filter."}
        </Empty>
      ) : (
        <>
          <GraveyardList rows={visible} nowMs={Date.now()} />
          {filtered.length > visible.length ? (
            <KeycapButton mono onClick={() => setShownCount((n) => n + GRAVE_PAGE)} data-testid="graveyard-more">
              show {Math.min(GRAVE_PAGE, filtered.length - visible.length)} more
            </KeycapButton>
          ) : null}
        </>
      )}
      <p className="fd-field__hint">
        Read from the chain index of snacc-v001.testnet (testnet only). “mine” lists Snaccs your account owned when they died; the owner is
        shown when the index has seen the Snacc’s creation or last transfer.
      </p>
    </div>
  );
}
