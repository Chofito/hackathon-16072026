# Backlog por fases

> Regla de oro: **el colector arranca de inmediato** — cada semana sin capturar es histórico que no existirá. Las fases 2+ pueden esperar; la fase 1 no.

## Bloqueantes no técnicos

- [ ] Revisar contrato con Distelsa/Kosmos (cláusulas de no-competencia / IP).
- [ ] Conversación con el empleador sobre el proyecto, por escrito. **Bloquea el lanzamiento público, no el prototipo privado.**

## Fase 0 — Reconocimiento técnico (1 tarde)

Recon completado el 2026-07-16; tabla y notas en [SCRAPING.md](SCRAPING.md) §4:

- [x] MAX: Next.js headless sobre Magento, Cloudflare+CloudFront; JSON-LD parcial; **`eanCode` + stock en `__NEXT_DATA__`**.
- [x] Kemik: Next.js custom, sin JSON-LD (microdata + OG), sin GTIN.
- [x] Pacifiko: OpenCart, JSON-LD limpio con availability y `mpn`, sin GTIN.
- [x] Curacao: Magento 2, JSON-LD limpio + **GTIN (EAN-13) en tabla HTML**, sitemap GT dedicado.
- [x] Orden de implementación: **Pacifiko → Curacao → MAX → Kemik** (los 4 ya implementados).

## Fase 1 — Colector mínimo

Scaffold del monorepo Bun ya en `apps/collector` + `packages/*` + `supabase/`. Todo debe correr **localmente** (`bun run collect`, `bun run db:*`, `bun run fn:serve`) antes de desplegar. Los **4 scrapers** (`max`, `kemik`, `pacifiko`, `curacao`) ya implementan `scrape` + `fetchOne` en `@pgt/scrapers`; ejemplos vivos en `examples/captures/`.

- [ ] Aplicar migraciones/seed en Supabase local (`bun run db:reset`) — esquema en [DATA_MODEL.md](DATA_MODEL.md) y `supabase/migrations/`.
- [ ] Sembrar `stores` con las 4 tiendas y `products` con ~20 SKUs iniciales (subset del nicho tech/gaming).
- [x] Implementar módulos de tienda en `@pgt/scrapers`: `scrape` (sitemap → parse → `RawCapture`) + `fetchOne`, con `politeGet`. MAX vía `__NEXT_DATA__` (incluye `eanCode`); Kemik microdata+OG+h1; Pacifiko/Curacao JSON-LD (+ GTIN HTML en Curacao).
- [ ] On-demand: completar la Edge Function `fetch-product` (Deno) — resolver tienda, `fetchOne` cortés, `upsert` + `price_point` + `subscription`, y encolar el resto en `product_requests` (ver [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)).
- [ ] Normalizador mínimo (`@pgt/ingest`): matching por SKU/EAN contra `store_products`, discrepancias a `match_review_queue`. Mismo camino para capturas batch y on-demand.
- [ ] Cron del colector Bun (GitHub Actions, `.github/workflows/collect.yml`) cada 6–12 h, con logs y alerta al operador en fallo.
- [ ] Validar robustez del JSON-LD tras ~1 semana de ciclos (¿cambió el markup? ¿capturas consistentes?).
- [ ] (Opcional) `Scraper.search(query)` = filtrar sitemap por tokens + confirmar con `fetchOne`. **No** usar `/search?q=…` de MAX (robots `Disallow`). Ver [SCRAPING.md](SCRAPING.md) §6.4.

## Fase 2 — Cobertura completa y catálogo canónico

- [x] Módulos de las 4 tiendas locales en `@pgt/scrapers` (completado en Fase 1; queda cablear al colector/DB).
- [ ] Ampliar catálogo canónico a ~300 SKUs curados a mano (consolas, GPUs, celulares).
- [ ] Colector de referencia de Amazon vía PA-API (USD): sembrar `stores` con Amazon (`kind='reference'`), matching por EAN/UPC→ASIN, capturas `source='api'`. Sin scraping de amazon.com. Requiere cuenta de afiliado aprobada (o proveedor licenciado como fallback).
- [ ] Flujo de trabajo para la cola de revisión manual (aunque sea un query + update a mano al inicio).
- [ ] Métricas del colector: capturas por ciclo, tasa de matching, tamaño de la cola de revisión.

## Fase 3 — Producto B2C (Next.js en Vercel)

- [ ] Proyecto Next.js en Vercel conectado a Supabase (cliente server-side).
- [ ] Página de producto SSR: comparador de precios entre tiendas + gráfica de histórico.
- [ ] API routes: precio actual, serie histórica, señal "¿es buena oferta?" (percentil del precio actual vs. su histórico).
- [ ] Listados por categoría con SSR (SEO — parte del flywheel B2C).

## Fase 4 — Notificaciones multi-canal (cuando se retome)

- [ ] Despachador post-ingesta: evaluar `subscriptions` activas contra nuevos `price_points`.
- [ ] Primer adaptador de canal (mensajería, correo o web push — decidir al retomar).
- [ ] Alta y verificación de `notification_channels` desde el producto web.

## Fase 5 — SaaS B2B

- [ ] Dashboards agregados por categoría/marca/tienda (posicionamiento de precio, share of shelf, quiebres de stock).
- [ ] Auth y multi-tenancy sobre Supabase.
- [ ] Re-evaluar quinta tienda (candidatas: Intelaf, Tecnofácil, Cemaco — según demanda de clientes).
- [ ] Evaluar migración a colas/workers y Timescale/particionado **solo si** el volumen lo exige (ver disparadores en [ARCHITECTURE.md](ARCHITECTURE.md)).
- [ ] Feature derivada: "detector de ofertas falsas" (requiere meses de histórico).
