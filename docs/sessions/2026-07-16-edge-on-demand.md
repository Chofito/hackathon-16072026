# Sesión 2026-07-16 — Edge Functions on-demand + cache sitemaps

## Contexto

La UI necesita dos capacidades síncronas: info de una URL de producto, y búsqueda del mismo producto en otras tiendas. `capture-examples` solo hace 1 tienda; `poc/find-matches` hace cross-tienda pero baja sitemaps en vivo (demasiado lento para Edge Function).

## Decisiones

- Dos Edge Functions síncronas: `fetch-product` + `find-matches` (opción A + cache).
- Cache de URLs de producto en Postgres (`sitemap_urls`), refrescado con `bun run refresh-sitemaps`.
- Stale = 7 días → `503 sitemap_cache_stale` (sin crawl de emergencia en el request).
- Contrato JSON compartido (`ProductDto`); MVP sin persistir price points ni subscriptions.
- Scoring portado a `@pgt/core` (`tokenize` / `scoreTokens` / `slugFromUrl`) desde el POC.

## Docs tocados

- [plans/2026-07-16-edge-on-demand-design.md](../plans/2026-07-16-edge-on-demand-design.md)
- [EDGE_FUNCTIONS.md](../EDGE_FUNCTIONS.md) (reescrito al contrato)
- `BRAINSTORM.md` §8, `AGENTS.md`, `DATA_MODEL.md`
