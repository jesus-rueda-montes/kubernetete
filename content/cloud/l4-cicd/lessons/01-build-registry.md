---
title: Cloud Build y Artifact Registry
minutes: 12
---

## Qué problema resuelve

Cada vez que alguien sube código, hay que: ejecutar los tests, construir la imagen del contenedor, analizarla y publicarla en un registro. Hacerlo a mano desde un portátil es lento, no queda registro y depende de lo que tenga instalado cada uno.

- **Cloud Build** ejecuta esos pasos en Google Cloud, de forma automática (**CI**: integración continua).
- **Artifact Registry** guarda las imágenes y otros paquetes (npm, Python, Maven…), con control de acceso y análisis de vulnerabilidades.

## Analogía

Cloud Build es una **cadena de montaje**: recibe las piezas (el código), pasa por estaciones (tests, compilación, empaquetado) y deja el producto terminado en el **almacén** (Artifact Registry), etiquetado y listo para enviar.

## Concepto

### Cloud Build

Una compilación es una lista de **pasos** (*steps*). Cada paso se ejecuta en un **contenedor**: la imagen que indiques (por ejemplo, `gcr.io/cloud-builders/docker` o `python:3.12`). Todos los pasos comparten el directorio `/workspace`.

```yaml
# cloudbuild.yaml
steps:
  - id: tests
    name: python:3.12
    entrypoint: bash
    args: ["-c", "pip install -r requirements.txt && pytest"]

  - id: build
    name: gcr.io/cloud-builders/docker
    args: ["build", "-t", "europe-west1-docker.pkg.dev/$PROJECT_ID/apps/web:$SHORT_SHA", "."]

images:                                   # imágenes que se publican al terminar
  - europe-west1-docker.pkg.dev/$PROJECT_ID/apps/web:$SHORT_SHA
```

- **Sustituciones**: variables como `$PROJECT_ID`, `$COMMIT_SHA`, `$SHORT_SHA` o `$BRANCH_NAME` (estas últimas las rellenan los **triggers**). Las tuyas deben empezar por **`_`** (`_ENTORNO`).
- Los pasos se ejecutan **en orden**; con `waitFor` se pueden ejecutar en paralelo.
- **Triggers**: lanzan la compilación automáticamente al hacer push a una rama, abrir una pull request o crear una etiqueta en GitHub, GitLab o Bitbucket.
- Cada compilación se ejecuta con una **cuenta de servicio**: indica una propia con solo los permisos necesarios, en vez de depender de la cuenta por defecto.
- Los **grupos privados** (*private pools*) permiten compilar con acceso a recursos privados de tu VPC.

Para un caso sencillo, `gcloud builds submit --tag IMAGEN` construye con el Dockerfile y publica, sin escribir `cloudbuild.yaml`.

### Artifact Registry

- Repositorios de varios **formatos**: `docker`, `npm`, `python`, `maven`, `go`, `apt`, `yum`…
- Cada repositorio es **regional** o **multirregional**. Las imágenes Docker se nombran así:

```text
europe-west1-docker.pkg.dev/PROYECTO/REPOSITORIO/IMAGEN:ETIQUETA
```

- Permisos con IAM **por repositorio** (`roles/artifactregistry.reader`, `...writer`).
- **Análisis de vulnerabilidades** de las imágenes (Artifact Analysis).
- **Etiquetas inmutables** (opcional): una etiqueta no se puede reutilizar para otra imagen.
- Sustituye a **Container Registry** (`gcr.io`), que se **cerró** el 18 de marzo de 2025 para escribir imágenes.

Para usarlo con Docker desde tu equipo: `gcloud auth configure-docker europe-west1-docker.pkg.dev`.

## Ejemplo

```bash
# Crear un repositorio Docker en Europa
gcloud artifacts repositories create apps \
  --repository-format=docker --location=europe-west1 --immutable-tags

# Construir y publicar con el Dockerfile del directorio actual
gcloud builds submit --tag europe-west1-docker.pkg.dev/tienda/apps/web:1.4.0

# O con un cloudbuild.yaml y una sustitución propia
gcloud builds submit --config=cloudbuild.yaml --substitutions=_ENTORNO=pro
```

## Errores comunes

- **Etiquetar siempre como `latest`**: no sabes qué versión está desplegada ni puedes volver a una concreta. Usa el commit (`$SHORT_SHA`) o una versión.
- **Sustituciones propias sin `_`**: Cloud Build las rechaza.
- **Usar `$SHORT_SHA` con `gcloud builds submit` a mano**: solo la rellenan los triggers; a mano queda vacía y la etiqueta de la imagen no es válida.
- **Seguir usando `gcr.io`** para publicar: Container Registry está cerrado. Usa Artifact Registry.
- **Cuenta de servicio de la compilación con permisos de Editor**: un pipeline comprometido puede tocar todo el proyecto.
- **Repositorio en otra región** que el clúster o Cloud Run: más latencia y coste de transferencia al descargar imágenes.

## En la entrevista

**«¿Cómo montarías la integración continua de un servicio en contenedores en GCP?»**
Un trigger de Cloud Build en cada pull request y en cada push a main. El `cloudbuild.yaml` ejecuta los tests, construye la imagen etiquetada con el commit y la publica en Artifact Registry, que la analiza en busca de vulnerabilidades. La compilación usa una cuenta de servicio propia con permisos mínimos.

**«¿Qué diferencia hay entre Artifact Registry y Container Registry?»**
Artifact Registry es el sustituto: soporta muchos formatos (no solo Docker), repositorios regionales con IAM por repositorio y análisis de vulnerabilidades. Container Registry está cerrado para escribir desde marzo de 2025.

## Resumen

- **Cloud Build**: pasos en contenedores (`cloudbuild.yaml`), **sustituciones** (`$SHORT_SHA`, las tuyas con `_`), **triggers** y cuenta de servicio propia.
- `gcloud builds submit --tag` (con Dockerfile) o `--config` (con `cloudbuild.yaml`).
- **Artifact Registry**: repositorios por formato y región; `REGIÓN-docker.pkg.dev/PROYECTO/REPO/IMAGEN:TAG`.
- IAM por repositorio, análisis de vulnerabilidades, etiquetas inmutables.
- **Container Registry** (`gcr.io`) está cerrado.
