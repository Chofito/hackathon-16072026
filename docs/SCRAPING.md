# Estrategia de scraping y matching

> El colector debe ser lo opuesto a un ataque: lento, identificable y respetuoso. El autor configuró las defensas anti-bot de una de las tiendas trackeadas — este documento asume que las tiendas pueden y saben bloquear scrapers agresivos.

## 1. Tácticas de colección (en orden de preferencia)

1. **JSON-LD (`schema.org/Product`)** — la fuente primaria. Magento y la mayoría de plataformas ecommerce serias lo exponen en cada página de producto (nombre, precio, SKU, disponibilidad, a veces GTIN). Es 10x más robusto que CSS selectors ante redeploys del frontend: el JSON-LD es un contrato con Google, cambia mucho menos que el HTML.
2. `**sitemap.xml**` — la fuente del universo de URLs de producto. Evita crawlear la navegación (menos requests, menos fragilidad). Se lee una vez por ciclo para descubrir productos nuevos y detectar delistados.
3. **Feeds de Google Shopping / Merchant Center** — si se consigue acceso o alianza con la tienda: datos estructurados sin scraping. Ideal a futuro, no bloqueante.
4. **HTML + CSS selectors** — último recurso, solo para tiendas sin JSON-LD. Aislar los selectores en un módulo por tienda para que el mantenimiento no contamine el resto.

## 2. Esquema objetivo de captura

Contrato de salida de todo scraper, independiente de la táctica (JSON-LD, API o HTML). Cada página de producto capturada produce una captura cruda; el normalizador (`@pgt/ingest`) la resuelve contra `store_products` y la inserta en `price_points` (ver [DATA_MODEL.md](DATA_MODEL.md)). En el código, el tipo canónico es **`RawCapture` en `@pgt/core`** (`packages/core/src/types.ts`); la versión conceptual de abajo agrega `storeSlug`/`brand`/`source` que en el código se derivan del contexto del scraper.

```typescript
interface ProductCapture {  // en código: RawCapture (@pgt/core)
  // Identidad en la tienda
  storeSlug: string;          // "max" | "kemik" | "pacifiko" | "curacao" | "amazon"
  url: string;                // URL canónica de la página de producto
  storeSku: string;           // SKU interno de la tienda (JSON-LD `sku`, o ASIN en Amazon)
  rawName: string;            // nombre tal como lo publica la tienda, sin normalizar

  // Claves de matching (best-effort)
  eanGtin: string | null;     // JSON-LD `gtin13`/`gtin`/`ean`; null si no se expone
  brand: string | null;       // JSON-LD `brand.name`

  // Precio
  price: number;              // precio de venta real (offers.price)
  listPrice: number | null;   // precio tachado "antes"; null si no hay descuento
  conditionalPrice: number | null;      // precio con condición (banco, cupón)
  conditionalPriceNote: string | null;  // ej. "pagando con BAC"
  currency: string;           // "GTQ" (tiendas locales) o "USD" (Amazon); validar contra offers.priceCurrency

  // Disponibilidad
  stockStatus: "in_stock" | "out_of_stock" | "unknown";  // de offers.availability

  // Trazabilidad
  capturedAt: string;         // ISO-8601, momento del fetch
  source: "jsonld" | "api" | "html";    // qué táctica produjo la captura
}
```

Reglas del contrato:

- Campos de identidad y `price` son obligatorios: si no se pueden extraer, la captura **falla** (no se emite un `ProductCapture` a medias).
- El scraper no normaliza ni matchea — emite datos crudos. La única transformación permitida es parsear (string → number, availability URI → enum).
- Mapeo JSON-LD → captura: `name` → `rawName`, `sku` → `storeSku`, `gtin13` → `eanGtin`, `offers.price` → `price`, `offers.priceCurrency` → `currency`, `offers.availability` (`https://schema.org/InStock`) → `stockStatus`.
- `eanGtin` y `storeSku` no siempre están en el JSON-LD: en Curacao el GTIN vive en la tabla de especificaciones del HTML (`data-th="GTIN"`) y el SKU en `data-product-sku`. El módulo por tienda decide de dónde sale cada campo; el contrato de salida es el mismo.

