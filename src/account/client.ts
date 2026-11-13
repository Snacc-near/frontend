/**
 * The Supabase client (UI-148). This module is the only one that imports `@supabase/supabase-js`,
 * and it is only ever loaded through `import()` (see `loadClient` in `session.tsx`), so the landing
 * page and the first paint of `/app` never download it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SESSION_STORAGE_KEY, type SupabaseConfig } from "./config.ts";

let cached: { key: string; client: SupabaseClient } | null = null;

export function getClient(cfg: SupabaseConfig): SupabaseClient {
  const id = `${cfg.url}|${cfg.key}`;
  if (cached?.key === id) return cached.client;
  const client = createClient(cfg.url, cfg.key, {
    auth: {
      storageKey: SESSION_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  cached = { key: id, client };
  return client;
}

export type { SupabaseClient };
