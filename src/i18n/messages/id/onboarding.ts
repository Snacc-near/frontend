import type { Messages } from "../../types.ts";
import type en from "../en/onboarding.ts";

/** Pengantar saat pertama kali main (UI-161 fase B4). Istilah mengikuti daftar di `./common.ts`. */
const onboarding = {
  step: "langkah {n} dari {total}",
  skip: "lewati pengantar",
  back: "kembali",
  next: "lanjut",
  start: "mulai main",

  steps: {
    what: {
      topic: "apa ini",
      title: "Kenalan dengan Snacc-mu",
      body: "Snacc adalah NFT yang bertingkah seperti organisme hidup kecil. Ia punya saldo $SNACC sendiri dan vitalitas yang terkuras setiap jam.",
      p1: "Vitalitas adalah kesehatannya, ditampilkan dalam persen. Beri makan terus, dan ia tetap sehat.",
      p2: "$SNACC adalah memecoin yang dimakannya. Di testnet, $SNACC tanpa nilai uang.",
      p3: "Ini permainan eksperimental di NEAR testnet. Tidak ada satu pun di sini yang menjanjikan hasil apa pun.",
    },
    modes: {
      topic: "demo dan live",
      title: "Demo atau live",
      body: "Tombol demo dan live di header menentukan dari mana angka-angkanya berasal.",
      p1: "Demo disimulasikan di perangkatmu. Tanpa dompet, tanpa transaksi, tidak ada yang ditulis ke chain.",
      p2: "Live testnet membaca kontrak yang sebenarnya. Kamu bisa melihat-lihat tanpa masuk akun.",
      p3: "Untuk menetaskan dan memberi makan di mode live, tekan hubungkan dompet lalu pilih dompet NEAR. Kalau login email diaktifkan di situs ini, pilihannya muncul di daftar yang sama, didukung Privy. Dengan cara mana pun kamu menandatangani sendiri transaksi testnet, dan app tidak pernah melihat kunci dompetmu. Main satu ketuk yang opsional (Pengaturan) menambahkan kunci terbatas yang dibuat di browser ini, jadi aksi tanpa deposit tidak perlu popup.",
    },
    hatch: {
      topic: "menetaskan",
      title: "Tetaskan Snacc pertamamu",
      body: "Di mode live, setelah dompetmu terhubung, tekan Tetaskan di bilah aksi di bagian bawah.",
      p1: "Pilih peran dan stake NEAR testnet, lalu setujui transaksinya di dompetmu. Snacc baru muncul di koleksiku.",
      p2: "Tidak punya NEAR testnet? Panel dompet menautkan ke faucet NEAR gratis.",
      p3: "Di demo, ketuk satu sel untuk membuka lab dan coba semua aksi dengan angka simulasi.",
    },
    feed: {
      topic: "makan harian",
      title: "Beri makan tiap hari, atau ia disantap",
      body: "Vitalitas terkuras setiap jam, jadi tengoklah sekitar sehari sekali lalu tekan Beri makan. Memberi makan membakar sedikit $SNACC dari saldo Snacc itu sendiri dan mengisi lagi vitalitasnya.",
      p1: "Pada vitalitas efektif {distressPct} atau kurang, Snacc berstatus Tertekan, dan pemain lain bisa mengadopsinya.",
      p2: "Pada nol ia kelaparan, dan siapa saja bisa menyantapnya: pemburu mendapat {bountyPct} dari $SNACC-nya dan sisanya masuk ke The Pantry.",
      p3: "Buka bantuan kapan saja untuk aturan, glosarium, dan daftar biaya.",
    },
  },
} satisfies Messages<typeof en>;

export default onboarding;
