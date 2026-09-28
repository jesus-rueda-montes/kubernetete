---
title: Cloud Storage
minutes: 11
---

## Qué problema resuelve

Imágenes de productos, copias de seguridad, logs, datos para análisis, la web estática de marketing… Son **archivos**, a menudo muchísimos, que no necesitan un disco pegado a una máquina: necesitan guardarse **de forma duradera, barata y accesible desde cualquier sitio**. Para eso existe el **almacenamiento de objetos**; en Google Cloud, **Cloud Storage** (GCS). Su equivalente en AWS es **S3**; en Azure, **Blob Storage**.

## Analogía

Cloud Storage es un **guardamuebles gigante**: alquilas trasteros (**buckets**) y dentro guardas cajas (**objetos**) con una etiqueta. No importa qué ordenador tengas; con la llave (permisos) recoges cualquier caja por su etiqueta. Y hay tarifas más baratas si prometes que casi nunca vas a sacar la caja (clases frías).

## Concepto

### Buckets y objetos

- Un **bucket** es un contenedor de objetos. Su nombre es **único en todo el mundo**, es **visible públicamente** (no metas datos personales en él) y **no se puede cambiar**.
- Un **objeto** es un archivo más sus metadatos, identificado por su nombre: `gs://tienda-fotos/productos/zapato-42.jpg`.
- Las «carpetas» son solo **prefijos** en el nombre (`productos/`): el espacio de nombres es plano (salvo si activas el espacio de nombres jerárquico, opcional).
- Los objetos se **sustituyen enteros**: no se modifica un trozo de un objeto como en un disco.

### Ubicación

| Tipo | Ejemplo | Cuándo |
|---|---|---|
| **Región** | `europe-west1` | Datos cerca de tus VMs o de tu clúster; lo más barato. |
| **Dual-region** | `EUR4` (dos regiones de Europa) | Alta disponibilidad y recuperación ante desastres entre dos regiones. |
| **Multirregión** | `EU`, `US`, `ASIA` | Servir contenido a una zona geográfica amplia. |

### Clases de almacenamiento

Todas tienen **la misma latencia (milisegundos)** y la misma durabilidad; cambia **el precio de guardar** frente al **precio de leer**:

| Clase | Duración mínima | Coste de recuperación | Para datos que lees… |
|---|---|---|---|
| **Standard** (por defecto) | — | No | Con frecuencia («calientes») |
| **Nearline** | 30 días | Sí | Una vez al mes o menos |
| **Coldline** | 90 días | Sí | Una vez al trimestre o menos |
| **Archive** | 365 días | Sí | Menos de una vez al año (copias legales, archivos) |

Si borras un objeto Coldline a los 10 días, se cobran igualmente los 90.

### Funciones clave

- **Acceso uniforme a nivel de bucket** (*uniform bucket-level access*): los permisos se gestionan **solo con IAM**, sin listas de control por objeto (ACLs). Es lo recomendado.
- **Versionado**: guarda las versiones anteriores de un objeto al sobrescribirlo o borrarlo. Protege contra errores (y cuesta espacio).
- **Reglas de ciclo de vida** (*lifecycle*): acciones automáticas por antigüedad u otras condiciones: pasar a Nearline a los 30 días, a Archive al año, borrar a los 7 años…
- **URLs firmadas**: acceso temporal a un objeto concreto sin dar permisos IAM.

## Ejemplo

```bash
# Bucket regional con acceso uniforme
gcloud storage buckets create gs://tienda-fotos-7f3k --location=europe-west1 --uniform-bucket-level-access

gcloud storage cp zapato-42.jpg gs://tienda-fotos-7f3k/productos/   # subir
gcloud storage ls gs://tienda-fotos-7f3k/productos/                  # listar
gcloud storage cp -r ./backups gs://tienda-backups-7f3k/2026-09/     # subir una carpeta
gcloud storage buckets update gs://tienda-backups-7f3k --versioning  # activar versionado
```

Una regla de ciclo de vida (archivo `ciclo.json`) que abarata las copias con el tiempo:

```json
{
  "rule": [
    { "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" }, "condition": { "age": 30 } },
    { "action": { "type": "Delete" }, "condition": { "age": 365 } }
  ]
}
```

```bash
gcloud storage buckets update gs://tienda-backups-7f3k --lifecycle-file=ciclo.json
```

## Errores comunes

- **Buckets públicos por error** (`allUsers`): una de las fugas de datos más frecuentes en la nube.
- **Poner Archive a datos que se leen a menudo**: cada lectura se cobra y el ahorro desaparece.
- **Datos personales o nombres internos en el nombre del bucket**: los nombres son públicos.
- **Tratar un bucket como un disco** (modificar archivos a trozos, muchos cambios pequeños): usa un disco o Filestore.
- **Bucket lejos de quien lo usa**: latencia y costes de tráfico entre regiones.

## En la entrevista

**«¿Qué clases de almacenamiento tiene Cloud Storage y cómo eliges?»**
Standard, Nearline, Coldline y Archive. Todas con latencia de milisegundos; las frías son más baratas de guardar pero cobran por leer y tienen una duración mínima (30, 90 y 365 días). Se elige según la frecuencia de acceso, y las reglas de ciclo de vida mueven los datos automáticamente al envejecer.

**«¿Cómo proteges los datos de un bucket?»**
Acceso uniforme con IAM de mínimo privilegio, sin acceso público salvo que sea intencionado, versionado para recuperarse de borrados, retención si hay requisitos legales, y cifrado (por defecto, gestionado por Google; opcionalmente con claves propias en Cloud KMS).

## Resumen

- **Almacenamiento de objetos**: buckets con nombre **global, público e inmutable**; objetos con prefijos a modo de carpetas.
- Ubicación: **región**, **dual-region** o **multirregión**.
- Clases: **Standard**, **Nearline** (30 d), **Coldline** (90 d), **Archive** (365 d); misma latencia, distinto precio.
- **Acceso uniforme** con IAM, **versionado** y **ciclo de vida**.
- `gcloud storage buckets create | cp | ls | rm | rsync`.
