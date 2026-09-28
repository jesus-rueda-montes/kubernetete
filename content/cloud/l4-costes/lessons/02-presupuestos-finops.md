---
title: Presupuestos, etiquetas y FinOps
minutes: 11
---

## Qué problema resuelve

Aunque compres bien, sin **visibilidad** no sabes:

- Si el gasto de este mes se está disparando **antes** de que llegue la factura.
- **Qué equipo o aplicación** gasta cuánto.
- **Dónde** hay recursos desperdiciados.

**FinOps** es la práctica de gestionar el coste de la nube entre ingeniería y finanzas: **ver** el gasto, **repartirlo** entre quien lo genera y **optimizarlo** de forma continua.

## Analogía

Es la economía de una casa:

- El **presupuesto** con avisos es la alerta del banco cuando has gastado la mitad del mes.
- Las **etiquetas** son apuntar en cada tique si fue comida, ocio o transporte.
- La **exportación a BigQuery** es la hoja de cálculo donde analizas todos los gastos.
- Las **recomendaciones** son el amigo que te dice que pagas un gimnasio al que no vas.

## Concepto

### Cuenta de facturación

- Los proyectos se **vinculan** a una **cuenta de facturación** (*Cloud Billing account*), que es quien paga.
- Si un proyecto no tiene cuenta de facturación vinculada, sus servicios de pago dejan de funcionar.

### Presupuestos (*budgets*) y alertas

- Se crean sobre una cuenta de facturación y pueden filtrarse por proyectos, servicios o etiquetas.
- Importe fijo o **el gasto del periodo anterior**; periodo mensual, trimestral, anual o personalizado.
- **Umbrales de alerta**: por defecto al **50 %, 90 % y 100 %** del gasto real. También pueden basarse en el gasto **previsto** (*forecasted*) a final de periodo.
- Avisan por **correo**, por canales de Cloud Monitoring o por **Pub/Sub**, para automatizar respuestas (por ejemplo, avisar en Slack o desactivar la facturación de un proyecto de pruebas).
- **Importante:** un presupuesto de alertas **no limita el gasto**. Solo avisa. (Existen presupuestos con tope de gasto, en *preview* y solo para algunos servicios).

### Etiquetas (*labels*) para repartir costes

- Pares **clave=valor** en los recursos: `equipo=pagos`, `entorno=prod`, `app=tienda`.
- Aparecen en los datos de facturación, así que permiten **agrupar el gasto** por equipo o entorno.
- Las claves van en minúsculas y solo con letras, números, `-` y `_`.
- Conviene **definir un estándar** y hacerlo obligatorio (por ejemplo, en los módulos de Terraform).
- No confundir con las **network tags** (para el firewall) ni con los **tags** de Resource Manager (para políticas).

### Exportar la facturación a BigQuery

- La exportación a **BigQuery** envía el detalle del gasto a un dataset para consultarlo con SQL y hacer dashboards (por ejemplo, con Looker Studio).
- Tipos: **coste estándar**, **coste detallado** (a nivel de recurso, como cada VM) y **precios**.
- Al activarla, se rellenan también el mes actual y el anterior; **antes no hay datos**, así que se activa **desde el primer día**.

### Recomendaciones de ahorro

- **Recommender** (*Active Assist*) sugiere automáticamente: **redimensionar** VMs (con las métricas de los últimos 8 días), borrar **VMs inactivas**, discos sin usar o IPs sin asignar, y compras de CUD.

## Ejemplo

```bash
# Presupuesto mensual de 500 € para el proyecto de desarrollo, con aviso al 90 %
gcloud billing budgets create --billing-account=0A1B2C-3D4E5F-6A7B8C \
  --display-name="dev-mensual" --budget-amount=500EUR \
  --filter-projects=projects/tienda-dev --threshold-rule=percent=0.9

# Etiquetar una VM existente para repartir su coste
gcloud compute instances add-labels web-1 --zone=europe-west1-b \
  --labels=equipo=tienda,entorno=prod
```

Consulta típica sobre la exportación en BigQuery:

```sql
-- Gasto del mes por equipo (etiqueta "equipo")
SELECT l.value AS equipo, ROUND(SUM(cost), 2) AS coste
FROM `facturacion.gcp_billing_export_v1_XXXX`, UNNEST(labels) AS l
WHERE l.key = 'equipo' AND invoice.month = '202609'
GROUP BY equipo ORDER BY coste DESC;
```

## Errores comunes

- **Creer que un presupuesto corta el gasto**: solo avisa. Para cortar hay que automatizarlo (Pub/Sub + función) o usar un tope donde exista.
- **Activar la exportación a BigQuery tarde**: no hay datos anteriores al mes previo a activarla.
- **No etiquetar desde el principio**: luego nadie sabe a quién pertenece cada gasto.
- **Mirar solo la factura a final de mes**: hay que revisar el gasto de forma continua (ese es el espíritu de FinOps).
- **Ignorar las recomendaciones**: VMs sobredimensionadas e inactivas son el ahorro más fácil.

## En la entrevista

**«¿Cómo evitarías sustos en la factura de un proyecto nuevo?»**
Presupuesto con alertas al 50, 90 y 100 % y otra sobre el gasto previsto; avisos por Pub/Sub para automatizar, por ejemplo, un mensaje en Slack. Etiquetas obligatorias por equipo y entorno, exportación a BigQuery desde el primer día y revisión periódica de las recomendaciones.

**«¿Cómo repartes el coste de la nube entre equipos?»**
Con un estándar de etiquetas (equipo, entorno, aplicación) aplicado desde Terraform, y la exportación de facturación a BigQuery para agrupar el gasto por esas etiquetas. Si cada equipo tiene sus proyectos, también se puede agrupar por proyecto o carpeta.

## Resumen

- **FinOps**: ver, repartir y optimizar el gasto de forma continua, entre ingeniería y finanzas.
- **Presupuestos**: umbrales por defecto 50/90/100 %, gasto real o previsto, avisos por correo o **Pub/Sub**; **no limitan el gasto**.
- **Etiquetas** clave=valor para repartir costes; distintas de las network tags.
- **Exportación a BigQuery** desde el primer día: coste estándar, detallado y precios.
- **Recommender**: redimensionar, borrar lo inactivo, sugerir CUD.
