import type { Messages } from "../../types.ts";
import type en from "../en/hud.ts";

/** Teks HUD game dalam bahasa Indonesia (UI-161 fase B1). Istilah mengikuti daftar di `./common.ts`. */
const hud = {
  resources: {
    region: "sumber daya",
    demo: "demo · simulasi",
    live: "live · testnet",
    biolab: { atp: "atp", spores: "spora", enzymes: "enzim", elixir: "eliksir" },
    fintech: { atp: "int-atp", spores: "kupon", enzymes: "kliring", elixir: "cadangan" },
  },

  queue: {
    region: "antrean produksi",
    title: "antrean produksi",
    demo: "demo · simulasi",
    live: "hanya nilai live",
    ready: "siap",
    left: "sisa {s} dtk",
    progress: "progres {kind}",
    collectKind: "ambil {kind}",
    notReady: "{kind} belum siap",
    collect: "ambil",
  },

  dock: { region: "aksi koloni" },

  sim: {
    label: "simulasi cawan:",
    hypothermia: "hipotermia (575)",
    goldilocks: "goldilocks (605)",
    fever: "demam (632)",
    burst: "lisis / ledakan!",
  },

  tools: {
    group: "alat game",
    telemetry: "telemetri",
    more: "alat",
    heading: "Alat",
    collection: "koleksiku",
    market: "pasar",
    npc: { biolab: "pedagang npc", fintech: "market maker" },
    swap: "kuotasi swap",
    social: { biolab: "pesta besar", fintech: "pemberi makan teratas" },
    thesis: "tesis",
    recipes: "resep",
    guest: "label tamu",
    guestNamed: "tamu: {name}",
    quests: "misi",
    profile: "profil",
    notifications: "notifikasi",
    help: "bantuan",
    settings: "pengaturan",
  },

  wallet: {
    oneTapTitle: "Aksi tanpa deposit ditandatangani di browser ini tanpa popup dompet. Pengaturan → Main satu ketuk.",
    oneTapOn: "satu ketuk aktif",
    restoring: "memulihkan dompet…",
    opening: "membuka dompet…",
    connect: "sambungkan dompet",
    note: "testnet · opsional · app tidak pernah melihat kuncimu",
    connected: "dompet tersambung",
    disconnectAria: "putuskan {account}",
    disconnect: "putuskan",
    testnet: "testnet",
    noValue: "$SNACC di testnet tanpa nilai uang",
    lowNear: "NEAR testnet tidak cukup untuk menetaskan (sekitar 0.27 NEAR termasuk biaya). Ambil NEAR testnet gratis dari {faucet}.",
    faucet: "faucet NEAR testnet",
  },

  account: {
    signOutAria: "keluar dari profil (dompet tetap tersambung)",
    signOut: "keluar",
    signing: "tanda tangani pesan di dompetmu…",
    signIn: "Simpan progres — masuk",
    note: "menandatangani pesan, bukan transaksi · tanpa biaya",
    signInFirst: "Masuk dulu untuk mengklaim paket awal.",
    asking: "meminta…",
    getNear: "Ambil NEAR testnet untuk mulai",
    sent: "Terkirim {amount} NEAR testnet.",
    tx: "tx {hash}…",
  },

  filter: {
    region: "penyorot akun near",
    label: "sorot akun:",
    placeholder: "mis.: alice.testnet",
    clear: "hapus filter akun",
    highlighting: "menyorot {n} strain di cawan",
    none: "tidak ada strain milik akun ini di cawan",
  },

  mode: {
    group: "mode arena game",
    demo: "demo · simulasi",
    live: "testnet live",
  },

  skinSwitch: {
    group: "pilihan istilah ADR-31",
    biolab: "bio-lab",
    fintech: "fintech",
  },

  appetite: {
    region: "meter selera",
    demo: "demo, simulasi",
    zone: "zona",
    goldilocksDemo: "goldilocks (demo)",
    riskHeat: "panas risiko",
    loading: "memuat…",
    unavailable: "tidak tersedia",
    live: "live · /api/appetite",
    none: "belum ada data selera",
    feast: "progres pesta",
    vol: "vol {v}",
    tgt: "tgt {v}",
  },

  breach: {
    region: "umpan ambang reaktor",
    title: "log ambang & event",
    open: "buka",
    close: "tutup",
    sla: "sla < 2000 ms",
    indexer: "indexer sedang mengejar — daftar event mungkin belum lengkap",
    empty: "belum ada event ambang yang tercatat",
    slaPass: "sla lolos",
    slaMiss: "sla meleset",
  },

  bell: { aria: "notifikasi, {n} belum dibaca", plain: "notifikasi", label: "notifikasi" },

  xp: {
    badgeTitle: "level {n}",
    badge: "Lv {n}",
    region: "level dan pengalaman",
    level: "Level {n}",
    total: "{n} XP",
    bar: "level {level}: {into} dari {span} XP",
    toNext: "{n} XP lagi ke level {level}",
  },

  signIn: { connectFirst: "sambungkan dompet dulu" },

  vitals: { status: "status:" },

  atp: { unit: "atp" },

  thermal: {
    region: "{zone} {temp} milikelvin",
    unit: "mk",
    hypothermia: "ambang hipotermia: < {mk} mk",
    goldilocks: "rentang goldilocks: {lo}..{hi} mk",
    fever: "ambang demam: > {mk} mk",
    thresholds: "ambang 600 / 610",
  },

  burst: {
    ariaActive: "{label}: diskon {pct}%",
    ariaStandby: "{label}: siaga",
    until: "sampai epoch {epoch}",
    standby: "siaga",
  },
} satisfies Messages<typeof en>;

export default hud;
