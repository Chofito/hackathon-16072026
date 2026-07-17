-- Cache de URLs de producto por tienda (sitemaps).
-- Lo llena `bun run refresh-sitemaps`; lo lee la Edge Function find-matches.
-- No expuesto al cliente: RLS sin policies para anon/authenticated.

create table sitemap_urls (
  store_key text not null,
  url text not null,
  refreshed_at timestamptz not null default now(),
  primary key (store_key, url)
);

create index idx_sitemap_urls_store on sitemap_urls (store_key);
create index idx_sitemap_urls_refreshed on sitemap_urls (store_key, refreshed_at desc);

alter table sitemap_urls enable row level security;
-- Sin policies: solo service_role (bypassa RLS) escribe/lee.
