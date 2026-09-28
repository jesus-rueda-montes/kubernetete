---
title: Máquinas virtuales en Compute Engine
minutes: 11
---

## Qué problema resuelve

A veces necesitas **un servidor completo**: controlar el sistema operativo, instalar software que no cabe en un contenedor, ejecutar una base de datos propia o una aplicación heredada. **Compute Engine** es el servicio **IaaS** de Google Cloud: máquinas virtuales (VMs) que creas en segundos y pagas por segundos de uso.

## Analogía

Crear una VM es como **alquilar un coche**: eliges el modelo (tipo de máquina), el tamaño del maletero (disco), el sistema de navegación preinstalado (imagen) y en qué ciudad lo recoges (zona). Mientras está aparcado (parado) no pagas el motor, pero sí la plaza de garaje (el disco).

## Concepto

### Tipo de máquina

El **tipo de máquina** fija vCPUs y memoria. Se agrupan en **familias**:

| Familia | Para qué | Series de ejemplo |
|---|---|---|
| **Uso general** | La mayoría de cargas: webs, APIs, bases de datos pequeñas | E2, N2, N4, C3, C4 |
| **Optimizada para cómputo** | Cálculo intensivo, HPC | C2, H3 |
| **Optimizada para memoria** | Bases de datos en memoria muy grandes (SAP HANA…) | M3, X4 |
| **Optimizada para almacenamiento** | Mucho disco local de alto rendimiento | Z3 |
| **Optimizada para aceleradores** | GPUs para ML y HPC | A3, G2 |

El nombre dice la configuración: **`e2-standard-4`** = serie E2, perfil *standard* (4 GB por vCPU), **4 vCPUs**. Las series N y E admiten **tipos personalizados** (eliges vCPU y memoria exactas, con un pequeño sobrecoste).

### Imagen y discos

- La **imagen** es el sistema operativo de arranque: públicas (Debian, Ubuntu, Windows…) o **personalizadas** (tu imagen «dorada» con todo preinstalado). Una **familia de imágenes** (`debian-12`) apunta siempre a la más reciente.
- El **disco de arranque** y los discos adicionales son **almacenamiento en bloque** en red (Persistent Disk o Hyperdisk), independientes de la VM: sobreviven si la VM se para.
- Un **startup script** (metadato `startup-script`) se ejecuta en cada arranque: útil para instalar o configurar.

### Estados y facturación

- **Parada** (`TERMINATED`): no pagas vCPU ni memoria, **pero sí los discos** y las IPs estáticas reservadas.
- **Borrada**: desaparece; por defecto, también su disco de arranque.

### Modelos de precio

| Opción | Qué es |
|---|---|
| **Bajo demanda** | Precio normal, por segundo. |
| **Spot VMs** | Hasta un **91 % más baratas**, pero Google puede **pararlas en cualquier momento** (con un aviso de hasta 30 s). Sin SLA. Para trabajos **tolerantes a fallos**: procesamiento por lotes, CI, renderizado. Sustituyen a las antiguas *preemptible* (que duraban como máximo 24 h). |
| **Descuentos por uso continuado** (SUD) | Automáticos en algunas series antiguas (N1, N2, N2D, C2, M1, M2) si la VM funciona gran parte del mes. |
| **Descuentos por compromiso** (CUD) | Te comprometes 1 o 3 años a un consumo a cambio de un descuento importante. Para cargas estables. |

### Acceso

- **`gcloud compute ssh NOMBRE`** crea y gestiona las claves SSH por ti.
- Para VMs **sin IP pública** (lo recomendable), `--tunnel-through-iap` conecta a través de **IAP** (*Identity-Aware Proxy*), controlado con IAM, sin abrir el puerto 22 a internet.

## Ejemplo

```bash
gcloud compute instances create web-1 \
  --zone=europe-west1-b \
  --machine-type=e2-small \
  --image-family=debian-12 --image-project=debian-cloud \
  --service-account=api-tienda@tienda-pro-9x2a.iam.gserviceaccount.com \
  --no-address \
  --metadata-from-file=startup-script=arranque.sh

gcloud compute instances list
gcloud compute ssh web-1 --zone=europe-west1-b --tunnel-through-iap
gcloud compute instances stop web-1 --zone=europe-west1-b   # deja de cobrar CPU/RAM
```

Una VM Spot para un trabajo por lotes:

```bash
gcloud compute instances create lote-1 --zone=europe-west1-b \
  --machine-type=e2-standard-4 --provisioning-model=SPOT
```

## Errores comunes

- **Dejar VMs paradas «gratis»**: sus discos siguen cobrándose.
- **Usar Spot para un servicio que debe estar siempre disponible**, como la única réplica de una web o una base de datos.
- **IP pública y puerto 22 abierto a `0.0.0.0/0`** en todas las VMs. Mejor sin IP pública y SSH por IAP.
- **Sobredimensionar** la máquina «por si acaso». Empieza pequeño y ajusta con métricas (Google ofrece recomendaciones de tamaño).
- **Guardar datos importantes solo en el disco de arranque** sin copias (snapshots).

## En la entrevista

**«¿Cuándo usarías Spot VMs?»**
Para cargas tolerantes a interrupciones: procesamiento por lotes, CI, renderizado, nodos adicionales de un clúster que pueden perderse. Son mucho más baratas, pero Google puede pararlas en cualquier momento, sin SLA.

**«¿Qué pagas cuando una VM está parada?»**
No la CPU ni la memoria, pero sí los discos persistentes y las IPs estáticas reservadas.

## Resumen

- **Compute Engine** = VMs (IaaS). Tipo de máquina = vCPU + memoria (`e2-standard-4`).
- Familias: **uso general** (lo habitual), cómputo, memoria, almacenamiento, aceleradores.
- **Imagen** (o familia) para el SO; **discos** en red que sobreviven a la VM.
- **Spot**: hasta 91 % más barata, puede pararse en cualquier momento. **CUD**: compromiso de 1–3 años.
- Parada = pagas discos; SSH sin IP pública con **IAP**.
