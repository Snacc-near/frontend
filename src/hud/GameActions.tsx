/**
 * UI-150: every player action of the Snacc contract, signed through the connected wallet with the
 * same builder → window → tx status pattern as Hatch and Feed (`ChainActions.tsx`).
 *
 * Each window reads the views it needs (`get_strain`, `get_macro_state`, `get_sandbox_clock`,
 * `get_inventory`, `get_dividend_pool` and NPC views), checks the contract's guards before signing and says
 * why a button is disabled. After a successful transaction the window re-reads its views and the
 * app refreshes the account. Without a wallet the windows still show the live reads and a connect
 * button; nothing is signed. Values that could not be read show "—".
 *
 * UI-161 phase B2: every sentence a player reads comes from the `actions` dictionary (`useT()`), in
 * English or Indonesian. `GAME_ACTIONS` keeps the English label and blurb as data (tests, search); the
 * menu renders them from `actions.menu.<key>`. The reasons returned by the `check*` helpers in
 * `chain/actions.ts` are still English.
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
import type { Translate } from "../i18n/catalog.ts";
import { useT } from "../i18n/react.tsx";
import { Modal } from "../ui/Modal.tsx";
import { ExtLink, Field, Input, KeycapButton, Select, TabPanel, Tabs } from "../ui/controls.tsx";
import { Footer, FaucetLine, StorageLine, TxStatusView, plan, useSend, type ChainActionProps, type TxPhase } from "./ChainActions.tsx";

/** Windows reachable from the action menu, the dock and Strain Detail. */
export type GameActionKey = "allocate" | "divide" | "splice" | "extract" | "transmute" | "synthesize" | "npc" | "hungry" | "pool" | "gift" | "send";

/** English label and blurb as data; the menu shows `actions.menu.<key>.label` / `.blurb` in the reader's language. */
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

/** Contract status values, shown as code in the notes; they are the same in every language. */
const STATUS_SPLICED = "SplicedBurned";
const STATUS_LIQUIDATED = "Liquidated";

