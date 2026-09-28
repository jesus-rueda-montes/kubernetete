---
title: Expresiones, funciones y data sources
minutes: 10
---

## Qué problema resuelve

Una configuración real necesita **calcular valores**: «3 réplicas en producción y 1 en desarrollo», «las etiquetas comunes más las propias de este recurso», «la lista de todos los nombres de los buckets». Y a menudo necesita **datos que no crea ella**: la última imagen de Debian, una red que gestiona otro equipo…

Para eso están las **expresiones** (condicionales, `for`), las **funciones** y los **data sources**.

## Analogía

Las expresiones y funciones son las **fórmulas de una hoja de cálculo**: no escribes el resultado, escribes cómo calcularlo. Los data sources son **consultar una tabla de otra hoja** que no mantienes tú: solo la lees.

## Concepto

### Condicional

```hcl
replicas = var.entorno == "pro" ? 3 : 1    # CONDICIÓN ? SI_VERDADERO : SI_FALSO
```

### Expresiones `for`

Transforman una colección en otra:

```hcl
[for n in var.nombres : upper(n)]              # lista → lista
{for n in var.nombres : n => length(n)}        # lista → mapa (clave => valor)
[for n in var.nombres : n if n != "test"]      # filtrar con if
```

El **splat** `[*]` es un atajo para sacar un atributo de todos los elementos de una lista: `google_storage_bucket.logs[*].name` (con `count`).

### Funciones habituales

Terraform trae funciones **integradas** (y, desde la versión 1.8, los providers pueden aportar otras); lo que no se puede es definir funciones propias en HCL. Se pueden probar en **`terraform console`**.

| Función | Ejemplo | Resultado |
|---|---|---|
| `length` | `length(["a", "b"])` | `2` |
| `upper` / `lower` | `upper("web")` | `"WEB"` |
| `join` / `split` | `join("-", ["tienda", "dev"])` | `"tienda-dev"` |
| `merge` | `merge({a = 1}, {b = 2})` | `{a = 1, b = 2}` |
| `lookup` | `lookup(var.tamanos, "pro", "small")` | valor de `"pro"` o `"small"` si no existe |
| `contains` | `contains(["dev", "pro"], "qa")` | `false` |
| `toset` | `toset(["a", "a", "b"])` | `["a", "b"]` (sin duplicados) |
| `cidrsubnet` | `cidrsubnet("10.0.0.0/16", 8, 1)` | `"10.0.1.0/24"` |
| `file` | `file("${path.module}/script.sh")` | contenido del archivo |

### Data sources

Un **data source** **lee** información de fuera de tu configuración, sin crear ni modificar nada:

```hcl
data "google_compute_image" "debian" {
  family  = "debian-12"         # la imagen más reciente de esta familia
  project = "debian-cloud"
}
```

Se referencia con **`data.TIPO.NOMBRE.ATRIBUTO`**: `data.google_compute_image.debian.self_link`. Normalmente se leen durante el **plan**.

| | `resource` | `data` |
|---|---|---|
| Qué hace | Crea, cambia y borra | Solo **lee** |
| Referencia | `TIPO.NOMBRE.ATRIBUTO` | `data.TIPO.NOMBRE.ATRIBUTO` |

## Ejemplo

```hcl
variable "entorno" {
  type = string
}

locals {
  etiquetas_comunes = { equipo = "tienda", entorno = var.entorno }
}

data "google_compute_image" "debian" {
  family  = "debian-12"
  project = "debian-cloud"
}

resource "google_compute_instance" "web" {
  count        = var.entorno == "pro" ? 3 : 1                       # condicional
  name         = "web-${var.entorno}-${count.index}"
  machine_type = var.entorno == "pro" ? "e2-standard-2" : "e2-small"
  zone         = "europe-west1-b"
  labels       = merge(local.etiquetas_comunes, { rol = "web" })   # funciones

  boot_disk {
    initialize_params {
      image = data.google_compute_image.debian.self_link           # data source
    }
  }

  network_interface {
    network = "default"
  }
}

output "nombres_web" {
  value = google_compute_instance.web[*].name                      # splat
}
```

```bash
terraform console
> cidrsubnet("10.0.0.0/16", 8, 2)
"10.0.2.0/24"
```

## Errores comunes

- **Confundir `resource` y `data`**: declarar como `data` algo que quieres crear (no se creará) o como `resource` algo que ya existe y gestiona otro equipo (intentará crearlo, o lo acabarás gestionando tú).
- **Olvidar el prefijo `data.`** al referenciar un data source.
- **Expresiones ilegibles**: tres condicionales anidados en una línea. Muévelos a `locals` con nombres claros.
- **Esperar que exista una función propia.** En HCL solo están las integradas; para lógica compleja, reconsidera el diseño o usa módulos.
- **Usar `[*]` con `for_each`**: el splat funciona con listas (`count`); para `for_each` usa una expresión `for` (`[for b in recurso : b.name]`).

## En la entrevista

**«¿Qué es un data source y en qué se diferencia de un resource?»**
Un data source lee información existente (una imagen, una red de otro equipo, el proyecto actual) sin gestionarla; se referencia con `data.TIPO.NOMBRE.ATRIBUTO`. Un resource es algo que Terraform crea, modifica y destruye.

**«¿Cómo harías que un entorno tenga distinto tamaño de máquina que otro?»**
Con una variable de entorno y un condicional (`var.entorno == "pro" ? "e2-standard-2" : "e2-small"`), o mejor con un mapa por entorno y `lookup`, y pasando los valores con un `.tfvars` distinto por entorno.

## Resumen

- Condicional: **`CONDICIÓN ? A : B`**.
- **`for`**: `[for x in lista : ...]` (lista) y `{for x in lista : clave => valor}` (mapa), con **`if`** para filtrar.
- **Funciones integradas** (`merge`, `lookup`, `join`, `toset`, `cidrsubnet`…); pruébalas en **`terraform console`**.
- **Data sources**: **solo leen**; se usan con **`data.TIPO.NOMBRE.ATRIBUTO`**.
- Splat **`[*]`** para listas (`count`); `for` para `for_each`.
