---
title: Trabajar con gcloud
minutes: 8
---

## Qué problema resuelve

La consola web de Google Cloud es cómoda para explorar, pero para trabajar a diario (y para automatizar) necesitas la línea de comandos: es **repetible**, se puede poner en **scripts**, y es lo que verás en documentación, tutoriales y entrevistas. La CLI de Google Cloud es **`gcloud`**.

## Analogía

La consola web es **conducir un coche automático por la ciudad**: fácil, visual. `gcloud` es **tener el manual de mandos y poder programar rutas**: más curva de aprendizaje, pero haces lo mismo mil veces sin equivocarte.

## Concepto

### Estructura de los comandos

`gcloud` va **de lo general a lo concreto**:

```
gcloud  <grupo>   <subgrupo>  <acción>  <argumentos>  <flags>
gcloud  compute   instances   create    web-1         --zone=europe-west1-b
```

Grupos habituales: `compute` (VMs, redes), `storage` (Cloud Storage), `container` (GKE), `iam`, `projects`, `services` (APIs), `config`, `auth`.

### Autenticación: dos credenciales distintas

| Comando | Para quién |
|---|---|
| `gcloud auth login` | Para que **la propia CLI gcloud** actúe con tu cuenta. |
| `gcloud auth application-default login` | Para que **tus aplicaciones y herramientas** (librerías de Google, **Terraform**) usen tu cuenta en local: las **Application Default Credentials (ADC)**. |

Confundirlas es un clásico: «gcloud funciona pero Terraform dice que no tiene credenciales» → falta la segunda.

### Configuración

- `gcloud config set project ID` / `compute/region` / `compute/zone`: valores por defecto, para no repetir `--project` o `--zone` en cada comando.
- `gcloud config list`: qué configuración estás usando.
- **Configuraciones con nombre**: si trabajas con varios proyectos o cuentas, crea una por contexto y cambia entre ellas:

```bash
gcloud config configurations create tienda-dev   # crea y activa
gcloud config set project tienda-dev-7f3k
gcloud config configurations activate default    # vuelve a otra
```

### Flags globales útiles

- `--project`: actuar sobre otro proyecto solo en este comando.
- `--format=json|yaml|value(...)`: salida para scripts. Por ejemplo, `--format="value(name)"` imprime solo los nombres.
- `--filter`: filtrar resultados en el servidor o en la CLI.
- `--quiet` (`-q`): no preguntar (útil en scripts).

**Cloud Shell** es una terminal en el navegador, dentro de la consola, con `gcloud`, `kubectl` y `terraform` ya instalados y autenticados con tu cuenta.

## Ejemplo

```bash
gcloud auth login                              # 1. autenticar la CLI
gcloud config set project tienda-dev-7f3k      # 2. proyecto por defecto
gcloud config set compute/region europe-west1
gcloud config list                             # 3. comprobar

# Nombres de todas las regiones, uno por línea (para un script)
gcloud compute regions list --format="value(name)"

# Un comando puntual en otro proyecto, sin cambiar la configuración
gcloud services list --project=tienda-pro-9x2a
```

## Errores comunes

- **Trabajar en el proyecto equivocado.** Antes de crear o borrar algo, revisa `gcloud config list`. Las configuraciones con nombre ayudan a no mezclar entornos.
- **Olvidar `application-default login`** cuando Terraform u otra herramienta no encuentra credenciales en local.
- **Parsear la salida de tabla** en scripts. Usa `--format=json` o `--format="value(...)"`.
- **Descargar claves JSON de cuentas de servicio** para autenticarte en tu máquina. Mejor tu propia cuenta (o la suplantación de identidad de una cuenta de servicio, que verás en IAM).

## En la entrevista

**«¿Diferencia entre `gcloud auth login` y `gcloud auth application-default login`?»**
La primera autentica la CLI gcloud. La segunda crea las Application Default Credentials que usan las librerías cliente y herramientas como Terraform cuando se ejecutan en tu máquina.

**«¿Cómo trabajas con varios proyectos sin equivocarte?»**
Con configuraciones con nombre de gcloud (una por proyecto o entorno), revisando `gcloud config list` antes de operar, o pasando `--project` explícitamente en scripts.

## Resumen

- `gcloud <grupo> <subgrupo> <acción>`: de lo general a lo concreto.
- **`gcloud auth login`** (para la CLI) ≠ **`gcloud auth application-default login`** (para apps y Terraform).
- `gcloud config set project | compute/region | compute/zone` y **configuraciones con nombre** para varios contextos.
- `--format` y `--filter` para scripts; `--project` para un comando puntual.
- **Cloud Shell**: terminal en el navegador con todo instalado.