## 3. Política de cortesía


| Regla               | Valor                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| Frecuencia de ciclo | cada 6–12 horas                                                                                         |
| Rate limit          | 1 request cada 2–5 segundos por tienda; jamás en paralelo contra la misma tienda                        |
| User-agent          | identificable, con URL del proyecto y contacto (ej. `PreciosGT-Bot/0.1 (+https://... ; contacto@...)`)  |
| robots.txt          | se respeta siempre, incluyendo `Crawl-delay`                                                            |
| Caching             | condicionales `ETag`/`Last-Modified` cuando la tienda los soporte; no re-descargar sitemaps sin cambios |
| Alcance             | solo URLs de producto del nicho (~300 SKUs); no crawl exploratorio                                      |


## 4. Reconocimiento técnico por tienda

Recon ejecutado el 2026-07-16 con requests puntuales y user-agent identificable (sin evadir nada). Preguntas guía por tienda:

- ¿Expone JSON-LD `schema.org/Product` en páginas de producto? ¿Incluye GTIN/EAN?
- ¿Tiene `sitemap.xml` con URLs de producto? ¿Segmentado por categoría?
- ¿Qué dice `robots.txt`? ¿Crawl-delay? ¿Rutas prohibidas?
- ¿Plataforma? (Magento, VTEX, Shopify, custom) — define qué esperar del markup.
- ¿Protección Cloudflare u otro WAF? ¿Challenge en requests sin JS?

### Resumen


| Tienda       | URL                          | Dato estructurado                           | GTIN                                           | SKU/MPN             | Disponibilidad                                       | sitemap                                                          | Plataforma                                                             | WAF/CDN                                                                                                          | Táctica                                          |
| ------------ | ---------------------------- | ------------------------------------------- | ---------------------------------------------- | ------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Pacifiko** | pacifiko.com                 | JSON-LD `Product` ✅                         | ❌                                              | `mpn` ✅             | `offers.availability` ✅                              | índice → 98 `pids-N.xml` de producto                             | OpenCart (Apache)                                                      | CloudFront, sin challenge                                                                                        | **JSON-LD**                                      |
| **Curacao**  | lacuracaonline.com/guatemala | JSON-LD `Product` ✅                         | ✅ **en tabla HTML** (`data-th="GTIN"`, EAN-13) | `sku` en HTML ✅     | `offers.availability` ✅ + `priceValidUntil`          | índice GT dedicado → `sitemap_lco_gt_products.xml` (~2,213 URLs) | Magento 2 (multistore por país, store id 3)                            | Fastly, sin challenge                                                                                            | **JSON-LD + tabla HTML**                         |
| **MAX**      | max.com.gt                   | JSON-LD `Product` parcial ⚠️                | ✅ **en `__NEXT_DATA__`** (`eanCode`, EAN-13)   | `sku` ✅             | ausente en JSON-LD ⚠️ (`salableQuantity` en `__NEXT_DATA__`) | índice → `sitemap-0.xml` + 14 por categoría                      | Next.js headless sobre Magento (`backoffice.max.com.gt/media/catalog`) | **Cloudflare + CloudFront**                                                                                      | **`__NEXT_DATA__`** (producto completo) + JSON-LD fallback |
| **Kemik**    | kemik.gt                     | Sin JSON-LD; microdata `schema.org/Offer` ✅ | ❌                                              | `sku` (microdata) ✅ | OG `product:availability` ✅ (`instock`/`outofstock`) | índice → 8 `sitemap-product.xml?page=N` (~60–78k URLs)           | Next.js (App Router, custom)                                           | ingress propio + contador `anonymous_request_count` (ventana 300 s); `robots.txt` bloquea muchos bots por nombre | **HTML/microdata + OG**                          |


