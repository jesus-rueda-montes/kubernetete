---
title: Un directorio por entorno y estructura de un repositorio
minutes: 11
---

## Qué problema resuelve

Los workspaces no aíslan bien los entornos. La alternativa más habitual es tener **un directorio por entorno**: cada uno con su propio backend, sus valores y, si hace falta, sus credenciales. La lógica común vive en **módulos**, así que no se repite código.

Queda otra pregunta: **¿meto toda la infraestructura en una sola configuración?** Si todo está en un único state, un error en un cambio pequeño puede afectar a todo. Por eso se divide en **capas**.

## Analogía

Piensa en una cadena de restaurantes:

- Los **módulos** son las **recetas**: iguales en todos los locales.
- Cada **directorio de entorno** es un **local**: usa las mismas recetas, pero con su propia caja, sus llaves y su personal.
- Las **capas** son las **secciones** de cada local (cocina, sala, almacén). Una avería en la sala no cierra la cocina.

## Concepto

### Estructura típica

```text
infra/
├── modules/                 # la lógica reutilizable
│   ├── red/
│   ├── gke/
│   └── bucket/
└── entornos/
    ├── dev/
    │   ├── main.tf          # llama a ../../modules/...
    │   ├── backend.tf       # su propio backend (prefix "dev/...")
    │   └── terraform.tfvars # sus valores
    ├── staging/
    └── pro/
```

Cada directorio de `entornos/` es un **módulo raíz** independiente: tiene su `terraform init`, su backend y su plan.

- **Aislamiento real**: el state de `pro` puede ir en otro bucket (o en otro proyecto de GCP) al que solo accede el pipeline de `pro`.
- **Explícito**: para tocar `pro` tienes que estar en `entornos/pro`. No hay un «workspace seleccionado» invisible.
- **Diferencias claras**: si `pro` tiene algo que `dev` no, se ve en su `main.tf`, sin condicionales.
- **Coste**: algo de repetición en los `main.tf` de cada entorno (llamadas a módulos, backend). Se acepta a cambio de la claridad.

### Dividir en capas

Además de por entorno, se suele separar **por capas o componentes**, cada una con su state:

```text
entornos/pro/
├── red/        # VPC, subredes, firewall: cambia poco
├── gke/        # el clúster: usa la red
└── apps/       # buckets, bases de datos de cada aplicación: cambia a menudo
```

- **Menos radio de impacto** (*blast radius*): un error en `apps` no puede tocar la red.
- **Planes más rápidos**: cada `plan` refresca menos recursos.
- **Permisos por equipo**: el equipo de redes gestiona `red/`; los de producto, `apps/`.

### Compartir datos entre configuraciones

Si `gke/` necesita el ID de la subred creada en `red/`, hay dos opciones:

**1. Un data source del provider** (la opción preferida): lee el recurso directamente de la nube.

```hcl
data "google_compute_subnetwork" "gke" {
  name   = "gke-pro"
  region = "europe-west1"
}
```

**2. `terraform_remote_state`**: lee los **outputs del módulo raíz** de otro state.

```hcl
data "terraform_remote_state" "red" {
  backend = "gcs"
  config = {
    bucket = "tienda-tfstate-pro"
    prefix = "red"
  }
}

# uso: data.terraform_remote_state.red.outputs.subred_gke_id
```

- Solo expone los **outputs del módulo raíz** de ese state; no los recursos ni los outputs de módulos hijos.
- Quien puede leer esos outputs puede leer **el state entero**, secretos incluidos. Por eso la documentación recomienda preferir otras formas de publicar los datos cuando se pueda.

## Ejemplo

`entornos/pro/red/main.tf`:

```hcl
terraform {
  backend "gcs" {
    bucket = "tienda-tfstate-pro"   # bucket solo para pro
    prefix = "red"
  }
}

module "red" {
  source      = "../../../modules/red"
  nombre      = "vpc-pro"
  cidr_subred = "10.20.0.0/20"
}

output "subred_gke_id" {
  value = module.red.subred_id
}
```

`entornos/dev/red/main.tf` es casi igual, pero con el bucket `tienda-tfstate-dev`, el nombre `vpc-dev` y otro rango de IPs. El pipeline de `dev` no tiene permiso para leer el bucket de `pro`.

## Errores comunes

- **Un único state gigante** con toda la infraestructura: planes lentos y cualquier error puede tocarlo todo.
- **Copiar y pegar recursos** entre entornos en vez de usar módulos: los entornos acaban siendo distintos sin querer.
- **Usar el mismo bucket y las mismas credenciales** para `dev` y `pro`: se pierde gran parte del aislamiento.
- **Abusar de `terraform_remote_state`**: da acceso al state completo. Si el provider tiene un data source, úsalo.
- **Dividir demasiado**: decenas de configuraciones diminutas que dependen unas de otras también complican el trabajo.

## En la entrevista

**«¿Cómo estructurarías un repositorio de Terraform con dev, staging y pro?»**
Módulos reutilizables en `modules/` y un directorio por entorno en `entornos/`, cada uno con su backend y sus valores, y llamando a los mismos módulos con versiones fijadas. Dentro de cada entorno, separo por capas (red, clúster, aplicaciones) para reducir el radio de impacto. Cada entorno tiene su propio bucket de state y su cuenta de servicio en el pipeline.

**«¿Cómo pasas el ID de una red creada en otra configuración?»**
Preferiblemente con un data source del provider que busca la red por nombre. Si no es posible, con `terraform_remote_state` leyendo un output del otro state, sabiendo que eso requiere permiso de lectura sobre todo ese state.

## Resumen

- **Directorio por entorno** = módulo raíz propio, con **su backend y sus credenciales**.
- La lógica común vive en **`modules/`**; los entornos solo la llaman con valores distintos.
- Divide por **capas** (red, clúster, apps) para reducir el **radio de impacto**.
- Para leer datos de otra configuración: **data source** (preferido) o **`terraform_remote_state`** (solo outputs raíz; da acceso al state entero).
