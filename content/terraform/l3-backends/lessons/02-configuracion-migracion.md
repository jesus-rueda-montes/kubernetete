---
title: Configuración parcial, migración y bloqueos colgados
minutes: 9
---

## Qué problema resuelve

Ya tienes un backend remoto. Ahora surgen tres situaciones del día a día:

- La **misma configuración** se despliega en `dev` y en `pro`, y cada entorno necesita **su propio state**. Pero el bloque `backend` no admite variables.
- Tienes un proyecto que empezó con **state local** y quieres **pasarlo al bucket** sin perder nada.
- Un `apply` se cortó (se cayó la conexión, se cerró el portátil) y el **bloqueo se ha quedado puesto**: nadie puede aplicar.

## Analogía

- La **configuración parcial** es un formulario con algunos huecos en blanco que rellenas en el momento, según a qué oficina lo envíes.
- **Migrar el state** es mudarte: te llevas las cajas a la casa nueva antes de dejar la antigua.
- **`force-unlock`** es llamar al cerrajero cuando alguien se ha ido con la llave. Solo si estás seguro de que ya no hay nadie dentro.

## Concepto

### Configuración parcial

Dejas el bloque con los datos comunes (o vacío) y completas el resto en `terraform init`:

```hcl
terraform {
  backend "gcs" {}        # el tipo de backend siempre tiene que estar
}
```

Los valores van en un archivo por entorno. El nombre recomendado es **`*.gcs.tfbackend`**, con atributos sueltos:

```hcl
# pro.gcs.tfbackend
bucket = "tienda-tfstate"
prefix = "red/pro"
```

```bash
terraform init -backend-config=pro.gcs.tfbackend
```

También se pueden pasar pares sueltos: `-backend-config="prefix=red/pro"`.

### Migrar el state

Cuando cambias el bloque `backend` (de local a GCS, de un bucket a otro, o cambias el `prefix`), Terraform lo detecta y te pide `terraform init`. Tienes dos opciones:

| Flag | Qué hace |
|---|---|
| **`-migrate-state`** | **Copia** el state del backend anterior al nuevo. Te pide confirmación. |
| **`-reconfigure`** | Usa el backend nuevo **sin copiar** nada: empieza con el state que haya allí (quizá ninguno). |

Si te equivocas y usas `-reconfigure` cuando querías migrar, Terraform verá un state vacío y **propondrá crear todo de nuevo**. Revisa siempre el plan después de cambiar de backend: si todo va bien, debería decir **«No changes»**.

### Bloqueos colgados

Si una operación termina de forma brusca, el bloqueo puede quedar puesto. El error muestra el **ID del bloqueo**:

```bash
terraform force-unlock 1718035912345678
```

- Solo quita el bloqueo: **no toca la infraestructura** ni el contenido del state.
- Úsalo **solo si estás seguro** de que nadie está aplicando. Si otra persona sigue a mitad de un `apply`, podéis corromper el state.
- Lo primero es preguntar: el error dice **quién** (`Who`) tiene el bloqueo.

### Inspeccionar el state remoto

Los comandos de `terraform state` (`list`, `show`…) funcionan igual con un backend remoto. `terraform state pull` descarga el state y lo muestra, útil para revisarlo o hacer una copia.

## Ejemplo

Pasar un proyecto de state local a GCS:

```hcl
terraform {
  backend "gcs" {
    bucket = "tienda-tfstate"
    prefix = "red/pro"
  }
}
```

```bash
terraform init -migrate-state
# Do you want to copy existing state to the new backend? → yes
terraform plan        # debe decir "No changes": el state se ha copiado bien
rm terraform.tfstate terraform.tfstate.backup   # ya no hacen falta (cuando hayas comprobado el plan)
```

Mismo código en dos entornos, cada uno con su state:

```bash
terraform init -reconfigure -backend-config=dev.gcs.tfbackend   # prefix = "red/dev"
terraform init -reconfigure -backend-config=pro.gcs.tfbackend   # prefix = "red/pro"
```

Aquí `-reconfigure` sí es lo correcto: no quieres copiar el state de `dev` a `pro`, solo apuntar al otro.

## Errores comunes

- **Confundir `-migrate-state` y `-reconfigure`**: uno copia el state; el otro no.
- **No revisar el plan tras migrar**: si propone crear todo, el state no se ha copiado.
- **Borrar el state local antes de comprobar** que la migración ha ido bien.
- **Lanzar `force-unlock` sin preguntar** a quien tenía el bloqueo.
- **Olvidar el tipo** en la configuración parcial: el bloque `backend "gcs" {}` tiene que estar aunque vaya vacío.

## En la entrevista

**«¿Cómo usas la misma configuración con states distintos por entorno, si el backend no admite variables?»**
Con configuración parcial: el bloque `backend` queda vacío o con lo común, y en `terraform init -backend-config=pro.gcs.tfbackend` paso el bucket o el prefix de cada entorno. En un pipeline, cada entorno llama a `init` con su archivo.

**«Un apply se cortó y ahora nadie puede aplicar. ¿Qué haces?»**
Leo en el error quién tiene el bloqueo y confirmo que no hay ninguna operación en marcha. Después ejecuto `terraform force-unlock` con el ID del bloqueo y lanzo un `plan` para comprobar que el state refleja la realidad.

## Resumen

- **Configuración parcial**: `backend "gcs" {}` + `terraform init -backend-config=archivo.gcs.tfbackend`.
- Cambiar de backend: **`-migrate-state`** copia el state; **`-reconfigure`** no copia.
- Tras migrar, el plan debe decir **«No changes»**.
- **`terraform force-unlock ID`** quita un bloqueo colgado, solo si nadie está aplicando.
- `terraform state pull` muestra el state remoto.
