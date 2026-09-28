---
title: Secretos y buenas prácticas de código
minutes: 11
---

## Qué problema resuelve

Tarde o temprano, Terraform maneja **secretos**: la contraseña de una base de datos, un token de una API. Y un repositorio de infraestructura crece y lo tocan muchas personas. Sin reglas claras:

- Las contraseñas acaban en **git**, en los **logs del pipeline** o en el **state**.
- Cada módulo sigue su propio estilo y nadie encuentra nada.
- Un error pequeño llega a producción porque nadie lo probó.

## Analogía

Los secretos en Terraform son como las **llaves de un edificio** que gestiona una empresa de mantenimiento: no se dejan copias en el tablón de anuncios (git), no se leen en voz alta en las reuniones (los logs), y el armario donde se guardan (el state) tiene su propia cerradura.

## Concepto

### Dónde se escapan los secretos

| Sitio | Riesgo | Qué hacer |
|---|---|---|
| Código y `.tfvars` en git | Cualquiera con acceso al repo | Nunca secretos en archivos versionados |
| Salida del plan y logs | Cualquiera que vea el pipeline | `sensitive = true` en variables y outputs |
| **State** | Guarda los valores **en claro** | Backend con acceso restringido y cifrado; evitar que lleguen al state |

### `sensitive`

```hcl
variable "db_password" {
  type      = string
  sensitive = true          # se muestra como (sensitive value) en plan y logs
}
```

`sensitive` **oculta** el valor en la salida, pero **sigue guardándose en el state**.

### Que el secreto no llegue al state

- **Argumentos write-only** (Terraform 1.11 o posterior): algunos recursos tienen argumentos que acaban en `_wo`, como `password_wo`, que se envían al proveedor pero **nunca se guardan** en el plan ni en el state. Suelen ir acompañados de un argumento de versión (`password_wo_version`) para indicar cuándo cambiarlo.
- **Valores efímeros** (`ephemeral = true` en variables y outputs, y bloques `ephemeral`): existen solo durante la ejecución.
- **Que lo gestione otro sistema**: por ejemplo, Cloud SQL con autenticación IAM, o la aplicación leyendo la contraseña de **Secret Manager** en tiempo de ejecución, sin que Terraform llegue a conocerla.

Y, en cualquier caso, **protege el state**: bucket sin acceso público, permisos mínimos, versionado y cifrado.

### Pasar valores sensibles al pipeline

- Variables de entorno **`TF_VAR_nombre`**: Terraform las lee como la variable `nombre`. El sistema de CI las guarda como secretos y las oculta en los logs.
- Nunca en `-var="password=..."` en un script versionado.

### Buenas prácticas de código

- **Estructura clara**: `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf` (el bloque `terraform`), y un `README.md` por módulo.
- **Variables con `type` y `description`**, y `validation` cuando haya valores prohibidos.
- **Nada fijo que cambie por entorno** (proyecto, región, tamaños): a variables.
- **Etiquetas comunes** en todos los recursos (`env`, `equipo`, `coste`), por ejemplo con `default_labels` del provider de Google.
- **Módulos pequeños** con una responsabilidad, versionados.
- **Probar** los módulos: `terraform test` ejecuta pruebas escritas en HCL (archivos `.tftest.hcl`).

## Ejemplo

```hcl
variable "api_token" {
  type        = string
  description = "Token de la API de pagos"
  sensitive   = true
}

output "db_connection" {
  value     = "postgresql://app@${google_sql_database_instance.pedidos.private_ip_address}/pedidos"
  sensitive = true
}

provider "google" {
  project = var.proyecto
  region  = var.region
  default_labels = {
    equipo = "tienda"
    env    = var.entorno
  }
}
```

```bash
export TF_VAR_api_token="..."      # lo inyecta el sistema de CI desde sus secretos
terraform plan
```

```text
  + api_token = (sensitive value)
```

## Errores comunes

- **Creer que `sensitive = true` cifra el valor**: solo lo oculta en la salida; en el state sigue en claro.
- **Subir `terraform.tfvars` con contraseñas** al repositorio.
- **State en un bucket con acceso amplio**: quien lee el state lee los secretos.
- **`output` de un secreto sin `sensitive`**: aparece en los logs del pipeline.
- **Valores fijos del entorno** (IDs de proyecto) dentro de los módulos: no se pueden reutilizar.

## En la entrevista

**«¿Cómo gestionas secretos con Terraform?»**
No los guardo en el código ni en tfvars versionados. Los paso como variables `sensitive` desde el gestor de secretos del CI (`TF_VAR_...`), y cuando el proveedor lo permite uso argumentos write-only o valores efímeros para que no lleguen al state. Mejor aún, que no pasen por Terraform: la aplicación los lee de Secret Manager. Y el state vive en un backend con acceso restringido, cifrado y versionado.

**«¿`sensitive = true` protege el state?»**
No: solo oculta el valor en el plan y en los logs. El state lo guarda igualmente en claro.

## Resumen

- Los secretos se escapan por **git**, **logs** y **state**.
- **`sensitive`** oculta en la salida, **no** en el state.
- **Write-only** (`_wo`) y **ephemeral**: el secreto no se guarda.
- Secretos al pipeline con **`TF_VAR_...`** desde el gestor de secretos del CI.
- Código: estructura estándar, variables tipadas, etiquetas comunes, módulos pequeños y **`terraform test`**.
