/**
 * Frontend helper for formatting SocialDB markdown posts (RES-113).
 */

export interface SocialPostParams {
  epoch?: number;
  crucibleTempMk?: number;
  zone?: string;
  feastVolume?: string;
  feastTarget?: string;
  topFeeders?: Array<{ account_id: string; amount: string }>;
  colonyOwner?: string;
  colonyStrainsCount?: number;
  colonyTotalAtp?: string;
  network?: string;
}

export function formatSocialPost(params: SocialPostParams): string {
  const {
    epoch = 0,
    crucibleTempMk = 0,
    zone = "NORMAL",
    feastVolume = "0",
    feastTarget = "0",
    topFeeders = [],
    colonyOwner = "",
    colonyStrainsCount = 0,
    colonyTotalAtp = "0",
    network = "NEAR Protocol",
  } = params;

  const tempDisplay = (crucibleTempMk / 1000).toFixed(3);
  const vNorm = (BigInt(feastVolume) / 10n ** 18n).toLocaleString("en-US");
  const tNorm = (BigInt(feastTarget) / 10n ** 18n).toLocaleString("en-US");

  let feederLines = "No feeder contributions recorded for this epoch.";
  if (topFeeders.length > 0) {
    feederLines = topFeeders
      .slice(0, 3)
      .map((f, i) => {
        const amt = (BigInt(f.amount) / 10n ** 18n).toLocaleString("en-US");
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
        return `${medal} **#${i + 1} \`${f.account_id}\`** — ${amt} $SNACC`;
      })
      .join("\n");
  }

  let colonySection = "";
  if (colonyOwner) {
    colonySection = `\n### 🔬 Colony Verification (\`${colonyOwner}\`)\n` +
      `- Active Living Strains: **${colonyStrainsCount}**\n` +
      `- Total Metabolic Reserves: **${colonyTotalAtp} $ATP**\n`;
  }

  return (
    `## 🏆 Snacc — The Great Feast Leaderboard (Epoch ${epoch})\n\n` +
    `On-chain economic status snapshot from ${network}:\n\n` +
    `- **Macro Zone**: \`${zone}\`\n` +
    `- **Crucible Temperature**: \`${tempDisplay} mK\`\n` +
    `- **Feast Volume**: \`${vNorm}\` / Target \`${tNorm}\`\n\n` +
    `### 🍽️ Top Feeders Podium\n` +
    `${feederLines}\n` +
    colonySection +
    `\n---\n` +
    `*Autonomous biological balance sheets on NEAR. Feed your strain or it gets harvested.*\n` +
    `#Snacc #NEAR #GreatFeast #SocialDB #OnChainEconomy`
  );
}
