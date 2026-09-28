---
title: Variables de entrada
minutes: 10
---

## Qué problema resuelve

En tu primer recurso escribiste los valores **a fuego**: el proyecto, la región, el nombre del bucket… Si quieres el mismo código para **desarrollo** y para **producción**, tendrías que copiarlo y cambiar los valores a mano, con el riesgo de olvidarte alguno.

Las **variables de entrada** (*input variables*) convierten esos valores en **parámetros**: el código es el mismo y lo que cambia son los valores que le pasas.

## Analogía

Una configuración con variables es como una **receta con raciones**: la receta dice «X gramos de arroz por persona» y tú decides cuántas personas sois. Misma receta, distinto resultado según el valor que le des.

## Concepto

### Declarar una variable

```hcl
variable "region" {
  type        = string                 # tipo de valor esperado
  description = "Región de GCP"        # documentación para quien use el código
  default     = "europe-west1"         # valor si nadie da otro (opcional)
}
```

Todos los argumentos son opcionales, pero es buena práctica poner siempre `type` y `description`.

| Argumento | Para qué |
|---|---|
| `type` | Tipo: `string`, `number`, `bool`, `list(...)`, `map(...)`, `set(...)`, `object({...})`, `tuple([...])` o `any`. |
| `description` | Explica qué es. |
| `default` | Valor por defecto. **Sin `default`, la variable es obligatoria**: si no le das valor, Terraform lo pregunta por teclado antes del plan. |
| `validation` | Reglas propias con `condition` y `error_message`. |
| `sensitive` | Oculta el valor en la salida de `plan` y `apply`. |
| `nullable` | Si admite el valor `null`. |

### Usar una variable

Dentro del código se lee con **`var.<nombre>`**:

```hcl
provider "google" {
  project = var.project_id
  region  = var.region
}
```

### Dar valores a las variables

De **menor a mayor** prioridad (si una variable recibe valor por varias vías, gana la última de la lista):

1. El `default` de la propia variable.
2. Variables de entorno **`TF_VAR_<nombre>`**, por ejemplo `TF_VAR_region=europe-west4`.
3. El archivo **`terraform.tfvars`** (y después `terraform.tfvars.json`), que se carga **automáticamente**.
4. Archivos **`*.auto.tfvars`** (o `.auto.tfvars.json`), también automáticos, en orden alfabético.
5. Los flags **`-var 'region=europe-west4'`** y **`-var-file=prod.tfvars`** en la línea de comandos, en el orden en que los escribas.

Un archivo `.tfvars` solo contiene asignaciones:

```hcl
# prod.tfvars
project_id = "tienda-prod-123"
region     = "europe-west1"
```

### Validación

```hcl
variable "entorno" {
  type = string

  validation {
    condition     = contains(["dev", "pro"], var.entorno)
    error_message = "El entorno debe ser dev o pro."
  }
}
```

Si alguien pasa `entorno = "test"`, el plan falla con ese mensaje **antes** de tocar nada.

## Ejemplo

```hcl
variable "project_id" {
  type        = string
  description = "ID del proyecto de GCP"      # sin default: obligatoria
}

variable "region" {
  type        = string
  description = "Región donde crear los recursos"
  default     = "europe-west1"
}

variable "etiquetas" {
  type        = map(string)                   # mapa de texto a texto
  description = "Labels comunes a todos los recursos"
  default     = { equipo = "tienda" }
}

resource "google_storage_bucket" "datos" {
  name     = "${var.project_id}-datos"        # interpolación: texto con variables dentro
  location = var.region
  labels   = var.etiquetas
}
```

```bash
terraform plan -var-file=prod.tfvars          # usa los valores de prod.tfvars
terraform apply -var 'project_id=tienda-dev'  # un valor suelto
```

`"${...}"` es la **interpolación**: mete el valor de una expresión dentro de un texto.

## Errores comunes

- **Poner secretos en `default`** o en un `.tfvars` subido a git. Usa variables de entorno o un gestor de secretos, y márcalas como `sensitive`.
- **Escribir `variables.region`** o `$region`. La forma correcta es **`var.region`**.
- **No poner `type`.** Sin tipo, un error (una lista donde esperabas un texto) aparece tarde y con un mensaje confuso.
- **No saber de dónde sale un valor.** Recuerda la prioridad: `-var` gana a los `.tfvars`, y estos a `TF_VAR_` y al `default`.
- **Creer que `sensitive` cifra el valor.** Solo lo oculta en la salida de la terminal: el valor sigue guardado en el state.

## En la entrevista

**«¿Cómo reutilizas la misma configuración para dev y prod?»**
Parametrizándola con variables y pasando un `.tfvars` distinto por entorno (`-var-file=prod.tfvars`). Además, cada entorno necesita su propio state; eso se ve con los backends y los workspaces.

**«¿En qué orden se aplican los valores de las variables?»**
De menos a más prioridad: `default`, variables de entorno `TF_VAR_`, `terraform.tfvars`, `*.auto.tfvars` y, por último, `-var` y `-var-file` en la línea de comandos.

## Resumen

- Una **variable** se declara con `variable "nombre" { ... }` y se usa con **`var.nombre`**.
- Sin `default`, la variable es **obligatoria**.
- Valores por prioridad creciente: `default` → `TF_VAR_` → `terraform.tfvars` → `*.auto.tfvars` → `-var`/`-var-file`.
- `validation` rechaza valores incorrectos antes del plan.
- `sensitive` **oculta** el valor en la salida, pero **no lo cifra**.
