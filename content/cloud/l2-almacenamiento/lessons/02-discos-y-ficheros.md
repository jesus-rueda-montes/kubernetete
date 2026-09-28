---
title: Bloques, ficheros y objetos
minutes: 8
---

## Qué problema resuelve

No todo cabe en un bucket. Una base de datos necesita un **disco** con escrituras rápidas y pequeñas; varias VMs pueden necesitar **compartir una carpeta** a la vez. Elegir el tipo de almacenamiento equivocado da problemas de rendimiento, de coste o, directamente, no funciona. Hay tres grandes tipos: **bloques**, **ficheros** y **objetos**.

## Analogía

- **Bloques** (un disco): tu **propio escritorio**; lo organizas como quieras y es muy rápido, pero solo lo usas tú.
- **Ficheros** (NFS): el **archivador compartido** de la oficina; varias personas abren y editan carpetas a la vez.
- **Objetos** (bucket): el **guardamuebles**; enorme y barato, pero sacas y metes cajas enteras.

## Concepto

| Tipo | Servicio en GCP | Cómo se usa | Típico para | AWS / Azure |
|---|---|---|---|---|
| **Bloques** | **Persistent Disk** / **Hyperdisk** | Un disco montado en una VM (o en un Nodo de GKE) | Sistema operativo, bases de datos | EBS / Managed Disks |
| **Ficheros** | **Filestore** | Carpeta compartida por red (NFS) en muchas VMs | Contenido compartido, aplicaciones heredadas | EFS / Azure Files |
| **Objetos** | **Cloud Storage** | API HTTP (`gs://…`) | Archivos, copias, datos para análisis, estáticos web | S3 / Blob Storage |

### Discos persistentes

- Son discos **en red**: su vida es **independiente** de la VM (puedes borrar la VM y conservar el disco).
- **Zonales** (en una zona) o **regionales** (replicados de forma síncrona en dos zonas de una región, para alta disponibilidad).
- Hay tipos más baratos (estándar, HDD) y más rápidos (SSD, balanceados). **Hyperdisk** es la generación nueva, con el rendimiento configurable aparte del tamaño.
- Los **snapshots** son copias de seguridad incrementales de un disco; se pueden restaurar en otra zona o región.
- La **SSD local** va físicamente en el servidor: rapidísima pero **efímera**: sus datos no están replicados y se pierden si falla el servidor o se borra la VM. Solo para caché o datos temporales.

### En Kubernetes

Esto enlaza con el nivel 3 de Kubernetes: un **PersistentVolume** en GKE suele ser un Persistent Disk (bloques) o un Filestore (ficheros). Un disco en bloque normalmente solo se puede montar en modo escritura **en un Nodo a la vez**; si varios Pods en distintos Nodos deben escribir en la misma carpeta, hace falta almacenamiento de ficheros.

## Ejemplo

Arquitectura de una tienda online:

- **Base de datos** PostgreSQL en una VM → **Persistent Disk SSD regional** + **snapshots diarios**. (Mejor aún: una base de datos gestionada como Cloud SQL, nivel 3).
- **Fotos de productos** subidas por los usuarios → **Cloud Storage** (bucket regional, Standard).
- **Copias de seguridad antiguas** → Cloud Storage con **ciclo de vida** hacia Coldline y Archive.
- **Carpeta de plantillas** compartida por 10 VMs de un sistema heredado → **Filestore**.

## Errores comunes

- **Guardar datos importantes en SSD local**: desaparecen con la VM.
- **Montar un bucket como si fuera un disco** para una base de datos: rendimiento y consistencia inadecuados.
- **Intentar compartir un disco en bloque** entre varias VMs en escritura: para eso está el almacenamiento de ficheros.
- **Olvidar los snapshots**: un disco persistente es duradero, pero no te protege de un borrado o de un fallo lógico de la aplicación.

## En la entrevista

**«¿Diferencia entre almacenamiento de bloques, ficheros y objetos?»**
Bloques: un disco para una máquina, rápido y de bajo nivel (Persistent Disk, EBS). Ficheros: un sistema de archivos compartido por red entre muchas máquinas (Filestore, EFS). Objetos: archivos enteros con metadatos accesibles por API HTTP, casi ilimitado y barato (Cloud Storage, S3).

**«¿Qué pasa con el disco de una VM si la borras?»**
Depende de su configuración: por defecto se borra con la VM el disco de arranque, pero se puede conservar. Los discos persistentes son independientes de la VM, a diferencia de las SSD locales, que no sobreviven al borrado de la VM.

## Resumen

- **Bloques** (Persistent Disk / Hyperdisk): disco de una VM; zonal o **regional**; **snapshots** para copias.
- **Ficheros** (Filestore): NFS compartido entre muchas VMs.
- **Objetos** (Cloud Storage): archivos por API, barato y casi ilimitado.
- **SSD local** = rapidísima pero **efímera**.
- En GKE, los PersistentVolumes suelen ser discos persistentes o Filestore.
