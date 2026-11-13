/**
 * RES-111 one-tap key: made and kept in this browser, never sent anywhere (only its public key
 * goes on chain, inside the wallet's `AddKey`).
 *
 * Storage, per network and account id (`testnet:alice.testnet`):
 * - preferred: IndexedDB database `snacc_one_tap`, object store `keys`, holding a NON-extractable
 *   Web Crypto Ed25519 `CryptoKey`. Page scripts can ask the browser to sign with it, but cannot
 *   read the key bytes out;
 * - fallback, only when IndexedDB cannot hold a CryptoKey here: localStorage key `snacc_one_tap`,
 *   holding the PKCS#8 private key bytes (base64). Settings says so when this is in use.
 * Without Web Crypto Ed25519 there is no one-tap play: no JavaScript signer is bundled.
 */
import { CONTRACT_ID } from "./actions.ts";
import { base58Decode, base58Encode, fromBase64, toBase64, type OneTapSigner } from "./oneTap.ts";
import { ONE_TAP_LOCAL_KEY } from "../prefs/prefs.ts";

/** localStorage key of the fallback store (defined with the other app keys, listed in Settings → Reset local data). */
export { ONE_TAP_LOCAL_KEY };

export type KeyStorageKind = "indexeddb" | "localstorage";

export const ONE_TAP_DB = "snacc_one_tap";
const ONE_TAP_DB_STORE = "keys";

export interface OneTapRecord {
  v: 1;
  network: string;
  accountId: string;
  contractId: string;
  /** `ed25519:<base58>` */
  publicKey: string;
  methodNames: string[];
  allowanceYocto: string;
  createdAt: number;
  storage: KeyStorageKind;
  /** IndexedDB: the non-extractable private key. */
  privateKey?: CryptoKey;
  /** localStorage fallback: base64 PKCS#8 private key. */
  pkcs8?: string;
}

export const scopeOf = (network: string, accountId: string) => `${network}:${accountId}`;

export interface OneTapStore {
  kind: KeyStorageKind;
  get(scope: string): Promise<OneTapRecord | null>;
  put(scope: string, rec: OneTapRecord): Promise<void>;
  remove(scope: string): Promise<void>;
  /** Closes an open connection (IndexedDB), so the database can be deleted. */
  close?(): void;
}

const isRecord = (v: unknown): v is OneTapRecord =>
  !!v && typeof v === "object" && (v as OneTapRecord).v === 1 && typeof (v as OneTapRecord).publicKey === "string" && typeof (v as OneTapRecord).accountId === "string";

