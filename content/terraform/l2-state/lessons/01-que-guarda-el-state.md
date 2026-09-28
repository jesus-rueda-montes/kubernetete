---
title: Qué guarda el state y el drift
minutes: 10
---

## Qué problema resuelve

Tu código dice «quiero un bucket llamado `tienda-logs`». Cuando ejecutas `terraform plan`, Terraform tiene que saber:

- si ese bucket **ya lo creó él** o hay que crearlo,
- **qué ID real** tiene en Google Cloud,
- si alguien lo **cambió a mano** desde la consola.

El código solo describe lo que quieres; el **state** es la memoria de Terraform sobre **lo que gestiona en la realidad**. Entenderlo es la diferencia entre usar Terraform con confianza y romper producción.

## Analogía

El state es el **inventario de un almacén**: la lista de qué cajas hay, dónde está cada una y su número de serie. El pedido (tu código) dice lo que debería haber. Si alguien mueve cajas sin apuntarlo (cambios manuales), el inventario deja de cuadrar con la realidad: eso es el **drift**.

## Concepto

### Qué contiene

El state (por defecto, el archivo **`terraform.tfstate`**, con una copia **`terraform.tfstate.backup`**) guarda:

1. **La correspondencia** entre cada recurso del código (`google_storage_bucket.logs`) y el objeto real (su ID).
2. **Los atributos** de cada recurso tal como se conocieron la última vez: nombres, IPs, IDs… **incluidos valores sensibles** (contraseñas generadas, claves).
3. **Metadatos**, como las dependencias, para saber en qué orden destruir.

### Cómo planifica Terraform

Al ejecutar `terraform plan`:

1. **Refresca**: lee el estado actual de los objetos reales que el state dice que gestiona.
2. **Compara** tres cosas: el código (lo deseado), el state (lo último conocido) y la realidad (lo refrescado).
3. **Propone** los cambios para que la realidad coincida con el código.

### Drift

El **drift** es la diferencia entre la realidad y lo que Terraform espera, normalmente por **cambios manuales** fuera de Terraform. Ante un drift hay dos caminos:

| Quieres… | Haces… |
|---|---|
| **Deshacer** el cambio manual | `terraform apply`: Terraform vuelve a dejarlo como dice el código. |
| **Aceptar** el cambio manual | Cambias el **código** para reflejarlo. Si solo quieres actualizar el state con la realidad, sin tocar infraestructura: `terraform apply -refresh-only`. |

### Reglas de oro

- **Nunca edites el state a mano.** Usa los comandos `terraform state` (siguiente lección).
- **Nunca subas el state a git**: contiene secretos en texto plano y, en equipo, provoca conflictos.
- En equipo, el state va en un **backend remoto con bloqueo** (*locking*), como un bucket de GCS o S3, para que dos personas no apliquen a la vez (lo verás en el nivel 3).
- **Una sola fuente de verdad**: si alguien cambia a mano lo que gestiona Terraform, el siguiente `apply` lo pisará.

## Ejemplo

Alguien cambia desde la consola la clase de almacenamiento de un bucket gestionado por Terraform:

```bash
terraform plan
```

```
google_storage_bucket.logs: Refreshing state... [id=tienda-logs]

Terraform will perform the following actions:

  # google_storage_bucket.logs will be updated in-place
  ~ resource "google_storage_bucket" "logs" {
        name          = "tienda-logs"
      ~ storage_class = "NEARLINE" -> "STANDARD"   # la realidad dice NEARLINE; el código, STANDARD
    }

Plan: 0 to add, 1 to change, 0 to destroy.
```

Los símbolos del plan: **`+`** crear, **`-`** destruir, **`~`** modificar en el sitio, **`-/+`** destruir y volver a crear (sustituir).

Si el cambio manual era correcto, actualizas el código a `NEARLINE` y el plan quedará vacío: *No changes*.

## Errores comunes

- **Perder el state local** (borrar la carpeta o el portátil). Terraform «olvida» lo que creó: el siguiente plan intentaría crearlo todo de nuevo (y fallaría o duplicaría recursos).
- **Subir `terraform.tfstate` a git.** Expone secretos y no evita que dos personas apliquen a la vez. Añádelo a `.gitignore`.
- **Arreglos manuales en la consola** sin reflejarlos en el código: el próximo `apply` los deshace.
- **No leer el plan**, sobre todo los `-/+`: una sustitución puede borrar datos (una base de datos, un disco).

## En la entrevista

**«¿Qué es el state de Terraform y por qué es necesario?»**
Es el registro que relaciona cada recurso del código con el objeto real que gestiona (su ID y atributos), guarda metadatos como dependencias y acelera los planes. Sin él, Terraform no sabría qué ya existe ni qué debe cambiar o borrar.

**«¿Qué es el drift y cómo lo gestionas?»**
Diferencias entre la infraestructura real y lo que espera Terraform, normalmente por cambios manuales. `terraform plan` lo detecta al refrescar. O se deshace el cambio aplicando el código, o se acepta actualizando el código (y, si hace falta, el state con `-refresh-only`). Se previene limitando los permisos de cambio manual.

## Resumen

- El **state** (`terraform.tfstate`) relaciona el código con los **objetos reales**, sus atributos y dependencias.
- `plan` **refresca** la realidad y la compara con el código.
- **Drift** = cambios hechos fuera de Terraform; o se deshacen (`apply`) o se incorporan al código.
- Contiene **secretos en claro**: **nunca a git**; en equipo, **backend remoto con bloqueo**.
- **Nunca** edites el state a mano.
