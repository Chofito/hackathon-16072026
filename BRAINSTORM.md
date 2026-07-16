# Design Brief: Plataforma de inteligencia de precios ecommerce Guatemala

> Documento de handoff generado a partir de una sesión de brainstorming estructurado (2026-07-16).
> Contiene contexto, decisiones tomadas, alternativas descartadas y próximos pasos.
> Pensado para retomarse en otro harness (Claude Code u otro agente) sin contexto previo.

## Estado del documento

Este brainstorm fue refinado el 2026-07-16 con decisiones ya tomadas (ver sección 8). La fuente de verdad del diseño vive en `docs/`:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura y componentes
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — entidades y esquema de datos
- [docs/SCRAPING.md](docs/SCRAPING.md) — tácticas de colección y matching
- [docs/TASKS.md](docs/TASKS.md) — backlog por fases

---

## 1. Resumen ejecutivo

Construir el **dataset histórico de precios del ecommerce guatemalteco** (MAX, Kemik, Pacifiko, Curacao, etc.) y explotarlo en dos capas:

1. **Capa pública B2C (gratis):** comparador de precios + histórico + alertas. Funciona como flywheel de datos, SEO y credibilidad. No monetiza directamente.
2. **Capa SaaS B2B (revenue):** dashboards de inteligencia de precios / estudios de mercado para retailers, distribuidores y **marcas** (posicionamiento de precio vs. competencia, share of shelf, quiebres de stock, informes de temporada).

**Insight central del negocio:** el activo no es el sitio web, es el **dataset histórico + el catálogo de productos normalizado (matching entre tiendas)**. El histórico no se puede retro-generar → **el colector de datos debe arrancar de inmediato**, aunque el producto tarde meses.

**Insight técnico central:** el problema difícil no es el scraping, es el **product matching** — saber que "Consola Nintendo Switch 2" en Kemik y "NINTENDO SWITCH 2 NSW2-001" en MAX son el mismo producto. Ese matching es el moat técnico.

## 2. Contexto y restricciones

- Side project de una sola persona; **el tiempo es la restricción dominante**.
- El autor trabaja en Distelsa/Kosmos (plataforma MAX, max.com.gt) — una de las tiendas a trackear. Decisión: proyecto **totalmente público**. Pendiente: revisar contrato (no-competencia / IP) y transparentar con el empleador por escrito.
- El autor tiene experiencia directa con Cloudflare WAF y anti-bot (configuró las defensas de MAX) → diseñar el colector para ser lo opuesto a un ataque.
- Guatemala es un mercado **WhatsApp-first**; el mercado B2C local es pequeño (afiliados/ads no sostienen el proyecto por sí solos).
- Objetivo declarado del autor: **prototipo para estudios de mercado y SaaS**.

## 3. Alcance inicial (MVP)

- **Nicho vertical:** tech/gaming (~300 SKUs de alto interés: consolas, GPUs, celulares).
- **Tiendas:** MAX, Kemik, Pacifiko, Curacao (4 total). La quinta tienda queda descartada por ahora — El Duende ya no existe; se re-evaluará cuando el colector esté estable.
- **Frecuencia de captura:** cada 6–12 horas (suficiente para histórico de precios).
- **Alertas MVP:** fuera del alcance de implementación. Se documenta una capa de notificaciones agnóstica al canal (mensajería, correo, notificaciones del navegador) para implementarse después.

## 4. Arquitectura recomendada

**Opción elegida: colector cloud ligero + Postgres gestionado desde el día uno.**

Pipeline de cinco piezas: **colección → normalización/matching → almacenamiento temporal → notificaciones → producto (web/API)**.

- **Colección:** scrapers en TypeScript + Bun ejecutados como scripts cron simples y secuenciales (GitHub Actions cron o Vercel Cron), sin colas ni workers. Desacoplados del producto: el dataset crece aunque el frontend no exista.
- **Almacenamiento:** Supabase (Postgres gestionado, free tier). Serie de tiempo simple: tabla `price_points` con índices adecuados llega lejos antes de necesitar TimescaleDB.
- **Producto (fase posterior):** Next.js hosteado en Vercel, cubriendo frontend (SSR) y API (route handlers). Sin backend NestJS separado.
- **Migración futura:** todo lo anterior migra sin rehacer datos a una plataforma event-driven (colas + workers + Timescale + multi-tenancy) cuando el SaaS tenga clientes B2B.

### Esquema de datos mínimo

```
stores          (id, name, base_url, platform, ...)
products        (id, canonical_name, brand, model, ean_gtin, category, ...)   -- catálogo canónico
store_products  (id, store_id, product_id, store_sku, url, raw_name, ...)     -- mapeo tienda→canónico
price_points    (id, store_product_id, price, list_price, currency,
                 in_stock, captured_at)                                        -- serie de tiempo
subscriptions   (id, user_id, product_id, target_price, active, ...)           -- suscripción a alertas
notification_channels (id, user_id, type, address, verified, ...)              -- canal: mensajería/email/web push
users           (id, email, ...)
```

