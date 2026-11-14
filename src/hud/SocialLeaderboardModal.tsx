/**
 * Great Feast leaderboard. Live mode shows the backend's `/api/appetite` podium or, when that has
 * none, reads `get_appetite_meter` + `get_top_feeder` straight from the contract; with no data it
 * shows an empty state. Demo mode shows invented feeders, each number labelled SIMULATION.
 * With the profile features on, tabs add most active, longest streaks and (UI-154) the season XP board
 * with its hall of fame; rows show the player's level. UI-156 adds a "graveyard" tab (public chain history of the Snaccs that died).
 *
 * UI-161 phase B3: text comes from the `social.leaderboard` dictionary. The near.social post is content the
 * player copies out, so it stays English.
 */
import { useEffect, useId, useState } from "react";
import { useAccount } from "../account/session.tsx";
import { ActivityBoard, PlayerName, StreakBoard, useFollowing, useLevels, useNames, usePublicClient } from "./PlayerBoards.tsx";
import { SeasonBoardPanel } from "./SeasonBoard.tsx";
import { GraveyardPanel } from "./Graveyard.tsx";
import { useWallet } from "../chain/wallet.tsx";
import { KeycapButton, TabPanel, Tabs, type TabDef } from "../ui/controls.tsx";
import type { Translate } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";

type BoardTab = "feeders" | "active" | "streaks" | "season" | "graveyard";
const boardTabs = (t: Translate): readonly TabDef<BoardTab>[] => [
  { id: "feeders", label: t("social.leaderboard.tabs.feeders"), icon: "podium" },
  { id: "active", label: t("social.leaderboard.tabs.active"), icon: "spark" },
  { id: "streaks", label: t("social.leaderboard.tabs.streaks"), icon: "lines" },
  { id: "season", label: t("social.leaderboard.tabs.season"), icon: "gauge" },
  { id: "graveyard", label: t("social.leaderboard.tabs.graveyard"), icon: "ring" },
];
import type { GameMode, SkinMode } from "../config/constants.ts";
import type { AppetiteViewModel } from "../data/types.ts";
import { DEMO_FEAST, fetchFeastBoard, formatSnacc, formatSocialPost, type FeastBoard } from "../swap/socialFormat.ts";
import { CONTRACT_ID } from "../data/nearView.ts";
import { Modal } from "../ui/Modal.tsx";
import { CopyButton, Empty, ExtLink } from "../ui/controls.tsx";
import { Sim, Tag } from "../ui/fd.tsx";

export interface SocialLeaderboardModalProps {
  onClose: () => void;
  appetite: AppetiteViewModel | null;
  mode: GameMode;
  skin?: SkinMode;
}

function boardFromAppetite(a: AppetiteViewModel | null): FeastBoard | null {
  if (!a || a.topFeeders.length === 0) return null;
  return {
    epoch: a.currentEpoch,
    zone: a.zone,
    crucibleTempMk: a.crucibleTempMk,
    feastVolume: a.feastVolume,
    feastTarget: a.feastTarget,
    topFeeders: a.topFeeders.map((f) => ({ account_id: f.account_id, amount: String(f.amount) })),
  };
}

