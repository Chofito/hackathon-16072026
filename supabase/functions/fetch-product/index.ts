// TEMPLATE — Edge Function on-demand (Deno). NO es implementacion final.
// Flujo (docs/ARCHITECTURE.md, on-demand):
//   1. Usuario envia { url | sku, storeName } (con auth de Supabase).
//   2. Fetch SINCRONO de 1 tienda/URL -> parsea JSON-LD -> precio actual.
//   3. Upsert store_product + primer price_point + subscription.
//   4. Encola el resto de tiendas en product_requests para que el collector complete.
//   5. Responde el precio actual al instante.
//
// Reutiliza la logica PORTABLE de @guateofertas/core por import relativo (Deno importa TS local).
// Correr local: `bun run fn:serve`  |  Deploy: `bun run fn:deploy`

// @ts-nocheck — este archivo corre en Deno, no en el typecheck de Bun del monorepo.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  parseProductFromHtml,
} from '../../../packages/core/src/parsing.ts'
// import { matchCapture } from '../../../packages/core/src/matching.ts'

interface FetchProductBody {
  url?: string
  sku?: string
  storeName?: string
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const body = (await req.json()) as FetchProductBody
  if (!body.url && !body.sku) {
    return Response.json({ error: 'Se requiere url o sku' }, { status: 400 })
  }

  try {
    // TODO(dev-edge): resolver la tienda (storeName -> stores.id).
    // TODO(dev-edge): fetch cortes de body.url con user-agent identificable.
    //   const html = await fetch(body.url, { headers: { 'user-agent': UA } }).then(r => r.text())
    //   const parsed = parseProductFromHtml(html)
    const parsed = body.url ? parseProductFromHtml('') : null

    // TODO(dev-edge): upsert store_product + insert price_point + subscription (del usuario auth).
    // TODO(dev-edge): encolar el resto de tiendas en product_requests (status 'pending').

    void supabase
    void parseProductFromHtml

    return Response.json({
      ok: true,
      template: true,
      parsed,
      note: 'Edge Function template — implementar fetch + upsert + enqueue.',
    })
  } catch (err) {
    // Fallar ruidosamente: nunca insertar datos corruptos ni evadir challenges.
    return Response.json({ error: String(err) }, { status: 502 })
  }
})
