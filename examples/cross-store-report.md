# Búsqueda cross-store (sin LLM)

Corrida 2026-07-16 con `bun run poc/find-matches.ts <url>`.
Estrategia: sitemap → rank por tokens del nombre → confirmar con scrape de la página.
SKU interno **no cruza** entre tiendas; EAN sí cuando ambas lo publican.

## Cómo buscar (sin LLM)

| Capa | ¿Funciona cross-store? | Notas |
| --- | --- | --- |
| SKU de tienda (`NSW2US`, `B8A580B21D`, `1343276`) | No | Cada tienda tiene el suyo |
| EAN/GTIN | Sí, cuando existe | MAX y Curacao lo publican; Kemik/Pacifiko no |
| Nombre (marca + modelo + specs) | Sí | Sitemap + score de tokens; sin LLM ni buscador HTML (robots/CSR) |

Los buscadores internos de las tiendas **no se usan**: Kemik es CSR; Curacao/Pacifiko los prohíben en robots.txt.

## Resultados por producto fuente

### 1. Nintendo Switch 2 Versión USA — MAX Q6,499 (EAN `045496885816`)

| Tienda | Resultado | Precio | Nota |
| --- | --- | --- | --- |
| Pacifiko | ✓ match | Q5,399 | Consola USA negra sin bundle |
| Curacao | sin consola USA | — | Tienen edición HK (otra región); solo salieron accesorios |
| Kemik | sin consola | — | Accesorios/juegos Switch 2, no la consola |

### 2. Samsung Galaxy A56 5G 256GB Negro — MAX Q3,096 (EAN `8806097408109`)

| Tienda | Resultado | Precio | Nota |
| --- | --- | --- | --- |
| Pacifiko | ✓ match | Q2,995 | Negro 12GB/256GB (sin stock). El Olive 8GB de la URL del usuario es **otra variante** |
| Curacao | ? revisar | Q3,097 | Mismo modelo, colores Olive/Gray/Graphite (EAN distinto por color) |
| Kemik | ✓ match | Q3,481 | A56 8GB Grafito. La URL del usuario (12GB Grafito Q3,447) es variante cercana |

### 3. Xiaomi Poco X8 Pro Max 12GB/512GB Negro — Kemik Q4,449

| Tienda | Resultado | Precio | Nota |
| --- | --- | --- | --- |
| Pacifiko | ✓ match | Q4,449 | Mismo precio, Dual SIM negro |
| MAX | sin candidatos | — | No aparece en sitemap / catálogo |
| Curacao | sin candidatos | — | No aparece en sitemap |

### 4. Lavadora Whirlpool Superior 19 kg — Pacifiko Q4,999

| Tienda | Resultado | Precio | Nota |
| --- | --- | --- | --- |
| Kemik | ? revisar | Q4,399 | Whirlpool 18 kg (modelo distinto) |
| MAX | sin candidatos | — | |
| Curacao | sin candidatos | — | |

## Regenerar

```bash
bun run poc/find-matches.ts "https://www.max.com.gt/<producto>"
```
