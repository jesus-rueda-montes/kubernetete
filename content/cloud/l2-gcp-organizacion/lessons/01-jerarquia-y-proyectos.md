---
title: Jerarquía de recursos y proyectos
minutes: 10
---

## Qué problema resuelve

Una empresa en Google Cloud puede tener cientos de máquinas, bases de datos y buckets de muchos equipos y entornos. Hace falta una forma de:

- **agrupar** los recursos (por equipo, por entorno),
- **dar permisos** a un grupo de recursos de una vez,
- **saber quién paga** qué,
- y **aislar** entornos para que un error en desarrollo no toque producción.

Eso lo resuelve la **jerarquía de recursos**, cuya pieza central es el **proyecto**.

## Analogía

Es como la **estructura de una empresa**: la **organización** es la empresa; las **carpetas**, los departamentos; los **proyectos**, los equipos de trabajo con su propio presupuesto; y los **recursos**, las herramientas de cada equipo. Si das una llave maestra a nivel de departamento, sirve para todos sus equipos.

## Concepto

### Los cuatro niveles

```
Organización (ejemplo.com)
├── Carpeta: Tienda
│   ├── Proyecto: tienda-dev-7f3k   → VMs, buckets, bases de datos…
│   └── Proyecto: tienda-pro-9x2a
└── Carpeta: Datos
    └── Proyecto: analitica-pro-4h1c
```

| Nivel | Qué es |
|---|---|
| **Organización** | La raíz. Se crea automáticamente al usar Google Cloud con una cuenta de **Google Workspace** o **Cloud Identity** (el dominio de la empresa). |
| **Carpetas** (opcionales) | Agrupan proyectos (y otras carpetas): departamentos, equipos, entornos. |
| **Proyectos** | La unidad básica: **todo recurso pertenece a un proyecto**. Cada uno tiene sus APIs activadas, sus permisos y su cuenta de facturación. |
| **Recursos** | Lo que usas: VMs, buckets, clústeres… |

Cada elemento tiene **un solo padre**.

### Herencia de permisos

Los permisos (IAM, siguiente módulo) que concedes en un nivel se **heredan hacia abajo**: un rol en la carpeta «Tienda» vale en todos sus proyectos. La herencia es **aditiva**: un proyecto **no puede quitar** un permiso heredado de arriba con su propia política. Para prohibir algo aunque se haya concedido, existen las **deny policies**, que se evalúan antes que los permisos.

### Identificadores de un proyecto

| | Ejemplo | ¿Único? | ¿Se puede cambiar? |
|---|---|---|---|
| **Nombre** (*project name*) | `Tienda Dev` | No | Sí, cuando quieras |
| **ID** (*project ID*) | `tienda-dev-7f3k` | **Sí, en todo Google Cloud** (ni siquiera se reutiliza el de un proyecto borrado) | **No, es permanente** |
| **Número** (*project number*) | `123456789012` | Sí, lo asigna Google | No |

El **ID** es el que usas en comandos, en Terraform y en las URLs: 6 a 30 caracteres, minúsculas, números y guiones, empezando por letra.

### Facturación y APIs

- Una **cuenta de facturación** (*Cloud Billing account*) paga el consumo de los proyectos vinculados a ella; un proyecto se vincula a **una** cuenta de facturación. Sin facturación activa, los servicios de pago del proyecto dejan de funcionar.
- Los **presupuestos** (*budgets*) avisan cuando el gasto se acerca a una cifra, pero un presupuesto normal **no corta el gasto**.
- Cada servicio (Compute Engine, Cloud Storage…) es una **API** que hay que **activar en el proyecto** antes de usarlo: `gcloud services enable compute.googleapis.com`.

### Por qué un proyecto por entorno

Separar `dev` y `pro` en **proyectos distintos** da aislamiento real: permisos diferentes, cuotas diferentes, facturación desglosada y ningún recurso compartido por accidente.

## Ejemplo

```bash
gcloud projects create tienda-dev-7f3k --name="Tienda Dev"   # crear proyecto
gcloud projects list                                          # proyectos a los que tengo acceso
gcloud config set project tienda-dev-7f3k                     # proyecto por defecto de gcloud
gcloud services enable compute.googleapis.com                 # activar la API de Compute Engine
gcloud services list                                          # APIs activadas
```

## Errores comunes

- **Confundir el nombre con el ID** del proyecto. Los comandos usan el **ID**.
- **Elegir un ID sin pensar** (`prueba-123`): no se puede cambiar nunca.
- **Mezclar entornos en un mismo proyecto.** Un permiso o un borrado de más en «dev» afecta a «pro».
- **Conceder roles amplios a nivel de organización o carpeta** «para que funcione»: se heredan en todos los proyectos de debajo.
- **Creer que un presupuesto limita el gasto.** Solo avisa; hay que actuar (o automatizar la respuesta).
- **«API has not been used in project… or it is disabled»**: falta activar la API en el proyecto.

## En la entrevista

**«Describe la jerarquía de recursos de GCP.»**
Organización (raíz, ligada al dominio de Workspace o Cloud Identity), carpetas opcionales para agrupar, proyectos (la unidad donde viven los recursos, con sus APIs, permisos y facturación) y recursos. Las políticas IAM se heredan hacia abajo y de forma aditiva.

**«¿Cómo organizarías los entornos de una aplicación en GCP?»**
Un proyecto por entorno (dev, staging, pro), agrupados en una carpeta por aplicación o equipo, con permisos concedidos a grupos y lo más abajo posible en la jerarquía, y presupuestos con alertas por proyecto.

## Resumen

- Jerarquía: **Organización → Carpetas → Proyectos → Recursos**; cada elemento tiene un solo padre.
- Los permisos se **heredan hacia abajo** y la herencia es **aditiva** (para prohibir, deny policies).
- **Project ID**: único en todo GCP y **permanente**; el nombre se puede cambiar.
- Cada proyecto tiene **facturación** vinculada y **APIs** que hay que **activar**.
- **Un proyecto por entorno** para aislar permisos, cuotas y costes.
