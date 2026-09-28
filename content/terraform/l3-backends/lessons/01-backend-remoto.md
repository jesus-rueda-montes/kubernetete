---
title: Backend remoto y bloqueo del state
minutes: 10
---

## Qué problema resuelve

Por defecto, Terraform guarda el state en un archivo local, `terraform.tfstate`. Mientras trabajas solo, funciona. En equipo aparecen tres problemas:

- **Cada persona tiene su propia copia** del state. Si Ana aplica un cambio, el state de Luis ya no refleja la realidad.
- **Dos personas pueden aplicar a la vez** y corromper el state o crear recursos duplicados.
- **El archivo tiene secretos en claro** y vive en portátiles, o peor, en git.

Un **backend remoto** guarda el state en un sitio compartido y protegido, y lo **bloquea** mientras alguien lo está usando.

## Analogía

Es la diferencia entre que cada uno tenga **una copia en papel** del cuadrante de turnos, o que haya **uno solo en la nube** que todos consultan. Además, mientras alguien lo edita, el documento se **bloquea** para los demás: nadie pisa los cambios de otro.

## Concepto

### El bloque `backend`

Va **dentro del bloque `terraform`** del módulo raíz:

```hcl
terraform {
  backend "gcs" {
    bucket = "tienda-tfstate"     # bucket que ya existe
    prefix = "red/pro"            # "carpeta" dentro del bucket
  }
}
```

- El backend por defecto es **`local`** (el archivo en disco).
- **GCS** (Google Cloud Storage) y **S3** (AWS) son los más habituales. HCP Terraform también puede guardar el state.
- Tras añadir o cambiar el bloque, hay que ejecutar **`terraform init`**.

### GCS

- Solo `bucket` es obligatorio.
- Con `prefix = "red/pro"`, el state se guarda en el objeto `red/pro/default.tfstate` (`default` es el workspace por defecto; los workspaces se ven en el siguiente módulo).
- **Bloqueo** incluido, sin configurar nada más.
- La documentación recomienda **activar el versionado de objetos** en el bucket, para recuperar el state si se borra o se estropea.

### S3

```hcl
terraform {
  backend "s3" {
    bucket       = "tienda-tfstate"
    key          = "red/pro/terraform.tfstate"   # ruta del archivo dentro del bucket
    region       = "eu-west-1"
    use_lockfile = true                          # bloqueo con un archivo en el propio S3
  }
}
```

- Obligatorios: `bucket`, `key` y `region`.
- El bloqueo se activa con **`use_lockfile = true`**.
- Antes se usaba una tabla de **DynamoDB** (`dynamodb_table`) para bloquear. Hoy está **obsoleto** (*deprecated*) y se eliminará en una versión futura.
- También se recomienda **activar el versionado** del bucket.

### Cómo funciona el bloqueo

Las operaciones que pueden escribir el state (`plan`, `apply`, `destroy`…) lo **bloquean** al empezar y lo liberan al terminar. Si otra persona lo intenta mientras tanto, Terraform se detiene con:

```text
Error: Error acquiring the state lock
Lock Info:
  ID:        1718035912345678
  Who:       ana@portatil
  Operation: OperationTypeApply
```

### El backend no admite variables

El bloque `backend` **no puede usar variables, locals ni data sources**: Terraform lo necesita antes de evaluar nada más. Para cambiar valores según el entorno se usa la **configuración parcial**, que verás en la siguiente lección.

### Credenciales

Nunca pongas claves en el bloque `backend`. Usa el mecanismo normal de cada nube: en GCP, `gcloud auth application-default login` en tu equipo o la cuenta de servicio de la máquina o del pipeline.

## Ejemplo

Primero se crea el bucket (una sola vez, fuera de esta configuración), con versionado:

```bash
gcloud storage buckets create gs://tienda-tfstate --location=EU --uniform-bucket-level-access
gcloud storage buckets update gs://tienda-tfstate --versioning
```

Después se configura el backend:

```hcl
terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
    }
  }

  backend "gcs" {
    bucket = "tienda-tfstate"
    prefix = "red/pro"
  }
}
```

```bash
terraform init     # configura el backend; a partir de ahora el state vive en el bucket
```

## Errores comunes

- **Usar `var.` en el bloque `backend`**: da error. Usa configuración parcial.
- **Bucket del state sin versionado**: si el state se borra o se corrompe, no hay forma de recuperarlo.
- **Crear el bucket del state con la misma configuración que lo usa**: es el problema del huevo y la gallina. El bucket se crea antes, a mano o con otra configuración aparte.
- **Seguir configurando DynamoDB** en proyectos nuevos con S3: usa `use_lockfile`.
- **Dar acceso al bucket a todo el mundo**: el state contiene secretos. Solo deben leerlo quienes gestionan esa infraestructura.

## En la entrevista

**«¿Por qué usar un backend remoto?»**
Para que todo el equipo comparta un único state, para **bloquearlo** y evitar que dos `apply` se pisen, y para protegerlo: control de acceso, cifrado y versionado para recuperarlo. En GCP, lo típico es un bucket de GCS con versionado activado.

**«¿Cómo evita Terraform que dos personas apliquen a la vez?»**
Con el bloqueo del state (*state locking*). Si el backend lo soporta, cada operación que escribe el state toma un bloqueo y la segunda persona recibe un error hasta que se libere. GCS lo trae incluido; en S3 se activa con `use_lockfile` (antes, con DynamoDB, que ya está obsoleto).

## Resumen

- El backend por defecto es **local**; en equipo se usa uno **remoto** (GCS, S3, HCP Terraform).
- El bloque **`backend`** va dentro de `terraform { }` y exige **`terraform init`**.
- **GCS**: `bucket` + `prefix`, bloqueo incluido. **S3**: `bucket`, `key`, `region` y **`use_lockfile = true`**.
- Activa el **versionado** del bucket y restringe el acceso: el state tiene secretos.
- El bloque `backend` **no admite variables**.
