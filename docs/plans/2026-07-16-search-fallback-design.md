# Search fallback en `find-matches`

> Diseño validado 2026-07-16. Complementa [2026-07-16-edge-on-demand-design.md](2026-07-16-edge-on-demand-design.md).

## Goal

Cuando el ranking sobre `sitemap_urls` no produce candidatos en una tienda destino, usar el buscador HTML de esa tienda como fallback (`Scraper.search`), con query tokenizada del nombre fuente.

## Decisión

- **Modo:** fallback (no reemplaza sitemap).
- **Query:** tokens del `rawName` fuente unidos por espacio (misma tokenización que el scoring).
- **Cortesía:** mismo UA + delay. Las búsquedas se tratan como tráfico legítimo; se permite `/search` aunque robots lo marque `Disallow` (excepción explícita a §6.4 previo).
- **MVP tiendas:** MAX primero (`/search?q=` + `productsList` en `__NEXT_DATA__`). Otras tiendas: `search` retorna `[]` hasta que haya parser estable.

## Flujo por tienda destino

1. Rankear `sitemap_urls` (umbral `MIN_SLUG_SCORE`).
2. Si hay candidatos → confirmar con `fetchOne` (igual que hoy).
3. Si no → `scraper.search(query, ctx)` → rankear URLs → `fetchOne` top-N.
4. Sin resultados → `matches[key] = []`.

## API

```ts
interface Scraper {
  // ...
  search(query: string, ctx: ScrapeContext): Promise<string[]>
}
```

MAX: `GET https://www.max.com.gt/search?q=<encodeURIComponent(query)>` → URLs `https://www.max.com.gt/<slug>`.
