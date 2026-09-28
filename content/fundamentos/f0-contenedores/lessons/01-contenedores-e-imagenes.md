---
title: Contenedores e imágenes
minutes: 10
---

## Qué problema resuelve

El clásico «**en mi máquina funciona**»: la aplicación va bien en el portátil del desarrollador, pero en el servidor falla porque tiene otra versión de Python, falta una librería o la configuración es distinta.

Un **contenedor** empaqueta la aplicación **junto con todo lo que necesita** (runtime, librerías, archivos) y se ejecuta igual en cualquier sitio: tu portátil, un servidor o un clúster de Kubernetes.

## Analogía

Los **contenedores de mercancías** del transporte marítimo: da igual lo que haya dentro (muebles, fruta, coches), todos tienen el mismo tamaño y los mismos enganches, así que cualquier barco, grúa o camión los maneja igual.

- La **imagen** es el **plano y el contenido sellado** del contenedor.
- El **contenedor** es una **copia en uso** de esa imagen.
- El **registro** es el **puerto de almacenamiento** de donde se recogen.

## Concepto

### Contenedor frente a máquina virtual

| | Máquina virtual | Contenedor |
|---|---|---|
| Qué virtualiza | Todo el hardware; cada VM lleva **su propio sistema operativo** | Solo aísla procesos; **comparte el kernel** del sistema anfitrión |
| Tamaño | Gigabytes | Megabytes |
| Arranque | Minutos | Segundos o menos |
| Aislamiento | Muy fuerte | Fuerte, pero menor (mismo kernel) |

Un contenedor es, en el fondo, **un proceso de Linux aislado** mediante funciones del kernel: los **namespaces** (qué puede ver: procesos, red, ficheros) y los **cgroups** (cuánto puede consumir: CPU, memoria).

### Imagen

- Una **imagen** es una plantilla **de solo lectura** con el sistema de ficheros y la configuración para arrancar la aplicación.
- Está hecha de **capas** apiladas. Las capas se comparten entre imágenes y se guardan en caché, lo que ahorra espacio y tiempo.
- Al arrancar un contenedor se le añade una **capa de escritura**. Lo que escribe ahí **se pierde al borrar el contenedor**. Los datos que deben durar van en **volúmenes**.

### Nombres y registros

Una imagen se identifica como **`registro/repositorio:etiqueta`**:

```
europe-west1-docker.pkg.dev/mi-proyecto/tienda/web:1.4.2
└──────── registro ───────┘ └──── repositorio ───┘ └tag┘
```

- Si no indicas registro, se usa **Docker Hub** (`nginx:1.27` = `docker.io/library/nginx:1.27`).
- Si no indicas etiqueta, se usa **`latest`**, que no significa «la más nueva»: es solo una etiqueta más, y puede apuntar a cualquier cosa.
- Registros en la nube: **Artifact Registry** (GCP), ECR (AWS), ACR (Azure).
- El formato de imagen es un estándar abierto (**OCI**): una imagen construida con Docker funciona con containerd, CRI-O o Podman.

## Ejemplo

```bash
docker pull nginx:1.27                        # descarga la imagen
docker run -d --name web -p 8080:80 nginx:1.27  # arranca un contenedor en segundo plano
docker ps                                     # contenedores en marcha
docker logs web                               # su salida
docker exec -it web sh                        # abre una shell dentro
docker stop web                               # lo para (SIGTERM, luego SIGKILL)
docker rm web                                 # lo borra (y su capa de escritura)
```

`-p 8080:80` **publica** el puerto: lo que llegue al **8080 de tu máquina** va al **80 del contenedor**. Ahora `http://localhost:8080` muestra la página de nginx.

## Errores comunes

- **Usar `latest` en producción.** No sabes qué versión se ejecuta y dos despliegues pueden traer imágenes distintas. Fija siempre una versión.
- **Guardar datos importantes dentro del contenedor.** Al borrarlo, se pierden. Usa volúmenes.
- **Confundir imagen y contenedor.** La imagen es la plantilla; puedes arrancar muchos contenedores de la misma imagen.
- **Invertir los puertos de `-p`.** El formato es `HOST:CONTENEDOR`.
- **Pensar que un contenedor es una VM ligera** con SSH, cron y varios servicios. Lo idiomático es **un proceso principal por contenedor**.

## En la entrevista

**«¿Diferencia entre un contenedor y una máquina virtual?»**
La VM virtualiza el hardware y lleva su propio sistema operativo completo; el contenedor es un proceso aislado que comparte el kernel del anfitrión, gracias a namespaces y cgroups. Por eso el contenedor pesa menos y arranca antes, aunque aísla algo menos.

**«¿Qué pasa con los datos que escribe un contenedor cuando se borra?»**
Se pierden: se escriben en su capa de escritura, que desaparece con el contenedor. Lo que deba persistir va en volúmenes (o en servicios externos, como una base de datos).

## Resumen

- Un **contenedor** es un **proceso aislado** que comparte el kernel (namespaces + cgroups).
- Una **imagen** es una plantilla **de solo lectura** hecha de **capas**.
- Nombre de imagen: **`registro/repositorio:etiqueta`**; sin etiqueta = `latest` (evítalo).
- Lo escrito dentro del contenedor **se pierde** al borrarlo: usa **volúmenes**.
- Las imágenes son **OCI**: funcionan con Docker, containerd, CRI-O…
