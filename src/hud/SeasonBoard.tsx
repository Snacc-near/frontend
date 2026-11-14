/**
 * Season XP board and hall of fame (UI-154), the "season xp" tab of the leaderboard window. A season is a
 * Monday-to-Monday week in UTC; the board ranks players by the XP of that week (`season_leaderboard_snacc`),
 * "All time" ranks total XP (`player_xp_snacc`), and the hall of fame lists the top three of every finished
 * season (`hall_of_fame_snacc`). All numbers come from recorded activity; XP and ranks are cosmetic and off-chain.
 *
 * UI-161 phase B3: text comes from the `social.season` dictionary.
 */
import { useEffect, useId, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allTimeBoard, hallOfFame, seasonBoard } from "../account/api.ts";
import { groupHallOfFame, seasonEndMs, seasonOf, type HallRow, type HallSeason, type SeasonScope } from "../account/quests.ts";
import { tEn, type Translate } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";
import { countdownText, seasonOptionsText, seasonRangeText } from "../i18n/socialText.ts";
import { Empty, Field, Select } from "../ui/controls.tsx";
import { PlayerName, useLevels, useNames } from "./PlayerBoards.tsx";
import { useNow } from "./XpWidgets.tsx";

export interface BoardRow {
  account: string;
  xp: number;
  detail: string;
}

const plural = (t: Translate, n: number, one: "social.season.actionOne" | "social.season.questOne", many: "social.season.actionMany" | "social.season.questMany") =>
  t(n === 1 ? one : many, { n: n.toLocaleString("en-US") });
/** "3 actions · 1 quest"; English unless a translator is passed. */
export const rowDetail = (actions: number, quests: number, t: Translate = tEn) =>
  `${plural(t, actions, "social.season.actionOne", "social.season.actionMany")} · ${plural(t, quests, "social.season.questOne", "social.season.questMany")}`;

/** Which week is shown, and how long it still runs. */
export function SeasonHeader({ scope, nowMs }: { scope: SeasonScope; nowMs: number }) {
  const { t, locale } = useT();
  if (scope === "all") {
    return (
      <p className="fd-sub" data-testid="season-header">
        {t("social.season.allTime")}
      </p>
    );
  }
  const running = seasonOf(nowMs) === scope;
  return (
    <p className="fd-sub" data-testid="season-header">
      {t("social.season.header", { n: scope, range: seasonRangeText(t, locale, scope) })}{" "}
      <span data-testid="season-countdown">{running ? t("social.season.endsIn", { time: countdownText(t, seasonEndMs(scope) - nowMs) }) : t("social.season.finished")}</span>
    </p>
  );
}

