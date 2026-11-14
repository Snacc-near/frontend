/**
 * The `/sign` popup of the email login (UI-161 phase B5). Only the words around the request change language:
 * the signed payload is what the wallet asks for and is never rewritten. `request.*` are the plain-language
 * lines `sign/payload.ts` builds from that payload (`describePayload`); method names, account ids and
 * public keys inside them are data.
 */
const sign = {
  title: "Snacc · email login",
  offBold: "Email login is not configured on this deployment.",
  offRest: "Close this window and pick a NEAR wallet instead.",
  starting: "Starting Privy…",
  codeHint: "Privy sends a one-time code. A new NEAR testnet account is created for you on first login; it starts with 0 NEAR.",
  email: "email",
  sendCode: "send code",
  sending: "sending…",
  codeSentTo: "code sent to {email}",
  logIn: "log in",
  checking: "checking…",
  back: "back",
  nearAccount: "NEAR account: {account}",
  requestedBy: "Requested by {origin}:",
  approve: "approve",
  signing: "signing…",
  reject: "reject",
  waiting: "Waiting for the request from the game…",
  openerHint: "This page opens from the wallet picker in the game. You can close it.",
  keysStay: "Keys stay with Privy; the game never sees them.",
  request: {
    unknown: "unknown request",
    unknownKind: "unknown",
    thisApp: "this app",
    network: " ({network})",
    signIn: "sign in and share your NEAR account id{net}",
    signInMessage: "sign in{net} and sign a message for {recipient}",
    signMessage: "sign the message \"{message}\" for {recipient}",
    delegate: "sign delegate actions (meta-transactions)",
    kindRequest: "{kind} request",
    call: "call {method}",
    callDeposit: "call {method}, attaches {amount} NEAR",
    addFull: "add a FULL ACCESS key",
    addLimited: "add a limited key for {receiver} ({scope}, {allowance})",
    methods: "{n} methods",
    anyMethod: "any method",
    allowance: "gas allowance {amount} NEAR",
    noAllowance: "no allowance limit",
    deleteKey: "delete the key {key}",
    send: "send {amount} NEAR",
    actionType: "{type} action",
    unknownAction: "unknown action",
    on: "{action} on {receiver}",
  },
};

export default sign;
