import type { Messages } from "../../types.ts";
import type en from "../en/demos.ts";

/** Teks kelima demo bab di halaman depan (UI-161). Istilah mengikuti daftar di `./common.ts`. */
const demos = {
  feed: {
    fullness: "kenyang",
    state: "kondisi",
    bites: "suapan",
    burned: "dibakar",
    button: "Beri makan",
    note: "satu suapan = {bite} $SNACC, {burn} dibakar saat Pesta Makan {sim}",
  },

  metabolism: {
    group: "Tahap produksi",
    spores: { label: "Spora", role: "Extractor", note: "Extractor menarik spora mentah keluar dari medium." },
    enzymes: { label: "Enzim", role: "Fermenter", note: "Fermenter mengolah spora menjadi enzim." },
    elixirs: { label: "Eliksir", role: "Synthesizer", note: "Synthesizer meracik enzim menjadi eliksir. Setiap pekerjaan butuh ATP." },
  },

  colony: {
    hungry: "sel lapar",
    snacked: "disantap",
    open: "Pingsan · terbuka untuk siapa saja",
    split: "pembagian",
    toPantry: "{pct} ke The Pantry",
    mergePair: "pasangan gabung",
    merged: "tergabung · generasi +1",
    healthy: "dua sel sehat",
    mergeTax: "pajak gabung",
    snack: "Santap",
    merge: "Gabungkan",
    reset: "reset",
    note: "{bounty} hadiah untuk pemburu {sim}",
  },

  appetite: {
    slider: "Meter Selera (CrucibleTemp)",
    valueText: "{temp} mK, {zone}",
    liveMarker: "live {temp} mK",
    rows: {
      temp: "CrucibleTemp",
      zone: "zona",
      rate: "laju",
      frenzy: "pesta makan",
      famine: "paceklik",
      live: "live",
    },
    frenzyValue: "> {mk} mK · {burn} dibakar",
    famineValue: "< {mk} mK · {relief} bantuan",
    snap: "ikuti live",
    offline: "offline",
    reading: "membaca…",
    note: "geser meternya: jarum, termometer, medium, dan embun di kaca ikut bergerak {sim}",
    markerNote: " · penanda = CrucibleTemp live dari {contract}",
  },

  enclave: {
    steps: {
      request: "1 · permintaan",
      enclave: "2 · enclave",
      signature: "3 · tanda tangan",
      contract: "4 · kontrak",
    },
    computing: "menghitung rencana…",
    signed: "ditandatangani di TEE",
    verified: "terverifikasi ✓",
    seeTx: "Lihat tx terverifikasi ↗",
    again: "ulangi",
    noteSealed: "baris-baris ini hanya {sim}; tautannya tx testnet asli {action}",
    hold: "Tahan untuk kirim rencana",
    noteIdle: "enclave menandatangani; kontrak memeriksa tanda tangannya {sim}",
  },
} satisfies Messages<typeof en>;

export default demos;
