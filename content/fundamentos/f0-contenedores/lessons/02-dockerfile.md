---
title: Construir imágenes con un Dockerfile
minutes: 10
---

## Qué problema resuelve

Para desplegar **tu** aplicación en un contenedor necesitas **tu propia imagen**. Un **Dockerfile** es la receta que dice cómo construirla, paso a paso, de forma **reproducible**: cualquiera (o tu sistema de CI) obtiene la misma imagen a partir del mismo código.

## Analogía

Un Dockerfile es una **receta de cocina**: parte de una base (`FROM`: «masa de pizza comprada»), añade ingredientes (`COPY`), hace preparaciones (`RUN`) y termina diciendo cómo servirla (`CMD`). Cada paso produce una **capa**, como las capas de una lasaña.

## Concepto

### Instrucciones principales

| Instrucción | Qué hace |
|---|---|
| `FROM imagen:tag` | Imagen base de la que partes. Siempre es la primera. |
| `WORKDIR /app` | Carpeta de trabajo para las instrucciones siguientes (la crea si no existe). |
| `COPY origen destino` | Copia archivos del **contexto de construcción** a la imagen. |
| `RUN comando` | Ejecuta un comando **durante la construcción** (instalar dependencias…). Crea una capa. |
| `ENV CLAVE=valor` | Variable de entorno que tendrá el contenedor. |
| `EXPOSE 8080` | **Documenta** el puerto en el que escucha la app. No lo publica por sí solo. |
| `USER app` | Usuario con el que se ejecuta el proceso (mejor que root). |
| `CMD ["programa", "arg"]` | Comando que se ejecuta **al arrancar el contenedor** (se puede sustituir al lanzarlo). |
| `ENTRYPOINT [...]` | Ejecutable fijo del contenedor; `CMD` le pasa los argumentos por defecto. |

`RUN` se ejecuta al **construir** la imagen; `CMD` al **arrancar** el contenedor. Es una confusión muy típica.

### Caché de capas

Docker reutiliza las capas que no han cambiado. Si una instrucción cambia, **esa y todas las siguientes** se reconstruyen. Por eso se copian primero los archivos de dependencias, se instalan, y **después** se copia el código, que es lo que más cambia.

### Buenas prácticas

- Imagen base **pequeña y con versión fija** (`python:3.12-slim`, no `python`).
- **`.dockerignore`** para no meter en el contexto `.git`, `node_modules`, secretos…
- **No ejecutar como root** (`USER`).
- **Multi-stage builds**: una etapa compila con todas las herramientas y la final solo copia el resultado. La imagen final es mucho más pequeña.
- **Nunca** meter secretos en la imagen (`COPY .env`, `ENV PASSWORD=...`): cualquiera con la imagen puede leerlos.

## Ejemplo

Dockerfile de una API en Python:

```dockerfile
# Base pequeña y con versión fija
FROM python:3.12-slim

WORKDIR /app

# Primero, solo las dependencias: esta capa se reutiliza mientras no cambien
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Después, el código (cambia a menudo)
COPY . .

ENV PORT=8080
# Documentación: la app escucha en 8080
EXPOSE 8080

# No ejecutar como root
RUN useradd --create-home app
USER app

# Lo que se ejecuta al arrancar el contenedor
CMD ["python", "main.py"]
```

En un Dockerfile, los comentarios (`#`) solo pueden ir **al principio de una línea**, nunca detrás de una instrucción.

```bash
docker build -t tienda-api:1.0 .      # construye con el contexto "." (carpeta actual)
docker run -d -p 8080:8080 tienda-api:1.0

# Subirla a Artifact Registry
docker tag tienda-api:1.0 europe-west1-docker.pkg.dev/mi-proyecto/tienda/api:1.0
docker push europe-west1-docker.pkg.dev/mi-proyecto/tienda/api:1.0
```

## Errores comunes

- **Copiar todo el código antes de instalar dependencias.** Cualquier cambio en el código invalida la caché y reinstala todo en cada build.
- **Olvidar el punto** en `docker build -t x .`: el último argumento es el **contexto**.
- **Creer que `EXPOSE` abre el puerto.** Para acceder desde fuera hace falta `-p` (o, en Kubernetes, un Service).
- **Poner `RUN` donde querías `CMD`** (o al revés).
- **Imágenes enormes** por partir de una base completa o dejar herramientas de compilación: usa bases *slim* y multi-stage.
- **Secretos en la imagen.** Quedan en sus capas aunque los borres en una instrucción posterior.

## En la entrevista

**«¿Diferencia entre `RUN` y `CMD`? ¿Y entre `CMD` y `ENTRYPOINT`?»**
`RUN` se ejecuta al construir la imagen y su resultado queda en una capa; `CMD` define lo que se ejecuta al arrancar el contenedor. `ENTRYPOINT` fija el ejecutable, y `CMD` aporta los argumentos por defecto, que se pueden sustituir al lanzar el contenedor.

**«¿Cómo reducirías el tamaño y el tiempo de construcción de una imagen?»**
Base pequeña (slim o distroless), multi-stage builds, ordenar las instrucciones para aprovechar la caché (dependencias antes que el código), `.dockerignore` y limpiar cachés de paquetes en la misma instrucción `RUN`.

## Resumen

- El **Dockerfile** describe cómo construir una imagen: `FROM`, `WORKDIR`, `COPY`, `RUN`, `ENV`, `USER`, `CMD`.
- **`RUN`** = al construir; **`CMD`** = al arrancar.
- Cada instrucción es una **capa**; ordénalas para aprovechar la **caché** (dependencias antes que el código).
- **`EXPOSE`** solo documenta; publicar un puerto es `-p` (o un Service en Kubernetes).
- Base pequeña y versionada, **no root**, **multi-stage** y **sin secretos**.
