# SNACC frontend — cell-cultivation game UI

A cell-cultivation game for **Snacc ($SNACC)**: *NFTs that eat a memecoin.
Feed your Snacc or it gets snacked.* You tend living `Homunculus Strain`
cells on an isometric colony plate, open a chosen cell in its **Cell Lab**
bio-reactor, and drive the whole economy through twelve lab actions — each
one plays the real cell-biology mechanism it is named after (a mitochondrion
power plant, a Krebs wheel, an ATP-synthase turbine). Every lab action is
mapped to the exact contract method it stands for — the map below — but
this UI never submits a contract call itself. In **demo** mode the numbers come from local simulation constants and are
labelled `demo · simulated`. In **live** mode every value comes from the
backend API; missing values render as `—` and transactions are preview-only
(`preview only — on-chain transactions need a wallet`).

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

## Swap & Liquidity Terminal (RES-107 & RES-108)

The UI includes an integrated DEX display and swap quote widget (`SwapPanel.tsx`):
- **Ref / Rhea price indexer (RES-107)**: Fetches public indexer prices for reference assets (wNEAR) and $SNACC. When $SNACC is not yet listed on a liquidity pool, the UI honestly renders `—` with a `not listed yet on dex pool` note and never fabricates prices. External market prices are display only and do not feed any game mechanics. Direct deep link: "open in Rhea Finance".
- **NEAR Intents / 1Click quote (RES-108)**: Fetches dry-run quotes for cross-chain swaps (`exact_amount_in` → `amount_out`, `min_amount_out`, expiration) across supported assets (NEAR, USDC on NEAR/Ethereum, SOL, BTC). Preview only: no on-chain transactions or wallet keys are used by this UI.

Configuration (`.env`):
- `VITE_SNACC_TOKEN_ID` — contract id of the $SNACC token.
- `VITE_REF_INDEXER_URL` — Ref / Rhea indexer API base URL.
- `VITE_INTENTS_API_URL` — NEAR Intents 1Click API base URL.

## Tests

```bash
npm test
```

136 tests across 17 files (`vitest run`) — bridge message validation, keycap
busy state, live placeholders (`—` vs fabricated values), simulation,
poller, optimistic vitality, zones, isometric plate geometry, Ref price indexer,
NEAR Intents cross-chain quotes, and word guards. All green.

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
