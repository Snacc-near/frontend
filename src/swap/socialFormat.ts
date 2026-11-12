/**
 * Great Feast leaderboard: formats a near.social markdown post from contract data, and reads the
 * live podium with the views `get_appetite_meter` and `get_top_feeder`. Amounts are yocto-$SNACC
 * (24 decimals). The post is copied by the player; this app posts nothing.
 */
import { CONTRACT_ID, formatUnits, viewCall } from "../data/nearView.ts";

export interface Feeder {
  account_id: string;
  amount: string;
}

export interface FeastBoard {
  epoch: number | null;
  zone: string | null;
  crucibleTempMk: number | null;
  feastVolume: string | null;
  feastTarget: string | null;
  topFeeders: Feeder[];
}

/** Demo podium: invented accounts and amounts, always shown with a SIMULATION label. */
export const DEMO_FEAST: FeastBoard = {
  epoch: 1,
  zone: "GOLDILOCKS",
  crucibleTempMk: 605,
  feastVolume: "21400000000000000000000000",
  feastTarget: "30000000000000000000000000",
  topFeeders: [
    { account_id: "alkemis.testnet", amount: "9800000000000000000000000" },
    { account_id: "spore-cook.testnet", amount: "6250000000000000000000000" },
    { account_id: "night-feeder.testnet", amount: "3100000000000000000000000" },
  ],
};

export function formatSnacc(yocto: string | null | undefined): string {
  return formatUnits(yocto ?? null, 24, 4);
}

export function formatSocialPost(board: FeastBoard, opts: { simulated: boolean }): string {
  const lines = board.topFeeders.slice(0, 3).map((f, i) => `${i + 1}. \`${f.account_id}\` fed ${formatSnacc(f.amount)} $SNACC`);
  return [
    `## Snacc Great Feast, epoch ${board.epoch ?? "?"}${opts.simulated ? " (simulation)" : ""}`,
    "",
    `- Zone: \`${board.zone ?? "unknown"}\``,
    `- CrucibleTemp: \`${board.crucibleTempMk ?? "?"} mK\``,
    `- Feast volume: \`${formatSnacc(board.feastVolume)}\` of \`${formatSnacc(board.feastTarget)}\` $SNACC`,
    "",
    "### Top feeders",
    lines.length ? lines.join("\n") : "No feeds recorded this epoch.",
    "",
    "---",
    opts.simulated
      ? "*Simulated numbers from the Snacc demo, not chain data.*"
      : `*Read from \`${CONTRACT_ID}\` on NEAR testnet. Testnet $SNACC has no monetary value.*`,
  ].join("\n");
}

interface AppetiteView {
  zone?: string;
  crucible_temp?: number;
  current_epoch?: number;
  feast_volume?: string | number;
  feast_target?: string | number;
}

/** Live podium straight from the contract; `null` when the RPC could not be reached. */
export async function fetchFeastBoard(signal?: AbortSignal): Promise<FeastBoard | null> {
  const meter = await viewCall<AppetiteView>("get_appetite_meter", {}, signal);
  if (!meter) return null;
  const epoch = typeof meter.current_epoch === "number" ? meter.current_epoch : null;
  const feeders = epoch === null ? null : await viewCall<{ account_id: string; amount: string | number }[]>("get_top_feeder", { epoch }, signal);
  return {
    epoch,
    zone: meter.zone ?? null,
    crucibleTempMk: typeof meter.crucible_temp === "number" ? meter.crucible_temp : null,
    feastVolume: meter.feast_volume !== undefined ? String(meter.feast_volume) : null,
    feastTarget: meter.feast_target !== undefined ? String(meter.feast_target) : null,
    topFeeders: (feeders ?? []).map((f) => ({ account_id: f.account_id, amount: String(f.amount) })),
  };
}
