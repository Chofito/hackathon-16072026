import { createAnonClient, type Db } from '@guateofertas/db'

// Cliente creado de forma perezosa (una vez por proceso, no en el import top
// level) para que `next build` no falle si las env vars de Supabase todavia
// no existen — solo se exige su presencia cuando una request real las usa.
let cached: Db | null = null

export function getSupabase(): Db {
  if (!cached) {
    cached = createAnonClient({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })
  }
  return cached
}
