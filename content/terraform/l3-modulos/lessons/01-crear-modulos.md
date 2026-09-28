---
title: Crear y usar un módulo
minutes: 11
---

## Qué problema resuelve

Imagina que cada equipo necesita un bucket de GCS con las mismas reglas: versionado activado, acceso uniforme y unas etiquetas obligatorias. Sin módulos, copias y pegas el mismo bloque de 20 líneas en cada proyecto. Cuando cambia una regla, tienes que buscar y corregir todas las copias, y alguna se te olvida.

Un **módulo** agrupa varios recursos en un paquete **reutilizable**, con **entradas** (variables) y **salidas** (outputs). Lo escribes una vez y lo usas donde haga falta.

## Analogía

Un módulo es como una **función** en programación:

- Las **variables** son sus **parámetros**.
- Los **outputs** son lo que **devuelve**.
- Los recursos de dentro son el **cuerpo** de la función: quien la llama no necesita conocerlos.

## Concepto

### Todo es un módulo

En Terraform, **cualquier directorio con archivos `.tf` es un módulo**:

- El directorio donde ejecutas `terraform plan` es el **módulo raíz** (*root module*).
- Los módulos que el raíz llama con un bloque `module` son **módulos hijos** (*child modules*).

### Estructura habitual de un módulo

```text
modules/bucket/
├── main.tf        # los recursos
├── variables.tf   # las entradas
├── outputs.tf     # las salidas
└── README.md      # qué hace y cómo se usa
```

Los nombres de los archivos son una **convención**: Terraform lee todos los `.tf` del directorio sin importar cómo se llamen.

### Llamar a un módulo

Desde el módulo raíz, con un bloque `module`:

```hcl
module "logs" {
  source   = "./modules/bucket"   # dónde está el módulo
  nombre   = "tienda-logs"        # valor para la variable "nombre" del módulo
  location = "EU"
}
```

- La etiqueta (`"logs"`) es el **nombre de esta instancia** del módulo. Puedes llamar al mismo módulo varias veces con nombres distintos.
- `source` es obligatorio. Una ruta local **debe empezar por `./` o `../`**.
- El resto de argumentos son los **valores de las variables** del módulo. Las variables sin `default` son obligatorias.

### Leer las salidas

Desde fuera **solo se ven los outputs** del módulo, con `module.NOMBRE.OUTPUT`:

```hcl
output "url_logs" {
  value = module.logs.url
}
```

Los recursos internos quedan ocultos: `module.logs` **no** te deja leer `google_storage_bucket.this.name` directamente. Si algo debe verse fuera, el módulo lo expone como output.

### Direcciones en el state

Los recursos de un módulo llevan el prefijo del módulo:

```text
module.logs.google_storage_bucket.this
module.backups.google_storage_bucket.this
```

### ¿Y el provider?

Los módulos hijos **heredan** la configuración del provider del módulo raíz (proyecto, región…). Un módulo reutilizable declara qué provider necesita en `required_providers`, pero **no** debe llevar su propio bloque `provider "google" { ... }`.

## Ejemplo

El módulo, en `modules/bucket/`:

```hcl
# variables.tf
variable "nombre" {
  type        = string
  description = "Nombre global del bucket"
}

variable "location" {
  type    = string
  default = "EU"                   # opcional: tiene valor por defecto
}

# main.tf
resource "google_storage_bucket" "this" {
  name                        = var.nombre
  location                    = var.location
  uniform_bucket_level_access = true   # la regla común queda fija dentro

  versioning {
    enabled = true
  }
}

# outputs.tf
output "url" {
  value = google_storage_bucket.this.url
}
```

El módulo raíz lo usa dos veces:

```hcl
module "logs" {
  source = "./modules/bucket"
  nombre = "tienda-logs"
}

module "backups" {
  source   = "./modules/bucket"
  nombre   = "tienda-backups"
  location = "europe-west1"
}

output "urls" {
  value = [module.logs.url, module.backups.url]
}
```

Tras añadir un bloque `module` hay que ejecutar **`terraform init`**, que instala los módulos (igual que los providers).

## Errores comunes

- **`source = "modules/bucket"`** sin `./`: Terraform no lo trata como ruta local, sino como una dirección del Registry.
- **Olvidar `terraform init`** tras añadir un módulo o cambiar su `source`: el plan falla con «Module not installed».
- **Intentar leer un recurso interno** (`module.logs.google_storage_bucket.this`): solo se ven los outputs.
- **Meter un bloque `provider` dentro del módulo**: lo hace menos reutilizable y complica borrar el módulo más adelante.
- **Crear módulos para envolver un único recurso** sin añadir nada: solo añaden una capa más. Un módulo tiene sentido cuando agrupa recursos o impone reglas.

## En la entrevista

**«¿Qué es un módulo de Terraform y para qué sirve?»**
Un conjunto de archivos `.tf` en un directorio, con variables como entrada y outputs como salida. Sirve para reutilizar infraestructura, imponer estándares (por ejemplo, que todos los buckets tengan versionado) y ocultar detalles. El directorio donde ejecutas Terraform es el módulo raíz; los que llama son módulos hijos.

**«¿Cómo pasas datos entre módulos?»**
Hacia dentro, con los argumentos del bloque `module` (que rellenan sus variables). Hacia fuera, con los outputs del módulo, que se leen como `module.NOMBRE.OUTPUT`. Un output de un módulo puede ser la entrada de otro.

## Resumen

- Todo directorio con `.tf` es un **módulo**: el **raíz** llama a módulos **hijos**.
- Estructura habitual: `main.tf`, `variables.tf`, `outputs.tf`, `README.md`.
- Bloque `module "nombre" { source = "./ruta" ... }`: los argumentos rellenan sus variables.
- Desde fuera **solo se ven los outputs**: `module.NOMBRE.OUTPUT`.
- Tras añadir un módulo o cambiar su `source`: **`terraform init`**.
