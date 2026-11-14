/**
 * The graveyard (UI-156), a tab of the leaderboard window: every Snacc that died, from `graveyard_snacc` (the backend's chain
 * index of the contract's events, current state generation). Each row shows the Snacc's id and on-chain SVG when the backend can
 * serve it, what killed it in plain words, who did it, when, and the explorer link to the transaction. Filters: all / harvested
 * (starved, then harvested) / spliced (absorbed by a splice or a hostile takeover) / mine (Snaccs the signed-in account owned
 * when they died). The list is a plain read of public chain data; nothing is simulated.
 *
 * UI-161 phase B3: the sentences come from `collection.grave`, `collection.cause` and `collection.ago`.
 * `GRAVE_PENDING` stays the English text for tests and search; the panel reads `collection.grave.pending`.
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GRAVE_FILTERS, countGraves, filterGraves, graveyardRows, type GraveFilter, type GraveRow } from "../account/chain.ts";
import { fetchStrainSvg } from "../data/api.ts";
import { explorerTx } from "../data/nearView.ts";
import { svgToSafeDataUri } from "../data/svg.ts";
import { agoText } from "../i18n/ago.ts";
import { translator, type Translate } from "../i18n/catalog.ts";
import { getLocale } from "../i18n/index.ts";
import { useT } from "../i18n/react.tsx";
import { Empty, ExtLink, KeycapButton } from "../ui/controls.tsx";
import "../account/account.css";
import "./collection.css";

export const GRAVE_PAGE = 10;
export const GRAVE_PENDING = "The graveyard fills once the chain index has caught up with the contract's history.";

/** What happened, in plain words, in the reader's language. */
export function causeText(t: Translate, row: GraveRow): string {
  const by = row.by_account !== null && row.by_account !== "" ? row.by_account : t("collection.cause.someone");
  switch (row.cause) {
    case "harvested_starving":
      return t("collection.cause.starved", { by });
    case "spliced_burned":
      return row.absorbed_into !== null ? t("collection.cause.splicedInto", { into: row.absorbed_into, by }) : t("collection.cause.splicedAway", { by });
    case "hostile_takeover":
      return row.absorbed_into !== null ? t("collection.cause.takeoverInto", { into: row.absorbed_into, by }) : t("collection.cause.takeover", { by });
  }
}

/**
 * What one row's thumbnail shows: the image when there is a `src`, the plain "no svg" tile otherwise. `onImageError` fires when the
 * browser cannot decode the image; the caller then drops `src`, so a row never keeps a broken-image icon.
 */
export function GraveThumbView({
  strainId,
  src,
  onImageError,
  t = translator(getLocale()),
}: {
  strainId: number;
  src: string | null;
  onImageError?: () => void;
  /** The reader's translator; `GraveThumb` passes its own, a bare call follows the saved language. */
  t?: Translate;
}) {
  return src ? (
    <img className="grave-thumb" src={src} alt={t("market.row.svgAlt", { id: strainId })} loading="lazy" onError={onImageError} />
  ) : (
    <span className="grave-thumb" role="img" aria-label={t("collection.grave.noSvgLabel", { id: strainId })}>
      {t("market.row.noSvg")}
    </span>
  );
}

/**
 * The Snacc's on-chain SVG when the backend serves one (loaded lazily, one request per visible row), a plain tile otherwise: no SVG
 * from the backend, an SVG that does not validate, or an image the browser fails to load (`onError`).
 */
export function GraveThumb({ strainId }: { strainId: number }) {
  const { t } = useT();
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
  return <GraveThumbView strainId={strainId} src={src} onImageError={() => setSrc(null)} t={t} />;
}

export function GraveyardList({ rows, nowMs }: { rows: readonly GraveRow[]; nowMs: number }) {
  const { t } = useT();
  return (
    <ul className="fd-list" aria-label={t("collection.grave.listLabel")} data-testid="graveyard-list">
      {rows.map((r) => (
        <li key={`${r.tx_hash}-${r.strain_id}`} className="grave-row" data-testid={`grave-${r.strain_id}`}>
          <GraveThumb strainId={r.strain_id} />
          <span className="grave-row__main">
            <span className="grave-row__id">{t("market.row.strain", { id: r.strain_id })}</span>
            <span className="grave-row__text">{causeText(t, r)}</span>
            <span className="grave-row__meta">
              <span>{r.owner_before ? t("collection.grave.ownedBy", { owner: r.owner_before }) : t("collection.grave.ownerUnknown")}</span>
              <time dateTime={r.block_time} title={r.block_time}>
                {agoText(t, r.block_time, nowMs)}
              </time>
              <ExtLink href={explorerTx(r.tx_hash)}>{t("market.tx.prefix")}</ExtLink>
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
  const { t } = useT();
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
          {t("collection.grave.demoNote")}
        </p>
      ) : null}
      <div className="coll-filters" role="group" aria-label={t("collection.grave.filterLabel")}>
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
            {t(`collection.grave.filters.${f.id}`)} ({counts[f.id]})
          </KeycapButton>
        ))}
      </div>
      {rows === null ? (
        <Empty icon="eye">{t("collection.grave.reading")}</Empty>
      ) : rows === "error" ? (
        <Empty icon="warn">{t("collection.grave.dbDown")}</Empty>
      ) : all.length === 0 ? (
        <Empty icon="ring">{t("collection.grave.pending")}</Empty>
      ) : filtered.length === 0 ? (
        <Empty icon="ring">
          {filter === "mine"
            ? account
              ? t("collection.grave.noneMine", { account })
              : t("collection.grave.signIn")
            : t("collection.grave.noMatch")}
        </Empty>
      ) : (
        <>
          <GraveyardList rows={visible} nowMs={Date.now()} />
          {filtered.length > visible.length ? (
            <KeycapButton mono onClick={() => setShownCount((n) => n + GRAVE_PAGE)} data-testid="graveyard-more">
              {t("collection.grave.more", { n: Math.min(GRAVE_PAGE, filtered.length - visible.length) })}
            </KeycapButton>
          ) : null}
        </>
      )}
      <p className="fd-field__hint">{t("collection.grave.footer")}</p>
    </div>
  );
}
