---
title: Workspaces de la CLI
minutes: 9
---

## Qué problema resuelve

Tienes una configuración que crea una red, una VM y un bucket. Quieres **la misma infraestructura** varias veces: una para `dev`, otra para `staging` y otra para `pro`. Si aplicas la misma configuración con el mismo state, Terraform solo conoce **una** copia: aplicar para `pro` cambiaría lo de `dev`.

Cada entorno necesita **su propio state**. Los **workspaces** son la forma que trae Terraform de tener **varios states para una misma configuración**.

## Analogía

Los workspaces son como las **pestañas de una hoja de cálculo**: las mismas fórmulas (el código) en cada pestaña, con datos distintos (el state). Cambias de pestaña y trabajas sobre otros datos.

El riesgo también es el mismo: es fácil **escribir en la pestaña equivocada**.

## Concepto

### Comandos

| Comando | Qué hace |
|---|---|
| `terraform workspace list` | Lista los workspaces; el actual lleva `*`. |
| `terraform workspace show` | Muestra el workspace actual. |
| `terraform workspace new dev` | Crea `dev` y cambia a él. |
| `terraform workspace select pro` | Cambia a `pro`. |
| `terraform workspace delete dev` | Borra el workspace (su state debe estar vacío, salvo que fuerces). |

- Siempre existe el workspace **`default`**, que **no se puede borrar**.
- Cada workspace tiene su state. En GCS se guarda como `<prefix>/<workspace>.tfstate`: `red/dev.tfstate`, `red/pro.tfstate`…
- Funcionan con los backends más comunes: local, GCS, S3, AzureRM…

### `terraform.workspace`

Dentro del código, **`terraform.workspace`** vale el nombre del workspace actual. Sirve para variar nombres o tamaños:

```hcl
locals {
  entorno = terraform.workspace
}

resource "google_compute_instance" "web" {
  name         = "web-${local.entorno}"
  machine_type = local.entorno == "pro" ? "e2-standard-4" : "e2-small"
  # ...
}
```

### Cuándo **no** usarlos

La documentación de Terraform lo dice claramente: los workspaces **no son adecuados** cuando los entornos necesitan **credenciales o controles de acceso distintos**. Y casi siempre es el caso:

- Todos los workspaces comparten el **mismo backend**: quien puede leer el state de `dev` puede leer el de `pro`.
- Todos usan las **mismas credenciales** del provider en ese momento.
- **Nada en el código** dice en qué workspace estás: un `apply` en el workspace equivocado cambia el entorno equivocado.
- Si `pro` necesita algo que `dev` no tiene, el código se llena de condicionales con `terraform.workspace`.

Uso razonable: **copias temporales** del mismo entorno (probar una rama, un entorno efímero por desarrollador) con las mismas credenciales.

Ojo con el nombre: los **workspaces de HCP Terraform** son otra cosa (cada uno con su configuración, variables y permisos). Aquí hablamos de los de la CLI.

## Ejemplo

```bash
terraform workspace new dev          # crea y selecciona "dev"
terraform apply -var-file=dev.tfvars

terraform workspace new pro
terraform apply -var-file=pro.tfvars

terraform workspace list
#   default
#   dev
# * pro
```

Con el backend `gcs` y `prefix = "web"`, el bucket tendrá `web/default.tfstate`, `web/dev.tfstate` y `web/pro.tfstate`.

## Errores comunes

- **Aplicar en el workspace equivocado**: comprueba con `terraform workspace show` (o muéstralo en el prompt) antes de cada `apply`.
- **Usar workspaces para separar `dev` de `pro`** con permisos distintos: no los aíslan. Usa directorios y backends separados.
- **Llenar el código de `terraform.workspace == "pro" ? ... : ...`**: señal de que los entornos son demasiado distintos para compartir configuración.
- **Confundirlos con los workspaces de HCP Terraform**, que funcionan de otra forma.

## En la entrevista

**«¿Usarías workspaces para separar dev y pro?»**
Normalmente no. Comparten backend y credenciales, así que no aíslan el acceso, y es fácil aplicar en el workspace equivocado. La propia documentación de Terraform dice que no son adecuados cuando hacen falta credenciales o controles de acceso distintos. Prefiero un directorio por entorno que llame a módulos comunes, cada uno con su backend. Los workspaces me sirven para copias temporales del mismo entorno.

**«¿Qué es `terraform.workspace`?»**
Una expresión que devuelve el nombre del workspace actual, para variar nombres o tamaños según el workspace.

## Resumen

- Workspace = **otro state** para la **misma configuración** y el **mismo backend**.
- Comandos: `workspace list`, `show`, `new`, `select`, `delete`; `default` siempre existe.
- `terraform.workspace` da el nombre del workspace actual.
- **No aíslan credenciales ni accesos**: no son la mejor forma de separar `dev` y `pro`.
- Buen uso: entornos **temporales** o copias idénticas.
