# Sesión 2026-07-16 — Scrapers, capturas y búsqueda cross-store

> Registro de sesión. Implementación de scrapers + ejemplos `RawCapture` + reglas
> de búsqueda por texto (robots-safe).

## Trabajo realizado

- **`@pgt/scrapers`:** módulos reales `max`, `kemik`, `pacifiko`, `curacao`
  (`scrape` + `fetchOne`). MAX usa `__NEXT_DATA__` (incluye `eanCode` EAN-13);
  Kemik microdata+OG+h1; Pacifiko/Curacao JSON-LD (+ GTIN HTML en Curacao).
- **`@pgt/core/parsing`:** `brand`, `listPrice`, URL canónica de offer.
- **Ejemplos:** `examples/captures/*.json` regenerables con `bun run examples`.
- **POC cross-store:** `poc/find-matches.ts` con MAX como destino, skip de tienda
  origen, boost EAN, penalización si falta token de modelo (`a56` vs `a54`).
- **Reporte:** `examples/cross-store-report.md`.
- **Docs:** [../SCRAPING.md](../SCRAPING.md) §6.4 (búsqueda por texto: sitemap sí,
  `/search?q=` no); [../TASKS.md](../TASKS.md) scrapers marcados hechos;
  [../TESIS.md](../TESIS.md) enlazado desde AGENTS/BRAINSTORM.

## Decisiones

- **No implementar `search` vía HTML de tienda.** MAX `Disallow: /search?q*`;
  Kemik CSR; Pacifiko/Curacao restringen. La búsqueda por query = filtrar sitemap
  por tokens + confirmar con `fetchOne` (sin LLM).
- SKU interno no cruza; EAN sí cuando ambas tiendas lo publican (MAX + Curacao).
- Variantes (color/RAM/región USA vs HK) → `? revisar`, no match forzado.

## Siguiente paso

- Cablear scrapers al colector + Supabase local (`db:reset`, ingest).
- Completar Edge Function `fetch-product`.
- (Opcional) formalizar `Scraper.search(query)` = wrapper del flujo sitemap.
