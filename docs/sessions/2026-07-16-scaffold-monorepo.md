# Sesión 2026-07-16 — Scaffold del monorepo (Bun workspaces)

> Registro de la sesión de scaffolding para sincronización del equipo. Se preparó el repo como **template** para que el equipo implemente los módulos. Commit resultante: `5880ce2`.

## Objetivo de la sesión

Configurar el monorepo para el stack decidido (Supabase + Next.js + Vercel + Bun) y dejar listos los subproyectos (scrapers y functions de ingesta) como templates, sin desarrollar la lógica real.

## Decisiones tomadas (con el autor, vía preguntas explícitas)

| Tema | Decisión | Alternativas descartadas |
|---|---|---|
| Herramienta de monorepo | Solo Bun workspaces | Turborepo (capa extra de cache/task graph) |
| Ejecución de ingesta (hackathon) | Local: scrape + procesado + insert corren en la máquina contra Supabase | Serverless; cron GitHub Actions desde ya |
| Flujo on-demand del usuario | Supabase Edge Function (`fetch-product`) | Next.js Route Handler; solo encolar |
| Respuesta on-demand | Fetch síncrono de 1 tienda/URL + encolar el resto en `product_requests` | Fetch síncrono de las 4 tiendas; solo cola |
| Alcance del código | Templates con `TODO(dev-*)`; `@guateofertas/core` y `@guateofertas/db` sí implementados (son el contrato) | Implementar scrapers/ingest completos |
| `apps/web` (Next.js) | Lo instancia el equipo; no se incluye en el scaffold | Dejar el `create-next-app` + shadcn ya armado |

## Trabajo realizado

- **Raíz:** `package.json` (Bun workspaces `apps/*` + `packages/*`, scripts `collect`/`dev:web`/`db:*`/`gen:types`/`fn:*`/`typecheck`), `bunfig.toml` (`linker = hoisted`), `tsconfig.base.json` estricto, `.env.example`, `.gitignore` (ignores de Supabase), README ampliado.
- **[../../packages/core](../../packages/core):** `@guateofertas/core` — tipos de dominio (camelCase), matching por capas (`matchCapture`, `normalizeName`) y parsing portable JSON-LD/sitemap (`parseProductFromHtml`, `parseSitemapUrls`). Reutilizable en Bun y Deno.
- **[../../packages/db](../../packages/db):** `@guateofertas/db` — cliente Supabase tipado (service/anon), `database.types.ts` (placeholder regenerable con `gen:types`) y query helpers con mapeo snake_case↔camelCase.
- **[../../packages/scrapers](../../packages/scrapers):** `@guateofertas/scrapers` — TEMPLATE: interfaz `Scraper`, fetch cortés, stub `max.ts`, registry. Restricción: runtime-agnóstico.
- **[../../packages/ingest](../../packages/ingest):** `@guateofertas/ingest` — TEMPLATE: glue matching → insert `price_points` → cola de revisión.
- **[../../apps/collector](../../apps/collector):** `@guateofertas/collector` — TEMPLATE de CLI que orquesta scrapers → ingest → Supabase (local).
- **[../../supabase](../../supabase):** `config.toml`, migración inicial (esquema de [../DATA_MODEL.md](../DATA_MODEL.md) + tabla nueva `product_requests`), `seed.sql` (4 tiendas + ~20 SKUs) y Edge Function template `functions/fetch-product/`.
- **[../EDGE_FUNCTIONS.md](../EDGE_FUNCTIONS.md):** documentación del flujo on-demand con Supabase Edge Functions.
- **`.github/workflows/collect.yml`:** cron del colector documentado y desactivado (fase posterior).

## Estado

- `bun install` OK; `bun run typecheck` en verde en los 5 paquetes Bun (`core`, `db`, `scrapers`, `ingest`, `collector`).
- Commit `5880ce2` con el scaffold (sin push). `apps/web` se eliminó a propósito.

## Siguiente paso

- El autor instancia `apps/web` (Next.js App Router + Tailwind + shadcn/Radix, paquete `@guateofertas/web`).
- El equipo implementa los TEMPLATES siguiendo el backlog de [../TASKS.md](../TASKS.md), empezando por Fase 0 (recon) y el primer scraper.
