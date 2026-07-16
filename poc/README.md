# POC — matching cross-store

Prueba de concepto de la tesis central del colector: **dada la URL de un producto
en una tienda conocida, extraer su información identificable y encontrar el mismo
producto en las demás tiendas** (ver [../docs/SCRAPING.md](../docs/SCRAPING.md) §7).

## Qué hace

1. **Extrae** de la URL fuente (por defecto MAX) los identificadores vía JSON-LD:
   nombre, marca, SKU, GTIN (si existe), precio.
2. **Descubre** candidatos en cada tienda destino descargando su **sitemap de
   producto** (permitido por `robots.txt`) y rankeando las URLs por coincidencia
   de tokens del nombre — la marca ancla el match.
3. **Confirma** los mejores candidatos descargando su página y extrayendo su
   JSON-LD / microdata (precio, SKU, GTIN, disponibilidad).
4. Imprime la comparación y escribe `poc-report.json`.

No usa los buscadores internos de las tiendas: Kemik los renderiza en el cliente
(no sirven con `fetch` plano) y `robots.txt` de Curacao/Pacifiko prohíbe sus rutas
de búsqueda. El sitemap es la fuente permitida, estable y completa.

## Correr

Con **Bun** (lo que tienes instalado):

```bash
bun run poc/find-matches.ts                       # producto MAX de ejemplo
bun run poc/find-matches.ts "https://www.max.com.gt/<otro-producto>"
bun run poc/find-matches.ts --max-sitemaps 6      # escaneo parcial (más rápido)
```

Con **Deno** (runtime de las Edge Functions on-demand), es idéntico:

```bash
deno run -A poc/find-matches.ts
```

El script es cross-runtime: usa solo APIs `node:` + `fetch`, sin dependencias. La
lógica de extracción JSON-LD replica la de `@pgt/core` (`packages/core`); en Fase 1
el POC puede migrarse a importar de ese paquete en vez de duplicarla.

## Notas de cortesía

- User-agent identificable, pausa entre requests (2.5 s a páginas de producto,
  0.5 s a sitemaps) y **cache en disco** (`.cache/`): las corridas repetidas no
  vuelven a golpear la red. Nunca intenta evadir un challenge/WAF.
- La primera corrida completa tarda ~2 min (Pacifiko tiene 98 sitemaps, ~1M URLs);
  después queda casi todo cacheado. Usa `--max-sitemaps N` para acotar.

## Confianza del match

El top de cada tienda se etiqueta según el score de tokens:

- `✓ match` — score ≥ 0.85: coincidencia confiable.
- `? revisar` — bajo el umbral: iría a `match_review_queue`. **Un match incorrecto
  es peor que un match faltante** (docs/SCRAPING.md §7), así que en duda no se afirma.

## Resultado esperado (dos ejemplos)

**Switch 2 + Mario Kart World** (bundle) — existe en las 4, match confiable:

| Tienda   | Precio         | GTIN en la página | Fuente     |
|----------|----------------|-------------------|------------|
| MAX      | Q6,796         | no                | JSON-LD    |
| Pacifiko | Q5,995 (HK)    | no                | JSON-LD    |
| Curacao  | Q5,997         | sí (EAN-13)       | JSON-LD    |
| Kemik    | Q6,512         | no                | microdata  |

**Switch 2 USA** (consola sola) — solo Pacifiko la tiene; Curacao/Kemik solo
venden accesorios, así que se marcan `? revisar` en vez de forzar un match:

| Tienda   | Resultado               |
|----------|-------------------------|
| Pacifiko | `✓ match` Q5,399        |
| Curacao  | `? revisar` (accesorios)|
| Kemik    | `? revisar` (accesorios)|

Confirma lo documentado: 3 de 4 dan precio server-side en JSON-LD, solo Curacao
expone GTIN, el matching por marca+modelo funciona sin GTIN, y el token de variante
("2") distingue Switch 2 de Switch/Lite/OLED.

## Qué NO es

Es un POC de una sola pieza (extracción + matching). No inserta en Supabase, no
normaliza contra el catálogo canónico ni corre en cron. Eso es la Fase 1 (ver
[../docs/TASKS.md](../docs/TASKS.md)). El código de `lib.ts` (extracción JSON-LD /
microdata, tokenización, scoring) sí es el germen reutilizable de los módulos por
tienda.
