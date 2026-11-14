/**
 * Plain-language summary of a NEAR Connect signing request, shown on the Privy signing page before
 * the player approves it. Pure: no Privy import, so it is unit-tested in node. It imports nothing
 * from the game or the landing on purpose (only the language layer, for the words), so the signing chunk
 * shares no screen code with them.
 */

import { tEn, type Translate } from "../i18n/catalog.ts";

/** yoctoNEAR → NEAR with up to 4 decimals (same output as `formatYocto` in `src/chain/actions.ts`). */
export function formatYocto(raw: string): string {
  let v: bigint;
  try {
    v = BigInt(raw);
  } catch {
    return "?";
  }
  const unit = 10n ** 24n;
  const whole = v / unit;
  const frac = (v % unit).toString().padStart(24, "0").slice(0, 4).replace(/0+$/, "");
  if (whole === 0n && !frac && v > 0n) return "<0.0001";
  return `${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
}

interface ActionLike {
  type?: string;
  params?: {
    methodName?: string;
    deposit?: string;
    gas?: string;
    // AddKey / DeleteKey (RES-111 one-tap play)
    publicKey?: string;
    accessKey?: { permission?: "FullAccess" | { receiverId?: string; allowance?: string; methodNames?: string[] } };
  };
  functionCall?: { methodName?: string; deposit?: string | bigint };
  transfer?: { deposit?: string | bigint };
}

interface TxLike {
  receiverId?: string;
  actions?: ActionLike[];
}

export interface PayloadLike extends TxLike {
  kind?: string;
  network?: string;
  transactions?: TxLike[];
  message?: string;
  recipient?: string;
}

// UI-161 phase B5: the words come from the `sign.request.*` dictionary keys. `t` defaults to English (not to the
// saved language) so callers and tests that pass nothing get the same lines as before; the sign page passes its own.
// The payload itself is only read here, never changed: what gets signed is exactly what the wallet was asked for.
function describeAction(a: ActionLike, t: Translate): string {
  if (a.type === "FunctionCall" && a.params) {
    const method = a.params.methodName ?? "?";
    return a.params.deposit && a.params.deposit !== "0"
      ? t("sign.request.callDeposit", { method, amount: formatYocto(a.params.deposit) })
      : t("sign.request.call", { method });
  }
  if (a.functionCall) {
    const d = a.functionCall.deposit?.toString();
    const method = a.functionCall.methodName ?? "?";
    return d && d !== "0" ? t("sign.request.callDeposit", { method, amount: formatYocto(d) }) : t("sign.request.call", { method });
  }
  if (a.type === "AddKey") {
    const perm = a.params?.accessKey?.permission;
    if (!perm || perm === "FullAccess") return t("sign.request.addFull");
    const n = perm.methodNames?.length ?? 0;
    const allowance = perm.allowance ? t("sign.request.allowance", { amount: formatYocto(perm.allowance) }) : t("sign.request.noAllowance");
    return t("sign.request.addLimited", {
      receiver: perm.receiverId ?? "?",
      scope: n ? t("sign.request.methods", { n }) : t("sign.request.anyMethod"),
      allowance,
    });
  }
  if (a.type === "DeleteKey") return t("sign.request.deleteKey", { key: a.params?.publicKey ?? "?" });
  if (a.type === "Transfer" && a.params?.deposit) return t("sign.request.send", { amount: formatYocto(a.params.deposit) });
  if (a.transfer?.deposit !== undefined) return t("sign.request.send", { amount: formatYocto(a.transfer.deposit.toString()) });
  return a.type ? t("sign.request.actionType", { type: a.type }) : t("sign.request.unknownAction");
}

function describeTx(tx: TxLike, t: Translate): string[] {
  return (tx.actions ?? []).map((a) => t("sign.request.on", { action: describeAction(a, t), receiver: tx.receiverId ?? "?" }));
}

/** One line per thing the player is asked to approve. */
export function describePayload(p: PayloadLike | null | undefined, t: Translate = tEn): string[] {
  if (!p || typeof p !== "object") return [t("sign.request.unknown")];
  const net = p.network ? t("sign.request.network", { network: p.network }) : "";
  const recipient = p.recipient ?? t("sign.request.thisApp");
  switch (p.kind) {
    case "signIn":
      return [t("sign.request.signIn", { net })];
    case "signInAndSignMessage":
      return [t("sign.request.signInMessage", { net, recipient })];
    case "signMessage":
      return [t("sign.request.signMessage", { message: String(p.message ?? "").slice(0, 120), recipient })];
    case "signAndSendTransaction":
      return describeTx(p, t);
    case "signAndSendTransactions":
      return (p.transactions ?? []).flatMap((tx) => describeTx(tx, t));
    case "signDelegateActions":
      return [t("sign.request.delegate")];
    default:
      return [t("sign.request.kindRequest", { kind: p.kind ?? t("sign.request.unknownKind") })];
  }
}
