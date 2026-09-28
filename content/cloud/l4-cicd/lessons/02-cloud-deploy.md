---
title: Cloud Deploy y estrategias de despliegue
minutes: 11
---

## Qué problema resuelve

Ya tienes la imagen construida y publicada. Ahora hay que llevarla a **dev**, después a **staging** y, cuando alguien lo apruebe, a **producción**, y poder **volver atrás** si algo falla. Hacerlo con scripts propios para cada aplicación acaba siendo frágil y distinto en cada equipo.

**Cloud Deploy** gestiona la **entrega continua** (**CD**): define una secuencia de entornos, **promociona** la misma versión de uno a otro, pide **aprobaciones** y permite hacer **rollback**. Además, hay que elegir **cómo** se sustituye la versión vieja por la nueva: la **estrategia de despliegue**.

## Analogía

Cloud Deploy es como el **control de calidad de una fábrica** con varias estaciones: el mismo lote pasa primero por la prueba interna (dev), después por el control de calidad (staging) y solo con la firma del responsable sale a la tienda (producción). Si un lote sale defectuoso, se retira y vuelve el anterior.

## Concepto

### Piezas de Cloud Deploy

- **Delivery pipeline**: la secuencia de entornos, por ejemplo `dev → staging → pro`.
- **Target**: cada entorno de destino (un clúster de GKE, un servicio de Cloud Run…). Un target puede **exigir aprobación**.
- **Release**: una versión concreta de la aplicación (las imágenes y los manifiestos). Es **inmutable**: lo que se probó en staging es exactamente lo que llega a pro.
- **Rollout**: el despliegue de una release en un target.
- Por debajo usa **Skaffold** para renderizar y aplicar los manifiestos.

Flujo típico: Cloud Build publica la imagen y crea una **release**, que se despliega automáticamente en el primer target (dev). Después se **promociona** a staging y, con aprobación, a pro.

### Estrategias de despliegue

| Estrategia | Cómo funciona | A favor | En contra |
|---|---|---|---|
| **Rolling update** | Sustituye las instancias poco a poco (lo que hace un Deployment por defecto) | Sencillo, sin recursos extra | Conviven versiones; volver atrás lleva tiempo |
| **Blue/green** | Levanta la versión nueva completa al lado y cambia todo el tráfico de golpe | Cambio y vuelta atrás instantáneos | Necesitas el doble de recursos durante el cambio |
| **Canary** | Envía un porcentaje pequeño del tráfico (5 %, 25 %…) a la versión nueva y lo va subiendo si todo va bien | Limita el impacto de un fallo | Más complejo; necesita buenas métricas |

Cloud Deploy soporta despliegues **canary** en GKE y Cloud Run. En Cloud Run, además, puedes repartir el tráfico entre revisiones a mano (lo viste en el módulo de serverless).

### Cadena de suministro segura

- **Binary Authorization**: solo permite desplegar en GKE o Cloud Run imágenes **firmadas o verificadas** (por ejemplo, construidas por tu Cloud Build y sin vulnerabilidades críticas).
- Despliega por **digest** (`@sha256:...`) o con **etiquetas inmutables**, para que la imagen no cambie entre entornos.

### GitOps

Una alternativa popular es **GitOps**: el estado deseado de cada entorno vive en un repositorio git, y una herramienta dentro del clúster (**Argo CD** o **Flux**) lo aplica continuamente. Desplegar = hacer merge de un cambio en ese repositorio.

## Ejemplo

```bash
# Cloud Build, tras publicar la imagen, crea la release (se despliega en dev)
gcloud deploy releases create web-1-4-0 \
  --delivery-pipeline=web --region=europe-west1 \
  --images=web=europe-west1-docker.pkg.dev/tienda/apps/web:1.4.0

# Tras validar en dev, promocionar al siguiente target (staging)
gcloud deploy releases promote --release=web-1-4-0 \
  --delivery-pipeline=web --region=europe-west1
```

```text
Pipeline "web":  dev (automático) → staging → pro (requiere aprobación)
```

## Errores comunes

- **Reconstruir la imagen para cada entorno**: lo que llega a pro no es lo que se probó. Construye una vez y promociona.
- **Desplegar `latest`**: no sabes qué hay en cada entorno ni puedes volver atrás con seguridad.
- **Canary sin métricas**: si no mides errores y latencia de la versión nueva, no sabes si subir el porcentaje.
- **Producción sin aprobación ni rollback probado**.
- **Blue/green sin contar el coste**: durante el cambio pagas dos entornos completos.

## En la entrevista

**«Diseña un pipeline de CI/CD para una aplicación en GKE.»**
CI con Cloud Build: tests, imagen etiquetada con el commit y publicada en Artifact Registry con análisis de vulnerabilidades. CD con Cloud Deploy: una release inmutable que se despliega en dev y se promociona a staging y a pro con aprobación, idealmente con canary en pro. Binary Authorization para desplegar solo imágenes verificadas, y rollback a la release anterior si fallan las métricas.

**«¿Diferencia entre blue/green y canary?»**
Blue/green levanta la versión nueva completa y cambia todo el tráfico de golpe, con vuelta atrás instantánea pero doble coste temporal. Canary envía primero una parte pequeña del tráfico a la versión nueva y la va aumentando, limitando el impacto de un fallo.

## Resumen

- **Cloud Deploy**: **delivery pipeline** (secuencia de **targets**), **releases** inmutables, **promoción**, aprobaciones y rollback. Usa Skaffold.
- **Construye una vez, promociona** la misma imagen por los entornos.
- Estrategias: **rolling**, **blue/green**, **canary**.
- **Binary Authorization** y despliegue por **digest** para una cadena de suministro segura.
- **GitOps** (Argo CD, Flux) como alternativa: git como fuente de verdad.
