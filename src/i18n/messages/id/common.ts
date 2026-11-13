import type { Messages } from "../../types.ts";
import type en from "../en/common.ts";

/**
 * Indonesian copy shared by more than one screen (UI-161). Checked against the English file by
 * `satisfies`: a missing or extra key fails `tsc`.
 *
 * GLOSSARY: keep these terms the same in every Indonesian file (landing, demos, and the game screens
 * that follow). Casual but clear game copy, addressing the player as "kamu" (possessive "-mu").
 *
 *   Kept as they are (names, standards, code):  Snacc, $SNACC, ATP, NEAR, NEP-141/171/177/245, TEE, NFT,
 *     on-chain, testnet, CrucibleTemp, The Pantry, ignis/lumin/redactase, contract method names, account ids.
 *   Kept in English as game proper nouns:       Extractor, Fermenter, Synthesizer, enclave, strain, ticker, app, lab.
 *   strain -> strain             hatch -> menetaskan          harvest -> panen (dipanen)
 *   feed -> beri makan / kasih makan (button: "Beri makan")   bite -> suapan
 *   snack / snacked -> santap / disantap                      hunter -> pemburu       bounty -> hadiah
 *   spores -> spora   enzymes -> enzim   elixirs -> eliksir   burn / burned -> bakar / dibakar
 *   fullness -> kenyang   Fed / Starving / Fainted -> Kenyang / Kelaparan / Pingsan
 *   Feeding Frenzy -> Pesta Makan   Famine (Relief) -> Paceklik (Bantuan Paceklik)   Normal Appetite -> Selera Normal
 *   appetite -> selera   colony -> koloni   incubator -> inkubator   petri dish -> cawan petri   stomach -> perut
 *   wallet -> dompet   contract -> kontrak   signature -> tanda tangan   plan -> rencana   merge -> gabung(kan)
 *   minted -> tercetak   supply -> suplai   block height -> tinggi blok   gallery -> galeri   transactions -> transaksi
 *
 * Numbers keep their official form (3.5%, 1,037 mK) so the prose matches the figures the live widgets
 * show. Honesty rules hold in this language too: this is a "permainan ekonomi on-chain" and the testnet
 * $SNACC is "tanpa nilai uang"; never promise a gain.
 */
const common = {
  language: {
    en: "English",
    id: "Bahasa Indonesia",
  },
  boot: {
    landing: "memanaskan inkubator…",
  },
  brand: {
    backToTop: "Snacc, kembali ke atas",
  },
  sim: {
    simulation: "simulasi",
    illustration: "ilustrasi",
  },
  zones: {
    famine: { label: "Bantuan Paceklik", rate: "{pct} bantuan" },
    normal: { label: "Selera Normal", rate: "tanpa bakar, tanpa bantuan" },
    frenzy: { label: "Pesta Makan", rate: "{pct} dibakar" },
  },
  hunger: {
    fed: "Kenyang",
    starving: "Kelaparan",
    fainted: "Pingsan",
  },
} satisfies Messages<typeof en>;

export default common;
