# SNACC frontend — cell-cultivation game UI

A cell-cultivation game for **Snacc ($SNACC)**: *NFTs that eat a memecoin.
Feed your Snacc or it gets snacked.* You tend living `Homunculus Strain`
cells on an isometric colony plate, open a chosen cell in its **Cell Lab**
bio-reactor, and drive the whole economy through twelve lab actions — each
one plays the real cell-biology mechanism it is named after (a mitochondrion
power plant, a Krebs wheel, an ATP-synthase turbine). Every lab action is
mapped to the exact contract method it stands for — the map below. The Cell
Lab actions never submit a contract call. In **demo** mode the numbers come from local simulation constants and are
labelled `demo · simulated`. In **live** mode every value comes from the
backend API; missing values render as `—` and the Cell Lab actions are preview-only
(`preview only — on-chain transactions need a wallet`). With a NEAR wallet
connected, live mode adds two signed testnet actions: **hatch**
(`incubate_strain`) and **feed** (`feed_strain`); see [Wallet](#wallet-testnet).

## Screens

| Screen | What is on it |
| --- | --- |
| **Colony Plate arena** | An anatomy-style isometric SVG arena (the `Colony Plate`): yeast-like strain cells whose look encodes status and macro zone, a CrucibleTemp gauge, a nutrient-burst badge, and a keycap HUD dock. Tap a cell to open it. |
| **Microscope-iris transition** | A iris close/open visual transition between the arena and the Cell Lab, centred on the tapped cell. |
| **Cell Lab sheet** | The bio-reactor cutaway figure (`public/figures/cell-lab.html`, embedded with `?embed=1`) plus twelve keycap actions, organelle upgrade cards (mitochondria / nucleus / lysosome), the production chain (spores → enzyme → elixir), and the on-chain NFT SVG. |
| **HUD** | Mode switch (`demo · simulated` / `live testnet`), resource pills ($SNACC / ATP / spores / enzymes / elixir), vitality readout, thermal gauge, breach log, appetite panel, telemetry toggle. |

The Cell Lab figure is a teaching cutaway: a mitochondrion power plant with
a Krebs-cycle wheel, an electron-transport **cable car**, and an ATP
synthase **turbine** producing 3 ATP per rotor turn. Its twelve mechanism
animations are `feed`, `atp`, `extract`, `transmute`, `synthesize`,
`nucleus`, `lysosome`, `divide`, `lysis`, `splice`, `vacuole`, `attest`.

![Colony Plate arena in demo mode](docs/img/arena-desktop-demo.png)

![Cell Lab, Produce ATP mid-animation (turbine)](docs/img/cell-lab-atp-mid.png)

![Colony Plate arena on mobile, live mode, API values with `—` for missing](docs/img/arena-mobile-live.png)

![The twelve Cell Lab mechanism animations, contact sheet](docs/img/cell-lab-actions-sheet.png)

## Organelle → contract-method map

| Lab action | Contract method | Notes |
| --- | --- | --- |
| `feed` | `feed_strain` | feeds $SNACC to the strain |
| `atp` | `allocate_atp` | organelle slots: `mitokondria`, `nukleus`, `lisosom` — level 0–5 each; `mitokondria` +10% ATP per level, `nukleus` +10% output per level, `lisosom` −10% hunger per level |
| `extract` | `extract_spores` | harvest spores from the strain |
| `transmute` | `transmute_spores_to_enzyme` | spores → enzyme |
| `synthesize` | `synthesize_elixir` | enzyme → elixir |
| `divide` | `divide_strain` | mitosis: one strain becomes two (colony growth) |
| `lysis` | `harvest_starving_strain` | harvest a fainted strain; releases a Nutrient Burst |
| `splice` | `splice_strains` / `hostile_takeover_splice` | merge two strains, or take over a distressed one |
| `vacuole` | — (mechanism play only) | plays the vacuole pulse animation; changes no numbers |
| `attest` | `commit_genome_experiment` → `apply_tee_mutation_zero_trust` | genome experiment committed off-chain in NEAR AI Cloud TEE, then applied on-chain after the ed25519 check |

## Demo vs live honesty

- **Demo** (`demo · simulated`): the arena seeds a simulated colony around a
  600–610 mK balance band; every keycap changes the local simulation numbers
  (ATP, vitality, spores, and so on). The footer reads `demo · simulated —
  numbers come from local constants, not the chain`, and the production
  receipt shows what went `in · out · stored`. `vacuole` and `attest` only
  play the mechanism and change no numbers even in demo.
- **Live** (`live testnet`): data comes only from the backend API
  (`/api/crucible/macro`, `/api/strains`, `/api/events`, `/api/appetite`).
  When the API returns nothing, the UI shows `—` placeholders — it never
  fabricates a value. Action keys are preview-only: pressing one shows
  `preview only — on-chain transactions need a wallet`. The status pill
  reads `live · /api data only`.

## postMessage bridge contract

The app embeds the Cell Lab figure as an iframe at
`/figures/cell-lab.html?embed=1` and talks to it over `postMessage`. All
inbound messages are validated for exact origin and exact shape; anything
else is ignored, never executed. Implementation: `src/game/bridge.ts`.

App → figure:

```ts
{ type: "snacc:state", strain: {
    strain_id: number, status: string,
    vitality: number, effective_vitality: number,
    atp_balance: string,
    organel: { mitokondria: number, nukleus: number, lisosom: number },
    generation: number, role_mask: number,
  }, zone: string }
{ type: "snacc:play", action: "feed" | "atp" | "extract" | "transmute" |
    "synthesize" | "nucleus" | "lysosome" | "divide" | "lysis" |
    "splice" | "vacuole" | "attest" }
```

Figure → app:

```ts
{ type: "snacc:ready" }
{ type: "snacc:action", action: LabAction }   // figure-initiated run
{ type: "snacc:done",  action: LabAction }   // animation finished, keys unlock
```

Notes:

- The app sends `snacc:state` only when it changes, and always re-sends
  right after `snacc:ready` (the figure may finish loading after the first
  post). The organelle levels in the message are the same values the side
  panel renders (`resolveOrganelLevels` in `src/game/labState.ts`).
- The figure plays one animation at a time; while one runs, every keycap is
  disabled. A 10 s fallback timeout unlocks the keys if the figure never
  answers `snacc:done`.
- The iframe colour scheme is mirrored from the figure document so the
  transparent embed stays transparent over the cream card.

## Run locally

```bash
cd frontend
cp .env.example .env.local     # set VITE_API_BASE to the backend API base URL
npm ci
npm run dev
```

- `VITE_API_BASE` — base URL of the SNACC backend API (e.g.
  `https://8787-agq3sgcdseushmj4q73lv3xqea.instabox.tech`). Leave it empty
  to run the UI against built-in demo data only (simulated mode).
- `npm run dev` — local dev server. `npm run build` — production build
  (`tsc --noEmit && vite build`). `npm run preview` — preview the build.
- The frontend is **not publicly deployed**; run it locally as above.

Screenshots under [`docs/img/`](docs/img/) were taken from a production
build served locally on a static gzip server.

## Tool windows

One toolbar under the plate opens six windows (below 900 px they fold into a
**tools** sheet). They share the landing's look (`src/ui/`: square 1 px ink
windows, dithered shadows, line icons) and behave as modal dialogs: Escape and
a backdrop click close them, Tab stays inside, focus returns to the opener,
and under 640 px they open as bottom sheets. Each loads on first open.

