-- Esquema inicial — Plataforma de inteligencia de precios (docs/DATA_MODEL.md).
-- Principio: price_points es append-only; el historico + el catalogo canonico son el activo.

create extension if not exists "pgcrypto";

-- stores — tiendas trackeadas
create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  platform text not null default 'unknown',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- products — catalogo canonico (el moat)
create table products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  brand text not null default '',
  model text not null default '',
  ean_gtin text,
  category text not null default '',
  created_at timestamptz not null default now()
);

-- Matching por EAN: unico cuando no es null
create unique index idx_products_ean on products (ean_gtin) where ean_gtin is not null;

-- product_variants — variantes que rompen el matching 1:1
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  variant_type text not null,
  variant_value text not null
);

-- store_products — mapeo tienda -> catalogo canonico
create table store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  store_sku text not null,
  url text not null,
  raw_name text not null,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Lookup del scraper: ¿ya conozco este SKU de esta tienda?
create unique index idx_store_products_sku on store_products (store_id, store_sku);

-- price_points — serie de tiempo (append-only)
create table price_points (
  id bigint generated always as identity primary key,
  store_product_id uuid not null references store_products (id) on delete cascade,
  price numeric(12, 2) not null,
  list_price numeric(12, 2),
  conditional_price numeric(12, 2),
  conditional_price_note text,
  currency text not null default 'GTQ',
  stock_status text not null default 'unknown',
  captured_at timestamptz not null default now()
);

-- La consulta dominante: historico de un producto en una tienda
create index idx_price_points_series on price_points (store_product_id, captured_at desc);

-- users — identidad (auth via Supabase; espejo minimo)
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- subscriptions — que quiere el usuario
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  target_price numeric(12, 2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- notification_channels — como contactarlo
create table notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null,
  address text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- match_review_queue — cola de revision manual
create table match_review_queue (
  id uuid primary key default gen_random_uuid(),
  store_product_id uuid not null references store_products (id) on delete cascade,
  raw_name text not null,
  suggested_product_id uuid references products (id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index idx_review_pending on match_review_queue (status) where status = 'pending';

-- product_requests — cola on-demand (lo que un usuario pide traer desde una tienda)
create table product_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores (id) on delete set null,
  url text,
  sku text,
  status text not null default 'pending',
  requested_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_product_requests_pending on product_requests (status) where status = 'pending';
