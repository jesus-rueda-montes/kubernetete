---
title: Outputs, locals y referencias
minutes: 10
---

## Qué problema resuelve

Tras crear infraestructura, casi siempre necesitas **datos que no conocías de antemano**: la IP que se asignó a una máquina, la URL de un bucket, el ID de una red. Además:

- un recurso a menudo **depende de otro** (una subred necesita su red),
- y algunas expresiones se repiten en muchos sitios (un prefijo de nombre, un conjunto de etiquetas).

Para eso existen las **referencias** entre recursos, los **outputs** y los **locals**.

## Analogía

Piensa en una **mudanza**:

- **Referencias**: «monta la estantería **en el salón que acabamos de pintar**». No das la dirección exacta; señalas algo que ya existe.
- **Locals**: una nota en la nevera, «nuestro apellido es García-López», para no escribirlo mal en cada caja.
- **Outputs**: al terminar, la empresa te entrega un papel con lo que necesitas saber: «el trastero es el nº 14».

## Concepto

### Referencias entre recursos

Cualquier atributo de un recurso se lee con **`TIPO.NOMBRE.ATRIBUTO`**:

```hcl
resource "google_compute_network" "vpc" {
  name                    = "tienda-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "web" {
  name          = "web"
  ip_cidr_range = "10.0.1.0/24"
  region        = "europe-west1"
  network       = google_compute_network.vpc.id   # referencia a la red de arriba
}
```

Al usar `google_compute_network.vpc.id`, Terraform entiende que la subred **depende** de la red y la crea **después**. Es una **dependencia implícita**: no tienes que ordenar los bloques; el orden en el archivo da igual.

### Outputs

Un **output** publica un valor al terminar:

```hcl
output "subred_id" {
  description = "ID de la subred web"
  value       = google_compute_subnetwork.web.id
}
```

- Se muestran al final de `terraform apply`.
- Se consultan después con **`terraform output`** (todos) o `terraform output subred_id` (uno). Con **`-raw`** se imprime el valor sin comillas, útil en scripts; con **`-json`**, en formato JSON.
- Con `sensitive = true` se muestran como `<sensitive>`. Ojo: se siguen guardando en el state, y `-raw` y `-json` los muestran en claro.
- También sirven para **pasar datos de un módulo a otro** (lo verás con los módulos).

### Locals

Un **local** da nombre a una expresión para reutilizarla:

```hcl
locals {
  prefijo = "tienda-${var.entorno}"
  etiquetas = {
    equipo  = "tienda"
    entorno = var.entorno
  }
}

resource "google_storage_bucket" "logs" {
  name     = "${local.prefijo}-logs"   # se declara en "locals", se lee con "local."
  location = "EU"
  labels   = local.etiquetas
}
```

| | Variable | Local | Output |
|---|---|---|---|
| Quién da el valor | Quien **usa** el código | El propio código | El propio código |
| Se lee con | `var.x` | `local.x` | `terraform output x` (o `module.m.x`) |
| Para qué | Parametrizar | No repetir | Exponer resultados |

## Ejemplo

Todo junto: una red, su subred y los datos que queremos ver al terminar.

```hcl
variable "entorno" {
  type    = string
  default = "dev"
}

locals {
  prefijo = "tienda-${var.entorno}"
}

resource "google_compute_network" "vpc" {
  name                    = "${local.prefijo}-vpc"   # tienda-dev-vpc
  auto_create_subnetworks = false                    # crearemos las subredes a mano
}

resource "google_compute_subnetwork" "web" {
  name          = "${local.prefijo}-web"
  ip_cidr_range = "10.0.1.0/24"
  region        = "europe-west1"
  network       = google_compute_network.vpc.id      # dependencia implícita
}

output "red" {
  value = google_compute_network.vpc.name
}
```

```bash
terraform apply
# ...
# Outputs:
# red = "tienda-dev-vpc"

terraform output -raw red    # tienda-dev-vpc  (sin comillas)
```

## Errores comunes

- **Escribir `locals.prefijo`** al leerlo. Se declara en `locals { }` (plural), pero se lee con **`local.prefijo`** (singular).
- **Poner a mano un ID que Terraform puede referenciar.** Si escribes el ID de la red como texto, Terraform no sabe que hay una dependencia y puede intentar crear la subred antes que la red.
- **Pensar que `sensitive` protege el state.** El valor está en el state en texto plano; protege el state (backend remoto con acceso restringido).
- **Abusar de los locals.** Si un valor solo se usa una vez, un local obliga a saltar por el código para saber de dónde sale.

## En la entrevista

**«¿Cómo sabe Terraform en qué orden crear los recursos?»**
Construye un grafo de dependencias a partir de las referencias entre recursos (dependencias implícitas). Si A usa un atributo de B, crea B primero. Lo que no depende entre sí se crea en paralelo. Para dependencias que no se ven en el código existe `depends_on`, pero debe ser la excepción.

**«¿Diferencia entre variable, local y output?»**
La variable es una entrada que da quien usa el código; el local es un valor interno con nombre para no repetirse; el output es una salida que expone un valor al terminar o a otro módulo.

## Resumen

- Referencia a otro recurso: **`TIPO.NOMBRE.ATRIBUTO`**. Crea una **dependencia implícita**.
- El orden de los bloques en el archivo **no importa**: Terraform usa el grafo de dependencias.
- **Outputs**: exponen valores; se consultan con `terraform output` (`-raw`, `-json`).
- **Locals**: `locals { }` para declarar, **`local.x`** para leer.
- `sensitive` oculta en la terminal, pero el valor sigue en el **state**.
