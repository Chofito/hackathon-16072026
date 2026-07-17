# Edge Functions de Supabase para el scraper (on-demand)

> Documentación a grandes rasgos del uso de Supabase Edge Functions para el flujo on-demand disparado por el usuario. Complementa [ARCHITECTURE.md](ARCHITECTURE.md) y [SCRAPING.md](SCRAPING.md). El flujo de usuario completo (caminos, estados de UI, diagramas de secuencia) vive en [USER_FLOW.md](USER_FLOW.md) — este documento se enfoca en la Edge Function en sí. Template en `supabase/functions/fetch-product/`.

## Por qué

El colector recurrente (cron/local) construye el histórico. Pero además queremos que un usuario **busque o ingrese un SKU/URL** y obtenga el **precio actual al instante** + empiece a trackearlo. Ese flujo interactivo vive en una **Supabase Edge Function** (`fetch-product`): serverless, pegada a la DB y a la auth de Supabase, invocable directo desde el web client.

## Flujo

```mermaid
flowchart LR
    user["Usuario (web)"] -->|"SKU / URL / búsqueda"| fn["Edge Function fetch-product"]
    fn -->|"fetch síncrono 1 tienda"| store["Ecommerce (JSON-LD)"]
    fn -->|"upsert store_product + price_point + subscription"| db[("Supabase")]
    fn -->|"encola resto de tiendas"| reqs[("product_requests")]
    fn -->|"precio actual"| user
    collector["Collector (cron/local)"] -->|"lee pendientes"| reqs
    collector -->|"scrape + ingest → histórico"| db
```

1. El usuario envía `{ url | sku, storeName }`. **No requiere login** — anónimos pueden invocarla, sujeto a rate limit (ver "Acceso anónimo y rate limit" abajo).
2. La function hace un **fetch síncrono de una** tienda/URL, parsea el JSON-LD y obtiene el precio actual.
3. Hace `upsert` de `store_products` e inserta el primer `price_point`. Crea la `subscription` **solo si la request viene con un usuario autenticado** (JWT de Supabase Auth) — un anónimo no puede suscribirse a alertas.
4. **Encola** el resto de tiendas en `product_requests` (status `pending`) para que el collector complete el matching y siga el tracking. `requested_by` queda `null` si la request es anónima.
5. Responde el precio actual de inmediato.

## Acceso anónimo y rate limit

- **Disparar el fetch on-demand no requiere autenticación.** Es la vía de entrada para un visitante que pega un link por primera vez (ver [USER_FLOW.md](USER_FLOW.md), camino 2). La function debe seguir aceptando requests sin JWT.
- **Debe aplicar rate limit a requests anónimas** (por IP o por sesión/fingerprint del cliente — la implementación concreta queda a criterio del dev-edge) antes de hacer el fetch a la tienda. El fetch a la tienda cuesta cortesía real: sin rate limit, un anónimo podría convertir el endpoint en un proxy de scraping barato.
- **Crear una `subscription` sí requiere login.** Si la request no trae JWT válido, la function completa los pasos 2–4 (precio + cola) pero **omite** el insert de `subscription`. No es un error — es un comportamiento esperado para anónimos.
- Usuarios autenticados pueden tener un rate limit más permisivo que los anónimos (o ninguno), a discreción del dev-edge.

## Puntos clave

- **Runtime Deno, no Bun.** Las Edge Functions corren en Deno. Por eso la lógica de fetch/parseo se mantiene **runtime-agnóstica** en `@guateofertas/core` (`fetch` estándar, sin `Bun.*`) y se importa por ruta relativa (`../../../packages/core/src/parsing.ts`). supabase-js se importa vía `jsr:@supabase/supabase-js@2`.
- **El histórico no se retro-genera.** Para un SKU nuevo el histórico arranca desde ahora; para productos ya en el dataset se muestra el histórico existente. La UX debe dejarlo claro.
- **Cortesía / anti-bot.** Un fetch on-demand de **un** producto es 1 request → aceptable. NO permitir que el usuario dispare un crawl síncrono de las 4 tiendas (lento + riesgo de challenge de Cloudflare); por eso el resto se **encola**.
- **Fallar ruidosamente.** Ante challenge o markup inesperado, responder error y nunca insertar datos corruptos ni intentar evadir el WAF.

## Cómo correr / desplegar

```sh
bun run fn:serve    # local: supabase functions serve fetch-product --no-verify-jwt
bun run fn:deploy   # deploy a Supabase
```

## Estado

Template con `TODO(dev-edge)`: falta resolver la tienda, el fetch cortés real, el rate limit para requests anónimas, el `upsert` + `insert` + `subscription` (condicionada a auth) y el encolado en `product_requests`.
