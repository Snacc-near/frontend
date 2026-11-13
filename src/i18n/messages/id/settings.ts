import type { Messages } from "../../types.ts";
import type en from "../en/settings.ts";

/** Pengaturan bahasa (UI-161). */
const settings = {
  language: {
    heading: "Language / Bahasa",
    group: "Bahasa",
    hint: "Hanya tersimpan di browser ini, dengan kunci {key}. Reset data lokal di bawah ikut menghapusnya.",
    partial: "Halaman depan sudah diterjemahkan; layar game masih berbahasa Inggris dan menyusul.",
  },
} satisfies Messages<typeof en>;

export default settings;
