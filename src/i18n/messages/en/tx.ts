/**
 * Plain-language transaction and contract-error text (UI-161 phase B2). `chain/txResult.ts` reads these
 * in the current language (`getLocale()`); which error maps to which key is decided there, and is
 * unchanged. Key names `ERR_*` are the contract's panic codes and method names are the contract's methods,
 * so they are copied exactly from the spec.
 */
const tx = {
  rejected: "You closed or rejected the wallet request. Nothing was sent.",
  /** `{code}` is the contract's `ERR_*` code. */
  refused: "The contract refused the call ({code}).",
  notEnoughNear: "Your account does not have enough testnet NEAR for this transaction.",
  outOfGas: "The transaction ran out of gas.",
  notConnected: "The wallet is not connected. Connect it again.",
  failed: "The transaction did not go through.",

  /** The generic text of each contract panic code. */
  errors: {
    ERR_INSUFFICIENT_DEPOSIT: "The attached NEAR is below what this action needs.",
    ERR_STAKE_DEPOSIT_MISMATCH: "The stake must equal the NEAR you attach.",
    ERR_INSUFFICIENT_BALANCE: "Not enough $SNACC for this. Try a smaller amount.",
    ERR_NOT_OWNED_BY_CALLEE: "You can only feed a Snacc you own.",
    ERR_NOT_STRAIN_OWNER: "You can only do this with a Snacc you own.",
    ERR_STRAIN_NOT_FOUND: "That Snacc does not exist on this contract.",
    ERR_STRAIN_STARVING: "This Snacc has starved (vitality 0) and can no longer be fed.",
    ERR_ROLE_MASK_NOT_SINGLE: "Pick exactly one role for a new Snacc.",
    ERR_ACCOUNT_NOT_REGISTERED: "Your account is not registered with the contract yet.",
    ERR_YOCTO_REQUIRED: "This action needs exactly 1 yoctoNEAR attached.",
    ERR_ALREADY_LIQUIDATED: "This Snacc has already been liquidated.",
    ERR_COLONY_FULL: "Your colony is full.",
    ERR_BAD_AMOUNT: "That amount is not valid.",
    ERR_NOT_ENOUGH_ATP: "This Snacc does not have enough ATP for that.",
    ERR_ALREADY_ALLOCATED: "This Snacc already allocated ATP this epoch. Try again after the epoch closes.",
    ERR_ORGANEL_LEVEL_MAX: "Organelle levels go from 0 to 5.",
    ERR_STRAIN_ALREADY_SPLICED: "This Snacc was spliced or liquidated and can no longer act.",
    ERR_MAX_GENERATION: "The generation limit (8) is reached.",
    ERR_BIRTHS_EXCEEDED: "The contract allows a division only after a merger or a lysis (total divides ≤ mergers + lyses).",
    ERR_ROLE_NOT_ALLOWED: "This Snacc does not have the role this step needs.",
    ERR_UNKNOWN_TOKEN: "The contract does not know that molecule.",
    ERR_RECIPE_NOT_MET: "That amount does not match the recipe batch size.",
    ERR_REQUIRES_TEE_ATTESTATION: "Elixir-aether needs a Snacc that had a verified TEE mutation.",
    ERR_NPC_UNKNOWN: "That merchant does not exist on this contract.",
    ERR_NPC_OUT_OF_STOCK: "The merchant does not have that many spores left.",
    ERR_SAME_STRAIN: "Pick two different Snaccs (or another account).",
    ERR_NOT_SAME_OWNER: "Both Snaccs must belong to you.",
    ERR_NOT_DISTRESSED: "That Snacc is not distressed (vitality must be 1 to 2,000) any more.",
    ERR_STRAIN_NOT_INSOLVENT: "That Snacc is not starving (vitality is above 0), so it cannot be harvested.",
    ERR_STATE_NONCE_CHANGED_SELLER_DRAIN_BLOCKED: "That Snacc changed since you looked at it. Refresh the list and try again.",
    ERR_PENDING_ASYNC_CALLBACK_LOCKED: "That Snacc has a pending cross-contract call. Try again in a moment.",
    ERR_ROLE_LOCKED_NEEDS_SYNTHESIZER_GENE: "Redeeming elixir-aether needs a Snacc with the Synthesizer role.",
    ERR_INSUFFICIENT_AETHER: "This Snacc does not hold that much elixir-aether.",
    ERR_EPOCH_NOT_CLOSED: "That epoch is not closed yet, so there is nothing to claim.",
    ERR_DIVIDEND_ALREADY_CLAIMED: "This Snacc already claimed that epoch.",
    ERR_DIVIDEND_CLAIM_EXPIRED: "That epoch is older than the 8-epoch claim window.",
    ERR_DIVIDEND_POOL_EMPTY: "Nothing to pay for that epoch (no contribution, or the pool is empty).",
    ERR_LISTING_NOT_FOUND: "That listing is gone: it was bought, taken back or never existed. Refresh the list.",
    ERR_SELLER_CANNOT_BUY: "You cannot buy your own listing.",
    ERR_NOT_SELLER: "Only the seller can change or take back this listing.",
    ERR_BAD_PRICE: "The price must be greater than zero and at most 10,000 NEAR.",
    ERR_MORE_GAS_REQUIRED: "Too little gas was attached for this call. Try again with the wallet's default gas.",
    ERR_LISTINGS_PAUSED: "The market is not taking new listings right now.",
    ERR_ALREADY_LISTED: "That Snacc is already listed.",
    ERR_SELLER_LISTING_CAP: "You already have 20 open listings, the most one account can have.",
    ERR_MARKET_FULL: "The market is full (1,000 open listings). Try again later.",
    ERR_BAD_MSG: "The listing message was not accepted by the market.",
    ERR_NOT_NFT_CONTRACT: "The market only takes Snaccs from the Snacc contract.",
    ERR_NOT_OWNER: "Only the market owner can do this.",
  },

  /** The same code can mean something different per method; these are looked up before `errors`. */
  methods: {
    extract_spores: { ERR_STAKE_DEPOSIT_MISMATCH: "The attached NEAR must equal the catalyst fee." },
    synthesize_elixir: {
      ERR_STAKE_DEPOSIT_MISMATCH: "The attached NEAR must equal the catalyst fee.",
      ERR_INSUFFICIENT_BALANCE: "This Snacc does not hold enough enzymes for that many batches.",
    },
    transmute_spores_to_enzyme: {
      ERR_STAKE_DEPOSIT_MISMATCH: "The attached NEAR must equal the catalyst fee after the diet discount. The zone may have just changed; reopen and try again.",
      ERR_INSUFFICIENT_BALANCE: "This Snacc does not hold enough spores for any recipe at that amount.",
    },
    npc_buy_spores: {
      ERR_INSUFFICIENT_BALANCE: "This Snacc does not hold enough $SNACC for the quoted price.",
      ERR_NOT_OWNED_BY_CALLEE: "You can only buy spores for a Snacc you own.",
    },
    adopt: {
      ERR_INSUFFICIENT_BALANCE: "Your paying Snacc does not hold enough $SNACC for the book value.",
      ERR_NOT_OWNED_BY_CALLEE: "The paying Snacc must be yours.",
      ERR_COLONY_FULL: "Your colony is full (5 living Snaccs), so it cannot take one more.",
    },
    hostile_takeover_splice: {
      ERR_INSUFFICIENT_BALANCE: "Your raiding Snacc does not hold enough $SNACC for book value + 15%.",
      ERR_NOT_OWNED_BY_CALLEE: "The raiding Snacc must be yours.",
    },
    splice_strains: { ERR_NOT_OWNED_BY_CALLEE: "The dominant Snacc must be yours." },
    divide_strain: { ERR_NOT_OWNED_BY_CALLEE: "You can only divide a Snacc you own." },
    allocate_atp: { ERR_NOT_OWNED_BY_CALLEE: "You can only allocate ATP on a Snacc you own." },
    ft_transfer: {
      ERR_ACCOUNT_NOT_REGISTERED: "The receiver is not registered with the contract, so it cannot hold $SNACC yet.",
      ERR_INSUFFICIENT_BALANCE: "Your wallet $SNACC balance is lower than that amount.",
    },
    nft_transfer: {
      ERR_SAME_STRAIN: "You cannot send a Snacc to yourself.",
      ERR_NOT_OWNED_BY_CALLEE: "You can only give a Snacc you own.",
      ERR_ALREADY_LIQUIDATED: "A dead Snacc cannot be given away.",
    },
    nft_transfer_call: {
      ERR_NOT_OWNED_BY_CALLEE: "You can only list a Snacc you own.",
      ERR_ALREADY_LIQUIDATED: "A dead Snacc cannot be listed.",
      ERR_SAME_STRAIN: "You cannot list a Snacc to yourself.",
    },
    buy: { ERR_INSUFFICIENT_DEPOSIT: "The NEAR attached is below the listed price. Reload the list: the price may have changed." },
  },
};

export default tx;
