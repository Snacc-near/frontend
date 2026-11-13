import type { Messages } from "../../types.ts";
import type en from "../en/landing.ts";

/**
 * Teks halaman depan dalam bahasa Indonesia (UI-161). Istilah mengikuti daftar di `./common.ts`.
 * Bentuk file ini dicek terhadap versi Inggris lewat `satisfies`.
 */
const landing = {
  skip: "Lompat ke konten",
  figureAlt: "Potongan isometrik inkubator Snacc: koloni di cawan petri di balik kaca, sebuah termometer, dan enclave berkaca buram.",

  header: {
    status: { live: "testnet live", loading: "menyambung", offline: "offline" },
    nav: { label: "Utama", story: "Cerita", live: "Live", github: "GitHub" },
    sound: "Efek suara",
    launch: "Buka app",
    language: "Bahasa",
  },

  status: {
    nav: "Bagian",
    connecting: "menyambung…",
    offline: "offline",
    live: "live · {zone} · {temp} mK",
  },

  sections: {
    "ch-01": "Masuk",
    "ch-02": "Organisme",
    "ch-03": "Metabolisme",
    "ch-04": "Koloni",
    "ch-05": "Selera",
    "ch-06": "Enclave",
    live: "Live",
    hood: "Mesin",
    "ch-07": "Buka",
    faq: "FAQ",
  },

  rail: {
    label: "Bab",
    item: "Bab {num}: {name}",
  },

  chapters: {
    ch01: {
      fig: "inkubator",
      headline: "NFT yang makan memecoin.",
      accent: "memecoin",
      line: "Kasih makan Snacc-mu, atau dia keburu disantap.",
    },
    ch02: {
      fig: "organisme",
      headline: "Setiap Snacc punya perutnya sendiri.",
      accent: "perutnya sendiri",
      line: "NFT hidup yang menyimpan $SNACC-nya sendiri dan menunjukkan seberapa kenyang dia.",
    },
    ch03: {
      fig: "metabolisme",
      headline: "Beri makan. Dia bekerja. Sebagian dari tiap suapan terbakar.",
      accent: "terbakar",
      line: "Spora jadi enzim, enzim jadi eliksir. Saat Pesta Makan, 3.5% dibakar; saat Paceklik, 2% kembali sebagai bantuan.",
    },
    ch04: {
      fig: "koloni",
      headline: "Kasih makan Snacc-mu, atau dia disantap.",
      accent: "disantap",
      line: "Snacc yang kelaparan bisa dipanen pemain lain, jadi jaga Snacc-mu tetap kenyang.",
    },
    ch05: {
      fig: "selera",
      headline: "Koloni menentukan selera makannya sendiri.",
      accent: "selera makannya",
      line: "CrucibleTemp membaca suasana hati koloni dan menggeser ekonomi antara Pesta Makan, Normal, dan Paceklik.",
    },
    ch06: {
      fig: "enclave",
      headline: "Rencana diet AI yang privat, diverifikasi on-chain.",
      accent: "diverifikasi on-chain",
      line: "Rencana dihitung di dalam TEE di NEAR AI Cloud; kontrak memeriksa tanda tangannya sebelum ada yang berubah.",
    },
    ch07: {
      fig: "pintu",
      headline: "Buka inkubatornya.",
      accent: "inkubator",
      line: "Hanya testnet. Jelajahi koloni yang hidup dan demo lab-nya.",
    },
  },

  parts: {
    incubator: "inkubator",
    stomach: "perut",
    mitochondrion: "mitokondria",
    hungryCell: "sel lapar",
    appetiteMeter: "meter selera",
    enclave: "enclave",
    cell: "sel",
    colony: "koloni",
    petriDish: "cawan petri",
    window: "jendela",
    glass: "kaca",
  },

  wordmark: {
    caption: "fig-08.kultur · {count}",
    cells: "sel",
    count: "{n} sel",
  },

  hero: {
    chip: "fig-01.inkubator · NEAR testnet",
    cta: "Masuk lab",
    scroll: "Gulir",
    hintLens: "arahkan lensa ke cawan petri",
    hintDoor: "arahkan kursor ke pintu",
  },

  ticker: {
    label: "Ticker testnet live",
    live: "live · testnet",
    connecting: "menyambung…",
    offline: "offline",
    offlineMsg: "Backend tidak menjawab, jadi tidak ada angka yang ditampilkan.",
    reading: "Membaca koloni…",
    alive: "{alive} dari {total}",
    items: {
      temp: "CrucibleTemp",
      zone: "zona",
      strains: "strain hidup",
      burned: "total dibakar",
      last: "event terakhir",
    },
  },

  loader: {
    text: "memanaskan inkubator {pct}%",
  },

  hood: {
    chip: "fig-08.di-balik-layar",
    title: "Empat komponen NEAR, satu mesin yang hidup.",
    accent: "satu mesin yang hidup",
    repos: "Kode sumber",
    openSource: "open source",
    coin: { name: "$SNACC", line: "Memecoin yang dimakan setiap Snacc. Token testnet tanpa nilai uang." },
    nft: { name: "NFT hidup", line: "Setiap Snacc adalah NFT yang gambarnya berupa SVG, digambar sendiri oleh kontraknya." },
    multi: { name: "Spora · enzim · eliksir", line: "Rantai pasoknya berupa multi-token: bahan mentah, bahan olahan, dan barang jadi." },
    tee: { name: "Rencana diet TEE", line: "Rencana dijalankan di dalam TEE; kontrak memeriksa tanda tangan enclave-nya." },
  },

  live: {
    chip: "{lead} · NEAR testnet · {contract}",
    lead: { live: "live", loading: "menyambung…", offline: "offline" },
    title: "Bukan sekadar mockup. Koloni ini hidup on-chain.",
    accent: "hidup on-chain",
    line: "Setiap angka di sini dibaca langsung dari kontrak di testnet, dan setiap kartu adalah NFT yang gambarnya digambar sendiri oleh kontrak. Hanya testnet: $SNACC tanpa nilai uang.",
    reading: "Membaca koloni…",
    offline: "Backend tidak menjawab, jadi tidak ada angka yang ditampilkan di sini.",
    zone: "Koloni sedang berada di {zone} sekarang ({rate}).",
    nums: {
      temp: "CrucibleTemp",
      supply: "suplai $SNACC",
      burned: "$SNACC dibakar",
      pantry: "The Pantry",
      minted: "Snacc tercetak",
      alive: "hidup sekarang",
      events: "event terindeks",
      block: "tinggi blok",
    },
    gallery: {
      heading: "Galeri on-chain",
      failed: "RPC NEAR testnet tidak menjawab, jadi galerinya kosong.",
      imgAlt: "SVG on-chain milik {title}",
      noImage: "tidak ada gambar on-chain",
      specimen: "spesimen-{id}.svg",
      rows: { title: "judul", owner: "pemilik", token: "token" },
    },
    txs: {
      heading: "Transaksi nyata",
      note: "Dari uji coba 2026-11-09 (paket bukti ada di repo Snacc). Tautannya membuka nearblocks.",
      detail: {
        incubate: "Extractor, strain 1",
        feed: "strain 1",
        merge: "strain 1 menyerap strain 2",
        extract: "ignis",
        transmute: "ignis + lumin jadi redactase",
        synthesize: "homeostasis",
        tee: "strain 5, ditandatangani TEE",
        burn: "pembakaran $SNACC",
        harvest: "disantap",
        takeover: "ambil alih sebuah plate",
        transfer: "strain 4 ke akun kedua",
        epoch: "tutup epoch 0",
      },
    },
  },

  finale: {
    cap: "pintu terbuka · lampu menyala",
    launch: "Buka app (testnet)",
    code: "Baca kodenya",
  },

  faq: {
    chip: "faq.md",
    title: "Pertanyaan dari depan pintu lab.",
    accent: "pintu lab",
    window: "pertanyaan.md",
    token: {
      q: "Apa itu $SNACC?",
      a: "Token NEP-141 di NEAR testnet yang dimakan setiap Snacc. Ini token testnet tanpa nilai uang; adanya supaya ekonominya bisa dimainkan dan diperiksa secara terbuka.",
    },
    live: {
      q: "Sudah live?",
      a: "Sudah, di NEAR testnet. Kontraknya {contract}; ticker, angka, dan galeri di halaman ini dibaca dari sana.",
    },
    hungry: {
      q: "Bagaimana kalau Snacc-ku tidak diberi makan?",
      a: "Kenyangnya terkuras seiring waktu. Snacc yang Kelaparan bisa diambil alih pemain lain; yang Pingsan bisa disantap siapa saja: {bounty} untuk si pemburu dan {pantry} masuk ke The Pantry.",
    },
    wallet: {
      q: "Perlu dompet?",
      a: "Kalau cuma lihat-lihat, tidak. Halaman ini dan demonya tidak butuh dompet dan tidak menandatangani apa pun. Di mode testnet live, kamu menandatangani sendiri transaksi testnet, pakai dompet NEAR-mu atau login email opsional; app tidak pernah melihat kuncimu.",
    },
  },

  footer: {
    colophon: "tentang.md",
    blurb: "NFT yang makan memecoin. Permainan ekonomi on-chain di NEAR testnet, digambar sebagai kultur lab.",
    cta: "Masuk lab",
    disclaimer: "Hanya testnet. $SNACC tanpa nilai uang. Bukan saran keuangan.",
    terms: "Syarat",
    privacy: "Privasi",
    license: "Lisensi MIT",
    copyright: "© 2026 kontributor Snacc",
    product: {
      title: "Produk",
      launch: "Buka app",
      launchNote: "testnet",
      story: "Ceritanya",
      live: "Koloni live",
      hood: "Di balik layar",
      faq: "Pertanyaan",
    },
    build: {
      title: "Kode",
      githubNote: "GitHub",
    },
    proof: {
      title: "Bukti",
      nearblocksNote: "nearblocks",
      oracleNote: "oracle TEE",
      scriptsNote: "bukti + replay",
    },
    near: {
      title: "NEAR",
      docs: "Dokumentasi NEAR",
      nftNote: "NFT",
      multiNote: "multi-token",
      explorer: "Explorer testnet",
    },
  },
} satisfies Messages<typeof en>;

export default landing;
