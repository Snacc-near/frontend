import type { Messages } from "../../types.ts";
import type en from "../en/demo.ts";

/** Indonesian demo-mode text (UI-161 phase B3). The numbers are the simulation's own; only the words are translated. */
const demo = {
  seed: "demo · simulasi: koloni diisi pada pita saldo 600..610 mk",
  started: "mulai produksi {kind}: +{amount} saat dikumpulkan",
  needSpores: "butuh {need} spora, punya {have}",
  needEnzymes: "butuh {need} enzim, punya {have}",
  collected: "dikumpulkan +{amount} {kind}",
  unknownItem: "item tidak dikenal",
  notReady: "belum siap",
  needSnacc: "butuh 10 snacc",
  fed: "strain diberi makan: +12 atp, +220 vitalitas (demo · simulasi)",
  maxLevel: "{key} sudah di level maksimum {max}",
  needAtp: "butuh {cost} atp, punya {have}",
  upgraded: "{key} naik ke {level}: {note}",
  noteMito: "+10% output atp",
  noteNucleus: "+10% output per level",
  noteLysosome: "-10% lapar per level",
  divideGate: "gerbang pembagian: kelahiran harus tetap dalam batas penggabungan + lisis",
  needDivide: "butuh 30 atp untuk membagi",
  mitosis: "mitosis: sel terbelah jadi dua (demo · simulasi)",
  lysis: "panen lisis: melepas {n} nutrisi (ledakan dasar 2.00%)",
  needSplice: "butuh 20 atp untuk menggabungkan",
  splice: "gabung: dua strain digabungkan (demo · simulasi)",
  vacuole: "denyut vakuola dimainkan (demo · simulasi)",
  attest: "attest: pratinjau verifikasi tee · tidak ada angka yang berubah",
  kinds: { atp: "atp", spores: "spora", enzymes: "enzim", elixir: "eliksir" },
  receipt: "masuk {inflow} = keluar {outflow} + tersimpan {stored} ✓",
  seedLogs: {
    actor: "strain #3",
    burst: "lisis sel melepas 7200 nutrisi · diskon -20.00% sampai epoch 2",
    zone: "alkemis.testnet memicu pergeseran zona dari hipotermia ke goldilocks (605 mK)",
  },
} satisfies Messages<typeof en>;

export default demo;
