/**
 * The reasons the pure `check*` helpers in `chain/actions.ts` and `chain/market.ts` return (UI-161 phase B3).
 * They show up in "blocked" lines and field hints. The helpers read the saved language with `getLocale()`;
 * the checks themselves (the rules and the numbers) are unchanged.
 */
const checks = {
  dead: "This Snacc is no longer alive.",
  stake: {
    invalid: "Enter an amount in NEAR, e.g. 0.25.",
    min: "The smallest stake here is {min} NEAR.",
    max: "Keep the stake at {max} NEAR or less on testnet.",
  },
  alloc: {
    waitingEpoch: "Waiting for the epoch read from testnet.",
    already: "This Snacc already allocated ATP in epoch {epoch}. Once per epoch.",
    levelRange: "Each organelle level is 0 to {max}.",
    same: "Change at least one level.",
    needAtp: "Needs {cost} ATP; this Snacc has {atp}.",
  },
  divide: {
    starving: "A starving Snacc (vitality 0) cannot divide. Feed it first.",
    cost: "Dividing costs {cost} ATP; this Snacc has {atp}.",
    generation: "The child would be generation {gen}; the limit is {max}.",
    waitingColony: "Waiting for your colony read from testnet.",
    colony: "Your colony already has {n} living Snaccs (limit {max}).",
    budget: "The contract allows a division only after a merger or a lysis frees a slot (total divides ≤ mergers + lyses).",
  },
  account: {
    empty: "Enter a testnet account, e.g. friend.testnet.",
    invalid: "Use a testnet account id: name.testnet, or a 64-character implicit id.",
    self: "That is your own account.",
  },
  price: {
    empty: "Enter a price in NEAR, e.g. 1.5.",
    format: "Use digits and one dot only, with at most 24 decimals, e.g. 1.5.",
    zero: "The price must be greater than zero.",
    max: "The market accepts at most {max} NEAR per Snacc.",
  },
  buy: {
    connect: "connect a wallet to buy",
    own: "this is your own listing",
    dead: "this Snacc has died and cannot be transferred",
  },
  notConfirmed: {
    lag: " The testnet RPC did not answer, so this could not be checked: refresh in a moment.",
    listed:
      "The transaction finished but no listing for Snacc #{id} shows up. The market hands the Snacc back when it refuses a listing (price out of range, new listings paused, or a limit reached). Check My collection.",
    repriced: "The transaction finished but the price of Snacc #{id} is not the new one yet. Refresh in a few seconds.",
    delisted:
      "The transaction finished but Snacc #{id} is not back with you yet. Refresh in a few seconds; if the listing stays, the Snacc may have died while listed.",
    bought:
      "The transaction finished but Snacc #{id} is not yours. The market refunds the full price when a Snacc cannot be transferred (it died, or it was bought or delisted at the same moment); only gas is spent.",
  },
};

export default checks;
