---
title: Tu primer recurso con Terraform
minutes: 10
---

## Qué problema resuelve

Crear infraestructura a mano (clic a clic en la consola de la nube) funciona para probar, pero en un equipo real da problemas:

- nadie recuerda **exactamente** qué se configuró ni por qué,
- repetir el mismo entorno (desarrollo, pruebas, producción) es lento y propenso a errores,
- no hay historial de cambios ni revisión antes de tocar producción.

**Terraform** resuelve esto con *infraestructura como código* (IaC): describes en archivos de texto **qué** infraestructura quieres, y Terraform se encarga de crearla, cambiarla o borrarla para que la realidad coincida con lo escrito. Esos archivos se guardan en git, se revisan y se reutilizan.

## Analogía

Es como el **plano de una casa** frente a dar instrucciones al albañil de palabra. Con el plano cualquiera sabe cómo debe quedar, puedes construir dos casas iguales, y si cambias el plano, el albañil (Terraform) solo hace las obras necesarias para que la casa coincida con el nuevo plano.

## Concepto

Terraform es **declarativo**: describes el estado final deseado, no los pasos para llegar a él.

1. **Archivos `.tf`** escritos en **HCL** (HashiCorp Configuration Language). Terraform lee todos los `.tf` de la carpeta.
2. **Providers.** Plugins que saben hablar con cada plataforma (Google Cloud, AWS, Azure, Kubernetes...). Se declaran en el bloque `terraform { required_providers { ... } }` y se configuran con un bloque `provider`.
3. **Resources.** Cada bloque `resource "TIPO" "NOMBRE"` es una pieza de infraestructura. El **TIPO** lo define el provider (p. ej. `google_storage_bucket`) y el **NOMBRE** es solo un nombre local para referirte a él dentro de Terraform.
4. **State.** Terraform guarda en un archivo de *state* (por defecto `terraform.tfstate`) qué recursos reales corresponden a tu código. Así sabe qué debe crear, cambiar o borrar.
5. **El ciclo de trabajo:**

| Comando | Qué hace |
|---|---|
| `terraform init` | Prepara la carpeta: descarga los providers necesarios. Se ejecuta la primera vez y cuando cambian los providers. |
| `terraform plan` | Compara el código con el state y la realidad, y **muestra** lo que haría. No cambia nada. |
| `terraform apply` | Muestra el plan y, tras confirmar, **aplica** los cambios. |
| `terraform destroy` | Borra todo lo que gestiona esa configuración. |

La sintaxis básica de HCL:

- **Bloques**: `tipo "etiqueta" "etiqueta" { ... }`
- **Atributos**: `nombre = valor` (con `=`, no con `:` como en YAML)
- **Valores**: textos entre comillas `"..."`, números, `true`/`false`, listas `[...]` y mapas `{ clave = valor }`
- **Comentarios**: `#` o `//`

## Ejemplo

Un bucket de Cloud Storage en Google Cloud:

```hcl
# Qué providers necesita esta configuración
terraform {
  required_providers {
    google = {
      source = "hashicorp/google"   # de dónde se descarga el provider
    }
  }
}

# Configuración del provider: en qué proyecto y región trabajar
provider "google" {
  project = "mi-proyecto-123"
  region  = "europe-west1"
}

# El recurso: TIPO "google_storage_bucket", NOMBRE local "logs"
resource "google_storage_bucket" "logs" {
  name     = "mi-empresa-logs-2026"  # nombre real del bucket: único en todo GCS
  location = "EU"                    # ubicación (aquí, multirregión Europa)

  labels = {                         # un mapa de etiquetas
    env = "dev"
  }
}
```

Y el ciclo completo en la terminal:

```bash
terraform init      # descarga el provider de Google
terraform plan      # "Plan: 1 to add, 0 to change, 0 to destroy."
terraform apply     # crea el bucket tras confirmar con "yes"
```

## Errores comunes

- **Confundir el nombre local con el nombre real.** En `resource "google_storage_bucket" "logs"`, `logs` solo existe dentro de Terraform; el nombre del bucket en Google Cloud es el atributo `name`.
- **Usar `:` en lugar de `=`** por costumbre de YAML o JSON.
- **Saltarse `terraform plan`.** Revisar el plan antes de aplicar es lo que evita borrar algo por accidente.
- **Cambiar a mano lo que gestiona Terraform.** Tu código y la realidad dejan de coincidir; en el siguiente `plan`, Terraform intentará deshacer esos cambios.
- **Subir el archivo de state a git.** Puede contener datos sensibles; en equipo se guarda en un *backend remoto* (lo verás más adelante).

## En la entrevista

**«¿Qué significa que Terraform sea declarativo?»**
Que describes el estado final que quieres y Terraform calcula qué cambios hacen falta para llegar a él, en vez de escribir tú los pasos uno a uno.

**«¿Para qué sirve el state?»**
Para relacionar cada recurso del código con el recurso real que representa. Con él, Terraform sabe qué existe ya y puede calcular qué crear, cambiar o borrar en el `plan`.

## Resumen

- Terraform es **infraestructura como código declarativa**: describes el resultado, no los pasos.
- Los **providers** hablan con cada plataforma; los **resources** son las piezas de infraestructura.
- En `resource "TIPO" "NOMBRE"`, el NOMBRE es **local**; el nombre real va en los atributos.
- El **state** relaciona tu código con la infraestructura real.
- Ciclo: **`init` → `plan` → `apply`** (y `destroy` para borrar).
