-- =============================================================================
-- DEMO ONLY — datos sintéticos para desarrollo local de la UI
-- =============================================================================
-- NO son capturas reales del scraper. Solo para que el equipo vea el comparador
-- y el home con precios mientras se implementan las edge functions.
--
-- Cargar después del seed base:
--   bun run db:seed-demo
-- o incluido automáticamente en `bun run db:reset` (ver supabase/config.toml).
-- =============================================================================

-- Idempotencia: si se vuelve a correr, limpia el demo anterior
delete from price_points
where store_product_id in (
  select id from store_products where store_sku like '%-DEMO-%'
);
delete from product_requests where sku like '%-DEMO-%';
delete from store_products where store_sku like '%-DEMO-%';
delete from product_variants
where product_id in (select id from products where canonical_name = 'Apple iPhone 16 Pro Max');

-- Variantes de ejemplo (iPhone 16 Pro Max)
insert into product_variants (product_id, variant_type, variant_value)
select p.id, 'storage', v.storage
from products p
cross join (values ('256GB'), ('512GB'), ('1TB')) as v(storage)
where p.canonical_name = 'Apple iPhone 16 Pro Max';

-- Mapeos tienda → catálogo (URLs ficticias, claramente de demo)
with demo_products as (
  select id, canonical_name
  from products
  where canonical_name in (
    'Nintendo Switch 2',
    'PlayStation 5 Slim',
    'NVIDIA GeForce RTX 5070',
    'Apple iPhone 16 Pro Max',
    'Steam Deck OLED'
  )
),
demo_stores as (
  select id, name, base_url from stores where active = true
),
-- Cobertura completa en las 4 tiendas
full_coverage as (
  select p.id as product_id, s.id as store_id, s.name as store_name, s.base_url, p.canonical_name
  from demo_products p
  cross join demo_stores s
  where p.canonical_name in (
    'Nintendo Switch 2',
    'PlayStation 5 Slim',
    'NVIDIA GeForce RTX 5070',
    'Apple iPhone 16 Pro Max'
  )
),
-- Cobertura parcial: solo MAX y Kemik con precio; Pacifiko sin precio aún; Curacao sin mapeo
partial_coverage as (
  select p.id as product_id, s.id as store_id, s.name as store_name, s.base_url, p.canonical_name
  from demo_products p
  join demo_stores s on s.name in ('MAX', 'Kemik', 'Pacifiko')
  where p.canonical_name = 'Steam Deck OLED'
),
all_mappings as (
  select * from full_coverage
  union all
  select * from partial_coverage
)
insert into store_products (store_id, product_id, store_sku, url, raw_name)
select
  store_id,
  product_id,
  upper(replace(store_name, ' ', '')) || '-DEMO-' || left(md5(canonical_name || store_name), 6),
  rtrim(base_url, '/') || '/demo/' || lower(replace(canonical_name, ' ', '-')),
  upper(canonical_name) || ' [DEMO]'
from all_mappings
on conflict (store_id, store_sku) do nothing;

