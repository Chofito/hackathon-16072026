# Tesis conceptual

> Capa estratégica del proyecto: **qué estamos construyendo en abstracto y por qué**.
> Contexto de negocio en [../BRAINSTORM.md](../BRAINSTORM.md); diseño técnico en [ARCHITECTURE.md](ARCHITECTURE.md).
> Este documento no describe *cómo* se implementa, sino *qué es* el producto conceptualmente y qué adyacencias abre. Sirve para decidir qué features encajan y cuáles diluyen.

## 1. La tesis en una frase

Estamos construyendo un **observatorio de mercado**: un grafo canónico de identidad de productos + observación longitudinal de sus precios, alimentado por un hub de adaptadores de dominio, y explotado por interfaces (web, alertas, API, lenguaje natural) que **reducen la asimetría de información** de un mercado opaco — empezando por tech/gaming y expandible a canasta básica, farmacias, combustibles y usados **con las mismas primitivas**.

El producto no es el sitio web ni el comparador. Es la **capa de referencia** que hoy no existe para el ecommerce guatemalteco: el instrumento que vuelve legible una señal de precios que hoy está rota y dispersa.

## 2. Las dos primitivas

Todo el sistema se reduce a dos capacidades. Cualquier feature es una aplicación de estas, y cualquier vertical nuevo es apuntarlas a otro mercado.

1. **Resolución de identidad** (entity resolution). Saber que "Switch 2" en Kemik y "NSW2-001" en MAX son el mismo objeto. Es la *llave de join* sobre un mercado fragmentado. Materializada en el catálogo canónico (`products` + `store_products`). Es el moat técnico (ver [SCRAPING.md](SCRAPING.md) §matching).
2. **Observación longitudinal** (serie de tiempo append-only). El mismo objeto, observado en el tiempo, en múltiples fuentes. Materializada en `price_points`. Es el moat temporal: **no se puede retro-generar** — por eso el colector arranca de inmediato.

Con las dos juntas dejás de tener "un comparador" y tenés un *price oracle* / observatorio. Sin la primera, tenés datos que no se pueden cruzar; sin la segunda, tenés una foto sin película.

## 3. La tesis económica: reducir asimetría de información

Asimetría de información = una parte de la transacción sabe más que la otra. En retail, el vendedor conoce su distribución de precios en el tiempo, sabe cuándo el "descuento" es sobre un ancla inflada y sabe cuánto vale un usado; el comprador ve un número aislado sin contexto. Esa brecha es excedente económico que se queda del lado informado.

**El producto traslada ese excedente hacia el comprador cerrando la brecha.** No vende precios, vende *legibilidad* de un mercado opaco. Tres anclas teóricas:

- **Akerlof — "The Market for Lemons" (1970):** sin forma de distinguir calidad/precio justo, el mercado se degrada (selección adversa). Su ejemplo canónico son los carros usados → el mercado de usados es *literalmente* el caso de libro de texto que nuestro oráculo de precio corrige.
- **Hayek — "The Use of Knowledge in Society" (1945):** el precio *es* información; el sistema de precios coordina conocimiento disperso. En un mercado fragmentado y opaco esa señal está ilegible. Somos el instrumento que la vuelve legible.
- **Stigler — "The Economics of Information" (1961):** buscar precios tiene un costo. Nuestro valor central es **colapsar a ~0 el costo de búsqueda** en N tiendas × M momentos. Es la razón por la que el usuario vuelve.

## 4. Mapa de conceptos económicos → features

Cada concepto no es adorno teórico: es un producto latente sobre las mismas dos primitivas.

| Concepto económico | Qué habilita |
|---|---|
| Selección adversa / lemons (Akerlof) | Oráculo de precio justo para usados; "tasador" neutral |
| Costos de búsqueda (Stigler) | El valor central: comparar N tiendas × tiempo a costo ~0 |
| Descubrimiento de precios | Percentil actual vs. histórico → "¿es buena oferta?" |
| Ley de precio único | Un mercado eficiente converge; el guatemalteco no. Medir la desviación entre tiendas = medir la oportunidad (KPI de fragmentación) |
| Arbitraje (espacial / temporal / de importación) | Más barato en otra tienda / "esperá, baja" / ancla Amazon-USD → "tráelo y ahorrás X" |
| Señalización (Spence) | El descuento falso es una anti-señal; el detector la desenmascara. Un "sello de precio justo" es una señal emitible |
| Discriminación de precios | Cupones de banco / precio condicionado → detectar y normalizar (`price` vs `list_price` vs condicionado) |
| Índices / canasta (tipo IPC) | **IPC sombra**: inflación real observada por categoría/canasta. Fuente de autoridad pública (prensa, academia) |
| Elasticidad precio-demanda | Capa B2B: proxy vía quiebres de stock y velocidad; modelado de promociones |
| Efecto látigo / quiebres (bullwhip) | `stock_status` en el tiempo revela desabasto → inteligencia para marcas |
| Pérdida de peso muerto (deadweight loss) | El desperdicio (dead stock, comida, devoluciones) es ineficiencia; "clearance radar" la recupera |
| Bienes de red / mercados de dos lados | Recommerce y crowdsourcing de precios: flywheel oferta↔demanda |
| Costos de transacción (Coase) | Confianza + matching reducen fricción; justifica verificación en usados |

Candidato más subexplotado y más "guatemalteco": el **IPC sombra / índice de precios propio** — subproducto directo del colector, con alcance público desproporcionado.

## 5. Arquitectura conceptual: mesh semántica, no mesh de infraestructura

Cuidado con el término "data mesh". En sentido técnico estricto (dominios descentralizados, self-serve, gobernanza federada) es **sobre-ingeniería** para un proyecto de una persona con cron scrapers — contradice el principio de "simplicidad primero" de [ARCHITECTURE.md](ARCHITECTURE.md). No se adopta como arquitectura.

