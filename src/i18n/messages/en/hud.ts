/**
 * Game HUD copy (UI-161 phase B1): resource bar, dock, toolbar, wallet and account chips, the status
 * pills and gauges. Window titles that look like file names (`tools.menu`) are not translated.
 */
const hud = {
  resources: {
    region: "resources",
    demo: "demo · simulated",
    live: "live · testnet",
    biolab: { atp: "atp", spores: "spores", enzymes: "enzymes", elixir: "elixir" },
    fintech: { atp: "int-atp", spores: "coupons", enzymes: "clearing", elixir: "reserve" },
  },

  queue: {
    region: "production queue",
    title: "production queue",
    demo: "demo · simulated",
    live: "live values only",
    ready: "ready",
    left: "{s}s left",
    progress: "{kind} progress",
    collectKind: "collect {kind}",
    notReady: "{kind} not ready",
    collect: "collect",
  },

  dock: { region: "colony actions" },

  sim: {
    label: "dish simulation:",
    hypothermia: "hypothermia (575)",
    goldilocks: "goldilocks (605)",
    fever: "fever (632)",
    burst: "lysis / burst!",
  },

  tools: {
    group: "game tools",
    telemetry: "telemetry",
    more: "tools",
    heading: "Tools",
    collection: "my collection",
    market: "market",
    npc: { biolab: "npc merchants", fintech: "market makers" },
    swap: "swap quote",
    social: { biolab: "great feast", fintech: "top feeders" },
    thesis: "thesis",
    recipes: "recipes",
    guest: "guest label",
    guestNamed: "guest: {name}",
    quests: "quests",
    profile: "profile",
    notifications: "alerts",
    help: "help",
    settings: "settings",
  },

  wallet: {
    oneTapTitle: "Deposit-free actions are signed in this browser without a wallet popup. Settings → One-tap play.",
    oneTapOn: "one-tap on",
    restoring: "restoring wallet…",
    opening: "opening wallets…",
    connect: "connect wallet",
    note: "testnet · optional · the app never sees your keys",
    connected: "connected wallet",
    disconnectAria: "disconnect {account}",
    disconnect: "disconnect",
    testnet: "testnet",
    noValue: "$SNACC on testnet has no monetary value",
    /** `{faucet}` is a link to the testnet faucet. */
    lowNear: "Not enough testnet NEAR to hatch (about 0.27 NEAR with fees). Get free testnet NEAR from the {faucet}.",
    faucet: "NEAR testnet faucet",
  },

  account: {
    signOutAria: "sign out of the profile (the wallet stays connected)",
    signOut: "sign out",
    signing: "sign the message in your wallet…",
    signIn: "Save progress — sign in",
    note: "signs a message, not a transaction · no fee",
    signInFirst: "Sign in first to claim the starter pack.",
    asking: "asking…",
    getNear: "Get testnet NEAR to start",
    sent: "Sent {amount} testnet NEAR.",
    tx: "tx {hash}…",
  },

  filter: {
    region: "near account highlighter",
    label: "highlight account:",
    placeholder: "e.g.: alice.testnet",
    clear: "clear the account filter",
    highlighting: "highlighting {n} strains in the dish",
    none: "no strain owned by this account in the dish",
  },

  mode: {
    group: "the game arena mode",
    demo: "demo · simulated",
    live: "live testnet",
  },

  skinSwitch: {
    group: "the ADR-31 terminology choice",
    biolab: "bio-lab",
    fintech: "fintech",
  },

  /** Field names of the API (`crucible_temp`, `current_epoch`, `burst_bps`, `risk_heat`, `top_feeders`) stay as they are. */
  appetite: {
    region: "appetite meter",
    demo: "demo, simulated",
    zone: "zone",
    goldilocksDemo: "goldilocks (demo)",
    riskHeat: "risk heat",
    loading: "loading…",
    unavailable: "unavailable",
    live: "live · /api/appetite",
    none: "no appetite data",
    feast: "feast progress",
    vol: "vol {v}",
    tgt: "tgt {v}",
  },

  breach: {
    region: "the reactor threshold feed",
    title: "threshold log & events",
    open: "open",
    close: "close",
    sla: "sla < 2000 ms",
    indexer: "indexer catching up — the event list may be incomplete",
    empty: "no threshold events recorded yet",
    slaPass: "sla pass",
    slaMiss: "sla miss",
  },

  bell: { aria: "notifications, {n} unread", plain: "notifications", label: "alerts" },

  xp: {
    badgeTitle: "level {n}",
    badge: "Lv {n}",
    region: "level and experience",
    level: "Level {n}",
    total: "{n} XP",
    bar: "level {level}: {into} of {span} XP",
    toNext: "{n} XP to level {level}",
  },

  signIn: { connectFirst: "connect wallet first" },

  vitals: { status: "status:" },

  atp: { unit: "atp" },

  thermal: {
    region: "{zone} {temp} milikelvin",
    unit: "mk",
    hypothermia: "hypothermia threshold: < {mk} mk",
    goldilocks: "goldilocks range: {lo}..{hi} mk",
    fever: "fever threshold: > {mk} mk",
    thresholds: "thresholds 600 / 610",
  },

  burst: {
    ariaActive: "{label}: a {pct}% discount",
    ariaStandby: "{label}: standby",
    until: "until epoch {epoch}",
    standby: "standby",
  },
};

export default hud;
