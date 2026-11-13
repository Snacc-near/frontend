/**
 * Landing page copy (UI-161): header, chapters, live section, footer, FAQ. English is the source of
 * truth; the Indonesian file is type-checked against this shape.
 *
 * Numbers come only from the official figures (3.5% Feeding Frenzy burn, 2% Famine Relief); everything
 * else is qualitative. Names such as Snacc, $SNACC, ATP, NEAR, TEE, CrucibleTemp and The Pantry are
 * not translated in any language.
 */
const landing = {
  skip: "Skip to content",
  figureAlt: "Isometric cutaway of the Snacc incubator: a petri dish colony behind the glass, a thermometer and a frosted enclave.",

  header: {
    status: { live: "testnet live", loading: "connecting", offline: "offline" },
    nav: { label: "Primary", story: "Story", live: "Live", github: "GitHub" },
    sound: "Sound effects",
    launch: "Launch app",
    language: "Language",
  },

  /** Bottom status bar. `live` takes `{zone}` and `{temp}`. */
  status: {
    nav: "Sections",
    connecting: "connecting…",
    offline: "offline",
    live: "live · {zone} · {temp} mK",
  },

  /** Tab per section in the status bar; the keys are the DOM ids of the sections. */
  sections: {
    "ch-01": "Enter",
    "ch-02": "Organism",
    "ch-03": "Metabolism",
    "ch-04": "Colony",
    "ch-05": "Appetite",
    "ch-06": "Enclave",
    live: "Live",
    hood: "Hood",
    "ch-07": "Open",
    faq: "FAQ",
  },

  rail: {
    label: "Chapters",
    item: "Chapter {num}: {name}",
  },

  /**
   * The seven chapters. `fig` is the short figure name (rail, window titles `fig-02.organism`); `accent`
   * is the phrase of `headline` shown in the accent colour and must occur in it.
   */
  chapters: {
    ch01: {
      fig: "incubator",
      headline: "NFTs that eat a memecoin.",
      accent: "memecoin",
      line: "Feed your Snacc or it gets snacked.",
    },
    ch02: {
      fig: "organism",
      headline: "Every Snacc has its own stomach.",
      accent: "own stomach",
      line: "A living NFT that holds its own $SNACC and shows how full it is.",
    },
    ch03: {
      fig: "metabolism",
      headline: "Feed it. It works. Some of every bite burns.",
      accent: "burns",
      line: "Spores become enzymes, enzymes become elixir. In a Feeding Frenzy 3.5% is burned; in a Famine, 2% comes back as relief.",
    },
    ch04: {
      fig: "colony",
      headline: "Feed your Snacc or it gets snacked.",
      accent: "snacked",
      line: "A starving Snacc can be harvested by others, so keep yours fed.",
    },
    ch05: {
      fig: "appetite",
      headline: "The colony sets its own appetite.",
      accent: "appetite",
      line: "CrucibleTemp reads the colony's mood and tilts the economy between Frenzy, Normal and Famine.",
    },
    ch06: {
      fig: "enclave",
      headline: "Private AI diet plans, verified on-chain.",
      accent: "verified on-chain",
      line: "Plans are computed inside a TEE on NEAR AI Cloud; the contract checks their signature before anything changes.",
    },
    ch07: {
      fig: "doorway",
      headline: "Open the incubator.",
      accent: "incubator",
      line: "Testnet only. Explore the live colony and the lab demo.",
    },
  },

  /** Names of the figure parts the camera, the leader line and the lens point at. */
  parts: {
    incubator: "incubator",
    stomach: "stomach",
    mitochondrion: "mitochondrion",
    hungryCell: "hungry cell",
    appetiteMeter: "appetite meter",
    enclave: "enclave",
    cell: "cell",
    colony: "colony",
    petriDish: "petri dish",
    window: "window",
    glass: "glass",
  },

  /** Caption under the dot-matrix wordmark: `{count}` is the live cell count, written `{n} cells`. */
  wordmark: {
    caption: "fig-08.culture · {count}",
    cells: "cells",
    count: "{n} cells",
  },

  hero: {
    chip: "fig-01.incubator · NEAR testnet",
    cta: "Enter the lab",
    scroll: "Scroll",
    hintLens: "move the lens over the dish",
    hintDoor: "hover the door",
  },

  /** Live ticker under the hero. `alive` takes `{alive}` and `{total}`. */
  ticker: {
    label: "Live testnet ticker",
    live: "live · testnet",
    connecting: "connecting…",
    offline: "offline",
    offlineMsg: "The backend did not answer, so no numbers are shown.",
    reading: "Reading the colony…",
    alive: "{alive} of {total}",
    items: {
      temp: "CrucibleTemp",
      zone: "zone",
      strains: "strains alive",
      burned: "total burned",
      last: "last event",
    },
  },

  /** Warm-up bar; `{pct}` is the counter. */
  loader: {
    text: "warming the incubator {pct}%",
  },

  hood: {
    chip: "fig-08.under-the-hood",
    title: "Four NEAR building blocks, one living machine.",
    accent: "one living machine",
    repos: "Source code",
    openSource: "open source",
    coin: { name: "$SNACC", line: "The memecoin every Snacc eats. A testnet token with no monetary value." },
    nft: { name: "Living NFT", line: "Each Snacc is an NFT whose picture is an SVG drawn by the contract itself." },
    multi: { name: "Spores · enzymes · elixirs", line: "The supply chain is a multi-token: raw, refined and finished goods." },
    tee: { name: "TEE diet plans", line: "Plans run inside a TEE; the contract checks the enclave signature." },
  },

  /** "Live from testnet" section. */
  live: {
    /** Header chip: `{lead}` is one of the three below, `{contract}` the contract account. */
    chip: "{lead} · NEAR testnet · {contract}",
    lead: { live: "live", loading: "connecting…", offline: "offline" },
    title: "Not a mockup. This colony is on-chain.",
    accent: "on-chain",
    line: "Every number here is read from the contract on testnet, every card is an NFT whose picture the contract draws itself. Testnet only: $SNACC has no monetary value.",
    reading: "Reading the colony…",
    offline: "The backend did not answer, so no numbers are shown here.",
    /** `{zone}` is shown in bold, `{rate}` is the zone's rate. */
    zone: "The colony is in {zone} right now ({rate}).",
    nums: {
      temp: "CrucibleTemp",
      supply: "$SNACC supply",
      burned: "$SNACC burned",
      pantry: "The Pantry",
      minted: "Snaccs minted",
      alive: "alive now",
      events: "events indexed",
      block: "block height",
    },
    gallery: {
      heading: "On-chain gallery",
      failed: "The NEAR testnet RPC did not answer, so the gallery is empty.",
      imgAlt: "On-chain SVG of {title}",
      noImage: "no on-chain image",
      specimen: "specimen-{id}.svg",
      rows: { title: "title", owner: "owner", token: "token" },
    },
    txs: {
      heading: "Real transactions",
      note: "From the rehearsal run of 2026-11-09 (evidence pack in the Snacc repo). Links open nearblocks.",
      /** What each rehearsal transaction did, by action name. The action names themselves are method names and stay as they are. */
      detail: {
        incubate: "Extractor, strain 1",
        feed: "strain 1",
        merge: "strain 1 absorbs 2",
        extract: "ignis",
        transmute: "ignis + lumin to redactase",
        synthesize: "homeostasis",
        tee: "strain 5, TEE-signed",
        burn: "$SNACC burn",
        harvest: "snack it",
        takeover: "steal a plate",
        transfer: "strain 4 to a second account",
        epoch: "close epoch 0",
      },
    },
  },

  finale: {
    cap: "door open · light on",
    launch: "Launch app (testnet)",
    code: "Read the code",
  },

  faq: {
    chip: "faq.md",
    title: "Questions from the lab door.",
    accent: "lab door",
    window: "questions.md",
    token: {
      q: "What is $SNACC?",
      a: "A NEP-141 token on NEAR testnet that every Snacc eats. It is a testnet token with no monetary value; it exists so the economy can be played and checked in the open.",
    },
    live: {
      q: "Is it live?",
      /** `{contract}` is a link to the contract account. */
      a: "Yes, on NEAR testnet. The contract is {contract}; the ticker, the numbers and the gallery on this page are read from it.",
    },
    hungry: {
      q: "What happens if I don't feed it?",
      a: "Its Fullness drains over time. A Starving Snacc can be taken over by another player; a Fainted one can be snacked by anyone: {bounty} goes to the hunter and {pantry} to The Pantry.",
    },
    wallet: {
      q: "Do I need a wallet?",
      a: "Not to look around. This page and the demo need no wallet and sign nothing. In live testnet mode you sign testnet transactions yourself, with your own NEAR wallet or the optional email login; the app never sees your keys.",
    },
  },

  footer: {
    colophon: "colophon.md",
    blurb: "NFTs that eat a memecoin. An on-chain economic game on NEAR testnet, drawn as a lab culture.",
    cta: "Enter the lab",
    /** One-line honest disclaimer. */
    disclaimer: "Testnet only. $SNACC has no monetary value. Not financial advice.",
    terms: "Terms",
    privacy: "Privacy",
    license: "MIT License",
    copyright: "© 2026 Snacc contributors",
    product: {
      title: "Product",
      launch: "Launch app",
      launchNote: "testnet",
      story: "The story",
      live: "Live colony",
      hood: "Under the hood",
      faq: "Questions",
    },
    build: {
      title: "Build",
      githubNote: "GitHub",
    },
    proof: {
      title: "Proof",
      nearblocksNote: "nearblocks",
      oracleNote: "TEE oracle",
      scriptsNote: "evidence + replay",
    },
    near: {
      title: "NEAR",
      docs: "NEAR docs",
      nftNote: "NFT",
      multiNote: "multi token",
      explorer: "Testnet explorer",
    },
  },
};

export default landing;
