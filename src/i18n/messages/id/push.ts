import type { Messages } from "../../types.ts";
import type en from "../en/push.ts";

/** Indonesian copy for "Push to this device" (UI-161 phase B5). */
const push = {
  title: "Push ke perangkat ini",
  turnOff: "matikan push ke perangkat ini",
  turnOn: "nyalakan push ke perangkat ini",
  state: {
    checking: "Memeriksa perangkat ini…",
    off: "Mati. Nyalakan untuk menerima notifikasi di perangkat ini walau Snacc sedang ditutup. Browser akan meminta izin lebih dulu.",
    on: "Menyala untuk perangkat ini. Peringatan soal Snacc yang lapar, Snacc yang hilang, dan pengumuman sampai walau Snacc sedang ditutup.",
    blocked: "Browser memblokir notifikasi untuk situs ini. Izinkan di pengaturan situs, lalu kembali ke sini untuk menyalakan push.",
    unsupported: "Browser ini tidak bisa menerima notifikasi push.",
    needsInstall:
      "Di iPhone dan iPad, push hanya jalan untuk app yang sudah dipasang (iOS 16.4 atau lebih baru): buka menu Bagikan, pilih Tambah ke Layar Utama, lalu buka Snacc dari layar utama dan nyalakan push di sana.",
  },
  privacy:
    "Yang dikirim: hanya teks notifikasi, misalnya “Snacc #7 kelaparan”, terenkripsi ujung ke ujung dan diantar lewat layanan push browsermu (Google, Mozilla, atau Apple). Snacc menyimpan alamat push perangkat ini bersama profilmu, bukan kunci dompet. Pengiriman berusaha sebaik mungkin dan bisa tertunda semenit. Mematikannya atau keluar akan menghapus perangkat ini.",
  messages: {
    generic: "Ada yang salah. Coba lagi.",
    serviceDown: "Browser tidak bisa menjangkau layanan push-nya. Periksa koneksi lalu coba lagi.",
    notAllowed: "Notifikasi tidak diizinkan, jadi push tetap mati.",
    noKey: "Server tidak mengembalikan kunci push. Coba lagi nanti.",
    offlineOff: "Dimatikan di perangkat ini. Server tidak bisa dijangkau, jadi perangkat ini akan dilepas sendiri.",
    cannotTurnOff: "Browser tidak bisa mematikan push. Coba lagi.",
    signIn: "Masuk ke profil untuk memakai notifikasi push.",
  },
} satisfies Messages<typeof en>;

export default push;
