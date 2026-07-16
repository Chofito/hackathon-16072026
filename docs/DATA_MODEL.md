# Modelo de datos

> Esquema mínimo en Supabase (Postgres). El dataset histórico + el catálogo canónico son el activo del proyecto; este esquema está diseñado para sobrevivir la migración futura a event-driven sin rehacer datos.

## 1. Diagrama entidad-relación

```mermaid
erDiagram
    stores ||--o{ store_products : "tiene"
    products ||--o{ store_products : "se vende como"
    store_products ||--o{ price_points : "genera"
    products ||--o{ product_variants : "tiene"
    users ||--o{ subscriptions : "crea"
    users ||--o{ notification_channels : "registra"
    products ||--o{ subscriptions : "es objetivo de"
    store_products ||--o{ match_review_queue : "pendiente de"

    stores {
        uuid id PK
        text name
        text base_url
        text platform
        text kind
        text currency
        boolean active
        timestamptz created_at
    }

    products {
        uuid id PK
        text canonical_name
        text brand
        text model
        text ean_gtin
        text category
        timestamptz created_at
    }

    product_variants {
        uuid id PK
        uuid product_id FK
        text variant_type
        text variant_value
    }

    store_products {
        uuid id PK
        uuid store_id FK
        uuid product_id FK
        text store_sku
        text url
        text raw_name
        boolean active
        timestamptz first_seen_at
        timestamptz last_seen_at
    }

    price_points {
        bigint id PK
        uuid store_product_id FK
        numeric price
        numeric list_price
        numeric conditional_price
        text conditional_price_note
        text currency
        text stock_status
        timestamptz captured_at
    }

    users {
        uuid id PK
        text email
        timestamptz created_at
    }

    subscriptions {
        uuid id PK
        uuid user_id FK
        uuid product_id FK
        numeric target_price
        boolean active
        timestamptz created_at
    }

    notification_channels {
        uuid id PK
        uuid user_id FK
        text type
        text address
        boolean verified
        timestamptz created_at
    }

    match_review_queue {
        uuid id PK
        uuid store_product_id FK
        text raw_name
        text suggested_product_id
        text status
        timestamptz created_at
    }
```

## 2. Entidades

### `stores` — tiendas trackeadas

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | MAX, Kemik, Pacifiko, Curacao, Amazon |
| `base_url` | `text` | ej. `https://www.max.com.gt` |
| `platform` | `text` | Magento, VTEX, OpenCart, custom, `pa-api`… (sale del recon técnico) |
| `kind` | `text` | `local` (tienda GT comparable) o `reference` (ancla de precio, ej. Amazon). El comparador nunca mezcla `reference` en el ranking de precio más barato |
| `currency` | `text` | moneda por defecto de la fuente: `GTQ` para tiendas locales, `USD` para Amazon. Cada `price_point` la reconfirma |
| `active` | `boolean` | permite pausar una tienda sin borrar datos |
| `created_at` | `timestamptz` | |

Amazon se modela como un `store` con `kind = 'reference'` y `currency = 'USD'`. Sus `store_products.store_sku` guardan el `ASIN`. Se captura por API oficial (PA-API), no scraping — ver [SCRAPING.md](SCRAPING.md) §4.

### `products` — catálogo canónico (el moat)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `canonical_name` | `text` | nombre normalizado, ej. "Nintendo Switch 2" |
| `brand` | `text` | |
| `model` | `text` | |
| `ean_gtin` | `text` nullable | clave de matching cuando existe; único si no es null |
| `category` | `text` | consolas, GPUs, celulares… |
| `created_at` | `timestamptz` | |

Arranca con ~300 SKUs curados a mano (nicho tech/gaming).

### `product_variants` — variantes que rompen el matching 1:1

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `product_id` | `uuid` FK → products | |
| `variant_type` | `text` | `color`, `storage`, `edition`… |
| `variant_value` | `text` | `256GB`, `OLED`, `blanco`… |

Un `store_product` puede apuntar a un producto base cuya variante exacta se captura aquí. Evita inflar el catálogo canónico con un producto por color.

