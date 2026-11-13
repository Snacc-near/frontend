// `@privy-io/js-sdk-core` expects a global `Buffer` in the browser (as in the plugin's own example).
// Imported first by the signing page so it runs before the Privy modules; the game never loads it.
import { Buffer } from "buffer";

const g = globalThis as { Buffer?: unknown };
if (!g.Buffer) g.Buffer = Buffer;
