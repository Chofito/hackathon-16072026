# Design Brief: Plataforma de inteligencia de precios ecommerce Guatemala

> Documento de handoff generado a partir de una sesión de brainstorming estructurado (2026-07-16).
> Contiene contexto, decisiones tomadas, alternativas descartadas y próximos pasos.
> Pensado para retomarse en otro harness (Claude Code u otro agente) sin contexto previo.

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
- **Tiendas:** MAX, Kemik, Pacifiko, Curacao + 1 adicional (5 total).
- **Frecuencia de captura:** cada 6–12 horas (suficiente para histórico de precios).
- **Alertas MVP:** Telegram (costo cero); migrar a WhatsApp Business API cuando haya tracción.

## 4. Arquitectura recomendada

**Opción elegida: colector cloud ligero + Postgres gestionado desde el día uno.**

Pipeline de cinco piezas: **colección → normalización/matching → almacenamiento temporal → alertas → producto (web/API)**.

- **Colección:** scrapers en Python o TypeScript ejecutados como jobs programados (GitHub Actions cron, o mini PC propio como worker). Desacoplados del producto: el dataset crece aunque el frontend no exista.
- **Almacenamiento:** Postgres gestionado (Neon o Supabase, free tier). Serie de tiempo simple: tabla `price_points` con índices adecuados llega lejos antes de necesitar TimescaleDB.
- **Producto (fase posterior):** Next.js (frontend) + NestJS (API) — stack ya dominado por el autor.
- **Migración futura:** todo lo anterior migra sin rehacer datos a una plataforma event-driven (NestJS + BullMQ + Redis + Timescale + multi-tenancy) cuando el SaaS tenga clientes.

### Esquema de datos mínimo

```
stores          (id, name, base_url, platform, ...)
products        (id, canonical_name, brand, model, ean_gtin, category, ...)   -- catálogo canónico
store_products  (id, store_id, product_id, store_sku, url, raw_name, ...)     -- mapeo tienda→canónico
price_points    (id, store_product_id, price, list_price, currency,
                 in_stock, captured_at)                                        -- serie de tiempo
alerts          (id, user_id, product_id, target_price, channel, active, ...)
users           (id, email/telegram_id, ...)
```

Índice clave: `price_points (store_product_id, captured_at DESC)`.

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
4. Usuario suscribe alerta (producto + precio objetivo) → job evalúa en cada ingesta → notifica por Telegram/WhatsApp.
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

## 8. Preguntas abiertas

- ¿Telegram o WhatsApp Business API para el MVP de alertas? (costo por conversación vs. adopción local)
- ¿Curación manual del catálogo canónico al inicio, o inversión temprana en matching automático?
- ¿Términos con el empleador por escrito? (bloqueante para lanzamiento público, no para el prototipo privado)
- ¿Quinta tienda a incluir? (candidatas: Intelaf, Tecnofácil, El Duende, Cemaco según nicho)

## 9. Próximos pasos

- [ ] **Reconocimiento técnico (1 tarde):** verificar qué expone cada tienda — JSON-LD, sitemap.xml, feed de Merchant Center, robots.txt, protección Cloudflare.
- [ ] **Esquema Postgres mínimo** (`stores`, `products`, `store_products`, `price_points`, `alerts`, `users`) en Neon/Supabase.
- [ ] **Scraper de 1 tienda + 20 SKUs** corriendo en cron este fin de semana; validar robustez de JSON-LD.
- [ ] **Conversación con el empleador** sobre el proyecto (antes de hacerlo público).
- [ ] Definir canal de alertas del MVP (Telegram recomendado para empezar).

---

*Generado con Claude a partir de brainstorming estructurado (divergencia → clustering → convergencia). Recomendación final: empezar el colector de datos de inmediato — cada semana sin capturar es histórico que no existirá.*