### `store_products` — mapeo tienda → catálogo canónico

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `store_id` | `uuid` FK → stores | |
| `product_id` | `uuid` FK → products, nullable | null = aún sin matchear (está en cola de revisión) |
| `store_sku` | `text` | SKU interno de la tienda |
| `url` | `text` | URL de producto (viene del sitemap) |
| `raw_name` | `text` | nombre tal como lo publica la tienda, ej. "NINTENDO SWITCH 2 NSW2-001" |
| `active` | `boolean` | la tienda dejó de listar el producto |
| `first_seen_at` / `last_seen_at` | `timestamptz` | ciclo de vida del listado |

Único por `(store_id, store_sku)`.

### `price_points` — serie de tiempo (append-only)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` PK (identity) | volumen alto, no necesita uuid |
| `store_product_id` | `uuid` FK → store_products | |
| `price` | `numeric(12,2)` | precio de venta real al momento de captura |
| `list_price` | `numeric(12,2)` nullable | precio "de lista" tachado; null si no hay descuento |
| `conditional_price` | `numeric(12,2)` nullable | precio con condición (descuento de banco, cupón) |
| `conditional_price_note` | `text` nullable | ej. "pagando con BAC" |
| `currency` | `text` | `GTQ` por defecto |
| `stock_status` | `text` | ver estados abajo |
| `captured_at` | `timestamptz` | momento de captura |

**Estados de `stock_status`** — sin stock y no capturado son cosas distintas:

- `in_stock` — disponible.
- `out_of_stock` — la tienda lo lista pero sin stock (el precio puede seguir siendo válido como referencia).
- `unknown` — se capturó precio pero la disponibilidad no era legible.

Si un ciclo de scraping **no logra capturar** un producto, **no se inserta fila** — la ausencia de fila en ese ciclo es el estado "no capturado". Nunca inventar un `price_point` para marcar un fallo.

### `users`, `subscriptions`, `notification_channels` — capa de alertas (fase posterior)

| Tabla | Propósito |
|---|---|
| `users` | identidad (email; auth vía Supabase) |
| `subscriptions` | qué quiere: `product_id` + `target_price` + `active` |
| `notification_channels` | cómo contactarlo: `type` (`messaging` / `email` / `web_push`) + `address` (chat id, email, endpoint push) + `verified` |

Separar suscripción de canal permite agregar canales sin tocar las suscripciones. Las tablas se crean desde el inicio; los adaptadores de entrega se implementan después.

### `match_review_queue` — cola de revisión manual

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `store_product_id` | `uuid` FK → store_products | |
| `raw_name` | `text` | copia para revisar sin joins |
| `suggested_product_id` | `uuid` nullable | sugerencia del matcher automático si la hubo |
| `status` | `text` | `pending` / `matched` / `new_product` / `ignored` |
| `created_at` | `timestamptz` | |

## 3. Índices clave

```sql
-- La consulta dominante: histórico de un producto en una tienda
CREATE INDEX idx_price_points_series
  ON price_points (store_product_id, captured_at DESC);

-- Matching por EAN
CREATE UNIQUE INDEX idx_products_ean ON products (ean_gtin) WHERE ean_gtin IS NOT NULL;

-- Lookup de scraper: ¿ya conozco este SKU de esta tienda?
CREATE UNIQUE INDEX idx_store_products_sku ON store_products (store_id, store_sku);

-- Cola de revisión pendiente
CREATE INDEX idx_review_pending ON match_review_queue (status) WHERE status = 'pending';
```

## 4. Notas de crecimiento

- **Volumen estimado MVP:** ~300 SKUs × 4 tiendas × 2-4 capturas/día ≈ 2,400–4,800 filas/día en `price_points` (~1.5M filas/año). Postgres plano con el índice de serie lo maneja sin problema.
- **No ahora:** TimescaleDB, particionado por fecha, y agregados materializados quedan como optimización futura; el disparador es que las consultas de histórico se degraden, no una fecha.
- **Append-only:** `price_points` nunca se actualiza ni borra. Correcciones de matching se hacen re-apuntando `store_products.product_id`, no tocando la serie.
