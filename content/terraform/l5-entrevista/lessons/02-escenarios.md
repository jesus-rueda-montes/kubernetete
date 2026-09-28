---
title: Escenarios prácticos
minutes: 14
---

## Qué problema resuelve

Las preguntas de nivel senior no son «¿qué es X?», sino **«¿qué harías si…?»**: el state está bloqueado, alguien cambió algo a mano, hay que renombrar un recurso sin destruirlo, el state ha crecido demasiado… Lo que se evalúa es que resuelvas **sin romper nada** y que expliques los riesgos.

## Analogía

Es el **simulador de vuelo** de un piloto: no se practica despegar con buen tiempo, sino el motor que falla o el viento cruzado. Quien ha ensayado las emergencias responde con calma y en orden.

## Concepto

Para cada escenario: **diagnosticar → elegir la opción menos arriesgada → verificar con `plan`**. La regla de oro: tras cualquier arreglo, un `terraform plan` debería decir **«No changes»** (o solo lo que esperas).

### 1. «El state está bloqueado»

- Lee el error: incluye el **ID del bloqueo**, quién lo tiene y desde cuándo.
- Comprueba que **nadie** está ejecutando (un compañero, un pipeline colgado).
- Solo entonces: `terraform force-unlock LOCK_ID`.
- Nunca lo desbloquees con un `apply` en curso: dos escrituras a la vez pueden corromper el state.

### 2. «Alguien cambió una regla de firewall a mano» (drift)

- `terraform plan -refresh-only` muestra qué cambió fuera de Terraform.
- Decide: si el cambio es **correcto**, pásalo al código (y el plan quedará limpio); si **no**, un `apply` normal lo revierte al código.
- Prevención: permisos de solo lectura en la consola para las personas, y un plan programado que avise del drift.

### 3. «Hay que renombrar un recurso o moverlo a un módulo»

- Cambiar el nombre sin más hace que Terraform **destruya el antiguo y cree uno nuevo**.
- Usa un bloque **`moved`** (`from` → `to`): el plan muestra «has moved to» y ningún destroy.
- Vale también al pasar de `count` a `for_each` o al meter recursos en un módulo.

### 4. «El state es enorme y los plan tardan mucho»

Dividirlo en varios states (por ejemplo, red y aplicaciones):

1. En el state de origen, bloque **`removed`** con `lifecycle { destroy = false }`: Terraform **deja de gestionarlo** sin borrarlo.
2. En el state de destino, bloque **`import`** con el ID del recurso.
3. `plan` en ambos: ningún destroy ni create, solo el «forget» y el «import».
4. La conexión entre ambos: outputs y data sources (o `terraform_remote_state`).

### 5. «Un recurso está roto y hay que recrearlo»

- `terraform apply -replace=ADDR` fuerza la sustitución de **ese** recurso, visible en el plan.
- Sustituye al antiguo `terraform taint`.

### 6. «El apply falló a mitad»

- Terraform **guarda en el state lo que sí se creó**; no hay «rollback» automático.
- Corrige la causa (permisos, cuota, un valor) y vuelve a lanzar `plan` y `apply`: continúa desde donde quedó.

### 7. «Hay una contraseña en el state»

- Todo valor que pasa por un recurso queda en el state, aunque sea `sensitive`.
- Mejor: que el servicio la genere y la guarde en **Secret Manager**, o valores **ephemeral** / atributos *write-only* que no se guardan. Y el backend con acceso restringido y cifrado.

## Ejemplo

Renombrar `google_storage_bucket.logs` a `google_storage_bucket.registros` sin perder datos:

```hcl
resource "google_storage_bucket" "registros" {
  name     = "tienda-logs"
  location = "EU"
}

moved {
  from = google_storage_bucket.logs
  to   = google_storage_bucket.registros
}
```

```text
$ terraform plan
  # google_storage_bucket.logs has moved to google_storage_bucket.registros
    resource "google_storage_bucket" "registros" {
        name = "tienda-logs"
        # (18 unchanged attributes hidden)
    }

Plan: 0 to add, 0 to change, 0 to destroy.
```

## Errores comunes

- **`force-unlock` sin comprobar** que no hay un apply en marcha.
- **Renombrar sin `moved`**: destroy + create; en un bucket o una base de datos, pérdida de datos.
- **Borrar un recurso del código para «sacarlo» de Terraform**: lo destruye. Usa `removed` con `destroy = false`.
- **Editar el JSON del state a mano** en vez de usar `moved`, `removed`, `import` o `terraform state`.
- **Aplicar sin mirar el plan** después de un arreglo: el plan es la prueba de que no rompes nada.

## En la entrevista

**«Necesitas mover una VPC de un state a otro sin recrearla. ¿Cómo?»**
En el origen, un bloque `removed` con `destroy = false` para dejar de gestionarla sin borrarla. En el destino, un bloque `import` con su ID y el código correspondiente. Compruebo con `plan` en ambos que no hay destroy ni create, y aplico primero el origen y luego el destino.

**«Un compañero dice que el pipeline se quedó colgado y el state está bloqueado. ¿Qué haces?»**
Miro el error para ver el ID del bloqueo y quién lo tiene. Confirmo que el job está cancelado y que nadie más está aplicando. Entonces `terraform force-unlock` con ese ID, y lanzo un `plan` para ver en qué estado quedó todo antes de volver a aplicar.

## Resumen

- Método: **diagnosticar → opción menos arriesgada → `plan` para verificar**.
- Bloqueo: comprobar y después **`force-unlock LOCK_ID`**.
- Drift: **`plan -refresh-only`**; pasar el cambio al código o revertirlo con apply.
- Renombrar/mover: **`moved`**; sacar de un state: **`removed`** (`destroy = false`) + **`import`** en el otro.
- Recrear uno: **`-replace`**; apply a medias: corregir y volver a aplicar; secretos fuera del state cuando se pueda.
