---
title: Varios recursos con count y for_each
minutes: 11
---

## Qué problema resuelve

Necesitas **tres buckets** (logs, backups y fotos) o **una subred por región**. Copiar y pegar el mismo bloque tres veces es tedioso y propenso a errores, y no escala si mañana son diez.

Los meta-argumentos **`count`** y **`for_each`** crean **varias instancias** de un recurso a partir de **un solo bloque**.

## Analogía

Es como el **combinar correspondencia** del procesador de textos: una sola plantilla de carta y una lista de destinatarios. `count` es «imprime 3 copias numeradas»; `for_each` es «imprime una carta por cada nombre de esta lista», y cada una lleva el nombre del destinatario.

## Concepto

### `count`: N copias numeradas

```hcl
resource "google_storage_bucket" "logs" {
  count    = 3
  name     = "tienda-logs-${count.index}"   # 0, 1, 2
  location = "EU"
}
```

- `count.index` vale **0, 1, 2…** en cada instancia.
- Direcciones: `google_storage_bucket.logs[0]`, `[1]`, `[2]`.
- Muy útil para **crear o no crear** algo: `count = var.crear_bucket ? 1 : 0`.

### `for_each`: una instancia por clave

```hcl
resource "google_storage_bucket" "buckets" {
  for_each = toset(["logs", "backups", "fotos"])   # un conjunto de textos
  name     = "tienda-${each.key}"
  location = "EU"
}
```

- Acepta un **mapa** o un **conjunto (set) de textos**. Una lista se convierte con **`toset()`**.
- **`each.key`**: la clave (o el elemento del set). **`each.value`**: el valor del mapa (en un set, igual que la clave).
- Direcciones: `google_storage_bucket.buckets["logs"]`, `["backups"]`…

Con un mapa, cada instancia tiene sus propios datos:

```hcl
variable "subredes" {
  type = map(string)
  default = {
    web   = "10.0.1.0/24"
    datos = "10.0.2.0/24"
  }
}

resource "google_compute_subnetwork" "sub" {
  for_each      = var.subredes
  name          = each.key          # web, datos
  ip_cidr_range = each.value        # su CIDR
  region        = "europe-west1"
  network       = google_compute_network.vpc.id
}
```

### ¿`count` o `for_each`?

La diferencia importa al **quitar un elemento del medio**:

- Con `count` y la lista `["a", "b", "c"]`, si quitas `"b"`, `"c"` pasa del índice 2 al 1. Terraform ve que `[1]` cambia de `b` a `c` y que `[2]` desaparece: **modifica o recrea** recursos que no querías tocar.
- Con `for_each`, cada instancia se identifica por su **clave** (`["c"]`), así que quitar `"b"` solo destruye `["b"]`.

**Regla práctica**: `for_each` cuando las instancias tienen identidad propia (nombres); `count` para N copias idénticas o para el 0/1 condicional.

Restricciones: no se pueden usar **los dos** en el mismo bloque, y las claves de `for_each` deben **conocerse al planificar** (no pueden salir de atributos que solo se sabrán al crear otro recurso).

## Ejemplo

```hcl
variable "entornos" {
  type    = set(string)
  default = ["dev", "pro"]
}

resource "google_storage_bucket" "datos" {
  for_each = var.entornos
  name     = "tienda-datos-${each.key}"
  location = "EU"
  labels   = { entorno = each.key }
}

output "nombres" {
  value = [for b in google_storage_bucket.datos : b.name]   # lista con todos los nombres
}
```

```bash
terraform state list
# google_storage_bucket.datos["dev"]
# google_storage_bucket.datos["pro"]
```

## Errores comunes

- **Usar `count` con una lista de nombres** y luego quitar uno del medio: recreaciones inesperadas.
- **Pasar una lista a `for_each`** sin `toset()`: error, porque `for_each` solo acepta mapas o sets.
- **Usar `each.key` en un recurso con `count`** (o `count.index` con `for_each`): cada meta-argumento tiene su objeto.
- **Claves que dependen de valores desconocidos** al planificar (por ejemplo, el ID de un recurso aún no creado): «Invalid for_each argument».
- **Olvidar el índice o la clave** al referenciar: con `count` es `google_storage_bucket.logs[0].name`, no `google_storage_bucket.logs.name`.

## En la entrevista

**«¿Diferencia entre `count` y `for_each`? ¿Cuándo usarías cada uno?»**
`count` crea N instancias identificadas por índice; `for_each` crea una por cada clave de un mapa o set. Con `count`, quitar un elemento intermedio desplaza los índices y provoca cambios en otros recursos; con `for_each` la identidad es la clave y solo se toca lo que cambia. Uso `for_each` para colecciones con nombre y `count` para copias idénticas o para crear un recurso de forma condicional (0 o 1).

**«¿Cómo creas un recurso solo en producción?»**
Con `count = var.entorno == "pro" ? 1 : 0`, y referenciándolo con índice (`[0]`) donde se use.

## Resumen

- **`count`**: N instancias, **`count.index`**, direcciones `[0]`, `[1]`…; ideal para el **0/1 condicional**.
- **`for_each`**: mapa o set (**`toset()`** para listas), **`each.key`** / **`each.value`**, direcciones `["clave"]`.
- Quitar un elemento del medio: con `count` se desplazan índices; con `for_each`, **no**.
- No se pueden combinar; las claves de `for_each` deben conocerse al planificar.
