/**
 * Great Feast leaderboard. Live mode shows the backend's `/api/appetite` podium or, when that has
 * none, reads `get_appetite_meter` + `get_top_feeder` straight from the contract; with no data it
 * shows an empty state. Demo mode shows invented feeders, each number labelled SIMULATION.
 */
import { useEffect, useId, useState } from "react";
import { useAccount } from "../account/session.tsx";
import { ActivityBoard, PlayerName, StreakBoard, useFollowing, useNames, usePublicClient } from "./PlayerBoards.tsx";
import { KeycapButton, TabPanel, Tabs, type TabDef } from "../ui/controls.tsx";

type BoardTab = "feeders" | "active" | "streaks";
const BOARD_TABS: readonly TabDef<BoardTab>[] = [
  { id: "feeders", label: "top feeders", icon: "podium" },
  { id: "active", label: "most active (7 days)", icon: "spark" },
  { id: "streaks", label: "longest streaks", icon: "lines" },
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
  const source = live ? (fromBackend ? "backend /api/appetite" : `contract views on ${CONTRACT_ID}`) : "demo fixture";
  const S = () => (live ? null : <Sim />);

  // UI-148: player names and boards, only with the profile features on and a loaded client.
  const account = useAccount();
  const client = usePublicClient(false);
  const players = account.enabled && client !== null;
  const [tab, setTab] = useState<BoardTab>("feeders");
  const following = useFollowing(players ? client : null);
  const [onlyFollowing, setOnlyFollowing] = useState(false);
  const only = onlyFollowing && following ? following : null;
  const feeders = (board?.topFeeders ?? []).filter((f) => !only || only.has(f.account_id)).slice(0, 3);
  const names = useNames(players && live ? client : null, feeders.map((f) => f.account_id));
  const tabsId = useId();

  return (
    <Modal
      title="great-feast.md"
      heading={skin === "fintech" ? "Top feeders board" : "The Great Feast"}
      onClose={onClose}
      testId="social-modal"
      footer={
        <>
          <span>source: {source}</span>
          {live ? <Tag>live · testnet</Tag> : <Sim />}
        </>
      }
    >
      <div className="fd-stack">
        {players ? (
          <div className="fd-stack" data-testid="board-tabs">
            <Tabs label="leaderboards" idBase={tabsId} tabs={BOARD_TABS} value={tab} onChange={setTab} />
            {following ? (
              <KeycapButton mono icon={onlyFollowing ? "check" : "user"} aria-pressed={onlyFollowing} onClick={() => setOnlyFollowing((v) => !v)} data-testid="board-following">
                {onlyFollowing ? `following only (${following.size})` : "show only players I follow"}
              </KeycapButton>
            ) : null}
          </div>
        ) : null}
        {players && tab === "active" ? (
          <TabPanel idBase={tabsId} id="active">
            <ActivityBoard client={client} only={only} />
            <p className="fd-field__hint">Counts signed actions recorded by signed-in players in the last 7 days (activity_snacc).</p>
          </TabPanel>
        ) : players && tab === "streaks" ? (
          <TabPanel idBase={tabsId} id="streaks">
            <StreakBoard client={client} only={only} />
            <p className="fd-field__hint">Days in a row with at least one recorded feed (streaks_snacc).</p>
          </TabPanel>
        ) : live && rpcBoard === "loading" && !fromBackend ? (
          <Empty icon="eye">reading get_appetite_meter and get_top_feeder…</Empty>
        ) : !board ? (
          <Empty icon="podium">No Great Feast data yet: the backend and the testnet RPC returned nothing. Nothing is shown in its place.</Empty>
        ) : (
          <>
            <dl className="fd-kv" data-testid="feast-stats">
              <div className="fd-kv__row">
                <dt>epoch</dt>
                <dd className="fd-kv__num">
                  {board.epoch ?? "—"} <S />
                </dd>
              </div>
              <div className="fd-kv__row">
                <dt>zone · temp</dt>
                <dd className="fd-kv__num">
                  {board.zone ?? "—"} · {board.crucibleTempMk ?? "—"} mK <S />
                </dd>
              </div>
              <div className="fd-kv__row">
                <dt>feast volume</dt>
                <dd className="fd-kv__num">
                  {formatSnacc(board.feastVolume)} of {formatSnacc(board.feastTarget)} $SNACC <S />
                </dd>
              </div>
            </dl>
            {board.topFeeders.length === 0 ? (
              <Empty icon="podium">No feeds recorded this epoch.</Empty>
            ) : (
              <ol className="fd-list" aria-label="top feeders" data-testid="feast-podium">
                {(only ? feeders : board.topFeeders.slice(0, 3)).map((f, i) => (
                  <li key={f.account_id} className="fd-row" data-first={i === 0 ? "" : undefined}>
                    <span className="fd-list__rank" aria-hidden="true">
                      {i + 1}
                    </span>
                    {players && live ? (
                      <PlayerName account={f.account_id} username={names.get(f.account_id) ?? null} />
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
            <section className="fd-stack" aria-label="near.social post">
              <div className="fd-row fd-row--between">
                <span className="fd-sub">near.social post (markdown)</span>
                <CopyButton label="copy post" text={formatSocialPost(board, { simulated: !live })} />
              </div>
              <pre className="fd-pre">{formatSocialPost(board, { simulated: !live })}</pre>
              <p className="fd-field__hint">
                This app posts nothing; copy the text and post it yourself on <ExtLink href="https://near.social">near.social</ExtLink>.
              </p>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

export default SocialLeaderboardModal;
