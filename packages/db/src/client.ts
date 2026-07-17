import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

export type Db = SupabaseClient<Database>

interface ClientEnv {
  url?: string
  key?: string
}

/**
 * Cliente con service role — bypassa RLS. Solo para el collector y las
 * edge functions del lado servidor. NUNCA exponerlo al browser.
 */
export function createServiceClient(env: ClientEnv = {}): Db {
  const url = env.url ?? process.env.SUPABASE_URL
  const key = env.key ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cliente service role',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Cliente anon — respeta RLS. Seguro para lecturas publicas / SSR (Next.js). */
export function createAnonClient(env: ClientEnv = {}): Db {
  const url =
    env.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key =
    env.key ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (o SUPABASE_URL / SUPABASE_ANON_KEY)',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
