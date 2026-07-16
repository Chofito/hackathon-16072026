# Sesión 2026-07-16 — Brainstorm de adyacencias y tesis conceptual

> Registro de sesión de planificación. Explora, en abstracto, qué es el producto y qué ideas complementarias abre. Resultado principal: [../TESIS.md](../TESIS.md).

## Objetivo de la sesión

Brainstorm divergente de ideas complementarias al meta-ecommerce y aterrizaje conceptual del producto:

- ¿Qué ideas innovadoras existen alrededor de meta-ecommerces (comparadores, alertas, histórico, usados)?
- Conceptualmente, ¿qué estamos construyendo y cómo se amarra a otras ideas?
- ¿Qué se desperdicia y podría tener segunda vida?
- ¿Qué mercados existen en otros países que no existan en Guatemala?
- Profundizar la idea de "mesh de datos" / hub de scrapers y los conceptos económicos que se pueden interoperar.

## Investigación (estado del arte 2026)

- Comparadores evolucionaron de tablas estáticas a "commerce intelligence": Phia (nuevo + reventa a la vez), SCOU ("Price DNA" de 90 días, veredicto Buy/Wait/Skip), BLUN (precio "real total": envío + impuestos + aduana).
- Price trackers: CamelCamelCamel (afiliados) vs. Keepa (suscripción + API de datos B2B). Idealo como comparador multi-retailer europeo.
- Recommerce LatAm ~US$11.4 mil M (2026, +15% anual), dominado por informal (OLX, Facebook Marketplace) sin confianza/logística; Wallapop (adquirido por NAVER) y Vinted no operan en la región.
- Economía circular: dead stock como "found GMV" ((Re)vive), reverse logistics con visión por computadora (CIRQUEL), surplus food (Too Good To Go). Whitespace LatAm: recommerce estructurado, verificación/confianza, comparadores nicho.

## Conclusiones conceptuales

- El producto se reduce a **dos primitivas**: resolución de identidad (catálogo canónico) + observación longitudinal (`price_points`). Todo lo demás es aplicación o nuevo vertical.
- Marco unificador: **observatorio de mercado** = máquina de reducir asimetría de información (Akerlof, Hayek, Stigler).
- "Mesh de datos" correcta = **mesh semántica** (catálogo canónico como capa de interoperabilidad + hub de adaptadores de dominio con contrato común), NO mesh de infraestructura (sería sobre-ingeniería).
- Mapa de conceptos económicos → features documentado (arbitraje, descubrimiento de precios, IPC sombra, señalización, deadweight loss, etc.).
- Verticales adyacentes con las mismas primitivas: canasta básica, farmacias, combustibles, usados (oráculo de precio justo).

## Trabajo realizado

- **[../TESIS.md](../TESIS.md)** creado: tesis en una frase, dos primitivas, tesis económica, mapa concepto→feature, mesh semántica (diagrama mermaid), verticales adyacentes, segunda vida/desperdicio, whitespace, principios de foco.
- Enlazado desde el índice de [../../AGENTS.md](../../AGENTS.md) y desde [../../BRAINSTORM.md](../../BRAINSTORM.md).

## Decisiones y no-decisiones

- El brainstorm es **exploratorio**: no cambia el stack ni el alcance del MVP ya decidido. Las adyacencias quedan como backlog de ideas, no como compromisos.
- Se mantiene el principio de foco: **el colector primero**; nada de esto distrae del mandato #1.

## Siguiente paso

Ninguno forzado. Cuando se retome, candidatos naturales a cristalizar (en orden de apalancamiento sobre las primitivas): IPC sombra, contrato de dominio multi-vertical del hub de scrapers, oráculo de precio de usados.
