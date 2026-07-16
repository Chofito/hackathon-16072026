# Backlog por fases

> Regla de oro: **el colector arranca de inmediato** — cada semana sin capturar es histórico que no existirá. Las fases 2+ pueden esperar; la fase 1 no.

## Bloqueantes no técnicos

- [ ] Revisar contrato con Distelsa/Kosmos (cláusulas de no-competencia / IP).
- [ ] Conversación con el empleador sobre el proyecto, por escrito. **Bloquea el lanzamiento público, no el prototipo privado.**

## Fase 0 — Reconocimiento técnico (1 tarde)

Completar la tabla de recon de [SCRAPING.md](SCRAPING.md) para las 4 tiendas:

- [ ] MAX: JSON-LD, GTIN, sitemap, robots.txt, plataforma, WAF.
- [ ] Kemik: JSON-LD, GTIN, sitemap, robots.txt, plataforma, WAF.
- [ ] Pacifiko: JSON-LD, GTIN, sitemap, robots.txt, plataforma, WAF.
- [ ] Curacao: JSON-LD, GTIN, sitemap, robots.txt, plataforma, WAF.
- [ ] Decidir con cuál tienda empezar (la de mejores datos estructurados y menor fricción).

## Fase 1 — Colector mínimo

- [ ] Crear proyecto en Supabase y aplicar el esquema de [DATA_MODEL.md](DATA_MODEL.md) (`stores`, `products`, `product_variants`, `store_products`, `price_points`, `users`, `subscriptions`, `notification_channels`, `match_review_queue`).
- [ ] Sembrar `stores` con las 4 tiendas y `products` con ~20 SKUs iniciales (subset del nicho tech/gaming).
- [ ] Scraper de la primera tienda (Bun + TS): sitemap → JSON-LD → capturas, con rate limit y user-agent identificable.
- [ ] Normalizador mínimo: matching por SKU/EAN contra `store_products`, discrepancias a `match_review_queue`.
- [ ] Cron (GitHub Actions) corriendo cada 6–12 h con logs y alerta al operador en fallo.
- [ ] Validar robustez del JSON-LD tras ~1 semana de ciclos (¿cambió el markup? ¿capturas consistentes?).

## Fase 2 — Cobertura completa y catálogo canónico

- [ ] Scrapers de las 3 tiendas restantes, secuenciales en el mismo job.
- [ ] Ampliar catálogo canónico a ~300 SKUs curados a mano (consolas, GPUs, celulares).
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
