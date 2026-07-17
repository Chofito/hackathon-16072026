# Sesión 2026-07-16 — Flujo de usuario, rename a GuateOfertas y UI mínima

> Registro de la sesión de documentación para sincronización del equipo. Alcance acotado a documentación — sin tocar `apps/`, `packages/` ni `supabase/` (esos siguen como templates para el dev-scraper; la UI la implementa otro agente en paralelo).

## Objetivo de la sesión

Documentar el contrato entre la UI (`apps/web`) y el colector/Edge Function (dev-scraper) para el flujo on-demand, y dejar registradas las decisiones ya tomadas por el autor: rename del proyecto, comportamiento exacto del camino on-demand y reglas de acceso anónimo.

## Decisiones tomadas (ya definidas por el autor antes de la sesión, documentadas aquí)

| Tema | Decisión | Alternativas descartadas |
|---|---|---|
| Nombre del proyecto | Rename total de PreciosGT a **GuateOfertas** (scope `@guateofertas/*`) — ya aplicado en todo el repo | Mantener PreciosGT |
| Camino on-demand | Fetch síncrono de **1 sola tienda** (la del link pegado) + respuesta inmediata + encolado del resto en `product_requests` | Fetch síncrono de las 4 tiendas; solo encolar sin responder precio inmediato |
| Ciclo de estados de `product_requests` | `pending → processing → done \| failed`, como convención de aplicación (la migración solo define el default `pending`) | Un solo estado booleano `processed` |
| Acceso anónimo | Anónimos pueden pegar links y disparar el on-demand, con rate limit; crear `subscription` requiere login | Bloquear todo el flujo on-demand detrás de login |
| UI | UI mínima en `apps/web` (home con buscador texto/URL + comparador `/producto/[id]`), implementada por otro agente en paralelo — este doc solo la menciona como contrato | Documentar y esperar a implementarla en esta misma sesión |

## Trabajo realizado

- **[../USER_FLOW.md](../USER_FLOW.md) (nuevo):** pieza central de la sesión. Describe los tres caminos de usuario (búsqueda de producto trackeado, pegar link on-demand, vista comparador), con diagrama de flujo y diagrama de secuencia en mermaid del camino on-demand. Incluye la sección "Contrato para dev-scraper" (qué implementa la Edge Function `fetch-product`, qué lee el collector de `product_requests` y cómo transiciona estados, modos de falla) y "Estados de UI por pantalla" (home vacío/con resultados/sin match; comparador completo/parcial/error), dejando explícito que el histórico de un SKU nuevo arranca desde ahora.
- **[../DATA_MODEL.md](../DATA_MODEL.md):** se agregó `product_requests` (existía en la migración pero no estaba documentada) al diagrama ER, con su sección de entidad (columnas, nullables, FKs), el ciclo de estados `pending → processing → done | failed` y una nota sobre el índice parcial `idx_product_requests_pending`.
- **[../EDGE_FUNCTIONS.md](../EDGE_FUNCTIONS.md):** se agregó la sección "Acceso anónimo y rate limit" — anónimos pueden disparar el fetch on-demand (sujeto a rate limit), pero la creación de `subscription` queda condicionada a que la request venga autenticada. Se ajustó el paso 3 del flujo, que antes asumía auth siempre. Se enlazó a `USER_FLOW.md`.
- **[../../AGENTS.md](../../AGENTS.md):** se agregaron `docs/USER_FLOW.md` y `docs/EDGE_FUNCTIONS.md` a la tabla de documentos de la fuente de verdad.
- **[../../README.md](../../README.md):** se mencionó `docs/USER_FLOW.md` en la intro y se enlazó `docs/EDGE_FUNCTIONS.md` desde la línea de `functions/fetch-product/` en la estructura del repo.
- **[../../BRAINSTORM.md](../../BRAINSTORM.md):** sección 8 ampliada con las decisiones de esta sesión (rename, on-demand confirmado, ciclo de estados, acceso anónimo, UI mínima); "Estado del documento" ahora enlaza también `USER_FLOW.md` y `EDGE_FUNCTIONS.md`.

## Estado

- Solo documentación — no se tocó código bajo `apps/`, `packages/` ni `supabase/`.
- Sin commit ni push en esta sesión (a cargo del autor).

## Siguiente paso

- El dev-scraper implementa el contrato de [../USER_FLOW.md](../USER_FLOW.md) sección 4 al llenar los `TODO(dev-edge)` de `supabase/functions/fetch-product/` y la lectura de `product_requests` en el collector.
- El agente de UI en paralelo usa la sección 5 de [../USER_FLOW.md](../USER_FLOW.md) (estados de pantalla) como contrato para el home y el comparador en `apps/web`.
