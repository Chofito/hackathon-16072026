# Guía para agentes

Plataforma de inteligencia de precios del ecommerce guatemalteco (MAX, Kemik, Pacifiko, Curacao). El activo del proyecto es el **dataset histórico de precios + el catálogo canónico de productos** — cualquier decisión que arriesgue esos datos se descarta.

## Estado del proyecto

Fase de documentación/diseño con scaffold Bun + scrapers implementados. Antes de implementar más, lee la fuente de verdad:

| Documento | Contenido |
|---|---|
| [BRAINSTORM.md](BRAINSTORM.md) | Contexto de negocio, decisiones y alternativas descartadas |
| [docs/TESIS.md](docs/TESIS.md) | Marco conceptual: qué es el producto en abstracto, primitivas, conceptos económicos → features |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, componentes y principios de diseño |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Esquema de datos (Supabase/Postgres) e índices |
| [docs/SCRAPING.md](docs/SCRAPING.md) | Tácticas de colección, cortesía, matching y modos de falla |
| [docs/TASKS.md](docs/TASKS.md) | Backlog por fases |
| [docs/sessions/](docs/sessions/) | Registro de sesiones de planificación |

## Decisiones de stack (ya tomadas, no re-litigar)

- **Colector:** TypeScript + Bun; scripts cron secuenciales (GitHub Actions cron o Vercel Cron). **Sin colas ni workers** — la migración a event-driven tiene disparadores documentados en `docs/ARCHITECTURE.md`.
- **Base de datos:** Supabase (Postgres gestionado + auth) desde el día uno. Sin TimescaleDB ni particionado por ahora.
- **Producto:** Next.js (SSR + API routes) hosteado en Vercel. Sin backend NestJS separado.
- **Notificaciones:** solo el modelo de datos (`subscriptions`, `notification_channels`); los adaptadores de entrega (mensajería, correo, web push) NO se implementan todavía.
- **Matching:** manual-first (~300 SKUs curados) + EAN/GTIN cuando exista. Fuzzy/embeddings solo cuando la revisión manual duela.

## Reglas duras

1. **Scraping cortés siempre:** rate limit de 1 request cada 2–5 s por tienda, user-agent identificable con contacto, respetar robots.txt. **Nunca** intentar evadir un challenge de Cloudflare/WAF — ante bloqueo, fallar ruidosamente y alertar al operador.
2. **`price_points` es append-only:** nunca actualizar ni borrar filas. Correcciones de matching se hacen re-apuntando `store_products.product_id`.
3. **Sin stock ≠ no capturado:** producto sin stock → fila con `stock_status = out_of_stock`; captura fallida → sin fila. Nunca inventar un price point.
4. **Un match incorrecto es peor que un match faltante:** en duda, a la cola de revisión (`match_review_queue`).
5. **Decisiones importantes se consultan con el autor** antes de asumirlas; una vez tomadas, se registran en `BRAINSTORM.md` (sección 8) y en un log de sesión en `docs/sessions/`.

## Convenciones

- **Runtime:** Bun, no Node (`bun <file>`, `bun install`, `bun test`, `bunx`).
- **Código:** TypeScript ESM, 2 espacios, comillas simples, sin punto y coma, tipado estricto. `PascalCase` para clases/componentes, `camelCase` para funciones y variables.
- **Documentación:** en español, mismo tono que `BRAINSTORM.md`. Diagramas en mermaid.
- **Commits:** imperativos y concisos (ej. `Add store recon results`). Commit y push de cada cambio de planificación para mantener al equipo sincronizado.

## Contexto sensible

El autor trabaja en Distelsa/Kosmos (opera MAX, una de las tiendas trackeadas). El proyecto es deliberadamente público y el colector debe ser lo opuesto a un ataque. El lanzamiento público está bloqueado por la conversación con el empleador (ver `docs/TASKS.md`), no así el prototipo privado.
