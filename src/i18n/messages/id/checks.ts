import type { Messages } from "../../types.ts";
import type en from "../en/checks.ts";

/** Indonesian reasons for the `check*` helpers in `chain/actions.ts` and `chain/market.ts` (UI-161 phase B3). */
const checks = {
  dead: "Snacc ini sudah tidak hidup.",
  stake: {
    invalid: "Masukkan jumlah dalam NEAR, mis. 0.25.",
    min: "Taruhan terkecil di sini adalah {min} NEAR.",
    max: "Jaga taruhan di {max} NEAR atau kurang di testnet.",
  },
  alloc: {
    waitingEpoch: "Menunggu epoch dibaca dari testnet.",
    already: "Snacc ini sudah mengalokasikan ATP di epoch {epoch}. Sekali per epoch.",
    levelRange: "Level tiap organel adalah 0 sampai {max}.",
    same: "Ubah paling sedikit satu level.",
    needAtp: "Butuh {cost} ATP; Snacc ini punya {atp}.",
  },
  divide: {
    starving: "Snacc yang kelaparan (vitalitas 0) tidak bisa membelah. Beri makan dulu.",
    cost: "Membagi butuh {cost} ATP; Snacc ini punya {atp}.",
    generation: "Anaknya akan jadi generasi {gen}; batasnya {max}.",
    waitingColony: "Menunggu kolonimu dibaca dari testnet.",
    colony: "Kolonimu sudah punya {n} Snacc hidup (batas {max}).",
    budget: "Kontrak hanya mengizinkan pembagian setelah penggabungan atau lisis membebaskan satu slot (total pembagian ≤ penggabungan + lisis).",
  },
  account: {
    empty: "Masukkan akun testnet, mis. friend.testnet.",
    invalid: "Pakai id akun testnet: name.testnet, atau id implisit 64 karakter.",
    self: "Itu akunmu sendiri.",
  },
  price: {
    empty: "Masukkan harga dalam NEAR, mis. 1.5.",
    format: "Pakai angka dan satu titik saja, dengan paling banyak 24 desimal, mis. 1.5.",
    zero: "Harga harus lebih dari nol.",
    max: "Pasar menerima paling banyak {max} NEAR per Snacc.",
  },
  buy: {
    connect: "hubungkan dompet untuk membeli",
    own: "ini daftar jualmu sendiri",
    dead: "Snacc ini sudah mati dan tidak bisa ditransfer",
  },
  notConfirmed: {
    lag: " RPC testnet tidak menjawab, jadi ini tidak bisa diperiksa: muat ulang sebentar lagi.",
    listed:
      "Transaksi selesai tetapi tidak ada daftar jual untuk Snacc #{id} yang muncul. Pasar mengembalikan Snacc bila menolak daftar jual (harga di luar rentang, daftar jual baru dijeda, atau batas tercapai). Cek Koleksiku.",
    repriced: "Transaksi selesai tetapi harga Snacc #{id} belum berubah. Muat ulang dalam beberapa detik.",
    delisted:
      "Transaksi selesai tetapi Snacc #{id} belum kembali kepadamu. Muat ulang dalam beberapa detik; bila daftar jualnya tetap ada, Snacc mungkin mati selagi dijual.",
    bought:
      "Transaksi selesai tetapi Snacc #{id} bukan milikmu. Pasar mengembalikan harga penuh bila Snacc tidak bisa dipindahkan (mati, atau dibeli atau ditarik pada saat yang sama); hanya gas yang terpakai.",
  },
} satisfies Messages<typeof en>;

export default checks;
