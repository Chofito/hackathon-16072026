-- Seed: 4 tiendas + ~20 SKUs iniciales del nicho tech/gaming (docs/TASKS.md, fase 1).
-- El ean_gtin queda null a proposito: se completa durante el recon/curacion manual.

insert into stores (name, base_url, platform, active) values
  ('MAX', 'https://www.max.com.gt', 'magento', true),
  ('Kemik', 'https://www.kemik.gt', 'unknown', true),
  ('Pacifiko', 'https://pacifiko.com', 'unknown', true),
  ('Curacao', 'https://www.lacuracaonline.com/guatemala', 'unknown', true);

insert into products (canonical_name, brand, model, category) values
  -- Consolas
  ('Nintendo Switch 2', 'Nintendo', 'Switch 2', 'consolas'),
  ('Nintendo Switch OLED', 'Nintendo', 'Switch OLED', 'consolas'),
  ('PlayStation 5 Slim', 'Sony', 'PS5 Slim', 'consolas'),
  ('PlayStation 5 Pro', 'Sony', 'PS5 Pro', 'consolas'),
  ('Xbox Series X', 'Microsoft', 'Series X', 'consolas'),
  ('Xbox Series S', 'Microsoft', 'Series S', 'consolas'),
  ('Steam Deck OLED', 'Valve', 'Steam Deck OLED', 'consolas'),
  -- GPUs
  ('NVIDIA GeForce RTX 5090', 'NVIDIA', 'RTX 5090', 'gpus'),
  ('NVIDIA GeForce RTX 5080', 'NVIDIA', 'RTX 5080', 'gpus'),
  ('NVIDIA GeForce RTX 5070 Ti', 'NVIDIA', 'RTX 5070 Ti', 'gpus'),
  ('NVIDIA GeForce RTX 5070', 'NVIDIA', 'RTX 5070', 'gpus'),
  ('AMD Radeon RX 9070 XT', 'AMD', 'RX 9070 XT', 'gpus'),
  -- Celulares
  ('Apple iPhone 16 Pro Max', 'Apple', 'iPhone 16 Pro Max', 'celulares'),
  ('Apple iPhone 16 Pro', 'Apple', 'iPhone 16 Pro', 'celulares'),
  ('Apple iPhone 16', 'Apple', 'iPhone 16', 'celulares'),
  ('Samsung Galaxy S25 Ultra', 'Samsung', 'Galaxy S25 Ultra', 'celulares'),
  ('Samsung Galaxy S25 Plus', 'Samsung', 'Galaxy S25 Plus', 'celulares'),
  ('Samsung Galaxy S25', 'Samsung', 'Galaxy S25', 'celulares'),
  ('Xiaomi 15 Pro', 'Xiaomi', '15 Pro', 'celulares'),
  ('Google Pixel 9 Pro', 'Google', 'Pixel 9 Pro', 'celulares');