### Hallazgos transversales

- **GTIN/EAN: Curacao y MAX lo exponen** — Curacao en la tabla de especificaciones del HTML (`data-th="GTIN"`, EAN-13) y MAX como `eanCode` dentro del `__NEXT_DATA__` (hallazgo de la implementación, 2026-07-16). Kemik y Pacifiko no publican GTIN en ningún lado. Consecuencia: la capa 1 de matching (EAN exacto, §7) funciona para 2 de 4 tiendas y sirve para *sembrar* `products.ean_gtin`; el resto arranca en normalización marca+modelo + revisión manual. Todas dan identificadores por tienda (`sku`/`mpn`) útiles como `store_sku`.
- **3 de 4 dan el precio server-side** sin ejecutar JS (JSON-LD o microdata en el HTML crudo). Confirma la tesis del doc: `fetch` + parse basta, no se necesita browser.
- **Todas tienen sitemap de producto segmentado** → descubrimiento de URLs barato, sin crawl de navegación.
- `**robots.txt` de MAX** permite `/` al genérico `*` pero prohíbe `/marcas/` y rutas de búsqueda; las páginas de producto (slug en raíz) están permitidas. **Kemik** no pone `Crawl-delay` al `*` pero lista y bloquea explícitamente decenas de bots conocidos (Scrapy, CCBot, PerplexityBot, Devin, AhrefsBot…) — un colector debe ser identificable y conservador aquí. **Curacao** define `Crawl-delay` 1–5 para bots nombrados; usar ≥5 s por cortesía. **Pacifiko** solo prohíbe `/index.php`.

### Notas por tienda

- **Pacifiko (más fácil):** JSON-LD limpio con `price`, `priceCurrency: GTQ`, `availability`, `mpn`, `brand`. URLs de producto llevan `&pid=<hash>` — conservar la URL completa. Cookie fija `currency=GTQ`. Empezar por aquí.
- **Curacao (la mejor fuente):** JSON-LD limpio con `offers.price` (precio actual), `availability`, `priceValidUntil`, `seller: "LCO Guatemala Store"`, más un `price` de nivel raíz que es el precio de lista (ej. `4199` tachado vs `2797` de venta) → mapea a `listPrice`. Storefront Guatemala en GTQ, SSR, sitemap propio (`_gt_`, ~2,213 URLs con `lastmod` diario → crawl incremental). Las URLs de producto terminan en `/p` (`/guatemala/<slug>-<sku>/p`) — es el filtro para separar producto de categoría en el sitemap. `sku` (`data-product-sku`), `productId` y el **GTIN (EAN-13)** viven en el HTML fuera del JSON-LD; capturarlos aparte (`store_sku` y `eanGtin`).
- **MAX (más fricción — el autor configuró su WAF):** frontend Next.js headless servido tras Cloudflare + CloudFront. El JSON-LD trae `price`, `priceCurrency`, `sku`, `brand` pero **no** `availability`. El `__NEXT_DATA__` del SSR resultó ser la mejor fuente: `props.pageProps.product` trae `sku`, `title`, `brand`, `salableQuantity` (stock), `cachedPrices.salesPrice`/`regularPrice` (precio + lista) **y `eanCode` (EAN-13)**. El scraper lo usa como fuente primaria con JSON-LD de fallback. Con user-agent identificable respondió 200 sin challenge, pero es la tienda de mayor riesgo de bloqueo: máxima cortesía y fallo ruidoso ante 403/503.
- **Kemik (sin JSON-LD):** Next.js App Router, SSR; el precio está como microdata (`itemprop="price"`, `priceCurrency`, `sku`) dentro de un bloque `schema.org/Offer`, con disponibilidad vía OG `product:availability` (`instock`/`outofstock`) y precio también en `og:title`. **Ojo: el `og:title` viene truncado** — el nombre completo sale del `<h1>` (que omite la marca; el scraper antepone `product:brand`). El `listPrice` solo aparece en items con descuento, como texto tachado (`line-through`). Sin API pública. Requiere módulo HTML aislado por tienda. Ojo con el contador `anonymous_request_count` (ventana 300 s) y el `robots.txt` que banea bots por nombre: máxima cortesía, UA identificable, volumen bajo.