const dash = (v: ReactNode | null | undefined) => (v === null || v === undefined ? "—" : v);
/** Role names stay in English (game proper nouns); only "no role" is translated. */
const roleText = (t: Translate, mask: number) => rolesOf(mask).join(" + ") || t("actions.shared.noRole");

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
  const { t } = useT();
  if (wallet.accountId) return null;
  return (
    <div className="fd-note" role="status" data-testid="connect-line">
      <strong>{t("actions.shared.connectTitle")}</strong> {t("actions.shared.connectBody")}
      <div className="fd-row mt-2">
        <KeycapButton icon="user" onClick={() => void wallet.connect()} disabled={wallet.status === "connecting"}>
          {t("actions.shared.connectButton")}
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
  const { t } = useT();
  const owned = (info.colony ?? []).filter((s) => s.strain_id !== exclude);
  if (info.colony === null) {
    return <p className="fd-field__hint" role="status">{info.loading ? t("actions.shared.readingColony") : t("actions.shared.colonyNotRead")}</p>;
  }
  if (owned.length === 0) {
    return (
      <p className="fd-field__hint" role="status" data-testid={`${id}-empty`}>
        {t("actions.shared.noLiving")}
      </p>
    );
  }
  return (
    <Field id={id} label={label}>
      <Select id={id} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled}>
        {owned.map((s) => (
          <option key={s.strain_id} value={s.strain_id}>
            {t("actions.shared.strainOption", {
              id: s.strain_id,
              roles: roleText(t, s.role_mask),
              vitality: s.effective_vitality.toLocaleString("en-US"),
              gen: s.generation,
            })}
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
  const { t } = useT();
  const busy = phase.kind === "pending";
  const done = phase.kind === "done" && phase.result.ok;
  const connected = Boolean(wallet.accountId);
  const attached = totalDeposit(calls);
  const gas = maxGasFeeYocto(calls);
  const reason = !connected ? t("actions.shared.connectFirst") : blocked;
  return (
    <>
      {calls.length ? (
        <Kv
          rows={[
            [
              t("actions.shared.attached"),
              BigInt(attached) === 0n
                ? t("actions.shared.nearAmount", { amount: "0" })
                : BigInt(attached) === 1n
                  ? t("actions.shared.oneYocto")
                  : t("actions.shared.nearAmount", { amount: formatYocto(attached, 6) }),
            ],
            [t("actions.shared.gasAtMost"), t("actions.shared.gasValue", { amount: formatYocto(gas) })],
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
            {t("actions.shared.close")}
          </KeycapButton>
        ) : (
          <KeycapButton variant="primary" icon="spark" disabled={Boolean(reason) || calls.length === 0 || busy} onClick={() => void send(calls)} data-testid={`${testId}-sign`}>
            {busy ? (phase.kind === "pending" && phase.oneTap ? t("actions.shared.sendingOneTap") : t("actions.shared.waitingWallet")) : label}
          </KeycapButton>
        )}
      </div>
    </>
  );
}

function useVessel(strainId: number | null, reload: number) {
  return useView<StrainDetail>(strainId === null ? null : (s) => fetchVessel(strainId, s), [strainId, reload]);
}

const vesselBlocked = (t: Translate, v: StrainDetail | null, loading: boolean): string | null => {
  if (!v) return loading ? t("actions.shared.readingSnacc") : t("actions.shared.pickSnacc");
  if (v.status === "Liquidated" || v.status === "SplicedBurned") return t("actions.shared.notAlive");
  return null;
};

// ---------------------------------------------------------------- action menu

export function ActionMenuModal({ onPick, onClose, connected }: { onPick: (key: GameActionKey) => void; onClose: () => void; connected: boolean }) {
  const { t } = useT();
  return (
    <Modal title="actions.tx" heading={t("actions.menu.heading")} onClose={onClose} testId="action-menu" footer={<Footer />}>
      <div className="fd-stack">
        {!connected ? (
          <p className="fd-field__hint" role="status">
            {t("actions.menu.offline")}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="list">
          {GAME_ACTIONS.map((a) => (
            <KeycapButton key={a.key} block onClick={() => onPick(a.key)} data-testid={`action-${a.key}`} className="!h-auto min-w-0 flex-col !items-start gap-0.5 !py-2 text-left" role="listitem">
              <span className="w-full min-w-0 font-semibold">{t(`actions.menu.${a.key}.label`)}</span>
              <span className="fd-field__hint block w-full min-w-0 whitespace-normal break-words text-left">{t(`actions.menu.${a.key}.blurb`)}</span>
            </KeycapButton>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- allocate_atp

const SLOTS: { key: keyof OrganelLevels }[] = [{ key: "mitokondria" }, { key: "nukleus" }, { key: "lisosom" }];

export function AllocateAtpModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const { t } = useT();
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
    <Modal title="allocate.tx" heading={t("actions.allocate.heading")} onClose={onClose} testId="allocate-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>{t("actions.allocate.noteTitle", { max: MAX_ORGANEL_LEVEL })}</strong> {t("actions.allocate.noteBody")}
        </p>
        <StrainPicker id="allocate-strain" label={t("actions.shared.yourSnacc")} info={info} value={strainId} onChange={setStrainId} disabled={busy} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={t("actions.allocate.levels")}>
          {SLOTS.map((s) => (
            <div key={s.key} className="fd-stack border border-[var(--ink-hi)] bg-[var(--paper)] p-2" style={{ gap: 4 }}>
              <span className="fd-field__label">{t(`actions.allocate.slot.${s.key}.name`)}</span>
              <div className="fd-row" style={{ gap: 6 }}>
                <KeycapButton
                  mono
                  aria-label={t("actions.allocate.lower", { name: t(`actions.allocate.slot.${s.key}.name`) })}
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
                  aria-label={t("actions.allocate.raise", { name: t(`actions.allocate.slot.${s.key}.name`) })}
                  disabled={!v || busy || levels[s.key] >= MAX_ORGANEL_LEVEL}
                  onClick={() => setTarget({ ...levels, [s.key]: levels[s.key] + 1 })}
                >
                  +
                </KeycapButton>
              </div>
              <span className="fd-field__hint">{t(`actions.allocate.slot.${s.key}.effect`)}</span>
            </div>
          ))}
        </div>
        <Kv
          testId="allocate-cost"
          rows={[
            [t("actions.allocate.cost"), v ? `${check.cost} ATP` : "—"],
            [
              t("actions.allocate.atpOf"),
              v ? `${v.atp_balance} → ${v && BigInt(check.cost) <= atp ? (atp - BigInt(check.cost)).toString() : t("actions.allocate.notEnough")}` : "—",
            ],
            [t("actions.allocate.epoch"), dash(macro.data?.currentEpoch)],
            [
              t("actions.allocate.closes"),
              left === null ? "—" : left > 0 ? t("actions.allocate.closesIn", { time: formatCountdown(left) }) : t("actions.allocate.ended"),
            ],
            [
              t("actions.allocate.last"),
              !v || v.last_allocate_epoch === undefined ? "—" : v.last_allocate_epoch > 1e15 ? t("actions.allocate.never") : t("actions.allocate.epochN", { n: v.last_allocate_epoch }),
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
          blocked={vesselBlocked(t, v, vessel.loading) ?? (check.ok ? null : check.reason)}
          label={t("actions.allocate.sign")}
          testId="allocate"
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- divide_strain + splice_strains

export function DivideModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const { t } = useT();
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
    <Modal title="divide.tx" heading={t("actions.divide.heading")} onClose={onClose} testId="divide-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>{t("actions.divide.noteTitle")}</strong> {t("actions.divide.noteBody")}
        </p>
        <StrainPicker id="divide-strain" label={t("actions.divide.parent")} info={info} value={strainId} onChange={setStrainId} disabled={phase.kind === "pending"} />
        <Kv
          testId="divide-rules"
          rows={[
            [t("actions.divide.atpCost"), t("actions.divide.atpCostValue", { cost: ATP_COST.divide, atp: v ? v.atp_balance : "—" })],
            [t("actions.divide.colony"), t("actions.divide.colonyValue", { n: String(dash(colonySize)), max: MAX_COLONY_SIZE })],
            [
              t("actions.divide.generation"),
              v ? t("actions.divide.generationValue", { gen: v.generation, child: v.generation + 1, max: MAX_GENERATION }) : t("actions.divide.generationMax", { max: MAX_GENERATION }),
            ],
            [t("actions.divide.open"), macro.data ? t("actions.divide.openValue", { n: Math.max(0, macro.data.birthBudget) }) : "—"],
          ]}
        />
        <SignBlock
          wallet={wallet}
          info={info}
          calls={calls}
          phase={phase}
          send={send}
          onClose={onClose}
          blocked={vesselBlocked(t, v, vessel.loading) ?? (check && !check.ok ? check.reason : null)}
          label={t("actions.divide.sign")}
          testId="divide"
        />
      </div>
    </Modal>
  );
}

export function SpliceModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const { t, rich } = useT();
  const { phase, send } = useSend(wallet, onDone);
  const [dominant, setDominant] = useStrainChoice(info, preferredStrainId);
  const [absorbed, setAbsorbed] = useStrainChoice(info, null, dominant);
  const owned = info.colony ?? [];
  const dom = owned.find((s) => s.strain_id === dominant) ?? null;
  const abs = owned.find((s) => s.strain_id === absorbed) ?? null;
  let blocked: string | null = null;
  if (!dom || !abs) blocked = t("actions.splice.needTwo");
  else if (dom.effective_vitality <= 0) blocked = t("actions.splice.starving");
  else if (dom.generation + 1 > MAX_GENERATION) blocked = t("actions.splice.genLimit", { gen: dom.generation + 1, max: MAX_GENERATION });
  const calls = useMemo(
    () => plan(!blocked && dom && abs ? buildSplice({ dominantId: dom.strain_id, absorbedId: abs.strain_id }) : null, wallet.accountId ?? "", info),
    [blocked, dom, abs, wallet.accountId, info],
  );
  return (
    <Modal title="splice.tx" heading={t("actions.splice.heading")} onClose={onClose} testId="splice-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>{t("actions.splice.noteTitle")}</strong> {rich("actions.splice.noteBody", { tax: MERGER_TAX_BPS / 100, status: <code>{STATUS_SPLICED}</code> })}
        </p>
        <div className="fd-form-grid">
          <StrainPicker id="splice-dominant" label={t("actions.splice.dominant")} info={info} value={dominant} onChange={setDominant} />
          <StrainPicker id="splice-absorbed" label={t("actions.splice.absorbed")} info={info} value={absorbed} onChange={setAbsorbed} exclude={dominant} />
        </div>
        {dom && abs ? (
          <Kv
            rows={[
              [t("actions.splice.rolesAfter"), roleText(t, dom.role_mask | abs.role_mask)],
              [t("actions.splice.genAfter"), t("actions.splice.genAfterValue", { gen: dom.generation + 1, max: MAX_GENERATION })],
            ]}
          />
        ) : null}
        <SignBlock wallet={wallet} info={info} calls={calls} phase={phase} send={send} onClose={onClose} blocked={blocked} label={t("actions.splice.sign")} testId="splice" />
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
  const { t } = useT();
  if (!inv) return <p className="fd-field__hint">{t("actions.produce.inventoryNone")}</p>;
  const items = Object.entries(inv).filter(([, n]) => (n ?? 0n) > 0n);
  return (
    <p className="fd-field__hint" data-testid="inventory-line">
      {t("actions.produce.inventory", { items: items.length ? items.map(([id, n]) => `${short(id)} ${n}`).join(" · ") : t("actions.produce.empty") })}
    </p>
  );
}

export function ProduceModal({ wallet, info, onClose, onDone, preferredStrainId, initialTab = "extract" }: GameActionProps & { initialTab?: ProduceTab }) {
  const { t } = useT();
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

  let blocked = vesselBlocked(t, v, vessel.loading);
  if (!blocked && v && !hasRole(v.role_mask, role)) {
    blocked = t("actions.produce.needsRole", { id: v.strain_id, roles: roleText(t, v.role_mask), step: t(`actions.produce.step.${tab}`), role, constant: TAB_CONST[tab] });
  }
  if (!blocked && v && v.effective_vitality <= 0) blocked = t("actions.produce.starving");
  if (!blocked && v && atp < BigInt(ATP_COST[tab])) blocked = t("actions.produce.costs", { cost: ATP_COST[tab], atp: v.atp_balance });
  if (!blocked && feeYocto === null) blocked = t("actions.produce.enterFee");

  let call: ContractCall | null = null;
  let detail: [string, ReactNode][] = [];
  const nucleus = v?.organel.nukleus ?? 0;
  if (tab === "extract") {
    detail = [[t("actions.produce.output"), `+1 ${short(spore)}`]];
    if (!blocked && v && feeYocto !== null) call = buildExtract({ strainId: v.strain_id, sporeType: spore, feeYocto });
  } else if (tab === "transmute") {
    const n = Number(burn);
    const diet = v && macro.data ? transmuteDietBps({ roleMask: v.role_mask, tempMk: macro.data.crucibleTempMk, feverMk: macro.data.feverMk, hypothermiaMk: macro.data.hypothermiaMk }) : 0;
    const preview = inv.data && v ? transmutePreview(inv.data, n, v.efficiency_bps, nucleus) : null;
    detail = [
      [t("actions.produce.recipe"), preview ? `${preview.burns.map(([id, k]) => `${k} ${short(id)}`).join(" + ")} → ${preview.minted} ${short(preview.enzyme)}` : "—"],
      [t("actions.produce.diet"), macro.data ? t("actions.produce.dietValue", { pct: diet / 100, mk: macro.data.crucibleTempMk }) : "—"],
      [t("actions.produce.feeAttached"), feeYocto !== null ? t("actions.shared.nearAmount", { amount: formatYocto(transmuteDeposit(feeYocto, diet), 6) }) : "—"],
    ];
    if (!blocked && (!Number.isSafeInteger(n) || n <= 0 || n % 2 !== 0)) blocked = t("actions.produce.evenBurn");
    if (!blocked && !macro.data) blocked = t("actions.produce.waitingZone");
    if (!blocked && inv.data && !preview) blocked = t("actions.produce.noRecipe");
    if (!blocked && v && feeYocto !== null) call = buildTransmute({ strainId: v.strain_id, sporesToBurn: n, feeYocto, dietBps: diet });
  } else {
    const n = Number(enzymes);
    const r = ELIXIR_RECIPES[elixir];
    const preview = synthesizePreview(elixir, n, nucleus);
    detail = [
      [t("actions.produce.recipeBatch"), t("actions.produce.recipeBatchValue", { perA: r.perA, a: short(r.a), perB: r.perB, b: short(r.b), batch: r.batch })],
      [t("actions.produce.output"), preview ? `${preview.minted} ${short(elixir)}` : "—"],
    ];
    if (!blocked && !preview) blocked = t("actions.produce.multiple", { batch: r.batch, elixir: short(elixir) });
    if (!blocked && r.needsTrait && v && !v.phenotype_trait) blocked = t("actions.produce.needsTrait");
    if (!blocked && preview && inv.data && ((inv.data[preview.needA[0]] ?? 0n) < preview.needA[1] || (inv.data[preview.needB[0]] ?? 0n) < preview.needB[1])) {
      blocked = t("actions.produce.needs", { a: String(preview.needA[1]), typeA: short(preview.needA[0]), b: String(preview.needB[1]), typeB: short(preview.needB[0]) });
    }
    if (!blocked && v && feeYocto !== null) call = buildSynthesize({ strainId: v.strain_id, elixirType: elixir, enzymesToBurn: n, feeYocto });
  }
  const calls = useMemo(() => plan(call, wallet.accountId ?? "", info), [JSON.stringify(call), wallet.accountId, info]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = phase.kind === "pending";

  return (
    <Modal title="produce.tx" heading={t("actions.produce.heading")} onClose={onClose} testId="produce-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <Tabs
          label={t("actions.produce.stepLabel")}
          idBase="produce"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "extract", label: t("actions.produce.tab.extract") },
            { id: "transmute", label: t("actions.produce.tab.transmute") },
            { id: "synthesize", label: t("actions.produce.tab.synthesize") },
          ]}
        />
        <TabPanel idBase="produce" id={tab}>
          <p className="fd-note">
            <strong>{t(`actions.produce.title.${tab}`)}</strong> {t("actions.produce.noteBody", { role, atp: ATP_COST[tab] })}
          </p>
          <StrainPicker id="produce-strain" label={t("actions.shared.yourSnacc")} info={info} value={strainId} onChange={setStrainId} disabled={busy} />
          <InventoryLine inv={inv.data} />
          <div className="fd-form-grid">
            {tab === "extract" ? (
              <Field id="produce-spore" label={t("actions.produce.sporeType")}>
                <Select id="produce-spore" value={spore} onChange={(e) => setSpore(e.target.value as SporeType)} disabled={busy}>
                  {SPORE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {short(s)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : tab === "transmute" ? (
              <Field id="produce-burn" label={t("actions.produce.sporesToBurn")}>
                <Input id="produce-burn" inputMode="numeric" value={burn} onChange={(e) => setBurn(e.target.value)} disabled={busy} autoComplete="off" />
              </Field>
            ) : (
              <>
                <Field id="produce-elixir" label={t("actions.produce.elixir")}>
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
                <Field id="produce-enzymes" label={t("actions.produce.enzymesToBurn")}>
                  <Input id="produce-enzymes" inputMode="numeric" value={enzymes} onChange={(e) => setEnzymes(e.target.value)} disabled={busy} autoComplete="off" />
                </Field>
              </>
            )}
            <Field id="produce-fee" label={t("actions.produce.feeLabel")} bad={feeYocto === null} hint={feeYocto === null ? t("actions.produce.feeBad") : t("actions.produce.feeHint")}>
              <Input id="produce-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} disabled={busy} autoComplete="off" />
            </Field>
          </div>
          <Kv testId="produce-detail" rows={[[t("actions.produce.atpCost"), t("actions.produce.atpCostValue", { cost: ATP_COST[tab], atp: v ? v.atp_balance : "—" })], ...detail]} />
        </TabPanel>
        <SignBlock wallet={wallet} info={info} calls={calls} phase={phase} send={send} onClose={onClose} blocked={blocked} label={t(`actions.produce.sign.${tab}`)} testId="produce" />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- npc_buy_spores

export function NpcBuyModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const { t } = useT();
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
  if (strainId === null) blocked = t("actions.npc.pick");
  else if (!amountOk) blocked = t("actions.npc.enterAmount");
  else if (stock.data !== null && n > stock.data) blocked = t("actions.npc.stockLeft", { n: stock.data });
  else if (!quote.data) blocked = quote.loading ? t("actions.npc.gettingQuote") : t("actions.npc.quoteFailed");
  const calls = useMemo(
    () => plan(!blocked && strainId !== null ? buildNpcBuy({ strainId, npcId, buyAmount: n }) : null, wallet.accountId ?? "", info),
    [blocked, strainId, npcId, n, wallet.accountId, info],
  );
  const busy = phase.kind === "pending";
  return (
    <Modal title="npc.tx" heading={t("actions.npc.heading")} onClose={onClose} testId="npc-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>{t("actions.npc.noteTitle")}</strong> {t("actions.npc.noteBody")}
        </p>
        <div className="fd-form-grid">
          <Field id="npc-id" label={t("actions.npc.merchant")}>
            <Select id="npc-id" value={npcId} onChange={(e) => setNpcId(e.target.value)} disabled={busy}>
              {NPC_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="npc-amount" label={t("actions.npc.amount")} bad={!amountOk} hint={amountOk ? undefined : t("actions.npc.amountHint")}>
            <Input id="npc-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} autoComplete="off" />
          </Field>
        </div>
        <StrainPicker id="npc-strain" label={t("actions.npc.payer")} info={info} value={strainId} onChange={setStrainId} disabled={busy} />
        <Kv
          testId="npc-quote"
          rows={[
            [t("actions.npc.stock"), stock.data === null ? "—" : t("actions.npc.stockValue", { n: stock.data })],
            [t("actions.npc.unitPrice"), quote.data ? t("actions.npc.unitPriceValue", { n: String(quote.data.unitPrice) }) : "—"],
            [
              t("actions.npc.total"),
              quote.data ? t("actions.npc.totalValue", { yocto: String(quote.data.totalCost), snacc: formatYocto(quote.data.totalCost.toString(), 8) }) : "—",
            ],
            [t("actions.npc.stockAfter"), quote.data ? String(quote.data.stockAfter) : "—"],
            [t("actions.npc.inSnaccs"), inStrains === null ? "—" : t("actions.npc.inSnaccsValue", { amount: formatYocto(inStrains.toString()) })],
          ]}
        />
        {quote.data?.reasoning ? <p className="fd-field__hint">&ldquo;{quote.data.reasoning}&rdquo;</p> : null}
        <SignBlock wallet={wallet} info={info} calls={calls} phase={phase} send={send} onClose={onClose} blocked={blocked} label={t("actions.npc.sign")} testId="npc" />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- hungry strains: adopt / hostile / harvest

type SnackMode = "adopt" | "hostile" | "harvest";

export function HungryStrainsModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const { t, rich } = useT();
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
  if (!picked) blocked = t("actions.hungry.pickOne");
  else if (picked.vessel.pending_callbacks > 0) blocked = t("actions.hungry.pending");
  else if (effectiveMode === "harvest") call = buildHarvest({ targetId: picked.vessel.strain_id });
  else if (raider === null) blocked = t("actions.hungry.pickPayer");
  else if (effectiveMode === "adopt" && colonySize !== null && colonySize >= MAX_COLONY_SIZE) blocked = t("actions.hungry.colonyFull", { max: MAX_COLONY_SIZE });
  else if (effectiveMode === "adopt") call = buildAdopt({ targetId: picked.vessel.strain_id, raiderStrainId: raider, expectedTargetNonce: picked.vessel.state_nonce });
  else call = buildHostileTakeover({ raiderStrainId: raider, distressedTargetId: picked.vessel.strain_id, expectedTargetNonce: picked.vessel.state_nonce });
  const calls = useMemo(() => plan(call, wallet.accountId ?? "", info), [JSON.stringify(call), wallet.accountId, info]); // eslint-disable-line react-hooks/exhaustive-deps
  const bound = (x: bigint) => t(exact ? "actions.hungry.exact" : "actions.hungry.atMost", { amount: formatYocto(x.toString()) });
  const split = book !== null ? hostilePrice(book) : null;
  const harvest = ownerSnacc.data ? harvestSplit(ownerSnacc.data.inStrains) : null;

  return (
    <Modal title="hungry.tx" heading={t("actions.hungry.heading")} onClose={onClose} testId="hungry-modal" size="lg" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>{t("actions.hungry.noteTitle", { max: DISTRESSED_MAX.toLocaleString("en-US") })}</strong> {t("actions.hungry.noteBody")}
        </p>
        {list.loading && !list.data ? (
          <p className="fd-field__hint" role="status">
            {t("actions.hungry.scanning")}
          </p>
        ) : !list.data ? (
          <p className="fd-field__hint fd-field__hint--bad" role="status">
            {t("actions.hungry.rpcDown")}
          </p>
        ) : list.data.items.length === 0 ? (
          <p className="fd-field__hint" role="status" data-testid="hungry-empty">
            {t("actions.hungry.none", { scanned: list.data.scanned, total: list.data.total })}
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
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{`#${h.vessel.strain_id} · ${roleText(t, h.vessel.role_mask)} · ${h.vessel.owner_id}`}</span>
                  <span className="fd-num">
                    {h.kind === "starving" ? t("actions.hungry.kindStarving") : t("actions.hungry.kindDistressed", { vitality: h.vessel.effective_vitality.toLocaleString("en-US") })}
                  </span>
                </KeycapButton>
              </li>
            ))}
          </ul>
        )}
        {picked ? (
          <div className="fd-stack border-t border-dashed border-[var(--rule-dash)] pt-3">
            {picked.kind === "distressed" ? (
              <Tabs
                label={t("actions.hungry.whatToDo")}
                idBase="snack"
                value={effectiveMode}
                onChange={(m) => setMode(m)}
                tabs={[
                  { id: "adopt", label: t("actions.hungry.tabAdopt") },
                  { id: "hostile", label: t("actions.hungry.tabHostile") },
                ]}
              />
            ) : null}
            {effectiveMode === "harvest" ? (
              <p className="fd-note">
                <strong>{t("actions.hungry.harvestTitle")}</strong> {rich("actions.hungry.harvestBody", { id: picked.vessel.strain_id, status: <code>{STATUS_LIQUIDATED}</code> })}
              </p>
            ) : effectiveMode === "adopt" ? (
              <p className="fd-note">
                <strong>{t("actions.hungry.adoptTitle")}</strong> {rich("actions.hungry.adoptBody", { id: picked.vessel.strain_id, owner: <code>{picked.vessel.owner_id}</code> })}
              </p>
            ) : (
              <p className="fd-note">
                <strong>{t("actions.hungry.hostileTitle")}</strong>{" "}
                {rich("actions.hungry.hostileBody", { owner: <code>{picked.vessel.owner_id}</code>, id: picked.vessel.strain_id, status: <code>{STATUS_SPLICED}</code> })}
              </p>
            )}
            {effectiveMode !== "harvest" ? (
              <StrainPicker id="snack-raider" label={t("actions.hungry.payingSnacc")} info={info} value={raider} onChange={setRaider} disabled={phase.kind === "pending"} />
            ) : null}
            <Kv
              testId="snack-terms"
              rows={[
                [t("actions.hungry.owner"), <ExtLink key="o" href={explorerAccount(picked.vessel.owner_id)}>{picked.vessel.owner_id}</ExtLink>],
                [t("actions.hungry.molecules"), inv.data ? String(Object.values(inv.data).reduce((a, b) => a + (b ?? 0n), 0n)) : "—"],
                ...(effectiveMode === "harvest"
                  ? ([
                      [t("actions.hungry.yourBounty"), harvest ? bound(harvest.bounty) : "—"],
                      [t("actions.hungry.toTreasury"), harvest ? bound(harvest.treasury) : "—"],
                    ] as [string, ReactNode][])
                  : effectiveMode === "adopt"
                    ? ([[t("actions.hungry.bookValue"), book !== null ? bound(book) : "—"]] as [string, ReactNode][])
                    : ([
                        [t("actions.hungry.price"), split ? bound(split.payment) : "—"],
                        [t("actions.hungry.toOwner"), split ? bound(split.seller) : "—"],
                        [t("actions.hungry.toTreasury"), split ? bound(split.treasury) : "—"],
                      ] as [string, ReactNode][])),
                [t("actions.hungry.nonce"), t("actions.hungry.nonceValue", { n: picked.vessel.state_nonce })],
              ]}
            />
            {!exact && ownerSnacc.data ? (
              <p className="fd-field__hint">{t("actions.hungry.upperBound", { living: ownerSnacc.data.living })}</p>
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
          label={effectiveMode === "harvest" ? t("actions.hungry.signHarvest") : effectiveMode === "adopt" ? t("actions.hungry.signAdopt") : t("actions.hungry.signTakeover")}
          testId="snack"
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- industrial pool: redeem aether + claim

export function DividendModal({ wallet, info, onClose, onDone, preferredStrainId }: GameActionProps) {
  const { t } = useT();
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

  let blocked = vesselBlocked(t, v, vessel.loading);
  let call: ContractCall | null = null;
  if (tab === "claim") {
    if (!blocked && pool.data && pool.data.pool === 0n) blocked = t("actions.pool.empty");
    if (!blocked && epochToClaim === null) blocked = contribs.loading ? t("actions.pool.readingContribs") : t("actions.pool.nothingToClaim");
    if (!blocked && v && epochToClaim !== null) call = buildClaimDividend({ strainId: v.strain_id, epoch: epochToClaim });
  } else {
    if (!blocked && v && !hasRole(v.role_mask, "Synthesizer")) blocked = t("actions.pool.needsRole", { id: v.strain_id, roles: roleText(t, v.role_mask) });
    if (!blocked && v && v.effective_vitality <= 0) blocked = t("actions.pool.starving");
    if (!blocked && (amountRaw === null || BigInt(amountRaw) < 1n)) blocked = t("actions.pool.enterAmount");
    if (!blocked && aether !== null && amountRaw !== null && BigInt(amountRaw) > aether) blocked = t("actions.pool.holds", { n: String(aether) });
    if (!blocked && v && amountRaw !== null) call = buildRedeemAether({ strainId: v.strain_id, amount: amountRaw });
  }
  const calls = useMemo(() => plan(call, wallet.accountId ?? "", info), [JSON.stringify(call), wallet.accountId, info]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = phase.kind === "pending";

  return (
    <Modal title="pool.tx" heading={t("actions.pool.heading")} onClose={onClose} testId="pool-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <p className="fd-note">
          <strong>{t("actions.pool.noteTitle")}</strong> {t("actions.pool.noteBody")}
        </p>
        <Kv
          testId="pool-totals"
          rows={[
            [t("actions.pool.pool"), pool.data ? t("actions.pool.snaccAmount", { amount: formatYocto(pool.data.pool.toString()) }) : "—"],
            [t("actions.pool.inflow"), pool.data ? t("actions.pool.snaccAmount", { amount: formatYocto(pool.data.inflow.toString()) }) : "—"],
            [t("actions.pool.epoch"), macro.data ? t("actions.pool.epochValue", { n: macro.data.currentEpoch, last: pool.data ? pool.data.lastClosedEpoch : "—" }) : "—"],
            [t("actions.pool.burnt"), currentContrib.data ? `${currentContrib.data.contribution}` : "—"],
          ]}
        />
        <StrainPicker id="pool-strain" label={t("actions.shared.yourSnacc")} info={info} value={strainId} onChange={setStrainId} disabled={busy} />
        <Tabs
          label={t("actions.pool.stepLabel")}
          idBase="pool"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "claim", label: t("actions.pool.tabClaim") },
            { id: "redeem", label: t("actions.pool.tabRedeem") },
          ]}
        />
        <TabPanel idBase="pool" id={tab}>
          {tab === "claim" ? (
            claimable.length ? (
              <Field id="pool-epoch" label={t("actions.pool.closedEpoch")}>
                <Select id="pool-epoch" value={epochToClaim ?? ""} onChange={(e) => setClaimEpoch(Number(e.target.value))} disabled={busy}>
                  {claimable.map((c) => (
                    <option key={c.epoch} value={c.epoch}>
                      {t("actions.pool.epochOption", { epoch: c.epoch, contribution: String(c.contribution), amount: formatYocto(estimatePayout(c, pool.data?.pool ?? 0n).toString()) })}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p className="fd-field__hint" data-testid="pool-none">
                {contribs.loading ? t("actions.pool.readingContribsShort") : t("actions.pool.noneClaimable")}
              </p>
            )
          ) : (
            <Field id="pool-amount" label={t("actions.pool.amountLabel", { n: aether === null ? "—" : String(aether) })}>
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
          label={tab === "claim" ? t("actions.pool.signClaim") : t("actions.pool.signBurn")}
          testId="pool"
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- nft_transfer + ft_transfer

export function SendModal({ wallet, info, onClose, onDone, preferredStrainId, initialTab = "gift" }: GameActionProps & { initialTab?: "gift" | "send" }) {
  const { t } = useT();
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

  let blocked: string | null = rc.ok ? null : receiver.trim() ? rc.reason : t("actions.send.enterReceiver");
  const calls: ContractCall[] = [];
  if (tab === "gift") {
    if (!blocked && strainId === null) blocked = t("actions.send.pickGift");
    if (!blocked && strainId !== null && rcId) calls.push(...plan(buildNftTransfer({ receiverId: rcId, strainId }), wallet.accountId ?? "", info));
  } else {
    if (!blocked && !amountOk) blocked = t("actions.send.enterAmount");
    if (!blocked && info.snaccYocto !== null && amountYocto !== null && BigInt(amountYocto) > BigInt(info.snaccYocto)) {
      blocked = t("actions.send.walletHolds", { amount: formatYocto(info.snaccYocto) });
    }
    if (!blocked && registered.data === null) blocked = registered.loading ? t("actions.send.checkingReg") : t("actions.send.regUnreadable");
    if (!blocked && registered.data === false && !registerToo) blocked = t("actions.send.notRegistered");
    if (!blocked && rcId && amountYocto !== null) {
      const transfer = buildFtTransfer({ receiverId: rcId, amountYocto });
      const base = plan(transfer, wallet.accountId ?? "", info);
      if (registered.data === false) base.splice(base.length - 1, 0, buildStorageDeposit({ accountId: rcId, minYocto: info.storage?.minYocto ?? STORAGE_MIN_FALLBACK_YOCTO }));
      calls.push(...base);
    }
  }
  const busy = phase.kind === "pending";

  return (
    <Modal title="send.tx" heading={tab === "gift" ? t("actions.send.headingGift") : t("actions.send.headingSend")} onClose={onClose} testId="send-modal" footer={<Footer />}>
      <div className="fd-stack">
        <ConnectLine wallet={wallet} />
        <Tabs
          label={t("actions.send.whatToSend")}
          idBase="send"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "gift", label: t("actions.send.tabGift") },
            { id: "send", label: t("actions.send.tabSend") },
          ]}
        />
        <TabPanel idBase="send" id={tab}>
          {tab === "gift" ? (
            <>
              <p className="fd-note">
                <strong>{t("actions.send.giftTitle")}</strong> {t("actions.send.giftBody")}
              </p>
              <StrainPicker id="send-strain" label={t("actions.send.snaccToGive")} info={info} value={strainId} onChange={setStrainId} disabled={busy} />
            </>
          ) : (
            <>
              <p className="fd-note">
                <strong>{t("actions.send.sendTitle")}</strong> {t("actions.send.sendBody")}
              </p>
              <Field
                id="send-amount"
                label={t("actions.send.amountLabel")}
                bad={!amountOk}
                hint={t("actions.send.yourWallet", { amount: info.snaccYocto === null ? "—" : formatYocto(info.snaccYocto) })}
              >
                <Input id="send-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} autoComplete="off" />
              </Field>
            </>
          )}
          <Field id="send-receiver" label={t("actions.send.receiver")} bad={Boolean(receiver.trim()) && !rc.ok} hint={receiver.trim() && !rc.ok ? rc.reason : t("actions.send.receiverHint")}>
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
                  ? t("actions.send.checking")
                  : t("actions.send.regNone")
                : registered.data
                  ? t("actions.send.isRegistered", { id: rcId })
                  : t("actions.send.isNotRegistered", { id: rcId })}
            </p>
          ) : null}
          {tab === "send" && registered.data === false ? (
            <label className="fd-row fd-field__hint" style={{ gap: 6 }}>
              <input type="checkbox" checked={registerToo} onChange={(e) => setRegisterToo(e.target.checked)} disabled={busy} />
              {t("actions.send.registerFirst", { id: String(rcId), amount: formatYocto(info.storage?.minYocto ?? STORAGE_MIN_FALLBACK_YOCTO) })}
            </label>
          ) : null}
        </TabPanel>
        <SignBlock wallet={wallet} info={info} calls={calls} phase={phase} send={send} onClose={onClose} blocked={blocked} label={tab === "gift" ? t("actions.send.signGive") : t("actions.send.signSend")} testId="send" />
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
