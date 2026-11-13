/**
 * Plain-language summary of a NEAR Connect signing request, shown on the Privy signing page before
 * the player approves it. Pure: no Privy import, so it is unit-tested in node. It imports nothing
 * from the game or the landing on purpose, so the signing chunk shares no module with them.
 */

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

function describeAction(a: ActionLike): string {
  if (a.type === "FunctionCall" && a.params) {
    const dep = a.params.deposit && a.params.deposit !== "0" ? `, attaches ${formatYocto(a.params.deposit)} NEAR` : "";
    return `call ${a.params.methodName ?? "?"}${dep}`;
  }
  if (a.functionCall) {
    const d = a.functionCall.deposit?.toString();
    return `call ${a.functionCall.methodName ?? "?"}${d && d !== "0" ? `, attaches ${formatYocto(d)} NEAR` : ""}`;
  }
  if (a.type === "AddKey") {
    const perm = a.params?.accessKey?.permission;
    if (!perm || perm === "FullAccess") return "add a FULL ACCESS key";
    const n = perm.methodNames?.length ?? 0;
    const allowance = perm.allowance ? `gas allowance ${formatYocto(perm.allowance)} NEAR` : "no allowance limit";
    return `add a limited key for ${perm.receiverId ?? "?"} (${n ? `${n} methods` : "any method"}, ${allowance})`;
  }
  if (a.type === "DeleteKey") return `delete the key ${a.params?.publicKey ?? "?"}`;
  if (a.type === "Transfer" && a.params?.deposit) return `send ${formatYocto(a.params.deposit)} NEAR`;
  if (a.transfer?.deposit !== undefined) return `send ${formatYocto(a.transfer.deposit.toString())} NEAR`;
  return a.type ? `${a.type} action` : "unknown action";
}

function describeTx(tx: TxLike): string[] {
  return (tx.actions ?? []).map((a) => `${describeAction(a)} on ${tx.receiverId ?? "?"}`);
}

/** One line per thing the player is asked to approve. */
export function describePayload(p: PayloadLike | null | undefined): string[] {
  if (!p || typeof p !== "object") return ["unknown request"];
  const net = p.network ? ` (${p.network})` : "";
  switch (p.kind) {
    case "signIn":
      return [`sign in and share your NEAR account id${net}`];
    case "signInAndSignMessage":
      return [`sign in${net} and sign a message for ${p.recipient ?? "this app"}`];
    case "signMessage":
      return [`sign the message "${String(p.message ?? "").slice(0, 120)}" for ${p.recipient ?? "this app"}`];
    case "signAndSendTransaction":
      return describeTx(p);
    case "signAndSendTransactions":
      return (p.transactions ?? []).flatMap(describeTx);
    case "signDelegateActions":
      return ["sign delegate actions (meta-transactions)"];
    default:
      return [`${p.kind ?? "unknown"} request`];
  }
}
