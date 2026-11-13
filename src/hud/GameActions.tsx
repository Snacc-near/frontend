/**
 * UI-150: every player action of the Snacc contract, signed through the connected wallet with the
 * same builder → window → tx status pattern as Hatch and Feed (`ChainActions.tsx`).
 *
 * Each window reads the views it needs (`get_strain`, `get_macro_state`, `get_sandbox_clock`,
 * `get_inventory`, `get_dividend_pool` and NPC views), checks the contract's guards before signing and says
 * why a button is disabled. After a successful transaction the window re-reads its views and the
 * app refreshes the account. Without a wallet the windows still show the live reads and a connect
 * button; nothing is signed. Values that could not be read show "—".
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ATP_COST,
  DEFAULT_CATALYST_FEE_NEAR,
  DISTRESSED_MAX,
  ELIXIR_RECIPES,
  ELIXIR_TYPES,
  MAX_COLONY_SIZE,
  MAX_GENERATION,
  MAX_ORGANEL_LEVEL,
  MERGER_TAX_BPS,
  NPC_IDS,
  SPORE_TYPES,
  STORAGE_MIN_FALLBACK_YOCTO,
  bookValue,
  buildAdopt,
  buildAllocateAtp,
  buildClaimDividend,
  buildDivide,
  buildExtract,
  buildFtTransfer,
  buildHarvest,
  buildHostileTakeover,
  buildNftTransfer,
  buildNpcBuy,
  buildRedeemAether,
  buildSplice,
  buildStorageDeposit,
  buildSynthesize,
  buildTransmute,
  checkAllocation,
  checkDivide,
  checkTestnetAccount,
  claimableEpochs,
  formatCountdown,
  formatYocto,
  harvestSplit,
  hasRole,
  hostilePrice,
  maxGasFeeYocto,
  parseNear,
  parseUnits,
  rolesOf,
  synthesizePreview,
  totalDeposit,
  transmuteDeposit,
  transmuteDietBps,
  transmutePreview,
  type ContractCall,
  type ElixirType,
  type Inventory,
  type OrganelLevels,
  type SporeType,
  type StrainRole,
} from "../chain/actions.ts";
import {
  estimatePayout,
  fetchContractNowSec,
  fetchContribution,
  fetchDividendPool,
  fetchHungryStrains,
  fetchInventory,
  fetchMacroInfo,
  fetchNpcQuote,
  fetchNpcStock,
  fetchOwnerStrainSnacc,
  fetchRegistered,
  type Contribution,
  type HungryStrain,
} from "../chain/gameViews.ts";
import type { AccountInfo } from "../chain/useAccountInfo.ts";
import type { WalletApi } from "../chain/wallet.tsx";
import { fetchVessel } from "../data/collection.ts";
import { explorerAccount } from "../data/nearView.ts";
import type { StrainDetail } from "../data/types.ts";
import { Modal } from "../ui/Modal.tsx";
import { ExtLink, Field, Input, KeycapButton, Select, TabPanel, Tabs } from "../ui/controls.tsx";
import { Footer, FaucetLine, StorageLine, TxStatusView, plan, useSend, type ChainActionProps, type TxPhase } from "./ChainActions.tsx";

/** Windows reachable from the action menu, the dock and Strain Detail. */
export type GameActionKey = "allocate" | "divide" | "splice" | "extract" | "transmute" | "synthesize" | "npc" | "hungry" | "pool" | "gift" | "send";

export const GAME_ACTIONS: readonly { key: GameActionKey; label: string; method: string; blurb: string }[] = [
  { key: "allocate", label: "Allocate ATP", method: "allocate_atp", blurb: "level up mitochondria, nucleus, lysosome (once per epoch)" },
  { key: "divide", label: "Divide", method: "divide_strain", blurb: "split a Snacc in two (3 ATP)" },
  { key: "splice", label: "Splice", method: "splice_strains", blurb: "merge two of your Snaccs into one" },
  { key: "extract", label: "Extract", method: "extract_spores", blurb: "Extractor: +1 spore (1 ATP + catalyst fee)" },
  { key: "transmute", label: "Transmute", method: "transmute_spores_to_enzyme", blurb: "Fermenter: spores → enzymes (2 ATP + fee)" },
  { key: "synthesize", label: "Synthesize", method: "synthesize_elixir", blurb: "Synthesizer: enzymes → elixirs (3 ATP + fee)" },
  { key: "npc", label: "Buy spores", method: "npc_buy_spores", blurb: "buy spore-ignis from a merchant, quote first" },
  { key: "hungry", label: "Hungry strains", method: "adopt · hostile_takeover_splice · harvest_starving_strain", blurb: "adopt, take over or harvest other players' Snaccs" },
  { key: "pool", label: "Industrial pool", method: "synthesize_and_redeem_aether · claim_industrial_dividend", blurb: "burn elixir-aether, claim closed epochs" },
  { key: "gift", label: "Give a Snacc", method: "nft_transfer", blurb: "send a whole Snacc to another account" },
  { key: "send", label: "Send $SNACC", method: "ft_transfer", blurb: "send wallet $SNACC to a registered account" },
];

export interface GameActionProps extends ChainActionProps {
  /** Strain to preselect when the account owns it (plate selection or Strain Detail). */
  preferredStrainId?: number | null;
}

// ---------------------------------------------------------------- shared pieces

