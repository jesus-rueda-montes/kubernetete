---
title: Elegir la base de datos adecuada
minutes: 12
---

## Qué problema resuelve

Google Cloud tiene muchas bases de datos gestionadas, y cada una está pensada para un tipo de problema. Elegir mal sale caro:

- Una base de datos relacional que no puede crecer más allá de una máquina.
- Un almacén de análisis usado como base de datos de una web, con consultas lentas y facturas altas.
- Un NoSQL elegido «porque escala» para datos que necesitaban transacciones y `JOIN`.

Esta lección te da un **mapa** para elegir, que además es una pregunta clásica de entrevista y del examen Associate Cloud Engineer.

## Analogía

Es como elegir **vehículo**:

- **Cloud SQL** es una **furgoneta**: sirve para casi todo, pero tiene un tamaño máximo.
- **Spanner** es una **flota de camiones coordinada**: crece todo lo que haga falta, en varios países, y todos llevan la misma carga sincronizada.
- **Firestore** es una **moto de mensajería**: ágil para documentos pequeños que van y vienen de las apps.
- **BigQuery** es un **tren de mercancías**: mueve cantidades enormes para analizar, pero no para hacer recados rápidos.

## Concepto

### Transaccional (OLTP) frente a analítico (OLAP)

Antes de elegir, distingue dos usos:

- **OLTP** (transaccional): muchas operaciones pequeñas y rápidas. «Crea este pedido», «lee el carrito de este usuario». Lo usan las aplicaciones.
- **OLAP** (analítico): pocas consultas enormes que recorren millones de filas. «Ventas por región de los últimos 3 años». Lo usan los analistas y los informes.

### El mapa

| Servicio | Tipo | Cuándo elegirlo |
|---|---|---|
| **Cloud SQL** | Relacional (MySQL, PostgreSQL, SQL Server) | Aplicaciones típicas, migrar una base de datos existente. Escala en vertical (máquina más grande) y con réplicas de lectura. |
| **AlloyDB** | Relacional compatible con PostgreSQL | PostgreSQL con más rendimiento, también para consultas analíticas sobre los datos operacionales. |
| **Spanner** | Relacional distribuido | Escala **horizontal** casi ilimitada con SQL y transacciones **consistentes**, incluso entre regiones. SLA de hasta 99,999 % en multirregión. |
| **Firestore** | NoSQL de documentos | Apps web y móviles: documentos JSON en colecciones, sin servidor, sincronización en tiempo real y modo offline. |
| **Bigtable** | NoSQL de columna ancha | Volúmenes enormes con latencia muy baja: series temporales, IoT, datos para ML. Compatible con la API de HBase. |
| **Memorystore** | Caché en memoria (Redis, Valkey, Memcached) | Sesiones, caché delante de la base de datos, rankings. |
| **BigQuery** | Almacén de datos (*data warehouse*) | **Análisis** con SQL sobre terabytes o petabytes. Sin servidores que gestionar. |

### Preguntas para decidir

1. **¿Es análisis sobre muchos datos?** → **BigQuery**.
2. **¿Necesitas SQL y transacciones?**
   - Cabe en una máquina grande y en una región → **Cloud SQL** (o **AlloyDB** si necesitas más rendimiento con PostgreSQL).
   - Necesitas escala horizontal o escribir en varias regiones con consistencia fuerte → **Spanner**.
3. **¿Documentos flexibles para una app web o móvil?** → **Firestore**.
4. **¿Millones de escrituras por segundo con acceso por clave?** → **Bigtable**.
5. **¿Una caché con milisegundos o menos?** → **Memorystore**.

### BigQuery: cómo se paga

Con el modelo **bajo demanda** (*on-demand*), BigQuery cobra por los **bytes que lee** cada consulta. El primer TiB al mes es gratis. Guarda los datos **por columnas**, así que:

- **`SELECT *` lee todas las columnas**: selecciona solo las que necesitas.
- **`LIMIT` no reduce lo que se lee** en una tabla normal: solo recorta el resultado.
- **Particionar** (por ejemplo, por fecha) y **agrupar** (*clustering*) las tablas permite leer solo una parte.
- Un **dry run** te dice cuántos bytes leerá la consulta antes de ejecutarla, y **«máximo de bytes facturados»** pone un tope.

## Ejemplo

Una tienda online podría combinar varias:

```text
App web/móvil ──► Cloud SQL (PostgreSQL, HA)   pedidos, clientes, stock (OLTP)
             ├──► Memorystore                  sesiones y caché de productos
             └──► Firestore                    carrito en tiempo real en el móvil

Cada noche ─────► BigQuery                     ventas históricas para informes (OLAP)
```

Si la tienda crece a varios continentes y necesita que el stock sea **exacto en todas las regiones a la vez**, los pedidos y el stock pasarían a **Spanner**.

## Errores comunes

- **Usar BigQuery como base de datos de una aplicación**: está pensado para análisis, no para miles de lecturas y escrituras pequeñas por segundo.
- **Elegir Spanner para una app pequeña**: funciona, pero Cloud SQL es más simple y barato.
- **Hacer `SELECT * ... LIMIT 10` en BigQuery** para «ver unas filas»: lee la tabla entera. Usa la vista previa de la tabla.
- **Elegir un NoSQL** cuando los datos son muy relacionales y necesitan transacciones entre muchas entidades.
- **Olvidar la caché**: muchas veces el problema de rendimiento se resuelve con Memorystore, sin cambiar de base de datos.

## En la entrevista

**«Necesitas una base de datos relacional global, con escrituras en varias regiones y consistencia fuerte. ¿Cuál eliges?»**
Spanner: es relacional, escala en horizontal y ofrece transacciones con consistencia fuerte entre regiones. Cloud SQL escala en vertical y sus réplicas entre regiones son asíncronas y de solo lectura.

**«¿Cómo reduces el coste de las consultas en BigQuery?»**
Con el modelo bajo demanda se paga por bytes leídos. Selecciono solo las columnas necesarias, particiono y agrupo las tablas para filtrar menos datos, hago un dry run para estimar y pongo un límite de bytes facturados. `LIMIT` no reduce el coste.

## Resumen

- Distingue **OLTP** (aplicaciones) de **OLAP** (análisis).
- Relacional: **Cloud SQL** (vertical, una región), **AlloyDB** (PostgreSQL de alto rendimiento), **Spanner** (horizontal, global, consistente).
- NoSQL: **Firestore** (documentos, apps), **Bigtable** (volumen enorme, baja latencia). Caché: **Memorystore**.
- **BigQuery**: análisis; se paga por **bytes leídos** (evita `SELECT *`, particiona, `LIMIT` no ahorra).
