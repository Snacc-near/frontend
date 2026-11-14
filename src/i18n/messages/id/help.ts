import type { Messages } from "../../types.ts";
import type en from "../en/help.ts";

/**
 * Jendela Bantuan "Cara main" dalam bahasa Indonesia (UI-161 fase B4). Angka diisi dari konstanta kode lewat
 * `{...}`, tidak diketik di sini. Istilah mengikuti daftar di `./common.ts`; "Tertekan" untuk Distressed dan
 * "Kelaparan" untuk Starving mengikuti jendela aksi. Halaman hukum tetap berbahasa Inggris.
 */
const help = {
  modal: {
    heading: "Cara main",
    footer: "angka berasal dari konstanta kode atau sumber kontrak, masing-masing dengan sumbernya",
    cap: "aturan, glosarium, dan biaya",
    replay: "putar ulang pengantar",
    tabsLabel: "bagian bantuan",
    tabRules: "aturan",
    tabGlossary: "glosarium",
    tabCosts: "biaya",
  },

  costs: {
    lead: "Biaya-biayanya.",
    note: "Angka testnet. $SNACC di testnet tanpa nilai uang, dan tidak ada satu pun di sini yang menjanjikan imbalan apa pun.",
    source: "sumber:",
  },

  legal: {
    aria: "hukum",
    line: "hanya testnet · $snacc tanpa nilai uang",
    terms: "ketentuan",
    privacy: "privasi",
    onlyEnglish: "Halaman ini hanya tersedia dalam bahasa Inggris.",
  },

  rules: {
    loop: {
      title: "Putarannya",
      body: "Tetaskan Snacc, beri makan sekitar sehari sekali, dan jaga vitalitasnya dari zona merah. Snacc yang kenyang tetap milikmu; yang lapar bisa diadopsi atau disantap pemain lain.",
    },
    hatch: {
      title: "Menetaskan",
      body: "Menetaskan (incubate_strain) butuh dompet yang terhubung di mode live. Kamu memilih peran (Extractor, Fermenter, atau Synthesizer) dan stake NEAR, lalu dompet menandatangani panggilannya. Snacc baru mulai dengan vitalitas {initialVitalityPct} dan {initialAtp} ATP.",
    },
    feed: {
      title: "Memberi makan",
      body: "Memberi makan (feed_strain) membakar $SNACC dari saldo Snacc itu sendiri. Vitalitas diatur ke vitalitas efektif saat ini ditambah {recovery} (paling banyak {vitalityCap}) dan jam laparnya dimulai ulang. Hanya pemilik yang bisa memberi makan.",
    },
    decay: {
      title: "Rasa lapar",
      body: "Vitalitas efektif adalah vitalitas tersimpan dikurangi jumlah jam sejak pemberian makan terakhir dikali laju lapar (BMR). Kontrak menghitungnya setiap kali dibaca, jadi tidak ada yang perlu berjalan di latar belakang.",
    },
    risk: {
      title: "Saat lapar menggigit",
      body: "Pada vitalitas efektif 1 sampai {distressMax}, Snacc Tertekan dan pesaing bisa mengadopsinya. Pada 0 ia kelaparan dan siapa saja bisa menyantapnya. Snacc yang kelaparan tidak bisa diberi makan.",
    },
    zones: {
      title: "Zona",
      body: "Termostat ala bank sentral, CrucibleTemp, menentukan zona dari pembacaannya dalam mK. Di bawah {hypoMk} mK itu Hipotermia (Paceklik di halaman depan), dari {hypoMk} sampai {feverMk} mK Goldilocks (Selera Normal), di atas {feverMk} mK Demam (Pesta Makan). Skin fintech menamainya rabat stimulus, keseimbangan pasar, dan pembakaran kontra-siklus.",
    },
    modes: {
      title: "Yang berfungsi di mode live saat ini",
      body: "Di mode testnet live, dompetmu menandatangani setiap aksi pemain: menetaskan, memberi makan, memproduksi ATP, extract, transmute, synthesize, membagi, menggabungkan, ambil alih paksa, adopsi, memanen Snacc yang kelaparan, membeli spora dari NPC, mengklaim pembagian kolam industri, serta menghadiahkan atau mengirim Snacc dan $SNACC. $SNACC di testnet tanpa nilai uang.",
    },
  },

  glossary: {
    snacc: {
      term: "Snacc",
      body: "NFT hidup (disebut strain di kontrak) dengan saldo $SNACC, inventaris, dan vitalitasnya sendiri. Kode dan pengaturan skin juga menyebutnya sel hidup atau anak usaha NFT.",
    },
    vitality: {
      term: "Vitalitas",
      body: "Kesehatan tersimpan sebuah Snacc pada skala 0 sampai {vitalityMax}, ditampilkan dalam persen. Memberi makan menaikkannya; jam sejak pemberian makan terakhir menurunkan angka efektifnya.",
    },
    "effective-vitality": {
      term: "Vitalitas efektif",
      body: "Vitalitas pada saat ini: vitalitas tersimpan dikurangi jumlah jam sejak pemberian makan terakhir dikali laju lapar. Angka inilah yang menentukan status Tertekan dan kelaparan.",
    },
    bmr: {
      term: "Laju lapar (BMR)",
      body: "Vitalitas yang hilang per jam: {bmrExtractor} untuk Extractor, {bmrFermenter} untuk Fermenter, dan {bmrSynthesizer} untuk Synthesizer. Organel lisosom menurunkannya {organelPct} per level.",
    },
    atp: {
      term: "ATP",
      body: "Energi internal, bukan token yang bisa ditransfer. Snacc baru mulai dengan {initialAtp}. Memberi makan mencetak lebih banyak, bergantung pada efisiensi dan level mitokondria, dan dipakai untuk kerja internal seperti peningkatan organel.",
    },
    organelles: {
      term: "Organel",
      body: "Tiga slot peningkatan, masing-masing sampai level {maxOrganelLevel}. Mitokondria menaikkan ATP per pemberian makan, nukleus menaikkan output produksi, dan lisosom menurunkan laju lapar, masing-masing {organelPct} per level. Satu alokasi per epoch, 1 ATP per level yang didapat.",
    },
    zones: {
      term: "Zona: Hipotermia, Goldilocks, Demam",
      body: "Pembacaan termostat (CrucibleTemp, dalam mK) menentukan zona. Hipotermia di bawah {hypoMk} mK dan memberi rabat {rebatePct}; Goldilocks dari {hypoMk} sampai {feverMk} mK tanpa bakar dan tanpa rabat; Demam di atas {feverMk} mK dan membakar {feverBurnPct} dari biaya. Halaman depan menamainya Bantuan Paceklik, Selera Normal, dan Pesta Makan.",
    },
    distressed: {
      term: "Tertekan",
      body: "Vitalitas efektif dari 1 sampai {distressMax} (hingga {distressPct}). Snacc itu masih milik pemiliknya, tetapi pemain lain boleh mengadopsinya. Halaman depan menyebut rentang ini Kelaparan.",
    },
    starving: {
      term: "Kelaparan",
      body: "Vitalitas efektif 0. Snacc tidak bisa diberi makan lagi dan siapa saja boleh menyantapnya. Halaman depan menyebut keadaan ini Pingsan.",
    },
    adopt: {
      term: "Adopsi",
      body: "Mengambil alih Snacc yang Tertekan (hostile_takeover_splice). Pengadopsi membayar nilai bukunya ditambah {adoptPremiumPct}; pemilik lama menerima {adoptSellerPct} dari pembayaran itu dan {adoptTreasuryPct} masuk ke The Pantry. Snacc yang diadopsi diserap ke dalam Snacc milik pengadopsi.",
    },
    snack: {
      term: "Santap",
      body: "Menguangkan Snacc yang kelaparan (harvest_starving_strain, disebut juga Cell Lysis). Siapa saja boleh melakukannya. Pemburu menerima {bountyPct} dari $SNACC-nya dan The Pantry menerima sisanya; Snacc itu lalu dilikuidasi.",
    },
    pantry: {
      term: "The Pantry",
      body: "Kas yang terikat aturan: kolam yang diisi kontrak dari biaya lalu dibagi, dan tidak bisa ditarik oleh admin mana pun.",
    },
    sharePool: {
      term: "Pembagian kolam",
      body: "Tiap epoch ({epochHours} jam), {dividendPct} dari biaya yang tidak dibakar disisihkan ke kolam pembagian. Para pemilik berbagi sesuai Aether yang mereka bakar di epoch itu dan mengklaimnya dengan claim_industrial_dividend setelah epoch ditutup, sampai {claimEpochs} epoch ke belakang.",
    },
    epoch: {
      term: "Epoch",
      body: "Hari milik kontrak: {epochHours} jam. Alokasi, diskon ledakan, dan pembagian kolam dihitung per epoch.",
    },
    burst: {
      term: "Ledakan nutrisi",
      body: "Menyantap sebuah Snacc melepaskan diskon pemberian makan selama satu epoch. Mulai dari dasar {baseBurstPct}, tumbuh sesuai yang dilepaskan, dan dibatasi sampai {maxBurstPct}.",
    },
    profile: {
      term: "Profil",
      body: "Opsional. \"Save progress — sign in\" di samping dompet meminta dompet menandatangani pesan pendek (bukan transaksi, tanpa biaya). Setelah itu kamu mendapat username, bio, avatar yang dipilih dari Snacc-mu sendiri, notifikasi, dan halaman publik di /p/<akunmu>. Game berjalan sama saja tanpa profil.",
    },
    achievements: {
      term: "Pencapaian dan runtun",
      body: "Lencana yang diberikan database profil dari aksi bertanda tangan yang tercatat, seperti penetasan pertama, sepuluh kali memberi makan, atau runtun makan tujuh hari. Runtun menghitung hari berturut-turut dengan setidaknya satu pemberian makan yang tercatat. Semuanya hanya dicatat selama kamu masuk, dan tidak bernilai uang.",
    },
  },

  rows: {
    stake: {
      item: "Stake penetasan",
      value: "{stakeDefault} NEAR secara bawaan",
      note: "Formulir menerima {stakeMin} sampai {stakeMax} NEAR di testnet. Jumlahnya dilampirkan pada incubate_strain.",
    },
    "stake-split": {
      item: "Ke mana stake pergi",
      value: "{stakePantryPct} ke The Pantry, sisanya ke Snacc",
      note: "Bagian The Pantry adalah biaya inkubasi; sisanya menjadi modal kerja Snacc.",
    },
    "low-near": {
      item: "NEAR yang dibutuhkan untuk satu penetasan bawaan",
      value: "dompet di bawah {lowNear} NEAR ditandai terlalu rendah",
      note: "Mencakup stake bawaan, pendaftaran penyimpanan, dan gas.",
    },
    storage: {
      item: "Pendaftaran $SNACC pertama",
      value: "{storageNear} NEAR sebagai minimum cadangan",
      note: "App membaca minimum yang sebenarnya dari storage_balance_bounds dan memakai angka ini hanya bila pembacaan itu gagal.",
    },
    gas: {
      item: "Gas",
      value: "sampai {tgas} TGas dibayar di muka per penetasan atau pemberian makan",
      note: "Gas yang dibayar di muka adalah batas. Protokol mengembalikan yang tidak terpakai, jadi kamu hanya membayar gas yang benar-benar terbakar.",
    },
    feed: {
      item: "Beri makan",
      value: "{feedDefault} $SNACC secara bawaan",
      note: "Dibakar dari saldo Snacc itu sendiri, tanpa NEAR dilampirkan. Setiap pemberian makan memulihkan {recovery} vitalitas (sampai {vitalityCap}).",
    },
    rescue: {
      item: "Diskon penyelamatan saat memberi makan",
      value: "biaya naik dari {rescuePct} (pada vitalitas efektif 0) sampai 100% (saat penuh)",
      note: "Makin lapar Snacc-nya, makin murah pemberian makan berikutnya.",
    },
    hunger: {
      item: "Rasa lapar per jam",
      value: "{bmrExtractor} / {bmrFermenter} / {bmrSynthesizer} vitalitas",
      note: "Untuk Extractor, Fermenter, dan Synthesizer. Snacc mulai dari {initialVitality}, jadi Extractor yang tidak diberi makan habis setelah {hoursEmpty} jam (turunan: {initialVitality} / {bmrExtractor}).",
    },
    thermostat: {
      item: "Termostat",
      value: "Demam membakar {feverBurnPct} dari biaya; Hipotermia memberi rabat {rebatePct}",
      note: "Batas zona adalah {hypoMk} mK dan {feverMk} mK.",
    },
    snack: {
      item: "Menyantap Snacc yang kelaparan",
      value: "pemburu {bountyPct}, The Pantry {pantryPct}",
      note: "Pembagian saldo $SNACC milik Snacc yang kelaparan.",
    },
    adopt: {
      item: "Mengadopsi Snacc yang Tertekan",
      value: "nilai buku + {adoptPremiumPct}",
      note: "Dari pembayaran itu, {adoptSellerPct} ke pemilik lama dan {adoptTreasuryPct} ke The Pantry.",
    },
    merge: {
      item: "Menggabungkan dua Snacc-mu",
      value: "pajak penggabungan {mergerPct} ke The Pantry",
      note: "Berlaku untuk splice_strains.",
    },
    organel: {
      item: "Peningkatan organel",
      value: "1 ATP per level yang didapat",
      note: "Satu alokasi per epoch, tiap slot sampai level {maxOrganelLevel}.",
    },
    sharePool: {
      item: "Kolam pembagian",
      value: "{dividendPct} dari biaya yang tidak dibakar",
      note: "Diklaim setelah epoch ditutup, sampai {claimEpochs} epoch ke belakang.",
    },
  },
} satisfies Messages<typeof en>;

export default help;
