---
title: Modelos de precio y descuentos
minutes: 11
---

## Qué problema resuelve

En la nube pagas por lo que usas. Es una ventaja, pero también un riesgo: una VM olvidada, un disco sin usar o una transferencia de datos inesperada aparecen en la factura cada mes.

Además, el **mismo trabajo** puede costar muy distinto según **cómo** lo compres: a precio normal, con descuento por compromiso o con VMs Spot. Saber elegir es parte del trabajo de un ingeniero cloud, y se pregunta en las entrevistas.

## Analogía

Es como moverte por la ciudad:

- **Bajo demanda** es el **taxi**: sin compromiso, pagas cada trayecto, el precio más alto.
- **Descuento por compromiso** es el **abono anual**: pagas lo pactado lo uses o no, pero cada viaje sale mucho más barato.
- **Spot** es el **billete de última hora con plazas sobrantes**: muy barato, pero te pueden bajar del tren si alguien paga el precio completo.

## Concepto

### Qué se cobra

- **Cómputo**: vCPU y memoria por segundo (VMs), o por petición y tiempo de CPU (Cloud Run), o por Pod (GKE Autopilot).
- **Almacenamiento**: GB al mes según la clase (Standard, Nearline, Coldline, Archive), más operaciones y lecturas en las clases frías.
- **Red**: la **entrada** de datos (*ingress*) es **gratis**; la **salida** (*egress*) a Internet o entre regiones **se cobra por GB**.
- **Servicios gestionados**: cada uno con su modelo (instancias de Cloud SQL, consultas de BigQuery…).

### Descuentos por uso sostenido (SUD)

- **Automáticos**: no hay que hacer nada.
- Se aplican a ciertos tipos de máquina de Compute Engine que funcionan **más del 25 % del mes**.
- El descuento crece con el uso, hasta un **20 % o 30 %** según la serie de máquina, si la VM funciona el mes entero.

### Descuentos por compromiso (CUD)

Te comprometes durante **1 o 3 años** a cambio de descuento:

- **Basados en recursos**: una cantidad de vCPU y memoria **en una región**. Hasta un **55 %** (hasta un **70 %** en las series optimizadas para memoria).
- **Basados en gasto** (*spend-based*, como los **compute flexible CUDs**): un gasto mínimo por hora, más flexible entre series y regiones.
- **No se pueden cancelar**: pagas el compromiso aunque no lo uses.

### Spot VMs

- Usan **capacidad sobrante** de Google: descuentos de **hasta el 91 %**.
- Google puede **expropiarlas** (*preempt*) en cualquier momento, con un aviso muy breve (el apagado es de hasta 30 segundos).
- Aptas para trabajos **tolerantes a fallos**: procesamiento por lotes, renderizado, CI, nodos extra de GKE. **No** para una base de datos.
- Son la versión nueva de las antiguas *preemptible VMs*.

### Cómo elegir

- **Carga base estable, 24/7** → CUD.
- **Carga variable** → bajo demanda con autoescalado (y SUD si aplica).
- **Trabajos interrumpibles** → Spot.
- **Tráfico con picos y periodos sin uso** → serverless que **escala a cero** (Cloud Run).

## Ejemplo

```bash
# VM Spot para un trabajo por lotes: si Google la expropia, se borra
gcloud compute instances create render-1 --zone=europe-west1-b \
  --machine-type=e2-standard-4 \
  --provisioning-model=SPOT --instance-termination-action=DELETE
```

```text
# Razonamiento típico para un clúster de GKE:
- 6 nodos siempre encendidos     → CUD de 3 años sobre esa base
- hasta 10 nodos más en picos    → bajo demanda con Cluster Autoscaler
- trabajos nocturnos de datos    → node pool de Spot VMs
```

## Errores comunes

- **Comprar un CUD grande «por si acaso»**: no se cancela. Compra solo la base que ya usas de forma estable.
- **Usar Spot para servicios con estado o críticos**: se caen cuando Google recupera la capacidad.
- **Olvidar el egress**: mover muchos datos entre regiones o hacia Internet puede costar más que las VMs.
- **Dejar recursos encendidos sin uso**: VMs de pruebas, discos sueltos, IPs estáticas reservadas sin asignar.
- **Pensar que los SUD requieren contrato**: son automáticos.

## En la entrevista

**«¿Cómo reducirías el coste de un clúster que funciona 24/7 con picos por la tarde?»**
Mediría la carga base estable y la cubriría con un CUD. Los picos, con autoescalado bajo demanda. Los trabajos interrumpibles, en un node pool de Spot VMs. Además, ajustaría las requests de los Pods y los tamaños de máquina según el uso real.

**«¿Qué diferencia hay entre SUD y CUD?»**
Los SUD son automáticos por usar una VM gran parte del mes, sin compromiso. Los CUD requieren comprometerse 1 o 3 años a unos recursos o un gasto a cambio de más descuento, y no se pueden cancelar.

## Resumen

- Se paga cómputo, almacenamiento, operaciones y **egress**; el **ingress es gratis**.
- **SUD**: automáticos, hasta un 20-30 % por usar la VM gran parte del mes.
- **CUD**: 1 o 3 años, hasta un 55 % (70 % en memoria optimizada); **no se cancelan**.
- **Spot**: hasta un 91 % más barato, pero expropiable; solo para trabajos tolerantes a fallos.
- Base estable → CUD; variable → autoescalado; interrumpible → Spot; picos y ratos sin uso → escalar a cero.
