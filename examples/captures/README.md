# Capturas de ejemplo (`RawCapture`)

Salida real de los scrapers de `@pgt/scrapers` contra páginas de producto en
vivo (2026-07-16), en el formato `RawCapture` de `@pgt/core` — el contrato de
salida de todo scraper según [docs/SCRAPING.md](../../docs/SCRAPING.md) §2.
Es lo que `@pgt/ingest` recibe antes de matchear e insertar `price_points`.

## Regenerar

```bash
bun run examples                 # las URLs por defecto (MAX, Kemik, Pacifiko)
bun run scripts/capture-examples.ts <url> [url...]   # URLs específicas
```

Los requests son secuenciales, con user-agent identificable y pausa de
cortesía (3 s por default, `SCRAPER_MIN_DELAY_MS` para ajustar).

## Qué demuestra cada archivo

| Archivo | Tienda | Táctica | Nota |
| --- | --- | --- | --- |
| `max-nsw2us.json` | MAX | `__NEXT_DATA__` | `eanGtin` (EAN-13) + `listPrice` de `regularPrice` |
| `max-sma566ezk15.json` | MAX | `__NEXT_DATA__` | ídem, con descuento activo |
| `kemik-b8a580b21d.json` | Kemik | microdata + OG + `<h1>` | sin JSON-LD; `listPrice` del texto tachado |
| `kemik-b221161a27.json` | Kemik | microdata + OG + `<h1>` | ídem |
| `pacifiko-1343276.json` | Pacifiko | JSON-LD | URL canónica de `offers.url` (sin tracking) |
| `pacifiko-230949.json` | Pacifiko | JSON-LD | ídem |
| `curacao-470548300014.json` | Curacao | JSON-LD + HTML | `eanGtin` de la tabla de specs, `listPrice` del `price` raíz |
