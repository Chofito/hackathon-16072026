# Estrategia de scraping y matching

> El colector debe ser lo opuesto a un ataque: lento, identificable y respetuoso. El autor configuró las defensas anti-bot de una de las tiendas trackeadas — este documento asume que las tiendas pueden y saben bloquear scrapers agresivos.

## 1. Tácticas de colección (en orden de preferencia)

1. **JSON-LD (`schema.org/Product`)** — la fuente primaria. Magento y la mayoría de plataformas ecommerce serias lo exponen en cada página de producto (nombre, precio, SKU, disponibilidad, a veces GTIN). Es 10x más robusto que CSS selectors ante redeploys del frontend: el JSON-LD es un contrato con Google, cambia mucho menos que el HTML.
2. **`sitemap.xml`** — la fuente del universo de URLs de producto. Evita crawlear la navegación (menos requests, menos fragilidad). Se lee una vez por ciclo para descubrir productos nuevos y detectar delistados.
3. **Feeds de Google Shopping / Merchant Center** — si se consigue acceso o alianza con la tienda: datos estructurados sin scraping. Ideal a futuro, no bloqueante.
4. **HTML + CSS selectors** — último recurso, solo para tiendas sin JSON-LD. Aislar los selectores en un módulo por tienda para que el mantenimiento no contamine el resto.

## 2. Política de cortesía

| Regla | Valor |
|---|---|
| Frecuencia de ciclo | cada 6–12 horas |
| Rate limit | 1 request cada 2–5 segundos por tienda; jamás en paralelo contra la misma tienda |
| User-agent | identificable, con URL del proyecto y contacto (ej. `PreciosGT-Bot/0.1 (+https://... ; contacto@...)`) |
| robots.txt | se respeta siempre, incluyendo `Crawl-delay` |
| Caching | condicionales `ETag`/`Last-Modified` cuando la tienda los soporte; no re-descargar sitemaps sin cambios |
| Alcance | solo URLs de producto del nicho (~300 SKUs); no crawl exploratorio |

## 3. Reconocimiento técnico por tienda

Checklist a completar en una tarde, antes de escribir el primer scraper. Qué verificar en cada tienda:

- ¿Expone JSON-LD `schema.org/Product` en páginas de producto? ¿Incluye GTIN/EAN?
- ¿Tiene `sitemap.xml` con URLs de producto? ¿Segmentado por categoría?
- ¿Qué dice `robots.txt`? ¿Crawl-delay? ¿Rutas prohibidas?
- ¿Plataforma? (Magento, VTEX, Shopify, custom) — define qué esperar del markup.
- ¿Protección Cloudflare u otro WAF? ¿Challenge en requests sin JS?
- ¿Feed de Merchant Center accesible públicamente?

| Tienda | URL | JSON-LD | GTIN en JSON-LD | sitemap.xml | robots.txt | Plataforma | WAF/Challenge | Notas |
|---|---|---|---|---|---|---|---|---|
| MAX | max.com.gt | | | | | | | El autor conoce la configuración WAF |
| Kemik | kemik.gt | | | | | | | |
| Pacifiko | pacifiko.com | | | | | | | |
| Curacao | lacuracaonline.com/guatemala | | | | | | | |

El resultado del recon define el orden de implementación: se empieza por la tienda con mejores datos estructurados y menor fricción.

## 4. Modelo de ejecución

Simple a propósito — sin colas, sin workers:

1. Cron (GitHub Actions o Vercel Cron) dispara un job único cada 6–12 h.
2. El job corre los 4 scrapers **secuencialmente** (uno por tienda, módulos independientes con interfaz común).
3. Cada scraper: lee sitemap → filtra URLs de SKUs trackeados → fetch con rate limit → parsea JSON-LD → produce capturas.
4. El normalizador resuelve capturas contra `store_products` e inserta `price_points` en Supabase.
5. Resumen del ciclo (capturados/fallidos por tienda) se loggea y, si hay fallos, se alerta al operador.

Con ~300 SKUs × 4 tiendas y 1 request cada 2–5 s, un ciclo completo toma menos de 2 horas — cabe de sobra en la ventana del cron. Si algún día no cabe, ese es el disparador para colas/workers (ver [ARCHITECTURE.md](ARCHITECTURE.md), sección de migración).

## 5. Product matching (el moat técnico)

Saber que "Consola Nintendo Switch 2" en Kemik y "NINTENDO SWITCH 2 NSW2-001" en MAX son el mismo producto. Estrategia por capas, de más barata a más cara:

1. **EAN/GTIN exacto** — si el JSON-LD lo trae, el matching es determinístico. Prioridad del recon: identificar qué tiendas lo exponen.
2. **Normalización marca + modelo** — limpiar el `raw_name` (mayúsculas, sufijos de SKU, palabras de relleno) y comparar contra `products.brand` + `products.model`.
3. **Cola de revisión manual** — todo lo que no matchee con confianza cae en `match_review_queue`. Con ~300 SKUs curados a mano, el volumen inicial de revisión es manejable.
4. **Fuzzy/embeddings** — no se implementa hasta que la revisión manual duela. Cuando llegue, su salida sigue pasando por la cola de revisión (sugiere, no decide).

Regla general: **un match incorrecto es peor que un match faltante** — corrompe el histórico comparativo, que es el producto. En duda, a la cola.

### Variantes

Color/almacenamiento/edición rompen el matching 1:1. Se modelan con `product_variants` (ver [DATA_MODEL.md](DATA_MODEL.md)): el `store_product` apunta al producto canónico base y la variante se registra aparte. La curación manual decide cuándo una variante amerita producto propio (ej. 256GB vs 512GB en celulares, donde el precio difiere sustancialmente).

## 6. Casos especiales de precio

- **`price` vs `list_price`:** el precio tachado "antes Q5,999" va en `list_price`; el precio real de venta en `price`. Nunca mezclarlos.
- **Precio condicionado** (descuento de banco, cupón): va en `conditional_price` + `conditional_price_note`, nunca en `price`. El comparador público muestra el precio incondicional.
- **Sin stock ≠ no capturado:** producto listado sin stock → fila con `stock_status = out_of_stock`. Producto que no se pudo capturar → **sin fila** ese ciclo.
- **Precios inflados pre-temporada** (Black Friday): no requieren manejo especial en captura — el histórico es justamente lo que los expone. Feature futura: "detector de ofertas falsas".

## 7. Modos de falla y detección

| Falla | Detección | Respuesta |
|---|---|---|
| Challenge de Cloudflare / WAF | Respuesta 403/503 o HTML de challenge en lugar de producto | Abortar la tienda en ese ciclo, alertar al operador. **Nunca** intentar evadir el challenge |
| Cambio de plataforma / redeploy | JSON-LD ausente o schema inesperado | Fallar ruidosamente con muestra del HTML recibido para diagnóstico |
| Producto delistado | URL desaparece del sitemap o 404 | Marcar `store_products.active = false`, conservar histórico |
| Timeout / errores de red | Excepción del fetch | Reintento único con backoff; si persiste, contar como fallo del ciclo |
| Datos absurdos (precio 0, negativo) | Validación pre-insert | Descartar la captura, loggear para revisión |

Principio: **fallar ruidosamente, nunca silenciosamente**. Un ciclo sin datos de una tienda debe ser visible al operador el mismo día — cada ciclo perdido es histórico que no existirá.
