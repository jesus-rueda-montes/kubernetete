---
title: Cuentas de servicio
minutes: 9
---

## Qué problema resuelve

Tu aplicación, que corre en una VM o en Cloud Run, necesita escribir en un bucket. ¿Con qué identidad lo hace? No debería usar **tu** cuenta personal (que tiene muchos más permisos y que se va contigo si dejas la empresa). Las **cuentas de servicio** (*service accounts*) son identidades **para aplicaciones**, no para personas.

## Analogía

Una cuenta de servicio es como el **pase de un repartidor**: no lleva el nombre de ninguna persona, abre solo el muelle de carga y se puede revocar sin afectar a nadie más.

## Concepto

- Una cuenta de servicio es un **principal** con un email del tipo **`NOMBRE@PROJECT_ID.iam.gserviceaccount.com`**.
- Se le conceden roles **como a cualquier principal**.
- Además es un **recurso**: se puede controlar **quién puede usarla** (por ejemplo, con `roles/iam.serviceAccountUser` para adjuntarla a recursos).

### Cómo se autentica una aplicación (de mejor a peor)

| Forma | Cómo | Valoración |
|---|---|---|
| **Cuenta de servicio adjunta** | La VM, Cloud Run o GKE (con Workload Identity) se ejecutan **como** esa cuenta; las librerías obtienen credenciales temporales automáticamente. | **Lo recomendado** dentro de Google Cloud. |
| **Workload Identity Federation** | Una carga de trabajo de fuera (GitHub Actions, AWS, on-premises) intercambia su propia identidad por credenciales temporales de Google. | **Lo recomendado** fuera de Google Cloud. |
| **Suplantación** (*impersonation*) | Una persona actúa temporalmente como la cuenta de servicio (`--impersonate-service-account`). | Útil para pruebas y administración. |
| **Clave JSON** descargada | Un archivo con una clave privada de larga duración. | **Evitar**: si se filtra (git, un portátil), da acceso hasta que alguien la revoque. |

### Cuentas de servicio por defecto

Al activar algunos servicios, Google crea **cuentas de servicio por defecto** (por ejemplo, la de Compute Engine, `PROJECT_NUMBER-compute@developer.gserviceaccount.com`). Según la configuración de la organización, puede recibir automáticamente el rol **Editor** en el proyecto, demasiado amplio. En las organizaciones creadas desde mayo de 2024, esa concesión automática está desactivada por defecto (política `iam.automaticIamGrantsForDefaultServiceAccounts`). Buena práctica: **crear una cuenta de servicio propia por aplicación**, con solo los roles que necesita, y no usar la de por defecto.

## Ejemplo

```bash
# 1. Una cuenta de servicio para la API de la tienda
gcloud iam service-accounts create api-tienda --display-name="API de la tienda"

# 2. Permiso para leer, crear y borrar objetos, pero no para administrar buckets
gcloud projects add-iam-policy-binding tienda-pro-9x2a \
  --member="serviceAccount:api-tienda@tienda-pro-9x2a.iam.gserviceaccount.com" \
  --role="roles/storage.objectUser"

# 3. Al desplegar la VM o el servicio, se adjunta esta cuenta
#    (p. ej. --service-account=api-tienda@... en gcloud compute instances create)
```

La aplicación no guarda ninguna clave: las librerías de Google obtienen credenciales temporales del entorno en el que se ejecuta.

## Errores comunes

- **Descargar claves JSON** y guardarlas en el código, en una imagen o en git.
- **Usar la cuenta de servicio por defecto** de Compute Engine, con permisos de más.
- **Una cuenta de servicio para todo**: si se compromete, el atacante tiene los permisos de todas las aplicaciones. Una por aplicación.
- **Confundir los dos papeles** de una cuenta de servicio: como **principal** (qué puede hacer) y como **recurso** (quién puede usarla).

## En la entrevista

**«¿Cómo se autentica una aplicación que corre en GCP para usar otros servicios de Google?»**
Con una cuenta de servicio propia, con los roles mínimos, adjunta al recurso (VM, Cloud Run, GKE con Workload Identity). Las librerías obtienen credenciales temporales automáticamente, sin claves.

**«¿Por qué evitar las claves de cuentas de servicio?»**
Son credenciales de larga duración que se pueden filtrar (repositorios, portátiles, imágenes). Las alternativas —cuenta adjunta, Workload Identity Federation para cargas externas, o suplantación— usan credenciales temporales.

## Resumen

- Una **cuenta de servicio** es una identidad para **aplicaciones**: `NOMBRE@PROJECT_ID.iam.gserviceaccount.com`.
- Es a la vez **principal** (tiene roles) y **recurso** (hay que controlar quién la usa).
- Autenticación preferida: **cuenta adjunta** (dentro de GCP) y **Workload Identity Federation** (fuera).
- **Evita las claves JSON** y la cuenta de servicio **por defecto**.
- **Una cuenta de servicio por aplicación**, con mínimo privilegio.
