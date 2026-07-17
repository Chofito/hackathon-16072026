# GuateOfertas — Inteligencia de precios ecommerce Guatemala

Monorepo (Bun workspaces) de la plataforma de inteligencia de precios.
Contexto de negocio en [BRAINSTORM.md](BRAINSTORM.md); diseño técnico en [docs/](docs). El flujo de usuario completo (búsqueda, on-demand, comparador) está en [docs/USER_FLOW.md](docs/USER_FLOW.md).

## Stack

- **Bun + TypeScript** — colector y librerías compartidas.
- **Supabase** (Postgres + Auth) — almacenamiento y edge functions.
- **Next.js en Vercel** — producto web (lo instancia el equipo en `apps/web`).

## Estructura

```
apps/
  collector/   @guateofertas/collector  CLI que orquesta scrapers -> ingest -> Supabase (corre local)
  web/         @guateofertas/web        Next.js — App Router, Tailwind, shadcn/Radix
packages/
  core/        @guateofertas/core       tipos de dominio + matching + parsing JSON-LD/sitemap (portable Bun+Deno)
  db/          @guateofertas/db         cliente Supabase tipado + database.types + query helpers
  scrapers/    @guateofertas/scrapers   interfaz Scraper + un módulo por tienda (TEMPLATE)
  ingest/      @guateofertas/ingest     normalización + matching + insert + cola de revisión (TEMPLATE)
supabase/
  migrations/  esquema (docs/DATA_MODEL.md) + product_requests
  seed.sql     4 tiendas + ~20 SKUs
  seed_demo.sql  datos sintéticos de precios (solo desarrollo local, ver comentario en el archivo)
  functions/fetch-product/     Edge Function (Deno) on-demand (TEMPLATE, ver docs/EDGE_FUNCTIONS.md)
.github/workflows/collect.yml  cron del colector (documentado/desactivado)
```

## Empezar

```sh
bun install
cp .env.example .env   # completar con los valores de `supabase start`
```

## Scripts

| Comando | Qué hace |
|---|---|
| `bun run typecheck` | Type-check de todos los workspaces Bun |
| `bun run collect` | Corre el colector local (scrapers -> ingest -> Supabase) |
| `bun run db:start` / `db:stop` | Stack local de Supabase (requiere Docker) |
| `bun run db:reset` | Aplica migraciones + seed (incluye `seed_demo.sql` con precios sintéticos para la UI) |
| `bun run db:seed-demo` | Vuelve a cargar solo los datos demo (sin resetear migraciones) |
| `bun run gen:types` | Regenera `packages/db/src/database.types.ts` desde el schema local |
| `bun run fn:serve` / `fn:deploy` | Edge Function `fetch-product` |
| `bun run dev:web` / `build:web` | Next.js en `apps/web` |

## Notas para el equipo

- Los paquetes marcados **TEMPLATE** traen la interfaz y stubs con `TODO(dev-*)`; ahí se implementa la lógica real.
- `@guateofertas/scrapers` debe mantenerse **runtime-agnóstico** (fetch estándar, sin `Bun.*`) para reutilizarse en la Edge Function (Deno).
- `apps/web`: paquete `@guateofertas/web` (App Router, Tailwind, shadcn/Radix) — calza con los scripts root `dev:web`/`build:web`.
- La CLI de Supabase está incluida como devDependency: úsala con `bunx supabase ...` (o los scripts `db:*`).
