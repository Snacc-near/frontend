/**
 * One-tap play (UI-161 phase B4): the Settings section (`help/OneTapSettings.tsx`), the notices shown when
 * a deposit-free action falls back to the wallet (`chain/oneTap.ts`) and the status lines the one-tap
 * controller sets (`chain/oneTapSession.ts`). The copy stays as precise as before: one limited key,
 * the gas allowance, the one contract, the deposit-free methods only, and actions that attach NEAR or
 * pay another player stay in the wallet. Method names (`<code>`) are never translated.
 */
const onetap = {
  heading: "One-tap play",
  intro:
    "Signs deposit-free game actions in this browser, so they go through without a wallet popup each time. Testnet only, and not yet tried with every wallet.",
  /** `{list}` is the method names in code font. */
  methods: "One-tap actions ({count}): {list}.",
  walletOnly:
    "Still in your wallet: the actions that attach NEAR (a stake, a catalyst fee, the storage deposit or 1 yoctoNEAR), {attaches}; the actions that pay $SNACC to another player or take over their Snacc, {paysOther}; every market call; and any action sent together with the first storage registration.",
  key: "Turning it on asks your wallet once to add a limited key to your own account. That key can only call the one-tap actions above on {contract}, cannot attach NEAR, and can spend at most {allowance} NEAR of gas (its allowance), paid from your account. The private key is made in this browser and stays here; it is never sent anywhere, only its public key goes on chain. Anyone who could run code on this site in this browser could use it for those actions until you turn it off.",
  signOut:
    "Disconnecting the wallet does not remove the key: it stays in this browser and on your account until you turn one-tap play off. To remove it, connect the same account and press \"turn off\" here, or delete the key in your wallet's list of access keys.",

  status: {
    signedOut: "Connect a wallet to turn on one-tap play.",
    loading: "Checking this browser…",
    unsupported: "One-tap play is not available in this browser: {reason} Every action keeps using your wallet.",
    off: "One-tap play is off. Every action uses your wallet.",
    offFor: "One-tap play is off for {account}. Every action uses your wallet.",
    /** The bold lead of the "on" line. */
    on: "On.",
    onFor: "On for {account}.",
    /** `{state}` is the bold lead, `{key}` the shortened public key in code font. */
    onLine: "{state} Key {key} · allowance left {allowance} · {where}",
    unlimited: "unlimited",
    indexeddb: "kept in this browser's IndexedDB as a non-exportable key",
    localstorage: "kept in this browser's localStorage as raw key bytes, because IndexedDB is blocked here",
    missing:
      "This key is no longer on your account (deleted elsewhere, or the add did not land). Deposit-free actions use your wallet again; forget the key here and turn one-tap play on again if you want it back.",
    outdated:
      "This key was made by an older version of the game and allows a different list of actions, so one-tap play does not use it: every action goes through your wallet. Replace it (2 wallet popups: delete the old key, add the new one) or turn it off.",
  },

  button: {
    waiting: "waiting for wallet…",
    enable: "turn on one-tap play (1 wallet popup)",
    replace: "replace the key (2 wallet popups)",
    disable: "turn off (delete the key, 1 wallet popup)",
    refresh: "check again",
    forget: "forget on this device",
    forgetConfirm: "forget the key here",
    cancel: "cancel",
  },
  confirmForget: {
    group: "confirm forget",
    note: "This only removes the key from this browser. It stays on your account (unusable, since only this browser had it) until you delete it with \"turn off\" first or in your wallet's key list.",
  },

  /** One-line notices shown when a deposit-free action falls back to the wallet (`FALLBACK_NOTICE`). */
  fallback: {
    keyMissing: "One-tap key not found on your account, so your wallet signs this one.",
    allowance: "The one-tap allowance is used up, so your wallet signs this one. Turn one-tap play off and on in Settings for a fresh allowance.",
    method: "The one-tap key cannot call this action, so your wallet signs it.",
    receiver: "The one-tap key is not for this contract, so your wallet signs this one.",
    deposit: "This action attaches NEAR, so your wallet signs it.",
    balance: "Your account could not cover the gas for one-tap play, so your wallet signs this one.",
    nonce: "One-tap play could not get a fresh nonce, so your wallet signs this one.",
    invalid: "Testnet refused the one-tap transaction, so your wallet signs this one.",
    rpcUnreachable: "Could not reach NEAR testnet for one-tap play, so your wallet signs this one.",
    loadFailed: "Could not load the one-tap key in this browser, so your wallet signs this one.",
    outdated: "Your one-tap key is from an older version of the game, so your wallet signs this one. Replace it in Settings → One-tap play.",
  },
  notConfirmed: "One-tap play sent this transaction, but testnet did not confirm it in time. Check the explorer link before trying again.",

  /** Lines the one-tap controller puts in the Settings section and in a failed turn-on or turn-off. */
  session: {
    noCrypto: "this browser has no Web Crypto.",
    noEd25519: "this browser cannot sign with Ed25519 in Web Crypto.",
    noStorage: "this browser blocks site storage (IndexedDB and localStorage).",
    errorBeforeSending: "One-tap play hit an error before sending, so your wallet signs this one.",
    connectFirst: "Connect a wallet first.",
    busy: "One-tap play is busy. Try again in a moment.",
    notAvailable: "One-tap play is not available in this browser: {reason}",
    alreadyHasKey: "This browser already has a one-tap key on your account. Turn it off (or replace it) first.",
    unreachableExisting: "Could not reach NEAR testnet to check the existing one-tap key. Nothing was sent. Try again.",
    isOn: "One-tap play is on.",
    walletErrorKeyFound: "The wallet reported an error, but the key is on your account, so one-tap play is on.",
    walletErrorUnknown: "The wallet reported an error and testnet could not be checked. The key is kept here so it can still be turned off.",
    alreadyOff: "One-tap play is already off.",
    keyAlreadyGone: "The key was already gone from your account, so it was only forgotten on this device.",
    unreachableKey: "Could not reach NEAR testnet to check the key. Nothing was sent. Try again.",
    notOurKey: "That key is not a one-tap play key for this game, so it was not deleted.",
    nowOff: "One-tap play is off. The key was deleted from your account.",
    forgot: "Forgot the one-tap key on this device.",
  },
};

export default onetap;
