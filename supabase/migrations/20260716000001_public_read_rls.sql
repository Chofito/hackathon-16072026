-- Lectura pública para la UI (cliente anon). Escrituras siguen en service role
-- (collector, edge functions). Ver docs/USER_FLOW.md.

alter table stores enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table store_products enable row level security;
alter table price_points enable row level security;

create policy "public_read_stores"
  on stores for select
  using (true);

create policy "public_read_products"
  on products for select
  using (true);

create policy "public_read_product_variants"
  on product_variants for select
  using (true);

create policy "public_read_store_products"
  on store_products for select
  using (true);

create policy "public_read_price_points"
  on price_points for select
  using (true);
