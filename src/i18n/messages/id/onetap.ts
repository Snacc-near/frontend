import type { Messages } from "../../types.ts";
import type en from "../en/onetap.ts";

/**
 * Main satu ketuk dalam bahasa Indonesia (UI-161 fase B4). Isinya sama tepatnya dengan versi Inggris: satu kunci
 * terbatas, jatah gas, hanya kontrak Snacc, hanya method tanpa deposit, dan aksi yang melampirkan NEAR atau
 * membayar pemain lain tetap lewat dompet. Nama method (`<code>`) tidak diterjemahkan.
 */
const onetap = {
  heading: "Main satu ketuk",
  intro:
    "Menandatangani aksi game tanpa deposit di browser ini, jadi aksinya jalan tanpa popup dompet tiap kali. Hanya testnet, dan belum dicoba di semua dompet.",
  methods: "Aksi satu ketuk ({count}): {list}.",
  walletOnly:
    "Tetap lewat dompet: aksi yang melampirkan NEAR (stake, biaya katalis, deposit penyimpanan, atau 1 yoctoNEAR), {attaches}; aksi yang membayar $SNACC ke pemain lain atau mengambil alih Snacc mereka, {paysOther}; setiap panggilan pasar; dan aksi apa pun yang dikirim bersama pendaftaran penyimpanan pertama.",
  key: "Menyalakannya meminta dompetmu sekali untuk menambahkan kunci terbatas ke akunmu sendiri. Kunci itu hanya bisa memanggil aksi satu ketuk di atas pada {contract}, tidak bisa melampirkan NEAR, dan bisa memakai paling banyak {allowance} NEAR untuk gas (jatahnya), dibayar dari akunmu. Kunci privatnya dibuat di browser ini dan tetap di sini; tidak pernah dikirim ke mana pun, hanya kunci publiknya yang masuk ke chain. Siapa pun yang bisa menjalankan kode di situs ini di browser ini bisa memakainya untuk aksi-aksi itu sampai kamu mematikannya.",
  signOut:
    "Memutus dompet tidak menghapus kuncinya: kunci tetap ada di browser ini dan di akunmu sampai kamu mematikan main satu ketuk. Untuk menghapusnya, hubungkan akun yang sama lalu tekan \"matikan\" di sini, atau hapus kuncinya di daftar kunci akses dompetmu.",

  status: {
    signedOut: "Hubungkan dompet untuk menyalakan main satu ketuk.",
    loading: "Memeriksa browser ini…",
    unsupported: "Main satu ketuk tidak tersedia di browser ini: {reason} Setiap aksi tetap memakai dompetmu.",
    off: "Main satu ketuk mati. Setiap aksi memakai dompetmu.",
    offFor: "Main satu ketuk mati untuk {account}. Setiap aksi memakai dompetmu.",
    on: "Aktif.",
    onFor: "Aktif untuk {account}.",
    onLine: "{state} Kunci {key} · jatah tersisa {allowance} · {where}",
    unlimited: "tanpa batas",
    indexeddb: "disimpan di IndexedDB browser ini sebagai kunci yang tidak bisa diekspor",
    localstorage: "disimpan di localStorage browser ini sebagai byte kunci mentah, karena IndexedDB diblokir di sini",
    missing:
      "Kunci ini sudah tidak ada di akunmu (dihapus di tempat lain, atau penambahannya tidak masuk). Aksi tanpa deposit memakai dompetmu lagi; lupakan kuncinya di sini dan nyalakan main satu ketuk lagi kalau kamu mau memakainya kembali.",
    outdated:
      "Kunci ini dibuat oleh game versi lama dan mengizinkan daftar aksi yang berbeda, jadi main satu ketuk tidak memakainya: setiap aksi lewat dompetmu. Ganti kuncinya (2 popup dompet: hapus kunci lama, tambah yang baru) atau matikan.",
  },

  button: {
    waiting: "menunggu dompet…",
    enable: "nyalakan main satu ketuk (1 popup dompet)",
    replace: "ganti kuncinya (2 popup dompet)",
    disable: "matikan (hapus kunci, 1 popup dompet)",
    refresh: "periksa lagi",
    forget: "lupakan di perangkat ini",
    forgetConfirm: "lupakan kunci di sini",
    cancel: "batal",
  },
  confirmForget: {
    group: "konfirmasi lupakan",
    note: "Ini hanya menghapus kunci dari browser ini. Kunci tetap ada di akunmu (tidak bisa dipakai, karena hanya browser ini yang memilikinya) sampai kamu menghapusnya dengan \"matikan\" lebih dulu atau lewat daftar kunci dompetmu.",
  },

  fallback: {
    keyMissing: "Kunci satu ketuk tidak ditemukan di akunmu, jadi dompetmu yang menandatangani yang ini.",
    allowance: "Jatah satu ketuk sudah habis, jadi dompetmu yang menandatangani yang ini. Matikan lalu nyalakan lagi main satu ketuk di Pengaturan untuk jatah baru.",
    method: "Kunci satu ketuk tidak bisa memanggil aksi ini, jadi dompetmu yang menandatanganinya.",
    receiver: "Kunci satu ketuk bukan untuk kontrak ini, jadi dompetmu yang menandatangani yang ini.",
    deposit: "Aksi ini melampirkan NEAR, jadi dompetmu yang menandatanganinya.",
    balance: "Akunmu tidak cukup untuk menutup gas main satu ketuk, jadi dompetmu yang menandatangani yang ini.",
    nonce: "Main satu ketuk tidak bisa mendapat nonce baru, jadi dompetmu yang menandatangani yang ini.",
    invalid: "Testnet menolak transaksi satu ketuk, jadi dompetmu yang menandatangani yang ini.",
    rpcUnreachable: "Tidak bisa menjangkau NEAR testnet untuk main satu ketuk, jadi dompetmu yang menandatangani yang ini.",
    loadFailed: "Tidak bisa memuat kunci satu ketuk di browser ini, jadi dompetmu yang menandatangani yang ini.",
    outdated: "Kunci satu ketukmu berasal dari game versi lama, jadi dompetmu yang menandatangani yang ini. Gantilah di Pengaturan → Main satu ketuk.",
  },
  notConfirmed: "Main satu ketuk sudah mengirim transaksi ini, tetapi testnet tidak mengonfirmasinya tepat waktu. Periksa tautan explorer sebelum mencoba lagi.",

  session: {
    noCrypto: "browser ini tidak punya Web Crypto.",
    noEd25519: "browser ini tidak bisa menandatangani dengan Ed25519 di Web Crypto.",
    noStorage: "browser ini memblokir penyimpanan situs (IndexedDB dan localStorage).",
    errorBeforeSending: "Main satu ketuk mengalami galat sebelum mengirim, jadi dompetmu yang menandatangani yang ini.",
    connectFirst: "Hubungkan dompet dulu.",
    busy: "Main satu ketuk sedang sibuk. Coba lagi sebentar.",
    notAvailable: "Main satu ketuk tidak tersedia di browser ini: {reason}",
    alreadyHasKey: "Browser ini sudah punya kunci satu ketuk di akunmu. Matikan (atau ganti) dulu.",
    unreachableExisting: "Tidak bisa menjangkau NEAR testnet untuk memeriksa kunci satu ketuk yang ada. Tidak ada yang dikirim. Coba lagi.",
    isOn: "Main satu ketuk aktif.",
    walletErrorKeyFound: "Dompet melaporkan galat, tetapi kuncinya ada di akunmu, jadi main satu ketuk aktif.",
    walletErrorUnknown: "Dompet melaporkan galat dan testnet tidak bisa diperiksa. Kunci disimpan di sini supaya masih bisa dimatikan.",
    alreadyOff: "Main satu ketuk sudah mati.",
    keyAlreadyGone: "Kunci sudah tidak ada di akunmu, jadi hanya dilupakan di perangkat ini.",
    unreachableKey: "Tidak bisa menjangkau NEAR testnet untuk memeriksa kunci. Tidak ada yang dikirim. Coba lagi.",
    notOurKey: "Kunci itu bukan kunci main satu ketuk untuk game ini, jadi tidak dihapus.",
    nowOff: "Main satu ketuk mati. Kuncinya sudah dihapus dari akunmu.",
    forgot: "Kunci satu ketuk dilupakan di perangkat ini.",
  },
} satisfies Messages<typeof en>;

export default onetap;