Orden de implementación sugerido: **Pacifiko → Curacao → MAX → Kemik** (de mejor dato estructurado y menor fricción, a peor).

### Amazon — precio de referencia (fuente aparte, no tienda local)

Amazon (EE.UU.) se agrega como **punto de precio de referencia**, no como tienda guatemalteca comparable. Para el comprador GT, el precio en Amazon es un ancla útil ("allá cuesta $X") pero **no es directamente comparable**: está en USD y no incluye envío, importación ni impuestos. Se captura y se muestra etiquetado como referencia, nunca mezclado en el mismo ranking que las 4 tiendas locales.

Reglas específicas de Amazon:

- **Solo vía API oficial, nunca scraping HTML.** Amazon tiene exactamente el tipo de WAF/anti-bot que este documento dice no evadir jamás, y el scraping de su HTML viola sus términos. La fuente es el **Amazon Product Advertising API (PA-API 5.0)** (requiere cuenta de afiliado aprobada). Alternativa si no hay acceso a PA-API: un proveedor licenciado de datos (Keepa, Rainforest API). En ningún caso se hace `fetch` a páginas de producto de amazon.com.
- **Matching determinístico como bonus:** PA-API permite buscar por `UPC`/`EAN`/`ISBN` → devuelve `ASIN`. Donde ya tenemos GTIN (hoy: Curacao), el match Amazon↔catálogo es exacto. El `ASIN` se guarda como `store_sku`. Sin GTIN, se cae a búsqueda por marca+modelo → cola de revisión, igual que las demás.
- **Moneda:** las capturas de Amazon van con `currency: "USD"`. El comparador maneja la conversión/etiqueta aparte (ver §8).
- **Cortesía:** no aplica rate limit de scraping; se respetan los límites de cuota de la PA-API (TPS/TPD según ventas del afiliado). Fallo ruidoso ante `429`/errores de cuota, igual que con un challenge.
- **Alcance:** solo se consulta Amazon para SKUs del catálogo canónico que tengan sentido como referencia importable (electrónica/gaming); no se indexa Amazon.

## 5. Herramientas: librerías vs scraping con AI

Evaluación de opciones para implementar el colector (monorepo Bun; ver [ARCHITECTURE.md](ARCHITECTURE.md) y [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)).

> **Dos runtimes, un core portable.** El colector recurrente corre en **Bun** (`apps/collector`, cron/local). El flujo on-demand corre en **Supabase Edge Functions (Deno)** (`supabase/functions/fetch-product`). Para reutilizar la misma lógica en ambos, el parseo/fetch vive en `@pgt/core` **runtime-agnóstico**: solo `fetch`, `URL`, `TextDecoder` y Web Streams estándar, **sin APIs exclusivas de Bun** (`Bun.*`, `bun:sqlite`) ni de Node con bindings nativos. Así el mismo módulo corre en Bun y en Deno sin cambios.

### Opción elegida: fetch + parser ligero


| Pieza         | Herramienta                                                        | Rol                                                                    |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| HTTP          | `fetch` estándar                                                   | GET con user-agent identificable, `ETag`/`Last-Modified` condicionales |
| Sitemaps      | parseo de `<loc>` con regex en `@pgt/core`                         | descubrir URLs de producto sin dependencia (portable Bun/Deno)         |
| JSON-LD       | extracción de `<script type="application/ld+json">` + `JSON.parse` | táctica primaria, ~20 líneas, sin dependencia (`@pgt/core/parsing`)    |
| HTML fallback | `cheerio` (o `deno-dom`)                                          | solo para tiendas sin JSON-LD, selectores aislados por tienda          |
| Validación    | tipos de `@pgt/core` (`RawCapture`)                                | validar la captura antes de persistir                                  |
| Persistencia  | `@pgt/db` (Bun) / `jsr:@supabase/supabase-js@2` (Deno)             | insertar `price_points` / leer catálogo en Supabase                    |