Índice clave: `price_points (store_product_id, captured_at DESC)`. Detalle completo en [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

### Tácticas de colección (en orden de preferencia)

1. **JSON-LD (`schema.org/Product`)** antes que CSS selectors — Magento y la mayoría de ecommerce serios lo exponen (nombre, precio, SKU, disponibilidad). 10x más robusto ante redeploys del frontend.
2. **`sitemap.xml`** como fuente del universo de URLs de producto (evita crawlear navegación).
3. **Feeds de Google Shopping / Merchant Center** si se consigue acceso o alianza — datos estructurados sin scraping.
4. **Cortesía agresiva:** rate limits bajos, user-agent identificable, respetar robots.txt, caching. Crawl lento cada 6–12 h.
5. **Matching por capas:** EAN/GTIN cuando exista → normalización marca+modelo → fuzzy/embeddings como último recurso, con **cola de revisión manual**. Empezar manual con ~300 SKUs; automatizar cuando duela.

## 5. Flujo del sistema

1. Cron (6–12 h) → scraper por tienda lee sitemap + JSON-LD → inserta `price_points` crudos.
2. Normalizador hace matching contra `products` (catálogo canónico); discrepancias van a cola de revisión.
3. API expone: precio actual, histórico, y señal "¿es buena oferta?" (percentil del precio actual vs. su histórico).
4. Usuario suscribe alerta (producto + precio objetivo) → job evalúa en cada ingesta → notifica por el canal configurado (mensajería, correo o web push; fase posterior).
5. Fase SaaS: dashboards agregados por categoría/marca/tienda sobre el mismo dataset.

## 6. Edge cases y modos de falla

- Variantes de producto (color/almacenamiento) que rompen el matching 1:1.
- "Descuento de banco" o cupón que no es el precio real de lista → distinguir `price` vs `list_price` vs precio condicionado.
- Tiendas que cambian de plataforma o activan challenge de Cloudflare → el scraper debe **fallar ruidosamente** (alerta al operador), nunca silenciosamente.
- Producto sin stock vs. precio no capturado: son estados distintos, modelarlos distinto.
- Precios inflados pre-temporada (Black Friday): el histórico es justamente lo que los expone — feature futura de "detector de ofertas falsas".

## 7. Alternativas consideradas y descartadas

| Alternativa | Por qué no (todavía) |
|---|---|
| SQLite + mini PC puro | Arranque rápido pero fuerza migración dolorosa al pasar a multi-usuario/SaaS |
| Plataforma event-driven completa desde día uno | Sobre-ingeniería antes de validar; correcta solo cuando haya clientes B2B |
| B2C monetizado con afiliados/ads | Mercado guatemalteco demasiado pequeño para sostener el proyecto solo |
| B2B pura sin capa pública | Ciclo de venta lento sin credibilidad ni dataset que mostrar |
| Watchdog viral de ofertas falsas como producto principal | Requiere meses de histórico previo; queda como feature/campaña derivada del dataset |
| Crowdsourcing de precios (extensión/comunidad) | Frío de arrancar sin masa crítica; posible complemento futuro |

## 8. Decisiones tomadas (antes "Preguntas abiertas")

Resueltas en la sesión de refinamiento del 2026-07-16:

- **Canal de alertas:** ninguno por ahora. Se documenta una capa de notificaciones agnóstica al canal (mensajería tipo Telegram/WhatsApp, correo, web push); la implementación queda diferida.
- **Matching:** curación manual del catálogo canónico (~300 SKUs) + EAN/GTIN cuando exista. Automatización (normalización, fuzzy/embeddings) solo cuando duela.
- **Stack del colector:** TypeScript + Bun, scripts cron secuenciales sin colas ni workers — prioridad en velocidad de tener algo demostrable.
- **Backend/producto:** Next.js (SSR + API routes) en Vercel + Supabase (Postgres gestionado, auth). Sin NestJS separado.
- **Quinta tienda:** descartada por ahora (El Duende ya no existe). Foco en MAX, Kemik, Pacifiko y Curacao; se re-evaluará en fase SaaS.

Sigue abierta:

- ¿Términos con el empleador por escrito? (bloqueante para lanzamiento público, no para el prototipo privado)

## 9. Próximos pasos

El backlog completo por fases vive en [docs/TASKS.md](docs/TASKS.md). Resumen inmediato:

- [ ] **Reconocimiento técnico (1 tarde):** verificar qué expone cada una de las 4 tiendas — JSON-LD, sitemap.xml, feed de Merchant Center, robots.txt, protección Cloudflare.
- [ ] **Esquema Postgres mínimo** (`stores`, `products`, `store_products`, `price_points`, `subscriptions`, `users`) en Supabase.
- [ ] **Scraper de 1 tienda + 20 SKUs** corriendo en cron simple; validar robustez de JSON-LD.
- [ ] **Conversación con el empleador** sobre el proyecto (antes de hacerlo público).

---

*Generado con Claude a partir de brainstorming estructurado (divergencia → clustering → convergencia). Recomendación final: empezar el colector de datos de inmediato — cada semana sin capturar es histórico que no existirá.*