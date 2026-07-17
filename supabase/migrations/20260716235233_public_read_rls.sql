-- Public read RLS for catalog/price tables (applied remotely as public_read_rls).
-- UI anon puede SELECT; escrituras solo service_role.

alter table stores enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table store_products enable row level security;
alter table price_points enable row level security;

create policy public_read_stores on stores for select to public using (true);
create policy public_read_products on products for select to public using (true);
create policy public_read_product_variants on product_variants for select to public using (true);
create policy public_read_store_products on store_products for select to public using (true);
create policy public_read_price_points on price_points for select to public using (true);