Justificación: con ~300 SKUs, URLs conocidas de antemano (sitemap) y datos en JSON-LD server-side, un scraper es un loop de `fetch` + parse. No hay crawling exploratorio ni JS rendering que justifique más maquinaria. Al mantener el core sin dependencias nativas, el mismo parseo corre en el colector Bun y en la Edge Function Deno.

### Opciones evaluadas y descartadas (por ahora)


| Opción                                               | Qué aporta                                                                                                                                       | Por qué no ahora                                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crawlee** (Apify, TS)                              | Framework completo: colas persistentes, retries, sesiones, fingerprints browser-like, `CheerioCrawler`/`PlaywrightCrawler` con la misma interfaz | Sobredimensionado para 4 tiendas secuenciales con rate limit fijo; además sus fingerprints "human-like" contradicen la política de bot identificable. **Disparador para adoptarlo:** >10 tiendas o necesidad de colas |
| **Playwright / Puppeteer**                           | JS rendering para páginas client-side                                                                                                            | Solo si el recon encuentra una tienda cuyo precio no está en el HTML server-side. Costo: ~100x más lento y pesado por página                                                                                          |
| **Firecrawl / Jina Reader** (API gestionada, LLM)    | URL → JSON estructurado vía schema, sin escribir parsers                                                                                         | Costo por página (~5 créditos/página en modo JSON) × 300 SKUs × 4 tiendas × 2-4 ciclos/día no escala; dependencia externa para el corazón del sistema; el JSON-LD ya da el dato estructurado gratis                   |
| **Extracción con LLM propio** (HTML → prompt → JSON) | Resiliente a cambios de markup, sin selectores                                                                                                   | No determinístico: riesgo de precios alucinados, y "un match incorrecto es peor que un match faltante" aplica también a capturas. Latencia y costo por captura                                                        |
| **Crawl4AI / ScrapeGraphAI** (Python, self-hosted)   | Pipeline LLM open source                                                                                                                         | Stack Python paralelo al de TS; mismo problema de no-determinismo                                                                                                                                                     |


### Dónde sí usar AI

AI no toca el camino crítico de captura, pero sirve en las orillas:

1. **Matching asistido** (fase posterior, ya previsto en §7): embeddings/LLM para *sugerir* matches en `match_review_queue` — sugiere, no decide.
2. **Bootstrapping de selectores:** cuando una tienda requiera HTML scraping, usar un LLM en desarrollo (no en runtime) para proponer los CSS selectors a partir de una muestra de HTML.
3. **Diagnóstico de fallos:** cuando un scraper falla ruidosamente con muestra de HTML, un LLM puede clasificar la causa (challenge, redeploy, delistado) en el reporte del ciclo.

## 6. Modelo de ejecución

La lógica de captura vive en `@pgt/core` (portable) y `@pgt/scrapers` (módulo por tienda), y se ejecuta desde **dos runtimes** sobre la misma interfaz `Scraper` (ver `packages/scrapers/src/types.ts`):

```typescript
interface Scraper {
  readonly key: string  // "max" | "kemik" | "pacifiko" | "curacao"

  // Modo batch (colector Bun): ciclo completo sitemap → JSON-LD → capturas
  scrape(ctx: ScrapeContext): Promise<ScrapeResult>

  // Modo on-demand (Edge Function Deno): un solo producto por URL/SKU
  fetchOne(input: FetchOneInput, ctx: ScrapeContext): Promise<RawCapture | null>
}
```

### 6.1 Modo programado (batch) — el histórico