export function SocialLeaderboardModal({ onClose, appetite, mode, skin = "biolab" }: SocialLeaderboardModalProps) {
  const { t, rich } = useT();
  const live = mode === "live";
  const fromBackend = live ? boardFromAppetite(appetite) : null;
  const [rpcBoard, setRpcBoard] = useState<FeastBoard | null | "loading">(live && !fromBackend ? "loading" : null);

  useEffect(() => {
    if (!live || fromBackend) return;
    const ac = new AbortController();
    void fetchFeastBoard(ac.signal).then((b) => {
      if (!ac.signal.aborted) setRpcBoard(b);
    });
    return () => ac.abort();
    // fromBackend is derived from appetite; re-run only on mode change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const board: FeastBoard | null = live ? (fromBackend ?? (rpcBoard === "loading" ? null : rpcBoard)) : DEMO_FEAST;
  const source = live
    ? fromBackend
      ? t("social.leaderboard.srcBackend")
      : t("social.leaderboard.srcContract", { contract: CONTRACT_ID })
    : t("social.leaderboard.srcDemo");
  const S = () => (live ? null : <Sim />);

  // UI-148: player names and boards, only with the profile features on and a loaded client.
  const account = useAccount();
  const wallet = useWallet();
  const [tab, setTab] = useState<BoardTab>("feeders");
  // The graveyard is public chain data: opening it loads the client on demand (no sign-in needed).
  const client = usePublicClient(tab === "graveyard");
  const players = account.enabled && client !== null;
  const myAccount = account.nearAccountId ?? wallet.accountId ?? null;
  const following = useFollowing(players ? client : null);
  const [onlyFollowing, setOnlyFollowing] = useState(false);
  const only = onlyFollowing && following ? following : null;
  const feeders = (board?.topFeeders ?? []).filter((f) => !only || only.has(f.account_id)).slice(0, 3);
  const names = useNames(players && live ? client : null, feeders.map((f) => f.account_id));
  const levels = useLevels(players && live ? client : null, feeders.map((f) => f.account_id));
  const tabsId = useId();
  const graveyard = account.enabled && tab === "graveyard";
  const allTabs = boardTabs(t);
  /** The tabs that read public chain data only (no player boards): available as soon as the profile database is configured. */
  const publicTabs = allTabs.filter((x) => x.id === "feeders" || x.id === "graveyard");
  const boardSource = graveyard
    ? t("social.leaderboard.srcGraveyard")
    : players && tab === "active"
      ? t("social.leaderboard.srcActive")
      : players && tab === "streaks"
        ? t("social.leaderboard.srcStreaks")
        : players && tab === "season"
          ? t("social.leaderboard.srcSeason")
          : null;

  return (
    <Modal
      title={t("social.leaderboard.title")}
      heading={skin === "fintech" ? t("social.leaderboard.headingFintech") : t("social.leaderboard.headingBiolab")}
      onClose={onClose}
      testId="social-modal"
      footer={
        <>
          <span>{t("social.leaderboard.sourceLine", { source: boardSource ?? source })}</span>
          {graveyard ? (
            <Tag>{t("social.leaderboard.tagChainIndex")}</Tag>
          ) : boardSource ? (
            <Tag>{t("social.leaderboard.tagProfileDb")}</Tag>
          ) : live ? (
            <Tag>{t("hud.resources.live")}</Tag>
          ) : (
            <Sim />
          )}
        </>
      }
    >
      <div className="fd-stack">
        {account.enabled ? (
          <div className="fd-stack" data-testid="board-tabs">
            <Tabs label={t("social.leaderboard.tabsLabel")} idBase={tabsId} tabs={players ? allTabs : publicTabs} value={tab} onChange={setTab} />
            {following && tab !== "graveyard" ? (
              <KeycapButton mono icon={onlyFollowing ? "check" : "user"} aria-pressed={onlyFollowing} onClick={() => setOnlyFollowing((v) => !v)} data-testid="board-following">
                {onlyFollowing ? t("social.leaderboard.followingOnly", { n: following.size }) : t("social.leaderboard.followingShow")}
              </KeycapButton>
            ) : null}
          </div>
        ) : null}
        {graveyard ? (
          <TabPanel idBase={tabsId} id="graveyard">
            <GraveyardPanel client={client} account={myAccount} live={live} />
          </TabPanel>
        ) : players && tab === "active" ? (
          <TabPanel idBase={tabsId} id="active">
            <ActivityBoard client={client} only={only} />
            <p className="fd-field__hint">{t("social.leaderboard.activeNote")}</p>
          </TabPanel>
        ) : players && tab === "streaks" ? (
          <TabPanel idBase={tabsId} id="streaks">
            <StreakBoard client={client} only={only} />
            <p className="fd-field__hint">{t("social.leaderboard.streakNote")}</p>
          </TabPanel>
        ) : players && tab === "season" ? (
          <TabPanel idBase={tabsId} id="season">
            <SeasonBoardPanel client={client} only={only} />
          </TabPanel>
        ) : live && rpcBoard === "loading" && !fromBackend ? (
          <Empty icon="eye">{t("social.leaderboard.readingFeast")}</Empty>
        ) : !board ? (
          <Empty icon="podium">{t("social.leaderboard.noData")}</Empty>
        ) : (
          <>
            <dl className="fd-kv" data-testid="feast-stats">
              <div className="fd-kv__row">
                <dt>{t("social.leaderboard.epoch")}</dt>
                <dd className="fd-kv__num">
                  {board.epoch ?? "—"} <S />
                </dd>
              </div>
              <div className="fd-kv__row">
                <dt>{t("social.leaderboard.zoneTemp")}</dt>
                <dd className="fd-kv__num">
                  {board.zone ?? "—"} · {board.crucibleTempMk ?? "—"} mK <S />
                </dd>
              </div>
              <div className="fd-kv__row">
                <dt>{t("social.leaderboard.feastVolume")}</dt>
                <dd className="fd-kv__num">
                  {t("social.leaderboard.volumeOf", { vol: formatSnacc(board.feastVolume), target: formatSnacc(board.feastTarget) })} <S />
                </dd>
              </div>
            </dl>
            {board.topFeeders.length === 0 ? (
              <Empty icon="podium">{t("social.leaderboard.noFeeds")}</Empty>
            ) : (
              <ol className="fd-list" aria-label={t("social.leaderboard.podiumLabel")} data-testid="feast-podium">
                {(only ? feeders : board.topFeeders.slice(0, 3)).map((f, i) => (
                  <li key={f.account_id} className="fd-row" data-first={i === 0 ? "" : undefined}>
                    <span className="fd-list__rank" aria-hidden="true">
                      {i + 1}
                    </span>
                    {players && live ? (
                      <PlayerName account={f.account_id} username={names.get(f.account_id) ?? null} level={levels.get(f.account_id)} />
                    ) : (
                      <code className="feast-account">{f.account_id}</code>
                    )}
                    <span className="fd-num feast-amount">
                      {formatSnacc(f.amount)} $SNACC <S />
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <section className="fd-stack" aria-label={t("social.leaderboard.postRegion")}>
              <div className="fd-row fd-row--between">
                <span className="fd-sub">{t("social.leaderboard.postTitle")}</span>
                <CopyButton label={t("social.leaderboard.postCopy")} text={formatSocialPost(board, { simulated: !live })} />
              </div>
              <pre className="fd-pre">{formatSocialPost(board, { simulated: !live })}</pre>
              <p className="fd-field__hint">{rich("social.leaderboard.postNote", { link: <ExtLink href="https://near.social">near.social</ExtLink> })}</p>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

export default SocialLeaderboardModal;