/** Ranked rows with names and levels. */
export function SeasonRows({ rows, names, levels, label }: { rows: readonly BoardRow[]; names: ReadonlyMap<string, string>; levels: ReadonlyMap<string, number>; label: string }) {
  const { t } = useT();
  return (
    <ol className="fd-list" aria-label={label} data-testid="board-season">
      {rows.map((r, i) => (
        <li key={r.account} className="fd-row" data-first={i === 0 ? "" : undefined}>
          <span className="fd-list__rank" aria-hidden="true">
            {i + 1}
          </span>
          <PlayerName account={r.account} username={names.get(r.account) ?? null} level={levels.get(r.account)} />
          <span className="fd-num feast-amount">
            {t("social.xpAmount", { n: r.xp.toLocaleString("en-US") })} <span className="fd-sub">{r.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Top three of each finished season, newest first. */
export function HallOfFame({ seasons, names, levels }: { seasons: readonly HallSeason[]; names: ReadonlyMap<string, string>; levels: ReadonlyMap<string, number> }) {
  const { t, locale } = useT();
  if (seasons.length === 0) {
    return <Empty icon="podium">{t("social.season.hallEmpty")}</Empty>;
  }
  return (
    <div className="fd-stack" data-testid="hall-of-fame">
      {seasons.map((s) => (
        <section key={s.season} className="fd-stack" aria-label={t("social.season.hallSeason", { n: s.season })} data-testid="hall-season">
          <h5 className="fd-h">
            {t("social.season.seasonN", { n: s.season })} <span className="fd-sub">{seasonRangeText(t, locale, s.season)}</span>
          </h5>
          <ol className="fd-list" aria-label={t("social.season.hallTop", { n: s.season })}>
            {s.top.map((r: HallRow) => (
              <li key={r.user_id} className="fd-row" data-first={r.rank === 1 ? "" : undefined}>
                <span className="fd-list__rank" aria-hidden="true">
                  {r.rank}
                </span>
                <PlayerName account={r.near_account_id} username={names.get(r.near_account_id) ?? null} level={levels.get(r.near_account_id)} />
                <span className="fd-num feast-amount">{t("social.xpAmount", { n: r.xp.toLocaleString("en-US") })}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

type Loaded<T> = T | null | "error";

export function SeasonBoardPanel({ client, only }: { client: SupabaseClient | null; only: Set<string> | null }) {
  const { t } = useT();
  const now = useNow(30_000);
  const current = seasonOf(now);
  const [scope, setScope] = useState<SeasonScope>(current >= 1 ? current : "all");
  const [rows, setRows] = useState<Loaded<BoardRow[]>>(null);
  const [hall, setHall] = useState<Loaded<HallSeason[]>>(null);
  const selectId = useId();

  useEffect(() => {
    if (!client) return;
    let alive = true;
    void hallOfFame(client)
      .then((r) => alive && setHall(groupHallOfFame(r)))
      .catch(() => alive && setHall("error"));
    return () => {
      alive = false;
    };
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    setRows(null);
    const load =
      scope === "all"
        ? allTimeBoard(client).then((r) => r.map((x): BoardRow => ({ account: x.near_account_id, xp: x.total_xp, detail: rowDetail(x.actions, x.quests_completed, t) })))
        : seasonBoard(client, scope).then((r) => r.map((x): BoardRow => ({ account: x.near_account_id, xp: x.xp, detail: rowDetail(x.actions, x.quests_completed, t) })));
    void load.then((r) => alive && setRows(r)).catch(() => alive && setRows("error"));
    return () => {
      alive = false;
    };
  }, [client, scope, t]);

  const shown = Array.isArray(rows) ? rows.filter((r) => !only || only.has(r.account)).slice(0, 10) : [];
  const hallSeasons = Array.isArray(hall) ? hall : [];
  const accounts = [...shown.map((r) => r.account), ...hallSeasons.flatMap((s) => s.top.map((top) => top.near_account_id))];
  const names = useNames(client, accounts);
  const levels = useLevels(client, accounts);
  const options = seasonOptionsText(t, current, hallSeasons.map((s) => s.season));

  return (
    <div className="fd-stack" data-testid="season-panel">
      <Field id={selectId} label={t("social.season.field")}>
        <Select id={selectId} value={String(scope)} onChange={(e) => setScope(e.target.value === "all" ? "all" : Number(e.target.value))} data-testid="season-select">
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <SeasonHeader scope={scope} nowMs={now} />
      {rows === null ? (
        <Empty icon="eye">{t("social.season.reading")}</Empty>
      ) : rows === "error" ? (
        <Empty icon="warn">{t("social.season.dbDown")}</Empty>
      ) : shown.length === 0 ? (
        <Empty icon="podium">{only ? t("social.season.noFollow") : scope === "all" ? t("social.season.noXpAll") : t("social.season.noXpSeason")}</Empty>
      ) : (
        <SeasonRows rows={shown} names={names} levels={levels} label={scope === "all" ? t("social.season.labelAll") : t("social.season.labelSeason", { n: scope })} />
      )}
      <p className="fd-field__hint">{t("social.season.note")}</p>

      <section className="fd-stack" aria-labelledby={`${selectId}-hof`}>
        <h4 id={`${selectId}-hof`} className="fd-h">
          {t("social.season.hof")}
        </h4>
        {hall === null ? (
          <Empty icon="eye">{t("social.season.hofReading")}</Empty>
        ) : hall === "error" ? (
          <Empty icon="warn">{t("social.season.hofError")}</Empty>
        ) : (
          <HallOfFame seasons={hallSeasons} names={names} levels={levels} />
        )}
      </section>
    </div>
  );
}
