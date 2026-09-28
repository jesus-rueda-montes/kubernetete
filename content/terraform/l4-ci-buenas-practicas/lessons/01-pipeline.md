---
title: Terraform en un pipeline
minutes: 12
---

## Qué problema resuelve

Mientras cada persona ejecuta `terraform apply` desde su portátil:

- Nadie **revisa** los cambios antes de aplicarlos.
- Cada uno tiene **versiones distintas** de Terraform y de los providers.
- Las **credenciales** con permisos de administrador viven en muchos portátiles.
- No queda **registro** de quién cambió qué ni por qué.

La solución es tratar la infraestructura como el resto del código: **pull requests**, **revisión** y un **pipeline** que ejecuta Terraform de forma controlada.

## Analogía

Es como el **proceso de obra** de un edificio: nadie tira un tabique por su cuenta. Se presenta el **plano del cambio** (el plan), lo **revisa** el arquitecto (la pull request) y lo ejecuta la **empresa autorizada** (el pipeline), siempre con las mismas herramientas.

## Concepto

### El flujo típico

```text
Pull request
  1. terraform fmt -check -recursive     → ¿está formateado?
  2. terraform init
  3. terraform validate                  → ¿es coherente?
  4. terraform plan -out=tfplan          → ¿qué va a cambiar? (se publica en la PR)
Revisión y aprobación de la PR
Merge a main
  5. terraform apply tfplan              → aplica exactamente lo revisado
```

- **`fmt -check`** no modifica nada: devuelve error si algún archivo no tiene el formato canónico. Así el pipeline obliga a formatear.
- **`validate`** comprueba la sintaxis y la coherencia interna (referencias, tipos) sin llamar a la nube.
- **`plan -out=tfplan`** guarda el plan en un archivo, y **`apply tfplan`** aplica **ese** plan, sin volver a calcularlo ni pedir confirmación. Si el state ha cambiado entretanto, Terraform lo rechaza por obsoleto.
- Publicar el plan en la pull request permite revisar **qué pasará de verdad**, no solo el diff del código.

Herramientas habituales en el pipeline: **TFLint** (errores y malas prácticas) y analizadores de seguridad como **Trivy** o **Checkov**.

### Versiones fijadas

```hcl
terraform {
  required_version = ">= 1.14, < 2.0"       # versión de Terraform permitida

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.0"                     # 8.x, nunca 9.0
    }
  }
}
```

- El archivo **`.terraform.lock.hcl`** guarda la versión exacta y los **checksums** de cada provider. **Súbelo a git**: así todos (y el pipeline) usan exactamente lo mismo.
- Para actualizar: `terraform init -upgrade`, revisar el cambio del lock file y hacer commit.
- Si el equipo usa varios sistemas operativos, `terraform providers lock -platform=linux_amd64 -platform=darwin_arm64 ...` guarda los checksums de todos.

### Credenciales del pipeline

- El pipeline usa una **cuenta de servicio propia**, con solo los permisos que necesita esa configuración.
- **Sin claves JSON**: en GCP, **Workload Identity Federation** permite que GitHub Actions o GitLab CI se autentiquen con su identidad (tokens de corta duración), sin guardar ninguna clave.
- Separa `plan` y `apply`: en las pull requests basta con permisos de **lectura**; los de escritura, solo para `apply` en la rama principal.

## Ejemplo

```bash
# En la pull request
terraform fmt -check -recursive
terraform init -input=false
terraform validate
terraform plan -input=false -out=tfplan

# Tras el merge, con el mismo plan
terraform apply -input=false tfplan
```

`-input=false` hace que Terraform **falle** en vez de quedarse esperando a que alguien escriba un valor: en un pipeline no hay nadie para responder.

## Errores comunes

- **No subir `.terraform.lock.hcl`** a git: cada ejecución puede usar una versión distinta del provider.
- **Aplicar sin plan guardado** en el pipeline: lo aplicado puede no ser lo que se revisó.
- **Claves JSON de cuentas de servicio** guardadas como secretos del pipeline: usa Workload Identity Federation.
- **Una cuenta con Owner** para todo: si el pipeline se compromete, se compromete todo.
- **Aplicar a mano desde el portátil** «solo esta vez»: el state y el repositorio dejan de coincidir.

## En la entrevista

**«¿Cómo sería tu pipeline de Terraform?»**
En cada pull request: `fmt -check`, `init`, `validate`, TFLint y un escáner de seguridad, y `plan -out` publicado en la PR. Tras la aprobación y el merge, `apply` de ese plan. Backend remoto con bloqueo, versiones de Terraform y providers fijadas con el lock file en git, y autenticación con Workload Identity Federation y una cuenta de servicio de mínimo privilegio.

**«¿Para qué sirve `.terraform.lock.hcl`?»**
Guarda la versión exacta y los checksums de cada provider, para que todas las ejecuciones usen los mismos binarios y detectar paquetes alterados. Se sube a git y se actualiza con `terraform init -upgrade`.

## Resumen

- PR: **`fmt -check`**, **`validate`**, **`plan -out`** (publicado en la PR); merge: **`apply tfplan`**.
- **`-input=false`** en pipelines.
- **`required_version`**, **`required_providers`** con `~>`, y **`.terraform.lock.hcl` en git**.
- Pipeline con **cuenta de servicio de mínimo privilegio** y **Workload Identity Federation** (sin claves).
- Nada de `apply` desde portátiles.
