/**
 * Safe SVG inspector helpers (UI-120..122).
 * Strain SVG comes from `/api/strains/{id}/svg` (the `nft_token` media).
 * That SVG is untrusted chain data, so it is never injected with
 * `dangerouslySetInnerHTML`. It is rendered via an `<img>` with a
 * `data:image/svg+xml;base64,` source, which keeps scripts and
 * external references inert in the browser.
 */

export const SVG_DATA_URI_PREFIX = "data:image/svg+xml;base64,";

function isSvgDocument(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
}

function toBase64Utf8(text: string): string {
  if (typeof btoa === "function") {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return Buffer.from(text, "utf-8").toString("base64");
}

export function svgToSafeDataUri(svg: string): string | null {
  if (typeof svg !== "string" || svg.trim().length === 0) return null;
  if (!isSvgDocument(svg)) return null;
  try {
    return SVG_DATA_URI_PREFIX + toBase64Utf8(svg);
  } catch {
    return null;
  }
}

export function buildDemoSvgDataUri(strainId: number): string | null {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">` +
    `<rect width="320" height="320" fill="#071524"/>` +
    `<circle cx="160" cy="150" r="70" fill="#0e2a3f" stroke="#34d399" stroke-width="3"/>` +
    `<text x="160" y="145" text-anchor="middle" font-family="monospace" font-size="18" fill="#a7f3d0">strain #${strainId}</text>` +
    `<text x="160" y="172" text-anchor="middle" font-family="monospace" font-size="12" fill="#7dd3fc">demo svg (simulated)</text>` +
    `</svg>`;
  return svgToSafeDataUri(svg);
}
