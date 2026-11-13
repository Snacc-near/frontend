/**
 * Text of the static pages (UI-151): terms, privacy and the 404 page. Plain data so a test can check
 * that the promises the owner asked for are present. The privacy page lists the app's own
 * localStorage keys straight from `APP_LOCAL_KEY_INFO`, so it cannot drift from what Reset local data
 * clears.
 */
import { APP_LOCAL_KEY_INFO } from "../prefs/prefs.ts";

/** Where questions, bug reports and takedown requests go. */
export const ISSUES_URL = "https://github.com/Snacc-near/frontend/issues";

export const LEGAL_UPDATED = "13 November 2026";

/** The short disclaimer shown at the top of both legal pages. */
export const DISCLAIMER =
  "Testnet only. $SNACC has no monetary value. No promise of profit. Snacc is an experimental game.";

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: readonly string[];
  items?: readonly string[];
}

export interface LegalDoc {
  title: string;
  /** Mono window title, like the other windows. */
  file: string;
  lead: string;
  sections: readonly LegalSection[];
}

export const TERMS: LegalDoc = {
  title: "Terms of use",
  file: "terms.md",
  lead: "Snacc is a game on NEAR testnet, built for a hackathon. By using it you agree to the points below.",
  sections: [
    {
      id: "testnet",
      heading: "Testnet only",
      paragraphs: [
        "Everything in Snacc runs on NEAR testnet. Nothing here is deployed to mainnet, and nothing on testnet has real-world value. The testnet can be reset, and the contract can be redeployed, so your Snaccs may disappear at any time.",
      ],
    },
    {
      id: "no-value",
      heading: "$SNACC has no monetary value",
      paragraphs: [
        "$SNACC is a testnet token that exists only to play this game. It is not for sale, it has no market price, and it cannot be exchanged for anything of value. Testnet NEAR from a faucet has no value either.",
      ],
    },
    {
      id: "no-promise",
      heading: "No promise of profit",
      paragraphs: [
        "Snacc is an experimental game. Nothing on this site is financial advice or an offer of anything. The game is built around risk: a Snacc that is not fed can be adopted or snacked by other players, and the numbers can move. Do not expect any return, and do not treat the game as a way to make money.",
      ],
    },
    {
      id: "experimental",
      heading: "Experimental software",
      paragraphs: [
        "The contract, the backend and this app were built in a short hackathon window and may contain bugs. They are provided as they are, without any warranty, and we are not liable for losses or errors of any kind.",
      ],
    },
    {
      id: "wallet",
      heading: "Your wallet, your responsibility",
      paragraphs: [
        "You sign every transaction yourself in your own NEAR wallet or through the optional email login. The app never sees or stores your private keys. You are responsible for your account and for what you sign. Transactions are public and cannot be undone.",
      ],
    },
    {
      id: "conduct",
      heading: "Fair use",
      paragraphs: [
        "Do not attack the contract, the backend or other players' accounts, and do not use the site to break the law. The code is open source under the MIT License, so you are free to read it, run it and report problems.",
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      paragraphs: [
        `We may change these terms as the project changes. The date at the top shows the last update (${LEGAL_UPDATED}).`,
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      paragraphs: ["Questions, bug reports and takedown requests go through GitHub issues."],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: "Privacy",
  file: "privacy.md",
  lead: "Short version: Snacc has no accounts and no database of its own today, runs no analytics or ads, and keeps a few settings in your browser.",
  sections: [
    {
      id: "wallet-id",
      heading: "Your wallet account id is public",
      paragraphs: [
        "When you connect a NEAR wallet, the app reads your account id. On NEAR testnet an account id, what it owns and every transaction it signs are public to anyone, and they cannot be deleted. Snacc does not add anything private to that.",
        "The app never sees your private keys. Wallets sign inside NEAR Connect's sandboxed frames.",
      ],
    },
    {
      id: "email",
      heading: "Email login (Privy)",
      paragraphs: [
        "Email login is optional and appears in the wallet picker only when it is switched on for this site. If you use it, the sign-in runs in a popup page of this site that loads Privy's software, and Privy handles your email under Privy's own terms and privacy policy. Snacc has no database of its own and does not store your email address.",
      ],
    },
    {
      id: "storage",
      heading: "What stays in your browser",
      paragraphs: [
        "These localStorage keys belong to the Snacc app. They never leave your device, and Settings has a button that clears exactly these keys:",
      ],
      items: APP_LOCAL_KEY_INFO.map((k) => `${k.key}: ${k.what}`),
    },
    {
      id: "requests",
      heading: "Who your browser talks to",
      paragraphs: [
        "Like any website, the services below can see your IP address and the request you make. Snacc itself sets no cookies and has no analytics, advertising or tracking scripts; the libraries and services below may keep their own browser storage.",
      ],
      items: [
        "The web host that serves this site, which keeps ordinary server logs (IP address, requested address, browser) under its own policy.",
        "NEAR testnet RPC nodes (rpc.testnet.near.org and test.rpc.fastnear.com) to read contract data, and the Snacc read-only backend for the telemetry feed.",
        "NEAR Connect and the wallet you choose, when you open the wallet picker.",
        "Privy and a pinned script on raw.githubusercontent.com, only when email login is on and you use it.",
        "Rhea Finance and NEAR Intents (1Click) price and quote services, only when you open the swap quote window. Quotes are for display and do not feed the game.",
        "testnet.nearblocks.io, only when you follow an explorer link.",
      ],
    },
    {
      id: "planned",
      heading: "Planned: a profile database (Supabase)",
      paragraphs: [
        "A profile database on Supabase is planned. It is not live: today nothing is sent to it and nothing is stored there. Before it goes live this page will be updated to say what it stores, why, and how to have it deleted.",
      ],
    },
    {
      id: "choices",
      heading: "Your choices",
      paragraphs: [
        "You can disconnect the wallet at any time from the header, and clear the app's local data from Settings. Data already written to the NEAR blockchain cannot be removed by anyone.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      paragraphs: ["Questions or requests about this page go through GitHub issues."],
    },
  ],
};

export const NOT_FOUND = {
  file: "404.md",
  title: "404 · page not found",
  heading: "That page is not in the lab.",
  body: "The address you opened does not exist here. The home page and the game are one click away.",
};
