---
title: import, removed y refactorizar sin destruir
minutes: 11
---

## Qué problema resuelve

La infraestructura real rara vez empieza desde cero en Terraform:

- Hay recursos **creados a mano** en la consola hace años que quieres empezar a gestionar con código.
- Otras veces quieres lo contrario: que Terraform **deje de gestionar** un recurso **sin borrarlo** (porque pasa a otro equipo o a otra configuración).
- Y al reorganizar el código (renombrar, mover a un módulo) no quieres que Terraform destruya y recree nada.

Para esto están los bloques **`import`**, **`removed`** y **`moved`**.

## Analogía

- **`import`** es **dar de alta en el inventario** un mueble que ya estaba en la oficina: no compras otro, solo lo apuntas.
- **`removed`** es **darlo de baja del inventario** sin tirarlo: sigue ahí, pero ya no es tu responsabilidad.
- **`moved`** es **cambiarlo de sala** en el inventario: el mueble es el mismo.

## Concepto

### Bloque `import`

Declaras qué objeto real corresponde a qué dirección del código:

```hcl
import {
  to = google_storage_bucket.logs     # dirección en tu código
  id = "tienda-logs"                  # identificador real (depende del tipo de recurso)
}

resource "google_storage_bucket" "logs" {
  name     = "tienda-logs"
  location = "EU"
}
```

- `terraform plan` muestra **«will be imported»** y, si tu código no coincide con la realidad, los cambios que haría.
- Ajusta el código hasta que el plan **no proponga cambios** (solo la importación), y entonces `apply`.
- Al ser código, se revisa en una pull request y se aplica en el pipeline como cualquier cambio.
- El formato del `id` lo indica la documentación de cada recurso, en su sección *Import*.

¿No tienes el bloque `resource` escrito? `terraform plan -generate-config-out=generado.tf` lo genera a partir de la realidad (es una función **experimental**: revisa y limpia lo generado).

Existe también el comando antiguo **`terraform import DIRECCIÓN ID`**, que modifica el state directamente, sin plan previo ni revisión. Hoy se prefiere el bloque.

### Bloque `removed`

Para que Terraform **olvide** un recurso **sin destruirlo**: borras el bloque `resource` y añades:

```hcl
removed {
  from = google_storage_bucket.legacy

  lifecycle {
    destroy = false          # quitarlo del state, pero dejar el bucket real
  }
}
```

El plan lo muestra como **«will no longer be managed by Terraform»**. Es la alternativa revisable a `terraform state rm`. Con `destroy = true`, en cambio, lo destruiría.

### Bloque `moved` (repaso)

Ya lo viste en el state: cuando **renombras** un recurso o lo **mueves a un módulo**, `moved` evita la destrucción:

```hcl
moved {
  from = google_storage_bucket.logs
  to   = module.almacenamiento.google_storage_bucket.logs
}
```

### Los tres, juntos

| Situación | Bloque | Sustituto antiguo (sin revisión) |
|---|---|---|
| Existe fuera de Terraform → gestionarlo | `import` | `terraform import` |
| Gestionado → dejar de gestionarlo sin borrar | `removed` con `destroy = false` | `terraform state rm` |
| Cambia la dirección en el código | `moved` | `terraform state mv` |

Todos pasan por **`plan`**: ves el efecto antes de aplicarlo.

## Ejemplo

Traer a Terraform una red creada a mano, generando la configuración:

```hcl
# imports.tf
import {
  to = google_compute_network.vpc_legacy
  id = "projects/tienda-pro/global/networks/vpc-legacy"
}
```

```bash
terraform plan -generate-config-out=generado.tf
# revisar generado.tf, quitar atributos innecesarios
terraform plan        # "1 to import, 0 to add, 0 to change, 0 to destroy"
terraform apply
```

Después de aplicar, el bloque `import` puede quedarse o borrarse: ya no hace nada.

## Errores comunes

- **Importar y aplicar sin mirar el plan**: si el código no coincide, Terraform **cambiará** el recurso real para que coincida.
- **Borrar el bloque `resource`** para «dejar de gestionar» algo: Terraform lo **destruye**. Usa `removed` con `destroy = false`.
- **`id` con el formato incorrecto**: cada tipo de recurso tiene el suyo (consulta *Import* en su documentación).
- **Confiar ciegamente en `-generate-config-out`**: es experimental y genera muchos atributos que conviene limpiar.
- **Usar `terraform import` o `state rm` en equipo** sin dejar rastro: los bloques quedan revisados en git.

## En la entrevista

**«¿Cómo traes a Terraform recursos que se crearon a mano?»**
Con bloques `import` que indican la dirección y el ID real, escribiendo el `resource` (o generándolo con `plan -generate-config-out` y limpiándolo) hasta que el plan solo muestre la importación sin cambios. Todo pasa por revisión y plan, al contrario que el comando `terraform import`.

**«¿Cómo dejas de gestionar un recurso sin destruirlo?»**
Quito su bloque `resource` y añado un bloque `removed` con `lifecycle { destroy = false }`. El plan confirma que solo sale del state. Antes se hacía con `terraform state rm`.

## Resumen

- **`import { to, id }`**: gestionar lo que ya existe; ajusta el código hasta que el plan no proponga cambios.
- `plan -generate-config-out` genera el `resource` (**experimental**).
- **`removed { from; lifecycle { destroy = false } }`**: dejar de gestionar sin destruir.
- **`moved`**: cambiar la dirección sin recrear.
- Mejor **bloques** (revisables, con plan) que `terraform import` / `state rm` / `state mv`.
