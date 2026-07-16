# Sesión 2026-07-16 — Refinamiento del brainstorm y documentación de diseño

> Registro de la sesión de planificación para sincronización del equipo. El plan se ejecutó completo; los documentos resultantes viven en `docs/`.

## Objetivo de la sesión

Partir del brainstorm original ([../../BRAINSTORM.md](../../BRAINSTORM.md)) para:

1. Refinar el brainstorm convirtiendo preguntas abiertas en decisiones.
2. Generar los archivos de diseño: arquitectura, entidades de datos, técnicas de scraping y backlog de tareas.

Alcance acotado a documentación — sin scaffolding ni código en esta sesión.

## Decisiones tomadas (con el autor, vía preguntas explícitas)

| Tema | Decisión | Alternativas descartadas |
|---|---|---|
| Alcance de la sesión | Solo documentación | Scaffolding inicial; prototipo funcional |
| Stack del colector | TypeScript + Bun | Python |
| Base de datos | Supabase (Postgres gestionado + auth) | Neon; Postgres local/Docker |
| Alertas | Solo documentar capa de notificaciones agnóstica al canal (mensajería, correo, web push); implementación fuera de alcance | Telegram desde ya; WhatsApp Business API |
| Tiendas | Las 4 originales: MAX, Kemik, Pacifiko, Curacao. Quinta descartada por ahora (El Duende ya no existe) | Intelaf, Tecnofácil, Cemaco como quinta |
| Matching | Curación manual de ~300 SKUs + EAN/GTIN cuando exista; automatizar después | Inversión temprana en fuzzy/embeddings |
| Backend/producto | Next.js (SSR + API routes) en Vercel + Supabase; sin NestJS separado | Next.js + NestJS como API aparte |
| Infraestructura de scraping | Scripts cron secuenciales, sin colas (RabbitMQ/BullMQ) ni workers; prioridad en velocidad de demo | Arquitectura event-driven desde el inicio |

## Trabajo realizado

- **`BRAINSTORM.md` refinado:** sección 8 pasó de "Preguntas abiertas" a "Decisiones tomadas"; arquitectura y esquema actualizados; nueva sección "Estado del documento" apuntando a `docs/` como fuente de verdad. Única pregunta que sigue abierta: términos con el empleador por escrito.
- **[../ARCHITECTURE.md](../ARCHITECTURE.md):** pipeline de 5 piezas con diagrama, componentes concretos, capa de notificaciones documentada (no implementada), disparadores de migración futura a event-driven.
- **[../DATA_MODEL.md](../DATA_MODEL.md):** ERD y detalle de 9 tablas. `alerts` se dividió en `subscriptions` + `notification_channels`; se agregaron `product_variants` y `match_review_queue`. Edge cases modelados: `price`/`list_price`/`conditional_price`, sin-stock vs no-capturado.
- **[../SCRAPING.md](../SCRAPING.md):** tácticas en orden de preferencia, política de cortesía con valores concretos, tabla de recon vacía para las 4 tiendas, matching por capas, modos de falla.
- **[../TASKS.md](../TASKS.md):** backlog en fases 0–5 con bloqueantes no técnicos al inicio.

## Plan ejecutado (referencia)

