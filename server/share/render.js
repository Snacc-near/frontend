// @ts-check
/**
 * SVG string -> PNG with `@resvg/resvg-wasm` (pure WebAssembly: no native binary, no system fonts).
 * The three fonts in `server/assets/fonts/` (DM Sans regular and bold, JetBrains Mono; SIL OFL, licence
 * files next to them) are the only fonts the renderer sees, so output is the same on a laptop and on Vercel.
 */
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { CARD_WIDTH } from "./card.js";

const require = createRequire(import.meta.url);
const FONT_FILES = ["DMSans_400Regular.ttf", "DMSans_700Bold.ttf", "JetBrainsMono_400Regular.ttf"];

/** @type {Promise<Uint8Array[]> | null} */
let fonts = null;
/** @type {Promise<void> | null} */
let wasm = null;

function loadFonts() {
  fonts ??= Promise.all(FONT_FILES.map(async (f) => new Uint8Array(await readFile(new URL(`../assets/fonts/${f}`, import.meta.url))))).catch((e) => {
    fonts = null;
    throw e;
  });
  return fonts;
}

function loadWasm() {
  wasm ??= readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm"))
    .then((bytes) => initWasm(bytes))
    .catch((e) => {
      wasm = null;
      throw e;
    });
  return wasm;
}

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** True when the bytes start with the PNG signature. */
export function isPng(/** @type {Uint8Array} */ bytes) {
  return bytes.length > 24 && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Width and height from the IHDR chunk, or null when the bytes are not a PNG. */
export function pngSize(/** @type {Uint8Array} */ bytes) {
  if (!isPng(bytes)) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

/** Rasterizes an SVG document at the card width. Throws when the SVG cannot be parsed or rendered. */
export async function renderPng(/** @type {string} */ svg) {
  const [, fontBuffers] = await Promise.all([loadWasm(), loadFonts()]);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: CARD_WIDTH },
    font: {
      fontBuffers,
      loadSystemFonts: false,
      defaultFontFamily: "DM Sans",
      sansSerifFamily: "DM Sans",
      monospaceFamily: "JetBrains Mono",
    },
  });
  try {
    const image = resvg.render();
    try {
      return image.asPng();
    } finally {
      image.free();
    }
  } finally {
    resvg.free();
  }
}
