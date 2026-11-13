/**
 * Season XP board and hall of fame (UI-154), the "season xp" tab of the leaderboard window. A season is a
 * Monday-to-Monday week in UTC; the board ranks players by the XP of that week (`season_leaderboard_snacc`),
 * "All time" ranks total XP (`player_xp_snacc`), and the hall of fame lists the top three of every finished
 * season (`hall_of_fame_snacc`). All numbers come from recorded activity; XP and ranks are cosmetic and off-chain.
 */
import { useEffect, useId, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allTimeBoard, hallOfFame, seasonBoard } from "../account/api.ts";
import {
  formatCountdown,
  groupHallOfFame,
  seasonEndMs,
  seasonOf,
  seasonOptions,
  seasonRangeLabel,
  type HallRow,
  type HallSeason,
  type SeasonScope,
} from "../account/quests.ts";
import { Empty, Field, Select } from "../ui/controls.tsx";
import { PlayerName, useLevels, useNames } from "./PlayerBoards.tsx";
import { useNow } from "./XpWidgets.tsx";

export interface BoardRow {
  account: string;
  xp: number;
  detail: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
export const rowDetail = (actions: number, quests: number) => `${plural(actions, "action")} · ${plural(quests, "quest")}`;

/** Which week is shown, and how long it still runs. */
export function SeasonHeader({ scope, nowMs }: { scope: SeasonScope; nowMs: number }) {
  if (scope === "all") {
    return (
      <p className="fd-sub" data-testid="season-header">
        All time · total XP since the first recorded action
      </p>
    );
  }
  const running = seasonOf(nowMs) === scope;
  return (
    <p className="fd-sub" data-testid="season-header">
      Season {scope} · {seasonRangeLabel(scope)} ·{" "}
      <span data-testid="season-countdown">{running ? `ends in ${formatCountdown(seasonEndMs(scope) - nowMs)}` : "finished"}</span>
    </p>
  );
}

/** Ranked rows with names and levels. */
export function SeasonRows({ rows, names, levels, label }: { rows: readonly BoardRow[]; names: ReadonlyMap<string, string>; levels: ReadonlyMap<string, number>; label: string }) {
  return (
    <ol className="fd-list" aria-label={label} data-testid="board-season">
      {rows.map((r, i) => (
        <li key={r.account} className="fd-row" data-first={i === 0 ? "" : undefined}>
          <span className="fd-list__rank" aria-hidden="true">
            {i + 1}
          </span>
          <PlayerName account={r.account} username={names.get(r.account) ?? null} level={levels.get(r.account)} />
          <span className="fd-num feast-amount">
            {r.xp.toLocaleString("en-US")} XP <span className="fd-sub">{r.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Top three of each finished season, newest first. */
export function HallOfFame({ seasons, names, levels }: { seasons: readonly HallSeason[]; names: ReadonlyMap<string, string>; levels: ReadonlyMap<string, number> }) {
  if (seasons.length === 0) {
    return <Empty icon="podium">No season has finished with recorded players yet. The top three of every finished season will be listed here.</Empty>;
  }
  return (
    <div className="fd-stack" data-testid="hall-of-fame">
      {seasons.map((s) => (
        <section key={s.season} className="fd-stack" aria-label={`season ${s.season} hall of fame`} data-testid="hall-season">
          <h5 className="fd-h">
            Season {s.season} <span className="fd-sub">{seasonRangeLabel(s.season)}</span>
          </h5>
          <ol className="fd-list" aria-label={`season ${s.season} top three`}>
            {s.top.map((r: HallRow) => (
              <li key={r.user_id} className="fd-row" data-first={r.rank === 1 ? "" : undefined}>
                <span className="fd-list__rank" aria-hidden="true">
                  {r.rank}
                </span>
                <PlayerName account={r.near_account_id} username={names.get(r.near_account_id) ?? null} level={levels.get(r.near_account_id)} />
                <span className="fd-num feast-amount">{r.xp.toLocaleString("en-US")} XP</span>
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
        ? allTimeBoard(client).then((r) => r.map((x): BoardRow => ({ account: x.near_account_id, xp: x.total_xp, detail: rowDetail(x.actions, x.quests_completed) })))
        : seasonBoard(client, scope).then((r) => r.map((x): BoardRow => ({ account: x.near_account_id, xp: x.xp, detail: rowDetail(x.actions, x.quests_completed) })));
    void load.then((r) => alive && setRows(r)).catch(() => alive && setRows("error"));
    return () => {
      alive = false;
    };
  }, [client, scope]);

  const shown = Array.isArray(rows) ? rows.filter((r) => !only || only.has(r.account)).slice(0, 10) : [];
  const hallSeasons = Array.isArray(hall) ? hall : [];
  const accounts = [...shown.map((r) => r.account), ...hallSeasons.flatMap((s) => s.top.map((t) => t.near_account_id))];
  const names = useNames(client, accounts);
  const levels = useLevels(client, accounts);
  const options = seasonOptions(current, hallSeasons.map((s) => s.season));

  return (
    <div className="fd-stack" data-testid="season-panel">
      <Field id={selectId} label="season">
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
        <Empty icon="eye">reading the season board…</Empty>
      ) : rows === "error" ? (
        <Empty icon="warn">The profile database did not answer, or seasons are not switched on there yet. Nothing is shown in its place.</Empty>
      ) : shown.length === 0 ? (
        <Empty icon="podium">
          {only ? "Nobody you follow has XP in this view." : scope === "all" ? "No XP recorded yet." : "No XP recorded in this season yet. Play a signed action to open the board."}
        </Empty>
      ) : (
        <SeasonRows rows={shown} names={names} levels={levels} label={scope === "all" ? "all-time XP" : `season ${scope} XP`} />
      )}
      <p className="fd-field__hint">
        XP comes from signed actions recorded for signed-in players plus quest bonuses. A season is a Monday-to-Monday week in UTC. XP and ranks are cosmetic: no tokens, no NEAR.
      </p>

      <section className="fd-stack" aria-labelledby={`${selectId}-hof`}>
        <h4 id={`${selectId}-hof`} className="fd-h">
          Hall of fame
        </h4>
        {hall === null ? (
          <Empty icon="eye">reading the hall of fame…</Empty>
        ) : hall === "error" ? (
          <Empty icon="warn">The hall of fame could not be read. Nothing is shown in its place.</Empty>
        ) : (
          <HallOfFame seasons={hallSeasons} names={names} levels={levels} />
        )}
      </section>
    </div>
  );
}
