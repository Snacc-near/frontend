import type { Messages } from "../../types.ts";
import type en from "../en/settings.ts";

/** Pengaturan dalam bahasa Indonesia (UI-161): bahasa, suara, gerak, istilah, dan data lokal. */
const settings = {
  language: {
    heading: "Language / Bahasa",
    group: "Bahasa",
    hint: "Hanya tersimpan di browser ini, dengan kunci {key}. Reset data lokal di bawah ikut menghapusnya.",
    exceptions:
      "Seluruh app tersedia dalam dua bahasa. Ketentuan dan Privasi tetap berbahasa Inggris, dan data dari kontrak atau server (judul misi, isi notifikasi, nama NPC) ditampilkan apa adanya.",
  },

  modal: {
    heading: "Pengaturan",
    footer: "hanya tersimpan di browser ini",
    tag: "lokal",
  },

  sound: {
    heading: "Suara",
    on: "efek suara nyala",
    off: "efek suara mati",
    volume: "volume {pct}%",
  },

  motion: {
    heading: "Kurangi gerak",
    group: "kurangi gerak",
    system: "ikuti sistem",
    reduce: "kurangi",
    full: "gerak penuh",
    hint: "Ikuti sistem memakai pengaturan perangkatmu, yang saat ini {current}. Pilihanmu di sini disimpan dan menang atas pengaturan itu.",
    reduceNow: "kurangi gerak",
  },

  skin: {
    heading: "Istilah",
    hint: "Mekanik yang sama dengan nama ala bio-lab atau meja fintech.",
  },

  data: {
    heading: "Data lokal",
    note: "{reset} menghapus persis kunci-kunci ini di browser ini, lalu memuat ulang halaman. Entri milik dompetmu sendiri, seperti kunci {walletKey} yang disimpan NEAR Connect, tidak disentuh. Pengantar akan muncul lagi. Ini juga menghapus database kunci main satu ketuk (IndexedDB {db}) di browser ini; itu tidak menghapus kunci satu ketuk dari akunmu, jadi matikan dulu main satu ketuk bila sedang nyala.",
    resetName: "Reset data lokal",
    confirmGroup: "konfirmasi reset",
    confirm: "hapus kunci ini dan muat ulang",
    cancel: "batal",
    reset: "reset data lokal",
  },

  keys: {
    onboarding: "pengantar sudah ditampilkan",
    sound: "suara nyala atau mati dan volumenya",
    motion: "pilihan kurangi gerakmu",
    skin: "istilah bio-lab atau fintech",
    guest: "label tamu dan akun yang disorot",
    legacySession: "kunci sisa dari build sebelumnya",
    profileSession: "sesi masuk profilmu, hanya setelah kamu masuk ke profil",
    browserAlerts: "peringatan browser yang dinyalakan untuk notifikasi",
    telemetry: "pilihanmu soal berbagi statistik penggunaan anonim",
    deviceId: "id acak untuk statistik penggunaan anonim (yang baru dibuat setelah reset)",
    oneTap:
      "kunci main satu ketuk, hanya bila kamu menyalakan main satu ketuk dan browser ini memblokir IndexedDB (menghapusnya tidak menghapus kunci dari akunmu; matikan main satu ketuk untuk itu)",
    locale: "pilihan bahasamu (English atau Bahasa Indonesia)",
  },
} satisfies Messages<typeof en>;

export default settings;