Es el camino que alimenta el dataset; corre en el **colector Bun** (`apps/collector`), simple, sin colas ni workers:

1. **Cron** (GitHub Actions, `.github/workflows/collect.yml`) o corrida local dispara `apps/collector` cada 6–12 h.
2. El colector corre los 4 scrapers **secuencialmente** vía `@pgt/scrapers` (registry, módulos independientes).
3. Cada scraper: lee sitemap → filtra URLs de SKUs trackeados → `fetch` con rate limit → parsea JSON-LD/HTML (`@pgt/core`) → produce `RawCapture[]`.
4. `@pgt/ingest` resuelve capturas contra `store_products` e inserta `price_points` en Supabase (`@pgt/db`).
5. Resumen del ciclo (capturados/fallidos por tienda) se loggea y, si hay fallos, se alerta al operador.

Con ~300 SKUs × 4 tiendas y 1 request cada 2–5 s, un ciclo completo toma bastante menos de 2 horas — cabe de sobra en la ventana del cron. El colector Bun no tiene el wall-clock acotado de una Edge Function, así que puede correr el barrido completo en un solo proceso. Si algún día no cabe, ese es el disparador para colas/workers (ver [ARCHITECTURE.md](ARCHITECTURE.md), sección de migración).

El **colector de referencia de Amazon** corre como un paso análogo pero **por API (PA-API), no scraping**: recorre los SKUs del catálogo con GTIN/ASIN conocido, consulta la API y produce `ProductCapture` en USD (`source: "api"`). Puede correr en su propia cadencia (no necesita alinear con la ventana de las tiendas locales). Ver §4, "Amazon — precio de referencia".

### 6.2 Modo on-demand — búsqueda iniciada por el usuario

Un usuario puede querer un producto que **no está** en el catálogo curado. Ese flujo interactivo vive en la **Edge Function `fetch-product` (Deno)** (ver [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)), pegada a la DB y auth de Supabase:

1. El usuario envía `{ url | sku, storeName }` (con auth) desde el web client → invoca `fetch-product`.
2. La función hace un **fetch síncrono de una** tienda vía `fetchOne` (reutiliza el parseo de `@pgt/core`), obtiene el precio actual y hace `upsert` de `store_products` + primer `price_point` + la `subscription`.
3. **Encola** el resto de tiendas en `product_requests` (status `pending`); el colector Bun las completa después. **No** se dispara un crawl síncrono de las 4 tiendas (lento + riesgo de challenge).
4. Responde el precio actual de inmediato. Si el producto no matchea el catálogo canónico, cae en `match_review_queue` — nunca se inserta un match adivinado (§7).

Diferencias con el batch, no excepciones a las reglas:

- **Cortesía igual:** mismo rate limit y user-agent identificable. Un fetch on-demand es **1 request a 1 tienda** → aceptable; el resto se encola en vez de barrer en vivo.
- **Latencia sincrónica:** el usuario espera, así que es 1 tienda; el resultado se devuelve directo además de persistirse.
- **Mismo core:** `fetchOne` usa el mismo parseo JSON-LD de `@pgt/core` que el batch; solo cambia el runtime (Deno) y el disparador (el usuario).

### 6.3 Ejecución local (desde mi computadora)

Todo corre localmente sin desplegar, con el monorepo Bun + Supabase CLI:

- **Colector batch (Bun):** `bun run collect` (alias de `bun run --filter @pgt/collector start`) corre el ciclo completo contra la DB local.
- **Supabase local:** `bun run db:start` levanta Postgres/Supabase; `bun run db:reset` aplica migraciones + seed.
- **Edge Function on-demand (Deno):** `bun run fn:serve` (`supabase functions serve fetch-product --no-verify-jwt`) la corre en el runtime Deno local; se prueba con `curl` al endpoint local.
- **POC de matching:** `bun run poc/find-matches.ts <url>` (ver [../poc/README.md](../poc/README.md)) para validar extracción + matching cross-store sin tocar la DB.
- Credenciales vía `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); nunca hardcodeadas. Ver `.env.example`.

## 7. Product matching (el moat técnico)

Saber que "Consola Nintendo Switch 2" en Kemik y "NINTENDO SWITCH 2 NSW2-001" en MAX son el mismo producto. Estrategia por capas, de más barata a más cara:

1. **EAN/GTIN exacto** — si el JSON-LD lo trae, el matching es determinístico. Prioridad del recon: identificar qué tiendas lo exponen. Amazon encaja aquí vía PA-API (`UPC`/`EAN` → `ASIN`): donde hay GTIN, el match con la referencia es exacto.
2. **Normalización marca + modelo** — limpiar el `raw_name` (mayúsculas, sufijos de SKU, palabras de relleno) y comparar contra `products.brand` + `products.model`.
3. **Cola de revisión manual** — todo lo que no matchee con confianza cae en `match_review_queue`. Con ~300 SKUs curados a mano, el volumen inicial de revisión es manejable.
4. **Fuzzy/embeddings** — no se implementa hasta que la revisión manual duela. Cuando llegue, su salida sigue pasando por la cola de revisión (sugiere, no decide).

Regla general: **un match incorrecto es peor que un match faltante** — corrompe el histórico comparativo, que es el producto. En duda, a la cola.

### Variantes

Color/almacenamiento/edición rompen el matching 1:1. Se modelan con `product_variants` (ver [DATA_MODEL.md](DATA_MODEL.md)): el `store_product` apunta al producto canónico base y la variante se registra aparte. La curación manual decide cuándo una variante amerita producto propio (ej. 256GB vs 512GB en celulares, donde el precio difiere sustancialmente).

## 8. Casos especiales de precio

- `**price` vs `list_price`:** el precio tachado "antes Q5,999" va en `list_price`; el precio real de venta en `price`. Nunca mezclarlos.
- **Precio condicionado** (descuento de banco, cupón): va en `conditional_price` + `conditional_price_note`, nunca en `price`. El comparador público muestra el precio incondicional.
- **Sin stock ≠ no capturado:** producto listado sin stock → fila con `stock_status = out_of_stock`. Producto que no se pudo capturar → **sin fila** ese ciclo.
- **Precios inflados pre-temporada** (Black Friday): no requieren manejo especial en captura — el histórico es justamente lo que los expone. Feature futura: "detector de ofertas falsas".
- **Precio de referencia (Amazon, USD):** se guarda tal cual en USD (`currency = "USD"`), nunca convertido en captura. El comparador lo muestra en una sección aparte y, si convierte a GTQ, es con un tipo de cambio explícito y una nota de que no incluye envío/importación/impuestos. No entra al ranking de "precio más barato" entre tiendas locales.

## 9. Modos de falla y detección


| Falla                               | Detección                                                  | Respuesta                                                                                   |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Challenge de Cloudflare / WAF       | Respuesta 403/503 o HTML de challenge en lugar de producto | Abortar la tienda en ese ciclo, alertar al operador. **Nunca** intentar evadir el challenge |
| Cambio de plataforma / redeploy     | JSON-LD ausente o schema inesperado                        | Fallar ruidosamente con muestra del HTML recibido para diagnóstico                          |
| Producto delistado                  | URL desaparece del sitemap o 404                           | Marcar `store_products.active = false`, conservar histórico                                 |
| Timeout / errores de red            | Excepción del fetch                                        | Reintento único con backoff; si persiste, contar como fallo del ciclo                       |
| Datos absurdos (precio 0, negativo) | Validación pre-insert                                      | Descartar la captura, loggear para revisión                                                 |


Principio: **fallar ruidosamente, nunca silenciosamente**. Un ciclo sin datos de una tienda debe ser visible al operador el mismo día — cada ciclo perdido es histórico que no existirá.