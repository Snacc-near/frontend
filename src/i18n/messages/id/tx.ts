import type { Messages } from "../../types.ts";
import type en from "../en/tx.ts";

/**
 * Teks transaksi dan galat kontrak dalam bahasa Indonesia (UI-161 fase B2). Nama kunci `ERR_*` dan nama
 * method adalah milik kontrak, jadi tidak diterjemahkan. Istilah mengikuti daftar di `./common.ts`.
 */
const tx = {
  rejected: "Kamu menutup atau menolak permintaan dompet. Tidak ada yang dikirim.",
  refused: "Kontrak menolak panggilan itu ({code}).",
  notEnoughNear: "Akunmu tidak punya cukup NEAR testnet untuk transaksi ini.",
  outOfGas: "Transaksi kehabisan gas.",
  notConnected: "Dompet tidak terhubung. Hubungkan lagi.",
  failed: "Transaksi tidak berhasil.",

  errors: {
    ERR_INSUFFICIENT_DEPOSIT: "NEAR yang dilampirkan kurang dari yang dibutuhkan aksi ini.",
    ERR_STAKE_DEPOSIT_MISMATCH: "Stake harus sama dengan NEAR yang kamu lampirkan.",
    ERR_INSUFFICIENT_BALANCE: "$SNACC tidak cukup untuk ini. Coba jumlah yang lebih kecil.",
    ERR_NOT_OWNED_BY_CALLEE: "Kamu hanya bisa memberi makan Snacc milikmu.",
    ERR_NOT_STRAIN_OWNER: "Kamu hanya bisa melakukan ini dengan Snacc milikmu.",
    ERR_STRAIN_NOT_FOUND: "Snacc itu tidak ada di kontrak ini.",
    ERR_STRAIN_STARVING: "Snacc ini sudah kelaparan (vitalitas 0) dan tidak bisa diberi makan lagi.",
    ERR_ROLE_MASK_NOT_SINGLE: "Pilih tepat satu peran untuk Snacc baru.",
    ERR_ACCOUNT_NOT_REGISTERED: "Akunmu belum terdaftar di kontrak.",
    ERR_YOCTO_REQUIRED: "Aksi ini butuh tepat 1 yoctoNEAR terlampir.",
    ERR_ALREADY_LIQUIDATED: "Snacc ini sudah dilikuidasi.",
    ERR_COLONY_FULL: "Koloni-mu penuh.",
    ERR_BAD_AMOUNT: "Jumlah itu tidak valid.",
    ERR_NOT_ENOUGH_ATP: "Snacc ini tidak punya cukup ATP untuk itu.",
    ERR_ALREADY_ALLOCATED: "Snacc ini sudah mengalokasikan ATP di epoch ini. Coba lagi setelah epoch ditutup.",
    ERR_ORGANEL_LEVEL_MAX: "Level organel berkisar dari 0 sampai 5.",
    ERR_STRAIN_ALREADY_SPLICED: "Snacc ini sudah digabung atau dilikuidasi dan tidak bisa beraksi lagi.",
    ERR_MAX_GENERATION: "Batas generasi (8) sudah tercapai.",
    ERR_BIRTHS_EXCEEDED: "Kontrak hanya mengizinkan pembelahan setelah ada penggabungan atau lisis (total pembelahan ≤ penggabungan + lisis).",
    ERR_ROLE_NOT_ALLOWED: "Snacc ini tidak punya peran yang dibutuhkan langkah ini.",
    ERR_UNKNOWN_TOKEN: "Kontrak tidak mengenal molekul itu.",
    ERR_RECIPE_NOT_MET: "Jumlah itu tidak sesuai dengan ukuran kelompok resep.",
    ERR_REQUIRES_TEE_ATTESTATION: "Elixir-aether butuh Snacc yang pernah mengalami mutasi TEE terverifikasi.",
    ERR_NPC_UNKNOWN: "Pedagang itu tidak ada di kontrak ini.",
    ERR_NPC_OUT_OF_STOCK: "Pedagang tidak punya spora sebanyak itu lagi.",
    ERR_SAME_STRAIN: "Pilih dua Snacc yang berbeda (atau akun lain).",
    ERR_NOT_SAME_OWNER: "Kedua Snacc harus milikmu.",
    ERR_NOT_DISTRESSED: "Snacc itu sudah tidak tertekan lagi (vitalitas harus 1 sampai 2,000).",
    ERR_STRAIN_NOT_INSOLVENT: "Snacc itu tidak kelaparan (vitalitas di atas 0), jadi tidak bisa dipanen.",
    ERR_STATE_NONCE_CHANGED_SELLER_DRAIN_BLOCKED: "Snacc itu berubah sejak kamu melihatnya. Muat ulang daftar dan coba lagi.",
    ERR_PENDING_ASYNC_CALLBACK_LOCKED: "Snacc itu punya panggilan lintas kontrak yang tertunda. Coba lagi sebentar lagi.",
    ERR_ROLE_LOCKED_NEEDS_SYNTHESIZER_GENE: "Menebus elixir-aether butuh Snacc berperan Synthesizer.",
    ERR_INSUFFICIENT_AETHER: "Snacc ini tidak memegang elixir-aether sebanyak itu.",
    ERR_EPOCH_NOT_CLOSED: "Epoch itu belum ditutup, jadi tidak ada yang bisa diklaim.",
    ERR_DIVIDEND_ALREADY_CLAIMED: "Snacc ini sudah mengklaim epoch itu.",
    ERR_DIVIDEND_CLAIM_EXPIRED: "Epoch itu lebih lama dari jendela klaim 8 epoch.",
    ERR_DIVIDEND_POOL_EMPTY: "Tidak ada yang dibayarkan untuk epoch itu (tanpa kontribusi, atau kolam kosong).",
    ERR_LISTING_NOT_FOUND: "Listing itu sudah hilang: sudah dibeli, ditarik, atau tidak pernah ada. Muat ulang daftar.",
    ERR_SELLER_CANNOT_BUY: "Kamu tidak bisa membeli listing-mu sendiri.",
    ERR_NOT_SELLER: "Hanya penjual yang bisa mengubah atau menarik listing ini.",
    ERR_BAD_PRICE: "Harga harus lebih dari nol dan paling banyak 10,000 NEAR.",
    ERR_MORE_GAS_REQUIRED: "Gas yang dilampirkan terlalu sedikit untuk panggilan ini. Coba lagi dengan gas bawaan dompet.",
    ERR_LISTINGS_PAUSED: "Market sedang tidak menerima listing baru.",
    ERR_ALREADY_LISTED: "Snacc itu sudah di-listing.",
    ERR_SELLER_LISTING_CAP: "Kamu sudah punya 20 listing terbuka, batas maksimal untuk satu akun.",
    ERR_MARKET_FULL: "Market penuh (1,000 listing terbuka). Coba lagi nanti.",
    ERR_BAD_MSG: "Pesan listing tidak diterima oleh market.",
    ERR_NOT_NFT_CONTRACT: "Market hanya menerima Snacc dari kontrak Snacc.",
    ERR_NOT_OWNER: "Hanya pemilik market yang bisa melakukan ini.",
  },

  methods: {
    extract_spores: { ERR_STAKE_DEPOSIT_MISMATCH: "NEAR yang dilampirkan harus sama dengan biaya katalis." },
    synthesize_elixir: {
      ERR_STAKE_DEPOSIT_MISMATCH: "NEAR yang dilampirkan harus sama dengan biaya katalis.",
      ERR_INSUFFICIENT_BALANCE: "Snacc ini tidak memegang cukup enzim untuk sebanyak itu kelompok.",
    },
    transmute_spores_to_enzyme: {
      ERR_STAKE_DEPOSIT_MISMATCH: "NEAR yang dilampirkan harus sama dengan biaya katalis setelah diskon diet. Zonanya mungkin baru berubah; buka lagi dan coba lagi.",
      ERR_INSUFFICIENT_BALANCE: "Snacc ini tidak memegang cukup spora untuk resep mana pun pada jumlah itu.",
    },
    npc_buy_spores: {
      ERR_INSUFFICIENT_BALANCE: "Snacc ini tidak memegang cukup $SNACC untuk harga yang ditawarkan.",
      ERR_NOT_OWNED_BY_CALLEE: "Kamu hanya bisa membeli spora untuk Snacc milikmu.",
    },
    adopt: {
      ERR_INSUFFICIENT_BALANCE: "Snacc pembayarmu tidak memegang cukup $SNACC untuk nilai bukunya.",
      ERR_NOT_OWNED_BY_CALLEE: "Snacc pembayar harus milikmu.",
      ERR_COLONY_FULL: "Koloni-mu penuh (5 Snacc hidup), jadi tidak bisa menampung satu lagi.",
    },
    hostile_takeover_splice: {
      ERR_INSUFFICIENT_BALANCE: "Snacc penyerbumu tidak memegang cukup $SNACC untuk nilai buku + 15%.",
      ERR_NOT_OWNED_BY_CALLEE: "Snacc penyerbu harus milikmu.",
    },
    splice_strains: { ERR_NOT_OWNED_BY_CALLEE: "Snacc dominan harus milikmu." },
    divide_strain: { ERR_NOT_OWNED_BY_CALLEE: "Kamu hanya bisa membagi Snacc milikmu." },
    allocate_atp: { ERR_NOT_OWNED_BY_CALLEE: "Kamu hanya bisa mengalokasikan ATP pada Snacc milikmu." },
    ft_transfer: {
      ERR_ACCOUNT_NOT_REGISTERED: "Penerima belum terdaftar di kontrak, jadi belum bisa memegang $SNACC.",
      ERR_INSUFFICIENT_BALANCE: "Saldo $SNACC dompet-mu lebih rendah dari jumlah itu.",
    },
    nft_transfer: {
      ERR_SAME_STRAIN: "Kamu tidak bisa mengirim Snacc ke dirimu sendiri.",
      ERR_NOT_OWNED_BY_CALLEE: "Kamu hanya bisa memberikan Snacc milikmu.",
      ERR_ALREADY_LIQUIDATED: "Snacc yang sudah mati tidak bisa diberikan.",
    },
    nft_transfer_call: {
      ERR_NOT_OWNED_BY_CALLEE: "Kamu hanya bisa me-listing Snacc milikmu.",
      ERR_ALREADY_LIQUIDATED: "Snacc yang sudah mati tidak bisa di-listing.",
      ERR_SAME_STRAIN: "Kamu tidak bisa me-listing Snacc ke dirimu sendiri.",
    },
    buy: { ERR_INSUFFICIENT_DEPOSIT: "NEAR yang dilampirkan kurang dari harga listing. Muat ulang daftar: harganya mungkin berubah." },
  },
} satisfies Messages<typeof en>;

export default tx;