Pero el *espíritu* sí es el principio de diseño correcto:

- **Cada tienda (y mañana cada vertical) es un dominio que produce un data product con un contrato común.** El contrato ya existe en germen: interfaz de dos modos `scrapeCatalog` / `scrapeProduct` (ver [ARCHITECTURE.md](ARCHITECTURE.md) §3.1). El "hub de scrapers" es un registro de adaptadores intercambiables, no un monolito.
- **El catálogo canónico ES la mesh.** Es la capa de interoperabilidad: una ontología compartida donde todo (nuevo, usado, canasta, farmacia) se resuelve contra la misma llave de identidad. No necesitamos mesh de *infraestructura*; necesitamos mesh de *semántica*.

```mermaid
flowchart TB
    subgraph dominios [Hub de adaptadores de dominio - contrato común]
        d1[Tiendas tech<br/>MAX, Kemik, Pacifiko, Curacao]
        d2[Canasta básica<br/>supermercados]
        d3[Farmacias]
        d4[Combustibles / otros]
    end

    subgraph canonica [Capa canónica - la mesh semántica]
        graph[(Grafo de identidad<br/>products + store_products)]
        ts[(Observación longitudinal<br/>price_points)]
    end

    subgraph interfaces [Interfaces sobre el grafo]
        consumidor["Consumidor:<br/>¿compro o espero?"]
        usados["Cazador de usados:<br/>precio justo"]
        b2b["Marca / retailer:<br/>share of shelf, quiebres"]
        prensa["Periodista / economista:<br/>IPC sombra"]
        nl["Consulta en<br/>lenguaje natural"]
        api["API como producto"]
    end

    dominios --> canonica --> interfaces
```

El producto no son "pantallas", son **interfaces sobre un grafo consultable**. Cada usuario corta el mismo dato distinto. La herramienta que las unifica y hoy es factible: una **capa de consulta en lenguaje natural** sobre una **capa semántica** (métricas definidas una vez: "mínimo histórico", "percentil", "oferta real") + **API como producto** para B2B.

## 6. Verticales adyacentes (mismas primitivas, otro mercado)

El modelo de datos no cambia al cambiar de vertical — solo los adaptadores de dominio. Candidatos, tan o más opacos que el tech:

- **Canasta básica / supermercados** — máximo alcance y relevancia pública (inflación de alimentos).
- **Farmacias / medicamentos** — opacidad brutal de precios.
- **Combustibles y gas**, **repuestos de auto**, **planes de datos / seguros**, **autos usados** (price history estilo historial de precio).

Y una aplicación de demanda sobre el mismo grafo: el **oráculo de precio de usados**. El problema #1 de todo mercado de segunda mano es "¿cuánto vale esto?" (asimetría/lemons) y el #2 es confianza. Nuestro dataset resuelve el #1 directamente: dado el histórico del nuevo + depreciación, estimamos valor residual. No hace falta *ser* el marketplace (logística, confianza, caro) — basta ser la **capa de precio de referencia** que se le sienta encima. Sigue siendo un producto de datos.

## 7. Segunda vida y desperdicio

El colector puede **detectar** desperdicio del lado de los retailers, no solo comparar precios:

- **Dead stock / overstock**: la serie de tiempo detecta un evento de liquidación (colapso de precio + stock alto) → "clearance radar".
- **Open-box / reacondicionados**: hoy escondidos; indexarlos es valor gratis.
- **Comida próxima a caducar** (modelo Too Good To Go): otro vertical, misma primitiva.
- **Cupones/promos que expiran sin usarse**: pura asimetría de información.
- **Meta-desperdicio**: los precios que hoy se evaporan cada vez que una tienda actualiza su web. Darle segunda vida a ese dato es la tesis raíz del proyecto.

## 8. Whitespace: modelos que existen afuera pero no en Guatemala

- Comparador multi-tienda tipo Idealo — no existe para GT (es lo que construimos).
- Asistente "Buy/Wait" con IA (Phia, SCOU) — ninguno localizado con tiendas guatemaltecas.
- C2C estructurado sin comisión al vendedor (modelo Vinted) — ausente en LatAm.
- Recommerce con escrow/verificación para electrónica de alto valor.
- Trade-in formalizado y reacondicionado con tiers de condición.
- Surplus food (Too Good To Go); rental/suscripción de uso ocasional.

Contexto: el recommerce en LatAm es ~US$11.4 mil M (2026, +15% anual), dominado por lo informal (OLX, Facebook Marketplace) sin confianza ni logística. Wallapop y Vinted no operan en la región.

## 9. Principios de foco (qué NO hacer todavía)

- **El colector primero.** Toda esta visión es *features sobre un activo*, no proyectos paralelos. Nada distrae del mandato #1: capturar histórico ya.
- **No diluir.** Cada adyacencia es tentadora; se implementa solo cuando reutiliza las primitivas sin abrir un frente de infraestructura nuevo.
- **Manual-first, automatizar cuando duela.** Igual que el matching (ver [SCRAPING.md](SCRAPING.md)).
- **El dato es el activo.** Cualquier decisión que arriesgue el histórico o su calidad se descarta.

## 10. Relación con los otros documentos

| Documento | Rol |
|---|---|
| [../BRAINSTORM.md](../BRAINSTORM.md) | Contexto de negocio y decisiones |
| **TESIS.md** (este) | Marco conceptual: qué es el producto en abstracto |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Cómo se implementa |
| [DATA_MODEL.md](DATA_MODEL.md) | Esquema que materializa las dos primitivas |
| [SCRAPING.md](SCRAPING.md) | Colección y matching (la resolución de identidad) |
| [TASKS.md](TASKS.md) | Backlog por fases |
