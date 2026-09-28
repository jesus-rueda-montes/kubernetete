---
title: Fuentes de módulos y versionado
minutes: 10
---

## Qué problema resuelve

Un módulo en tu propio repositorio solo sirve para ese repositorio. Pero muchas veces quieres:

- **Reutilizar módulos públicos** bien probados (por ejemplo, una VPC completa) en vez de escribirlos desde cero.
- **Compartir tus módulos** entre varios repositorios de tu empresa.
- **Controlar cuándo** te llega un cambio del módulo, para que una actualización del autor no rompa tu infraestructura por sorpresa.

Para eso están las distintas **fuentes** (`source`) y el **versionado**.

## Analogía

Es como usar **librerías** en programación:

- Una **ruta local** es copiar un archivo de tu propio proyecto.
- El **Registry** es como npm o PyPI: un catálogo público con versiones.
- Un **repositorio git** es instalar una librería directamente desde GitHub, eligiendo una etiqueta concreta.

Igual que con las librerías, **fijas la versión** para que tu proyecto no cambie solo.

## Concepto

### Tipos de `source`

| Fuente | Ejemplo | Cómo se elige la versión |
|---|---|---|
| **Local** | `"./modules/bucket"` | No se versiona: usa el código que hay en ese momento. |
| **Terraform Registry** | `"terraform-google-modules/network/google"` | Argumento **`version`**. |
| **git** | `"git::https://github.com/tienda/modulos.git?ref=v1.2.0"` | Parámetro **`?ref=`** (etiqueta, rama o commit). |

- La dirección del Registry tiene tres partes: **`namespace/nombre/provider`**.
- El argumento `version` **solo funciona con módulos de un registry** (el público o uno privado de HCP Terraform). Con git se usa `?ref=`, y los locales no se versionan.
- Para un **subdirectorio** dentro de un repositorio se usa `//`: `"git::https://github.com/tienda/modulos.git//bucket?ref=v1.2.0"`.
- `source` tiene que ser un **texto literal**: no admite variables.

### Restricciones de versión

| Restricción | Qué admite |
|---|---|
| `"5.1.0"` o `"= 5.1.0"` | Solo esa versión exacta. |
| `">= 5.0"` | Esa o cualquier posterior. |
| `"~> 5.1"` | 5.1, 5.2, 5.10… pero **no** 6.0. |
| `"~> 5.1.0"` | 5.1.1, 5.1.9… pero **no** 5.2.0. |

`~>` deja subir **solo la última cifra** que escribes. Por eso fija un límite superior.

### Instalar y actualizar

- **`terraform init`** descarga los módulos remotos al directorio oculto `.terraform/modules`.
- Si cambias `source` o `version`, vuelve a ejecutar `terraform init`.
- **`terraform init -upgrade`** busca la versión **más nueva** que permita la restricción, tanto de módulos como de providers.

Ojo: el archivo **`.terraform.lock.hcl`** solo registra las versiones de los **providers**, **no** las de los módulos. Si quieres que todo el equipo use exactamente la misma versión de un módulo, fíjala en `version` o en `?ref=`.

## Ejemplo

```hcl
# Módulo público del Terraform Registry, con la versión acotada
module "red" {
  source  = "terraform-google-modules/network/google"
  version = "~> 18.0"            # 18.x, pero nunca 19.0 (mira la última en el Registry)
  # ... sus variables, según la documentación del módulo en el Registry
}

# Módulo interno de la empresa, fijado a una etiqueta de git
module "bucket_logs" {
  source = "git::https://github.com/tienda/modulos-terraform.git//bucket?ref=v1.4.0"
  nombre = "tienda-logs"
}
```

```bash
terraform init            # descarga ambos módulos
terraform init -upgrade   # tras cambiar la restricción: busca la versión más nueva permitida
```

## Errores comunes

- **Poner `version` a un módulo local o de git**: Terraform lo rechaza. En git se usa `?ref=`.
- **No fijar ninguna versión** de un módulo externo: el próximo `init -upgrade` puede traer una versión con cambios incompatibles.
- **Usar `?ref=main`** (una rama) en producción: la rama cambia; una **etiqueta** o un commit no.
- **Pensar que `.terraform.lock.hcl` bloquea los módulos**: solo bloquea providers.
- **Intentar poner una variable en `source`**: tiene que ser un texto fijo.

## En la entrevista

**«¿Cómo versionas los módulos de Terraform?»**
Los del Registry con el argumento `version`, normalmente con `~>` para aceptar parches y versiones menores sin saltar de versión mayor. Los de git con `?ref=` apuntando a una etiqueta. Los módulos internos se publican con versiones semánticas (v1.4.0) y cada entorno sube de versión cuando le toca, revisando el plan.

**«¿Qué diferencia hay entre `terraform init` y `terraform init -upgrade`?»**
`init` instala lo que falta respetando lo que ya hay instalado y el lock file de providers. `-upgrade` busca las versiones más nuevas que permitan las restricciones, tanto de providers como de módulos.

## Resumen

- Fuentes: **local** (`./`), **Registry** (`namespace/nombre/provider` + `version`) y **git** (`?ref=`).
- `version` **solo** para módulos de registry; en git, `?ref=` con una **etiqueta**.
- `~> 5.1` = 5.x desde la 5.1; `~> 5.1.0` = 5.1.x.
- `terraform init` instala; `terraform init -upgrade` busca versiones más nuevas.
- `.terraform.lock.hcl` solo fija **providers**, no módulos.