| Window | What it shows | Data source |
|---|---|---|
| NPC merchants (ADR-30) | The three contract NPCs, their stock and a spore quote with the contract's `reasoning_tooltip` | **live:** views `get_npc`, `npc_quote_spores` on `snacc-v001.testnet`; buying needs the signed call `npc_buy_spores`, which this app does not send. **demo:** the same rule on genesis state, every number labelled SIMULATION |
| Swap quote | Rhea reference price and a NEAR Intents 1Click **dry** quote between listed assets | public APIs in both modes (`api.rhea.finance/list-token-price`, `POST 1click.chaindefuser.com/v0/quote` with `dry: true`, no API key). `$SNACC` is a testnet token and is listed on neither |
| Great Feast | Epoch, zone, feast volume and the top-3 feeders, plus a near.social markdown post to copy | **live:** backend `/api/appetite`, else views `get_appetite_meter` + `get_top_feeder`; empty state when both are empty. **demo:** invented feeders, labelled SIMULATION |
| Thesis | Four numbers from the testnet rehearsal of 2026-11-09, each linked to its tx (or named view); live mode adds a fresh view read. SQL **query templates — not executed** (Snacc is testnet-only) | `src/data/evidence.ts` (copied from the umbrella repo's evidence pack), views `get_macro_state`, `get_global_solvency`, `get_crucible_temp` |
| Recipes | **Local recipe search (keyword)** over the recipes the contract implements, with each method's real signature and a JSON call template to copy | in-browser word match; no model, no network |
| Guest label | **Guest label — local only, no on-chain account, nothing is signed.** A valid `.testnet` account, if typed, only highlights its strains. near.email and Auth0 are shown as disabled "planned" options | `localStorage` (label and optional account only) |

Amounts are `$SNACC` with 24 decimals. Nothing in these windows signs a
transaction, and nothing feeds a game mechanic.

Optional configuration (`.env`):
- `VITE_REF_INDEXER_URL` — Rhea price list base URL (default `https://api.rhea.finance`).
- `VITE_INTENTS_API_URL` — 1Click API base URL (default `https://1click.chaindefuser.com`).
- `VITE_SNACC_TOKEN_ID` — a mainnet `$SNACC` token id, if one ever exists; unset today.
- `VITE_PRIVY_APP_ID` — Privy App ID (public). Set it to add "Email or social login (Privy)" to the
  wallet picker; empty turns it off. `VITE_PRIVY_CLIENT_ID` is optional and only passed on when set.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — the optional player-profile database
  (Supabase project URL and its publishable key, which is public; row-level security guards the
  data). With both set, the game shows "Save progress — sign in" next to the wallet, the Profile
  window, the notifications bell, usernames and extra leaderboard tabs, the starter-pack key and the
  profile parts of `/p/<account>`. Leave either empty and all of it stays hidden.

## Player profiles (optional, UI-148/UI-149)

`src/account/` signs in with NEAR: the backend's `near-auth/challenge` issues a NEP-413 message, the
wallet signs it (`signMessage`, no transaction), `near-auth/verify` checks it and returns a token for
`supabase.auth.verifyOtp`. A limited (function-call) key is refused with a plain message. Sign-out
clears only the profile session; a session for another account than the connected wallet is dropped.
`@supabase/supabase-js` is in its own lazy chunk: the landing page never loads it, and `/app` loads it
only after a wallet is connected or a stored session exists. After each successful signed action the
app calls `record-tx` (fire and forget) and toasts new achievements. Public pages: `/p/<accountId>`
(profile, Snaccs from contract views, achievements, streak, follow) and `/snacc/<id>` (on-chain SVG,
owner, status, vitality, "Open in game" = `/app?strain=<id>`).

## Wallet (testnet)

The header has a **connect wallet** key (`src/chain/wallet.tsx`, [NEAR Connect](https://github.com/hot-dao/near-selector),
network `testnet`). The connector loads on demand, so the landing page never downloads it. Wallets
run in NEAR Connect's sandboxed iframes and sign there; the app never sees or stores a key. Once
connected, the header shows the account, its spendable testnet NEAR and its `$SNACC`
(`ft_balance_of`; testnet, no monetary value), and the wallet account becomes the highlighted
account and the My collection account.

In live mode the dock then offers two signed calls to `snacc-v001.testnet` (builders in
`src/chain/actions.ts`, mirroring the deposit rules of `sdk/src/client.ts`):

| Action | Call | Attached NEAR |
|---|---|---|
| Hatch | `incubate_strain(role, initial_snacc_stake, initial_spores)` | the stake (default 0.25 NEAR) |
| Feed | `feed_strain(strain_id, amount)` on an owned strain | none |
| First signed call only | `storage_deposit(account_id, registration_only: true)` | `storage_balance_bounds().min` |

Each window shows the cost before signing and then the result: the tx hash with a nearblocks link,
or the contract error in plain English with the raw text underneath. A faucet link
(docs.near.org/tools/faucet) appears when the account lacks testnet NEAR. Demo mode keeps the
simulated dock. With `VITE_PRIVY_APP_ID` set, Privy email login (via `@peerfolio/privy-near-connect`)
appears in the same picker; its signing popup is the `/sign` route, a separate chunk. A Privy
account is new and starts with 0 NEAR.

`index.html` carries the CSP the wallets need: a fixed nonce for NEAR Connect's `srcdoc` wallet
frames (`script-src … 'nonce-…'`, same value as `NEAR_CONNECT_CSP_NONCE`) and `https:` for wallet
icons, styles, fonts and frames.

## Tests

```bash
npm test
```

Run `npx vitest run` for the current count. The suite covers bridge message
validation, keycap busy state, live placeholders (`—` vs fabricated values),
simulation, poller, optimistic vitality, zones, isometric plate geometry, the
Rhea price client, the 1Click dry-quote request and response handling, the NPC
quote rule against a real contract response, the tool windows' dialog
semantics and keyboard logic, and word guards over all of `src`. Tests run in
node without a DOM, so Escape, focus trap and focus return are covered through
the shared keyboard logic (`src/ui/a11y.ts`) and checked by hand in a browser.

## Lighthouse (static gzip server, production build)

| | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Desktop | 100 | 100 | 100 | 100 |
| Mobile | 99 | 100 | 96 | 100 |

Measured on a static gzip server over the production build
(`npm run build` output).

## Credits

The isometric plate and figure rendering use the **Anatomy** kit by
**April Zhu**, MIT-licensed. The kit sources are copied into
`src/plate/iso/` with a provenance note in
`src/plate/iso/LICENSE-anatomy-kit`.