```markdown
# Documentación de la plataforma de inteligencia de precios

## Decisiones ya tomadas (quedan registradas en los docs)

- Alcance de la sesión: solo documentación, sin scaffolding ni código.
- Colector en TypeScript + Bun (consistente con el stack Next.js y las reglas del workspace).
- Backend: Next.js (SSR + API routes) hosteado en Vercel + Supabase (Postgres gestionado, auth). Sin NestJS separado.
- Scraping con estrategia simple: scripts cron secuenciales, sin colas (RabbitMQ/BullMQ) ni workers; prioridad en velocidad para tener algo demostrable (hackathon/negocio).
- Alertas: solo se documenta una capa de notificaciones agnóstica al canal (mensajería tipo Telegram/WhatsApp, correo, notificaciones del navegador); la implementación queda fuera de alcance.
- Tiendas: enfoque en las 4 propuestas originales — MAX, Kemik, Pacifiko, Curacao. La quinta tienda queda descartada por ahora (El Duende ya no existe; se re-evaluará más adelante).
- Matching: curación manual de ~300 SKUs + EAN/GTIN cuando exista; automatización posterior.

## Archivos a crear/modificar

### 1. Refinar BRAINSTORM.md

- Convertir las "Preguntas abiertas" ya resueltas en decisiones (stack TS+Bun, Next.js en Vercel + Supabase, matching manual-first, alertas diferidas a capa multi-canal, 4 tiendas sin quinta por ahora).
- Corregir detalles menores y añadir una sección "Estado del documento" que apunte a los nuevos docs de `docs/` como fuente de verdad.
- Mantener intactas las secciones de contexto, alternativas descartadas y edge cases.

### 2. docs/ARCHITECTURE.md

- Pipeline de 5 piezas: colección → normalización/matching → almacenamiento → notificaciones → producto (web/API), con diagrama mermaid.
- Componentes concretos: scrapers Bun/TS como scripts cron simples y secuenciales (GitHub Actions cron o Vercel Cron), sin colas ni workers; Supabase Postgres como almacenamiento; Next.js en Vercel como frontend + API (SSR y route handlers).
- Capa de notificaciones agnóstica al canal: entidad de suscripción + despachador con adaptadores (mensajería, email, web push), documentada pero no implementada.
- Principios: colector desacoplado del producto, fallo ruidoso ante bloqueos, simplicidad primero; la migración a event-driven (colas/workers/Timescale) se documenta solo como ruta futura cuando haya clientes B2B, sin rehacer datos.

### 3. docs/DATA_MODEL.md

- Entidades del esquema mínimo con columnas, tipos y relaciones: `stores`, `products` (catálogo canónico), `store_products` (mapeo tienda→canónico), `price_points` (serie de tiempo), `users`, y reemplazo de `alerts` por `subscriptions` + `notification_channels` para soportar múltiples canales.
- Diagrama entidad-relación en mermaid.
- Modelado explícito de edge cases: `price` vs `list_price` vs precio condicionado, sin-stock vs no-capturado, variantes de producto (color/almacenamiento).
- Índices clave (`price_points (store_product_id, captured_at DESC)`) y notas de crecimiento (particionado/Timescale como futuro, no ahora).

### 4. docs/SCRAPING.md

- Tácticas en orden de preferencia: JSON-LD `schema.org/Product` → sitemap.xml → feeds Merchant Center → HTML como último recurso.
- Política de cortesía: rate limits, user-agent identificable, robots.txt, caching, frecuencia 6–12 h.
- Checklist de reconocimiento técnico para las 4 tiendas (MAX, Kemik, Pacifiko, Curacao): qué verificar (JSON-LD, sitemap, robots.txt, Cloudflare/challenge, plataforma) con tabla vacía para llenar durante el recon.
- Ejecución simple: un script por tienda corrido secuencialmente desde el cron, sin colas ni workers.
- Estrategia de matching por capas: EAN/GTIN → normalización marca+modelo → fuzzy/embeddings, con cola de revisión manual; arranque manual con ~300 SKUs.
- Modos de falla y detección: challenge de Cloudflare, cambio de plataforma, fallo ruidoso con alerta al operador.

### 5. docs/TASKS.md

- Backlog por fases con checkboxes:
  - Fase 0 – Reconocimiento técnico (1 tarde) de las 4 tiendas: MAX, Kemik, Pacifiko, Curacao.
  - Fase 1 – Colector: esquema en Supabase, scraper de 1 tienda + 20 SKUs en cron simple, validación de JSON-LD.
  - Fase 2 – Catálogo canónico: curación manual de ~300 SKUs, cola de revisión.
  - Fase 3 – Producto B2C: Next.js en Vercel con SSR + API routes (histórico/percentiles, comparador web).
  - Fase 4 – Notificaciones multi-canal (cuando se retome).
  - Fase 5 – SaaS B2B: dashboards agregados; evaluar quinta tienda y migración a colas/workers si el volumen lo exige.
- Tareas no técnicas bloqueantes: conversación con el empleador, revisión de contrato.

## Notas

- Todos los documentos en español, mismo tono que BRAINSTORM.md.
- No se crea código, esquema SQL ejecutable ni estructura de proyecto en esta sesión.
```

## Siguiente paso

Fase 0 del backlog: reconocimiento técnico de las 4 tiendas para llenar la tabla de [../SCRAPING.md](../SCRAPING.md) y decidir con cuál tienda escribir el primer scraper.
