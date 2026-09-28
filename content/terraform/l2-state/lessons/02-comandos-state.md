---
title: Inspeccionar y modificar el state
minutes: 9
---

## Qué problema resuelve

A veces necesitas **mirar** qué hay en el state («¿qué IP le tocó a esta VM?») o **cambiarlo** sin tocar la infraestructura: renombraste un recurso en el código, o quieres que Terraform **deje de gestionar** algo sin borrarlo. Editar el JSON a mano es peligroso; para eso están los comandos `terraform state`.

## Analogía

Siguiendo con el **inventario del almacén**: `state list` es leer la lista de cajas; `state show`, abrir la ficha de una caja; `state mv`, cambiarle la etiqueta sin mover la caja; y `state rm`, tachar la caja del inventario **sin tirarla** (sigue en el almacén, pero ya no es asunto tuyo).

## Concepto

| Comando | Qué hace | ¿Toca la infraestructura? |
|---|---|---|
| `terraform state list` | Lista las direcciones de los recursos del state. | No |
| `terraform state show DIRECCIÓN` | Muestra los atributos guardados de un recurso. | No |
| `terraform state mv ORIGEN DESTINO` | Cambia la **dirección** de un recurso en el state (renombrar, mover a un módulo). | No |
| `terraform state rm DIRECCIÓN` | Quita el recurso del state: Terraform **lo olvida**, pero **no lo borra**. | No |
| `terraform output` | Muestra los outputs. | No |
| `terraform show` | Muestra todo el state (o un plan guardado) de forma legible. | No |

Los comandos que **modifican** el state (`mv`, `rm`) crean una copia de seguridad automáticamente. Admiten **`-dry-run`** para ver qué harían.

### Direcciones de recursos

Una **dirección** identifica un recurso dentro del state:

```
google_storage_bucket.logs                  # TIPO.NOMBRE
google_compute_instance.web[0]              # con count: índice
google_compute_instance.web["api"]          # con for_each: clave
module.red.google_compute_network.vpc       # dentro de un módulo
```

### Renombrar sin destruir: `moved`

Si cambias el nombre local de un recurso en el código (de `logs` a `registros`), Terraform ve **uno que desaparece y otro nuevo**: planearía **destruir y crear**. Para evitarlo:

- Desde Terraform 1.1, lo recomendado es un bloque **`moved`** en el código: queda en git, se revisa en la PR y lo aplica todo el equipo.
- La alternativa manual es `terraform state mv google_storage_bucket.logs google_storage_bucket.registros`.

```hcl
moved {
  from = google_storage_bucket.logs
  to   = google_storage_bucket.registros
}
```

### Forzar la sustitución

Si un recurso está «tocado» (por ejemplo, una VM que funciona mal) y quieres recrearlo igual: **`terraform apply -replace=DIRECCIÓN`**. Sustituye al antiguo `terraform taint`.

## Ejemplo

```bash
terraform state list
# google_compute_network.vpc
# google_compute_subnetwork.web
# google_storage_bucket.logs

terraform state show google_compute_subnetwork.web
# resource "google_compute_subnetwork" "web" {
#     ip_cidr_range = "10.0.1.0/24"
#     name          = "tienda-dev-web"
#     ...

# Dejar de gestionar el bucket con Terraform, sin borrarlo
terraform state rm google_storage_bucket.logs
# Removed google_storage_bucket.logs
# Successfully removed 1 resource instance(s).
```

Después de `state rm` tienes que **quitar también el bloque del código**; si no, el siguiente plan intentará crear el bucket otra vez.

## Errores comunes

- **Renombrar un recurso en el código sin `moved`** (ni `state mv`): el plan propone destruir y crear. Si es una base de datos, pierdes los datos.
- **Usar `state rm` pensando que borra el recurso.** Solo lo olvida; el recurso sigue existiendo y costando dinero.
- **Hacer `state rm` y dejar el bloque en el código**: Terraform intentará crearlo de nuevo.
- **Editar el JSON del state a mano** en lugar de usar estos comandos.
- **Usar `state mv` en un equipo** sin avisar: el cambio no queda en git. Por eso se prefiere `moved`.

## En la entrevista

**«Has renombrado un recurso en el código y el plan quiere destruirlo y crearlo. ¿Qué haces?»**
Añado un bloque `moved` con `from` (dirección antigua) y `to` (nueva), para que Terraform actualice la dirección en el state sin tocar la infraestructura. En versiones antiguas, `terraform state mv`. Después el plan no debería proponer cambios.

**«¿Cómo dejarías de gestionar un recurso con Terraform sin borrarlo?»**
`terraform state rm <dirección>` y quitar su bloque del código. El recurso sigue existiendo, pero ya no está en el state.

## Resumen

- `state list` / `state show`: **inspeccionar** sin cambiar nada.
- `state mv`: cambiar la **dirección** en el state; para renombrar, mejor un bloque **`moved`** (Terraform ≥ 1.1).
- `state rm`: Terraform **olvida** el recurso, **no lo borra**; quita también su bloque del código.
- Direcciones: `TIPO.NOMBRE`, `[índice]`, `["clave"]`, `module.X.`.
- `apply -replace=DIRECCIÓN` fuerza la **sustitución** (sustituye a `taint`).