/** In-memory store (tests, and a stand-in that never persists). */
export class MemoryOneTapStore implements OneTapStore {
  readonly map = new Map<string, OneTapRecord>();
  constructor(readonly kind: KeyStorageKind = "indexeddb") {}
  async get(scope: string) {
    return this.map.get(scope) ?? null;
  }
  async put(scope: string, rec: OneTapRecord) {
    this.map.set(scope, rec);
  }
  async remove(scope: string) {
    this.map.delete(scope);
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** localStorage fallback: one JSON map under `snacc_one_tap`, keyed by scope. */
export function webStorageStore(storage: StorageLike): OneTapStore {
  const read = (): Record<string, OneTapRecord> => {
    try {
      const parsed = JSON.parse(storage.getItem(ONE_TAP_LOCAL_KEY) ?? "{}") as Record<string, unknown>;
      return Object.fromEntries(Object.entries(parsed ?? {}).filter(([, v]) => isRecord(v))) as Record<string, OneTapRecord>;
    } catch {
      return {};
    }
  };
  const write = (all: Record<string, OneTapRecord>) => {
    if (Object.keys(all).length === 0) storage.removeItem(ONE_TAP_LOCAL_KEY);
    else storage.setItem(ONE_TAP_LOCAL_KEY, JSON.stringify(all));
  };
  return {
    kind: "localstorage",
    async get(scope) {
      return read()[scope] ?? null;
    },
    async put(scope, rec) {
      const { privateKey: _drop, ...plain } = rec;
      void _drop;
      write({ ...read(), [scope]: plain });
    },
    async remove(scope) {
      const all = read();
      delete all[scope];
      write(all);
    },
  };
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function openDb(idb: IDBFactory, onClosed: () => void = () => undefined): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(ONE_TAP_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(ONE_TAP_DB_STORE)) req.result.createObjectStore(ONE_TAP_DB_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Let "Reset local data" (deleteDatabase) and other tabs' upgrades through instead of blocking them.
      db.onversionchange = () => {
        db.close();
        onClosed();
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB is not available"));
    req.onblocked = () => reject(new Error("IndexedDB is blocked"));
  });
}

/** IndexedDB store; records keep the `CryptoKey` object itself (structured clone). */
export function indexedDbStore(idb: IDBFactory): OneTapStore {
  let db: Promise<IDBDatabase> | null = null;
  const tx = async <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    if (!db) {
      const opening: Promise<IDBDatabase> = openDb(idb, () => {
        // Closed for a delete or an upgrade elsewhere: the next use opens a fresh connection.
        if (db === opening) db = null;
      }).catch((e) => {
        if (db === opening) db = null;
        throw e;
      });
      db = opening;
    }
    const store = (await db).transaction(ONE_TAP_DB_STORE, mode).objectStore(ONE_TAP_DB_STORE);
    return idbRequest(run(store));
  };
  return {
    kind: "indexeddb",
    async get(scope) {
      const v = await tx("readonly", (s) => s.get(scope));
      return isRecord(v) ? v : null;
    },
    async put(scope, rec) {
      await tx("readwrite", (s) => s.put(rec, scope));
    },
    async remove(scope) {
      await tx("readwrite", (s) => s.delete(scope));
    },
    close() {
      const open = db;
      db = null;
      void open?.then((d) => d.close()).catch(() => undefined);
    },
  };
}

// ---------------------------------------------------------------------------- Web Crypto Ed25519

const ED25519 = { name: "Ed25519" } as const;

/** True when this browser can make and use Ed25519 keys in Web Crypto. */
export async function ed25519Available(subtle: SubtleCrypto | null | undefined): Promise<boolean> {
  if (!subtle) return false;
  try {
    const kp = (await subtle.generateKey(ED25519, false, ["sign", "verify"])) as CryptoKeyPair;
    const sig = await subtle.sign(ED25519, kp.privateKey, new Uint8Array([1, 2, 3]));
    return new Uint8Array(sig).length === 64;
  } catch {
    return false;
  }
}

export interface NewOneTapKey {
  publicKey: string;
  privateKey?: CryptoKey;
  pkcs8?: string;
}

/** A fresh key pair: non-extractable for IndexedDB, PKCS#8 bytes for the localStorage fallback. */
export async function generateOneTapKey(storage: KeyStorageKind, subtle: SubtleCrypto): Promise<NewOneTapKey> {
  const extractable = storage === "localstorage";
  const kp = (await subtle.generateKey(ED25519, extractable, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle.exportKey("raw", kp.publicKey));
  if (raw.length !== 32) throw new Error("unexpected Ed25519 public key length");
  const publicKey = `ed25519:${base58Encode(raw)}`;
  if (!extractable) return { publicKey, privateKey: kp.privateKey };
  return { publicKey, pkcs8: toBase64(new Uint8Array(await subtle.exportKey("pkcs8", kp.privateKey))) };
}

/** A signer for a stored record (the fallback's PKCS#8 bytes are imported as non-extractable). */
export async function signerFromRecord(rec: OneTapRecord, subtle: SubtleCrypto): Promise<OneTapSigner> {
  if (base58Decode(rec.publicKey.replace(/^ed25519:/, "")).length !== 32) throw new Error("bad one-tap public key");
  const key = rec.privateKey ?? (rec.pkcs8 ? await subtle.importKey("pkcs8", fromBase64(rec.pkcs8) as BufferSource, ED25519, false, ["sign"]) : null);
  if (!key) throw new Error("the one-tap private key is missing");
  return {
    publicKey: rec.publicKey,
    sign: async (message) => new Uint8Array(await subtle.sign(ED25519, key, message as BufferSource)),
  };
}

export function newRecord(input: { network: string; accountId: string; key: NewOneTapKey; storage: KeyStorageKind; methodNames: readonly string[]; allowanceYocto: string; now: number }): OneTapRecord {
  return {
    v: 1,
    network: input.network,
    accountId: input.accountId,
    contractId: CONTRACT_ID,
    publicKey: input.key.publicKey,
    methodNames: [...input.methodNames],
    allowanceYocto: input.allowanceYocto,
    createdAt: input.now,
    storage: input.storage,
    ...(input.key.privateKey ? { privateKey: input.key.privateKey } : {}),
    ...(input.key.pkcs8 ? { pkcs8: input.key.pkcs8 } : {}),
  };
}

/**
 * Where one-tap keys live in this browser, in order. The first entry is where a new key is saved:
 * IndexedDB when it can store and return a `CryptoKey` (probed once per page load), else
 * localStorage. Every entry is searched when a key is loaded, so a key saved in the other store on
 * an earlier visit (say IndexedDB failed once) is still found and never silently replaced. An
 * IndexedDB that failed the probe stays in the list as a lookup-only last entry. Empty = nowhere.
 */
export async function pickOneTapStores(env: { indexedDB?: IDBFactory | null; localStorage?: StorageLike | null; subtle: SubtleCrypto }): Promise<OneTapStore[]> {
  let idb: OneTapStore | null = null;
  let idbWorks = false;
  if (env.indexedDB) {
    try {
      idb = indexedDbStore(env.indexedDB);
      const kp = (await env.subtle.generateKey(ED25519, false, ["sign", "verify"])) as CryptoKeyPair;
      const probe = "__probe__";
      await idb.put(probe, { v: 1, network: "probe", accountId: probe, contractId: CONTRACT_ID, publicKey: "probe", methodNames: [], allowanceYocto: "0", createdAt: 0, storage: "indexeddb", privateKey: kp.privateKey });
      const back = await idb.get(probe);
      await idb.remove(probe);
      idbWorks = Boolean(back?.privateKey);
    } catch {
      idbWorks = false;
    }
  }
  let ls: OneTapStore | null = null;
  if (env.localStorage) {
    try {
      env.localStorage.getItem(ONE_TAP_LOCAL_KEY);
      ls = webStorageStore(env.localStorage);
    } catch {
      ls = null;
    }
  }
  const out: OneTapStore[] = [];
  if (idb && idbWorks) out.push(idb);
  if (ls) out.push(ls);
  if (idb && !idbWorks && out.length > 0) out.push(idb);
  return out;
}

/** Settings → Reset local data: removes every one-tap key from this browser (not from the account on chain). */
export async function wipeOneTapDevice(env: { indexedDB?: IDBFactory | null; localStorage?: StorageLike | null; stores?: readonly OneTapStore[] }): Promise<void> {
  try {
    env.localStorage?.removeItem(ONE_TAP_LOCAL_KEY);
  } catch {
    /* ignore */
  }
  // Close this page's own connection first; `onversionchange` closes any other one.
  for (const s of env.stores ?? []) s.close?.();
  if (!env.indexedDB) return;
  await new Promise<void>((resolve) => {
    try {
      const req = env.indexedDB!.deleteDatabase(ONE_TAP_DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