-- Precios base por producto y tienda (GTQ, julio 2026 — inventados para UI)
with price_matrix (
  canonical_name, store_name, base_price, list_price, conditional_price, conditional_note, stock_status
) as (
  values
    -- Nintendo Switch 2
    ('Nintendo Switch 2', 'MAX',       5499.00, 5999.00, null::numeric, null::text, 'in_stock'),
    ('Nintendo Switch 2', 'Kemik',     5599.00, null,    null,          null,        'in_stock'),
    ('Nintendo Switch 2', 'Pacifiko',  5399.00, 5799.00, 5199.00,       'pagando con BAC', 'in_stock'),
    ('Nintendo Switch 2', 'Curacao',   5699.00, null,    null,          null,        'out_of_stock'),
    -- PlayStation 5 Slim
    ('PlayStation 5 Slim', 'MAX',      4499.00, 4799.00, null, null, 'in_stock'),
    ('PlayStation 5 Slim', 'Kemik',    4599.00, null,    null, null, 'in_stock'),
    ('PlayStation 5 Slim', 'Pacifiko', 4399.00, null,    4199.00, 'con tarjeta Bi', 'in_stock'),
    ('PlayStation 5 Slim', 'Curacao',  4699.00, 4999.00, null, null, 'in_stock'),
    -- RTX 5070
    ('NVIDIA GeForce RTX 5070', 'MAX',      7299.00, null, null, null, 'in_stock'),
    ('NVIDIA GeForce RTX 5070', 'Kemik',    7499.00, 7999.00, null, null, 'in_stock'),
    ('NVIDIA GeForce RTX 5070', 'Pacifiko', 7199.00, null, null, null, 'in_stock'),
    ('NVIDIA GeForce RTX 5070', 'Curacao',  7599.00, null, 7399.00, 'transferencia', 'unknown'),
    -- iPhone 16 Pro Max
    ('Apple iPhone 16 Pro Max', 'MAX',      13499.00, 13999.00, null, null, 'in_stock'),
    ('Apple iPhone 16 Pro Max', 'Kemik',    13299.00, null,     12999.00, 'pagando con BAC', 'in_stock'),
    ('Apple iPhone 16 Pro Max', 'Pacifiko', 13349.00, null,     null, null, 'in_stock'),
    ('Apple iPhone 16 Pro Max', 'Curacao',  13599.00, 14199.00, null, null, 'in_stock'),
    -- Steam Deck OLED — solo MAX y Kemik (estado parcial en comparador)
    ('Steam Deck OLED', 'MAX',   4299.00, 4599.00, null, null, 'in_stock'),
    ('Steam Deck OLED', 'Kemik', 4399.00, null,    null, null, 'in_stock')
),
latest_captures as (
  select
    sp.id as store_product_id,
    pm.base_price,
    pm.list_price,
    pm.conditional_price,
    pm.conditional_note,
    pm.stock_status
  from store_products sp
  join products p on p.id = sp.product_id
  join stores s on s.id = sp.store_id
  join price_matrix pm on pm.canonical_name = p.canonical_name and pm.store_name = s.name
)
insert into price_points (
  store_product_id, price, list_price, conditional_price, conditional_price_note,
  currency, stock_status, captured_at
)
select
  lc.store_product_id,
  lc.base_price,
  lc.list_price,
  lc.conditional_price,
  lc.conditional_note,
  'GTQ',
  lc.stock_status,
  now() - interval '2 hours'
from latest_captures lc;

-- Histórico sintético (~14 días) para productos con cobertura completa — variación leve
with history_targets as (
  select sp.id as store_product_id, pm.base_price
  from store_products sp
  join products p on p.id = sp.product_id
  join stores s on s.id = sp.store_id
  join (
    values
      ('Nintendo Switch 2', 'MAX', 5499.00),
      ('Nintendo Switch 2', 'Pacifiko', 5399.00),
      ('PlayStation 5 Slim', 'Pacifiko', 4399.00),
      ('NVIDIA GeForce RTX 5070', 'MAX', 7299.00),
      ('Apple iPhone 16 Pro Max', 'Kemik', 13299.00)
  ) as pm(canonical_name, store_name, base_price)
    on pm.canonical_name = p.canonical_name and pm.store_name = s.name
),
days as (
  select generate_series(1, 13) as day_offset
)
insert into price_points (store_product_id, price, currency, stock_status, captured_at)
select
  ht.store_product_id,
  round((ht.base_price + (random() * 300 - 150))::numeric, 2),
  'GTQ',
  'in_stock',
  now() - (d.day_offset || ' days')::interval
from history_targets ht
cross join days d;

-- Cola on-demand de ejemplo: Curacao pendiente para Steam Deck (estado parcial)
insert into product_requests (store_id, url, sku, status, requested_by)
select
  s.id,
  'https://www.lacuracaonline.com/guatemala/demo/steam-deck-oled',
  'CURACAO-DEMO-STEAM',
  'pending',
  null
from stores s
where s.name = 'Curacao'
  and not exists (
    select 1 from product_requests pr
    where pr.store_id = s.id and pr.sku = 'CURACAO-DEMO-STEAM'
  );