/** Reads `fn` when `deps` change; `null` while loading or when the chain did not answer. */
function useView<T>(fn: ((signal: AbortSignal) => Promise<T | null>) | null, deps: readonly unknown[]): { data: T | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; loading: boolean }>({ data: null, loading: fn !== null });
  useEffect(() => {
    if (!fn) {
      setState({ data: null, loading: false });
      return;
    }
    const ac = new AbortController();
    setState((s) => ({ data: s.data, loading: true }));
    void fn(ac.signal).then((data) => {
      if (!ac.signal.aborted) setState({ data, loading: false });
    });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** `onDone` that also bumps a local key so the window re-reads its views after a success. */
function useReload(onDone: (ok: boolean, txHash?: string | null) => void): [number, (ok: boolean, txHash?: string | null) => void] {
  const [key, setKey] = useState(0);
  return [
    key,
    (ok: boolean, txHash?: string | null) => {
      if (ok) setKey((k) => k + 1);
      onDone(ok, txHash);
    },
  ];
}

const dash = (v: ReactNode | null | undefined) => (v === null || v === undefined ? "—" : v);
const roleText = (mask: number) => rolesOf(mask).join(" + ") || "no role";

function Kv({ rows, testId }: { rows: [string, ReactNode][]; testId?: string }) {
  return (
    <dl className="fd-kv" data-testid={testId}>
      {rows.map(([k, v]) => (
        <div key={k} className="fd-kv__row">
          <dt>{k}</dt>
          <dd className="fd-kv__num">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ConnectLine({ wallet }: { wallet: WalletApi }) {
  if (wallet.accountId) return null;
  return (
    <div className="fd-note" role="status" data-testid="connect-line">
      <strong>Connect a wallet to sign this on testnet.</strong> The reads below are live; nothing is sent until you connect and approve.
      <div className="fd-row mt-2">
        <KeycapButton icon="user" onClick={() => void wallet.connect()} disabled={wallet.status === "connecting"}>
          connect wallet
        </KeycapButton>
      </div>
    </div>
  );
}

/** Your living strains (`get_colony`), with a reason line when there are none. */
function StrainPicker({
  id,
  label,
  info,
  value,
  onChange,
  disabled,
  exclude,
}: {
  id: string;
  label: string;
  info: AccountInfo;
  value: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
  exclude?: number | null;
}) {
  const owned = (info.colony ?? []).filter((s) => s.strain_id !== exclude);
  if (info.colony === null) {
    return <p className="fd-field__hint" role="status">{info.loading ? "Reading your colony…" : "Your colony is not read yet (connect a wallet, or the RPC did not answer)."}</p>;
  }
  if (owned.length === 0) {
    return (
      <p className="fd-field__hint" role="status" data-testid={`${id}-empty`}>
        No living Snacc to pick here. Hatch one first.
      </p>
    );
  }
  return (
    <Field id={id} label={label}>
      <Select id={id} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled}>
        {owned.map((s) => (
          <option key={s.strain_id} value={s.strain_id}>
            {`#${s.strain_id} · ${roleText(s.role_mask)} · vitality ${s.effective_vitality.toLocaleString("en-US")} · gen ${s.generation}`}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function pickInitial(info: AccountInfo, preferred: number | null | undefined, exclude?: number | null): number | null {
  const owned = (info.colony ?? []).filter((s) => s.strain_id !== exclude);
  return owned.find((s) => s.strain_id === preferred)?.strain_id ?? owned[0]?.strain_id ?? null;
}

/** Selected strain id that follows the colony once it loads. */
function useStrainChoice(info: AccountInfo, preferred: number | null | undefined, exclude?: number | null) {
  const [chosen, setChosen] = useState<number | null>(null);
  const owned = info.colony ?? [];
  const valid = chosen !== null && owned.some((s) => s.strain_id === chosen) && chosen !== exclude;
  return [valid ? chosen : pickInitial(info, preferred, exclude), setChosen] as const;
}

/** Cost lines, storage and faucet hints, the blocked reason, the tx status and the sign button. */
function SignBlock({
  wallet,
  info,
  calls,
  phase,
  send,
  onClose,
  blocked,
  label,
  testId,
}: {
  wallet: WalletApi;
  info: AccountInfo;
  calls: ContractCall[];
  phase: TxPhase;
  send: (calls: ContractCall[]) => Promise<void>;
  onClose: () => void;
  blocked: string | null;
  label: string;
  testId: string;
}) {
  const busy = phase.kind === "pending";
  const done = phase.kind === "done" && phase.result.ok;
  const connected = Boolean(wallet.accountId);
  const attached = totalDeposit(calls);
  const gas = maxGasFeeYocto(calls);
  const reason = !connected ? "Connect a wallet first." : blocked;
  return (
    <>
      {calls.length ? (
        <Kv
          rows={[
            ["attached", BigInt(attached) === 0n ? "0 NEAR" : BigInt(attached) === 1n ? "1 yoctoNEAR" : `${formatYocto(attached, 6)} NEAR`],
            ["gas, at most", `${formatYocto(gas)} NEAR (unused gas is refunded)`],
          ]}
        />
      ) : null}
      {connected ? <StorageLine info={info} /> : null}
      {connected && calls.length ? <FaucetLine needYocto={(BigInt(attached) + BigInt(gas)).toString()} info={info} /> : null}
      {reason && !done ? (
        <p className="fd-field__hint fd-field__hint--bad" data-testid={`${testId}-blocked`}>
          {reason}
        </p>
      ) : null}
      <TxStatusView phase={phase} />
      <div className="fd-row">
        {done ? (
          <KeycapButton variant="primary" icon="check" onClick={onClose}>
            close
          </KeycapButton>
        ) : (
          <KeycapButton variant="primary" icon="spark" disabled={Boolean(reason) || calls.length === 0 || busy} onClick={() => void send(calls)} data-testid={`${testId}-sign`}>
            {busy ? "waiting for wallet…" : label}
          </KeycapButton>
        )}
      </div>
    </>
  );
}

function useVessel(strainId: number | null, reload: number) {
  return useView<StrainDetail>(strainId === null ? null : (s) => fetchVessel(strainId, s), [strainId, reload]);
}

const vesselBlocked = (v: StrainDetail | null, loading: boolean): string | null => {
  if (!v) return loading ? "Reading the Snacc from testnet…" : "Pick a Snacc you own (or the strain read failed).";
  if (v.status === "Liquidated" || v.status === "SplicedBurned") return "This Snacc is no longer alive.";
  return null;
};

// ---------------------------------------------------------------- action menu

export function ActionMenuModal({ onPick, onClose, connected }: { onPick: (key: GameActionKey) => void; onClose: () => void; connected: boolean }) {
  return (
    <Modal title="actions.tx" heading="Game actions" onClose={onClose} testId="action-menu" footer={<Footer />}>
      <div className="fd-stack">
        {!connected ? (
          <p className="fd-field__hint" role="status">
            Every action is signed in your wallet on testnet. You can open each one to see its rules and live reads before connecting.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="list">
          {GAME_ACTIONS.map((a) => (
            <KeycapButton key={a.key} block onClick={() => onPick(a.key)} data-testid={`action-${a.key}`} className="!h-auto min-w-0 flex-col !items-start gap-0.5 !py-2 text-left" role="listitem">
              <span className="w-full min-w-0 font-semibold">{a.label}</span>
              <span className="fd-field__hint block w-full min-w-0 whitespace-normal break-words text-left">{a.blurb}</span>
            </KeycapButton>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- allocate_atp

const SLOTS: { key: keyof OrganelLevels; name: string; effect: string }[] = [
  { key: "mitokondria", name: "mitochondria", effect: "+10% ATP minted per level when you feed" },
  { key: "nukleus", name: "nucleus", effect: "+10% production output per level" },
  { key: "lisosom", name: "lysosome", effect: "−10% hunger (BMR) per level" },
];

export function AllocateAtpModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const [reload, done] = useReload(onDone);
  const { phase, send } = useSend(wallet, done);
  const [strainId, setStrainId] = useStrainChoice(info, preferredStrainId);
  const vessel = useVessel(strainId, reload);
  const macro = useView(fetchMacroInfo, [reload]);
  const now = useView(fetchContractNowSec, [reload]);
  const v = vessel.data;
  const [target, setTarget] = useState<OrganelLevels | null>(null);
  useEffect(() => setTarget(v ? { ...v.organel } : null), [v?.strain_id, v?.state_nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = v?.organel ?? { mitokondria: 0, nukleus: 0, lisosom: 0 };
  const levels = target ?? current;
  const atp = v ? BigInt(v.atp_balance) : 0n;
  const check = checkAllocation({
    status: v?.status ?? "Active",
    atp,
    current,
    target: levels,
    lastAllocateEpoch: v?.last_allocate_epoch ?? null,
    currentEpoch: macro.data?.currentEpoch ?? null,
  });
  const calls = useMemo(
    () => plan(v && check.ok ? buildAllocateAtp({ strainId: v.strain_id, ...levels }) : null, wallet.accountId ?? "", info),
    [v, check.ok, levels.mitokondria, levels.nukleus, levels.lisosom, wallet.accountId, info], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const left = macro.data && now.data !== null ? macro.data.epochEndsSec - now.data : null;
  const busy = phase.kind === "pending";

  return (
    <Modal title="allocate.tx" heading="Allocate ATP" onClose={onClose} testId="allocate-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>Set each organelle level from 0 to {MAX_ORGANEL_LEVEL}.</strong> Every level you add costs 1 ATP from this Snacc; lowering a level is free. One
          allocation per Snacc per epoch.
        </p>
        <StrainPicker id="allocate-strain" label="your snacc" info={info} value={strainId} onChange={setStrainId} disabled={busy} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="organelle levels">
          {SLOTS.map((s) => (
            <div key={s.key} className="fd-stack border border-[var(--ink-hi)] bg-[var(--paper)] p-2" style={{ gap: 4 }}>
              <span className="fd-field__label">{s.name}</span>
              <div className="fd-row" style={{ gap: 6 }}>
                <KeycapButton
                  mono
                  aria-label={`lower ${s.name}`}
                  disabled={!v || busy || levels[s.key] <= 0}
                  onClick={() => setTarget({ ...levels, [s.key]: levels[s.key] - 1 })}
                >
                  −
                </KeycapButton>
                <span className="fd-num text-sm font-semibold" data-testid={`allocate-${s.key}`}>
                  {v ? `${current[s.key]} → ${levels[s.key]}` : "—"}
                </span>
                <KeycapButton
                  mono
                  aria-label={`raise ${s.name}`}
                  disabled={!v || busy || levels[s.key] >= MAX_ORGANEL_LEVEL}
                  onClick={() => setTarget({ ...levels, [s.key]: levels[s.key] + 1 })}
                >
                  +
                </KeycapButton>
              </div>
              <span className="fd-field__hint">{s.effect}</span>
            </div>
          ))}
        </div>
        <Kv
          testId="allocate-cost"
          rows={[
            ["cost", v ? `${check.cost} ATP` : "—"],
            ["this snacc's ATP", v ? `${v.atp_balance} → ${v && BigInt(check.cost) <= atp ? (atp - BigInt(check.cost)).toString() : "not enough"}` : "—"],
            ["epoch", dash(macro.data?.currentEpoch)],
            [
              "epoch closes",
              left === null ? "—" : left > 0 ? `in ${formatCountdown(left)} (contract clock)` : "ended; it closes when anyone calls advance_epoch",
            ],
            [
              "last allocation",
              !v || v.last_allocate_epoch === undefined ? "—" : v.last_allocate_epoch > 1e15 ? "never" : `epoch ${v.last_allocate_epoch}`,
            ],
          ]}
        />
        <SignBlock
          wallet={wallet}
          info={info}
          calls={calls}
          phase={phase}
          send={send}
          onClose={onClose}
          blocked={vesselBlocked(v, vessel.loading) ?? (check.ok ? null : check.reason)}
          label="sign and allocate"
          testId="allocate"
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- divide_strain + splice_strains

export function DivideModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const [reload, done] = useReload(onDone);
  const { phase, send } = useSend(wallet, done);
  const [strainId, setStrainId] = useStrainChoice(info, preferredStrainId);
  const vessel = useVessel(strainId, reload);
  const macro = useView(fetchMacroInfo, [reload]);
  const v = vessel.data;
  const colonySize = info.colony?.length ?? null;
  const check = v
    ? checkDivide({
        status: v.status,
        effectiveVitality: v.effective_vitality,
        atp: BigInt(v.atp_balance),
        generation: v.generation,
        colonySize,
        birthBudget: macro.data?.birthBudget ?? null,
      })
    : null;
  const calls = useMemo(() => plan(v && check?.ok ? buildDivide({ strainId: v.strain_id }) : null, wallet.accountId ?? "", info), [v, check?.ok, wallet.accountId, info]);

  return (
    <Modal title="divide.tx" heading="Divide a Snacc" onClose={onClose} testId="divide-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>Cell division.</strong> The child gets half of the parent&apos;s $SNACC, vitality and spore-ignis; organelles are split between them. The child is one
          generation newer.
        </p>
        <StrainPicker id="divide-strain" label="parent snacc" info={info} value={strainId} onChange={setStrainId} disabled={phase.kind === "pending"} />
        <Kv
          testId="divide-rules"
          rows={[
            ["ATP cost", `${ATP_COST.divide} ATP (this Snacc has ${v ? v.atp_balance : "—"})`],
            ["colony", `${dash(colonySize)} / ${MAX_COLONY_SIZE} living Snaccs`],
            ["generation", v ? `${v.generation} → child ${v.generation + 1} (max ${MAX_GENERATION})` : `max ${MAX_GENERATION}`],
            ["divisions open", macro.data ? `${Math.max(0, macro.data.birthBudget)} (total divides ≤ mergers + lyses)` : "—"],
          ]}
        />
        <SignBlock
          wallet={wallet}
          info={info}
          calls={calls}
          phase={phase}
          send={send}
          onClose={onClose}
          blocked={vesselBlocked(v, vessel.loading) ?? (check && !check.ok ? check.reason : null)}
          label="sign and divide"
          testId="divide"
        />
      </div>
    </Modal>
  );
}

export function SpliceModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const { phase, send } = useSend(wallet, onDone);
  const [dominant, setDominant] = useStrainChoice(info, preferredStrainId);
  const [absorbed, setAbsorbed] = useStrainChoice(info, null, dominant);
  const owned = info.colony ?? [];
  const dom = owned.find((s) => s.strain_id === dominant) ?? null;
  const abs = owned.find((s) => s.strain_id === absorbed) ?? null;
  let blocked: string | null = null;
  if (!dom || !abs) blocked = "Splicing needs two living Snaccs in your colony.";
  else if (dom.effective_vitality <= 0) blocked = "A starving dominant Snacc (vitality 0) cannot splice. Feed it first.";
  else if (dom.generation + 1 > MAX_GENERATION) blocked = `The dominant Snacc would reach generation ${dom.generation + 1}; the limit is ${MAX_GENERATION}.`;
  const calls = useMemo(
    () => plan(!blocked && dom && abs ? buildSplice({ dominantId: dom.strain_id, absorbedId: abs.strain_id }) : null, wallet.accountId ?? "", info),
    [blocked, dom, abs, wallet.accountId, info],
  );
  return (
    <Modal title="splice.tx" heading="Splice two Snaccs" onClose={onClose} testId="splice-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>Voluntary merger of two of your own Snaccs.</strong> {MERGER_TAX_BPS / 100}% of the absorbed Snacc&apos;s $SNACC goes to the contract treasury as merger
          tax; the dominant one takes the other 97.5%, all its molecules and its roles, gains one generation and +8% efficiency. The absorbed Snacc ends as{" "}
          <code>SplicedBurned</code> and cannot be used again.
        </p>
        <div className="fd-form-grid">
          <StrainPicker id="splice-dominant" label="dominant (keeps living)" info={info} value={dominant} onChange={setDominant} />
          <StrainPicker id="splice-absorbed" label="absorbed (is burnt)" info={info} value={absorbed} onChange={setAbsorbed} exclude={dominant} />
        </div>
        {dom && abs ? (
          <Kv rows={[["roles after", roleText(dom.role_mask | abs.role_mask)], ["generation after", `${dom.generation + 1} (max ${MAX_GENERATION})`]]} />
        ) : null}
        <SignBlock wallet={wallet} info={info} calls={calls} phase={phase} send={send} onClose={onClose} blocked={blocked} label="sign and splice" testId="splice" />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- extract / transmute / synthesize

type ProduceTab = "extract" | "transmute" | "synthesize";
const TAB_ROLE: Record<ProduceTab, StrainRole> = { extract: "Extractor", transmute: "Fermenter", synthesize: "Synthesizer" };
const TAB_CONST: Record<ProduceTab, string> = { extract: "ROLE_EXTRACTOR", transmute: "ROLE_FERMENTER", synthesize: "ROLE_SYNTHESIZER" };
const short = (id: string) => id.replace(/^mt:/, "");

function InventoryLine({ inv }: { inv: Inventory | null }) {
  if (!inv) return <p className="fd-field__hint">inventory: —</p>;
  const items = Object.entries(inv).filter(([, n]) => (n ?? 0n) > 0n);
  return (
    <p className="fd-field__hint" data-testid="inventory-line">
      inventory: {items.length ? items.map(([id, n]) => `${short(id)} ${n}`).join(" · ") : "empty"}
    </p>
  );
}

export function ProduceModal({ wallet, info, onClose, onDone, preferredStrainId, initialTab = "extract" }: GameActionProps & { initialTab?: ProduceTab }) {
  const [tab, setTab] = useState<ProduceTab>(initialTab);
  const [reload, done] = useReload(onDone);
  const { phase, send } = useSend(wallet, done);
  const [strainId, setStrainId] = useStrainChoice(info, preferredStrainId);
  const vessel = useVessel(strainId, reload);
  const inv = useView<Inventory>(strainId === null ? null : (s) => fetchInventory(strainId, s), [strainId, reload]);
  const macro = useView(fetchMacroInfo, [reload]);
  const v = vessel.data;
  const [fee, setFee] = useState(DEFAULT_CATALYST_FEE_NEAR);
  const [spore, setSpore] = useState<SporeType>("mt:spore-ignis");
  const [burn, setBurn] = useState("2");
  const [elixir, setElixir] = useState<ElixirType>("mt:elixir-homeostasis");
  const [enzymes, setEnzymes] = useState(String(ELIXIR_RECIPES["mt:elixir-homeostasis"].batch));
  const feeYocto = parseNear(fee);
  const role = TAB_ROLE[tab];
  const atp = v ? BigInt(v.atp_balance) : 0n;

  let blocked = vesselBlocked(v, vessel.loading);
  if (!blocked && v && !hasRole(v.role_mask, role)) {
    blocked = `Snacc #${v.strain_id} is ${roleText(v.role_mask)}. ${tab[0].toUpperCase()}${tab.slice(1)} needs the ${role} role (${TAB_CONST[tab]}). Hatch a ${role} or splice one in.`;
  }
  if (!blocked && v && v.effective_vitality <= 0) blocked = "A starving Snacc (vitality 0) cannot work. Feed it first.";
  if (!blocked && v && atp < BigInt(ATP_COST[tab])) blocked = `This step costs ${ATP_COST[tab]} ATP; this Snacc has ${v.atp_balance}.`;
  if (!blocked && feeYocto === null) blocked = "Enter the catalyst fee in NEAR, e.g. 0.001.";

  let call: ContractCall | null = null;
  let detail: [string, ReactNode][] = [];
  const nucleus = v?.organel.nukleus ?? 0;
  if (tab === "extract") {
    detail = [["output", `+1 ${short(spore)}`]];
    if (!blocked && v && feeYocto !== null) call = buildExtract({ strainId: v.strain_id, sporeType: spore, feeYocto });
  } else if (tab === "transmute") {
    const n = Number(burn);
    const diet = v && macro.data ? transmuteDietBps({ roleMask: v.role_mask, tempMk: macro.data.crucibleTempMk, feverMk: macro.data.feverMk, hypothermiaMk: macro.data.hypothermiaMk }) : 0;
    const preview = inv.data && v ? transmutePreview(inv.data, n, v.efficiency_bps, nucleus) : null;
    detail = [
      ["recipe", preview ? `${preview.burns.map(([id, k]) => `${k} ${short(id)}`).join(" + ")} → ${preview.minted} ${short(preview.enzyme)}` : "—"],
      ["diet discount", macro.data ? `${diet / 100}% (zone at ${macro.data.crucibleTempMk} mK)` : "—"],
      ["fee attached", feeYocto !== null ? `${formatYocto(transmuteDeposit(feeYocto, diet), 6)} NEAR` : "—"],
    ];
    if (!blocked && (!Number.isSafeInteger(n) || n <= 0 || n % 2 !== 0)) blocked = "Spores to burn must be a positive even number (recipes use batches of 2).";
    if (!blocked && !macro.data) blocked = "Waiting for the zone read (the transmute fee depends on it).";
    if (!blocked && inv.data && !preview) blocked = "Not enough spores for any recipe: 2 ignis → amalgam, 1 ignis + 1 lumin → redactase, or 2 cryo → synthase (per batch).";
    if (!blocked && v && feeYocto !== null) call = buildTransmute({ strainId: v.strain_id, sporesToBurn: n, feeYocto, dietBps: diet });
  } else {
    const n = Number(enzymes);
    const r = ELIXIR_RECIPES[elixir];
    const preview = synthesizePreview(elixir, n, nucleus);
    detail = [
      ["recipe per batch", `${r.perA} ${short(r.a)} + ${r.perB} ${short(r.b)} (${r.batch} enzymes)`],
      ["output", preview ? `${preview.minted} ${short(elixir)}` : "—"],
    ];
    if (!blocked && !preview) blocked = `Enzymes to burn must be a positive multiple of ${r.batch} for ${short(elixir)}.`;
    if (!blocked && r.needsTrait && v && !v.phenotype_trait) blocked = "Elixir-aether needs a Snacc that had a verified TEE mutation (phenotype trait); this one has none.";
    if (!blocked && preview && inv.data && ((inv.data[preview.needA[0]] ?? 0n) < preview.needA[1] || (inv.data[preview.needB[0]] ?? 0n) < preview.needB[1])) {
      blocked = `Needs ${preview.needA[1]} ${short(preview.needA[0])} and ${preview.needB[1]} ${short(preview.needB[0])}.`;
    }
    if (!blocked && v && feeYocto !== null) call = buildSynthesize({ strainId: v.strain_id, elixirType: elixir, enzymesToBurn: n, feeYocto });
  }
  const calls = useMemo(() => plan(call, wallet.accountId ?? "", info), [JSON.stringify(call), wallet.accountId, info]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = phase.kind === "pending";

  return (
    <Modal title="produce.tx" heading="Production chain" onClose={onClose} testId="produce-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <Tabs
          label="production step"
          idBase="produce"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "extract", label: "extract" },
            { id: "transmute", label: "transmute" },
            { id: "synthesize", label: "synthesize" },
          ]}
        />
        <TabPanel idBase="produce" id={tab}>
          <p className="fd-note">
            <strong>
              {tab === "extract" ? "Extract one spore." : tab === "transmute" ? "Turn spores into an enzyme." : "Turn enzymes into an elixir."}
            </strong>{" "}
            Needs the {role} role, {ATP_COST[tab]} ATP and a catalyst fee in NEAR attached to the call. The fee goes to the contract (part burnt in Fever, half of the
            rest to the industrial pool, the remainder to the treasury); it is not refunded.
          </p>
          <StrainPicker id="produce-strain" label="your snacc" info={info} value={strainId} onChange={setStrainId} disabled={busy} />
          <InventoryLine inv={inv.data} />
          <div className="fd-form-grid">
            {tab === "extract" ? (
              <Field id="produce-spore" label="spore type">
                <Select id="produce-spore" value={spore} onChange={(e) => setSpore(e.target.value as SporeType)} disabled={busy}>
                  {SPORE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {short(s)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : tab === "transmute" ? (
              <Field id="produce-burn" label="spores to burn (even)">
                <Input id="produce-burn" inputMode="numeric" value={burn} onChange={(e) => setBurn(e.target.value)} disabled={busy} autoComplete="off" />
              </Field>
            ) : (
              <>
                <Field id="produce-elixir" label="elixir">
                  <Select
                    id="produce-elixir"
                    value={elixir}
                    onChange={(e) => {
                      const next = e.target.value as ElixirType;
                      setElixir(next);
                      setEnzymes(String(ELIXIR_RECIPES[next].batch));
                    }}
                    disabled={busy}
                  >
                    {ELIXIR_TYPES.map((x) => (
                      <option key={x} value={x}>
                        {short(x)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="produce-enzymes" label="enzymes to burn">
                  <Input id="produce-enzymes" inputMode="numeric" value={enzymes} onChange={(e) => setEnzymes(e.target.value)} disabled={busy} autoComplete="off" />
                </Field>
              </>
            )}
            <Field id="produce-fee" label="catalyst fee (NEAR)" bad={feeYocto === null} hint={feeYocto === null ? "Enter an amount, e.g. 0.001." : "attached to the call as snacc_catalyst_fee"}>
              <Input id="produce-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} disabled={busy} autoComplete="off" />
            </Field>
          </div>
          <Kv testId="produce-detail" rows={[["ATP cost", `${ATP_COST[tab]} (this Snacc has ${v ? v.atp_balance : "—"})`], ...detail]} />
        </TabPanel>
        <SignBlock wallet={wallet} info={info} calls={calls} phase={phase} send={send} onClose={onClose} blocked={blocked} label={`sign and ${tab}`} testId="produce" />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- npc_buy_spores

export function NpcBuyModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const [reload, done] = useReload(onDone);
  const { phase, send } = useSend(wallet, done);
  const [strainId, setStrainId] = useStrainChoice(info, preferredStrainId);
  const [npcId, setNpcId] = useState<string>(NPC_IDS[0]);
  const [amount, setAmount] = useState("1");
  const n = Number(amount);
  const amountOk = Number.isSafeInteger(n) && n > 0;
  const quote = useView(amountOk ? (s) => fetchNpcQuote(npcId, n, s) : null, [npcId, n, amountOk, reload]);
  const stock = useView((s) => fetchNpcStock(npcId, s), [npcId, reload]);
  const inStrains = info.wealthYocto !== null && info.snaccYocto !== null ? BigInt(info.wealthYocto) - BigInt(info.snaccYocto) : null;
  let blocked: string | null = null;
  if (strainId === null) blocked = "Pick a Snacc you own; the spores land in it and its $SNACC pays.";
  else if (!amountOk) blocked = "Enter how many spores to buy (a whole number).";
  else if (stock.data !== null && n > stock.data) blocked = `The merchant has ${stock.data} spores left.`;
  else if (!quote.data) blocked = quote.loading ? "Getting the quote…" : "The quote did not load (npc_quote_spores).";
  const calls = useMemo(
    () => plan(!blocked && strainId !== null ? buildNpcBuy({ strainId, npcId, buyAmount: n }) : null, wallet.accountId ?? "", info),
    [blocked, strainId, npcId, n, wallet.accountId, info],
  );
  const busy = phase.kind === "pending";
  return (
    <Modal title="npc.tx" heading="Buy spores from a merchant" onClose={onClose} testId="npc-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>Quote first, then buy.</strong> The merchant sells spore-ignis; the price rises as its stock falls below target. The $SNACC is taken from the
          Snacc you pick and the spores are added to it. No NEAR is attached.
        </p>
        <div className="fd-form-grid">
          <Field id="npc-id" label="merchant">
            <Select id="npc-id" value={npcId} onChange={(e) => setNpcId(e.target.value)} disabled={busy}>
              {NPC_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="npc-amount" label="spores to buy" bad={!amountOk} hint={amountOk ? undefined : "a whole number above 0"}>
            <Input id="npc-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} autoComplete="off" />
          </Field>
        </div>
        <StrainPicker id="npc-strain" label="paying snacc" info={info} value={strainId} onChange={setStrainId} disabled={busy} />
        <Kv
          testId="npc-quote"
          rows={[
            ["stock", stock.data === null ? "—" : `${stock.data} spores`],
            ["unit price", quote.data ? `${quote.data.unitPrice} yocto-$SNACC` : "—"],
            ["total", quote.data ? `${quote.data.totalCost} yocto-$SNACC (${formatYocto(quote.data.totalCost.toString(), 8)} $SNACC)` : "—"],
            ["stock after", quote.data ? String(quote.data.stockAfter) : "—"],
            ["in your snaccs", inStrains === null ? "—" : `${formatYocto(inStrains.toString())} $SNACC (all strains together)`],
          ]}
        />
        {quote.data?.reasoning ? <p className="fd-field__hint">&ldquo;{quote.data.reasoning}&rdquo;</p> : null}
        <SignBlock wallet={wallet} info={info} calls={calls} phase={phase} send={send} onClose={onClose} blocked={blocked} label="sign and buy" testId="npc" />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- hungry strains: adopt / hostile / harvest

type SnackMode = "adopt" | "hostile" | "harvest";

export function HungryStrainsModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const [reload, done] = useReload(onDone);
  const { phase, send } = useSend(wallet, done);
  const list = useView((s) => fetchHungryStrains(wallet.accountId, s), [wallet.accountId, reload]);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const picked: HungryStrain | null = list.data?.items.find((h) => h.vessel.strain_id === pickedId) ?? null;
  const [mode, setMode] = useState<SnackMode>("adopt");
  const effectiveMode: SnackMode = picked?.kind === "starving" ? "harvest" : mode === "harvest" ? "adopt" : mode;
  const [raider, setRaider] = useStrainChoice(info, preferredStrainId);
  const targetId = picked?.vessel.strain_id ?? null;
  const owner = picked?.vessel.owner_id ?? null;
  const inv = useView<Inventory>(targetId === null ? null : (s) => fetchInventory(targetId, s), [targetId, reload]);
  const ownerSnacc = useView(owner === null ? null : (s) => fetchOwnerStrainSnacc(owner, s), [owner, reload]);
  const exact = ownerSnacc.data ? ownerSnacc.data.living <= 1 : false;
  const book = inv.data && ownerSnacc.data ? bookValue(ownerSnacc.data.inStrains, inv.data) : null;
  const colonySize = info.colony?.length ?? null;

  let blocked: string | null = null;
  let call: ContractCall | null = null;
  if (!picked) blocked = "Pick a hungry Snacc from the list.";
  else if (picked.vessel.pending_callbacks > 0) blocked = "That Snacc has a pending cross-contract call; try again shortly.";
  else if (effectiveMode === "harvest") call = buildHarvest({ targetId: picked.vessel.strain_id });
  else if (raider === null) blocked = "Pick one of your Snaccs to pay; its $SNACC covers the price.";
  else if (effectiveMode === "adopt" && colonySize !== null && colonySize >= MAX_COLONY_SIZE) blocked = `Your colony is full (${MAX_COLONY_SIZE} living Snaccs).`;
  else if (effectiveMode === "adopt") call = buildAdopt({ targetId: picked.vessel.strain_id, raiderStrainId: raider, expectedTargetNonce: picked.vessel.state_nonce });
  else call = buildHostileTakeover({ raiderStrainId: raider, distressedTargetId: picked.vessel.strain_id, expectedTargetNonce: picked.vessel.state_nonce });
  const calls = useMemo(() => plan(call, wallet.accountId ?? "", info), [JSON.stringify(call), wallet.accountId, info]); // eslint-disable-line react-hooks/exhaustive-deps
  const bound = (x: bigint) => `${exact ? "" : "at most "}${formatYocto(x.toString())} $SNACC`;
  const split = book !== null ? hostilePrice(book) : null;
  const harvest = ownerSnacc.data ? harvestSplit(ownerSnacc.data.inStrains) : null;

  return (
    <Modal title="hungry.tx" heading="Hungry strains nearby" onClose={onClose} testId="hungry-modal" size="lg" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>Other players&apos; Snaccs that are distressed (vitality 1 to {DISTRESSED_MAX.toLocaleString("en-US")}) or starving (0).</strong> Only the owner can
          feed a Snacc. Anyone can adopt or take over a distressed one, and harvest a starving one.
        </p>
        {list.loading && !list.data ? (
          <p className="fd-field__hint" role="status">
            Scanning strains on testnet…
          </p>
        ) : !list.data ? (
          <p className="fd-field__hint fd-field__hint--bad" role="status">
            The testnet RPC did not answer. Nothing is shown in its place.
          </p>
        ) : list.data.items.length === 0 ? (
          <p className="fd-field__hint" role="status" data-testid="hungry-empty">
            No other player&apos;s Snacc is distressed or starving right now ({list.data.scanned} of {list.data.total} strains scanned).
          </p>
        ) : (
          <ul className="fd-stack" style={{ gap: 6 }} data-testid="hungry-list">
            {list.data.items.map((h) => (
              <li key={h.vessel.strain_id}>
                <KeycapButton
                  block
                  aria-pressed={pickedId === h.vessel.strain_id}
                  onClick={() => setPickedId(h.vessel.strain_id)}
                  style={{ whiteSpace: "normal", height: "auto", flexWrap: "wrap", justifyContent: "space-between", textAlign: "left", maxWidth: "100%", minWidth: 0, columnGap: 12 }}
                >
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{`#${h.vessel.strain_id} · ${roleText(h.vessel.role_mask)} · ${h.vessel.owner_id}`}</span>
                  <span className="fd-num">{h.kind === "starving" ? "starving · vitality 0" : `distressed · vitality ${h.vessel.effective_vitality.toLocaleString("en-US")}`}</span>
                </KeycapButton>
              </li>
            ))}
          </ul>
        )}
        {picked ? (
          <div className="fd-stack border-t border-dashed border-[var(--rule-dash)] pt-3">
            {picked.kind === "distressed" ? (
              <Tabs
                label="what to do"
                idBase="snack"
                value={effectiveMode}
                onChange={(m) => setMode(m)}
                tabs={[
                  { id: "adopt", label: "adopt" },
                  { id: "hostile", label: "hostile takeover" },
                ]}
              />
            ) : null}
            {effectiveMode === "harvest" ? (
              <p className="fd-note">
                <strong>harvest_starving_strain.</strong> Ends Snacc #{picked.vessel.strain_id} (status <code>Liquidated</code>): 10% of its $SNACC is credited to your
                account as a bounty, 90% goes to the contract treasury, and all its molecules are burnt. The owner gets nothing back.
              </p>
            ) : effectiveMode === "adopt" ? (
              <p className="fd-note">
                <strong>adopt.</strong> Snacc #{picked.vessel.strain_id} moves to your colony alive. Your paying Snacc pays its book value (its $SNACC + one unit per
                molecule), and 100% of that goes to the current owner <code>{picked.vessel.owner_id}</code>.
              </p>
            ) : (
              <p className="fd-note">
                <strong>hostile_takeover_splice.</strong> Your raiding Snacc pays book value + 15%: 95% to <code>{picked.vessel.owner_id}</code>, 5% to the treasury. It
                absorbs the target&apos;s $SNACC, molecules and roles, gains one generation, and Snacc #{picked.vessel.strain_id} ends as <code>SplicedBurned</code>.
              </p>
            )}
            {effectiveMode !== "harvest" ? (
              <StrainPicker id="snack-raider" label="your paying snacc" info={info} value={raider} onChange={setRaider} disabled={phase.kind === "pending"} />
            ) : null}
            <Kv
              testId="snack-terms"
              rows={[
                ["owner", <ExtLink key="o" href={explorerAccount(picked.vessel.owner_id)}>{picked.vessel.owner_id}</ExtLink>],
                ["molecules", inv.data ? String(Object.values(inv.data).reduce((a, b) => a + (b ?? 0n), 0n)) : "—"],
                ...(effectiveMode === "harvest"
                  ? ([
                      ["your bounty", harvest ? bound(harvest.bounty) : "—"],
                      ["to treasury", harvest ? bound(harvest.treasury) : "—"],
                    ] as [string, ReactNode][])
                  : effectiveMode === "adopt"
                    ? ([["book value", book !== null ? bound(book) : "—"]] as [string, ReactNode][])
                    : ([
                        ["price", split ? bound(split.payment) : "—"],
                        ["to the owner", split ? bound(split.seller) : "—"],
                        ["to treasury", split ? bound(split.treasury) : "—"],
                      ] as [string, ReactNode][])),
                ["state nonce", `${picked.vessel.state_nonce} (sent as expected_target_nonce)`],
              ]}
            />
            {!exact && ownerSnacc.data ? (
              <p className="fd-field__hint">
                The contract has no per-Snacc $SNACC view. The owner has {ownerSnacc.data.living} living Snaccs, so this is an upper bound; the contract computes the exact
                amount when it runs.
              </p>
            ) : null}
          </div>
        ) : null}
        <SignBlock
          wallet={wallet}
          info={info}
          calls={calls}
          phase={phase}
          send={send}
          onClose={onClose}
          blocked={blocked}
          label={effectiveMode === "harvest" ? "sign and harvest" : effectiveMode === "adopt" ? "sign and adopt" : "sign and take over"}
          testId="snack"
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- industrial pool: redeem aether + claim

export function DividendModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const [reload, done] = useReload(onDone);
  const { phase, send } = useSend(wallet, done);
  const [strainId, setStrainId] = useStrainChoice(info, preferredStrainId);
  const vessel = useVessel(strainId, reload);
  const pool = useView(fetchDividendPool, [reload]);
  const macro = useView(fetchMacroInfo, [reload]);
  const inv = useView<Inventory>(strainId === null ? null : (s) => fetchInventory(strainId, s), [strainId, reload]);
  const epochs = macro.data && pool.data ? claimableEpochs(macro.data.currentEpoch, pool.data.lastClosedEpoch) : [];
  const contribs = useView<Contribution[]>(
    strainId === null || epochs.length === 0
      ? null
      : async (s) => {
          const all = await Promise.all(epochs.map((e) => fetchContribution(e, strainId, s)));
          return all.some((c) => c === null) ? null : (all as Contribution[]);
        },
    [strainId, epochs.join(","), reload],
  );
  const current = macro.data && strainId !== null ? macro.data.currentEpoch : null;
  const currentContrib = useView(current === null || strainId === null ? null : (s) => fetchContribution(current, strainId, s), [current, strainId, reload]);
  const claimable = (contribs.data ?? []).filter((c) => !c.claimed && c.contribution > 0n);
  const [tab, setTab] = useState<"claim" | "redeem">("claim");
  const [claimEpoch, setClaimEpoch] = useState<number | null>(null);
  const epochToClaim = claimable.find((c) => c.epoch === claimEpoch)?.epoch ?? claimable[0]?.epoch ?? null;
  const [amount, setAmount] = useState("1");
  const v = vessel.data;
  const aether = inv.data?.["mt:elixir-aether"] ?? null;
  const amountRaw = parseUnits(amount, 0);

  let blocked = vesselBlocked(v, vessel.loading);
  let call: ContractCall | null = null;
  if (tab === "claim") {
    if (!blocked && pool.data && pool.data.pool === 0n) blocked = "The industrial pool is empty, so nothing is claimable.";
    if (!blocked && epochToClaim === null) blocked = contribs.loading ? "Reading your contributions…" : "Nothing to claim: no unclaimed contribution in a closed epoch of the last 8.";
    if (!blocked && v && epochToClaim !== null) call = buildClaimDividend({ strainId: v.strain_id, epoch: epochToClaim });
  } else {
    if (!blocked && v && !hasRole(v.role_mask, "Synthesizer")) blocked = `Redeeming needs the Synthesizer role; Snacc #${v.strain_id} is ${roleText(v.role_mask)}.`;
    if (!blocked && v && v.effective_vitality <= 0) blocked = "A starving Snacc (vitality 0) cannot redeem. Feed it first.";
    if (!blocked && (amountRaw === null || BigInt(amountRaw) < 1n)) blocked = "Enter a whole number of elixir-aether units (at least 1).";
    if (!blocked && aether !== null && amountRaw !== null && BigInt(amountRaw) > aether) blocked = `This Snacc holds ${aether} elixir-aether.`;
    if (!blocked && v && amountRaw !== null) call = buildRedeemAether({ strainId: v.strain_id, amount: amountRaw });
  }
  const calls = useMemo(() => plan(call, wallet.accountId ?? "", info), [JSON.stringify(call), wallet.accountId, info]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = phase.kind === "pending";

  return (
    <Modal title="pool.tx" heading="Industrial pool" onClose={onClose} testId="pool-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>Half of the catalyst fees that are not burnt flow into the industrial pool.</strong> Burning elixir-aether in an epoch records your share; after that
          epoch closes, your Snacc can claim its part of that epoch&apos;s inflow, paid into the Snacc in $SNACC, for up to 8 epochs. Payouts come only from the pool,
          nothing is minted, and an empty pool pays nothing.
        </p>
        <Kv
          testId="pool-totals"
          rows={[
            ["pool", pool.data ? `${formatYocto(pool.data.pool.toString())} $SNACC` : "—"],
            ["this epoch's inflow", pool.data ? `${formatYocto(pool.data.inflow.toString())} $SNACC` : "—"],
            ["epoch", macro.data ? `${macro.data.currentEpoch} (last closed ${pool.data ? pool.data.lastClosedEpoch : "—"})` : "—"],
            ["your aether burnt this epoch", currentContrib.data ? `${currentContrib.data.contribution}` : "—"],
          ]}
        />
        <StrainPicker id="pool-strain" label="your snacc" info={info} value={strainId} onChange={setStrainId} disabled={busy} />
        <Tabs
          label="pool step"
          idBase="pool"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "claim", label: "claim" },
            { id: "redeem", label: "burn aether" },
          ]}
        />
        <TabPanel idBase="pool" id={tab}>
          {tab === "claim" ? (
            claimable.length ? (
              <Field id="pool-epoch" label="closed epoch">
                <Select id="pool-epoch" value={epochToClaim ?? ""} onChange={(e) => setClaimEpoch(Number(e.target.value))} disabled={busy}>
                  {claimable.map((c) => (
                    <option key={c.epoch} value={c.epoch}>
                      {`epoch ${c.epoch} · contribution ${c.contribution} · about ${formatYocto(estimatePayout(c, pool.data?.pool ?? 0n).toString())} $SNACC`}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p className="fd-field__hint" data-testid="pool-none">
                {contribs.loading ? "Reading contributions…" : "No unclaimed contribution in the closed epochs this Snacc can still claim."}
              </p>
            )
          ) : (
            <Field id="pool-amount" label={`elixir-aether to burn (holds ${aether === null ? "—" : aether})`}>
              <Input id="pool-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} autoComplete="off" />
            </Field>
          )}
        </TabPanel>
        <SignBlock
          wallet={wallet}
          info={info}
          calls={calls}
          phase={phase}
          send={send}
          onClose={onClose}
          blocked={blocked}
          label={tab === "claim" ? "sign and claim" : "sign and burn aether"}
          testId="pool"
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- nft_transfer + ft_transfer

export function SendModal({ wallet, info, onClose, onDone, preferredStrainId, initialTab = "gift" }: GameActionProps & { initialTab?: "gift" | "send" }) {
  const [tab, setTab] = useState<"gift" | "send">(initialTab);
  const { phase, send } = useSend(wallet, onDone);
  const [strainId, setStrainId] = useStrainChoice(info, preferredStrainId);
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("0.1");
  const [registerToo, setRegisterToo] = useState(false);
  const rc = checkTestnetAccount(receiver, wallet.accountId);
  const rcId = rc.ok ? rc.id : null;
  const registered = useView(rcId && tab === "send" ? (s) => fetchRegistered(rcId, s) : null, [rcId, tab, phase.kind]);
  const amountYocto = parseUnits(amount, 24);
  const amountOk = amountYocto !== null && BigInt(amountYocto) > 0n;

  let blocked: string | null = rc.ok ? null : receiver.trim() ? rc.reason : "Enter the receiver's testnet account.";
  const calls: ContractCall[] = [];
  if (tab === "gift") {
    if (!blocked && strainId === null) blocked = "Pick a living Snacc to give.";
    if (!blocked && strainId !== null && rcId) calls.push(...plan(buildNftTransfer({ receiverId: rcId, strainId }), wallet.accountId ?? "", info));
  } else {
    if (!blocked && !amountOk) blocked = "Enter an amount of $SNACC, e.g. 0.1.";
    if (!blocked && info.snaccYocto !== null && amountYocto !== null && BigInt(amountYocto) > BigInt(info.snaccYocto)) {
      blocked = `Your wallet holds ${formatYocto(info.snaccYocto)} $SNACC. $SNACC inside your Snaccs is not in your wallet balance.`;
    }
    if (!blocked && registered.data === null) blocked = registered.loading ? "Checking the receiver's registration…" : "Could not read the receiver's registration.";
    if (!blocked && registered.data === false && !registerToo) blocked = "The receiver is not registered with the contract, so ft_transfer would fail. Tick the box to register them first (you pay the storage deposit).";
    if (!blocked && rcId && amountYocto !== null) {
      const transfer = buildFtTransfer({ receiverId: rcId, amountYocto });
      const base = plan(transfer, wallet.accountId ?? "", info);
      if (registered.data === false) base.splice(base.length - 1, 0, buildStorageDeposit({ accountId: rcId, minYocto: info.storage?.minYocto ?? STORAGE_MIN_FALLBACK_YOCTO }));
      calls.push(...base);
    }
  }
  const busy = phase.kind === "pending";

  return (
    <Modal title="send.tx" heading={tab === "gift" ? "Give a Snacc" : "Send $SNACC"} onClose={onClose} testId="send-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <Tabs
          label="what to send"
          idBase="send"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "gift", label: "give a snacc" },
            { id: "send", label: "send $SNACC" },
          ]}
        />
        <TabPanel idBase="send" id={tab}>
          {tab === "gift" ? (
            <>
              <p className="fd-note">
                <strong>nft_transfer.</strong> The whole Snacc moves to the receiver: its $SNACC, molecules, organelles and ATP go with it. You attach exactly 1
                yoctoNEAR (the standard transfer guard). This cannot be undone from your side.
              </p>
              <StrainPicker id="send-strain" label="snacc to give" info={info} value={strainId} onChange={setStrainId} disabled={busy} />
            </>
          ) : (
            <>
              <p className="fd-note">
                <strong>ft_transfer.</strong> Sends $SNACC from your wallet balance (not from inside your Snaccs). The receiver must be registered with the
                contract (NEP-145 storage). $SNACC on testnet has no monetary value.
              </p>
              <Field id="send-amount" label="amount ($SNACC)" bad={!amountOk} hint={`your wallet: ${info.snaccYocto === null ? "—" : formatYocto(info.snaccYocto)} $SNACC`}>
                <Input id="send-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} autoComplete="off" />
              </Field>
            </>
          )}
          <Field id="send-receiver" label="receiver (testnet account)" bad={Boolean(receiver.trim()) && !rc.ok} hint={receiver.trim() && !rc.ok ? rc.reason : "e.g. friend.testnet"}>
            <Input
              id="send-receiver"
              data-autofocus=""
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              disabled={busy}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(receiver.trim()) && !rc.ok}
              aria-describedby="send-receiver-hint"
            />
          </Field>
          {tab === "send" && rcId ? (
            <p className="fd-field__hint" data-testid="send-registration">
              {registered.data === null
                ? registered.loading
                  ? "checking registration…"
                  : "registration: —"
                : registered.data
                  ? `${rcId} is registered.`
                  : `${rcId} is not registered with the contract yet.`}
            </p>
          ) : null}
          {tab === "send" && registered.data === false ? (
            <label className="fd-row fd-field__hint" style={{ gap: 6 }}>
              <input type="checkbox" checked={registerToo} onChange={(e) => setRegisterToo(e.target.checked)} disabled={busy} />
              Register {rcId} first (storage_deposit, {formatYocto(info.storage?.minYocto ?? STORAGE_MIN_FALLBACK_YOCTO)} NEAR from you, once)
            </label>
          ) : null}
        </TabPanel>
        <SignBlock wallet={wallet} info={info} calls={calls} phase={phase} send={send} onClose={onClose} blocked={blocked} label={tab === "gift" ? "sign and give" : "sign and send"} testId="send" />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- router (the lazily loaded default export)

export interface GameActionWindowProps extends GameActionProps {
  action: "menu" | GameActionKey;
  onPick: (key: GameActionKey) => void;
}

export default function GameActionWindow({ action, onPick, ...props }: GameActionWindowProps) {
  switch (action) {
    case "menu":
      return <ActionMenuModal onPick={onPick} onClose={props.onClose} connected={Boolean(props.wallet.accountId)} />;
    case "allocate":
      return <AllocateAtpModal {...props} />;
    case "divide":
      return <DivideModal {...props} />;
    case "splice":
      return <SpliceModal {...props} />;
    case "extract":
    case "transmute":
    case "synthesize":
      return <ProduceModal key={action} {...props} initialTab={action} />;
    case "npc":
      return <NpcBuyModal {...props} />;
    case "hungry":
      return <HungryStrainsModal {...props} />;
    case "pool":
      return <DividendModal {...props} />;
    case "gift":
    case "send":
      return <SendModal key={action} {...props} initialTab={action} />;
  }
}
