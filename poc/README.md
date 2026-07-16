# POC — matching cross-store

Prueba de concepto de la tesis central del colector: **dada la URL de un producto
en una tienda conocida, extraer su información identificable y encontrar el mismo
producto en las demás tiendas** (ver [../docs/SCRAPING.md](../docs/SCRAPING.md) §6.4 y §7).

## Qué hace

1. **Extrae** de la URL fuente los identificadores (JSON-LD / microdata / `__NEXT_DATA__`
   en MAX): nombre, marca, SKU, GTIN (si existe), precio.
2. **Descubre** candidatos en cada tienda destino (todas excepto la origen) vía
   **sitemap de producto** — rankeando URLs por tokens del nombre. La marca ancla
   el match; tokens de modelo (`a56`, `x8`, dígito de versión) se penalizan si faltan.
3. **Confirma** los mejores candidatos scrapeando la página. Si el fuente tiene
   EAN/GTIN y el candidato coincide → score 1.0.
4. Imprime la comparación y escribe `poc-report.json`.

**No usa** `/search?q=…` ni los buscadores HTML de las tiendas: MAX lo prohíbe en
`robots.txt` (`Disallow: /search?q*`); Kemik es CSR; Pacifiko/Curacao también restringen
búsqueda. El sitemap es la fuente permitida, estable y completa. Ver
[../docs/SCRAPING.md](../docs/SCRAPING.md) §6.4.

## Correr

```bash
bun run poc/find-matches.ts                       # producto MAX de ejemplo
bun run poc/find-matches.ts "https://www.max.com.gt/<otro-producto>"
bun run poc/find-matches.ts --max-sitemaps 6      # escaneo parcial (más rápido)
```

Cross-runtime (Bun o Deno): APIs `node:` + `fetch`, sin dependencias.

## Notas de cortesía

- User-agent identificable, pausa entre requests (2.5 s producto, 0.5 s sitemap) y
  **cache en disco** (`.cache/`). Nunca intenta evadir un challenge/WAF.
- Primera corrida completa ~2 min (Pacifiko ~98 sitemaps); luego casi todo cacheado.

## Confianza del match

- `✓ match` — score ≥ 0.85 (o EAN exacto).
- `? revisar` — bajo el umbral → iría a `match_review_queue`.

## Resultados de referencia

Ver [../examples/cross-store-report.md](../examples/cross-store-report.md) (corrida
2026-07-16: Switch 2 USA, Galaxy A56, Poco X8, Whirlpool). Capturas crudas en
[../examples/captures/](../examples/captures/).

## Qué NO es

No inserta en Supabase ni corre en cron. El código de extracción/scoring es el
germen de `@pgt/scrapers` + matching; un futuro `Scraper.search(query)` debería
reutilizar este flujo (sitemap + tokens), no el buscador HTML.
