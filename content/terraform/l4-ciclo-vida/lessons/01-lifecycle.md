---
title: El bloque lifecycle
minutes: 11
---

## Qué problema resuelve

El comportamiento por defecto de Terraform no siempre es el que quieres:

- Un cambio que obliga a **sustituir** un recurso primero lo **destruye** y después crea el nuevo: hay un rato sin servicio.
- Un error en el código puede **destruir la base de datos** de producción.
- Otro sistema (un autoescalado, un equipo de seguridad) cambia un atributo, y Terraform insiste en **deshacer** ese cambio en cada `apply`.

El bloque **`lifecycle`** ajusta cómo Terraform crea, actualiza, sustituye y destruye cada recurso.

## Analogía

`lifecycle` son las **instrucciones especiales** pegadas a una caja en una mudanza: «**frágil, no tirar**» (`prevent_destroy`), «**monta el mueble nuevo antes de llevarte el viejo**» (`create_before_destroy`), «**no toques lo que haya dentro del cajón**» (`ignore_changes`).

## Concepto

Va dentro del bloque `resource`:

```hcl
resource "google_sql_database_instance" "pedidos" {
  # ...
  lifecycle {
    prevent_destroy = true
  }
}
```

Sus reglas (`prevent_destroy`, `ignore_changes`…) solo admiten **valores literales**, porque se procesan antes que el resto de expresiones. La excepción son las precondiciones y postcondiciones, que sí usan expresiones.

### `create_before_destroy`

Cuando hay que sustituir el recurso, **crea primero el nuevo** y después destruye el viejo, en vez de al revés. Evita cortes, por ejemplo al cambiar la plantilla de un grupo de instancias.

Ojo: los dos objetos existen a la vez, así que **no pueden chocar**. Si el nombre es fijo y debe ser único (un bucket, una VM), la creación falla. Se suele combinar con nombres generados (`name_prefix` o un sufijo aleatorio).

### `prevent_destroy`

Si un plan intenta **destruir** ese recurso (con `destroy` o por una sustitución), Terraform **da error** y no continúa. Protege bases de datos, buckets con datos o claves de cifrado.

Limitación importante: **si borras el bloque `resource` del código**, la protección desaparece con él y Terraform **sí** lo destruirá. Para dejar de gestionar un recurso sin destruirlo se usa `removed` (siguiente lección).

### `ignore_changes`

Terraform **ignora** los cambios en esos atributos al comparar la realidad con el código:

```hcl
lifecycle {
  ignore_changes = [labels, metadata]
}
```

Útil cuando otro sistema gestiona ese atributo legítimamente. Úsalo con moderación: esconde el drift.

### `replace_triggered_by`

Fuerza la **sustitución** del recurso cuando cambia otro recurso o atributo:

```hcl
lifecycle {
  replace_triggered_by = [google_compute_instance_template.web.id]
}
```

### Precondiciones y postcondiciones

`precondition` y `postcondition` comprueban suposiciones y fallan con un mensaje claro:

```hcl
lifecycle {
  precondition {
    condition     = var.entorno != "pro" || var.tipo_maquina != "e2-micro"
    error_message = "En pro no se permite e2-micro."
  }
}
```

## Ejemplo

```hcl
resource "google_storage_bucket" "facturas" {
  name     = "tienda-facturas"
  location = "EU"

  lifecycle {
    prevent_destroy = true            # nunca destruir por error
    ignore_changes  = [labels]        # el equipo de finanzas añade labels a mano
  }
}

resource "google_compute_instance_template" "web" {
  name_prefix  = "web-"               # nombre generado: el nuevo y el viejo conviven
  machine_type = "e2-small"
  # ...

  lifecycle {
    create_before_destroy = true      # el grupo de instancias siempre tiene plantilla
  }
}
```

Si alguien intenta destruir el bucket:

```text
Error: Instance cannot be destroyed

Resource google_storage_bucket.facturas has lifecycle.prevent_destroy set,
but the plan calls for this resource to be destroyed.
```

## Errores comunes

- **Confiar en `prevent_destroy`** y borrar el bloque del código: el recurso se destruye.
- **`create_before_destroy` con nombres fijos únicos**: la creación del nuevo falla porque el nombre está ocupado.
- **`ignore_changes = all`** para «callar» el plan: Terraform deja de gestionar ese recurso de verdad.
- **Usar variables en `prevent_destroy` o `ignore_changes`**: solo admiten literales.
- **Poner `prevent_destroy` en todo**: impide cambios legítimos y `terraform destroy` en entornos de prueba.

## En la entrevista

**«¿Cómo protegerías una base de datos de un borrado accidental con Terraform?»**
Con `lifecycle { prevent_destroy = true }`, que hace fallar cualquier plan que la destruya, además de la protección del propio proveedor (por ejemplo, `deletion_protection` en Cloud SQL). Sabiendo que si se borra el bloque del código, `prevent_destroy` desaparece con él.

**«¿Para qué sirve `create_before_destroy`?»**
Para que, al sustituir un recurso, Terraform cree el nuevo antes de destruir el viejo y no haya corte. Requiere que ambos puedan coexistir, normalmente con nombres generados.

## Resumen

- **`lifecycle`** dentro de `resource`; sus reglas, con **literales**.
- **`create_before_destroy`**: sustituir sin corte (cuidado con nombres únicos).
- **`prevent_destroy`**: error si el plan lo destruye; **no** protege si borras el bloque.
- **`ignore_changes`**: ignora atributos gestionados por otros.
- **`replace_triggered_by`**, **`precondition`**/**`postcondition`**.
