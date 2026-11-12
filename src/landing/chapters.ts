/**
 * Landing story copy. Numbers come only from the official figures
 * (3.5% Feeding Frenzy burn, 2% Famine Relief); everything else is qualitative.
 */
export interface Chapter {
  /** DOM id of the section, also the rail anchor. */
  id: string;
  /** Two-digit chapter number shown in pills and the rail. */
  num: string;
  /** Short figure name used in the "FIG 0N · name" pill and the rail. */
  fig: string;
  headline: string;
  /** Phrase of the headline shown in the accent colour (must occur in `headline`). */
  accent: string;
  line: string;
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: "ch-01",
    num: "01",
    fig: "incubator",
    headline: "NFTs that eat a memecoin.",
    accent: "memecoin",
    line: "Feed your Snacc or it gets snacked.",
  },
  {
    id: "ch-02",
    num: "02",
    fig: "organism",
    headline: "Every Snacc has its own stomach.",
    accent: "own stomach",
    line: "A living NFT that holds its own $SNACC and shows how full it is.",
  },
  {
    id: "ch-03",
    num: "03",
    fig: "metabolism",
    headline: "Feed it. It works. Some of every bite burns.",
    accent: "burns",
    line: "Spores become enzymes, enzymes become elixir. In a Feeding Frenzy 3.5% is burned; in a Famine, 2% comes back as relief.",
  },
  {
    id: "ch-04",
    num: "04",
    fig: "colony",
    headline: "Feed your Snacc or it gets snacked.",
    accent: "snacked",
    line: "A starving Snacc can be harvested by others, so keep yours fed.",
  },
  {
    id: "ch-05",
    num: "05",
    fig: "appetite",
    headline: "The colony sets its own appetite.",
    accent: "appetite",
    line: "CrucibleTemp reads the colony's mood and tilts the economy between Frenzy, Normal and Famine.",
  },
  {
    id: "ch-06",
    num: "06",
    fig: "enclave",
    headline: "Private AI diet plans, verified on-chain.",
    accent: "verified on-chain",
    line: "Plans are computed inside a TEE on NEAR AI Cloud; the contract checks their signature before anything changes.",
  },
  {
    id: "ch-07",
    num: "07",
    fig: "doorway",
    headline: "Open the incubator.",
    accent: "incubator",
    line: "Testnet only. Explore the live colony and the lab demo.",
  },
] as const;

export const CHAPTER_IDS: readonly string[] = CHAPTERS.map((c) => c.id);

export const LINKS = {
  github: "https://github.com/Snacc-near",
  docs: "https://github.com/Snacc-near/frontend/tree/main/docs",
  app: "/app",
} as const;
